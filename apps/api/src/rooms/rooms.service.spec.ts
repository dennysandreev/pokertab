import { HttpStatus } from "@nestjs/common";
import {
  IdempotencyAction,
  RebuyEventSource,
  RebuyEventStatus,
  SettlementStatus,
  RoomPlayerRole,
  RoomPlayerStatus,
  RoomStatus,
  type Room,
  type RoomPlayer,
  type User
} from "@prisma/client";
import type { CreateRoomRequestDto, UserDto } from "@pokertable/shared";
import { PlayerStatsService } from "../player-stats/player-stats.service";
import { ApiError } from "../shared/api-error";
import { PrismaService } from "../prisma/prisma.service";
import { RoomsService } from "./rooms.service";

type RoomCreateArgs = {
  data: {
    ownerUserId: string;
    title: string;
    rebuyAmountMinor: bigint;
  };
};

type RoomPlayerCreateArgs = {
  data: {
    roomId: string;
    userId: string;
    role: RoomPlayerRole;
    status: RoomPlayerStatus;
  };
};

type RoomUpdateArgs = {
  data: Partial<{
    status: RoomStatus;
    startedAt: Date;
    closedAt: Date;
  }>;
  where: {
    id: string;
  };
};

type SettlementCreateArgs = {
  data: {
    roomId: string;
    status: string;
    totalBuyinsMinor: bigint;
    totalFinalAmountMinor: bigint;
    differenceMinor: bigint;
    closedByUserId: string;
  };
};

type SettlementTransferCreateManyArgs = {
  data: Array<{
    settlementId: string;
    fromRoomPlayerId: string;
    toRoomPlayerId: string;
    amountMinor: bigint;
  }>;
};

type MockPrisma = {
  room: {
    create: jest.Mock<Promise<Room>, [RoomCreateArgs]>;
    findUnique: jest.Mock;
    update: jest.Mock<Promise<Room & { players: RoomPlayer[] }>, [RoomUpdateArgs]>;
  };
  roomPlayer: {
    create: jest.Mock<Promise<RoomPlayer>, [RoomPlayerCreateArgs]>;
    findMany: jest.Mock;
    findUnique: jest.Mock;
    update: jest.Mock;
  };
  rebuyEvent: {
    create: jest.Mock;
    findMany: jest.Mock;
    findUnique: jest.Mock;
    update: jest.Mock;
  };
  settlement: {
    create: jest.Mock<Promise<{ id: string }>, [SettlementCreateArgs]>;
    findFirst: jest.Mock;
  };
  settlementTransfer: {
    createMany: jest.Mock<Promise<{ count: number }>, [SettlementTransferCreateManyArgs]>;
  };
  idempotencyKey: {
    create: jest.Mock;
    findUnique: jest.Mock;
    update: jest.Mock;
  };
  $transaction: jest.Mock;
};

const baseUser: UserDto = {
  id: "user-1",
  telegramId: "100",
  username: "denis",
  firstName: "Денис",
  lastName: null,
  avatarUrl: null
};

const createRoomInput: CreateRoomRequestDto = {
  title: "Покер у Дениса",
  currency: "RUB",
  rebuyAmountMinor: "100000",
  startingStack: 10000,
  gameType: "SIMPLE_TRACKING",
  rebuyPermission: "PLAYER_SELF"
};

describe("RoomsService", () => {
  beforeEach(() => {
    process.env.WEB_APP_URL = "https://miniapp.example";
    delete process.env.TELEGRAM_BOT_USERNAME;
  });

  it("creates a room and owner membership in one transaction", async () => {
    const prisma = createPrismaMock();
    const room = createRoomRecord();

    prisma.room.create.mockResolvedValue(room);
    prisma.roomPlayer.create.mockResolvedValue(createRoomPlayerRecord());
    prisma.$transaction.mockImplementation(
      async (
        callback: (transaction: Pick<MockPrisma, "room" | "roomPlayer">) => Promise<Room>
      ) => callback({ room: prisma.room, roomPlayer: prisma.roomPlayer })
    );

    const service = new RoomsService(prisma as unknown as PrismaService);

    const result = await service.createRoom(baseUser, createRoomInput);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    const roomCreateArgs = prisma.room.create.mock.calls[0]?.[0];
    const playerCreateArgs = prisma.roomPlayer.create.mock.calls[0]?.[0];

    expect(roomCreateArgs).toBeDefined();
    expect(roomCreateArgs?.data.ownerUserId).toBe(baseUser.id);
    expect(roomCreateArgs?.data.title).toBe(createRoomInput.title);
    expect(roomCreateArgs?.data.rebuyAmountMinor).toBe(100000n);
    expect(playerCreateArgs).toBeDefined();
    expect(playerCreateArgs?.data.roomId).toBe(room.id);
    expect(playerCreateArgs?.data.userId).toBe(baseUser.id);
    expect(playerCreateArgs?.data.role).toBe(RoomPlayerRole.OWNER);
    expect(playerCreateArgs?.data.status).toBe(RoomPlayerStatus.ACTIVE);
    expect(result.room.inviteUrl).toBe(`https://miniapp.example/join/${room.inviteCode}`);
  });

  it("rejects too long room title", async () => {
    const prisma = createPrismaMock();
    const service = new RoomsService(prisma as unknown as PrismaService);

    await expect(
      service.createRoom(baseUser, {
        ...createRoomInput,
        title: "а".repeat(81)
      })
    ).rejects.toMatchObject({
      status: HttpStatus.BAD_REQUEST,
      response: {
        error: {
          code: "ROOM_INVALID_INPUT",
          message: "Название слишком длинное"
        }
      }
    });

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects unsupported room currency", async () => {
    const prisma = createPrismaMock();
    const service = new RoomsService(prisma as unknown as PrismaService);

    await expect(
      service.createRoom(baseUser, {
        ...createRoomInput,
        currency: "GBP"
      })
    ).rejects.toMatchObject({
      status: HttpStatus.BAD_REQUEST,
      response: {
        error: {
          code: "ROOM_INVALID_INPUT",
          message: "Выберите рубли, доллары или евро"
        }
      }
    });

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects too large rebuy amount", async () => {
    const prisma = createPrismaMock();
    const service = new RoomsService(prisma as unknown as PrismaService);

    await expect(
      service.createRoom(baseUser, {
        ...createRoomInput,
        rebuyAmountMinor: "1000000001"
      })
    ).rejects.toMatchObject({
      status: HttpStatus.BAD_REQUEST,
      response: {
        error: {
          code: "ROOM_INVALID_INPUT",
          message: "Сумма ребая слишком большая"
        }
      }
    });

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects too large starting stack", async () => {
    const prisma = createPrismaMock();
    const service = new RoomsService(prisma as unknown as PrismaService);

    await expect(
      service.createRoom(baseUser, {
        ...createRoomInput,
        startingStack: 1_000_001
      })
    ).rejects.toMatchObject({
      status: HttpStatus.BAD_REQUEST,
      response: {
        error: {
          code: "ROOM_INVALID_INPUT",
          message: "Стартовый стек слишком большой"
        }
      }
    });

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("returns existing membership on duplicate join", async () => {
    const prisma = createPrismaMock();
    const room = createRoomRecord();
    const membership = createRoomPlayerRecord();

    prisma.room.findUnique.mockResolvedValue(room);
    prisma.roomPlayer.findUnique.mockResolvedValue(membership);

    const service = new RoomsService(prisma as unknown as PrismaService);

    const result = await service.joinRoom(baseUser, {
      inviteCode: room.inviteCode
    });

    expect(result).toEqual({
      roomId: room.id,
      status: room.status,
      playerId: membership.id
    });
    expect(prisma.roomPlayer.create).not.toHaveBeenCalled();
  });

  it("returns room details with active player count and current membership metadata", async () => {
    const prisma = createPrismaMock();
    const membership = createRoomPlayerRecord({
      id: "player-9",
      role: RoomPlayerRole.OWNER,
      status: RoomPlayerStatus.ACTIVE
    });
    const room = createRoomRecord({
      status: RoomStatus.RUNNING,
      startedAt: new Date("2026-05-11T13:00:00.000Z"),
      players: [
        createRoomPlayerRecord({
          id: "player-9",
          role: RoomPlayerRole.OWNER,
          status: RoomPlayerStatus.ACTIVE
        }),
        createRoomPlayerRecord({
          id: "player-2",
          userId: "user-2",
          displayName: "Илья",
          status: RoomPlayerStatus.ACTIVE
        }),
        createRoomPlayerRecord({
          id: "player-3",
          userId: "user-3",
          displayName: "Никита",
          status: RoomPlayerStatus.REMOVED,
          removedAt: new Date("2026-05-11T13:10:00.000Z")
        })
      ]
    });

    prisma.roomPlayer.findUnique.mockResolvedValue(membership);
    prisma.room.findUnique.mockResolvedValue(room);
    prisma.rebuyEvent.findMany.mockResolvedValue([
      createRebuyRecord({
        id: "rebuy-1",
        roomPlayerId: "player-9",
        amountMinor: 100000n
      }),
      createRebuyRecord({
        id: "rebuy-2",
        roomPlayerId: "player-2",
        amountMinor: 200000n
      })
    ]);

    const service = new RoomsService(prisma as unknown as PrismaService);

    const result = await service.getRoom(baseUser, room.id);

    expect(result.room.playersCount).toBe(2);
    expect(result.room.totalPotMinor).toBe("300000");
    expect(result.room.myBuyinsMinor).toBe("100000");
    expect(result.room.myRole).toBe(RoomPlayerRole.OWNER);
    expect(result.room.myPlayerId).toBe("player-9");
    expect(result.room.myPlayerStatus).toBe(RoomPlayerStatus.ACTIVE);
    expect(result.players).toHaveLength(3);
    expect(result.players[0]).toMatchObject({
      id: "player-9",
      rebuyCount: 1,
      totalBuyinMinor: "100000"
    });
    expect(result.players[2]).toMatchObject({
      id: "player-3",
      status: RoomPlayerStatus.REMOVED
    });
    expect(result.settlement).toBeNull();
  });

  it("returns latest settlement snapshot for a closed room", async () => {
    const prisma = createPrismaMock();
    const membership = createRoomPlayerRecord({
      id: "player-1",
      role: RoomPlayerRole.OWNER,
      status: RoomPlayerStatus.ACTIVE,
      finalAmountMinor: 350000n,
      netResultMinor: 150000n
    });
    const room = createRoomRecord({
      status: RoomStatus.CLOSED,
      closedAt: new Date("2026-05-11T16:00:00.000Z"),
      players: [
        createRoomPlayerRecord({
          id: "player-1",
          role: RoomPlayerRole.OWNER,
          status: RoomPlayerStatus.ACTIVE,
          finalAmountMinor: 350000n,
          netResultMinor: 150000n
        }),
        createRoomPlayerRecord({
          id: "player-2",
          userId: "user-2",
          displayName: "Илья",
          status: RoomPlayerStatus.ACTIVE,
          finalAmountMinor: 50000n,
          netResultMinor: -150000n
        }),
        createRoomPlayerRecord({
          id: "player-3",
          userId: "user-3",
          displayName: "Саша",
          status: RoomPlayerStatus.REMOVED,
          removedAt: new Date("2026-05-11T14:00:00.000Z"),
          finalAmountMinor: null,
          netResultMinor: null
        })
      ].map((player) => ({
        ...player,
        user: createUserRecord({
          id: player.userId,
          firstName: player.displayName,
          username: null
        })
      }))
    });

    prisma.roomPlayer.findUnique.mockResolvedValue(membership);
    prisma.room.findUnique.mockResolvedValue(room);
    prisma.rebuyEvent.findMany.mockResolvedValue([
      createRebuyRecord({
        id: "rebuy-1",
        roomPlayerId: "player-1",
        amountMinor: 200000n
      }),
      createRebuyRecord({
        id: "rebuy-2",
        roomPlayerId: "player-2",
        amountMinor: 200000n
      })
    ]);
    prisma.settlement.findFirst.mockResolvedValue({
      id: "settlement-2",
      roomId: room.id,
      status: SettlementStatus.CLOSED,
      totalBuyinsMinor: 400000n,
      totalFinalAmountMinor: 400000n,
      differenceMinor: 0n,
      calculatedAt: new Date("2026-05-11T15:45:00.000Z"),
      transfers: [
        {
          fromRoomPlayerId: "player-2",
          toRoomPlayerId: "player-1",
          amountMinor: 150000n,
          fromPlayer: {
            ...room.players[1],
            user: createUserRecord({
              id: "user-2",
              firstName: "Илья",
              username: null
            })
          },
          toPlayer: {
            ...room.players[0],
            user: createUserRecord({
              id: baseUser.id,
              firstName: "Денис",
              username: null
            })
          }
        }
      ]
    });

    const service = new RoomsService(prisma as unknown as PrismaService);

    const result = await service.getRoom(baseUser, room.id);

    expect(prisma.settlement.findFirst).toHaveBeenCalledWith({
      where: {
        roomId: room.id
      },
      include: {
        transfers: {
          include: {
            fromPlayer: {
              include: {
                user: true
              }
            },
            toPlayer: {
              include: {
                user: true
              }
            }
          }
        }
      },
      orderBy: {
        calculatedAt: "desc"
      }
    });
    expect(result.settlement).toEqual({
      id: "settlement-2",
      status: SettlementStatus.CLOSED,
      totalBuyinsMinor: "400000",
      totalFinalAmountMinor: "400000",
      differenceMinor: "0",
      calculatedAt: "2026-05-11T15:45:00.000Z",
      players: [
        {
          roomPlayerId: "player-1",
          displayName: "Денис",
          totalBuyinMinor: "200000",
          finalAmountMinor: "350000",
          netResultMinor: "150000"
        },
        {
          roomPlayerId: "player-2",
          displayName: "Илья",
          totalBuyinMinor: "200000",
          finalAmountMinor: "50000",
          netResultMinor: "-150000"
        }
      ],
      transfers: [
        {
          fromRoomPlayerId: "player-2",
          fromName: "Илья",
          toRoomPlayerId: "player-1",
          toName: "Денис",
          amountMinor: "150000"
        }
      ]
    });
  });

  it("returns null settlement for a closed room without saved snapshot", async () => {
    const prisma = createPrismaMock();
    const membership = createRoomPlayerRecord({
      id: "player-1",
      status: RoomPlayerStatus.ACTIVE
    });
    const room = createRoomRecord({
      status: RoomStatus.CLOSED,
      closedAt: new Date("2026-05-11T16:00:00.000Z"),
      players: [
        {
          ...createRoomPlayerRecord({
            id: "player-1",
            finalAmountMinor: 100000n,
            netResultMinor: 0n
          }),
          user: createUserRecord()
        }
      ]
    });

    prisma.roomPlayer.findUnique.mockResolvedValue(membership);
    prisma.room.findUnique.mockResolvedValue(room);
    prisma.settlement.findFirst.mockResolvedValue(null);

    const service = new RoomsService(prisma as unknown as PrismaService);

    const result = await service.getRoom(baseUser, room.id);

    expect(result.settlement).toBeNull();
  });

  it("blocks removed members from reading room details", async () => {
    const prisma = createPrismaMock();

    prisma.roomPlayer.findUnique.mockResolvedValue(
      createRoomPlayerRecord({
        status: RoomPlayerStatus.REMOVED
      })
    );

    const service = new RoomsService(prisma as unknown as PrismaService);

    await expect(service.getRoom(baseUser, "room-1")).rejects.toMatchObject({
      status: HttpStatus.FORBIDDEN,
      response: {
        error: {
          code: "ROOM_ACCESS_DENIED"
        }
      }
    });
    expect(prisma.room.findUnique).not.toHaveBeenCalled();
  });

  it("rejects join for closed room", async () => {
    const prisma = createPrismaMock();

    prisma.room.findUnique.mockResolvedValue(
      createRoomRecord({
        status: RoomStatus.CLOSED
      })
    );

    const service = new RoomsService(prisma as unknown as PrismaService);

    await expect(
      service.joinRoom(baseUser, {
        inviteCode: "invite-1"
      })
    ).rejects.toMatchObject({
      status: HttpStatus.CONFLICT,
      response: {
        error: {
          code: "ROOM_CLOSED_JOIN_BLOCKED"
        }
      }
    });
  });

  it("forbids start for regular player", async () => {
    const prisma = createPrismaMock();

    prisma.roomPlayer.findUnique.mockResolvedValue(
      createRoomPlayerRecord({
        role: RoomPlayerRole.PLAYER
      })
    );

    const service = new RoomsService(prisma as unknown as PrismaService);

    await expect(service.startRoom(baseUser, "room-1")).rejects.toMatchObject({
      status: HttpStatus.FORBIDDEN,
      response: {
        error: {
          code: "ROOM_START_FORBIDDEN"
        }
      }
    });
  });

  it("requires at least two active players to start", async () => {
    const prisma = createPrismaMock();

    prisma.roomPlayer.findUnique.mockResolvedValue(
      createRoomPlayerRecord({
        role: RoomPlayerRole.OWNER
      })
    );
    prisma.room.findUnique.mockResolvedValue(
      createRoomRecord({
        players: [createRoomPlayerRecord({ role: RoomPlayerRole.OWNER })]
      })
    );

    const service = new RoomsService(prisma as unknown as PrismaService);

    await expect(service.startRoom(baseUser, "room-1")).rejects.toMatchObject({
      status: HttpStatus.CONFLICT,
      response: {
        error: {
          code: "ROOM_START_REQUIRES_PLAYERS"
        }
      }
    });
  });

  it("starts a waiting room when owner has enough players", async () => {
    const prisma = createPrismaMock();
    const room = createRoomRecord({
      players: [
        createRoomPlayerRecord({ id: "player-1", role: RoomPlayerRole.OWNER }),
        createRoomPlayerRecord({ id: "player-2", userId: "user-2" })
      ]
    });

    prisma.roomPlayer.findUnique.mockResolvedValue(
      createRoomPlayerRecord({
        role: RoomPlayerRole.OWNER
      })
    );
    prisma.room.findUnique.mockResolvedValue(room);
    prisma.room.update.mockImplementation(
      ({
        data
      }: RoomUpdateArgs) => Promise.resolve({
        ...room,
        status: data.status ?? room.status,
        startedAt: data.startedAt ?? room.startedAt,
        closedAt: data.closedAt ?? room.closedAt
      })
    );

    const service = new RoomsService(prisma as unknown as PrismaService);

    const result = await service.startRoom(baseUser, room.id);

    const updateArgs = prisma.room.update.mock.calls[0]?.[0];

    expect(updateArgs).toBeDefined();
    expect(updateArgs?.where.id).toBe(room.id);
    expect(updateArgs?.data.status).toBe(RoomStatus.RUNNING);
    expect(updateArgs?.data.startedAt).toBeInstanceOf(Date);
    expect(result.status).toBe(RoomStatus.RUNNING);
    expect(result.startedAt).toMatch(/T/);
  });

  it("does not let a regular player add self rebuy when admin should do it", async () => {
    const prisma = createPrismaMock();
    const membership = createRoomPlayerRecord({
      id: "player-1",
      role: RoomPlayerRole.PLAYER,
      status: RoomPlayerStatus.ACTIVE
    });

    prisma.$transaction.mockImplementation(async (callback: (transaction: MockPrisma) => Promise<unknown>) =>
      callback(prisma)
    );
    prisma.roomPlayer.findUnique
      .mockResolvedValueOnce(membership)
      .mockResolvedValueOnce(
        createRoomPlayerRecord({
          id: "player-1",
          status: RoomPlayerStatus.ACTIVE
        })
      );
    prisma.room.findUnique.mockResolvedValue(
      createRoomRecord({
        status: RoomStatus.RUNNING,
        rebuyPermission: "ADMIN_ONLY"
      })
    );

    const service = new RoomsService(prisma as unknown as PrismaService);

    await expect(
      service.createRebuy(baseUser, "room-1", {
        roomPlayerId: "player-1",
        idempotencyKey: "rebuy-admin-only"
      })
    ).rejects.toMatchObject({
      status: HttpStatus.FORBIDDEN,
      response: {
        error: {
          code: "REBUY_FORBIDDEN"
        }
      }
    });
    expect(prisma.idempotencyKey.create).not.toHaveBeenCalled();
    expect(prisma.rebuyEvent.create).not.toHaveBeenCalled();
  });

  it("rejects rebuy creation when the room is not running", async () => {
    const prisma = createPrismaMock();

    prisma.$transaction.mockImplementation(async (callback: (transaction: MockPrisma) => Promise<unknown>) =>
      callback(prisma)
    );
    prisma.roomPlayer.findUnique.mockResolvedValue(createRoomPlayerRecord());
    prisma.room.findUnique.mockResolvedValue(
      createRoomRecord({
        status: RoomStatus.WAITING
      })
    );

    const service = new RoomsService(prisma as unknown as PrismaService);

    await expect(
      service.createRebuy(baseUser, "room-1", {
        roomPlayerId: "player-1",
        idempotencyKey: "rebuy-waiting-room"
      })
    ).rejects.toMatchObject({
      status: HttpStatus.CONFLICT,
      response: {
        error: {
          code: "REBUY_INVALID_STATUS"
        }
      }
    });
  });

  it("excludes cancelled rebuy events from room totals", async () => {
    const prisma = createPrismaMock();

    prisma.roomPlayer.findUnique.mockResolvedValue(
      createRoomPlayerRecord({
        id: "player-1",
        role: RoomPlayerRole.OWNER
      })
    );
    prisma.room.findUnique.mockResolvedValue(
      createRoomRecord({
        status: RoomStatus.RUNNING,
        startedAt: new Date("2026-05-11T13:00:00.000Z"),
        players: [
          createRoomPlayerRecord({
            id: "player-1",
            role: RoomPlayerRole.OWNER
          }),
          createRoomPlayerRecord({
            id: "player-2",
            userId: "user-2",
            displayName: "Илья"
          })
        ]
      })
    );
    prisma.rebuyEvent.findMany.mockImplementation(({ where }: { where?: { status?: RebuyEventStatus } }) =>
      Promise.resolve(
        where?.status === RebuyEventStatus.ACTIVE
          ? [
              createRebuyRecord({
                id: "rebuy-active",
                roomPlayerId: "player-1",
                amountMinor: 100000n,
                status: RebuyEventStatus.ACTIVE
              })
            ]
          : [
              createRebuyRecord({
                id: "rebuy-active",
                roomPlayerId: "player-1",
                amountMinor: 100000n,
                status: RebuyEventStatus.ACTIVE
              }),
              createRebuyRecord({
                id: "rebuy-cancelled",
                roomPlayerId: "player-2",
                amountMinor: 100000n,
                status: RebuyEventStatus.CANCELLED,
                cancelledAt: new Date("2026-05-11T13:05:00.000Z"),
                cancelledByUserId: baseUser.id
              })
            ]
      )
    );

    const service = new RoomsService(prisma as unknown as PrismaService);
    const result = await service.getRoom(baseUser, "room-1");

    expect(result.room.totalPotMinor).toBe("100000");
    expect(result.players[0]).toMatchObject({
      id: "player-1",
      rebuyCount: 1,
      totalBuyinMinor: "100000"
    });
    expect(result.players[1]).toMatchObject({
      id: "player-2",
      rebuyCount: 0,
      totalBuyinMinor: "0"
    });
  });

  it("returns the stored result for a duplicate rebuy idempotency key", async () => {
    const prisma = createPrismaMock();
    const membership = createRoomPlayerRecord({
      id: "player-1",
      role: RoomPlayerRole.PLAYER
    });
    const room = createRoomRecord({
      status: RoomStatus.RUNNING
    });
    const requestHash = JSON.stringify({
      roomId: "room-1",
      roomPlayerId: "player-1"
    });
    const storedRecords: Array<Record<string, unknown>> = [];

    prisma.$transaction.mockImplementation(async (callback: (transaction: MockPrisma) => Promise<unknown>) =>
      callback(prisma)
    );
    prisma.roomPlayer.findUnique
      .mockResolvedValueOnce(membership)
      .mockResolvedValueOnce(
        createRoomPlayerRecord({
          id: "player-1",
          status: RoomPlayerStatus.ACTIVE
        })
      );
    prisma.room.findUnique.mockResolvedValue(room);
    prisma.idempotencyKey.findUnique.mockImplementation(() => storedRecords[0] ?? null);
    prisma.idempotencyKey.create.mockImplementation(({ data }: { data: Record<string, unknown> }) => {
      const record = {
        id: "idem-rebuy-1",
        userId: data.userId as string,
        roomId: data.roomId as string,
        action: data.action as IdempotencyAction,
        idempotencyKey: data.idempotencyKey as string,
        requestHash: data.requestHash as string,
        responseJson: null,
        rebuyEventId: null,
        createdAt: new Date("2026-05-11T12:40:00.000Z"),
        updatedAt: new Date("2026-05-11T12:40:00.000Z")
      };

      storedRecords[0] = record;
      return Promise.resolve(record);
    });
    prisma.rebuyEvent.findMany.mockResolvedValue([
      createRebuyRecord({
        id: "rebuy-1",
        roomPlayerId: "player-1",
        amountMinor: 100000n
      })
    ]);
    prisma.idempotencyKey.update.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) => {
        storedRecords[0] = {
          ...(storedRecords[0] ?? {}),
          requestHash,
          responseJson: data.responseJson ?? null,
          rebuyEventId: data.rebuyEventId ?? null
        };

        return Promise.resolve(storedRecords[0]);
      }
    );

    const service = new RoomsService(prisma as unknown as PrismaService);
    const first = await service.createRebuy(baseUser, "room-1", {
      roomPlayerId: "player-1",
      idempotencyKey: "rebuy-same-key"
    });
    const second = await service.createRebuy(baseUser, "room-1", {
      roomPlayerId: "player-1",
      idempotencyKey: "rebuy-same-key"
    });

    expect(first).toEqual(second);
    expect(prisma.rebuyEvent.create).toHaveBeenCalledTimes(1);
    expect(storedRecords[0]?.requestHash).toBe(requestHash);
  });

  it("includes cancelled rebuy records in history", async () => {
    const prisma = createPrismaMock();

    prisma.roomPlayer.findUnique.mockResolvedValue(
      createRoomPlayerRecord({
        role: RoomPlayerRole.PLAYER
      })
    );
    prisma.rebuyEvent.findMany.mockResolvedValue([
      {
        ...createRebuyRecord({
          id: "rebuy-cancelled",
          roomPlayerId: "player-2",
          status: RebuyEventStatus.CANCELLED,
          cancelledAt: new Date("2026-05-11T13:05:00.000Z"),
          cancelledByUserId: "user-9",
          cancellationReason: "Нажали не на того игрока"
        }),
        roomPlayer: {
          ...createRoomPlayerRecord({
            id: "player-2",
            userId: "user-2",
            displayName: "Илья"
          }),
          user: createUserRecord({
            id: "user-2",
            firstName: "Илья",
            username: "ilya"
          })
        },
        createdByUser: createUserRecord(),
        cancelledByUser: createUserRecord({
          id: "user-9",
          firstName: "Анна",
          username: "anna"
        })
      }
    ]);

    const service = new RoomsService(prisma as unknown as PrismaService);
    const result = await service.getRebuyHistory(baseUser, "room-1");

    expect(result.rebuys).toEqual([
      expect.objectContaining({
        id: "rebuy-cancelled",
        status: "CANCELLED",
        playerName: "Илья",
        createdByName: "Денис",
        cancelledByName: "Анна",
        cancellationReason: "Нажали не на того игрока"
      })
    ]);
  });

  it("builds settlement preview from active players and excludes cancelled rebuys", async () => {
    const prisma = createPrismaMock();

    prisma.roomPlayer.findUnique.mockResolvedValue(
      createRoomPlayerRecord({
        id: "player-1",
        role: RoomPlayerRole.OWNER
      })
    );
    prisma.room.findUnique.mockResolvedValue(
      createRoomRecord({
        status: RoomStatus.RUNNING
      })
    );
    prisma.roomPlayer.findMany.mockResolvedValue([
      createRoomPlayerRecord({
        id: "player-1",
        role: RoomPlayerRole.OWNER
      }),
      createRoomPlayerRecord({
        id: "player-2",
        userId: "user-2",
        displayName: "Илья"
      })
    ]);
    prisma.rebuyEvent.findMany.mockImplementation(({ where }: { where?: { status?: RebuyEventStatus } }) =>
      Promise.resolve(
        where?.status === RebuyEventStatus.ACTIVE
          ? [
              createRebuyRecord({
                id: "rebuy-active-1",
                roomPlayerId: "player-1",
                amountMinor: 100000n,
                status: RebuyEventStatus.ACTIVE
              }),
              createRebuyRecord({
                id: "rebuy-active-2",
                roomPlayerId: "player-2",
                amountMinor: 200000n,
                status: RebuyEventStatus.ACTIVE
              })
            ]
          : []
      )
    );

    const service = new RoomsService(prisma as unknown as PrismaService);
    const result = await service.previewSettlement(baseUser, "room-1", {
      finalAmounts: [
        {
          roomPlayerId: "player-1",
          finalAmountMinor: "150000"
        },
        {
          roomPlayerId: "player-2",
          finalAmountMinor: "150000"
        }
      ]
    });

    expect(result).toEqual({
      totalBuyinsMinor: "300000",
      totalFinalAmountMinor: "300000",
      differenceMinor: "0",
      players: [
        {
          roomPlayerId: "player-1",
          displayName: "Денис",
          totalBuyinMinor: "100000",
          finalAmountMinor: "150000",
          netResultMinor: "50000"
        },
        {
          roomPlayerId: "player-2",
          displayName: "Илья",
          totalBuyinMinor: "200000",
          finalAmountMinor: "150000",
          netResultMinor: "-50000"
        }
      ],
      transfers: [
        {
          fromRoomPlayerId: "player-2",
          fromName: "Илья",
          toRoomPlayerId: "player-1",
          toName: "Денис",
          amountMinor: "50000"
        }
      ]
    });
  });

  it("closes settlement, saves player results, transfers, and room status", async () => {
    const prisma = createPrismaMock();

    prisma.$transaction.mockImplementation(async (callback: (transaction: MockPrisma) => Promise<unknown>) =>
      callback(prisma)
    );
    prisma.roomPlayer.findUnique.mockResolvedValue(
      createRoomPlayerRecord({
        id: "player-1",
        role: RoomPlayerRole.OWNER
      })
    );
    prisma.room.findUnique.mockResolvedValue(
      createRoomRecord({
        status: RoomStatus.RUNNING
      })
    );
    prisma.roomPlayer.findMany.mockResolvedValue([
      createRoomPlayerRecord({
        id: "player-1",
        role: RoomPlayerRole.OWNER
      }),
      createRoomPlayerRecord({
        id: "player-2",
        userId: "user-2",
        displayName: "Илья"
      })
    ]);
    prisma.rebuyEvent.findMany.mockResolvedValue([
      createRebuyRecord({
        id: "rebuy-active-1",
        roomPlayerId: "player-1",
        amountMinor: 100000n
      }),
      createRebuyRecord({
        id: "rebuy-active-2",
        roomPlayerId: "player-2",
        amountMinor: 200000n
      })
    ]);
    prisma.settlement.create.mockResolvedValue({
      id: "settlement-1"
    });
    prisma.settlementTransfer.createMany.mockResolvedValue({
      count: 1
    });
    prisma.room.update.mockImplementation(({ data }: RoomUpdateArgs) =>
      Promise.resolve(
        createRoomRecord({
          status: data.status ?? RoomStatus.CLOSED,
          closedAt: data.closedAt ?? new Date("2026-05-11T14:00:00.000Z")
        })
      )
    );

    const service = new RoomsService(prisma as unknown as PrismaService);
    const result = await service.closeSettlement(baseUser, "room-1", {
      finalAmounts: [
        {
          roomPlayerId: "player-1",
          finalAmountMinor: "150000"
        },
        {
          roomPlayerId: "player-2",
          finalAmountMinor: "150000"
        }
      ]
    });

    expect(prisma.roomPlayer.update).toHaveBeenCalledTimes(2);
    expect(prisma.roomPlayer.update).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: {
          id: "player-1"
        },
        data: {
          finalAmountMinor: 150000n,
          netResultMinor: 50000n
        }
      })
    );
    expect(prisma.roomPlayer.update).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: {
          id: "player-2"
        },
        data: {
          finalAmountMinor: 150000n,
          netResultMinor: -50000n
        }
      })
    );
    const settlementCreateArgs = prisma.settlement.create.mock.calls[0]?.[0];

    expect(settlementCreateArgs).toBeDefined();
    expect(settlementCreateArgs?.data).toEqual({
      roomId: "room-1",
      status: "CLOSED",
      totalBuyinsMinor: 300000n,
      totalFinalAmountMinor: 300000n,
      differenceMinor: 0n,
      closedByUserId: baseUser.id
    });
    expect(prisma.settlementTransfer.createMany).toHaveBeenCalledWith({
      data: [
        {
          settlementId: "settlement-1",
          fromRoomPlayerId: "player-2",
          toRoomPlayerId: "player-1",
          amountMinor: 50000n
        }
      ]
    });
    const roomUpdateArgs = prisma.room.update.mock.calls[0]?.[0];

    expect(roomUpdateArgs).toBeDefined();
    expect(roomUpdateArgs?.where.id).toBe("room-1");
    expect(roomUpdateArgs?.data.status).toBe(RoomStatus.CLOSED);
    expect(roomUpdateArgs?.data.closedAt).toBeInstanceOf(Date);
    expect(result).toEqual({
      roomId: "room-1",
      status: RoomStatus.CLOSED,
      settlementId: "settlement-1"
    });
  });

  it("recalculates player stats for active players after settlement close", async () => {
    const prisma = createPrismaMock();
    const playerStatsService = {
      recalculateAndUpsertPlayerStats: jest.fn().mockResolvedValue(undefined)
    };

    prisma.$transaction.mockImplementation(async (callback: (transaction: MockPrisma) => Promise<unknown>) =>
      callback(prisma)
    );
    prisma.roomPlayer.findUnique.mockResolvedValue(
      createRoomPlayerRecord({
        id: "player-1",
        role: RoomPlayerRole.OWNER
      })
    );
    prisma.room.findUnique.mockResolvedValue(
      createRoomRecord({
        status: RoomStatus.RUNNING
      })
    );
    prisma.roomPlayer.findMany.mockResolvedValue([
      createRoomPlayerRecord({
        id: "player-1",
        role: RoomPlayerRole.OWNER
      }),
      createRoomPlayerRecord({
        id: "player-2",
        userId: "user-2",
        displayName: "Илья"
      })
    ]);
    prisma.rebuyEvent.findMany.mockResolvedValue([
      createRebuyRecord({
        roomPlayerId: "player-1",
        amountMinor: 100000n
      }),
      createRebuyRecord({
        roomPlayerId: "player-2",
        amountMinor: 200000n
      })
    ]);
    prisma.settlement.create.mockResolvedValue({
      id: "settlement-1"
    });
    prisma.room.update.mockImplementation(({ data }: RoomUpdateArgs) =>
      Promise.resolve(
        createRoomRecord({
          status: data.status ?? RoomStatus.CLOSED,
          closedAt: data.closedAt ?? new Date("2026-05-11T14:00:00.000Z")
        })
      )
    );

    const service = new RoomsService(
      prisma as unknown as PrismaService,
      playerStatsService as unknown as PlayerStatsService
    );

    await service.closeSettlement(baseUser, "room-1", {
      finalAmounts: [
        {
          roomPlayerId: "player-1",
          finalAmountMinor: "150000"
        },
        {
          roomPlayerId: "player-2",
          finalAmountMinor: "150000"
        }
      ]
    });

    expect(playerStatsService.recalculateAndUpsertPlayerStats).toHaveBeenCalledWith(
      ["user-1", "user-2"],
      prisma
    );
  });

  it("forbids settlement close for regular player", async () => {
    const prisma = createPrismaMock();

    prisma.$transaction.mockImplementation(async (callback: (transaction: MockPrisma) => Promise<unknown>) =>
      callback(prisma)
    );
    prisma.roomPlayer.findUnique.mockResolvedValue(
      createRoomPlayerRecord({
        role: RoomPlayerRole.PLAYER
      })
    );

    const service = new RoomsService(prisma as unknown as PrismaService);

    await expect(
      service.closeSettlement(baseUser, "room-1", {
        finalAmounts: [
          {
            roomPlayerId: "player-1",
            finalAmountMinor: "100000"
          }
        ]
      })
    ).rejects.toMatchObject({
      status: HttpStatus.FORBIDDEN,
      response: {
        error: {
          code: "SETTLEMENT_FORBIDDEN"
        }
      }
    });
    expect(prisma.room.findUnique).not.toHaveBeenCalled();
  });

  it("rejects unbalanced settlement close", async () => {
    const prisma = createPrismaMock();

    prisma.$transaction.mockImplementation(async (callback: (transaction: MockPrisma) => Promise<unknown>) =>
      callback(prisma)
    );
    prisma.roomPlayer.findUnique.mockResolvedValue(
      createRoomPlayerRecord({
        id: "player-1",
        role: RoomPlayerRole.OWNER
      })
    );
    prisma.room.findUnique.mockResolvedValue(
      createRoomRecord({
        status: RoomStatus.RUNNING
      })
    );
    prisma.roomPlayer.findMany.mockResolvedValue([
      createRoomPlayerRecord({
        id: "player-1",
        role: RoomPlayerRole.OWNER
      }),
      createRoomPlayerRecord({
        id: "player-2",
        userId: "user-2",
        displayName: "Илья"
      })
    ]);
    prisma.rebuyEvent.findMany.mockResolvedValue([
      createRebuyRecord({
        roomPlayerId: "player-1",
        amountMinor: 100000n
      }),
      createRebuyRecord({
        roomPlayerId: "player-2",
        amountMinor: 200000n
      })
    ]);

    const service = new RoomsService(prisma as unknown as PrismaService);

    await expect(
      service.closeSettlement(baseUser, "room-1", {
        finalAmounts: [
          {
            roomPlayerId: "player-1",
            finalAmountMinor: "100000"
          },
          {
            roomPlayerId: "player-2",
            finalAmountMinor: "150000"
          }
        ]
      })
    ).rejects.toMatchObject({
      status: HttpStatus.CONFLICT,
      response: {
        error: {
          code: "SETTLEMENT_NOT_BALANCED"
        }
      }
    });
    expect(prisma.settlement.create).not.toHaveBeenCalled();
    expect(prisma.room.update).not.toHaveBeenCalled();
  });

  it("rejects settlement preview when a final amount is missing", async () => {
    const prisma = createPrismaMock();

    prisma.roomPlayer.findUnique.mockResolvedValue(
      createRoomPlayerRecord({
        id: "player-1",
        role: RoomPlayerRole.OWNER
      })
    );
    prisma.room.findUnique.mockResolvedValue(
      createRoomRecord({
        status: RoomStatus.RUNNING
      })
    );
    prisma.roomPlayer.findMany.mockResolvedValue([
      createRoomPlayerRecord({
        id: "player-1",
        role: RoomPlayerRole.OWNER
      }),
      createRoomPlayerRecord({
        id: "player-2",
        userId: "user-2",
        displayName: "Илья"
      })
    ]);
    prisma.rebuyEvent.findMany.mockResolvedValue([]);

    const service = new RoomsService(prisma as unknown as PrismaService);

    await expect(
      service.previewSettlement(baseUser, "room-1", {
        finalAmounts: [
          {
            roomPlayerId: "player-1",
            finalAmountMinor: "100000"
          }
        ]
      })
    ).rejects.toMatchObject({
      status: HttpStatus.BAD_REQUEST,
      response: {
        error: {
          code: "ROOM_INVALID_INPUT"
        }
      }
    });
  });

  it("rejects settlement preview with duplicate final amounts", async () => {
    const prisma = createPrismaMock();

    prisma.roomPlayer.findUnique.mockResolvedValue(
      createRoomPlayerRecord({
        id: "player-1",
        role: RoomPlayerRole.OWNER
      })
    );
    prisma.room.findUnique.mockResolvedValue(
      createRoomRecord({
        status: RoomStatus.RUNNING
      })
    );
    prisma.roomPlayer.findMany.mockResolvedValue([
      createRoomPlayerRecord({
        id: "player-1",
        role: RoomPlayerRole.OWNER
      })
    ]);
    prisma.rebuyEvent.findMany.mockResolvedValue([]);

    const service = new RoomsService(prisma as unknown as PrismaService);

    await expect(
      service.previewSettlement(baseUser, "room-1", {
        finalAmounts: [
          {
            roomPlayerId: "player-1",
            finalAmountMinor: "100000"
          },
          {
            roomPlayerId: "player-1",
            finalAmountMinor: "100000"
          }
        ]
      })
    ).rejects.toMatchObject({
      status: HttpStatus.BAD_REQUEST,
      response: {
        error: {
          code: "ROOM_INVALID_INPUT"
        }
      }
    });
  });

  it("rejects settlement preview with unknown player id", async () => {
    const prisma = createPrismaMock();

    prisma.roomPlayer.findUnique.mockResolvedValue(
      createRoomPlayerRecord({
        id: "player-1",
        role: RoomPlayerRole.OWNER
      })
    );
    prisma.room.findUnique.mockResolvedValue(
      createRoomRecord({
        status: RoomStatus.RUNNING
      })
    );
    prisma.roomPlayer.findMany.mockResolvedValue([
      createRoomPlayerRecord({
        id: "player-1",
        role: RoomPlayerRole.OWNER
      })
    ]);
    prisma.rebuyEvent.findMany.mockResolvedValue([]);

    const service = new RoomsService(prisma as unknown as PrismaService);

    await expect(
      service.previewSettlement(baseUser, "room-1", {
        finalAmounts: [
          {
            roomPlayerId: "player-999",
            finalAmountMinor: "100000"
          }
        ]
      })
    ).rejects.toMatchObject({
      status: HttpStatus.BAD_REQUEST,
      response: {
        error: {
          code: "ROOM_INVALID_INPUT"
        }
      }
    });
  });

  it("does not allow closing an already closed room", async () => {
    const prisma = createPrismaMock();

    prisma.$transaction.mockImplementation(async (callback: (transaction: MockPrisma) => Promise<unknown>) =>
      callback(prisma)
    );
    prisma.roomPlayer.findUnique.mockResolvedValue(
      createRoomPlayerRecord({
        id: "player-1",
        role: RoomPlayerRole.OWNER
      })
    );
    prisma.room.findUnique.mockResolvedValue(
      createRoomRecord({
        status: RoomStatus.CLOSED,
        closedAt: new Date("2026-05-11T14:00:00.000Z")
      })
    );

    const service = new RoomsService(prisma as unknown as PrismaService);

    await expect(
      service.closeSettlement(baseUser, "room-1", {
        finalAmounts: [
          {
            roomPlayerId: "player-1",
            finalAmountMinor: "100000"
          }
        ]
      })
    ).rejects.toMatchObject({
      status: HttpStatus.CONFLICT,
      response: {
        error: {
          code: "SETTLEMENT_INVALID_STATUS"
        }
      }
    });
    expect(prisma.roomPlayer.findMany).not.toHaveBeenCalled();
  });

  it("returns ApiError for inaccessible room before reserving create rebuy idempotency", async () => {
    const prisma = createPrismaMock();

    prisma.$transaction.mockImplementation(async (callback: (transaction: MockPrisma) => Promise<unknown>) =>
      callback(prisma)
    );
    prisma.roomPlayer.findUnique.mockResolvedValue(null);

    const service = new RoomsService(prisma as unknown as PrismaService);

    await expect(
      service.createRebuy(baseUser, "room-missing-membership", {
        roomPlayerId: "player-1",
        idempotencyKey: "rebuy-no-membership"
      })
    ).rejects.toMatchObject({
      status: HttpStatus.FORBIDDEN,
      response: {
        error: {
          code: "ROOM_ACCESS_DENIED"
        }
      }
    });
    expect(prisma.idempotencyKey.create).not.toHaveBeenCalled();
  });

  it("returns ApiError for missing room before reserving cancel rebuy idempotency", async () => {
    const prisma = createPrismaMock();

    prisma.$transaction.mockImplementation(async (callback: (transaction: MockPrisma) => Promise<unknown>) =>
      callback(prisma)
    );
    prisma.roomPlayer.findUnique.mockResolvedValue(
      createRoomPlayerRecord({
        id: "player-1",
        role: RoomPlayerRole.OWNER
      })
    );
    prisma.room.findUnique.mockResolvedValue(null);

    const service = new RoomsService(prisma as unknown as PrismaService);

    await expect(
      service.cancelRebuy(baseUser, "room-404", "rebuy-1", {
        idempotencyKey: "cancel-missing-room",
        reason: null
      })
    ).rejects.toMatchObject({
      status: HttpStatus.NOT_FOUND,
      response: {
        error: {
          code: "ROOM_NOT_FOUND"
        }
      }
    });
    expect(prisma.idempotencyKey.create).not.toHaveBeenCalled();
  });

  it("blocks rejoin for removed player", async () => {
    const prisma = createPrismaMock();
    const room = createRoomRecord();

    prisma.room.findUnique.mockResolvedValue(room);
    prisma.roomPlayer.findUnique.mockResolvedValue(
      createRoomPlayerRecord({
        status: RoomPlayerStatus.REMOVED
      })
    );

    const service = new RoomsService(prisma as unknown as PrismaService);

    await expect(
      service.joinRoom(baseUser, {
        inviteCode: room.inviteCode
      })
    ).rejects.toBeInstanceOf(ApiError);
  });
});

function createPrismaMock(): MockPrisma {
  return {
    room: {
      create: jest.fn<Promise<Room>, [RoomCreateArgs]>(),
      findUnique: jest.fn(),
      update: jest.fn<Promise<Room & { players: RoomPlayer[] }>, [RoomUpdateArgs]>()
    },
    roomPlayer: {
      create: jest.fn<Promise<RoomPlayer>, [RoomPlayerCreateArgs]>(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn()
    },
    rebuyEvent: {
      create: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve(
          createRebuyRecord({
          roomId: data.roomId as string,
          roomPlayerId: data.roomPlayerId as string,
          amountMinor: data.amountMinor as bigint,
          createdByUserId: data.createdByUserId as string,
          source: data.source as RebuyEventSource
          })
        )
      ),
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      update: jest.fn()
    },
    settlement: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn<Promise<{ id: string }>, [SettlementCreateArgs]>().mockResolvedValue({
        id: "settlement-1"
      })
    },
    settlementTransfer: {
      createMany: jest
        .fn<Promise<{ count: number }>, [SettlementTransferCreateManyArgs]>()
        .mockResolvedValue({
        count: 0
      })
    },
    idempotencyKey: {
      create: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({
          id: "idem-1",
          userId: data.userId as string,
          roomId: data.roomId as string,
          action: data.action as IdempotencyAction,
          idempotencyKey: data.idempotencyKey as string,
          requestHash: data.requestHash as string,
          responseJson: null,
          rebuyEventId: null,
          createdAt: new Date("2026-05-11T12:00:00.000Z"),
          updatedAt: new Date("2026-05-11T12:00:00.000Z")
        })
      ),
      findUnique: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockImplementation(({ where, data }: { where: { id: string }; data: Record<string, unknown> }) =>
        Promise.resolve({
          id: where.id,
          userId: baseUser.id,
          roomId: "room-1",
          action: IdempotencyAction.CREATE_REBUY,
          idempotencyKey: "idem-1",
          requestHash: "{}",
          responseJson: data.responseJson ?? null,
          rebuyEventId: (data.rebuyEventId as string | undefined) ?? null,
          createdAt: new Date("2026-05-11T12:00:00.000Z"),
          updatedAt: new Date("2026-05-11T12:00:00.000Z")
        })
      )
    },
    $transaction: jest.fn()
  };
}

function createRoomRecord(
  overrides: Partial<
    Room & {
      players: Array<
        RoomPlayer & {
          user?: User;
        }
      >;
    }
  > = {}
): Room & {
  players: Array<
    RoomPlayer & {
      user?: User;
    }
  >;
} {
  return {
    id: "room-1",
    ownerUserId: baseUser.id,
    title: "Покер у Дениса",
    currency: "RUB",
    rebuyAmountMinor: 100000n,
    startingStack: 10000,
    gameType: "SIMPLE_TRACKING",
    rebuyPermission: "PLAYER_SELF",
    status: RoomStatus.WAITING,
    inviteCode: "invite-1",
    createdAt: new Date("2026-05-11T12:00:00.000Z"),
    updatedAt: new Date("2026-05-11T12:00:00.000Z"),
    startedAt: null,
    closedAt: null,
    cancelledAt: null,
    settlementStartedAt: null,
    players: [],
    ...overrides
  };
}

function createRoomPlayerRecord(overrides: Partial<RoomPlayer> = {}): RoomPlayer {
  return {
    id: "player-1",
    roomId: "room-1",
    userId: baseUser.id,
    displayName: "Денис",
    role: RoomPlayerRole.PLAYER,
    status: RoomPlayerStatus.ACTIVE,
    joinedAt: new Date("2026-05-11T12:01:00.000Z"),
    removedAt: null,
    finalAmountMinor: null,
    netResultMinor: null,
    ...overrides
  };
}

function createUserRecord(overrides: Partial<User> = {}): User {
  return {
    id: baseUser.id,
    telegramId: baseUser.telegramId,
    username: baseUser.username,
    firstName: baseUser.firstName,
    lastName: baseUser.lastName,
    avatarUrl: baseUser.avatarUrl,
    createdAt: new Date("2026-05-11T12:00:00.000Z"),
    updatedAt: new Date("2026-05-11T12:00:00.000Z"),
    ...overrides
  };
}

function createRebuyRecord(
  overrides: Partial<{
    id: string;
    roomId: string;
    roomPlayerId: string;
    amountMinor: bigint;
    createdByUserId: string;
    source: RebuyEventSource;
    status: RebuyEventStatus;
    createdAt: Date;
    cancelledAt: Date | null;
    cancelledByUserId: string | null;
    cancellationReason: string | null;
  }> = {}
) {
  return {
    id: "rebuy-1",
    roomId: "room-1",
    roomPlayerId: "player-1",
    amountMinor: 100000n,
    createdByUserId: baseUser.id,
    source: RebuyEventSource.PLAYER_SELF,
    status: RebuyEventStatus.ACTIVE,
    createdAt: new Date("2026-05-11T12:30:00.000Z"),
    cancelledAt: null,
    cancelledByUserId: null,
    cancellationReason: null,
    ...overrides
  };
}

import { HttpStatus } from "@nestjs/common";
import {
  ActionActorType,
  ActionType,
  HandPlayerStatus,
  Street,
  TimeoutAutoActionRule,
  TurnTimerResolution,
  TurnTimerStatus,
  VirtualHandStatus,
  VirtualSeatRole,
  VirtualSeatStatus,
  VirtualTableStatus,
  type TurnTimer,
  type CommunityCard,
  type OnlinePlayerStats,
  type User,
  type VirtualAction,
  type VirtualHand,
  type VirtualHandPlayer,
  type VirtualSeat,
  type VirtualTable,
  type VirtualTableReaction
} from "@prisma/client";
import type { CreateVirtualTableRequestDto, UserDto } from "@pokertable/shared";
import { PrismaService } from "../prisma/prisma.service";
import { VirtualNotificationsService } from "./virtual-notifications.service";
import { VIRTUAL_ERROR_CODES } from "./virtual.constants";
import { encodeVirtualLeaderboardCursor } from "./virtual-leaderboard-cursor";
import { VirtualService } from "./virtual.service";

type MockPrisma = {
  virtualTable: {
    create: jest.Mock;
    findFirst: jest.Mock;
    findMany: jest.Mock;
    findUnique: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
    count: jest.Mock;
  };
  virtualSeat: {
    create: jest.Mock;
    update: jest.Mock;
  };
  virtualHand: {
    count: jest.Mock;
    create: jest.Mock;
    findMany: jest.Mock;
    findUnique: jest.Mock;
    update: jest.Mock;
  };
  virtualHandPlayer: {
    createMany: jest.Mock;
    update: jest.Mock;
  };
  virtualAction: {
    create: jest.Mock;
    createMany: jest.Mock;
    findFirst: jest.Mock;
    findMany: jest.Mock;
  };
  virtualTableReaction: {
    count: jest.Mock;
    create: jest.Mock;
    findMany: jest.Mock;
  };
  turnTimer: {
    create: jest.Mock;
    findFirst: jest.Mock;
    findMany: jest.Mock;
    findUnique: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
  };
  communityCard: {
    deleteMany: jest.Mock;
    createMany: jest.Mock;
  };
  virtualPot: {
    deleteMany: jest.Mock;
    create: jest.Mock;
  };
  onlinePlayerStats: {
    findMany: jest.Mock;
    findUnique: jest.Mock;
    upsert: jest.Mock;
  };
  user: {
    findUnique: jest.Mock;
  };
  $transaction: jest.Mock;
};

type TurnTimerUpdateManyCall = {
  where: {
    handId?: string;
    tableId?: string;
    seatId?: string;
    id?: string;
    status?: {
      in: TurnTimerStatus[];
    };
    remindedAt?: null;
  };
  data: {
    status: TurnTimerStatus;
    remindedAt?: Date;
    resolvedAt?: Date;
    resolutionType?: TurnTimerResolution;
  };
};

const baseUser: UserDto = {
  id: "user-1",
  telegramId: "100",
  username: "denis",
  firstName: "Денис",
  lastName: null,
  avatarUrl: null
};

const createTableInput: CreateVirtualTableRequestDto = {
  title: "Домашний кеш",
  maxSeats: 6,
  startingStackChips: "1000",
  chipValueMinor: "10",
  chipValueCurrency: "RUB",
  smallBlindChips: "5",
  bigBlindChips: "10",
  winProbabilityEnabled: true,
  turnDurationSeconds: 30,
  reminderDelaySeconds: 15,
  timeoutAutoActionRule: "CHECK_OR_FOLD"
};

describe("VirtualService", () => {
  beforeEach(() => {
    process.env.WEB_APP_URL = "https://miniapp.example";
  });

  it("creates a table and owner seat in one transaction", async () => {
    const prisma = createPrismaMock();
    const table = createTableRecord({
      inviteCode: "AB12CD34",
      winProbabilityEnabled: true
    });

    prisma.virtualTable.create.mockResolvedValue(table);
    prisma.virtualSeat.create.mockResolvedValue(createSeatRecord());
    prisma.$transaction.mockImplementation(
      async (callback: (tx: Pick<MockPrisma, "virtualTable" | "virtualSeat">) => Promise<VirtualTable>) =>
        callback({ virtualTable: prisma.virtualTable, virtualSeat: prisma.virtualSeat })
    );

    const service = new VirtualService(prisma as unknown as PrismaService);

    const result = await service.createTable(baseUser, createTableInput);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    const createTableCall = getFirstCall<
      | {
          data: {
            ownerUserId: string;
            title: string;
            maxSeats: number;
            startingStackChips: bigint;
            chipValueMinor: bigint | null;
            chipValueCurrency: string | null;
            smallBlindChips: bigint;
            bigBlindChips: bigint;
            winProbabilityEnabled: boolean;
            timeoutAutoActionRule: TimeoutAutoActionRule;
          };
        }
    >(prisma.virtualTable.create);
    const createSeatCall = getFirstCall<
      | {
          data: {
            tableId: string;
            userId: string;
            seatNumber: number;
            role: VirtualSeatRole;
            status: VirtualSeatStatus;
            stackChips: bigint;
          };
        }
    >(prisma.virtualSeat.create);

    expect(createTableCall?.data.ownerUserId).toBe(baseUser.id);
    expect(createTableCall?.data.title).toBe(createTableInput.title);
    expect(createTableCall?.data.maxSeats).toBe(6);
    expect(createTableCall?.data.startingStackChips).toBe(1000n);
    expect(createTableCall?.data.chipValueMinor).toBe(10n);
    expect(createTableCall?.data.chipValueCurrency).toBe("RUB");
    expect(createTableCall?.data.smallBlindChips).toBe(5n);
    expect(createTableCall?.data.bigBlindChips).toBe(10n);
    expect(createTableCall?.data.winProbabilityEnabled).toBe(true);
    expect(createTableCall?.data.timeoutAutoActionRule).toBe(
      TimeoutAutoActionRule.CHECK_OR_FOLD
    );
    expect(createSeatCall?.data.tableId).toBe(table.id);
    expect(createSeatCall?.data.userId).toBe(baseUser.id);
    expect(createSeatCall?.data.seatNumber).toBe(1);
    expect(createSeatCall?.data.role).toBe(VirtualSeatRole.OWNER);
    expect(createSeatCall?.data.status).toBe(VirtualSeatStatus.ACTIVE);
    expect(createSeatCall?.data.stackChips).toBe(1000n);
    expect(result.table.inviteUrl).toMatch(
      /^https:\/\/miniapp\.example\/join\/virtual\/AB12CD34\?ptb=/
    );
    expect(result.table).toMatchObject({
      startingStackChips: "1000",
      smallBlindChips: "5",
      bigBlindChips: "10",
      chipValueMinor: "10",
      chipValueCurrency: "RUB",
      winProbabilityEnabled: true
    });
  });

  it("creates a club event for a scheduled club table and sends invites", async () => {
    const prisma = createPrismaMock();
    const clubsService = createClubsServiceMock();
    const table = createTableRecord({
      id: "table-2",
      inviteCode: "ZX12CV34",
      clubId: "club-1",
      clubEventId: "event-1",
      scheduledStartAt: new Date("2026-05-25T18:00:00.000Z")
    });

    prisma.virtualTable.create.mockResolvedValue(
      createTableRecord({
        id: table.id,
        inviteCode: table.inviteCode
      })
    );
    prisma.virtualTable.update.mockResolvedValue(table);
    prisma.virtualSeat.create.mockResolvedValue(createSeatRecord());
    prisma.$transaction.mockImplementation(
      async (callback: (tx: Pick<MockPrisma, "virtualTable" | "virtualSeat">) => Promise<VirtualTable>) =>
        callback({ virtualTable: prisma.virtualTable, virtualSeat: prisma.virtualSeat })
    );
    clubsService.createEventForVirtualTable.mockResolvedValue("event-1");
    clubsService.sendEventInvites.mockResolvedValue(undefined);

    const service = new VirtualService(
      prisma as unknown as PrismaService,
      undefined,
      clubsService as never
    );

    await service.createTable(baseUser, {
      ...createTableInput,
      clubId: "club-1",
      scheduledStartAt: "2026-05-25T21:00:00.000+03:00",
      sendClubInvites: true,
      maxPlayers: 6
    });
    const createTableArgs = getFirstCall<{
      data: {
        clubId: string | null;
        scheduledStartAt: Date | null;
      };
    }>(prisma.virtualTable.create);

    expect(createTableArgs?.data.clubId).toBe("club-1");
    expect(createTableArgs?.data.scheduledStartAt).toEqual(
      new Date("2026-05-25T18:00:00.000Z")
    );
    expect(clubsService.createEventForVirtualTable).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        clubId: "club-1",
        createdByUserId: baseUser.id,
        virtualTableId: table.id,
        maxPlayers: 6
      })
    );
    expect(prisma.virtualTable.update).toHaveBeenCalledWith({
      where: {
        id: table.id
      },
      data: {
        clubEventId: "event-1"
      }
    });
    expect(clubsService.sendEventInvites).toHaveBeenCalledWith("event-1", "club-1");
  });

  it("accepts short and large positive timer values when creating a table", async () => {
    const prisma = createPrismaMock();
    const shortTable = createTableRecord({
      turnDurationSeconds: 2,
      reminderDelaySeconds: 1
    });
    const largeTable = createTableRecord({
      id: "table-2",
      inviteCode: "ZX12CV34",
      turnDurationSeconds: 3600,
      reminderDelaySeconds: 3599
    });

    prisma.virtualTable.create.mockResolvedValueOnce(shortTable).mockResolvedValueOnce(largeTable);
    prisma.virtualSeat.create.mockResolvedValue(createSeatRecord());
    prisma.$transaction.mockImplementation(
      async (callback: (tx: Pick<MockPrisma, "virtualTable" | "virtualSeat">) => Promise<VirtualTable>) =>
        callback({ virtualTable: prisma.virtualTable, virtualSeat: prisma.virtualSeat })
    );

    const service = new VirtualService(prisma as unknown as PrismaService);

    const shortResult = await service.createTable(baseUser, {
      ...createTableInput,
      turnDurationSeconds: 2,
      reminderDelaySeconds: 1
    });
    const largeResult = await service.createTable(baseUser, {
      ...createTableInput,
      turnDurationSeconds: 3600,
      reminderDelaySeconds: 3599
    });

    const createTableCalls = getCalls<{
      data: {
        turnDurationSeconds: number;
        reminderDelaySeconds: number;
      };
    }>(prisma.virtualTable.create);

    expect(createTableCalls[0]?.data).toMatchObject({
      turnDurationSeconds: 2,
      reminderDelaySeconds: 1
    });
    expect(createTableCalls[1]?.data).toMatchObject({
      turnDurationSeconds: 3600,
      reminderDelaySeconds: 3599
    });
    expect(shortResult.table.inviteUrl).toMatch(
      /^https:\/\/miniapp\.example\/join\/virtual\/AB12CD34\?ptb=/
    );
    expect(largeResult.table.inviteUrl).toMatch(
      /^https:\/\/miniapp\.example\/join\/virtual\/ZX12CV34\?ptb=/
    );
  });

  it.each([
    [0, 1],
    [2, 0]
  ])("rejects non-positive timer values turn=%s reminder=%s", async (turn, reminder) => {
    const prisma = createPrismaMock();
    const service = new VirtualService(prisma as unknown as PrismaService);

    try {
      await service.createTable(baseUser, {
        ...createTableInput,
        turnDurationSeconds: turn,
        reminderDelaySeconds: reminder
      });
      fail(`Expected timer values ${turn}/${reminder} to be rejected`);
    } catch (error) {
      expect(error).toMatchObject({
        code: VIRTUAL_ERROR_CODES.invalidInput,
        status: HttpStatus.BAD_REQUEST
      });
      expect(
        (error as { getResponse: () => { error: { message: string } } }).getResponse()
      ).toEqual({
        error: {
          code: VIRTUAL_ERROR_CODES.invalidInput,
          message: "Время должно быть больше нуля"
        }
      });
    }

    expect(prisma.virtualTable.create).not.toHaveBeenCalled();
  });

  it.each([
    [1, 1],
    [2, 2],
    [2, 3]
  ])("rejects reminder not earlier than timeout turn=%s reminder=%s", async (turn, reminder) => {
    const prisma = createPrismaMock();
    const service = new VirtualService(prisma as unknown as PrismaService);

    try {
      await service.createTable(baseUser, {
        ...createTableInput,
        turnDurationSeconds: turn,
        reminderDelaySeconds: reminder
      });
      fail(`Expected timer values ${turn}/${reminder} to be rejected`);
    } catch (error) {
      expect(error).toMatchObject({
        code: VIRTUAL_ERROR_CODES.invalidInput,
        status: HttpStatus.BAD_REQUEST
      });
      expect(
        (error as { getResponse: () => { error: { message: string } } }).getResponse()
      ).toEqual({
        error: {
          code: VIRTUAL_ERROR_CODES.invalidInput,
          message: "Напоминание должно прийти раньше тайм-аута"
        }
      });
    }

    expect(prisma.virtualTable.create).not.toHaveBeenCalled();
  });

  it("returns existing seat on duplicate join", async () => {
    const prisma = createPrismaMock();
    const table = createTableRecord({
      seats: [createSeatRecord()]
    });

    prisma.virtualTable.findFirst.mockResolvedValue(table);

    const service = new VirtualService(prisma as unknown as PrismaService);

    const result = await service.joinTable(baseUser, {
      inviteCode: "ab12cd34"
    });

    expect(result).toEqual({
      tableId: table.id,
      seatId: table.seats[0]?.id,
      status: table.status
    });
    expect(prisma.virtualSeat.create).not.toHaveBeenCalled();
  });

  it("joins a new player by invite code into the lowest free seat", async () => {
    const prisma = createPrismaMock();
    const table = createTableRecord({
      seats: [
        createSeatRecord({
          id: "seat-1",
          seatNumber: 1
        }),
        createSeatRecord({
          id: "seat-3",
          userId: "user-3",
          seatNumber: 3
        })
      ]
    });
    const newSeat = createSeatRecord({
      id: "seat-2",
      userId: "user-2",
      seatNumber: 2
    });

    prisma.virtualTable.findFirst.mockResolvedValue(table);
    prisma.virtualSeat.create.mockResolvedValue(newSeat);

    const service = new VirtualService(prisma as unknown as PrismaService);
    const result = await service.joinTable(
      {
        ...baseUser,
        id: "user-2"
      },
      {
        inviteCode: table.inviteCode.toLowerCase()
      }
    );

    const createSeatCall = getFirstCall<
      | {
          data: {
            tableId: string;
            userId: string;
            seatNumber: number;
          };
        }
    >(prisma.virtualSeat.create);

    expect(createSeatCall?.data.tableId).toBe(table.id);
    expect(createSeatCall?.data.userId).toBe("user-2");
    expect(createSeatCall?.data.seatNumber).toBe(2);
    expect(result.seatId).toBe("seat-2");
  });

  it("starts a hand and getTable returns only the viewer private cards", async () => {
    const prisma = createPrismaMock();
    const notifications = createNotificationsMock();
    const viewerAvatarUrl = "https://cdn.example.com/avatars/user-1.png";
    const table = createTableRecord({
      seats: [
        createSeatRecord({
          id: "seat-1",
          userId: "user-1",
          seatNumber: 1,
          role: VirtualSeatRole.OWNER,
          user: createUserRecord({
            id: "user-1",
            avatarUrl: viewerAvatarUrl
          })
        }),
        createSeatRecord({
          id: "seat-2",
          userId: "user-2",
          seatNumber: 2
        }),
        createSeatRecord({
          id: "seat-3",
          userId: "user-3",
          seatNumber: 3
        })
      ]
    });
    const createdHand = createHandRecord();
    const persistedHand = createHandRecord({
      id: "hand-1",
      currentActorSeatId: "seat-1",
      players: [
        createHandPlayerRecord({
          seatId: "seat-1",
          seat: table.seats[0]!,
          privateCard1: "AS",
          privateCard2: "KH"
        }),
        createHandPlayerRecord({
          seatId: "seat-2",
          seat: table.seats[1]!,
          privateCard1: "QC",
          privateCard2: "QD"
        })
      ]
    });

    prisma.virtualTable.findUnique
      .mockResolvedValueOnce(table)
      .mockResolvedValueOnce({
        ...table,
        status: VirtualTableStatus.ACTIVE,
        currentHandId: "hand-1"
      });
    prisma.virtualHand.count.mockResolvedValue(0);
    prisma.virtualHand.create.mockResolvedValue(createdHand);
    prisma.virtualHand.findUnique.mockResolvedValue(persistedHand);
    prisma.turnTimer.findFirst.mockResolvedValue(createTurnTimerRecord());
    prisma.$transaction.mockImplementation(async (callback: (tx: MockPrisma) => Promise<VirtualHand>) =>
      callback(prisma)
    );

    const service = new VirtualService(
      prisma as unknown as PrismaService,
      notifications as unknown as VirtualNotificationsService
    );

    const started = await service.startTable(baseUser, table.id);
    const result = await service.getTable(baseUser, table.id);

    expect(started.currentHandId).toBe(createdHand.id);
    expect(prisma.virtualHand.create).toHaveBeenCalled();
    expect(prisma.virtualHandPlayer.createMany).toHaveBeenCalled();
    const createHandCall = getFirstCall<
      | {
          data: {
            startedAt: Date;
            currentActorSeatId: string | null;
          };
        }
    >(prisma.virtualHand.create);
    const createTurnTimerCall = getFirstCall<
      | {
          data: {
            tableId: string;
            handId: string;
            seatId: string;
            status: TurnTimerStatus;
            startedAt: Date;
            reminderDueAt: Date;
            expiresAt: Date;
          };
        }
    >(prisma.turnTimer.create);

    expect(createTurnTimerCall?.data.tableId).toBe(table.id);
    expect(createTurnTimerCall?.data.handId).toBe(createdHand.id);
    expect(createTurnTimerCall?.data.seatId).toBe(createHandCall?.data.currentActorSeatId);
    expect(createTurnTimerCall?.data.status).toBe(TurnTimerStatus.ACTIVE);
    expect(createTurnTimerCall?.data.startedAt).toEqual(createHandCall?.data.startedAt);
    expect(
      createTurnTimerCall &&
        createTurnTimerCall.data.reminderDueAt.getTime() -
          createTurnTimerCall.data.startedAt.getTime()
    ).toBe(15_000);
    expect(
      createTurnTimerCall &&
        createTurnTimerCall.data.expiresAt.getTime() -
          createTurnTimerCall.data.startedAt.getTime()
    ).toBe(30_000);
    expect(result.table).toMatchObject({
      startingStackChips: "1000",
      chipValueMinor: "10",
      chipValueCurrency: "RUB",
      turnDurationSeconds: 30,
      reminderDelaySeconds: 15,
      timeoutAutoActionRule: TimeoutAutoActionRule.CHECK_OR_FOLD,
      startedAt: null,
      pausedAt: null,
      finishedAt: null
    });
    expect(result.hand?.currentTimer).toEqual({
      id: "timer-1",
      seatId: "seat-1",
      status: TurnTimerStatus.ACTIVE,
      startedAt: "2026-05-13T10:05:00.000Z",
      reminderDueAt: "2026-05-13T10:05:15.000Z",
      expiresAt: "2026-05-13T10:05:30.000Z",
      remindedAt: null
    });
    expect(result.seats[0]).toMatchObject({
      id: "seat-1",
      avatarUrl: viewerAvatarUrl,
      committedStreetChips: "0",
      committedTotalChips: "0"
    });
    expect(result.seats[1]?.avatarUrl).toBeNull();
    expect(result.hand?.myPrivateCards).toEqual(["AS", "KH"]);
    expect(result.seats.every((seat) => !("privateCards" in seat))).toBe(true);
    expect(notifications.sendReminderNotification).not.toHaveBeenCalled();
    expect(notifications.sendTimeoutNotification).not.toHaveBeenCalled();
  });

  it("returns null seat probabilities when the feature is disabled", async () => {
    const prisma = createPrismaMock();
    const table = createTableRecord({
      currentHandId: "hand-1",
      winProbabilityEnabled: false,
      seats: [
        createSeatRecord({
          id: "seat-1",
          userId: baseUser.id,
          seatNumber: 1,
          role: VirtualSeatRole.OWNER
        }),
        createSeatRecord({
          id: "seat-2",
          userId: "user-2",
          seatNumber: 2,
          user: createUserRecord({ id: "user-2", telegramId: "200", firstName: "Ира" })
        })
      ]
    });
    const hand = createHandRecord({
      id: "hand-1",
      currentStreet: Street.TURN,
      communityCards: [
        createCommunityCardRecord({ position: 0, card: "AS", street: Street.FLOP }),
        createCommunityCardRecord({ position: 1, card: "AC", street: Street.FLOP }),
        createCommunityCardRecord({ position: 2, card: "AD", street: Street.FLOP }),
        createCommunityCardRecord({ position: 3, card: "KC", street: Street.TURN })
      ],
      players: [
        createHandPlayerRecord({
          seatId: "seat-1",
          seat: table.seats[0]!,
          privateCard1: "AH",
          privateCard2: "KH"
        }),
        createHandPlayerRecord({
          id: "hand-player-2",
          seatId: "seat-2",
          seat: table.seats[1]!,
          privateCard1: "QS",
          privateCard2: "QD"
        })
      ]
    });

    prisma.virtualTable.findUnique.mockResolvedValue(table);
    prisma.virtualHand.findUnique.mockResolvedValue(hand);
    prisma.turnTimer.findFirst.mockResolvedValue(createTurnTimerRecord());

    const service = new VirtualService(prisma as unknown as PrismaService);
    const result = await service.getTable(baseUser, table.id);

    expect(result.table.winProbabilityEnabled).toBe(false);
    expect(result.seats.map((seat) => seat.winProbabilityPercent)).toEqual([null, null]);
    expect(result.hand?.myPrivateCards).toEqual(["AH", "KH"]);
    expect(result.seats.every((seat) => !("privateCards" in seat))).toBe(true);
  });

  it("returns only viewer probability when the feature is enabled without exposing чужие карты", async () => {
    const prisma = createPrismaMock();
    const table = createTableRecord({
      currentHandId: "hand-1",
      winProbabilityEnabled: true,
      status: VirtualTableStatus.ACTIVE,
      seats: [
        createSeatRecord({
          id: "seat-1",
          userId: baseUser.id,
          seatNumber: 1,
          role: VirtualSeatRole.OWNER
        }),
        createSeatRecord({
          id: "seat-2",
          userId: "user-2",
          seatNumber: 2,
          user: createUserRecord({ id: "user-2", telegramId: "200", firstName: "Ира" })
        }),
        createSeatRecord({
          id: "seat-3",
          userId: "user-3",
          seatNumber: 3,
          status: VirtualSeatStatus.SITTING_OUT,
          user: createUserRecord({ id: "user-3", telegramId: "300", firstName: "Макс" })
        })
      ]
    });
    const hand = createHandRecord({
      id: "hand-1",
      currentStreet: Street.TURN,
      currentActorSeatId: "seat-1",
      currentBetChips: 10n,
      potTotalChips: 20n,
      communityCards: [
        createCommunityCardRecord({ position: 0, card: "AS", street: Street.FLOP }),
        createCommunityCardRecord({ position: 1, card: "AC", street: Street.FLOP }),
        createCommunityCardRecord({ position: 2, card: "AD", street: Street.FLOP }),
        createCommunityCardRecord({ position: 3, card: "KC", street: Street.TURN })
      ],
      players: [
        createHandPlayerRecord({
          seatId: "seat-1",
          seat: table.seats[0]!,
          committedTotalChips: 10n,
          committedStreetChips: 10n,
          privateCard1: "AH",
          privateCard2: "KH"
        }),
        createHandPlayerRecord({
          id: "hand-player-2",
          seatId: "seat-2",
          seat: table.seats[1]!,
          committedTotalChips: 10n,
          committedStreetChips: 10n,
          privateCard1: "QS",
          privateCard2: "QD"
        })
      ]
    });

    prisma.virtualTable.findUnique.mockResolvedValue(table);
    prisma.virtualHand.findUnique.mockResolvedValue(hand);
    prisma.turnTimer.findFirst.mockResolvedValue(createTurnTimerRecord());

    const service = new VirtualService(prisma as unknown as PrismaService);
    const result = await service.getTable(baseUser, table.id);
    const secondViewerResult = await service.getTable(
      {
        ...baseUser,
        id: "user-2",
        telegramId: "200",
        username: null,
        firstName: "Ира"
      },
      table.id
    );

    expect(result.table.winProbabilityEnabled).toBe(true);
    expect(result.seats).toEqual([
      expect.objectContaining({
        id: "seat-1",
        committedStreetChips: "10",
        committedTotalChips: "10",
        winProbabilityPercent: 100
      }),
      expect.objectContaining({
        id: "seat-2",
        committedStreetChips: "10",
        committedTotalChips: "10",
        winProbabilityPercent: null
      }),
      expect.objectContaining({
        id: "seat-3",
        winProbabilityPercent: null
      })
    ]);
    expect(result.hand?.myPrivateCards).toEqual(["AH", "KH"]);
    expect(result).not.toHaveProperty("privateCard1");
    expect(result).not.toHaveProperty("privateCard2");
    expect(result.seats.every((seat) => !("privateCards" in seat))).toBe(true);
    expect(secondViewerResult.seats).toEqual([
      expect.objectContaining({
        id: "seat-1",
        winProbabilityPercent: null
      }),
      expect.objectContaining({
        id: "seat-2"
      }),
      expect.objectContaining({
        id: "seat-3",
        winProbabilityPercent: null
      })
    ]);
    expect(typeof secondViewerResult.seats[1]?.winProbabilityPercent).toBe("number");
    expect(secondViewerResult.seats[1]?.winProbabilityPercent).not.toBe(
      result.seats[0]?.winProbabilityPercent
    );
  });

  it("does not let opponent private cards affect viewer probability", async () => {
    const createTableAndHand = (opponentCards: [string, string]) => {
      const table = createTableRecord({
        currentHandId: "hand-1",
        winProbabilityEnabled: true,
        status: VirtualTableStatus.ACTIVE,
        seats: [
          createSeatRecord({
            id: "seat-1",
            userId: baseUser.id,
            seatNumber: 1,
            role: VirtualSeatRole.OWNER
          }),
          createSeatRecord({
            id: "seat-2",
            userId: "user-2",
            seatNumber: 2,
            user: createUserRecord({ id: "user-2", telegramId: "200", firstName: "Ира" })
          })
        ]
      });
      const hand = createHandRecord({
        id: "hand-1",
        currentStreet: Street.FLOP,
        currentActorSeatId: "seat-1",
        currentBetChips: 10n,
        potTotalChips: 20n,
        communityCards: [
          createCommunityCardRecord({ position: 0, card: "2S", street: Street.FLOP }),
          createCommunityCardRecord({ position: 1, card: "7H", street: Street.FLOP }),
          createCommunityCardRecord({ position: 2, card: "9D", street: Street.FLOP })
        ],
        players: [
          createHandPlayerRecord({
            seatId: "seat-1",
            seat: table.seats[0]!,
            committedTotalChips: 10n,
            committedStreetChips: 10n,
            privateCard1: "AH",
            privateCard2: "AD"
          }),
          createHandPlayerRecord({
            id: "hand-player-2",
            seatId: "seat-2",
            seat: table.seats[1]!,
            committedTotalChips: 10n,
            committedStreetChips: 10n,
            privateCard1: opponentCards[0],
            privateCard2: opponentCards[1]
          })
        ]
      });

      return { table, hand };
    };
    const first = createTableAndHand(["KS", "KD"]);
    const second = createTableAndHand(["3C", "4C"]);
    const firstPrisma = createPrismaMock();
    const secondPrisma = createPrismaMock();

    firstPrisma.virtualTable.findUnique.mockResolvedValue(first.table);
    firstPrisma.virtualHand.findUnique.mockResolvedValue(first.hand);
    firstPrisma.turnTimer.findFirst.mockResolvedValue(createTurnTimerRecord());
    secondPrisma.virtualTable.findUnique.mockResolvedValue(second.table);
    secondPrisma.virtualHand.findUnique.mockResolvedValue(second.hand);
    secondPrisma.turnTimer.findFirst.mockResolvedValue(createTurnTimerRecord());

    const firstResult = await new VirtualService(firstPrisma as unknown as PrismaService).getTable(
      baseUser,
      first.table.id
    );
    const secondResult = await new VirtualService(secondPrisma as unknown as PrismaService).getTable(
      baseUser,
      second.table.id
    );

    expect(firstResult.seats[0]?.winProbabilityPercent).toBe(
      secondResult.seats[0]?.winProbabilityPercent
    );
    expect(firstResult.seats[1]?.winProbabilityPercent).toBeNull();
    expect(secondResult.seats[1]?.winProbabilityPercent).toBeNull();
  });

  it("returns card win probability instead of current pot equity", async () => {
    const prisma = createPrismaMock();
    const table = createTableRecord({
      currentHandId: "hand-1",
      winProbabilityEnabled: true,
      status: VirtualTableStatus.ACTIVE,
      smallBlindChips: 50n,
      bigBlindChips: 100n,
      seats: [
        createSeatRecord({
          id: "seat-1",
          userId: baseUser.id,
          seatNumber: 1,
          role: VirtualSeatRole.OWNER
        }),
        createSeatRecord({
          id: "seat-2",
          userId: "user-2",
          seatNumber: 2,
          user: createUserRecord({ id: "user-2", telegramId: "200", firstName: "Ира" })
        })
      ]
    });
    const hand = createHandRecord({
      id: "hand-1",
      currentStreet: Street.PRE_FLOP,
      currentActorSeatId: "seat-1",
      smallBlindSeatId: "seat-1",
      bigBlindSeatId: "seat-2",
      smallBlindChips: 50n,
      bigBlindChips: 100n,
      currentBetChips: 100n,
      minRaiseChips: 100n,
      potTotalChips: 150n,
      communityCards: [],
      players: [
        createHandPlayerRecord({
          seatId: "seat-1",
          seat: table.seats[0]!,
          startingStackChips: 10350n,
          currentStackChips: 10300n,
          committedTotalChips: 50n,
          committedStreetChips: 50n,
          privateCard1: "AC",
          privateCard2: "AD"
        }),
        createHandPlayerRecord({
          id: "hand-player-2",
          seatId: "seat-2",
          seat: table.seats[1]!,
          startingStackChips: 9650n,
          currentStackChips: 9550n,
          committedTotalChips: 100n,
          committedStreetChips: 100n,
          privateCard1: "QH",
          privateCard2: "QS"
        })
      ]
    });

    prisma.virtualTable.findUnique.mockResolvedValue(table);
    prisma.virtualHand.findUnique.mockResolvedValue(hand);
    prisma.turnTimer.findFirst.mockResolvedValue(createTurnTimerRecord());

    const result = await new VirtualService(prisma as unknown as PrismaService).getTable(
      baseUser,
      table.id
    );

    expect(result.seats[0]?.winProbabilityPercent).toBeGreaterThan(80);
    expect(result.seats[0]?.winProbabilityPercent).toBeLessThan(90);
    expect(result.seats[1]?.winProbabilityPercent).toBeNull();
  });

  it("records an immediate sit-out auto-action when the first actor is sit-out requested on hand start", async () => {
    const prisma = createPrismaMock();
    const notifications = createNotificationsMock();
    const table = createTableRecord({
      seats: [
        createSeatRecord({
          id: "seat-1",
          userId: "user-1",
          seatNumber: 1,
          role: VirtualSeatRole.OWNER,
          status: VirtualSeatStatus.SIT_OUT_REQUESTED,
          sitOutAutoFoldEnabled: true
        }),
        createSeatRecord({
          id: "seat-2",
          userId: "user-2",
          seatNumber: 2
        })
      ]
    });
    const createdHand = createHandRecord();

    prisma.virtualTable.findUnique.mockResolvedValue(table);
    prisma.virtualHand.count.mockResolvedValue(0);
    prisma.virtualHand.create.mockResolvedValue(createdHand);
    prisma.$transaction.mockImplementation(async (callback: (tx: MockPrisma) => Promise<VirtualHand>) =>
      callback(prisma)
    );

    const service = new VirtualService(
      prisma as unknown as PrismaService,
      notifications as unknown as VirtualNotificationsService
    );

    await service.startTable(baseUser, table.id);

    const createHandCall = getFirstCall<{
      data: {
        currentActorSeatId: string | null;
      };
    }>(prisma.virtualHand.create);
    const autoFoldActionCall = getFirstCall<{
      data: {
        seatId: string;
        actorType: ActionActorType;
        actionType: ActionType;
        metadataJson: {
          reason: string;
          autoCheck: boolean;
          autoFold: boolean;
        };
      };
    }>(prisma.virtualAction.create);
    const updateHandCall = getFirstCall<{
      data: {
        currentActorSeatId: string | null;
      };
    }>(prisma.virtualHand.update);
    expect(autoFoldActionCall?.data.seatId).toBe(createHandCall?.data.currentActorSeatId);
    expect(autoFoldActionCall?.data.actorType).toBe(ActionActorType.SYSTEM);
    expect(autoFoldActionCall?.data.actionType).toBe(ActionType.AUTO_FOLD);
    expect(autoFoldActionCall?.data.metadataJson).toEqual({
      reason: "SIT_OUT",
      autoCheck: false,
      autoFold: true,
      street: "PRE_FLOP"
    });
    expect(updateHandCall?.data.currentActorSeatId).not.toBe(autoFoldActionCall?.data.seatId);
  });

  it("returns table config fields and lifecycle dates as iso strings or null", async () => {
    const prisma = createPrismaMock();
    const table = createTableRecord({
      status: VirtualTableStatus.PAUSED,
      startedAt: new Date("2026-05-13T10:05:00.000Z"),
      pausedAt: new Date("2026-05-13T10:20:00.000Z"),
      seats: [
        createSeatRecord({
          id: "seat-1",
          userId: baseUser.id
        })
      ]
    });

    prisma.virtualTable.findUnique.mockResolvedValue(table);

    const service = new VirtualService(prisma as unknown as PrismaService);
    const result = await service.getTable(baseUser, table.id);

    expect(result.table).toMatchObject({
      id: table.id,
      startingStackChips: "1000",
      chipValueMinor: "10",
      chipValueCurrency: "RUB",
      turnDurationSeconds: 30,
      reminderDelaySeconds: 15,
      timeoutAutoActionRule: TimeoutAutoActionRule.CHECK_OR_FOLD,
      createdAt: "2026-05-13T10:00:00.000Z",
      startedAt: "2026-05-13T10:05:00.000Z",
      pausedAt: "2026-05-13T10:20:00.000Z",
      finishedAt: null
    });
  });

  it("returns null currentTimer for a completed current hand", async () => {
    const prisma = createPrismaMock();
    const table = createTableRecord({
      status: VirtualTableStatus.ACTIVE,
      currentHandId: "hand-1",
      seats: [
        createSeatRecord({
          id: "seat-1",
          userId: baseUser.id
        })
      ]
    });
    const hand = createHandRecord({
      id: "hand-1",
      status: VirtualHandStatus.COMPLETED,
      currentActorSeatId: null,
      completedAt: new Date("2026-05-13T10:30:00.000Z")
    });

    prisma.virtualTable.findUnique.mockResolvedValue(table);
    prisma.virtualHand.findUnique.mockResolvedValue(hand);

    const service = new VirtualService(prisma as unknown as PrismaService);
    const result = await service.getTable(baseUser, table.id);

    expect(result.hand?.currentTimer).toBeNull();
    expect(prisma.turnTimer.findFirst).not.toHaveBeenCalled();
  });

  it("returns settlement for a finished table with deterministic transfers", async () => {
    const prisma = createPrismaMock();
    const table = createTableRecord({
      status: VirtualTableStatus.FINISHED,
      finishedAt: new Date("2026-05-13T12:30:00.000Z"),
      currentHandId: "hand-cancelled",
      seats: [
        createSeatRecord({
          id: "seat-1",
          userId: baseUser.id,
          seatNumber: 1,
          displayName: "Аня",
          stackChips: 1250n
        }),
        createSeatRecord({
          id: "seat-2",
          userId: "user-2",
          seatNumber: 2,
          displayName: "Борис",
          stackChips: 900n,
          user: createUserRecord({ id: "user-2", firstName: "Борис" })
        }),
        createSeatRecord({
          id: "seat-3",
          userId: "user-3",
          seatNumber: 3,
          displayName: "Вера",
          stackChips: 700n,
          user: createUserRecord({ id: "user-3", firstName: "Вера" })
        }),
        createSeatRecord({
          id: "seat-4",
          userId: "user-4",
          seatNumber: 4,
          displayName: "Глеб",
          stackChips: 1150n,
          user: createUserRecord({ id: "user-4", firstName: "Глеб" })
        })
      ]
    });
    const cancelledHand = createHandRecord({
      id: "hand-cancelled",
      status: VirtualHandStatus.CANCELLED,
      currentActorSeatId: null,
      completedAt: new Date("2026-05-13T12:30:00.000Z")
    });

    prisma.virtualTable.findUnique.mockResolvedValue(table);
    prisma.virtualHand.findUnique.mockResolvedValue(cancelledHand);

    const service = new VirtualService(prisma as unknown as PrismaService);
    const result = await service.getTable(baseUser, table.id);

    expect(result.hand).toBeUndefined();
    expect(result.settlement).toEqual({
      totalStartingStackChips: "4000",
      totalFinalStackChips: "4000",
      differenceChips: "0",
      players: [
        {
          seatId: "seat-1",
          displayName: "Аня",
          startingStackChips: "1000",
          finalStackChips: "1250",
          netChips: "250",
          netEstimatedMinor: "2500"
        },
        {
          seatId: "seat-2",
          displayName: "Борис",
          startingStackChips: "1000",
          finalStackChips: "900",
          netChips: "-100",
          netEstimatedMinor: "-1000"
        },
        {
          seatId: "seat-3",
          displayName: "Вера",
          startingStackChips: "1000",
          finalStackChips: "700",
          netChips: "-300",
          netEstimatedMinor: "-3000"
        },
        {
          seatId: "seat-4",
          displayName: "Глеб",
          startingStackChips: "1000",
          finalStackChips: "1150",
          netChips: "150",
          netEstimatedMinor: "1500"
        }
      ],
      transfers: [
        {
          fromSeatId: "seat-3",
          fromName: "Вера",
          toSeatId: "seat-1",
          toName: "Аня",
          amountChips: "250",
          amountEstimatedMinor: "2500"
        },
        {
          fromSeatId: "seat-3",
          fromName: "Вера",
          toSeatId: "seat-4",
          toName: "Глеб",
          amountChips: "50",
          amountEstimatedMinor: "500"
        },
        {
          fromSeatId: "seat-2",
          fromName: "Борис",
          toSeatId: "seat-4",
          toName: "Глеб",
          amountChips: "100",
          amountEstimatedMinor: "1000"
        }
      ]
    });
  });

  it("returns null money fields in settlement when chip value is not set", async () => {
    const prisma = createPrismaMock();
    const table = createTableRecord({
      status: VirtualTableStatus.FINISHED,
      chipValueMinor: null,
      chipValueCurrency: null,
      seats: [
        createSeatRecord({
          id: "seat-1",
          userId: baseUser.id,
          stackChips: 1100n
        }),
        createSeatRecord({
          id: "seat-2",
          userId: "user-2",
          seatNumber: 2,
          stackChips: 900n,
          user: createUserRecord({ id: "user-2", firstName: "Ира" })
        })
      ]
    });

    prisma.virtualTable.findUnique.mockResolvedValue(table);

    const service = new VirtualService(prisma as unknown as PrismaService);
    const result = await service.getTable(baseUser, table.id);

    expect(result.settlement?.players).toEqual([
      expect.objectContaining({
        seatId: "seat-1",
        netEstimatedMinor: null
      }),
      expect.objectContaining({
        seatId: "seat-2",
        netEstimatedMinor: null
      })
    ]);
    expect(result.settlement?.transfers).toEqual([
      expect.objectContaining({
        amountEstimatedMinor: null
      })
    ]);
  });

  it("returns showdown resultSummary and no legal actions for a completed current hand", async () => {
    const prisma = createPrismaMock();
    const completedAt = new Date("2026-05-13T10:30:00.000Z");
    const table = createTableRecord({
      status: VirtualTableStatus.ACTIVE,
      currentHandId: "hand-1",
      seats: [
        createSeatRecord({
          id: "seat-1",
          userId: baseUser.id,
          seatNumber: 1
        }),
        createSeatRecord({
          id: "seat-2",
          userId: "user-2",
          seatNumber: 2
        })
      ]
    });
    const hand = createHandRecord({
      id: "hand-1",
      status: VirtualHandStatus.COMPLETED,
      currentStreet: Street.SHOWDOWN,
      currentActorSeatId: null,
      completedAt,
      currentBetChips: 0n,
      players: [
        createHandPlayerRecord({
          seatId: "seat-1",
          seat: table.seats[0]!,
          currentStackChips: 990n,
          committedTotalChips: 10n,
          committedStreetChips: 0n,
          privateCard1: "AS",
          privateCard2: "KH"
        }),
        createHandPlayerRecord({
          id: "hand-player-2",
          seatId: "seat-2",
          seat: table.seats[1]!,
          currentStackChips: 1010n,
          committedTotalChips: 10n,
          committedStreetChips: 0n,
          privateCard1: "QC",
          privateCard2: "QD"
        })
      ],
      pots: [
        {
          id: "pot-1",
          potType: "MAIN",
          amountChips: 20n,
          capChips: 20n,
          eligibleSeatIdsJson: ["seat-1", "seat-2"],
          awards: [
            {
              winnerSeatId: "seat-2",
              amountChips: 20n,
              handRankJson: {
                rank: "PAIR",
                rankValue: 1,
                bestFiveCards: ["QD", "QC", "AS", "KH", "TC"],
                tiebreaker: [12, 14, 13, 10]
              }
            }
          ]
        }
      ]
    });

    prisma.virtualTable.findUnique.mockResolvedValue(table);
    prisma.virtualHand.findUnique.mockResolvedValue(hand);

    const service = new VirtualService(prisma as unknown as PrismaService);
    const result = await service.getTable(baseUser, table.id);

    expect(result.hand?.myLegalActions).toEqual([]);
    expect(result.hand?.resultSummary).toEqual({
      revealUntil: "2026-05-13T10:30:10.000Z",
      wonByFold: false,
      winners: [
        {
          seatId: "seat-2",
          displayName: "Денис",
          amountChips: "20",
          handRank: "PAIR",
          handRankLabel: "Пара",
          bestFiveCards: ["QD", "QC", "AS", "KH", "TC"]
        }
      ]
    });
  });

  it("returns fold resultSummary without bestFiveCards for a completed current hand", async () => {
    const prisma = createPrismaMock();
    const completedAt = new Date("2026-05-13T10:30:00.000Z");
    const table = createTableRecord({
      status: VirtualTableStatus.ACTIVE,
      currentHandId: "hand-1",
      seats: [
        createSeatRecord({
          id: "seat-1",
          userId: baseUser.id,
          seatNumber: 1
        }),
        createSeatRecord({
          id: "seat-2",
          userId: "user-2",
          seatNumber: 2,
          user: createUserRecord({
            id: "user-2",
            telegramId: "200",
            username: "user2",
            firstName: null
          })
        })
      ]
    });
    const hand = createHandRecord({
      id: "hand-1",
      status: VirtualHandStatus.COMPLETED,
      currentStreet: Street.PRE_FLOP,
      currentActorSeatId: null,
      completedAt,
      currentBetChips: 10n,
      players: [
        createHandPlayerRecord({
          seatId: "seat-1",
          seat: table.seats[0]!
        }),
        createHandPlayerRecord({
          id: "hand-player-2",
          seatId: "seat-2",
          seat: table.seats[1]!
        })
      ],
      pots: [
        {
          id: "pot-1",
          potType: "MAIN",
          amountChips: 15n,
          capChips: 15n,
          eligibleSeatIdsJson: ["seat-1", "seat-2"],
          awards: [
            {
              winnerSeatId: "seat-2",
              amountChips: 15n,
              handRankJson: null
            }
          ]
        }
      ]
    });

    prisma.virtualTable.findUnique.mockResolvedValue(table);
    prisma.virtualHand.findUnique.mockResolvedValue(hand);

    const service = new VirtualService(prisma as unknown as PrismaService);
    const result = await service.getTable(baseUser, table.id);

    expect(result.hand?.myLegalActions).toEqual([]);
    expect(result.hand?.resultSummary).toEqual({
      revealUntil: "2026-05-13T10:30:10.000Z",
      wonByFold: true,
      winners: [
        {
          seatId: "seat-2",
          displayName: "Денис",
          amountChips: "15",
          handRank: null,
          handRankLabel: null,
          bestFiveCards: []
        }
      ]
    });
  });

  it("starts the next hand after a completed hand and rotates dealer", async () => {
    const prisma = createPrismaMock();
    const notifications = createNotificationsMock();
    const tableStartedAt = new Date("2026-05-13T10:00:00.000Z");
    const table = createTableRecord({
      status: VirtualTableStatus.ACTIVE,
      currentHandId: "hand-1",
      startedAt: tableStartedAt,
      seats: [
        createSeatRecord({
          id: "seat-1",
          userId: "user-1",
          seatNumber: 1,
          role: VirtualSeatRole.OWNER
        }),
        createSeatRecord({
          id: "seat-2",
          userId: "user-2",
          seatNumber: 2
        })
      ]
    });
    const completedHand = createHandRecord({
      id: "hand-1",
      status: VirtualHandStatus.COMPLETED,
      dealerSeatId: "seat-1",
      currentActorSeatId: null,
      completedAt: new Date("2000-01-01T10:08:00.000Z")
    });
    const createdHand = createHandRecord({
      id: "hand-2"
    });

    prisma.virtualTable.findUnique.mockResolvedValue(table);
    prisma.virtualHand.findUnique.mockResolvedValue(completedHand);
    prisma.virtualHand.count.mockResolvedValue(1);
    prisma.virtualHand.create.mockResolvedValue(createdHand);
    prisma.$transaction.mockImplementation(async (callback: (tx: MockPrisma) => Promise<VirtualHand>) =>
      callback(prisma)
    );

    const service = new VirtualService(
      prisma as unknown as PrismaService,
      notifications as unknown as VirtualNotificationsService
    );

    const result = await service.startNextHand(baseUser, table.id);

    const createHandCall = getFirstCall<
      | {
          data: {
            handNumber: number;
            dealerSeatId: string;
            currentActorSeatId: string | null;
            startedAt: Date;
          };
        }
    >(prisma.virtualHand.create);
    const updateTableCall = getFirstCall<
      | {
          data: {
            startedAt: Date;
            currentHandId: string;
          };
        }
    >(prisma.virtualTable.update);
    const createTurnTimerCall = getFirstCall<
      | {
          data: {
            handId: string;
            seatId: string;
            status: TurnTimerStatus;
            startedAt: Date;
          };
        }
    >(prisma.turnTimer.create);
    expect(result).toEqual({
      tableId: table.id,
      status: VirtualTableStatus.ACTIVE,
      startedAt: tableStartedAt.toISOString(),
      currentHandId: createdHand.id
    });
    expect(createHandCall?.data.handNumber).toBe(2);
    expect(createHandCall?.data.dealerSeatId).toBe("seat-2");
    expect(updateTableCall?.data.startedAt).toEqual(tableStartedAt);
    expect(updateTableCall?.data.currentHandId).toBe(createdHand.id);
    expect(createTurnTimerCall?.data.handId).toBe(createdHand.id);
    expect(createTurnTimerCall?.data.status).toBe(TurnTimerStatus.ACTIVE);
    expect(createTurnTimerCall?.data.startedAt).toEqual(createHandCall?.data.startedAt);
    expect(notifications.sendReminderNotification).not.toHaveBeenCalled();
    expect(notifications.sendTimeoutNotification).not.toHaveBeenCalled();
  });

  it("rejects manually starting the next hand while the completed result is still visible", async () => {
    const prisma = createPrismaMock();
    const table = createTableRecord({
      status: VirtualTableStatus.ACTIVE,
      currentHandId: "hand-1",
      seats: [
        createSeatRecord({
          id: "seat-1",
          userId: "user-1",
          role: VirtualSeatRole.OWNER
        }),
        createSeatRecord({
          id: "seat-2",
          userId: "user-2",
          seatNumber: 2
        })
      ]
    });
    const completedHand = createHandRecord({
      id: "hand-1",
      status: VirtualHandStatus.COMPLETED,
      completedAt: new Date()
    });

    prisma.virtualTable.findUnique.mockResolvedValue(table);
    prisma.virtualHand.findUnique.mockResolvedValue(completedHand);

    const service = new VirtualService(prisma as unknown as PrismaService);

    await expect(service.startNextHand(baseUser, table.id)).rejects.toMatchObject({
      status: HttpStatus.CONFLICT,
      response: {
        error: {
          code: VIRTUAL_ERROR_CODES.conflict,
          message: "Итог раздачи еще показывается"
        }
      }
    });
    expect(prisma.virtualHand.create).not.toHaveBeenCalled();
  });

  it("rejects starting the next hand while the current hand is still in progress", async () => {
    const prisma = createPrismaMock();
    const table = createTableRecord({
      status: VirtualTableStatus.ACTIVE,
      currentHandId: "hand-1",
      seats: [
        createSeatRecord({
          id: "seat-1",
          userId: "user-1",
          role: VirtualSeatRole.OWNER
        }),
        createSeatRecord({
          id: "seat-2",
          userId: "user-2",
          seatNumber: 2
        })
      ]
    });
    const hand = createHandRecord({
      id: "hand-1",
      status: VirtualHandStatus.IN_PROGRESS
    });

    prisma.virtualTable.findUnique.mockResolvedValue(table);
    prisma.virtualHand.findUnique.mockResolvedValue(hand);

    const service = new VirtualService(prisma as unknown as PrismaService);

    await expect(service.startNextHand(baseUser, table.id)).rejects.toMatchObject({
      status: HttpStatus.CONFLICT,
      response: {
        error: {
          code: VIRTUAL_ERROR_CODES.conflict,
          message: "Текущая раздача еще идет"
        }
      }
    });
    expect(prisma.virtualHand.create).not.toHaveBeenCalled();
  });

  it("rejects starting the next hand when fewer than two active seats have chips", async () => {
    const prisma = createPrismaMock();
    const table = createTableRecord({
      status: VirtualTableStatus.ACTIVE,
      currentHandId: "hand-1",
      seats: [
        createSeatRecord({
          id: "seat-1",
          userId: "user-1",
          role: VirtualSeatRole.OWNER,
          stackChips: 1000n
        }),
        createSeatRecord({
          id: "seat-2",
          userId: "user-2",
          seatNumber: 2,
          stackChips: 0n
        })
      ]
    });
    const completedHand = createHandRecord({
      id: "hand-1",
      status: VirtualHandStatus.COMPLETED,
      completedAt: new Date("2026-05-13T10:08:00.000Z")
    });

    prisma.virtualTable.findUnique.mockResolvedValue(table);
    prisma.virtualHand.findUnique.mockResolvedValue(completedHand);

    const service = new VirtualService(prisma as unknown as PrismaService);

    await expect(service.startNextHand(baseUser, table.id)).rejects.toMatchObject({
      status: HttpStatus.CONFLICT,
      response: {
        error: {
          code: VIRTUAL_ERROR_CODES.conflict,
          message: "Для старта нужны хотя бы два игрока"
        }
      }
    });
    expect(prisma.virtualHand.count).not.toHaveBeenCalled();
    expect(prisma.virtualHand.create).not.toHaveBeenCalled();
  });

  it("applies pending blind values to the next hand and clears them on the table", async () => {
    const prisma = createPrismaMock();
    const tableStartedAt = new Date("2026-05-13T10:00:00.000Z");
    const table = createTableRecord({
      status: VirtualTableStatus.ACTIVE,
      currentHandId: "hand-1",
      startedAt: tableStartedAt,
      smallBlindChips: 5n,
      bigBlindChips: 10n,
      pendingSmallBlindChips: 10n,
      pendingBigBlindChips: 20n,
      seats: [
        createSeatRecord({
          id: "seat-1",
          userId: "user-1",
          role: VirtualSeatRole.OWNER
        }),
        createSeatRecord({
          id: "seat-2",
          userId: "user-2",
          seatNumber: 2
        })
      ]
    });
    const completedHand = createHandRecord({
      id: "hand-1",
      status: VirtualHandStatus.COMPLETED,
      dealerSeatId: "seat-1",
      currentActorSeatId: null,
      completedAt: new Date("2026-05-13T10:08:00.000Z")
    });
    const createdHand = createHandRecord({
      id: "hand-2"
    });

    prisma.virtualTable.findUnique.mockResolvedValue(table);
    prisma.virtualHand.findUnique.mockResolvedValue(completedHand);
    prisma.virtualHand.count.mockResolvedValue(1);
    prisma.virtualHand.create.mockResolvedValue(createdHand);
    prisma.$transaction.mockImplementation(async (callback: (tx: MockPrisma) => Promise<VirtualHand>) =>
      callback(prisma)
    );

    const service = new VirtualService(prisma as unknown as PrismaService);

    await service.startNextHand(baseUser, table.id);

    const createHandCall = getFirstCall<
      | {
          data: {
            smallBlindChips: bigint;
            bigBlindChips: bigint;
          };
        }
    >(prisma.virtualHand.create);
    const updateTableCall = getFirstCall<
      | {
          data: {
            smallBlindChips: bigint;
            bigBlindChips: bigint;
            pendingSmallBlindChips: null;
            pendingBigBlindChips: null;
          };
        }
    >(prisma.virtualTable.update);

    expect(createHandCall?.data.smallBlindChips).toBe(10n);
    expect(createHandCall?.data.bigBlindChips).toBe(20n);
    expect(updateTableCall?.data.smallBlindChips).toBe(10n);
    expect(updateTableCall?.data.bigBlindChips).toBe(20n);
    expect(updateTableCall?.data.pendingSmallBlindChips).toBeNull();
    expect(updateTableCall?.data.pendingBigBlindChips).toBeNull();
  });

  it("rejects actions from a non-current actor", async () => {
    const prisma = createPrismaMock();
    const table = createTableRecord({
      status: VirtualTableStatus.ACTIVE,
      currentHandId: "hand-1",
      seats: [
        createSeatRecord({
          id: "seat-1",
          userId: "user-1"
        }),
        createSeatRecord({
          id: "seat-2",
          userId: "user-2"
        })
      ]
    });
    const hand = createHandRecord({
      id: "hand-1",
      currentActorSeatId: "seat-2",
      players: [
        createHandPlayerRecord({
          seatId: "seat-1",
          seat: table.seats[0]!,
          privateCard1: "AS",
          privateCard2: "KH"
        }),
        createHandPlayerRecord({
          seatId: "seat-2",
          seat: table.seats[1]!,
          privateCard1: "QC",
          privateCard2: "QD"
        })
      ]
    });

    prisma.virtualTable.findUnique.mockResolvedValue(table);
    prisma.virtualHand.findUnique.mockResolvedValue(hand);

    const service = new VirtualService(prisma as unknown as PrismaService);

    await expect(
      service.submitAction(baseUser, table.id, {
        handId: "hand-1",
        actionType: "CALL",
        idempotencyKey: "idem-1"
      })
    ).rejects.toMatchObject({
      status: HttpStatus.CONFLICT,
      response: {
        error: {
          code: "VIRTUAL_ACTION_NOT_ALLOWED"
        }
      }
    });
  });

  it("persists a legal call action and updates hand state", async () => {
    const prisma = createPrismaMock();
    const table = createTableRecord({
      status: VirtualTableStatus.ACTIVE,
      currentHandId: "hand-1",
      seats: [
        createSeatRecord({
          id: "seat-1",
          userId: "user-1",
          seatNumber: 1
        }),
        createSeatRecord({
          id: "seat-2",
          userId: "user-2",
          seatNumber: 2
        })
      ]
    });
    const hand = createHandRecord({
      id: "hand-1",
      currentActorSeatId: "seat-1",
      currentBetChips: 10n,
      minRaiseChips: 10n,
      potTotalChips: 15n,
      players: [
        createHandPlayerRecord({
          seatId: "seat-1",
          seat: table.seats[0]!,
          currentStackChips: 995n,
          committedTotalChips: 5n,
          committedStreetChips: 5n,
          privateCard1: "AS",
          privateCard2: "KH"
        }),
        createHandPlayerRecord({
          seatId: "seat-2",
          seat: table.seats[1]!,
          currentStackChips: 990n,
          committedTotalChips: 10n,
          committedStreetChips: 10n,
          hasActedThisStreet: true,
          privateCard1: "QC",
          privateCard2: "QD"
        })
      ]
    });

    prisma.virtualTable.findUnique.mockResolvedValue(table);
    prisma.virtualHand.findUnique.mockResolvedValue(hand);
    prisma.$transaction.mockImplementation(async (callback: (tx: MockPrisma) => Promise<void>) =>
      callback(prisma)
    );

    const service = new VirtualService(prisma as unknown as PrismaService);

    const result = await service.submitAction(baseUser, table.id, {
      handId: "hand-1",
      actionType: "CALL",
      idempotencyKey: "idem-1"
    });

    expect(result.actionType).toBe("CALL");
    expect(result.amountChips).toBe("5");
    const createActionCall = getFirstCall<
      | {
          data: {
            tableId: string;
            handId: string;
            seatId: string;
            idempotencyKey: string;
            actorType: string;
            actionType: ActionType;
            amountChips: bigint;
            metadataJson: {
              idempotencyKey: string;
            };
          };
        }
    >(prisma.virtualAction.create);
    const updateHandCall = getFirstCall<
      | {
          where: {
            id: string;
          };
          data: {
            currentStreet: Street;
            currentBetChips: bigint;
            potTotalChips: bigint;
          };
        }
    >(prisma.virtualHand.update);
    const createBoardCall = getFirstCall<
      | {
          data: Array<{
            handId: string;
            street: Street;
            card: string;
            position: number;
          }>;
        }
    >(prisma.communityCard.createMany);

    expect(createActionCall?.data.tableId).toBe(table.id);
    expect(createActionCall?.data.handId).toBe(hand.id);
    expect(createActionCall?.data.seatId).toBe("seat-1");
    expect(createActionCall?.data.idempotencyKey).toBe("idem-1");
    expect(createActionCall?.data.actorType).toBe("PLAYER");
    expect(createActionCall?.data.actionType).toBe(ActionType.CALL);
    expect(createActionCall?.data.amountChips).toBe(5n);
    expect(createActionCall?.data.metadataJson.idempotencyKey).toBe("idem-1");
    expect(updateHandCall?.where.id).toBe(hand.id);
    expect(updateHandCall?.data.currentStreet).toBe(Street.FLOP);
    expect(updateHandCall?.data.currentBetChips).toBe(0n);
    expect(updateHandCall?.data.potTotalChips).toBe(20n);
    const resolveTimerCall = findCall<TurnTimerUpdateManyCall>(
      prisma.turnTimer.updateMany,
      (call) => call.data.resolutionType === TurnTimerResolution.PLAYER_ACTION
    );
    const nextTimerCall = getFirstCall<
      | {
          data: {
            handId: string;
            seatId: string;
            status: TurnTimerStatus;
          };
        }
    >(prisma.turnTimer.create);

    expect(resolveTimerCall?.where.handId).toBe(hand.id);
    expect(resolveTimerCall?.where.seatId).toBe("seat-1");
    expect(resolveTimerCall?.data.status).toBe(TurnTimerStatus.RESOLVED);
    expect(resolveTimerCall?.data.resolutionType).toBe(TurnTimerResolution.PLAYER_ACTION);
    expect(nextTimerCall?.data.handId).toBe(hand.id);
    expect(nextTimerCall?.data.seatId).toBe(result.nextActorSeatId);
    expect(nextTimerCall?.data.status).toBe(TurnTimerStatus.ACTIVE);
    expect(createBoardCall?.data).toHaveLength(3);
    expect(createBoardCall?.data.every((card) => card.handId === hand.id)).toBe(true);
    expect(createBoardCall?.data.every((card) => card.street === Street.FLOP)).toBe(true);
    expect(createBoardCall?.data.map((card) => card.position)).toEqual([0, 1, 2]);
    expect(createBoardCall?.data.every((card) => typeof card.card === "string")).toBe(true);
    expect(prisma.onlinePlayerStats.findMany).not.toHaveBeenCalled();
    expect(prisma.onlinePlayerStats.upsert).not.toHaveBeenCalled();
  });

  it("updates online stats for all players when a submitted action completes the hand", async () => {
    const prisma = createPrismaMock();
    const table = createTableRecord({
      status: VirtualTableStatus.ACTIVE,
      currentHandId: "hand-1",
      seats: [
        createSeatRecord({
          id: "seat-1",
          userId: "user-1",
          seatNumber: 1
        }),
        createSeatRecord({
          id: "seat-2",
          userId: "user-2",
          seatNumber: 2
        })
      ]
    });
    const hand = createHandRecord({
      id: "hand-1",
      currentActorSeatId: "seat-1",
      currentBetChips: 10n,
      minRaiseChips: 10n,
      potTotalChips: 15n,
      players: [
        createHandPlayerRecord({
          seatId: "seat-1",
          seat: table.seats[0]!,
          currentStackChips: 995n,
          committedTotalChips: 5n,
          committedStreetChips: 5n,
          privateCard1: "AS",
          privateCard2: "KH"
        }),
        createHandPlayerRecord({
          id: "hand-player-2",
          seatId: "seat-2",
          seat: table.seats[1]!,
          currentStackChips: 990n,
          committedTotalChips: 10n,
          committedStreetChips: 10n,
          hasActedThisStreet: true,
          privateCard1: "QC",
          privateCard2: "QD"
        })
      ]
    });
    prisma.virtualTable.findUnique.mockResolvedValue(table);
    prisma.virtualHand.findUnique.mockResolvedValue(hand);
    prisma.onlinePlayerStats.findMany.mockResolvedValue([]);
    prisma.$transaction.mockImplementation(async (callback: (tx: MockPrisma) => Promise<void>) =>
      callback(prisma)
    );

    const service = new VirtualService(prisma as unknown as PrismaService);

    const result = await service.submitAction(baseUser, table.id, {
      handId: "hand-1",
      actionType: "FOLD",
      idempotencyKey: "idem-fold-complete"
    });

    expect(result.handStatus).toBe(VirtualHandStatus.COMPLETED);
    expect(result.nextActorSeatId).toBeNull();
    expect(prisma.onlinePlayerStats.findMany).toHaveBeenCalledWith({
      where: {
        userId: {
          in: ["user-1", "user-2"]
        }
      }
    });
    expect(prisma.virtualTable.updateMany).not.toHaveBeenCalled();
    expect(prisma.virtualHand.create).not.toHaveBeenCalled();
    expect(prisma.onlinePlayerStats.upsert).toHaveBeenCalledTimes(2);
    expect(prisma.onlinePlayerStats.upsert).toHaveBeenNthCalledWith(1, {
      where: {
        userId: "user-1"
      },
      create: {
        userId: "user-1",
        handsPlayed: 1,
        handsWon: 0,
        totalChipsWon: 0n,
        totalChipsLost: 5n,
        netChips: -5n,
        netEstimatedMinor: -50n,
        bigBlindsWon: 0n,
        bbPer100Bps: 0,
        winRateBps: 0,
        avgChipsPerHand: -5n,
        onlinePokerScore: 0
      },
      update: {
        handsPlayed: 1,
        handsWon: 0,
        totalChipsWon: 0n,
        totalChipsLost: 5n,
        netChips: -5n,
        netEstimatedMinor: -50n,
        bigBlindsWon: 0n,
        bbPer100Bps: 0,
        winRateBps: 0,
        avgChipsPerHand: -5n,
        onlinePokerScore: 0
      }
    });
    expect(prisma.onlinePlayerStats.upsert).toHaveBeenNthCalledWith(2, {
      where: {
        userId: "user-2"
      },
      create: {
        userId: "user-2",
        handsPlayed: 1,
        handsWon: 1,
        totalChipsWon: 5n,
        totalChipsLost: 0n,
        netChips: 5n,
        netEstimatedMinor: 50n,
        bigBlindsWon: 0n,
        bbPer100Bps: 0,
        winRateBps: 10_000,
        avgChipsPerHand: 5n,
        onlinePokerScore: 70
      },
      update: {
        handsPlayed: 1,
        handsWon: 1,
        totalChipsWon: 5n,
        totalChipsLost: 0n,
        netChips: 5n,
        netEstimatedMinor: 50n,
        bigBlindsWon: 0n,
        bbPer100Bps: 0,
        winRateBps: 10_000,
        avgChipsPerHand: 5n,
        onlinePokerScore: 70
      }
    });
  });

  it("persists showdown board, pots, awards and stats when a river check completes the hand", async () => {
    const prisma = createPrismaMock();
    const board = ["2C", "7D", "9H", "TC", "3S"] as const;
    const table = createTableRecord({
      status: VirtualTableStatus.ACTIVE,
      currentHandId: "hand-1",
      seats: [
        createSeatRecord({
          id: "seat-1",
          userId: baseUser.id,
          seatNumber: 1
        }),
        createSeatRecord({
          id: "seat-2",
          userId: "user-2",
          seatNumber: 2
        })
      ]
    });
    const hand = createHandRecord({
      id: "hand-1",
      currentStreet: Street.RIVER,
      currentActorSeatId: "seat-1",
      currentBetChips: 0n,
      minRaiseChips: 10n,
      potTotalChips: 20n,
      communityCards: board.map((card, index) =>
        createCommunityCardRecord({
          id: `community-card-${index + 1}`,
          street:
            index < 3 ? Street.FLOP : index === 3 ? Street.TURN : Street.RIVER,
          card,
          position: index
        })
      ),
      players: [
        createHandPlayerRecord({
          seatId: "seat-1",
          seat: table.seats[0]!,
          currentStackChips: 990n,
          committedTotalChips: 10n,
          committedStreetChips: 0n,
          privateCard1: "AS",
          privateCard2: "KH"
        }),
        createHandPlayerRecord({
          id: "hand-player-2",
          seatId: "seat-2",
          seat: table.seats[1]!,
          currentStackChips: 990n,
          committedTotalChips: 10n,
          committedStreetChips: 0n,
          hasActedThisStreet: true,
          privateCard1: "QC",
          privateCard2: "QD"
        })
      ]
    });
    prisma.virtualTable.findUnique.mockResolvedValue(table);
    prisma.virtualHand.findUnique.mockResolvedValue(hand);
    prisma.onlinePlayerStats.findMany.mockResolvedValue([]);
    prisma.$transaction.mockImplementation(async (callback: (tx: MockPrisma) => Promise<void>) =>
      callback(prisma)
    );

    const service = new VirtualService(prisma as unknown as PrismaService);

    const result = await service.submitAction(baseUser, table.id, {
      handId: hand.id,
      actionType: "CHECK",
      idempotencyKey: "idem-river-check-showdown"
    });

    const updateHandCall = getFirstCall<{
      data: {
        status: VirtualHandStatus;
        currentStreet: Street;
        potTotalChips: bigint;
        completedAt: Date | null;
      };
    }>(prisma.virtualHand.update);
    const createBoardCall = getFirstCall<{
      data: Array<{
        handId: string;
        street: Street;
        card: string;
        position: number;
      }>;
    }>(prisma.communityCard.createMany);
    const potCreateCall = getFirstCall<{
      data: {
        amountChips: bigint;
        eligibleSeatIdsJson: string[];
        awardedAt: Date | null;
        awards: {
          create: Array<{
            winnerSeatId: string;
            amountChips: bigint;
            handRankJson: unknown;
          }>;
        };
      };
    }>(prisma.virtualPot.create);
    const updatedPlayerStacks = getCalls<{ data: { currentStackChips: bigint } }>(
      prisma.virtualHandPlayer.update
    ).map((call) => call.data.currentStackChips);

    expect(result.handStatus).toBe(VirtualHandStatus.COMPLETED);
    expect(result.nextActorSeatId).toBeNull();
    expect(updateHandCall?.data.status).toBe(VirtualHandStatus.COMPLETED);
    expect(updateHandCall?.data.currentStreet).toBe(Street.SHOWDOWN);
    expect(updateHandCall?.data.potTotalChips).toBe(0n);
    expect(updateHandCall?.data.completedAt).toBeInstanceOf(Date);
    expect(createBoardCall?.data).toHaveLength(5);
    expect(createBoardCall?.data.map((card) => card.card)).toEqual([...board]);
    expect(potCreateCall?.data.amountChips).toBe(20n);
    expect(potCreateCall?.data.eligibleSeatIdsJson).toEqual(["seat-1", "seat-2"]);
    expect(potCreateCall?.data.awardedAt).toBeInstanceOf(Date);
    expect(potCreateCall?.data.awards.create).toHaveLength(1);
    expect(potCreateCall?.data.awards.create[0]?.winnerSeatId).toBe("seat-2");
    expect(potCreateCall?.data.awards.create[0]?.amountChips).toBe(20n);
    expect(potCreateCall?.data.awards.create[0]?.handRankJson).not.toBeNull();
    expect(updatedPlayerStacks).toEqual(expect.arrayContaining([990n, 1010n]));
    expect(prisma.virtualTable.updateMany).not.toHaveBeenCalled();
    expect(prisma.virtualHand.create).not.toHaveBeenCalled();
    expect(prisma.onlinePlayerStats.upsert).toHaveBeenCalledTimes(2);
  });

  it("does not auto-start the next hand after completion when fewer than two eligible seats still have chips", async () => {
    const prisma = createPrismaMock();
    const table = createTableRecord({
      status: VirtualTableStatus.ACTIVE,
      currentHandId: "hand-1",
      seats: [
        createSeatRecord({
          id: "seat-1",
          userId: baseUser.id,
          seatNumber: 1
        }),
        createSeatRecord({
          id: "seat-2",
          userId: "user-2",
          seatNumber: 2
        }),
        createSeatRecord({
          id: "seat-3",
          userId: "user-3",
          seatNumber: 3,
          stackChips: 0n,
          user: createUserRecord({ id: "user-3", telegramId: "300", username: "user3" })
        })
      ]
    });
    const completedTable = createTableRecord({
      ...table,
      seats: [
        createSeatRecord({
          ...table.seats[0]!,
          stackChips: 0n
        }),
        createSeatRecord({
          ...table.seats[1]!,
          stackChips: 1015n
        }),
        createSeatRecord({
          ...table.seats[2]!
        })
      ]
    });
    const hand = createHandRecord({
      id: "hand-1",
      currentActorSeatId: "seat-1",
      currentBetChips: 10n,
      minRaiseChips: 10n,
      potTotalChips: 15n,
      players: [
        createHandPlayerRecord({
          seatId: "seat-1",
          seat: table.seats[0]!,
          currentStackChips: 5n,
          committedTotalChips: 995n,
          committedStreetChips: 5n,
          privateCard1: "AS",
          privateCard2: "KH"
        }),
        createHandPlayerRecord({
          id: "hand-player-2",
          seatId: "seat-2",
          seat: table.seats[1]!,
          currentStackChips: 990n,
          committedTotalChips: 10n,
          committedStreetChips: 10n,
          hasActedThisStreet: true,
          privateCard1: "QC",
          privateCard2: "QD"
        })
      ]
    });
    prisma.virtualTable.findUnique.mockResolvedValueOnce(table).mockResolvedValue(completedTable);
    prisma.virtualHand.findUnique.mockResolvedValue(hand);
    prisma.onlinePlayerStats.findMany.mockResolvedValue([]);
    prisma.$transaction.mockImplementation(async (callback: (tx: MockPrisma) => Promise<void>) =>
      callback(prisma)
    );

    const service = new VirtualService(prisma as unknown as PrismaService);

    const result = await service.submitAction(baseUser, table.id, {
      handId: "hand-1",
      actionType: "FOLD",
      idempotencyKey: "idem-fold-no-auto-next-hand"
    });

    expect(result.handStatus).toBe(VirtualHandStatus.COMPLETED);
    expect(prisma.virtualTable.updateMany).not.toHaveBeenCalled();
    expect(prisma.virtualHand.create).not.toHaveBeenCalled();
  });

  it("does not start the next hand before completed hand reveal delay passes", async () => {
    const prisma = createPrismaMock();
    const table = createTableRecord({
      status: VirtualTableStatus.ACTIVE,
      currentHandId: "hand-1",
      seats: [
        createSeatRecord({
          id: "seat-1",
          userId: baseUser.id,
          seatNumber: 1,
          role: VirtualSeatRole.OWNER,
          stackChips: 995n
        }),
        createSeatRecord({
          id: "seat-2",
          userId: "user-2",
          seatNumber: 2,
          stackChips: 1005n
        }),
        createSeatRecord({
          id: "seat-3",
          userId: "user-3",
          seatNumber: 3,
          stackChips: 0n,
          user: createUserRecord({ id: "user-3", telegramId: "300", username: "user3" })
        }),
        createSeatRecord({
          id: "seat-4",
          userId: "user-4",
          seatNumber: 4,
          status: VirtualSeatStatus.SITTING_OUT,
          stackChips: 1000n,
          user: createUserRecord({ id: "user-4", telegramId: "400", username: "user4" })
        })
      ]
    });
    const hand = createHandRecord({
      id: "hand-1",
      status: VirtualHandStatus.COMPLETED,
      currentActorSeatId: null,
      currentStreet: Street.SHOWDOWN,
      completedAt: new Date("2026-05-13T10:06:00.000Z")
    });

    prisma.virtualTable.findMany.mockResolvedValue([table]);
    prisma.virtualHand.findUnique.mockResolvedValue(hand);

    const service = new VirtualService(prisma as unknown as PrismaService);

    await service.processDueCompletedHands(new Date("2026-05-13T10:06:09.000Z"));

    expect(prisma.virtualHand.create).not.toHaveBeenCalled();
    expect(prisma.virtualTable.updateMany).not.toHaveBeenCalled();
  });

  it("starts the next hand after completed hand reveal delay using only eligible seats with chips", async () => {
    const prisma = createPrismaMock();
    const tableStartedAt = new Date("2026-05-13T10:00:00.000Z");
    const table = createTableRecord({
      status: VirtualTableStatus.ACTIVE,
      currentHandId: "hand-1",
      startedAt: tableStartedAt,
      seats: [
        createSeatRecord({
          id: "seat-1",
          userId: baseUser.id,
          seatNumber: 1,
          role: VirtualSeatRole.OWNER,
          stackChips: 995n
        }),
        createSeatRecord({
          id: "seat-2",
          userId: "user-2",
          seatNumber: 2,
          stackChips: 1005n
        }),
        createSeatRecord({
          id: "seat-3",
          userId: "user-3",
          seatNumber: 3,
          stackChips: 0n,
          user: createUserRecord({
            id: "user-3",
            telegramId: "300",
            username: "user3",
            firstName: null
          })
        }),
        createSeatRecord({
          id: "seat-4",
          userId: "user-4",
          seatNumber: 4,
          status: VirtualSeatStatus.SITTING_OUT,
          stackChips: 1000n,
          user: createUserRecord({
            id: "user-4",
            telegramId: "400",
            username: "user4",
            firstName: null
          })
        })
      ]
    });
    const completedHand = createHandRecord({
      id: "hand-1",
      status: VirtualHandStatus.COMPLETED,
      dealerSeatId: "seat-1",
      currentActorSeatId: null,
      currentStreet: Street.SHOWDOWN,
      completedAt: new Date("2026-05-13T10:06:00.000Z")
    });
    const nextHand = createHandRecord({
      id: "hand-2",
      handNumber: 2
    });

    prisma.virtualTable.findMany.mockResolvedValue([table]);
    prisma.virtualTable.findUnique.mockResolvedValue(table);
    prisma.virtualHand.findUnique.mockResolvedValue(completedHand);
    prisma.virtualTable.updateMany.mockResolvedValue({ count: 1 });
    prisma.virtualHand.count.mockResolvedValue(1);
    prisma.virtualHand.create.mockResolvedValue(nextHand);
    prisma.$transaction.mockImplementation(
      async (callback: (tx: MockPrisma) => Promise<unknown>) => callback(prisma)
    );

    const service = new VirtualService(prisma as unknown as PrismaService);

    await service.processDueCompletedHands(new Date("2026-05-13T10:06:10.000Z"));

    const createPlayersCall = getFirstCall<{
      data: Array<{
        seatId: string;
      }>;
    }>(prisma.virtualHandPlayer.createMany);

    expect(prisma.virtualTable.updateMany).toHaveBeenCalledWith({
      where: {
        id: table.id,
        status: VirtualTableStatus.ACTIVE,
        currentHandId: completedHand.id
      },
      data: {
        currentHandId: null
      }
    });
    expect(createPlayersCall?.data.map((player) => player.seatId)).toEqual(["seat-1", "seat-2"]);
  });

  it("honors CAS when processing due completed hands", async () => {
    const prisma = createPrismaMock();
    const table = createTableRecord({
      status: VirtualTableStatus.ACTIVE,
      currentHandId: "hand-1",
      seats: [
        createSeatRecord({
          id: "seat-1",
          userId: baseUser.id,
          seatNumber: 1,
          role: VirtualSeatRole.OWNER
        }),
        createSeatRecord({
          id: "seat-2",
          userId: "user-2",
          seatNumber: 2
        })
      ]
    });
    const completedHand = createHandRecord({
      id: "hand-1",
      status: VirtualHandStatus.COMPLETED,
      dealerSeatId: "seat-1",
      currentActorSeatId: null,
      completedAt: new Date("2026-05-13T10:06:00.000Z")
    });

    prisma.virtualTable.findMany.mockResolvedValue([table]);
    prisma.virtualTable.findUnique.mockResolvedValue(table);
    prisma.virtualHand.findUnique.mockResolvedValue(completedHand);
    prisma.virtualTable.updateMany.mockResolvedValue({ count: 0 });
    prisma.$transaction.mockImplementation(
      async (callback: (tx: MockPrisma) => Promise<unknown>) => callback(prisma)
    );

    const service = new VirtualService(prisma as unknown as PrismaService);

    await service.processDueCompletedHands(new Date("2026-05-13T10:06:10.000Z"));

    expect(prisma.virtualHand.create).not.toHaveBeenCalled();
  });

  it("does not start a delayed next hand when fewer than two eligible seats have chips", async () => {
    const prisma = createPrismaMock();
    const table = createTableRecord({
      status: VirtualTableStatus.ACTIVE,
      currentHandId: "hand-1",
      seats: [
        createSeatRecord({
          id: "seat-1",
          userId: baseUser.id,
          seatNumber: 1,
          role: VirtualSeatRole.OWNER,
          stackChips: 0n
        }),
        createSeatRecord({
          id: "seat-2",
          userId: "user-2",
          seatNumber: 2,
          stackChips: 1005n
        }),
        createSeatRecord({
          id: "seat-3",
          userId: "user-3",
          seatNumber: 3,
          status: VirtualSeatStatus.SITTING_OUT,
          stackChips: 1000n,
          user: createUserRecord({
            id: "user-3",
            telegramId: "300",
            username: "user3",
            firstName: null
          })
        })
      ]
    });
    const completedHand = createHandRecord({
      id: "hand-1",
      status: VirtualHandStatus.COMPLETED,
      currentActorSeatId: null,
      completedAt: new Date("2026-05-13T10:06:00.000Z")
    });

    prisma.virtualTable.findMany.mockResolvedValue([table]);
    prisma.virtualHand.findUnique.mockResolvedValue(completedHand);

    const service = new VirtualService(prisma as unknown as PrismaService);

    await service.processDueCompletedHands(new Date("2026-05-13T10:06:10.000Z"));

    expect(prisma.virtualTable.updateMany).not.toHaveBeenCalled();
    expect(prisma.virtualHand.create).not.toHaveBeenCalled();
  });

  it("persists multiple side pots and awards without losing chips when an all-in completes showdown", async () => {
    const prisma = createPrismaMock();
    const table = createTableRecord({
      status: VirtualTableStatus.ACTIVE,
      currentHandId: "hand-1",
      seats: [
        createSeatRecord({
          id: "seat-1",
          userId: "user-2",
          seatNumber: 1,
          stackChips: 0n,
          user: createUserRecord({ id: "user-2", telegramId: "200", username: "user2" })
        }),
        createSeatRecord({
          id: "seat-2",
          userId: "user-3",
          seatNumber: 2,
          stackChips: 0n,
          user: createUserRecord({ id: "user-3", telegramId: "300", username: "user3" })
        }),
        createSeatRecord({
          id: "seat-3",
          userId: baseUser.id,
          seatNumber: 3,
          stackChips: 10n,
          user: createUserRecord({ id: baseUser.id })
        })
      ]
    });
    const hand = createHandRecord({
      id: "hand-1",
      currentStreet: Street.RIVER,
      currentActorSeatId: "seat-3",
      currentBetChips: 100n,
      minRaiseChips: 50n,
      potTotalChips: 240n,
      communityCards: [
        createCommunityCardRecord({
          id: "community-card-1",
          street: Street.FLOP,
          card: "2C",
          position: 0
        }),
        createCommunityCardRecord({
          id: "community-card-2",
          street: Street.FLOP,
          card: "7D",
          position: 1
        }),
        createCommunityCardRecord({
          id: "community-card-3",
          street: Street.FLOP,
          card: "9H",
          position: 2
        }),
        createCommunityCardRecord({
          id: "community-card-4",
          street: Street.TURN,
          card: "TC",
          position: 3
        }),
        createCommunityCardRecord({
          id: "community-card-5",
          street: Street.RIVER,
          card: "3S",
          position: 4
        })
      ],
      players: [
        createHandPlayerRecord({
          seatId: "seat-1",
          seat: table.seats[0]!,
          status: HandPlayerStatus.ALL_IN,
          startingStackChips: 50n,
          currentStackChips: 0n,
          committedTotalChips: 50n,
          committedStreetChips: 50n,
          hasActedThisStreet: true,
          privateCard1: "AH",
          privateCard2: "AD"
        }),
        createHandPlayerRecord({
          id: "hand-player-2",
          seatId: "seat-2",
          seat: table.seats[1]!,
          status: HandPlayerStatus.ALL_IN,
          startingStackChips: 100n,
          currentStackChips: 0n,
          committedTotalChips: 100n,
          committedStreetChips: 100n,
          hasActedThisStreet: true,
          privateCard1: "KS",
          privateCard2: "KD"
        }),
        createHandPlayerRecord({
          id: "hand-player-3",
          seatId: "seat-3",
          seat: table.seats[2]!,
          startingStackChips: 100n,
          currentStackChips: 10n,
          committedTotalChips: 90n,
          committedStreetChips: 90n,
          privateCard1: "QS",
          privateCard2: "QD"
        })
      ]
    });

    prisma.virtualTable.findUnique.mockResolvedValue(table);
    prisma.virtualHand.findUnique.mockResolvedValue(hand);
    prisma.onlinePlayerStats.findMany.mockResolvedValue([]);
    prisma.$transaction.mockImplementation(async (callback: (tx: MockPrisma) => Promise<void>) =>
      callback(prisma)
    );

    const service = new VirtualService(prisma as unknown as PrismaService);

    const result = await service.submitAction(baseUser, table.id, {
      handId: hand.id,
      actionType: "ALL_IN",
      idempotencyKey: "idem-all-in-side-pots"
    });

    const potCreateCalls = getCalls<{
      data: {
        amountChips: bigint;
        eligibleSeatIdsJson: string[];
        awards: {
          create: Array<{
            winnerSeatId: string;
            amountChips: bigint;
            handRankJson: unknown;
          }>;
        };
      };
    }>(prisma.virtualPot.create);
    const totalPersistedPotAmount = potCreateCalls.reduce(
      (sum, call) => sum + call.data.amountChips,
      0n
    );
    const totalAwardedAmount = potCreateCalls.reduce(
      (sum, call) =>
        sum +
        call.data.awards.create.reduce((awardSum, award) => awardSum + award.amountChips, 0n),
      0n
    );

    expect(result.handStatus).toBe(VirtualHandStatus.COMPLETED);
    expect(result.nextActorSeatId).toBeNull();
    expect(prisma.virtualPot.create).toHaveBeenCalledTimes(2);
    expect(potCreateCalls[0]?.data.amountChips).toBe(150n);
    expect(potCreateCalls[0]?.data.eligibleSeatIdsJson).toEqual([
      "seat-1",
      "seat-2",
      "seat-3"
    ]);
    expect(potCreateCalls[0]?.data.awards.create).toHaveLength(1);
    expect(potCreateCalls[0]?.data.awards.create[0]?.winnerSeatId).toBe("seat-1");
    expect(potCreateCalls[0]?.data.awards.create[0]?.amountChips).toBe(150n);
    expect(potCreateCalls[0]?.data.awards.create[0]?.handRankJson).not.toBeNull();
    expect(potCreateCalls[1]?.data.amountChips).toBe(100n);
    expect(potCreateCalls[1]?.data.eligibleSeatIdsJson).toEqual(["seat-2", "seat-3"]);
    expect(potCreateCalls[1]?.data.awards.create).toHaveLength(1);
    expect(potCreateCalls[1]?.data.awards.create[0]?.winnerSeatId).toBe("seat-2");
    expect(potCreateCalls[1]?.data.awards.create[0]?.amountChips).toBe(100n);
    expect(potCreateCalls[1]?.data.awards.create[0]?.handRankJson).not.toBeNull();
    expect(totalPersistedPotAmount).toBe(250n);
    expect(totalAwardedAmount).toBe(250n);
    expect(
      potCreateCalls.flatMap((call) => call.data.awards.create).some((award) => award.winnerSeatId === "seat-3")
    ).toBe(false);
    expect(prisma.onlinePlayerStats.upsert).toHaveBeenCalledTimes(3);
  });

  it("persists split-pot awards that preserve the total pot amount", async () => {
    const prisma = createPrismaMock();
    const table = createTableRecord({
      status: VirtualTableStatus.ACTIVE,
      currentHandId: "hand-1",
      seats: [
        createSeatRecord({
          id: "seat-folded",
          userId: "user-3",
          seatNumber: 1,
          stackChips: 99n,
          user: createUserRecord({ id: "user-3", telegramId: "300", username: "user3" })
        }),
        createSeatRecord({
          id: "seat-10",
          userId: baseUser.id,
          seatNumber: 2
        }),
        createSeatRecord({
          id: "seat-2",
          userId: "user-2",
          seatNumber: 3
        })
      ]
    });
    const hand = createHandRecord({
      id: "hand-1",
      currentStreet: Street.RIVER,
      currentActorSeatId: "seat-10",
      currentBetChips: 0n,
      minRaiseChips: 10n,
      potTotalChips: 101n,
      communityCards: [
        createCommunityCardRecord({
          id: "community-card-1",
          street: Street.FLOP,
          card: "AS",
          position: 0
        }),
        createCommunityCardRecord({
          id: "community-card-2",
          street: Street.FLOP,
          card: "KH",
          position: 1
        }),
        createCommunityCardRecord({
          id: "community-card-3",
          street: Street.FLOP,
          card: "7C",
          position: 2
        }),
        createCommunityCardRecord({
          id: "community-card-4",
          street: Street.TURN,
          card: "4D",
          position: 3
        }),
        createCommunityCardRecord({
          id: "community-card-5",
          street: Street.RIVER,
          card: "2S",
          position: 4
        })
      ],
      players: [
        createHandPlayerRecord({
          seatId: "seat-folded",
          seat: table.seats[0]!,
          status: HandPlayerStatus.FOLDED,
          startingStackChips: 100n,
          currentStackChips: 99n,
          committedTotalChips: 1n,
          committedStreetChips: 0n,
          hasActedThisStreet: true
        }),
        createHandPlayerRecord({
          seatId: "seat-10",
          seat: table.seats[1]!,
          startingStackChips: 100n,
          currentStackChips: 50n,
          committedTotalChips: 50n,
          committedStreetChips: 0n,
          privateCard1: "AH",
          privateCard2: "KD"
        }),
        createHandPlayerRecord({
          id: "hand-player-2",
          seatId: "seat-2",
          seat: table.seats[2]!,
          startingStackChips: 100n,
          currentStackChips: 50n,
          committedTotalChips: 50n,
          committedStreetChips: 0n,
          hasActedThisStreet: true,
          privateCard1: "AD",
          privateCard2: "KC"
        })
      ]
    });

    prisma.virtualTable.findUnique.mockResolvedValue(table);
    prisma.virtualHand.findUnique.mockResolvedValue(hand);
    prisma.onlinePlayerStats.findMany.mockResolvedValue([]);
    prisma.$transaction.mockImplementation(async (callback: (tx: MockPrisma) => Promise<void>) =>
      callback(prisma)
    );

    const service = new VirtualService(prisma as unknown as PrismaService);

    const result = await service.submitAction(baseUser, table.id, {
      handId: hand.id,
      actionType: "CHECK",
      idempotencyKey: "idem-split-pot-river-check"
    });

    const potCreateCalls = getCalls<{
      data: {
        amountChips: bigint;
        eligibleSeatIdsJson: string[];
        awards: {
          create: Array<{
            winnerSeatId: string;
            amountChips: bigint;
            handRankJson: unknown;
          }>;
        };
      };
    }>(prisma.virtualPot.create);
    const totalAwardedAmount = potCreateCalls.reduce(
      (sum, call) =>
        sum +
        call.data.awards.create.reduce((awardSum, award) => awardSum + award.amountChips, 0n),
      0n
    );
    const awardsByWinner = potCreateCalls
      .flatMap((call) => call.data.awards.create)
      .reduce<Record<string, bigint>>((accumulator, award) => {
        accumulator[award.winnerSeatId] =
          (accumulator[award.winnerSeatId] ?? 0n) + award.amountChips;

        return accumulator;
      }, {});

    expect(result.handStatus).toBe(VirtualHandStatus.COMPLETED);
    expect(prisma.virtualPot.create).toHaveBeenCalledTimes(2);
    expect(potCreateCalls[0]?.data.amountChips).toBe(3n);
    expect(potCreateCalls[0]?.data.eligibleSeatIdsJson).toEqual(["seat-10", "seat-2"]);
    expect(potCreateCalls[1]?.data.amountChips).toBe(98n);
    expect(potCreateCalls[1]?.data.eligibleSeatIdsJson).toEqual(["seat-10", "seat-2"]);
    expect(totalAwardedAmount).toBe(101n);
    expect(awardsByWinner["seat-10"]).toBe(51n);
    expect(awardsByWinner["seat-2"]).toBe(50n);
    expect(
      potCreateCalls.every((call) =>
        call.data.awards.create.every((award) => award.handRankJson !== null)
      )
    ).toBe(true);
  });

  it("auto-folds the next sit-out requested actor after submitAction and keeps completed-hand persistence intact", async () => {
    const prisma = createPrismaMock();
    const table = createTableRecord({
      status: VirtualTableStatus.ACTIVE,
      currentHandId: "hand-1",
      seats: [
        createSeatRecord({
          id: "seat-1",
          userId: "user-1",
          seatNumber: 1
        }),
        createSeatRecord({
          id: "seat-2",
          userId: "user-2",
          seatNumber: 2,
          status: VirtualSeatStatus.SIT_OUT_REQUESTED,
          sitOutAutoFoldEnabled: true
        })
      ]
    });
    const hand = createHandRecord({
      id: "hand-1",
      currentStreet: Street.FLOP,
      currentActorSeatId: "seat-1",
      currentBetChips: 0n,
      minRaiseChips: 10n,
      potTotalChips: 20n,
      communityCards: [
        createCommunityCardRecord({
          street: Street.FLOP,
          card: "2C",
          position: 0
        }),
        createCommunityCardRecord({
          id: "community-card-2",
          street: Street.FLOP,
          card: "7D",
          position: 1
        }),
        createCommunityCardRecord({
          id: "community-card-3",
          street: Street.FLOP,
          card: "TH",
          position: 2
        })
      ],
      players: [
        createHandPlayerRecord({
          seatId: "seat-1",
          seat: table.seats[0]!,
          currentStackChips: 990n,
          committedTotalChips: 10n,
          committedStreetChips: 0n,
          privateCard1: "AS",
          privateCard2: "KH"
        }),
        createHandPlayerRecord({
          id: "hand-player-2",
          seatId: "seat-2",
          seat: table.seats[1]!,
          currentStackChips: 990n,
          committedTotalChips: 10n,
          committedStreetChips: 0n,
          privateCard1: "QC",
          privateCard2: "QD"
        })
      ]
    });

    prisma.virtualTable.findUnique.mockResolvedValue(table);
    prisma.virtualHand.findUnique.mockResolvedValue(hand);
    prisma.onlinePlayerStats.findMany.mockResolvedValue([]);
    prisma.$transaction.mockImplementation(async (callback: (tx: MockPrisma) => Promise<void>) =>
      callback(prisma)
    );

    const service = new VirtualService(prisma as unknown as PrismaService);

    const result = await service.submitAction(baseUser, table.id, {
      handId: hand.id,
      actionType: "BET",
      amountChips: "10",
      idempotencyKey: "idem-bet-auto-fold"
    });

    const autoFoldActionCall = findCall<{
      data: {
        seatId: string;
        actorType: ActionActorType;
        actionType: ActionType;
        metadataJson: {
          reason: string;
          autoCheck: boolean;
          autoFold: boolean;
        };
      };
    }>(prisma.virtualAction.create, (call) => call.data.actionType === ActionType.AUTO_FOLD);

    expect(result.handStatus).toBe(VirtualHandStatus.COMPLETED);
    expect(result.nextActorSeatId).toBeNull();
    expect(autoFoldActionCall?.data.seatId).toBe("seat-2");
    expect(autoFoldActionCall?.data.actorType).toBe(ActionActorType.SYSTEM);
    expect(autoFoldActionCall?.data.metadataJson).toEqual({
      reason: "SIT_OUT",
      autoCheck: false,
      autoFold: true,
      street: "FLOP"
    });
    expect(prisma.turnTimer.create).not.toHaveBeenCalled();
    expect(prisma.onlinePlayerStats.findMany).toHaveBeenCalledWith({
      where: {
        userId: {
          in: ["user-1", "user-2"]
        }
      }
    });
    expect(prisma.onlinePlayerStats.upsert).toHaveBeenCalledTimes(2);
  });

  it("does not create immediate sit-out auto-action when the matching flag is disabled", async () => {
    const prisma = createPrismaMock();
    const table = createTableRecord({
      seats: [
        createSeatRecord({
          id: "seat-1",
          userId: "user-1",
          seatNumber: 1,
          role: VirtualSeatRole.OWNER,
          status: VirtualSeatStatus.SIT_OUT_REQUESTED,
          sitOutAutoCheckEnabled: false
        }),
        createSeatRecord({
          id: "seat-2",
          userId: "user-2",
          seatNumber: 2
        })
      ]
    });
    const createdHand = createHandRecord();

    prisma.virtualTable.findUnique.mockResolvedValue(table);
    prisma.virtualHand.count.mockResolvedValue(0);
    prisma.virtualHand.create.mockResolvedValue(createdHand);
    prisma.$transaction.mockImplementation(async (callback: (tx: MockPrisma) => Promise<VirtualHand>) =>
      callback(prisma)
    );

    const service = new VirtualService(prisma as unknown as PrismaService);

    await service.startTable(baseUser, table.id);

    const createHandCall = getFirstCall<{
      data: {
        currentActorSeatId: string | null;
      };
    }>(prisma.virtualHand.create);
    const nextTimerCall = getFirstCall<{
      data: {
        seatId: string;
        status: TurnTimerStatus;
      };
    }>(prisma.turnTimer.create);

    expect(prisma.virtualAction.create).not.toHaveBeenCalled();
    expect(nextTimerCall?.data.status).toBe(TurnTimerStatus.ACTIVE);
    expect(nextTimerCall?.data.seatId).toBe(createHandCall?.data.currentActorSeatId);
  });

  it("returns existing response for repeated submitAction with the same idempotency key", async () => {
    const prisma = createPrismaMock();
    const actedAt = new Date("2026-05-13T10:06:00.000Z");
    const table = createTableRecord({
      status: VirtualTableStatus.ACTIVE,
      currentHandId: "hand-1",
      seats: [
        createSeatRecord({
          id: "seat-1",
          userId: "user-1",
          seatNumber: 1
        }),
        createSeatRecord({
          id: "seat-2",
          userId: "user-2",
          seatNumber: 2
        })
      ]
    });
    const handBeforeAction = createHandRecord({
      id: "hand-1",
      currentActorSeatId: "seat-1",
      currentBetChips: 10n,
      minRaiseChips: 10n,
      potTotalChips: 15n,
      players: [
        createHandPlayerRecord({
          seatId: "seat-1",
          seat: table.seats[0]!,
          currentStackChips: 995n,
          committedTotalChips: 5n,
          committedStreetChips: 5n,
          privateCard1: "AS",
          privateCard2: "KH"
        }),
        createHandPlayerRecord({
          id: "hand-player-2",
          seatId: "seat-2",
          seat: table.seats[1]!,
          currentStackChips: 990n,
          committedTotalChips: 10n,
          committedStreetChips: 10n,
          hasActedThisStreet: true,
          privateCard1: "QC",
          privateCard2: "QD"
        })
      ]
    });
    const handAfterAction = createHandRecord({
      id: "hand-1",
      status: VirtualHandStatus.IN_PROGRESS,
      currentStreet: Street.FLOP,
      currentActorSeatId: "seat-2",
      currentBetChips: 0n,
      minRaiseChips: 10n,
      potTotalChips: 20n,
      communityCards: [
        createCommunityCardRecord({
          position: 0,
          card: "2C"
        }),
        createCommunityCardRecord({
          id: "community-card-2",
          position: 1,
          card: "7D"
        }),
        createCommunityCardRecord({
          id: "community-card-3",
          position: 2,
          card: "TH"
        })
      ],
      players: [
        createHandPlayerRecord({
          seatId: "seat-1",
          seat: table.seats[0]!,
          currentStackChips: 990n,
          committedTotalChips: 10n,
          committedStreetChips: 0n,
          hasActedThisStreet: false,
          privateCard1: "AS",
          privateCard2: "KH"
        }),
        createHandPlayerRecord({
          id: "hand-player-2",
          seatId: "seat-2",
          seat: table.seats[1]!,
          currentStackChips: 990n,
          committedTotalChips: 10n,
          committedStreetChips: 0n,
          hasActedThisStreet: false,
          privateCard1: "QC",
          privateCard2: "QD"
        })
      ]
    });
    const existingAction = createVirtualActionRecord({
      tableId: table.id,
      handId: handAfterAction.id,
      seatId: "seat-1",
      idempotencyKey: "idem-1",
      actionType: ActionType.CALL,
      amountChips: 5n,
      createdAt: actedAt
    });

    prisma.virtualTable.findUnique.mockResolvedValue(table);
    prisma.virtualHand.findUnique
      .mockResolvedValueOnce(handBeforeAction)
      .mockResolvedValueOnce(handAfterAction)
      .mockResolvedValue(handAfterAction);
    prisma.virtualAction.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(existingAction);
    prisma.$transaction.mockImplementation(async (callback: (tx: MockPrisma) => Promise<void>) =>
      callback(prisma)
    );

    const service = new VirtualService(prisma as unknown as PrismaService);

    await service.submitAction(baseUser, table.id, {
      handId: "hand-1",
      actionType: "CALL",
      idempotencyKey: "idem-1"
    });

    const repeatedResult = await service.submitAction(baseUser, table.id, {
      handId: "hand-1",
      actionType: "CALL",
      idempotencyKey: "idem-1"
    });

    expect(repeatedResult).toEqual({
      tableId: table.id,
      handId: handAfterAction.id,
      actionType: "CALL",
      amountChips: "5",
      handStatus: handAfterAction.status,
      actedAt: actedAt.toISOString(),
      nextActorSeatId: handAfterAction.currentActorSeatId
    });
    expect(prisma.virtualAction.create).toHaveBeenCalledTimes(1);
    expect(prisma.virtualHand.update).toHaveBeenCalledTimes(1);
  });

  it("does not update online stats again for a repeated completed-hand idempotency key", async () => {
    const prisma = createPrismaMock();
    const actedAt = new Date("2026-05-13T10:06:00.000Z");
    const table = createTableRecord({
      status: VirtualTableStatus.ACTIVE,
      currentHandId: "hand-1",
      seats: [
        createSeatRecord({
          id: "seat-1",
          userId: "user-1",
          seatNumber: 1
        }),
        createSeatRecord({
          id: "seat-2",
          userId: "user-2",
          seatNumber: 2
        })
      ]
    });
    const handBeforeAction = createHandRecord({
      id: "hand-1",
      currentActorSeatId: "seat-1",
      currentBetChips: 10n,
      minRaiseChips: 10n,
      potTotalChips: 15n,
      players: [
        createHandPlayerRecord({
          seatId: "seat-1",
          seat: table.seats[0]!,
          currentStackChips: 995n,
          committedTotalChips: 5n,
          committedStreetChips: 5n,
          privateCard1: "AS",
          privateCard2: "KH"
        }),
        createHandPlayerRecord({
          id: "hand-player-2",
          seatId: "seat-2",
          seat: table.seats[1]!,
          currentStackChips: 990n,
          committedTotalChips: 10n,
          committedStreetChips: 10n,
          hasActedThisStreet: true,
          privateCard1: "QC",
          privateCard2: "QD"
        })
      ]
    });
    const handAfterAction = createHandRecord({
      id: "hand-1",
      status: VirtualHandStatus.COMPLETED,
      currentStreet: Street.SHOWDOWN,
      currentActorSeatId: null,
      currentBetChips: 10n,
      minRaiseChips: 10n,
      potTotalChips: 15n,
      completedAt: actedAt,
      players: [
        createHandPlayerRecord({
          seatId: "seat-1",
          seat: table.seats[0]!,
          status: HandPlayerStatus.FOLDED,
          currentStackChips: 995n,
          committedTotalChips: 5n,
          committedStreetChips: 5n,
          hasActedThisStreet: true,
          isEligibleForShowdown: false,
          privateCard1: "AS",
          privateCard2: "KH"
        }),
        createHandPlayerRecord({
          id: "hand-player-2",
          seatId: "seat-2",
          seat: table.seats[1]!,
          currentStackChips: 1005n,
          committedTotalChips: 10n,
          committedStreetChips: 10n,
          hasActedThisStreet: true,
          privateCard1: "QC",
          privateCard2: "QD"
        })
      ]
    });
    const existingAction = createVirtualActionRecord({
      tableId: table.id,
      handId: handAfterAction.id,
      seatId: "seat-1",
      idempotencyKey: "idem-fold-once",
      actionType: ActionType.FOLD,
      amountChips: null,
      createdAt: actedAt
    });

    prisma.virtualTable.findUnique.mockResolvedValue(table);
    prisma.virtualHand.findUnique
      .mockResolvedValueOnce(handBeforeAction)
      .mockResolvedValueOnce(handAfterAction)
      .mockResolvedValue(handAfterAction);
    prisma.virtualAction.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(existingAction);
    prisma.onlinePlayerStats.findMany.mockResolvedValue([]);
    prisma.$transaction.mockImplementation(async (callback: (tx: MockPrisma) => Promise<void>) =>
      callback(prisma)
    );

    const service = new VirtualService(prisma as unknown as PrismaService);

    await service.submitAction(baseUser, table.id, {
      handId: "hand-1",
      actionType: "FOLD",
      idempotencyKey: "idem-fold-once"
    });

    const repeatedResult = await service.submitAction(baseUser, table.id, {
      handId: "hand-1",
      actionType: "FOLD",
      idempotencyKey: "idem-fold-once"
    });

    expect(repeatedResult).toEqual({
      tableId: table.id,
      handId: handAfterAction.id,
      actionType: "FOLD",
      amountChips: null,
      handStatus: handAfterAction.status,
      actedAt: actedAt.toISOString(),
      nextActorSeatId: null
    });
    expect(prisma.onlinePlayerStats.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.onlinePlayerStats.upsert).toHaveBeenCalledTimes(2);
    expect(prisma.virtualAction.create).toHaveBeenCalledTimes(1);
    expect(prisma.virtualHand.update).toHaveBeenCalledTimes(1);
  });

  it("returns existing response when create hits the idempotency unique constraint", async () => {
    const prisma = createPrismaMock();
    const actedAt = new Date("2026-05-13T10:06:00.000Z");
    const table = createTableRecord({
      status: VirtualTableStatus.ACTIVE,
      currentHandId: "hand-1",
      seats: [
        createSeatRecord({
          id: "seat-1",
          userId: "user-1",
          seatNumber: 1
        }),
        createSeatRecord({
          id: "seat-2",
          userId: "user-2",
          seatNumber: 2
        })
      ]
    });
    const handBeforeAction = createHandRecord({
      id: "hand-1",
      currentActorSeatId: "seat-1",
      currentBetChips: 10n,
      minRaiseChips: 10n,
      potTotalChips: 15n,
      players: [
        createHandPlayerRecord({
          seatId: "seat-1",
          seat: table.seats[0]!,
          currentStackChips: 995n,
          committedTotalChips: 5n,
          committedStreetChips: 5n,
          privateCard1: "AS",
          privateCard2: "KH"
        }),
        createHandPlayerRecord({
          id: "hand-player-2",
          seatId: "seat-2",
          seat: table.seats[1]!,
          currentStackChips: 990n,
          committedTotalChips: 10n,
          committedStreetChips: 10n,
          hasActedThisStreet: true,
          privateCard1: "QC",
          privateCard2: "QD"
        })
      ]
    });
    const handAfterAction = createHandRecord({
      id: "hand-1",
      status: VirtualHandStatus.IN_PROGRESS,
      currentStreet: Street.FLOP,
      currentActorSeatId: "seat-2",
      currentBetChips: 0n,
      minRaiseChips: 10n,
      potTotalChips: 20n,
      communityCards: [
        createCommunityCardRecord({
          position: 0,
          card: "2C"
        }),
        createCommunityCardRecord({
          id: "community-card-2",
          position: 1,
          card: "7D"
        }),
        createCommunityCardRecord({
          id: "community-card-3",
          position: 2,
          card: "TH"
        })
      ],
      players: [
        createHandPlayerRecord({
          seatId: "seat-1",
          seat: table.seats[0]!,
          currentStackChips: 990n,
          committedTotalChips: 10n,
          committedStreetChips: 0n,
          hasActedThisStreet: false,
          privateCard1: "AS",
          privateCard2: "KH"
        }),
        createHandPlayerRecord({
          id: "hand-player-2",
          seatId: "seat-2",
          seat: table.seats[1]!,
          currentStackChips: 990n,
          committedTotalChips: 10n,
          committedStreetChips: 0n,
          hasActedThisStreet: false,
          privateCard1: "QC",
          privateCard2: "QD"
        })
      ]
    });
    const existingAction = createVirtualActionRecord({
      tableId: table.id,
      handId: handAfterAction.id,
      seatId: "seat-1",
      idempotencyKey: "idem-1",
      actionType: ActionType.CALL,
      amountChips: 5n,
      createdAt: actedAt
    });

    prisma.virtualTable.findUnique.mockResolvedValue(table);
    prisma.virtualHand.findUnique
      .mockResolvedValueOnce(handBeforeAction)
      .mockResolvedValueOnce(handAfterAction);
    prisma.virtualAction.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(existingAction);
    prisma.virtualAction.create.mockRejectedValue({
      code: "P2002",
      meta: {
        target: ["tableId", "seatId", "idempotencyKey"]
      }
    });
    prisma.$transaction.mockImplementation(async (callback: (tx: MockPrisma) => Promise<void>) =>
      callback(prisma)
    );

    const service = new VirtualService(prisma as unknown as PrismaService);

    const result = await service.submitAction(baseUser, table.id, {
      handId: "hand-1",
      actionType: "CALL",
      idempotencyKey: "idem-1"
    });

    expect(result).toEqual({
      tableId: table.id,
      handId: handAfterAction.id,
      actionType: "CALL",
      amountChips: "5",
      handStatus: handAfterAction.status,
      actedAt: actedAt.toISOString(),
      nextActorSeatId: handAfterAction.currentActorSeatId
    });
    expect(prisma.virtualHand.update).not.toHaveBeenCalled();
  });

  it("marks due timers as reminded", async () => {
    const prisma = createPrismaMock();
    const notifications = createNotificationsMock();
    const now = new Date("2026-05-13T10:10:00.000Z");
    const timer = createTurnTimerRecord({
      id: "timer-1",
      reminderDueAt: new Date("2026-05-13T10:09:00.000Z"),
      expiresAt: new Date("2026-05-13T10:11:00.000Z")
    });
    const table = createTableRecord({
      id: timer.tableId,
      seats: [
        createSeatRecord({
          id: timer.seatId,
          userId: "user-1",
          seatNumber: 1
        })
      ]
    });

    prisma.turnTimer.findMany.mockResolvedValueOnce([timer]).mockResolvedValueOnce([]);
    prisma.turnTimer.updateMany.mockResolvedValue({ count: 1 });
    prisma.virtualTable.findUnique.mockResolvedValue(table);

    const service = new VirtualService(
      prisma as unknown as PrismaService,
      notifications as unknown as VirtualNotificationsService
    );
    const result = await service.processDueTurnTimers(now);

    expect(result.reminders).toEqual([
      {
        timerId: "timer-1",
        tableId: timer.tableId,
        handId: timer.handId,
        seatId: timer.seatId,
        remindedAt: now
      }
    ]);
    expect(result.timeouts).toEqual([]);
    expect(prisma.turnTimer.updateMany).toHaveBeenCalledWith({
      where: {
        id: "timer-1",
        status: TurnTimerStatus.ACTIVE,
        remindedAt: null
      },
      data: {
        status: TurnTimerStatus.REMINDED,
        remindedAt: now
      }
    });
    expect(notifications.sendReminderNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        telegramId: table.seats[0]?.user.telegramId ?? null,
        tableTitle: table.title,
        tableId: table.id
      })
    );
  });

  it("auto-checks expired timers when check is legal", async () => {
    const prisma = createPrismaMock();
    const notifications = createNotificationsMock();
    const now = new Date("2026-05-13T10:10:00.000Z");
    const table = createTableRecord({
      status: VirtualTableStatus.ACTIVE,
      currentHandId: "hand-1",
      seats: [
        createSeatRecord({
          id: "seat-1",
          userId: "user-1",
          seatNumber: 1
        }),
        createSeatRecord({
          id: "seat-2",
          userId: "user-2",
          seatNumber: 2
        })
      ]
    });
    const hand = createHandRecord({
      id: "hand-1",
      currentStreet: Street.FLOP,
      currentActorSeatId: "seat-1",
      currentBetChips: 0n,
      minRaiseChips: 10n,
      potTotalChips: 20n,
      players: [
        createHandPlayerRecord({
          seatId: "seat-1",
          seat: table.seats[0]!,
          currentStackChips: 990n,
          committedTotalChips: 10n,
          committedStreetChips: 0n,
          privateCard1: "AS",
          privateCard2: "KH"
        }),
        createHandPlayerRecord({
          seatId: "seat-2",
          seat: table.seats[1]!,
          currentStackChips: 990n,
          committedTotalChips: 10n,
          committedStreetChips: 0n,
          privateCard1: "QC",
          privateCard2: "QD"
        })
      ],
      communityCards: [
        createCommunityCardRecord({
          street: Street.FLOP,
          card: "2C",
          position: 0
        }),
        createCommunityCardRecord({
          street: Street.FLOP,
          card: "7D",
          position: 1
        }),
        createCommunityCardRecord({
          street: Street.FLOP,
          card: "JH",
          position: 2
        })
      ]
    });
    const timer = createTurnTimerRecord({
      id: "timer-check",
      seatId: "seat-1",
      expiresAt: new Date("2026-05-13T10:09:59.000Z")
    });

    prisma.turnTimer.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([timer]);
    prisma.turnTimer.findUnique.mockResolvedValue(timer);
    prisma.turnTimer.updateMany.mockResolvedValue({ count: 1 });
    prisma.virtualTable.findUnique.mockResolvedValue(table);
    prisma.virtualHand.findUnique.mockResolvedValue(hand);
    prisma.$transaction.mockImplementation(
      async (callback: (tx: MockPrisma) => Promise<unknown>) => callback(prisma)
    );

    const service = new VirtualService(
      prisma as unknown as PrismaService,
      notifications as unknown as VirtualNotificationsService
    );
    const result = await service.processDueTurnTimers(now);
    const autoCheckActionCall = getFirstCall<
      | {
          data: {
            tableId: string;
            handId: string;
            seatId: string;
            actorType: string;
            actionType: ActionType;
            createdAt: Date;
          };
        }
    >(prisma.virtualAction.create);

    expect(result.timeouts).toHaveLength(1);
    expect(result.timeouts[0]?.actionType).toBe(ActionType.AUTO_CHECK);
    expect(result.timeouts[0]?.handStatus).toBe(VirtualHandStatus.IN_PROGRESS);
    expect(autoCheckActionCall?.data.tableId).toBe(table.id);
    expect(autoCheckActionCall?.data.handId).toBe(hand.id);
    expect(autoCheckActionCall?.data.seatId).toBe("seat-1");
    expect(autoCheckActionCall?.data.actorType).toBe("SYSTEM");
    expect(autoCheckActionCall?.data.actionType).toBe(ActionType.AUTO_CHECK);
    expect(autoCheckActionCall?.data.createdAt).toEqual(now);
    const resolveTimerCall = findCall<TurnTimerUpdateManyCall>(
      prisma.turnTimer.updateMany,
      (call) => call.data.resolutionType === TurnTimerResolution.AUTO_CHECK
    );
    const nextTimerCall = getFirstCall<
      | {
          data: {
            handId: string;
            seatId: string;
            status: TurnTimerStatus;
          };
        }
    >(prisma.turnTimer.create);

    expect(resolveTimerCall?.where.seatId).toBe("seat-1");
    expect(resolveTimerCall?.data.status).toBe(TurnTimerStatus.RESOLVED);
    expect(nextTimerCall?.data.handId).toBe(hand.id);
    expect(nextTimerCall?.data.seatId).toBe(result.timeouts[0]?.nextActorSeatId);
    expect(nextTimerCall?.data.status).toBe(TurnTimerStatus.ACTIVE);
    expect(notifications.sendTimeoutNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        telegramId: table.seats[0]?.user.telegramId ?? null,
        tableTitle: table.title,
        tableId: table.id,
        actionType: ActionType.AUTO_CHECK
      })
    );
    expect(notifications.sendReminderNotification).not.toHaveBeenCalled();
  });

  it("can trigger immediate sit-out auto-action for the next actor after a timeout progression", async () => {
    const prisma = createPrismaMock();
    const notifications = createNotificationsMock();
    const now = new Date("2026-05-13T10:10:00.000Z");
    const table = createTableRecord({
      status: VirtualTableStatus.ACTIVE,
      currentHandId: "hand-1",
      seats: [
        createSeatRecord({
          id: "seat-1",
          userId: "user-1",
          seatNumber: 1
        }),
        createSeatRecord({
          id: "seat-2",
          userId: "user-2",
          seatNumber: 2,
          status: VirtualSeatStatus.SIT_OUT_REQUESTED,
          sitOutAutoCheckEnabled: true
        }),
        createSeatRecord({
          id: "seat-3",
          userId: "user-3",
          seatNumber: 3
        })
      ]
    });
    const hand = createHandRecord({
      id: "hand-1",
      dealerSeatId: "seat-3",
      smallBlindSeatId: "seat-1",
      bigBlindSeatId: "seat-2",
      currentStreet: Street.FLOP,
      currentActorSeatId: "seat-1",
      currentBetChips: 0n,
      minRaiseChips: 10n,
      potTotalChips: 30n,
      communityCards: [
        createCommunityCardRecord({
          street: Street.FLOP,
          card: "2C",
          position: 0
        }),
        createCommunityCardRecord({
          id: "community-card-2",
          street: Street.FLOP,
          card: "7D",
          position: 1
        }),
        createCommunityCardRecord({
          id: "community-card-3",
          street: Street.FLOP,
          card: "JH",
          position: 2
        })
      ],
      players: [
        createHandPlayerRecord({
          seatId: "seat-1",
          seat: table.seats[0]!,
          currentStackChips: 990n,
          committedTotalChips: 10n,
          committedStreetChips: 0n,
          privateCard1: "AS",
          privateCard2: "KH"
        }),
        createHandPlayerRecord({
          id: "hand-player-2",
          seatId: "seat-2",
          seat: table.seats[1]!,
          currentStackChips: 990n,
          committedTotalChips: 10n,
          committedStreetChips: 0n,
          privateCard1: "QC",
          privateCard2: "QD"
        }),
        createHandPlayerRecord({
          id: "hand-player-3",
          seatId: "seat-3",
          seat: table.seats[2]!,
          currentStackChips: 990n,
          committedTotalChips: 10n,
          committedStreetChips: 0n,
          privateCard1: "9S",
          privateCard2: "9H"
        })
      ]
    });
    const timer = createTurnTimerRecord({
      id: "timer-check-next-auto",
      seatId: "seat-1",
      expiresAt: new Date("2026-05-13T10:09:59.000Z")
    });

    prisma.turnTimer.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([timer]);
    prisma.turnTimer.findUnique.mockResolvedValue(timer);
    prisma.turnTimer.updateMany.mockResolvedValue({ count: 1 });
    prisma.virtualTable.findUnique.mockResolvedValue(table);
    prisma.virtualHand.findUnique.mockResolvedValue(hand);
    prisma.$transaction.mockImplementation(
      async (callback: (tx: MockPrisma) => Promise<unknown>) => callback(prisma)
    );

    const service = new VirtualService(
      prisma as unknown as PrismaService,
      notifications as unknown as VirtualNotificationsService
    );

    const result = await service.processDueTurnTimers(now);
    const sitOutAutoCheckActionCall = findCall<{
      data: {
        seatId: string;
        actorType: ActionActorType;
        actionType: ActionType;
        metadataJson: {
          reason: string;
          autoCheck: boolean;
          autoFold: boolean;
        };
      };
    }>(
      prisma.virtualAction.create,
      (call) =>
        call.data.seatId === "seat-2" && call.data.actionType === ActionType.AUTO_CHECK
    );
    const nextTimerCall = getFirstCall<{
      data: {
        seatId: string;
      };
    }>(prisma.turnTimer.create);
    expect(result.timeouts).toHaveLength(1);
    expect(sitOutAutoCheckActionCall?.data.actorType).toBe(ActionActorType.SYSTEM);
    expect(sitOutAutoCheckActionCall?.data.metadataJson).toEqual({
      reason: "SIT_OUT",
      autoCheck: true,
      autoFold: false,
      street: "FLOP"
    });
    expect(nextTimerCall?.data.seatId).toBe("seat-3");
    expect(notifications.sendTimeoutNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        telegramId: table.seats[0]?.user.telegramId ?? null,
        tableTitle: table.title,
        tableId: table.id,
        actionType: ActionType.AUTO_CHECK
      })
    );
    expect(notifications.sendReminderNotification).not.toHaveBeenCalled();
  });

  it("auto-folds expired timers when check is not legal", async () => {
    const prisma = createPrismaMock();
    const now = new Date("2026-05-13T10:10:00.000Z");
    const table = createTableRecord({
      status: VirtualTableStatus.ACTIVE,
      currentHandId: "hand-1",
      seats: [
        createSeatRecord({
          id: "seat-1",
          userId: "user-1",
          seatNumber: 1
        }),
        createSeatRecord({
          id: "seat-2",
          userId: "user-2",
          seatNumber: 2
        })
      ]
    });
    const hand = createHandRecord({
      id: "hand-1",
      currentActorSeatId: "seat-1",
      currentBetChips: 10n,
      minRaiseChips: 10n,
      potTotalChips: 15n,
      players: [
        createHandPlayerRecord({
          seatId: "seat-1",
          seat: table.seats[0]!,
          currentStackChips: 995n,
          committedTotalChips: 5n,
          committedStreetChips: 5n,
          privateCard1: "AS",
          privateCard2: "KH"
        }),
        createHandPlayerRecord({
          seatId: "seat-2",
          seat: table.seats[1]!,
          currentStackChips: 990n,
          committedTotalChips: 10n,
          committedStreetChips: 10n,
          hasActedThisStreet: true,
          privateCard1: "QC",
          privateCard2: "QD"
        })
      ]
    });
    const timer = createTurnTimerRecord({
      id: "timer-fold",
      seatId: "seat-1",
      expiresAt: new Date("2026-05-13T10:09:59.000Z")
    });

    prisma.turnTimer.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([timer]);
    prisma.turnTimer.findUnique.mockResolvedValue(timer);
    prisma.turnTimer.updateMany.mockResolvedValue({ count: 1 });
    prisma.virtualTable.findUnique.mockResolvedValue(table);
    prisma.virtualHand.findUnique.mockResolvedValue(hand);
    prisma.$transaction.mockImplementation(
      async (callback: (tx: MockPrisma) => Promise<unknown>) => callback(prisma)
    );

    const service = new VirtualService(prisma as unknown as PrismaService);
    const result = await service.processDueTurnTimers(now);
    const autoFoldActionCall = getFirstCall<
      | {
          data: {
            tableId: string;
            handId: string;
            seatId: string;
            actorType: string;
            actionType: ActionType;
            createdAt: Date;
          };
        }
    >(prisma.virtualAction.create);

    expect(result.timeouts).toHaveLength(1);
    expect(result.timeouts[0]?.actionType).toBe(ActionType.AUTO_FOLD);
    expect(result.timeouts[0]?.handStatus).toBe(VirtualHandStatus.COMPLETED);
    expect(result.timeouts[0]?.nextActorSeatId).toBeNull();
    expect(autoFoldActionCall?.data.tableId).toBe(table.id);
    expect(autoFoldActionCall?.data.handId).toBe(hand.id);
    expect(autoFoldActionCall?.data.seatId).toBe("seat-1");
    expect(autoFoldActionCall?.data.actorType).toBe("SYSTEM");
    expect(autoFoldActionCall?.data.actionType).toBe(ActionType.AUTO_FOLD);
    expect(autoFoldActionCall?.data.createdAt).toEqual(now);
    const autoFoldResolveCall = findCall<TurnTimerUpdateManyCall>(
      prisma.turnTimer.updateMany,
      (call) => call.data.resolutionType === TurnTimerResolution.AUTO_FOLD
    );
    const handCompletedResolveCall = findCall<TurnTimerUpdateManyCall>(
      prisma.turnTimer.updateMany,
      (call) => call.data.resolutionType === TurnTimerResolution.HAND_COMPLETED
    );

    expect(autoFoldResolveCall?.where.seatId).toBe("seat-1");
    expect(autoFoldResolveCall?.data.status).toBe(TurnTimerStatus.RESOLVED);
    expect(handCompletedResolveCall?.where.handId).toBe(hand.id);
    expect(handCompletedResolveCall?.data.status).toBe(TurnTimerStatus.RESOLVED);
    expect(prisma.virtualTable.updateMany).not.toHaveBeenCalled();
    expect(prisma.virtualHand.create).not.toHaveBeenCalled();
  });

  it("does not auto-act stale expired timers for cancelled hands on finished tables", async () => {
    const prisma = createPrismaMock();
    const now = new Date("2026-05-13T10:10:00.000Z");
    const table = createTableRecord({
      status: VirtualTableStatus.FINISHED,
      currentHandId: "hand-1",
      finishedAt: new Date("2026-05-13T10:09:00.000Z"),
      seats: [
        createSeatRecord({
          id: "seat-1",
          userId: "user-1",
          seatNumber: 1
        }),
        createSeatRecord({
          id: "seat-2",
          userId: "user-2",
          seatNumber: 2
        })
      ]
    });
    const hand = createHandRecord({
      id: "hand-1",
      status: VirtualHandStatus.CANCELLED,
      currentActorSeatId: "seat-1",
      completedAt: new Date("2026-05-13T10:09:00.000Z"),
      players: [
        createHandPlayerRecord({
          seatId: "seat-1",
          seat: table.seats[0]!,
          privateCard1: "AS",
          privateCard2: "KH"
        }),
        createHandPlayerRecord({
          id: "hand-player-2",
          seatId: "seat-2",
          seat: table.seats[1]!,
          privateCard1: "QC",
          privateCard2: "QD"
        })
      ]
    });
    const timer = createTurnTimerRecord({
      id: "timer-stale-cancelled",
      tableId: table.id,
      handId: hand.id,
      seatId: "seat-1",
      expiresAt: new Date("2026-05-13T10:09:59.000Z")
    });

    prisma.turnTimer.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([timer]);
    prisma.turnTimer.findUnique.mockResolvedValue(timer);
    prisma.virtualTable.findUnique.mockResolvedValue(table);
    prisma.virtualHand.findUnique.mockResolvedValue(hand);
    prisma.$transaction.mockImplementation(
      async (callback: (tx: MockPrisma) => Promise<unknown>) => callback(prisma)
    );

    const service = new VirtualService(prisma as unknown as PrismaService);
    const result = await service.processDueTurnTimers(now);
    const handCompletedResolveCall = findCall<TurnTimerUpdateManyCall>(
      prisma.turnTimer.updateMany,
      (call) => call.data.resolutionType === TurnTimerResolution.HAND_COMPLETED
    );

    expect(result.reminders).toEqual([]);
    expect(result.timeouts).toEqual([]);
    expect(handCompletedResolveCall?.where.handId).toBe(hand.id);
    expect(handCompletedResolveCall?.data.status).toBe(TurnTimerStatus.RESOLVED);
    expect(prisma.virtualAction.create).not.toHaveBeenCalled();
    expect(prisma.virtualHand.update).not.toHaveBeenCalled();
    expect(prisma.virtualHandPlayer.update).not.toHaveBeenCalled();
  });

  it("lists only current user tables and does not expose private cards", async () => {
    const prisma = createPrismaMock();
    const activeTable = {
      ...createTableRecord({
        id: "table-active",
        currentHandId: "hand-active",
        status: VirtualTableStatus.ACTIVE,
        startedAt: new Date("2026-05-13T10:05:00.000Z"),
        pausedAt: new Date("2026-05-13T10:20:00.000Z"),
        updatedAt: new Date("2026-05-13T11:00:00.000Z"),
        seats: [
          createSeatRecord({
            id: "seat-me",
            tableId: "table-active",
            userId: baseUser.id,
            status: VirtualSeatStatus.ACTING
          }),
          createSeatRecord({
            id: "seat-left",
            tableId: "table-active",
            userId: "user-2",
            seatNumber: 2,
            status: VirtualSeatStatus.LEFT,
            user: createUserRecord({ id: "user-2", firstName: "Ира" })
          })
        ]
      }),
      hands: [{ handNumber: 7 }]
    };
    const finishedTable = {
      ...createTableRecord({
        id: "table-finished",
        status: VirtualTableStatus.FINISHED,
        updatedAt: new Date("2026-05-13T12:00:00.000Z"),
        finishedAt: new Date("2026-05-13T12:30:00.000Z"),
        seats: [
          createSeatRecord({
            id: "seat-finished",
            tableId: "table-finished",
            userId: baseUser.id
          })
        ]
      }),
      hands: [{ handNumber: 3 }]
    };

    prisma.virtualTable.findMany.mockResolvedValue([finishedTable, activeTable]);
    prisma.virtualHand.findMany.mockResolvedValue([
      {
        id: "hand-active",
        currentActorSeatId: "seat-me",
        currentStreet: Street.TURN,
        potTotalChips: 90n
      }
    ]);

    const service = new VirtualService(prisma as unknown as PrismaService);
    const result = await service.listTables(baseUser);

    expect(result.items).toHaveLength(2);
    expect(result.items.map((item) => item.id)).toEqual(["table-active", "table-finished"]);
    expect(result.items[0]).toMatchObject({
      id: "table-active",
      startingStackChips: "1000",
      chipValueMinor: "10",
      chipValueCurrency: "RUB",
      turnDurationSeconds: 30,
      reminderDelaySeconds: 15,
      timeoutAutoActionRule: TimeoutAutoActionRule.CHECK_OR_FOLD,
      potTotalChips: "90",
      startedAt: "2026-05-13T10:05:00.000Z",
      pausedAt: "2026-05-13T10:20:00.000Z",
      finishedAt: null,
      seatsCount: 2,
      activeSeatsCount: 1,
      mySeatId: "seat-me",
      mySeatStatus: VirtualSeatStatus.ACTING,
      currentActorSeatId: "seat-me",
      currentStreet: Street.TURN,
      lastHandNumber: 7
    });
    expect(result.items[1]).toMatchObject({
      startingStackChips: "1000",
      chipValueMinor: "10",
      chipValueCurrency: "RUB",
      finishedAt: "2026-05-13T12:30:00.000Z",
      pausedAt: null
    });
    expect(result.items[0]).not.toHaveProperty("myPrivateCards");
  });

  it("rejects hand histories list for non participants", async () => {
    const prisma = createPrismaMock();
    const table = createTableRecord({
      seats: [
        createSeatRecord({
          id: "seat-2",
          userId: "user-2",
          user: createUserRecord({ id: "user-2", firstName: "Ира" })
        })
      ]
    });

    prisma.virtualTable.findUnique.mockResolvedValue(table);

    const service = new VirtualService(prisma as unknown as PrismaService);

    await expect(
      service.listHandHistories(baseUser, table.id, { limit: 20, cursor: null })
    ).rejects.toMatchObject({
      code: VIRTUAL_ERROR_CODES.forbidden,
      status: HttpStatus.FORBIDDEN
    });
    expect(prisma.virtualHand.findMany).not.toHaveBeenCalled();
  });

  it("returns newest hand histories in desc order with nextCursor when more items exist", async () => {
    const prisma = createPrismaMock();
    const winnerUser = createUserRecord({ id: "user-2", firstName: "Ира" });
    const table = createTableRecord({
      seats: [
        createSeatRecord({
          id: "seat-1",
          userId: baseUser.id,
          seatNumber: 1
        }),
        createSeatRecord({
          id: "seat-2",
          userId: "user-2",
          displayName: "Ира",
          seatNumber: 2,
          user: winnerUser
        })
      ]
    });
    const latestHand = {
      ...createHandRecord({
        id: "hand-2",
        tableId: table.id,
        handNumber: 7,
        status: VirtualHandStatus.COMPLETED,
        currentStreet: Street.SHOWDOWN,
        potTotalChips: 150n,
        startedAt: new Date("2026-05-13T10:10:00.000Z"),
        completedAt: new Date("2026-05-13T10:12:00.000Z"),
        communityCards: [
          createCommunityCardRecord({ position: 0, card: "2C" }),
          createCommunityCardRecord({ id: "community-card-2", position: 1, card: "7D" }),
          createCommunityCardRecord({ id: "community-card-3", position: 2, card: "JH" })
        ],
        players: [
          createHandPlayerRecord({
            seatId: "seat-1",
            seat: table.seats[0]!,
            privateCard1: "AS",
            privateCard2: "KD"
          }),
          createHandPlayerRecord({
            id: "hand-player-2",
            seatId: "seat-2",
            seat: table.seats[1]!,
            privateCard1: "QC",
            privateCard2: "QD"
          })
        ]
      }),
      actions: [
        createVirtualActionRecord({ id: "action-1", handId: "hand-2" }),
        createVirtualActionRecord({ id: "action-2", handId: "hand-2", seatId: "seat-2" })
      ],
      pots: [
        {
          id: "pot-1",
          potType: "MAIN",
          amountChips: 100n,
          capChips: null,
          eligibleSeatIdsJson: ["seat-1", "seat-2"],
          awards: [
            {
              winnerSeatId: "seat-2",
              amountChips: 100n,
              handRankJson: {
                rank: "PAIR",
                rankValue: 1,
                bestFiveCards: ["QD", "QC", "JH", "7D", "2C"],
                tiebreaker: [12, 11, 7, 2]
              }
            }
          ]
        },
        {
          id: "pot-2",
          potType: "SIDE",
          amountChips: 50n,
          capChips: null,
          eligibleSeatIdsJson: ["seat-2"],
          awards: [
            {
              winnerSeatId: "seat-2",
              amountChips: 50n,
              handRankJson: {
                rank: "PAIR",
                rankValue: 1,
                bestFiveCards: ["QD", "QC", "JH", "7D", "2C"],
                tiebreaker: [12, 11, 7, 2]
              }
            }
          ]
        }
      ]
    };
    const olderHand = {
      ...createHandRecord({
        id: "hand-1",
        tableId: table.id,
        handNumber: 6,
        status: VirtualHandStatus.CANCELLED,
        currentStreet: Street.TURN,
        potTotalChips: 40n,
        startedAt: new Date("2026-05-13T10:05:00.000Z"),
        completedAt: null,
        communityCards: [createCommunityCardRecord({ position: 0, card: "AH" })],
        players: [
          createHandPlayerRecord({
            seatId: "seat-1",
            seat: table.seats[0]!,
            privateCard1: "9S",
            privateCard2: "9D"
          })
        ]
      }),
      actions: [createVirtualActionRecord({ id: "action-older", handId: "hand-1" })],
      pots: []
    };
    const oldestHand = {
      ...createHandRecord({
        id: "hand-0",
        tableId: table.id,
        handNumber: 5,
        status: VirtualHandStatus.COMPLETED,
        currentStreet: Street.RIVER,
        potTotalChips: 20n,
        startedAt: new Date("2026-05-13T10:00:00.000Z"),
        completedAt: new Date("2026-05-13T10:02:00.000Z"),
        communityCards: [],
        players: [
          createHandPlayerRecord({
            seatId: "seat-1",
            seat: table.seats[0]!,
            privateCard1: "4S",
            privateCard2: "4D"
          })
        ]
      }),
      actions: [],
      pots: []
    };

    prisma.virtualTable.findUnique.mockResolvedValue(table);
    prisma.virtualHand.findMany.mockResolvedValue([latestHand, olderHand, oldestHand]);

    const service = new VirtualService(prisma as unknown as PrismaService);
    const result = await service.listHandHistories(baseUser, table.id, {
      limit: 2,
      cursor: null
    });

    expect(prisma.virtualHand.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tableId: table.id },
        orderBy: { handNumber: "desc" },
        take: 3
      })
    );
    expect(result.nextCursor).toBe("6");
    expect(result.items.map((item) => item.id)).toEqual(["hand-2", "hand-1"]);
    expect(result.items[0]).toEqual({
      id: "hand-2",
      handNumber: 7,
      status: VirtualHandStatus.COMPLETED,
      street: Street.SHOWDOWN,
      potTotalChips: "150",
      board: ["2C", "7D", "JH"],
      startedAt: "2026-05-13T10:10:00.000Z",
      completedAt: "2026-05-13T10:12:00.000Z",
      actionsCount: 2,
      winners: [
        {
          seatId: "seat-2",
          displayName: "Ира",
          amountChips: "150",
          handRankLabel: "Пара",
          bestFiveCards: ["QD", "QC", "JH", "7D", "2C"]
        }
      ]
    });
    expect(result.items[1]).toMatchObject({
      id: "hand-1",
      handNumber: 6,
      status: VirtualHandStatus.CANCELLED,
      street: Street.TURN,
      potTotalChips: "40",
      board: ["AH"],
      actionsCount: 1,
      winners: []
    });
    expect(result).not.toHaveProperty("myPrivateCards");
    expect(result).not.toHaveProperty("privateCard1");
    expect(result.items[0]).not.toHaveProperty("players");
  });

  it("filters hand histories by cursor and returns only older hand numbers", async () => {
    const prisma = createPrismaMock();
    const table = createTableRecord({
      seats: [createSeatRecord({ id: "seat-1", userId: baseUser.id, seatNumber: 1 })]
    });
    const handFour = {
      ...createHandRecord({
        id: "hand-4",
        tableId: table.id,
        handNumber: 4,
        currentStreet: Street.TURN,
        players: [
          createHandPlayerRecord({
            seatId: "seat-1",
            seat: table.seats[0]!,
            privateCard1: "9S",
            privateCard2: "9D"
          })
        ]
      }),
      actions: [],
      pots: []
    };
    const handThree = {
      ...createHandRecord({
        id: "hand-3",
        tableId: table.id,
        handNumber: 3,
        currentStreet: Street.FLOP,
        players: [
          createHandPlayerRecord({
            id: "hand-player-3",
            seatId: "seat-1",
            seat: table.seats[0]!,
            privateCard1: "8S",
            privateCard2: "8D"
          })
        ]
      }),
      actions: [],
      pots: []
    };

    prisma.virtualTable.findUnique.mockResolvedValue(table);
    prisma.virtualHand.findMany.mockResolvedValue([handFour, handThree]);

    const service = new VirtualService(prisma as unknown as PrismaService);
    const result = await service.listHandHistories(baseUser, table.id, {
      limit: 2,
      cursor: "5"
    });

    expect(prisma.virtualHand.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tableId: table.id,
          handNumber: { lt: 5 }
        },
        orderBy: { handNumber: "desc" },
        take: 3
      })
    );
    expect(result.items.map((item) => item.handNumber)).toEqual([4, 3]);
  });

  it("returns null rank fields for fold winners in hand histories list", async () => {
    const prisma = createPrismaMock();
    const table = createTableRecord({
      seats: [
        createSeatRecord({ id: "seat-1", userId: baseUser.id, seatNumber: 1 }),
        createSeatRecord({
          id: "seat-2",
          userId: "user-2",
          seatNumber: 2,
          displayName: "Ира",
          user: createUserRecord({ id: "user-2", firstName: "Ира" })
        })
      ]
    });
    const hand = {
      ...createHandRecord({
        id: "hand-fold",
        tableId: table.id,
        handNumber: 8,
        status: VirtualHandStatus.COMPLETED,
        completedAt: new Date("2026-05-13T10:15:00.000Z"),
        players: [
          createHandPlayerRecord({
            seatId: "seat-1",
            seat: table.seats[0]!
          }),
          createHandPlayerRecord({
            id: "hand-player-2",
            seatId: "seat-2",
            seat: table.seats[1]!
          })
        ]
      }),
      actions: [],
      pots: [
        {
          id: "pot-fold",
          potType: "MAIN",
          amountChips: 30n,
          capChips: null,
          eligibleSeatIdsJson: ["seat-1", "seat-2"],
          awards: [
            {
              winnerSeatId: "seat-2",
              amountChips: 30n,
              handRankJson: null
            }
          ]
        }
      ]
    };

    prisma.virtualTable.findUnique.mockResolvedValue(table);
    prisma.virtualHand.findMany.mockResolvedValue([hand]);

    const service = new VirtualService(prisma as unknown as PrismaService);
    const result = await service.listHandHistories(baseUser, table.id, {
      limit: 20,
      cursor: null
    });

    expect(result.items[0]?.winners).toEqual([
      {
        seatId: "seat-2",
        displayName: "Ира",
        amountChips: "30",
        handRankLabel: null,
        bestFiveCards: []
      }
    ]);
  });

  it("returns nextCursor null when there are no more hand histories", async () => {
    const prisma = createPrismaMock();
    const table = createTableRecord({
      seats: [createSeatRecord({ id: "seat-1", userId: baseUser.id, seatNumber: 1 })]
    });
    const latestHand = {
      ...createHandRecord({
        id: "hand-2",
        tableId: table.id,
        handNumber: 2,
        players: [
          createHandPlayerRecord({
            seatId: "seat-1",
            seat: table.seats[0]!,
            privateCard1: "AS",
            privateCard2: "KD"
          })
        ]
      }),
      actions: [],
      pots: []
    };
    const olderHand = {
      ...createHandRecord({
        id: "hand-1",
        tableId: table.id,
        handNumber: 1,
        players: [
          createHandPlayerRecord({
            id: "hand-player-2",
            seatId: "seat-1",
            seat: table.seats[0]!,
            privateCard1: "QS",
            privateCard2: "QD"
          })
        ]
      }),
      actions: [],
      pots: []
    };

    prisma.virtualTable.findUnique.mockResolvedValue(table);
    prisma.virtualHand.findMany.mockResolvedValue([latestHand, olderHand]);

    const service = new VirtualService(prisma as unknown as PrismaService);
    const result = await service.listHandHistories(baseUser, table.id, {
      limit: 2,
      cursor: null
    });

    expect(result.items.map((item) => item.handNumber)).toEqual([2, 1]);
    expect(result.nextCursor).toBeNull();
  });

  it("rejects hand history for non participants", async () => {
    const prisma = createPrismaMock();
    const table = createTableRecord({
      seats: [
        createSeatRecord({
          id: "seat-2",
          userId: "user-2",
          user: createUserRecord({ id: "user-2", firstName: "Ира" })
        })
      ]
    });

    prisma.virtualTable.findUnique.mockResolvedValue(table);

    const service = new VirtualService(prisma as unknown as PrismaService);

    await expect(service.getHandHistory(baseUser, table.id, "hand-1")).rejects.toMatchObject({
      code: VIRTUAL_ERROR_CODES.forbidden,
      status: HttpStatus.FORBIDDEN
    });
    expect(prisma.virtualHand.findUnique).not.toHaveBeenCalled();
  });

  it("returns sorted hand history with actions and pots", async () => {
    const prisma = createPrismaMock();
    const winnerUser = createUserRecord({ id: "user-2", firstName: "Ира" });
    const table = createTableRecord({
      status: VirtualTableStatus.ACTIVE,
      seats: [
        createSeatRecord({
          id: "seat-1",
          userId: baseUser.id
        }),
        createSeatRecord({
          id: "seat-2",
          userId: "user-2",
          displayName: "Ира",
          seatNumber: 2,
          user: winnerUser
        })
      ]
    });
    const hand = {
      ...createHandRecord({
        id: "hand-history",
        tableId: table.id,
        handNumber: 4,
        status: VirtualHandStatus.COMPLETED,
        currentStreet: Street.SHOWDOWN,
        potTotalChips: 150n,
        completedAt: new Date("2026-05-13T10:12:00.000Z"),
        communityCards: [
          createCommunityCardRecord({ position: 0, card: "2C" }),
          createCommunityCardRecord({ id: "community-card-2", position: 1, card: "7D" }),
          createCommunityCardRecord({ id: "community-card-3", position: 2, card: "JH" })
        ],
        players: [
          createHandPlayerRecord({
            seatId: "seat-1",
            seat: table.seats[0]!,
            privateCard1: "AS",
            privateCard2: "KD"
          }),
          createHandPlayerRecord({
            id: "hand-player-2",
            seatId: "seat-2",
            seat: table.seats[1]!,
            privateCard1: "QC",
            privateCard2: "QD"
          })
        ]
      }),
      actions: [
        {
          ...createVirtualActionRecord({
            id: "action-late",
            handId: "hand-history",
            createdAt: new Date("2026-05-13T10:06:05.000Z"),
            actionType: ActionType.RAISE,
            amountChips: 20n,
            seatId: "seat-2",
            metadataJson: { street: "PRE_FLOP" }
          }),
          seat: table.seats[1]
        },
        {
          ...createVirtualActionRecord({
            id: "action-early",
            handId: "hand-history",
            createdAt: new Date("2026-05-13T10:06:00.000Z"),
            actionType: ActionType.CALL,
            amountChips: 10n,
            seatId: "seat-1",
            metadataJson: { street: "PRE_FLOP" }
          }),
          seat: table.seats[0]
        }
      ],
      pots: [
        {
          id: "pot-1",
          potType: "MAIN",
          amountChips: 150n,
          capChips: null,
          eligibleSeatIdsJson: ["seat-1", "seat-2"],
          awards: [
            {
              winnerSeatId: "seat-2",
              amountChips: 150n,
              handRankJson: { label: "Two Pair" }
            }
          ]
        }
      ]
    };

    prisma.virtualTable.findUnique.mockResolvedValue(table);
    prisma.virtualHand.findUnique.mockResolvedValue(hand);

    const service = new VirtualService(prisma as unknown as PrismaService);
    const result = await service.getHandHistory(baseUser, table.id, hand.id);

    expect(result.table).toMatchObject({
      id: table.id,
      startingStackChips: "1000",
      chipValueMinor: "10",
      chipValueCurrency: "RUB",
      smallBlindChips: "5",
      bigBlindChips: "10"
    });
    expect(result.hand.handNumber).toBe(4);
    expect(result.board).toEqual(["2C", "7D", "JH"]);
    expect(result.players).toEqual([
      {
        seatId: "seat-1",
        displayName: "Денис",
        status: VirtualSeatStatus.ACTIVE,
        committedTotalChips: "0",
        stackAfterChips: "1000",
        showdownCards: ["AS", "KD"]
      },
      {
        seatId: "seat-2",
        displayName: "Ира",
        status: VirtualSeatStatus.ACTIVE,
        committedTotalChips: "0",
        stackAfterChips: "1000",
        showdownCards: ["QC", "QD"]
      }
    ]);
    expect(result.actions.map((action) => action.id)).toEqual(["action-early", "action-late"]);
    expect(result.actions[0]).toMatchObject({
      actionType: ActionType.CALL,
      amountChips: "10",
      seatId: "seat-1",
      displayName: "Денис"
    });
    expect(result.pots).toEqual([
      {
        id: "pot-1",
        amountChips: "150",
        eligibleSeatIds: ["seat-1", "seat-2"],
        awards: [
          {
            winnerSeatId: "seat-2",
            displayName: "Ира",
            amountChips: "150",
            handRankJson: { label: "Two Pair" }
          }
        ]
      }
    ]);
    expect(result).not.toHaveProperty("privateCard1");
    expect(result).not.toHaveProperty("myPrivateCards");
  });

  it("does not expose showdown cards when a completed hand ends by fold", async () => {
    const prisma = createPrismaMock();
    const table = createTableRecord({
      seats: [
        createSeatRecord({
          id: "seat-1",
          userId: baseUser.id
        }),
        createSeatRecord({
          id: "seat-2",
          userId: "user-2",
          displayName: "Ира",
          seatNumber: 2,
          user: createUserRecord({ id: "user-2", firstName: "Ира" })
        })
      ]
    });
    const hand = {
      ...createHandRecord({
        id: "hand-history-folded",
        tableId: table.id,
        status: VirtualHandStatus.COMPLETED,
        currentStreet: Street.SHOWDOWN,
        players: [
          createHandPlayerRecord({
            seatId: "seat-1",
            seat: table.seats[0]!,
            privateCard1: "AS",
            privateCard2: "KD"
          }),
          createHandPlayerRecord({
            id: "hand-player-2",
            seatId: "seat-2",
            seat: table.seats[1]!,
            status: HandPlayerStatus.FOLDED,
            privateCard1: "QC",
            privateCard2: "QD"
          })
        ]
      }),
      actions: [],
      pots: []
    };

    prisma.virtualTable.findUnique.mockResolvedValue(table);
    prisma.virtualHand.findUnique.mockResolvedValue(hand);

    const service = new VirtualService(prisma as unknown as PrismaService);
    const result = await service.getHandHistory(baseUser, table.id, hand.id);

    expect(result.players).toEqual([
      expect.objectContaining({
        seatId: "seat-1",
        showdownCards: []
      }),
      expect.objectContaining({
        seatId: "seat-2",
        status: VirtualSeatStatus.FOLDED,
        showdownCards: []
      })
    ]);
  });

  it("exposes showdown cards only for eligible players when a completed hand reaches showdown", async () => {
    const prisma = createPrismaMock();
    const table = createTableRecord({
      seats: [
        createSeatRecord({
          id: "seat-1",
          userId: baseUser.id
        }),
        createSeatRecord({
          id: "seat-2",
          userId: "user-2",
          displayName: "Ира",
          seatNumber: 2,
          user: createUserRecord({ id: "user-2", firstName: "Ира" })
        }),
        createSeatRecord({
          id: "seat-3",
          userId: "user-3",
          displayName: "Макс",
          seatNumber: 3,
          user: createUserRecord({ id: "user-3", firstName: "Макс" })
        })
      ]
    });
    const hand = {
      ...createHandRecord({
        id: "hand-history-showdown",
        tableId: table.id,
        status: VirtualHandStatus.COMPLETED,
        currentStreet: Street.SHOWDOWN,
        players: [
          createHandPlayerRecord({
            seatId: "seat-1",
            seat: table.seats[0]!,
            privateCard1: "AS",
            privateCard2: "KD"
          }),
          createHandPlayerRecord({
            id: "hand-player-2",
            seatId: "seat-2",
            seat: table.seats[1]!,
            privateCard1: "QC",
            privateCard2: "QD"
          }),
          createHandPlayerRecord({
            id: "hand-player-3",
            seatId: "seat-3",
            seat: table.seats[2]!,
            status: HandPlayerStatus.FOLDED,
            isEligibleForShowdown: false,
            privateCard1: "9H",
            privateCard2: "9C"
          })
        ]
      }),
      actions: [],
      pots: [
        {
          id: "pot-showdown",
          potType: "MAIN",
          amountChips: 150n,
          capChips: null,
          eligibleSeatIdsJson: ["seat-1", "seat-2"],
          awards: [
            {
              winnerSeatId: "seat-2",
              amountChips: 150n,
              handRankJson: { label: "Two Pair" }
            }
          ]
        }
      ]
    };

    prisma.virtualTable.findUnique.mockResolvedValue(table);
    prisma.virtualHand.findUnique.mockResolvedValue(hand);

    const service = new VirtualService(prisma as unknown as PrismaService);
    const result = await service.getHandHistory(baseUser, table.id, hand.id);

    expect(result.players).toEqual([
      expect.objectContaining({
        seatId: "seat-1",
        showdownCards: ["AS", "KD"]
      }),
      expect.objectContaining({
        seatId: "seat-2",
        showdownCards: ["QC", "QD"]
      }),
      expect.objectContaining({
        seatId: "seat-3",
        status: VirtualSeatStatus.FOLDED,
        showdownCards: []
      })
    ]);
  });

  it("does not expose showdown cards for in-progress or cancelled hand history", async () => {
    const prisma = createPrismaMock();
    const table = createTableRecord({
      seats: [
        createSeatRecord({
          id: "seat-1",
          userId: baseUser.id
        }),
        createSeatRecord({
          id: "seat-2",
          userId: "user-2",
          seatNumber: 2,
          user: createUserRecord({ id: "user-2", firstName: "Ира" })
        })
      ]
    });
    const inProgressHand = {
      ...createHandRecord({
        id: "hand-history-in-progress",
        tableId: table.id,
        status: VirtualHandStatus.IN_PROGRESS,
        players: [
          createHandPlayerRecord({
            seatId: "seat-1",
            seat: table.seats[0]!,
            privateCard1: "AS",
            privateCard2: "KD"
          }),
          createHandPlayerRecord({
            id: "hand-player-2",
            seatId: "seat-2",
            seat: table.seats[1]!,
            privateCard1: "QC",
            privateCard2: "QD"
          })
        ]
      }),
      actions: [],
      pots: []
    };
    const cancelledHand = {
      ...createHandRecord({
        id: "hand-history-cancelled",
        tableId: table.id,
        status: VirtualHandStatus.CANCELLED,
        players: [
          createHandPlayerRecord({
            seatId: "seat-1",
            seat: table.seats[0]!,
            privateCard1: "AH",
            privateCard2: "AD"
          }),
          createHandPlayerRecord({
            id: "hand-player-2-cancelled",
            seatId: "seat-2",
            seat: table.seats[1]!,
            privateCard1: "KS",
            privateCard2: "KD"
          })
        ]
      }),
      actions: [],
      pots: []
    };

    prisma.virtualTable.findUnique.mockResolvedValue(table);
    prisma.virtualHand.findUnique
      .mockResolvedValueOnce(inProgressHand)
      .mockResolvedValueOnce(cancelledHand);

    const service = new VirtualService(prisma as unknown as PrismaService);
    const inProgressResult = await service.getHandHistory(baseUser, table.id, inProgressHand.id);
    const cancelledResult = await service.getHandHistory(baseUser, table.id, cancelledHand.id);

    expect(inProgressResult.players.every((player) => player.showdownCards.length === 0)).toBe(
      true
    );
    expect(cancelledResult.players.every((player) => player.showdownCards.length === 0)).toBe(
      true
    );
  });

  it("returns the first leaderboard page with next cursor when more rows exist", async () => {
    const prisma = createPrismaMock();

    prisma.onlinePlayerStats.findMany.mockResolvedValue([
      createOnlinePlayerStatsRecord({
        userId: "user-d",
        handsPlayed: 2,
        netChips: 50n,
        onlinePokerScore: 70,
        user: createUserRecord({ id: "user-d", firstName: "Глеб" })
      }),
      createOnlinePlayerStatsRecord({
        userId: "user-b",
        handsPlayed: 10,
        netChips: 100n,
        onlinePokerScore: 90,
        user: createUserRecord({ id: "user-b", firstName: "Борис" })
      }),
      createOnlinePlayerStatsRecord({
        userId: "user-a",
        handsPlayed: 10,
        netChips: 120n,
        onlinePokerScore: 90,
        user: createUserRecord({ id: "user-a", firstName: "Аня" })
      }),
      createOnlinePlayerStatsRecord({
        userId: "user-c",
        handsPlayed: 4,
        netChips: 300n,
        onlinePokerScore: 80,
        user: createUserRecord({ id: "user-c", firstName: "Саша" })
      })
    ]);

    const service = new VirtualService(prisma as unknown as PrismaService);
    const result = await service.getLeaderboard(baseUser, {
      scope: "all",
      period: "all-time",
      limit: 2,
      cursor: null
    });

    expect(result.items.map((item) => item.userId)).toEqual(["user-a", "user-b"]);
    expect(result.items.map((item) => item.rank)).toEqual([1, 2]);
    expect(result.nextCursor).toBe(
      encodeVirtualLeaderboardCursor({
        onlinePokerScore: 90,
        handsPlayed: 10,
        netChips: 100n,
        userId: "user-b"
      })
    );
  });

  it("returns the following leaderboard page for cursor pagination", async () => {
    const prisma = createPrismaMock();

    prisma.onlinePlayerStats.findMany.mockResolvedValue([
      createOnlinePlayerStatsRecord({
        userId: "user-d",
        handsPlayed: 2,
        netChips: 50n,
        onlinePokerScore: 70,
        user: createUserRecord({ id: "user-d", firstName: "Глеб" })
      }),
      createOnlinePlayerStatsRecord({
        userId: "user-b",
        handsPlayed: 10,
        netChips: 100n,
        onlinePokerScore: 90,
        user: createUserRecord({ id: "user-b", firstName: "Борис" })
      }),
      createOnlinePlayerStatsRecord({
        userId: "user-a",
        handsPlayed: 10,
        netChips: 120n,
        onlinePokerScore: 90,
        user: createUserRecord({ id: "user-a", firstName: "Аня" })
      }),
      createOnlinePlayerStatsRecord({
        userId: "user-c",
        handsPlayed: 4,
        netChips: 300n,
        onlinePokerScore: 80,
        user: createUserRecord({ id: "user-c", firstName: "Саша" })
      })
    ]);

    const service = new VirtualService(prisma as unknown as PrismaService);
    const result = await service.getLeaderboard(baseUser, {
      scope: "all",
      period: "all-time",
      limit: 2,
      cursor: encodeVirtualLeaderboardCursor({
        onlinePokerScore: 90,
        handsPlayed: 10,
        netChips: 100n,
        userId: "user-b"
      })
    });

    expect(result.items.map((item) => item.userId)).toEqual(["user-c", "user-d"]);
    expect(result.items.map((item) => item.rank)).toEqual([3, 4]);
    expect(result.nextCursor).toBeNull();
  });

  it("returns null next cursor on the final leaderboard page", async () => {
    const prisma = createPrismaMock();

    prisma.onlinePlayerStats.findMany.mockResolvedValue([
      createOnlinePlayerStatsRecord({
        userId: "user-b",
        handsPlayed: 10,
        netChips: 100n,
        onlinePokerScore: 90,
        user: createUserRecord({ id: "user-b", firstName: "Борис" })
      }),
      createOnlinePlayerStatsRecord({
        userId: "user-a",
        handsPlayed: 10,
        netChips: 120n,
        onlinePokerScore: 90,
        user: createUserRecord({ id: "user-a", firstName: "Аня" })
      })
    ]);

    const service = new VirtualService(prisma as unknown as PrismaService);
    const result = await service.getLeaderboard(baseUser, {
      scope: "all",
      period: "all-time",
      limit: 5,
      cursor: null
    });

    expect(result.nextCursor).toBeNull();
    expect(result.items.map((item) => item.userId)).toEqual(["user-a", "user-b"]);
  });

  it("keeps leaderboard ordering the same as before", async () => {
    const prisma = createPrismaMock();

    prisma.onlinePlayerStats.findMany.mockResolvedValue([
      createOnlinePlayerStatsRecord({
        userId: "user-b",
        handsPlayed: 10,
        netChips: 100n,
        onlinePokerScore: 90,
        user: createUserRecord({ id: "user-b", firstName: "Борис" })
      }),
      createOnlinePlayerStatsRecord({
        userId: "user-a",
        handsPlayed: 10,
        netChips: 120n,
        onlinePokerScore: 90,
        user: createUserRecord({ id: "user-a", firstName: "Аня" })
      }),
      createOnlinePlayerStatsRecord({
        userId: "user-c",
        handsPlayed: 4,
        netChips: 300n,
        onlinePokerScore: 80,
        user: createUserRecord({ id: "user-c", firstName: "Саша" })
      })
    ]);

    const service = new VirtualService(prisma as unknown as PrismaService);
    const result = await service.getLeaderboard(baseUser, {
      scope: "all",
      period: "all-time",
      limit: 50,
      cursor: null
    });

    expect(result.nextCursor).toBeNull();
    expect(result.items.map((item) => item.userId)).toEqual(["user-a", "user-b", "user-c"]);
    expect(result.items.map((item) => item.rank)).toEqual([1, 2, 3]);
  });

  it("filters all-time leaderboard by players who finished tables with me", async () => {
    const prisma = createPrismaMock();

    prisma.virtualTable.findMany.mockResolvedValue([
      {
        id: "table-1",
        finishedAt: new Date("2026-05-15T10:00:00.000Z"),
        seats: [{ userId: baseUser.id }, { userId: "user-b" }]
      }
    ]);
    prisma.onlinePlayerStats.findMany.mockResolvedValue([
      createOnlinePlayerStatsRecord({
        userId: baseUser.id,
        handsPlayed: 6,
        netChips: 40n,
        onlinePokerScore: 60,
        user: createUserRecord({ id: baseUser.id, firstName: "Денис", username: "denis" })
      }),
      createOnlinePlayerStatsRecord({
        userId: "user-b",
        handsPlayed: 8,
        netChips: 90n,
        onlinePokerScore: 80,
        user: createUserRecord({ id: "user-b", firstName: "Борис" })
      })
    ]);

    const service = new VirtualService(prisma as unknown as PrismaService);
    const result = await service.getLeaderboard(baseUser, {
      scope: "played-with-me",
      period: "all-time",
      limit: 20,
      cursor: null
    });

    const leaderboardFindManyCall = getFirstCall<{
      where: {
        userId: {
          in: string[];
        };
      };
    }>(prisma.onlinePlayerStats.findMany);

    expect(leaderboardFindManyCall?.where.userId.in).toEqual(
      expect.arrayContaining([baseUser.id, "user-b"])
    );
    expect(result.items.map((item) => item.userId)).toEqual(["user-b", baseUser.id]);
  });

  it("aggregates month leaderboard from completed virtual hands without private cards", async () => {
    const prisma = createPrismaMock();
    const winner = createUserRecord({ id: "user-2", firstName: "Ира" });
    const viewerUser = createUserRecord({ id: baseUser.id, firstName: "Денис", username: "denis" });

    prisma.virtualTable.findMany.mockResolvedValue([
      {
        id: "table-month",
        finishedAt: new Date("2026-05-16T20:00:00.000Z"),
        seats: [{ userId: baseUser.id }, { userId: "user-2" }]
      }
    ]);
    prisma.virtualHand.findMany.mockResolvedValue([
      {
        id: "hand-month",
        tableId: "table-month",
        bigBlindChips: 10n,
        completedAt: new Date("2026-05-16T19:40:00.000Z"),
        players: [
          {
            startingStackChips: 100n,
            currentStackChips: 80n,
            seat: {
              userId: baseUser.id,
              user: viewerUser
            }
          },
          {
            startingStackChips: 100n,
            currentStackChips: 120n,
            seat: {
              userId: "user-2",
              user: winner
            }
          }
        ],
        table: {
          id: "table-month",
          title: "Майский стол",
          chipValueMinor: 10n,
          chipValueCurrency: "RUB",
          smallBlindChips: 5n,
          bigBlindChips: 10n,
          finishedAt: new Date("2026-05-16T20:00:00.000Z"),
          seats: [{ userId: baseUser.id }, { userId: "user-2" }]
        }
      }
    ]);

    const service = new VirtualService(prisma as unknown as PrismaService);
    const result = await service.getLeaderboard(baseUser, {
      scope: "played-with-me",
      period: "month",
      limit: 20,
      cursor: null
    });

    expect(result.items[0]).toMatchObject({
      userId: "user-2",
      handsPlayed: 1,
      handsWon: 1,
      netChips: "20"
    });
    expect(result.items[1]).toMatchObject({
      userId: baseUser.id,
      handsPlayed: 1,
      handsWon: 0,
      netChips: "-20"
    });
    expect(result.items[0]).not.toHaveProperty("privateCard1");
    expect(result.items[0]).not.toHaveProperty("privateCard2");
  });

  it("limits last-10 leaderboard stats to each player's latest ten finished tables", async () => {
    const prisma = createPrismaMock();
    const viewerUser = createUserRecord({ id: baseUser.id, firstName: "Денис", username: "denis" });
    const opponent = createUserRecord({ id: "user-2", firstName: "Ира" });
    const finishedTables = Array.from({ length: 12 }, (_, index) => ({
      id: `table-${12 - index}`,
      finishedAt: new Date(`2026-05-${String(12 - index).padStart(2, "0")}T20:00:00.000Z`),
      seats: [{ userId: baseUser.id }, { userId: "user-2" }]
    }));
    const hands = finishedTables.map((table, index) => ({
      id: `hand-${index + 1}`,
      tableId: table.id,
      bigBlindChips: 10n,
      completedAt: new Date(table.finishedAt.getTime() - 60_000),
      players: [
        {
          startingStackChips: 100n,
          currentStackChips: 110n,
          seat: {
            userId: baseUser.id,
            user: viewerUser
          }
        },
        {
          startingStackChips: 100n,
          currentStackChips: 90n,
          seat: {
            userId: "user-2",
            user: opponent
          }
        }
      ],
      table: {
        id: table.id,
        title: `Стол ${index + 1}`,
        chipValueMinor: 10n,
        chipValueCurrency: "RUB",
        smallBlindChips: 5n,
        bigBlindChips: 10n,
        finishedAt: table.finishedAt,
        seats: [{ userId: baseUser.id }, { userId: "user-2" }]
      }
    }));

    prisma.virtualTable.findMany.mockResolvedValue(finishedTables);
    prisma.virtualHand.findMany.mockResolvedValue(hands);

    const service = new VirtualService(prisma as unknown as PrismaService);
    const result = await service.getLeaderboard(baseUser, {
      scope: "all",
      period: "last-10",
      limit: 20,
      cursor: null
    });

    expect(result.items[0]).toMatchObject({
      userId: baseUser.id,
      handsPlayed: 10,
      netChips: "100"
    });
    expect(result.items[1]).toMatchObject({
      userId: "user-2",
      handsPlayed: 10,
      netChips: "-100"
    });
  });

  it("rejects virtual player profile for viewers without a shared finished table", async () => {
    const prisma = createPrismaMock();
    prisma.user.findUnique.mockResolvedValue(createUserRecord({ id: "user-2", firstName: "Ира" }));
    prisma.virtualTable.findFirst.mockResolvedValue(null);

    const service = new VirtualService(prisma as unknown as PrismaService);

    await expect(service.getPlayerProfile(baseUser, "user-2", "all-time")).rejects.toMatchObject({
      code: VIRTUAL_ERROR_CODES.forbidden,
      status: HttpStatus.FORBIDDEN
    });
  });

  it("returns virtual player profile for self with all-time stats", async () => {
    const prisma = createPrismaMock();
    prisma.user.findUnique.mockResolvedValue(
      createUserRecord({ id: baseUser.id, firstName: "Денис", username: "denis" })
    );
    prisma.onlinePlayerStats.findUnique.mockResolvedValue(
      createOnlinePlayerStatsRecord({
        userId: baseUser.id,
        handsPlayed: 3,
        handsWon: 2,
        netChips: 45n,
        netEstimatedMinor: 450n,
        bigBlindsWon: 4n,
        bbPer100Bps: 13_333,
        winRateBps: 6_666,
        avgChipsPerHand: 15n,
        onlinePokerScore: 74,
        user: createUserRecord({ id: baseUser.id, firstName: "Денис", username: "denis" })
      })
    );
    prisma.virtualTable.findMany.mockResolvedValue([
      {
        id: "table-1",
        title: "Ночной стол",
        startingStackChips: 100n,
        smallBlindChips: 5n,
        bigBlindChips: 10n,
        chipValueMinor: 10n,
        finishedAt: new Date("2026-05-17T20:00:00.000Z"),
        seats: [{ userId: baseUser.id }, { userId: "user-2" }],
        hands: [
          {
            id: "hand-1",
            tableId: "table-1",
            bigBlindChips: 10n,
            completedAt: new Date("2026-05-17T19:45:00.000Z"),
            players: [
              {
                startingStackChips: 100n,
                currentStackChips: 130n,
                seat: {
                  userId: baseUser.id,
                  user: createUserRecord({ id: baseUser.id, firstName: "Денис", username: "denis" })
                }
              }
            ],
            table: {
              id: "table-1",
              title: "Ночной стол",
              chipValueMinor: 10n,
              chipValueCurrency: "RUB",
              smallBlindChips: 5n,
              bigBlindChips: 10n,
              finishedAt: new Date("2026-05-17T20:00:00.000Z"),
              seats: [{ userId: baseUser.id }, { userId: "user-2" }]
            }
          }
        ]
      }
    ]);

    const service = new VirtualService(prisma as unknown as PrismaService);
    const result = await service.getPlayerProfile(baseUser, baseUser.id, "all-time");

    expect(result.user).toEqual({
      id: baseUser.id,
      displayName: "Денис",
      username: "denis"
    });
    expect(result.stats).toMatchObject({
      userId: baseUser.id,
      handsPlayed: 3,
      netChips: "45"
    });
    expect(result.recentResults[0]).toMatchObject({
      tableId: "table-1",
      netChips: "30",
      netEstimatedMinor: "300",
      cumulativeNetChips: "30",
      cumulativeNetEstimatedMinor: "300"
    });
    expect(result.tableStats).toEqual({
      tablesPlayed: 1,
      tablesWon: 1,
      tableWinRateBps: 10_000,
      totalBuyInEstimatedMinor: "1000",
      roiBps: 3000
    });
    expect(result.stats).not.toHaveProperty("privateCard1");
  });

  it("returns shared virtual player profile with dynamic last-10 stats", async () => {
    const prisma = createPrismaMock();
    prisma.user.findUnique.mockResolvedValue(createUserRecord({ id: "user-2", firstName: "Ира" }));
    prisma.virtualTable.findFirst.mockResolvedValue({ id: "table-shared" });
    prisma.virtualTable.findMany.mockResolvedValue([
      {
        id: "table-shared",
        title: "Общий стол",
        startingStackChips: 100n,
        smallBlindChips: 5n,
        bigBlindChips: 10n,
        chipValueMinor: 10n,
        finishedAt: new Date("2026-05-17T20:00:00.000Z"),
        seats: [{ userId: baseUser.id }, { userId: "user-2" }],
        hands: [
          {
            id: "hand-shared",
            tableId: "table-shared",
            bigBlindChips: 10n,
            completedAt: new Date("2026-05-17T19:45:00.000Z"),
            players: [
              {
                startingStackChips: 100n,
                currentStackChips: 120n,
                seat: {
                  userId: "user-2",
                  user: createUserRecord({ id: "user-2", firstName: "Ира", username: "ira" })
                }
              },
              {
                startingStackChips: 100n,
                currentStackChips: 80n,
                seat: {
                  userId: baseUser.id,
                  user: createUserRecord({ id: baseUser.id, firstName: "Денис", username: "denis" })
                }
              }
            ],
            table: {
              id: "table-shared",
              title: "Общий стол",
              chipValueMinor: 10n,
              chipValueCurrency: "RUB",
              smallBlindChips: 5n,
              bigBlindChips: 10n,
              finishedAt: new Date("2026-05-17T20:00:00.000Z"),
              seats: [{ userId: baseUser.id }, { userId: "user-2" }]
            }
          }
        ]
      }
    ]);

    const service = new VirtualService(prisma as unknown as PrismaService);
    const result = await service.getPlayerProfile(baseUser, "user-2", "last-10");

    expect(result.stats).toMatchObject({
      userId: "user-2",
      handsPlayed: 1,
      handsWon: 1,
      netChips: "20"
    });
    expect(result.trend).toEqual([
      {
        tableId: "table-shared",
        finishedAt: "2026-05-17T20:00:00.000Z",
        netChips: "20",
        cumulativeNetChips: "20",
        netEstimatedMinor: "200",
        cumulativeNetEstimatedMinor: "200"
      }
    ]);
    expect(result.tableStats).toEqual({
      tablesPlayed: 1,
      tablesWon: 1,
      tableWinRateBps: 10_000,
      totalBuyInEstimatedMinor: "1000",
      roiBps: 2000
    });
  });

  it("returns zero stats for current user when online stats are missing", async () => {
    const prisma = createPrismaMock();
    prisma.onlinePlayerStats.findUnique.mockResolvedValue(null);

    const service = new VirtualService(prisma as unknown as PrismaService);
    const result = await service.getMyStats(baseUser);

    expect(result).toEqual({
      stats: {
        userId: baseUser.id,
        displayName: "Денис",
        username: "denis",
        handsPlayed: 0,
        handsWon: 0,
        netChips: "0",
        netEstimatedMinor: "0",
        bigBlindsWon: "0",
        bbPer100Bps: 0,
        winRateBps: 0,
        avgChipsPerHand: "0",
        onlinePokerScore: 0
      }
    });
  });

  it("does not expose private cards in leaderboard or current user stats", async () => {
    const prisma = createPrismaMock();
    prisma.onlinePlayerStats.findMany.mockResolvedValue([
      createOnlinePlayerStatsRecord({
        userId: "user-a",
        handsPlayed: 10,
        netChips: 120n,
        onlinePokerScore: 90,
        user: createUserRecord({ id: "user-a", firstName: "Аня" })
      })
    ]);
    prisma.onlinePlayerStats.findUnique.mockResolvedValue(
      createOnlinePlayerStatsRecord({
        userId: baseUser.id,
        handsPlayed: 3,
        handsWon: 1,
        totalChipsWon: 120n,
        totalChipsLost: 90n,
        netChips: 30n,
        netEstimatedMinor: 300n,
        bigBlindsWon: 3n,
        bbPer100Bps: 1_000,
        winRateBps: 3_333,
        avgChipsPerHand: 10n,
        onlinePokerScore: 77,
        user: createUserRecord({ id: baseUser.id, firstName: "Денис", username: "denis" })
      })
    );

    const service = new VirtualService(prisma as unknown as PrismaService);
    const leaderboard = await service.getLeaderboard(baseUser, {
      scope: "all",
      period: "all-time",
      limit: 20,
      cursor: null
    });
    const stats = await service.getMyStats(baseUser);

    expect(leaderboard.items[0]).not.toHaveProperty("myPrivateCards");
    expect(leaderboard.items[0]).not.toHaveProperty("showdownCards");
    expect(leaderboard.items[0]).not.toHaveProperty("privateCard1");
    expect(leaderboard.items[0]).not.toHaveProperty("privateCard2");
    expect(stats.stats).not.toHaveProperty("myPrivateCards");
    expect(stats.stats).not.toHaveProperty("showdownCards");
    expect(stats.stats).not.toHaveProperty("privateCard1");
    expect(stats.stats).not.toHaveProperty("privateCard2");
  });

  it("pauses an active table for admin and resolves active turn timers", async () => {
    const prisma = createPrismaMock();
    const table = createTableRecord({
      status: VirtualTableStatus.ACTIVE,
      seats: [
        createSeatRecord({
          id: "seat-admin",
          userId: baseUser.id,
          role: VirtualSeatRole.OWNER
        })
      ]
    });

    prisma.virtualTable.findUnique.mockResolvedValue(table);
    prisma.$transaction.mockImplementation(async (callback: (tx: MockPrisma) => Promise<void>) =>
      callback(prisma)
    );

    const service = new VirtualService(prisma as unknown as PrismaService);
    const result = await service.pauseTable(baseUser, table.id);

    const updateTableCall = getFirstCall<{ data: { status: VirtualTableStatus; pausedAt: Date } }>(
      prisma.virtualTable.update
    );
    const updateTimersCall = getFirstCall<TurnTimerUpdateManyCall>(prisma.turnTimer.updateMany);
    const actionCall = getFirstCall<{ data: { actorType: ActionActorType; actionType: ActionType } }>(
      prisma.virtualAction.create
    );

    expect(result.status).toBe(VirtualTableStatus.PAUSED);
    expect(updateTableCall?.data.status).toBe(VirtualTableStatus.PAUSED);
    expect(updateTimersCall?.where.tableId).toBe(table.id);
    expect(updateTimersCall?.data.resolutionType).toBe(TurnTimerResolution.TABLE_PAUSED);
    expect(actionCall?.data.actorType).toBe(ActionActorType.ADMIN);
    expect(actionCall?.data.actionType).toBe(ActionType.TABLE_PAUSED);
  });

  it("does not allow non-admin to pause table", async () => {
    const prisma = createPrismaMock();
    const table = createTableRecord({
      status: VirtualTableStatus.ACTIVE,
      seats: [
        createSeatRecord({
          id: "seat-1",
          userId: baseUser.id,
          role: VirtualSeatRole.PLAYER
        })
      ]
    });

    prisma.virtualTable.findUnique.mockResolvedValue(table);

    const service = new VirtualService(prisma as unknown as PrismaService);

    await expect(service.pauseTable(baseUser, table.id)).rejects.toMatchObject({
      code: VIRTUAL_ERROR_CODES.forbidden,
      status: HttpStatus.FORBIDDEN
    });
  });

  it("resumes a paused table and recreates turn timer for current actor", async () => {
    const prisma = createPrismaMock();
    const table = createTableRecord({
      status: VirtualTableStatus.PAUSED,
      currentHandId: "hand-1",
      seats: [
        createSeatRecord({
          id: "seat-admin",
          userId: baseUser.id,
          role: VirtualSeatRole.OWNER
        }),
        createSeatRecord({
          id: "seat-2",
          userId: "user-2",
          seatNumber: 2
        })
      ]
    });
    const hand = createHandRecord({
      id: "hand-1",
      status: VirtualHandStatus.IN_PROGRESS,
      currentActorSeatId: "seat-2"
    });

    prisma.virtualTable.findUnique.mockResolvedValue(table);
    prisma.virtualHand.findUnique.mockResolvedValue(hand);
    prisma.$transaction.mockImplementation(async (callback: (tx: MockPrisma) => Promise<void>) =>
      callback(prisma)
    );

    const service = new VirtualService(prisma as unknown as PrismaService);
    const result = await service.resumeTable(baseUser, table.id);

    const updateTableCall = getFirstCall<{ data: { status: VirtualTableStatus; pausedAt: null } }>(
      prisma.virtualTable.update
    );
    const timerCall = getFirstCall<{ data: { handId: string; seatId: string; status: TurnTimerStatus } }>(
      prisma.turnTimer.create
    );

    expect(result.status).toBe(VirtualTableStatus.ACTIVE);
    expect(updateTableCall?.data).toEqual({
      status: VirtualTableStatus.ACTIVE,
      pausedAt: null
    });
    expect(timerCall?.data.handId).toBe("hand-1");
    expect(timerCall?.data.seatId).toBe("seat-2");
    expect(timerCall?.data.status).toBe(TurnTimerStatus.ACTIVE);
  });

  it("finishes an active table for admin, resolves timers and cancels an in-progress hand", async () => {
    const prisma = createPrismaMock();
    const table = createTableRecord({
      status: VirtualTableStatus.ACTIVE,
      currentHandId: "hand-1",
      pausedAt: new Date("2026-05-13T10:20:00.000Z"),
      seats: [
        createSeatRecord({
          id: "seat-admin",
          userId: baseUser.id,
          role: VirtualSeatRole.OWNER
        })
      ]
    });
    const hand = createHandRecord({
      id: "hand-1",
      status: VirtualHandStatus.IN_PROGRESS
    });

    prisma.virtualTable.findUnique.mockResolvedValue(table);
    prisma.virtualHand.findUnique.mockResolvedValue(hand);
    prisma.$transaction.mockImplementation(async (callback: (tx: MockPrisma) => Promise<void>) =>
      callback(prisma)
    );

    const service = new VirtualService(prisma as unknown as PrismaService);
    const result = await service.finishTable(baseUser, table.id);

    const updateTableCall = getFirstCall<
      { data: { status: VirtualTableStatus; finishedAt: Date; pausedAt: null } }
    >(prisma.virtualTable.update);
    const updateTimersCall = getFirstCall<TurnTimerUpdateManyCall>(prisma.turnTimer.updateMany);
    const updateHandCall = getFirstCall<
      { data: { status: VirtualHandStatus; completedAt: Date } }
    >(prisma.virtualHand.update);

    expect(result.tableId).toBe(table.id);
    expect(result.status).toBe(VirtualTableStatus.FINISHED);
    expect(result.currentHandId).toBe("hand-1");
    expect(result.finishedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(updateTableCall?.data.status).toBe(VirtualTableStatus.FINISHED);
    expect(updateTableCall?.data.pausedAt).toBeNull();
    expect(updateTimersCall?.where.tableId).toBe(table.id);
    expect(updateTimersCall?.data.status).toBe(TurnTimerStatus.CANCELLED);
    expect(updateHandCall?.data.status).toBe(VirtualHandStatus.CANCELLED);
    expect(updateHandCall?.data.completedAt.toISOString()).toBe(result.finishedAt);
  });

  it("returns committed chips on finish before calculating finished settlement", async () => {
    const prisma = createPrismaMock();
    const activeTable = createTableRecord({
      status: VirtualTableStatus.ACTIVE,
      currentHandId: "hand-1",
      seats: [
        createSeatRecord({
          id: "seat-admin",
          userId: baseUser.id,
          role: VirtualSeatRole.OWNER,
          seatNumber: 1,
          displayName: "Аня",
          stackChips: 900n
        }),
        createSeatRecord({
          id: "seat-2",
          userId: "user-2",
          seatNumber: 2,
          displayName: "Борис",
          stackChips: 950n,
          user: createUserRecord({ id: "user-2", firstName: "Борис" })
        }),
        createSeatRecord({
          id: "seat-3",
          userId: "user-3",
          seatNumber: 3,
          displayName: "Вера",
          stackChips: 1000n,
          user: createUserRecord({ id: "user-3", firstName: "Вера" })
        })
      ]
    });
    const inProgressHand = createHandRecord({
      id: "hand-1",
      status: VirtualHandStatus.IN_PROGRESS,
      players: [
        createHandPlayerRecord({
          id: "hand-player-1",
          seatId: "seat-admin",
          seat: activeTable.seats[0]!,
          currentStackChips: 900n,
          committedTotalChips: 100n,
          committedStreetChips: 100n
        }),
        createHandPlayerRecord({
          id: "hand-player-2",
          seatId: "seat-2",
          seat: activeTable.seats[1]!,
          currentStackChips: 950n,
          committedTotalChips: 50n,
          committedStreetChips: 50n
        }),
        createHandPlayerRecord({
          id: "hand-player-3",
          seatId: "seat-3",
          seat: activeTable.seats[2]!,
          currentStackChips: 1000n,
          committedTotalChips: 0n,
          committedStreetChips: 0n
        })
      ]
    });
    const finishedTable = createTableRecord({
      ...activeTable,
      status: VirtualTableStatus.FINISHED,
      finishedAt: new Date("2026-05-13T11:00:00.000Z"),
      seats: [
        createSeatRecord({
          ...activeTable.seats[0]!,
          stackChips: 1000n
        }),
        createSeatRecord({
          ...activeTable.seats[1]!,
          stackChips: 1000n
        }),
        createSeatRecord(activeTable.seats[2])
      ]
    });
    const cancelledHand = createHandRecord({
      ...inProgressHand,
      status: VirtualHandStatus.CANCELLED,
      currentActorSeatId: null,
      currentBetChips: 0n,
      potTotalChips: 0n,
      completedAt: new Date("2026-05-13T11:00:00.000Z")
    });

    prisma.virtualTable.findUnique.mockResolvedValueOnce(activeTable).mockResolvedValueOnce(finishedTable);
    prisma.virtualHand.findUnique.mockResolvedValueOnce(inProgressHand).mockResolvedValueOnce(cancelledHand);
    prisma.$transaction.mockImplementation(async (callback: (tx: MockPrisma) => Promise<void>) =>
      callback(prisma)
    );

    const service = new VirtualService(prisma as unknown as PrismaService);
    await service.finishTable(baseUser, activeTable.id);
    const result = await service.getTable(baseUser, activeTable.id);

    const seatUpdates = getCalls<{ where: { id: string }; data: { stackChips: bigint } }>(
      prisma.virtualSeat.update
    );
    const handPlayerUpdates = getCalls<{
      where: { id: string };
      data: {
        currentStackChips: bigint;
        committedTotalChips: bigint;
        committedStreetChips: bigint;
      };
    }>(prisma.virtualHandPlayer.update);

    expect(seatUpdates).toEqual(
      expect.arrayContaining([
        {
          where: { id: "seat-admin" },
          data: { stackChips: 1000n }
        },
        {
          where: { id: "seat-2" },
          data: { stackChips: 1000n }
        },
        {
          where: { id: "seat-3" },
          data: { stackChips: 1000n }
        }
      ])
    );
    expect(handPlayerUpdates).toEqual(
      expect.arrayContaining([
        {
          where: { id: "hand-player-1" },
          data: {
            currentStackChips: 1000n,
            committedTotalChips: 0n,
            committedStreetChips: 0n
          }
        },
        {
          where: { id: "hand-player-2" },
          data: {
            currentStackChips: 1000n,
            committedTotalChips: 0n,
            committedStreetChips: 0n
          }
        }
      ])
    );
    expect(result.settlement).toEqual({
      totalStartingStackChips: "3000",
      totalFinalStackChips: "3000",
      differenceChips: "0",
      players: [
        {
          seatId: "seat-admin",
          displayName: "Аня",
          startingStackChips: "1000",
          finalStackChips: "1000",
          netChips: "0",
          netEstimatedMinor: "0"
        },
        {
          seatId: "seat-2",
          displayName: "Борис",
          startingStackChips: "1000",
          finalStackChips: "1000",
          netChips: "0",
          netEstimatedMinor: "0"
        },
        {
          seatId: "seat-3",
          displayName: "Вера",
          startingStackChips: "1000",
          finalStackChips: "1000",
          netChips: "0",
          netEstimatedMinor: "0"
        }
      ],
      transfers: []
    });
  });

  it("allows only admins to finish a table", async () => {
    const prisma = createPrismaMock();
    const table = createTableRecord({
      status: VirtualTableStatus.ACTIVE,
      seats: [
        createSeatRecord({
          id: "seat-1",
          userId: baseUser.id,
          role: VirtualSeatRole.PLAYER
        })
      ]
    });

    prisma.virtualTable.findUnique.mockResolvedValue(table);

    const service = new VirtualService(prisma as unknown as PrismaService);

    await expect(service.finishTable(baseUser, table.id)).rejects.toMatchObject({
      code: VIRTUAL_ERROR_CODES.forbidden,
      status: HttpStatus.FORBIDDEN
    });
  });

  it("keeps a completed current hand unchanged when finishing a table", async () => {
    const prisma = createPrismaMock();
    const table = createTableRecord({
      status: VirtualTableStatus.ACTIVE,
      currentHandId: "hand-1",
      seats: [
        createSeatRecord({
          id: "seat-admin",
          userId: baseUser.id,
          role: VirtualSeatRole.ADMIN
        })
      ]
    });
    const hand = createHandRecord({
      id: "hand-1",
      status: VirtualHandStatus.COMPLETED,
      completedAt: new Date("2026-05-13T10:30:00.000Z")
    });

    prisma.virtualTable.findUnique.mockResolvedValue(table);
    prisma.virtualHand.findUnique.mockResolvedValue(hand);
    prisma.$transaction.mockImplementation(async (callback: (tx: MockPrisma) => Promise<void>) =>
      callback(prisma)
    );

    const service = new VirtualService(prisma as unknown as PrismaService);
    await service.finishTable(baseUser, table.id);

    expect(prisma.virtualHand.update).not.toHaveBeenCalled();
  });

  it("returns existing response for already finished table and conflicts for cancelled table", async () => {
    const prisma = createPrismaMock();
    const finishedAt = new Date("2026-05-13T12:30:00.000Z");
    const finishedTable = createTableRecord({
      id: "table-finished",
      status: VirtualTableStatus.FINISHED,
      currentHandId: "hand-9",
      finishedAt,
      seats: [
        createSeatRecord({
          id: "seat-admin",
          tableId: "table-finished",
          userId: baseUser.id,
          role: VirtualSeatRole.OWNER
        })
      ]
    });
    const cancelledTable = createTableRecord({
      id: "table-cancelled",
      status: VirtualTableStatus.CANCELLED,
      finishedAt: new Date("2026-05-13T12:40:00.000Z"),
      seats: [
        createSeatRecord({
          id: "seat-admin-2",
          tableId: "table-cancelled",
          userId: baseUser.id,
          role: VirtualSeatRole.OWNER
        })
      ]
    });

    prisma.virtualTable.findUnique
      .mockResolvedValueOnce(finishedTable)
      .mockResolvedValueOnce(cancelledTable);

    const service = new VirtualService(prisma as unknown as PrismaService);
    const finishedResult = await service.finishTable(baseUser, finishedTable.id);

    expect(finishedResult).toEqual({
      tableId: "table-finished",
      status: VirtualTableStatus.FINISHED,
      finishedAt: finishedAt.toISOString(),
      currentHandId: "hand-9"
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();

    await expect(service.finishTable(baseUser, cancelledTable.id)).rejects.toMatchObject({
      code: VIRTUAL_ERROR_CODES.conflict,
      status: HttpStatus.CONFLICT
    });
  });

  it("cancels a waiting table and returns idempotent response for already cancelled table", async () => {
    const prisma = createPrismaMock();
    const waitingTable = createTableRecord({
      status: VirtualTableStatus.WAITING_FOR_PLAYERS,
      seats: [
        createSeatRecord({
          id: "seat-admin",
          userId: baseUser.id,
          role: VirtualSeatRole.OWNER
        })
      ]
    });
    const cancelledAt = new Date("2026-05-13T10:45:00.000Z");
    const cancelledTable = createTableRecord({
      id: "table-cancelled",
      status: VirtualTableStatus.CANCELLED,
      finishedAt: cancelledAt,
      seats: [
        createSeatRecord({
          id: "seat-admin-2",
          tableId: "table-cancelled",
          userId: baseUser.id,
          role: VirtualSeatRole.ADMIN
        })
      ]
    });

    prisma.virtualTable.findUnique
      .mockResolvedValueOnce(waitingTable)
      .mockResolvedValueOnce(cancelledTable);
    prisma.$transaction.mockImplementation(async (callback: (tx: MockPrisma) => Promise<void>) =>
      callback(prisma)
    );

    const service = new VirtualService(prisma as unknown as PrismaService);
    const cancelledResult = await service.cancelTable(baseUser, waitingTable.id);
    const idempotentResult = await service.cancelTable(baseUser, cancelledTable.id);

    const updateTableCall = getFirstCall<
      { data: { status: VirtualTableStatus; finishedAt: Date; pausedAt: null } }
    >(prisma.virtualTable.update);
    const updateTimersCall = getFirstCall<TurnTimerUpdateManyCall>(prisma.turnTimer.updateMany);

    expect(cancelledResult.status).toBe(VirtualTableStatus.CANCELLED);
    expect(cancelledResult.currentHandId).toBeNull();
    expect(cancelledResult.finishedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(updateTableCall?.data.status).toBe(VirtualTableStatus.CANCELLED);
    expect(updateTableCall?.data.pausedAt).toBeNull();
    expect(updateTimersCall?.data.status).toBe(TurnTimerStatus.CANCELLED);
    expect(idempotentResult).toEqual({
      tableId: "table-cancelled",
      status: VirtualTableStatus.CANCELLED,
      finishedAt: cancelledAt.toISOString(),
      currentHandId: null
    });
  });

  it("rejects cancelling an active table and cancelling a finished table", async () => {
    const prisma = createPrismaMock();
    const activeTable = createTableRecord({
      id: "table-active",
      status: VirtualTableStatus.ACTIVE,
      currentHandId: "hand-1",
      seats: [
        createSeatRecord({
          id: "seat-admin",
          tableId: "table-active",
          userId: baseUser.id,
          role: VirtualSeatRole.OWNER
        })
      ]
    });
    const finishedTable = createTableRecord({
      id: "table-finished",
      status: VirtualTableStatus.FINISHED,
      finishedAt: new Date("2026-05-13T11:00:00.000Z"),
      seats: [
        createSeatRecord({
          id: "seat-admin-2",
          tableId: "table-finished",
          userId: baseUser.id,
          role: VirtualSeatRole.OWNER
        })
      ]
    });

    prisma.virtualTable.findUnique
      .mockResolvedValueOnce(activeTable)
      .mockResolvedValueOnce(finishedTable);

    const service = new VirtualService(prisma as unknown as PrismaService);

    await expect(service.cancelTable(baseUser, activeTable.id)).rejects.toMatchObject({
      code: VIRTUAL_ERROR_CODES.conflict,
      status: HttpStatus.CONFLICT
    });
    await expect(service.cancelTable(baseUser, finishedTable.id)).rejects.toMatchObject({
      code: VIRTUAL_ERROR_CODES.conflict,
      status: HttpStatus.CONFLICT
    });
  });

  it("rejects submitAction after a table is finished", async () => {
    const prisma = createPrismaMock();
    const table = createTableRecord({
      status: VirtualTableStatus.FINISHED,
      currentHandId: "hand-1",
      seats: [
        createSeatRecord({
          id: "seat-1",
          userId: baseUser.id
        })
      ]
    });

    prisma.virtualTable.findUnique.mockResolvedValue(table);

    const service = new VirtualService(prisma as unknown as PrismaService);

    await expect(
      service.submitAction(baseUser, table.id, {
        handId: "hand-1",
        actionType: "CHECK",
        idempotencyKey: "idem-finished"
      })
    ).rejects.toMatchObject({
      code: VIRTUAL_ERROR_CODES.conflict,
      status: HttpStatus.CONFLICT
    });
  });

  it("accepts whitelisted reaction and does not create a virtual action", async () => {
    const prisma = createPrismaMock();
    const createdAt = new Date("2026-05-13T10:00:08.000Z");
    const table = createTableRecord({
      status: VirtualTableStatus.ACTIVE,
      seats: [
        createSeatRecord({
          id: "seat-1",
          userId: baseUser.id,
          displayName: "Денис"
        })
      ]
    });
    const createdReaction = createVirtualTableReactionRecord({
      id: "reaction-1",
      tableId: table.id,
      seatId: "seat-1",
      userId: baseUser.id,
      emoji: "😂",
      createdAt,
      seat: table.seats[0]!
    });

    prisma.virtualTable.findUnique.mockResolvedValue(table);
    prisma.virtualTableReaction.create.mockResolvedValue(createdReaction);

    const service = new VirtualService(prisma as unknown as PrismaService);
    const result = await service.submitReaction(baseUser, table.id, {
      emoji: "😂"
    });

    const createCall = getFirstCall<{
      data: {
        tableId: string;
        seatId: string;
        userId: string;
        emoji: string;
        createdAt: Date;
      };
    }>(prisma.virtualTableReaction.create);

    expect(result).toEqual({
      reaction: {
        id: "reaction-1",
        tableId: table.id,
        seatId: "seat-1",
        userId: baseUser.id,
        displayName: "Денис",
        emoji: "😂",
        createdAt: "2026-05-13T10:00:08.000Z"
      }
    });
    expect(createCall?.data.tableId).toBe(table.id);
    expect(createCall?.data.seatId).toBe("seat-1");
    expect(createCall?.data.userId).toBe(baseUser.id);
    expect(createCall?.data.emoji).toBe("😂");
    expect(prisma.virtualAction.create).not.toHaveBeenCalled();
  });

  it("rejects reaction outside whitelist", async () => {
    const prisma = createPrismaMock();
    const table = createTableRecord({
      status: VirtualTableStatus.ACTIVE,
      seats: [
        createSeatRecord({
          id: "seat-1",
          userId: baseUser.id
        })
      ]
    });

    prisma.virtualTable.findUnique.mockResolvedValue(table);

    const service = new VirtualService(prisma as unknown as PrismaService);

    await expect(
      service.submitReaction(baseUser, table.id, {
        emoji: "🙂"
      })
    ).rejects.toMatchObject({
      code: VIRTUAL_ERROR_CODES.invalidInput,
      status: HttpStatus.BAD_REQUEST
    });
    expect(prisma.virtualTableReaction.count).not.toHaveBeenCalled();
    expect(prisma.virtualTableReaction.create).not.toHaveBeenCalled();
  });

  it("rejects reaction for non participant", async () => {
    const prisma = createPrismaMock();
    const table = createTableRecord({
      status: VirtualTableStatus.ACTIVE,
      seats: [
        createSeatRecord({
          id: "seat-2",
          userId: "user-2",
          user: createUserRecord({ id: "user-2", firstName: "Ира" })
        })
      ]
    });

    prisma.virtualTable.findUnique.mockResolvedValue(table);

    const service = new VirtualService(prisma as unknown as PrismaService);

    await expect(
      service.submitReaction(baseUser, table.id, {
        emoji: "😂"
      })
    ).rejects.toMatchObject({
      code: VIRTUAL_ERROR_CODES.forbidden,
      status: HttpStatus.FORBIDDEN
    });
    expect(prisma.virtualTableReaction.count).not.toHaveBeenCalled();
  });

  it.each([
    VirtualTableStatus.WAITING_FOR_PLAYERS,
    VirtualTableStatus.FINISHED,
    VirtualTableStatus.CANCELLED
  ])("rejects reaction when table status is %s", async (status) => {
    const prisma = createPrismaMock();
    const table = createTableRecord({
      status,
      seats: [
        createSeatRecord({
          id: "seat-1",
          userId: baseUser.id
        })
      ]
    });

    prisma.virtualTable.findUnique.mockResolvedValue(table);

    const service = new VirtualService(prisma as unknown as PrismaService);

    await expect(
      service.submitReaction(baseUser, table.id, {
        emoji: "😂"
      })
    ).rejects.toMatchObject({
      code: VIRTUAL_ERROR_CODES.conflict,
      status: HttpStatus.CONFLICT
    });
    expect(prisma.virtualTableReaction.count).not.toHaveBeenCalled();
  });

  it("rate limits the fourth reaction within 10 seconds", async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-05-13T10:00:10.000Z"));

    try {
      const prisma = createPrismaMock();
      const table = createTableRecord({
        status: VirtualTableStatus.ACTIVE,
        seats: [
          createSeatRecord({
            id: "seat-1",
            userId: baseUser.id
          })
        ]
      });

      prisma.virtualTable.findUnique.mockResolvedValue(table);
      prisma.virtualTableReaction.count.mockResolvedValue(3);

      const service = new VirtualService(prisma as unknown as PrismaService);

      await expect(
        service.submitReaction(baseUser, table.id, {
          emoji: "😂"
        })
      ).rejects.toMatchObject({
        code: VIRTUAL_ERROR_CODES.conflict,
        status: HttpStatus.TOO_MANY_REQUESTS
      });

      const countCall = getFirstCall<{
        where: {
          seatId: string;
          createdAt: {
            gte: Date;
          };
        };
      }>(prisma.virtualTableReaction.count);

      expect(countCall?.where.seatId).toBe("seat-1");
      expect(countCall?.where.createdAt.gte.toISOString()).toBe("2026-05-13T10:00:00.000Z");
      expect(prisma.virtualTableReaction.create).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it("rejects submitAction after a table is cancelled", async () => {
    const prisma = createPrismaMock();
    const table = createTableRecord({
      status: VirtualTableStatus.CANCELLED,
      currentHandId: "hand-1",
      seats: [
        createSeatRecord({
          id: "seat-1",
          userId: baseUser.id
        })
      ]
    });

    prisma.virtualTable.findUnique.mockResolvedValue(table);

    const service = new VirtualService(prisma as unknown as PrismaService);

    await expect(
      service.submitAction(baseUser, table.id, {
        handId: "hand-1",
        actionType: "CHECK",
        idempotencyKey: "idem-cancelled"
      })
    ).rejects.toMatchObject({
      code: VIRTUAL_ERROR_CODES.conflict,
      status: HttpStatus.CONFLICT
    });
    expect(prisma.virtualHand.findUnique).not.toHaveBeenCalled();
  });

  it("getTable returns only recent reactions from the last 8 seconds", async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-05-13T10:00:10.000Z"));

    try {
      const prisma = createPrismaMock();
      const table = createTableRecord({
        status: VirtualTableStatus.ACTIVE,
        seats: [
          createSeatRecord({
            id: "seat-1",
            userId: baseUser.id,
            displayName: "Денис"
          }),
          createSeatRecord({
            id: "seat-2",
            userId: "user-2",
            displayName: "Ира",
            seatNumber: 2,
            user: createUserRecord({ id: "user-2", firstName: "Ира" })
          })
        ]
      });

      prisma.virtualTable.findUnique.mockResolvedValue(table);
      prisma.virtualTableReaction.findMany.mockResolvedValue([
        createVirtualTableReactionRecord({
          id: "reaction-1",
          tableId: table.id,
          seatId: "seat-1",
          userId: baseUser.id,
          emoji: "🔥",
          createdAt: new Date("2026-05-13T10:00:03.000Z"),
          seat: table.seats[0]!
        }),
        createVirtualTableReactionRecord({
          id: "reaction-2",
          tableId: table.id,
          seatId: "seat-2",
          userId: "user-2",
          emoji: "👏",
          createdAt: new Date("2026-05-13T10:00:09.000Z"),
          seat: table.seats[1]!
        })
      ]);

      const service = new VirtualService(prisma as unknown as PrismaService);
      const result = await service.getTable(baseUser, table.id);

      const findManyCall = getFirstCall<{
        where: {
          tableId: string;
          createdAt: {
            gte: Date;
          };
        };
      }>(prisma.virtualTableReaction.findMany);

      expect(findManyCall?.where.tableId).toBe(table.id);
      expect(findManyCall?.where.createdAt.gte.toISOString()).toBe("2026-05-13T10:00:02.000Z");
      expect(result.reactions).toEqual([
        {
          id: "reaction-1",
          tableId: table.id,
          seatId: "seat-1",
          userId: baseUser.id,
          displayName: "Денис",
          emoji: "🔥",
          createdAt: "2026-05-13T10:00:03.000Z"
        },
        {
          id: "reaction-2",
          tableId: table.id,
          seatId: "seat-2",
          userId: "user-2",
          displayName: "Ира",
          emoji: "👏",
          createdAt: "2026-05-13T10:00:09.000Z"
        }
      ]);
    } finally {
      jest.useRealTimers();
    }
  });

  it("validates new blind levels before saving pending blinds", async () => {
    const prisma = createPrismaMock();
    const table = createTableRecord({
      status: VirtualTableStatus.ACTIVE,
      seats: [
        createSeatRecord({
          id: "seat-admin",
          userId: baseUser.id,
          role: VirtualSeatRole.OWNER
        })
      ]
    });

    prisma.virtualTable.findUnique.mockResolvedValue(table);

    const service = new VirtualService(prisma as unknown as PrismaService);

    await expect(
      service.raiseBlinds(baseUser, table.id, {
        smallBlindChips: "20",
        bigBlindChips: "20"
      })
    ).rejects.toMatchObject({
      code: VIRTUAL_ERROR_CODES.invalidInput,
      status: HttpStatus.BAD_REQUEST
    });
    expect(prisma.virtualTable.update).not.toHaveBeenCalled();
  });

  it("saves pending blind increase for next hand", async () => {
    const prisma = createPrismaMock();
    const table = createTableRecord({
      status: VirtualTableStatus.PAUSED,
      seats: [
        createSeatRecord({
          id: "seat-admin",
          userId: baseUser.id,
          role: VirtualSeatRole.ADMIN
        })
      ]
    });

    prisma.virtualTable.findUnique.mockResolvedValue(table);
    prisma.$transaction.mockImplementation(async (callback: (tx: MockPrisma) => Promise<void>) =>
      callback(prisma)
    );

    const service = new VirtualService(prisma as unknown as PrismaService);
    const result = await service.raiseBlinds(baseUser, table.id, {
      smallBlindChips: "15",
      bigBlindChips: "30"
    });

    const updateCall = getFirstCall<{
      data: {
        pendingSmallBlindChips: bigint;
        pendingBigBlindChips: bigint;
      };
    }>(prisma.virtualTable.update);

    expect(result).toEqual({
      pendingSmallBlindChips: "15",
      pendingBigBlindChips: "30",
      applies: "NEXT_HAND"
    });
    expect(updateCall?.data.pendingSmallBlindChips).toBe(15n);
    expect(updateCall?.data.pendingBigBlindChips).toBe(30n);
  });

  it("stores sit-out request settings for eligible seat", async () => {
    const prisma = createPrismaMock();
    const table = createTableRecord({
      status: VirtualTableStatus.ACTIVE,
      currentHandId: "hand-1",
      seats: [
        createSeatRecord({
          id: "seat-1",
          userId: baseUser.id,
          status: VirtualSeatStatus.WAITING_FOR_TURN
        })
      ]
    });

    prisma.virtualTable.findUnique.mockResolvedValue(table);
    prisma.$transaction.mockImplementation(async (callback: (tx: MockPrisma) => Promise<void>) =>
      callback(prisma)
    );

    const service = new VirtualService(prisma as unknown as PrismaService);
    const result = await service.requestSitOut(baseUser, table.id, {
      autoCheck: true,
      autoFold: false
    });

    const updateCall = getFirstCall<{
      data: {
        status: VirtualSeatStatus;
        sitOutAutoCheckEnabled: boolean;
        sitOutAutoFoldEnabled: boolean;
        hasPassedSmallBlindSinceSitOutRequest: boolean;
        hasPassedBigBlindSinceSitOutRequest: boolean;
      };
    }>(prisma.virtualSeat.update);

    expect(result).toEqual({
      seatStatus: VirtualSeatStatus.SIT_OUT_REQUESTED,
      autoCheck: true,
      autoFold: false
    });
    expect(updateCall?.data.status).toBe(VirtualSeatStatus.SIT_OUT_REQUESTED);
    expect(updateCall?.data.sitOutAutoCheckEnabled).toBe(true);
    expect(updateCall?.data.sitOutAutoFoldEnabled).toBe(false);
    expect(updateCall?.data.hasPassedSmallBlindSinceSitOutRequest).toBe(false);
    expect(updateCall?.data.hasPassedBigBlindSinceSitOutRequest).toBe(false);
  });

  it("returns active when cancelling a pending sit-out request", async () => {
    const prisma = createPrismaMock();
    const table = createTableRecord({
      seats: [
        createSeatRecord({
          id: "seat-1",
          userId: baseUser.id,
          status: VirtualSeatStatus.SIT_OUT_REQUESTED,
          sitOutRequestedAt: new Date("2026-05-13T10:10:00.000Z"),
          sitOutAutoCheckEnabled: true,
          sitOutAutoFoldEnabled: true,
          hasPassedSmallBlindSinceSitOutRequest: true,
          hasPassedBigBlindSinceSitOutRequest: false
        })
      ]
    });

    prisma.virtualTable.findUnique.mockResolvedValue(table);

    const service = new VirtualService(prisma as unknown as PrismaService);
    const result = await service.returnToTable(baseUser, table.id);

    const updateCall = getFirstCall<{
      data: {
        status: VirtualSeatStatus;
        sitOutRequestedAt: null;
        sitOutAutoCheckEnabled: boolean;
        sitOutAutoFoldEnabled: boolean;
      };
    }>(prisma.virtualSeat.update);

    expect(result).toEqual({
      seatStatus: VirtualSeatStatus.ACTIVE
    });
    expect(updateCall?.data.status).toBe(VirtualSeatStatus.ACTIVE);
    expect(updateCall?.data.sitOutRequestedAt).toBeNull();
    expect(prisma.virtualAction.create).not.toHaveBeenCalled();
  });

  it("marks sitting out seat as return requested", async () => {
    const prisma = createPrismaMock();
    const table = createTableRecord({
      currentHandId: "hand-5",
      seats: [
        createSeatRecord({
          id: "seat-1",
          userId: baseUser.id,
          status: VirtualSeatStatus.SITTING_OUT
        })
      ]
    });

    prisma.virtualTable.findUnique.mockResolvedValue(table);
    prisma.$transaction.mockImplementation(async (callback: (tx: MockPrisma) => Promise<void>) =>
      callback(prisma)
    );

    const service = new VirtualService(prisma as unknown as PrismaService);
    const result = await service.returnToTable(baseUser, table.id);

    const updateCall = getFirstCall<{ data: { status: VirtualSeatStatus; returnRequestedAt: Date } }>(
      prisma.virtualSeat.update
    );

    expect(result).toEqual({
      seatStatus: VirtualSeatStatus.RETURN_REQUESTED
    });
    expect(updateCall?.data.status).toBe(VirtualSeatStatus.RETURN_REQUESTED);
    expect(updateCall?.data.returnRequestedAt).toBeInstanceOf(Date);
  });

  it("includes sit-out requested seats in a new hand and leaves sitting out seats out", async () => {
    const prisma = createPrismaMock();
    const table = createTableRecord({
      seats: [
        createSeatRecord({
          id: "seat-admin",
          userId: baseUser.id,
          role: VirtualSeatRole.OWNER,
          seatNumber: 1
        }),
        createSeatRecord({
          id: "seat-requested",
          userId: "user-2",
          seatNumber: 2,
          status: VirtualSeatStatus.SIT_OUT_REQUESTED
        }),
        createSeatRecord({
          id: "seat-sitting-out",
          userId: "user-3",
          seatNumber: 3,
          status: VirtualSeatStatus.SITTING_OUT
        })
      ]
    });

    prisma.virtualTable.findUnique.mockResolvedValue(table);
    prisma.virtualHand.count.mockResolvedValue(0);
    prisma.virtualHand.create.mockResolvedValue(createHandRecord());
    prisma.$transaction.mockImplementation(async (callback: (tx: MockPrisma) => Promise<VirtualHand>) =>
      callback(prisma)
    );

    const service = new VirtualService(prisma as unknown as PrismaService);

    await service.startTable(baseUser, table.id);

    const handPlayersCall = getFirstCall<{ data: Array<{ seatId: string }> }>(
      prisma.virtualHandPlayer.createMany
    );

    expect(handPlayersCall?.data.map((player) => player.seatId)).toContain("seat-requested");
    expect(handPlayersCall?.data.map((player) => player.seatId)).not.toContain(
      "seat-sitting-out"
    );
  });

  it("activates return-requested seat at next hand start and clears return request timestamp", async () => {
    const prisma = createPrismaMock();
    const table = createTableRecord({
      seats: [
        createSeatRecord({
          id: "seat-admin",
          userId: baseUser.id,
          role: VirtualSeatRole.OWNER,
          seatNumber: 1
        }),
        createSeatRecord({
          id: "seat-return",
          userId: "user-2",
          seatNumber: 2,
          status: VirtualSeatStatus.RETURN_REQUESTED,
          returnRequestedAt: new Date("2026-05-13T10:12:00.000Z")
        })
      ]
    });

    prisma.virtualTable.findUnique.mockResolvedValue(table);
    prisma.virtualHand.count.mockResolvedValue(0);
    prisma.virtualHand.create.mockResolvedValue(createHandRecord());
    prisma.$transaction.mockImplementation(async (callback: (tx: MockPrisma) => Promise<VirtualHand>) =>
      callback(prisma)
    );

    const service = new VirtualService(prisma as unknown as PrismaService);

    await service.startTable(baseUser, table.id);

    const returnSeatUpdate = findCall<
      { where: { id: string }; data: { status: VirtualSeatStatus; returnRequestedAt: Date | null } }
    >(prisma.virtualSeat.update, (call) => call.where.id === "seat-return");

    expect(returnSeatUpdate?.data.status).not.toBe(VirtualSeatStatus.RETURN_REQUESTED);
    expect(returnSeatUpdate?.data.returnRequestedAt).toBeNull();
  });

  it("moves sit-out requested seat to sitting out after hand completion once both blinds were passed", async () => {
    const prisma = createPrismaMock();
    const table = createTableRecord({
      status: VirtualTableStatus.ACTIVE,
      currentHandId: "hand-1",
      seats: [
        createSeatRecord({
          id: "seat-1",
          userId: baseUser.id,
          status: VirtualSeatStatus.SIT_OUT_REQUESTED,
          hasPassedSmallBlindSinceSitOutRequest: true,
          hasPassedBigBlindSinceSitOutRequest: true
        }),
        createSeatRecord({
          id: "seat-2",
          userId: "user-2",
          seatNumber: 2
        })
      ]
    });
    const hand = createHandRecord({
      id: "hand-1",
      currentActorSeatId: "seat-1",
      currentBetChips: 10n,
      minRaiseChips: 10n,
      potTotalChips: 15n,
      players: [
        createHandPlayerRecord({
          seatId: "seat-1",
          seat: table.seats[0]!,
          currentStackChips: 995n,
          committedTotalChips: 5n,
          committedStreetChips: 5n,
          privateCard1: "AS",
          privateCard2: "KH"
        }),
        createHandPlayerRecord({
          id: "hand-player-2",
          seatId: "seat-2",
          seat: table.seats[1]!,
          currentStackChips: 990n,
          committedTotalChips: 10n,
          committedStreetChips: 10n,
          hasActedThisStreet: true,
          privateCard1: "QC",
          privateCard2: "QD"
        })
      ]
    });

    prisma.virtualTable.findUnique.mockResolvedValue(table);
    prisma.virtualHand.findUnique.mockResolvedValue(hand);
    prisma.onlinePlayerStats.findMany.mockResolvedValue([]);
    prisma.$transaction.mockImplementation(async (callback: (tx: MockPrisma) => Promise<void>) =>
      callback(prisma)
    );

    const service = new VirtualService(prisma as unknown as PrismaService);

    await service.submitAction(baseUser, table.id, {
      handId: "hand-1",
      actionType: "FOLD",
      idempotencyKey: "idem-sitout-complete"
    });

    const seatUpdate = findCall<
      { where: { id: string }; data: { status: VirtualSeatStatus; sitOutRequestedAt: Date | null } }
    >(prisma.virtualSeat.update, (call) => call.where.id === "seat-1");
    const sittingOutAction = getFirstCall<{ data: Array<{ seatId: string; actionType: ActionType }> }>(
      prisma.virtualAction.createMany
    );

    expect(seatUpdate?.data.status).toBe(VirtualSeatStatus.SITTING_OUT);
    expect(seatUpdate?.data.sitOutRequestedAt).toBeNull();
    expect(sittingOutAction?.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          seatId: "seat-1",
          actionType: ActionType.SITTING_OUT
        })
      ])
    );
  });
});

function createPrismaMock(): MockPrisma {
  return {
    virtualTable: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      count: jest.fn()
    },
    virtualSeat: {
      create: jest.fn(),
      update: jest.fn()
    },
    virtualHand: {
      count: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn()
    },
    virtualHandPlayer: {
      createMany: jest.fn(),
      update: jest.fn()
    },
    virtualAction: {
      create: jest.fn(),
      createMany: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn()
    },
    virtualTableReaction: {
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn(),
      findMany: jest.fn().mockResolvedValue([])
    },
    turnTimer: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn()
    },
    communityCard: {
      deleteMany: jest.fn(),
      createMany: jest.fn()
    },
    virtualPot: {
      deleteMany: jest.fn(),
      create: jest.fn()
    },
    onlinePlayerStats: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      upsert: jest.fn()
    },
    user: {
      findUnique: jest.fn()
    },
    $transaction: jest.fn()
  };
}

function createNotificationsMock(): Pick<
  VirtualNotificationsService,
  "sendReminderNotification" | "sendTimeoutNotification"
> {
  return {
    sendReminderNotification: jest.fn().mockResolvedValue({ sent: true }),
    sendTimeoutNotification: jest.fn().mockResolvedValue({ sent: true })
  };
}

function createClubsServiceMock() {
  return {
    createEventForVirtualTable: jest.fn(),
    sendEventInvites: jest.fn()
  };
}

function getFirstCall<T>(mockFn: { mock: { calls: unknown[][] } }): T | undefined {
  const firstCall = mockFn.mock.calls[0];

  return firstCall?.[0] as T | undefined;
}

function getCalls<T>(mockFn: { mock: { calls: unknown[][] } }): T[] {
  return mockFn.mock.calls.map((call) => call[0] as T);
}

function findCall<T>(
  mockFn: { mock: { calls: unknown[][] } },
  predicate: (call: T) => boolean
): T | undefined {
  return mockFn.mock.calls
    .map((call) => call[0] as T)
    .find((call) => predicate(call));
}

function createTableRecord(
  overrides: Partial<TableWithSeats> = {}
): TableWithSeats {
  const owner = createUserRecord();

  return {
    id: "table-1",
    ownerUserId: "user-1",
    clubId: null,
    clubEventId: null,
    scheduledStartAt: null,
    title: "Домашний кеш",
    maxSeats: 6,
    startingStackChips: 1000n,
    chipValueMinor: 10n,
    chipValueCurrency: "RUB",
    smallBlindChips: 5n,
    bigBlindChips: 10n,
    winProbabilityEnabled: false,
    pendingSmallBlindChips: null,
    pendingBigBlindChips: null,
    turnDurationSeconds: 30,
    reminderDelaySeconds: 15,
    timeoutAutoActionRule: TimeoutAutoActionRule.CHECK_OR_FOLD,
    status: VirtualTableStatus.WAITING_FOR_PLAYERS,
    inviteCode: "AB12CD34",
    currentHandId: null,
    createdAt: new Date("2026-05-13T10:00:00.000Z"),
    updatedAt: new Date("2026-05-13T10:00:00.000Z"),
    startedAt: null,
    pausedAt: null,
    finishedAt: null,
    owner,
    hands: [],
    actions: [],
    timers: [],
    seats: [createSeatRecord({ user: owner })],
    ...overrides
  };
}

type TableWithSeats = VirtualTable & {
  seats: Array<SeatWithUser>;
  owner: User;
  hands: [];
  actions: [];
  timers: [];
};

type SeatWithUser = VirtualSeat & {
  user: User;
  handPlayers?: [];
  actions?: [];
  timers?: [];
};

function createSeatRecord(overrides: Partial<SeatWithUser> = {}): SeatWithUser {
  const user = overrides.user ?? createUserRecord({ id: overrides.userId ?? "user-1" });

  return {
    id: "seat-1",
    tableId: "table-1",
    userId: "user-1",
    seatNumber: 1,
    displayName: "Денис",
    role: VirtualSeatRole.PLAYER,
    status: VirtualSeatStatus.ACTIVE,
    stackChips: 1000n,
    joinedAt: new Date("2026-05-13T10:00:00.000Z"),
    leftAt: null,
    sitOutRequestedAt: null,
    sitOutAutoCheckEnabled: false,
    sitOutAutoFoldEnabled: false,
    hasPassedSmallBlindSinceSitOutRequest: false,
    hasPassedBigBlindSinceSitOutRequest: false,
    returnRequestedAt: null,
    user,
    handPlayers: [],
    actions: [],
    timers: [],
    ...overrides
  };
}

type HandWithPlayers = VirtualHand & {
  players: Array<HandPlayerWithSeat>;
  communityCards: CommunityCard[];
  actions: [];
  timers: [];
  pots: Array<{
    id: string;
    potType: string;
    amountChips: bigint;
    capChips: bigint | null;
    eligibleSeatIdsJson: unknown;
    awards: Array<{
      winnerSeatId: string;
      amountChips: bigint;
      handRankJson: unknown;
    }>;
  }>;
  table?: VirtualTable;
};

function createHandRecord(overrides: Partial<HandWithPlayers> = {}): HandWithPlayers {
  return {
    id: "hand-1",
    tableId: "table-1",
    handNumber: 1,
    status: VirtualHandStatus.IN_PROGRESS,
    dealerSeatId: "seat-2",
    smallBlindSeatId: "seat-2",
    bigBlindSeatId: "seat-1",
    smallBlindChips: 5n,
    bigBlindChips: 10n,
    currentStreet: Street.PRE_FLOP,
    currentActorSeatId: "seat-1",
    currentBetChips: 10n,
    minRaiseChips: 10n,
    potTotalChips: 15n,
    deckSeedHash: "seed-1",
    startedAt: new Date("2026-05-13T10:05:00.000Z"),
    completedAt: null,
    players: [],
    communityCards: [],
    actions: [],
    timers: [],
    pots: [],
    ...overrides
  };
}

type HandPlayerWithSeat = VirtualHandPlayer & {
  seat: SeatWithUser;
  hand?: VirtualHand;
};

function createVirtualActionRecord(overrides: Partial<VirtualAction> = {}): VirtualAction {
  return {
    id: "virtual-action-1",
    tableId: "table-1",
    handId: "hand-1",
    seatId: "seat-1",
    idempotencyKey: null,
    actorType: ActionActorType.PLAYER,
    actionType: ActionType.CALL,
    amountChips: 5n,
    metadataJson: null,
    createdAt: new Date("2026-05-13T10:06:00.000Z"),
    ...overrides
  };
}

type VirtualTableReactionWithSeat = VirtualTableReaction & {
  seat: SeatWithUser;
};

function createVirtualTableReactionRecord(
  overrides: Partial<VirtualTableReactionWithSeat> = {}
): VirtualTableReactionWithSeat {
  return {
    id: "virtual-reaction-1",
    tableId: "table-1",
    seatId: "seat-1",
    userId: "user-1",
    emoji: "😂",
    createdAt: new Date("2026-05-13T10:00:00.000Z"),
    seat: createSeatRecord(),
    ...overrides
  };
}

function createHandPlayerRecord(
  overrides: Partial<HandPlayerWithSeat> = {}
): HandPlayerWithSeat {
  return {
    id: "hand-player-1",
    handId: "hand-1",
    seatId: "seat-1",
    status: HandPlayerStatus.ACTIVE,
    startingStackChips: 1000n,
    currentStackChips: 1000n,
    committedTotalChips: 0n,
    committedStreetChips: 0n,
    privateCard1: null,
    privateCard2: null,
    hasActedThisStreet: false,
    isEligibleForShowdown: true,
    seat: createSeatRecord(),
    ...overrides
  };
}

function createUserRecord(overrides: Partial<User> = {}): User {
  return {
    id: "user-1",
    telegramId: "100",
    username: "denis",
    firstName: "Денис",
    lastName: null,
    avatarUrl: null,
    createdAt: new Date("2026-05-13T10:00:00.000Z"),
    updatedAt: new Date("2026-05-13T10:00:00.000Z"),
    ...overrides
  };
}

function createTurnTimerRecord(overrides: Partial<TurnTimer> = {}): TurnTimer {
  return {
    id: "timer-1",
    tableId: "table-1",
    handId: "hand-1",
    seatId: "seat-1",
    status: TurnTimerStatus.ACTIVE,
    startedAt: new Date("2026-05-13T10:05:00.000Z"),
    reminderDueAt: new Date("2026-05-13T10:05:15.000Z"),
    expiresAt: new Date("2026-05-13T10:05:30.000Z"),
    remindedAt: null,
    resolvedAt: null,
    resolutionType: null,
    ...overrides
  };
}

function createCommunityCardRecord(
  overrides: Partial<CommunityCard> = {}
): CommunityCard {
  return {
    id: "community-card-1",
    handId: "hand-1",
    street: Street.FLOP,
    card: "2C",
    position: 0,
    ...overrides
  };
}

function createOnlinePlayerStatsRecord(
  overrides: Partial<OnlinePlayerStats> & {
    userId: string;
    user: User;
  }
): OnlinePlayerStats & { user: User } {
  return {
    userId: overrides.userId,
    handsPlayed: overrides.handsPlayed ?? 0,
    handsWon: overrides.handsWon ?? 0,
    totalChipsWon: overrides.totalChipsWon ?? 0n,
    totalChipsLost: overrides.totalChipsLost ?? 0n,
    netChips: overrides.netChips ?? 0n,
    netEstimatedMinor: overrides.netEstimatedMinor ?? 0n,
    bigBlindsWon: overrides.bigBlindsWon ?? 0n,
    bbPer100Bps: overrides.bbPer100Bps ?? 0,
    winRateBps: overrides.winRateBps ?? 0,
    avgChipsPerHand: overrides.avgChipsPerHand ?? 0n,
    onlinePokerScore: overrides.onlinePokerScore ?? 0,
    updatedAt: overrides.updatedAt ?? new Date("2026-05-13T10:00:00.000Z"),
    user: overrides.user
  };
}

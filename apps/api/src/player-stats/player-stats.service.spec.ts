import { HttpStatus } from "@nestjs/common";
import { RoomStatus } from "@prisma/client";
import type { UserDto } from "@pokertable/shared";
import { PrismaService } from "../prisma/prisma.service";
import { PlayerStatsService } from "./player-stats.service";

type MockPrisma = {
  user: {
    findUnique: jest.Mock;
  };
  onlinePlayerStats: {
    findUnique: jest.Mock;
  };
  roomPlayer: {
    findMany: jest.Mock;
    findFirst: jest.Mock;
  };
  virtualSeat: {
    findMany: jest.Mock;
    findFirst: jest.Mock;
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

describe("PlayerStatsService", () => {
  it("sorts the global leaderboard by poker score", async () => {
    const prisma = createPrismaMock();

    prisma.roomPlayer.findMany
      .mockResolvedValueOnce([{ userId: "user-b" }, { userId: "user-a" }, { userId: "user-c" }])
      .mockResolvedValueOnce([
        createClosedParticipationRecord({
          userId: "user-a",
          firstName: "Анна",
          roomId: "room-a",
          totalBuyinMinor: 100000n,
          netResultMinor: 100000n
        }),
        createClosedParticipationRecord({
          userId: "user-b",
          firstName: "Борис",
          roomId: "room-b",
          totalBuyinMinor: 100000n,
          netResultMinor: -100000n
        }),
        createClosedParticipationRecord({
          userId: "user-c",
          firstName: "Саша",
          roomId: "room-c-1",
          totalBuyinMinor: 100000n,
          netResultMinor: 50000n,
          closedAt: new Date("2026-05-11T12:00:00.000Z")
        }),
        createClosedParticipationRecord({
          userId: "user-c",
          firstName: "Саша",
          roomId: "room-c-2",
          totalBuyinMinor: 100000n,
          netResultMinor: 20000n,
          closedAt: new Date("2026-05-10T12:00:00.000Z")
        }),
        createClosedParticipationRecord({
          userId: "user-c",
          firstName: "Саша",
          roomId: "room-c-3",
          totalBuyinMinor: 100000n,
          netResultMinor: 10000n,
          closedAt: new Date("2026-05-09T12:00:00.000Z")
        })
      ]);

    const service = new PlayerStatsService(prisma as unknown as PrismaService);

    const result = await service.getLeaderboard(baseUser, {
      scope: "all",
      period: "all-time",
      limit: 10,
      cursor: null
    });

    expect(result.items.map((item) => item.userId)).toEqual(["user-a", "user-c", "user-b"]);
    expect(result.items.map((item) => item.rank)).toEqual([1, 2, 3]);
  });

  it("excludes unrelated players from the played-with-me leaderboard", async () => {
    const prisma = createPrismaMock();

    prisma.roomPlayer.findMany
      .mockResolvedValueOnce([{ roomId: "shared-room" }])
      .mockResolvedValueOnce([{ userId: "user-1" }, { userId: "user-2" }])
      .mockResolvedValueOnce([
        createClosedParticipationRecord({
          userId: "user-1",
          firstName: "Денис",
          roomId: "shared-room",
          totalBuyinMinor: 100000n,
          netResultMinor: 20000n
        }),
        createClosedParticipationRecord({
          userId: "user-2",
          firstName: "Илья",
          roomId: "shared-room",
          totalBuyinMinor: 100000n,
          netResultMinor: 40000n
        })
      ]);

    const service = new PlayerStatsService(prisma as unknown as PrismaService);

    const result = await service.getLeaderboard(baseUser, {
      scope: "played-with-me",
      period: "all-time",
      limit: 10,
      cursor: null
    });

    expect(result.items.map((item) => item.userId)).toEqual(["user-2", "user-1"]);
    expect(result.items.find((item) => item.userId === "user-3")).toBeUndefined();
  });

  it("forbids opening a profile for an unrelated player", async () => {
    const prisma = createPrismaMock();

    prisma.user.findUnique.mockResolvedValue({
      id: "user-2",
      username: "ilya",
      firstName: "Илья"
    });
    prisma.roomPlayer.findMany.mockResolvedValue([{ roomId: "shared-room" }]);
    prisma.roomPlayer.findFirst.mockResolvedValue(null);
    prisma.virtualSeat.findMany.mockResolvedValue([]);

    const service = new PlayerStatsService(prisma as unknown as PrismaService);

    await expect(service.getPlayerProfile(baseUser, "user-2")).rejects.toMatchObject({
      status: HttpStatus.FORBIDDEN,
      response: {
        error: {
          code: "PLAYER_ACCESS_DENIED"
        }
      }
    });
    expect(prisma.roomPlayer.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.virtualSeat.findMany).toHaveBeenCalledTimes(1);
  });

  it("keeps recent games sorted from new to old and includes cumulative profit for chart points", async () => {
    const prisma = createPrismaMock();

    prisma.user.findUnique.mockResolvedValue({
      id: "user-2",
      username: "ilya",
      firstName: "Илья"
    });
    prisma.roomPlayer.findMany
      .mockResolvedValueOnce([{ roomId: "shared-room" }])
      .mockResolvedValueOnce([
        createClosedParticipationRecord({
          userId: "user-2",
          firstName: "Илья",
          roomId: "room-newest",
          totalBuyinMinor: 10000n,
          netResultMinor: 3000n,
          closedAt: new Date("2026-05-12T12:00:00.000Z")
        }),
        createClosedParticipationRecord({
          userId: "user-2",
          firstName: "Илья",
          roomId: "room-middle",
          totalBuyinMinor: 10000n,
          netResultMinor: -2000n,
          closedAt: new Date("2026-05-11T12:00:00.000Z")
        }),
        createClosedParticipationRecord({
          userId: "user-2",
          firstName: "Илья",
          roomId: "room-oldest",
          totalBuyinMinor: 10000n,
          netResultMinor: 5000n,
          closedAt: new Date("2026-05-10T12:00:00.000Z")
        })
      ]);
    prisma.roomPlayer.findFirst.mockResolvedValue({ id: "shared-membership" });

    const service = new PlayerStatsService(prisma as unknown as PrismaService);

    const result = await service.getPlayerProfile(baseUser, "user-2");

    expect(result.recentGames.map((game) => game.roomId)).toEqual([
      "room-newest",
      "room-middle",
      "room-oldest"
    ]);
    expect(result.recentGames.map((game) => game.myNetResultMinor)).toEqual([
      "3000",
      "-2000",
      "5000"
    ]);
    expect(result.recentGames.map((game) => game.cumulativeProfitMinor)).toEqual([
      "6000",
      "3000",
      "5000"
    ]);
  });

  it("includes existing online stats in player profile", async () => {
    const prisma = createPrismaMock();

    prisma.user.findUnique.mockResolvedValue({
      id: "user-2",
      username: "ilya",
      firstName: "Илья"
    });
    prisma.roomPlayer.findMany
      .mockResolvedValueOnce([{ roomId: "shared-room" }])
      .mockResolvedValueOnce([
        createClosedParticipationRecord({
          userId: "user-2",
          firstName: "Илья",
          roomId: "shared-room",
          totalBuyinMinor: 10000n,
          netResultMinor: 3000n
        })
      ]);
    prisma.roomPlayer.findFirst.mockResolvedValue({ id: "shared-membership" });
    prisma.onlinePlayerStats.findUnique.mockResolvedValue({
      userId: "user-2",
      handsPlayed: 120,
      handsWon: 28,
      netChips: 450n,
      netEstimatedMinor: 4500n,
      bigBlindsWon: 45n,
      bbPer100Bps: 375,
      winRateBps: 2333,
      avgChipsPerHand: 4n,
      onlinePokerScore: 87
    });

    const service = new PlayerStatsService(prisma as unknown as PrismaService);

    const result = await service.getPlayerProfile(baseUser, "user-2");

    expect(result.onlineStats).toEqual({
      userId: "user-2",
      displayName: "Илья",
      username: "ilya",
      handsPlayed: 120,
      handsWon: 28,
      netChips: "450",
      netEstimatedMinor: "4500",
      bigBlindsWon: "45",
      bbPer100Bps: 375,
      winRateBps: 2333,
      avgChipsPerHand: "4",
      onlinePokerScore: 87
    });
  });

  it("returns zero online stats when player has no online record", async () => {
    const prisma = createPrismaMock();

    prisma.user.findUnique.mockResolvedValue({
      id: "user-2",
      username: "ilya",
      firstName: "Илья"
    });
    prisma.roomPlayer.findMany
      .mockResolvedValueOnce([{ roomId: "shared-room" }])
      .mockResolvedValueOnce([]);
    prisma.roomPlayer.findFirst.mockResolvedValue({ id: "shared-membership" });
    prisma.onlinePlayerStats.findUnique.mockResolvedValue(null);

    const service = new PlayerStatsService(prisma as unknown as PrismaService);

    const result = await service.getPlayerProfile(baseUser, "user-2");

    expect(result.onlineStats).toEqual({
      userId: "user-2",
      displayName: "Илья",
      username: "ilya",
      handsPlayed: 0,
      handsWon: 0,
      netChips: "0",
      netEstimatedMinor: "0",
      bigBlindsWon: "0",
      bbPer100Bps: 0,
      winRateBps: 0,
      avgChipsPerHand: "0",
      onlinePokerScore: 0
    });
  });

  it("allows profile access for players with a shared virtual table", async () => {
    const prisma = createPrismaMock();

    prisma.user.findUnique.mockResolvedValue({
      id: "user-2",
      username: "ilya",
      firstName: "Илья"
    });
    prisma.roomPlayer.findMany.mockResolvedValue([]);
    prisma.virtualSeat.findMany.mockResolvedValue([{ tableId: "table-1" }]);
    prisma.virtualSeat.findFirst.mockResolvedValue({ id: "shared-seat" });
    prisma.onlinePlayerStats.findUnique.mockResolvedValue(null);

    const service = new PlayerStatsService(prisma as unknown as PrismaService);

    const result = await service.getPlayerProfile(baseUser, "user-2");

    expect(result.user.id).toBe("user-2");
    expect(prisma.virtualSeat.findMany).toHaveBeenCalledWith({
      where: {
        userId: "user-1"
      },
      select: {
        tableId: true
      },
      distinct: ["tableId"]
    });
    expect(prisma.virtualSeat.findFirst).toHaveBeenCalledWith({
      where: {
        userId: "user-2",
        tableId: {
          in: ["table-1"]
        }
      },
      select: {
        id: true
      }
    });
  });

  it("still denies profile access when players have neither shared room nor virtual table", async () => {
    const prisma = createPrismaMock();

    prisma.user.findUnique.mockResolvedValue({
      id: "user-2",
      username: "ilya",
      firstName: "Илья"
    });
    prisma.roomPlayer.findMany.mockResolvedValue([]);
    prisma.virtualSeat.findMany.mockResolvedValue([]);

    const service = new PlayerStatsService(prisma as unknown as PrismaService);

    await expect(service.getPlayerProfile(baseUser, "user-2")).rejects.toMatchObject({
      status: HttpStatus.FORBIDDEN,
      response: {
        error: {
          code: "PLAYER_ACCESS_DENIED"
        }
      }
    });
    expect(prisma.virtualSeat.findFirst).not.toHaveBeenCalled();
  });
});

function createPrismaMock(): MockPrisma {
  return {
    user: {
      findUnique: jest.fn()
    },
    onlinePlayerStats: {
      findUnique: jest.fn()
    },
    roomPlayer: {
      findMany: jest.fn(),
      findFirst: jest.fn()
    },
    virtualSeat: {
      findMany: jest.fn(),
      findFirst: jest.fn()
    }
  };
}

function createClosedParticipationRecord({
  userId,
  firstName,
  roomId,
  totalBuyinMinor,
  netResultMinor,
  closedAt = new Date("2026-05-11T12:00:00.000Z")
}: {
  userId: string;
  firstName: string;
  roomId: string;
  totalBuyinMinor: bigint;
  netResultMinor: bigint;
  closedAt?: Date;
}): Record<string, unknown> {
  const chipsPerCurrencyUnit = 10;
  const totalBuyinChips = totalBuyinMinor / BigInt(chipsPerCurrencyUnit);
  const finalAmountMinor = totalBuyinMinor + netResultMinor;
  const finalAmountChips = finalAmountMinor / BigInt(chipsPerCurrencyUnit);
  const netResultChips = netResultMinor / BigInt(chipsPerCurrencyUnit);

  return {
    userId,
    finalAmountChips,
    finalAmountMinor,
    netResultChips,
    netResultMinor,
    rebuyEvents: [],
    user: {
      id: userId,
      username: userId,
      firstName
    },
    room: {
      id: roomId,
      title: "Вечерняя игра",
      currency: "RUB",
      buyInChips: totalBuyinChips,
      rebuyChips: totalBuyinChips,
      chipsPerCurrencyUnit,
      rebuyAmountMinor: totalBuyinMinor,
      closedAt,
      status: RoomStatus.CLOSED,
      players: [{ id: `${roomId}-player-1` }, { id: `${roomId}-player-2` }]
    }
  };
}

import { HttpStatus } from "@nestjs/common";
import { RoomStatus } from "@prisma/client";
import type { UserDto } from "@pokertable/shared";
import { PrismaService } from "../prisma/prisma.service";
import { PlayerStatsService } from "./player-stats.service";

type MockPrisma = {
  user: {
    findUnique: jest.Mock;
  };
  roomPlayer: {
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
  });
});

function createPrismaMock(): MockPrisma {
  return {
    user: {
      findUnique: jest.fn()
    },
    roomPlayer: {
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
  return {
    userId,
    finalAmountMinor: totalBuyinMinor + netResultMinor,
    netResultMinor,
    rebuyEvents: [
      {
        amountMinor: totalBuyinMinor
      }
    ],
    user: {
      id: userId,
      username: userId,
      firstName
    },
    room: {
      id: roomId,
      title: "Вечерняя игра",
      currency: "RUB",
      rebuyAmountMinor: totalBuyinMinor,
      closedAt,
      status: RoomStatus.CLOSED,
      players: [{ id: `${roomId}-player-1` }, { id: `${roomId}-player-2` }]
    }
  };
}

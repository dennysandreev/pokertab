import {
  calculatePlayerStats,
  compareLeaderboardStats,
  type ClosedGameStatRow
} from "./player-stats-calculations";

describe("player-stats calculations", () => {
  it("keeps a perfect single game score below the maximum because volume confidence is low", () => {
    const stats = calculatePlayerStats([createClosedGameStatRow()]);

    expect(stats).not.toBeNull();
    expect(stats?.gamesCount).toBe(1);
    expect(stats?.pokerScore).toBe(92);
  });

  it("does not give a high score to a player with negative ROI", () => {
    const stats = calculatePlayerStats([
      createClosedGameStatRow({
        totalBuyinMinor: 100000n,
        netResultMinor: -100000n
      })
    ]);

    expect(stats).not.toBeNull();
    expect(stats?.roiBps).toBe(-10000);
    expect(stats?.pokerScore).toBe(22);
  });

  it("sorts leaderboard entries by poker score, then games count, then profit, then user id", () => {
    const items = [
      {
        userId: "user-b",
        pokerScore: 80,
        gamesCount: 5,
        totalProfitMinor: 100n
      },
      {
        userId: "user-a",
        pokerScore: 80,
        gamesCount: 5,
        totalProfitMinor: 100n
      },
      {
        userId: "user-e",
        pokerScore: 80,
        gamesCount: 5,
        totalProfitMinor: 200n
      },
      {
        userId: "user-c",
        pokerScore: 80,
        gamesCount: 6,
        totalProfitMinor: 0n
      },
      {
        userId: "user-d",
        pokerScore: 90,
        gamesCount: 1,
        totalProfitMinor: -100n
      }
    ];

    items.sort(compareLeaderboardStats);

    expect(items.map((item) => item.userId)).toEqual([
      "user-d",
      "user-c",
      "user-e",
      "user-a",
      "user-b"
    ]);
  });
});

function createClosedGameStatRow(
  overrides: Partial<ClosedGameStatRow> = {}
): ClosedGameStatRow {
  return {
    userId: "user-1",
    displayName: "Денис",
    username: "denis",
    roomId: "room-1",
    title: "Домашняя игра",
    currency: "RUB",
    closedAt: new Date("2026-05-11T12:00:00.000Z"),
    rebuyAmountMinor: 100000n,
    totalBuyinMinor: 100000n,
    finalAmountMinor: 200000n,
    netResultMinor: 100000n,
    playersCount: 4,
    ...overrides
  };
}

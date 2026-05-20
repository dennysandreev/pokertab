import type { OnlinePlayerStats } from "@prisma/client";
import {
  calculateCompletedVirtualHandStats,
  type OnlinePlayerStatsSnapshot
} from "./virtual-stats";

describe("calculateCompletedVirtualHandStats", () => {
  it("calculates wins, losses, net chips and win rate for a completed hand", () => {
    const result = calculateCompletedVirtualHandStats({
      players: [
        {
          userId: "user-1",
          startingStackChips: 100n,
          finalStackChips: 150n
        },
        {
          userId: "user-2",
          startingStackChips: 100n,
          finalStackChips: 85n
        },
        {
          userId: "user-3",
          startingStackChips: 100n,
          finalStackChips: 100n
        }
      ],
      bigBlindChips: 10n,
      chipValueMinor: 2n
    });

    expect(result).toEqual([
      expect.objectContaining({
        userId: "user-1",
        handsPlayed: 1,
        handsWon: 1,
        totalChipsWon: 50n,
        totalChipsLost: 0n,
        netChips: 50n,
        netEstimatedMinor: 100n,
        bigBlindsWon: 5n,
        bbPer100Bps: 50_000,
        winRateBps: 10_000,
        avgChipsPerHand: 50n,
        onlinePokerScore: 100
      }),
      expect.objectContaining({
        userId: "user-2",
        handsPlayed: 1,
        handsWon: 0,
        totalChipsWon: 0n,
        totalChipsLost: 15n,
        netChips: -15n,
        netEstimatedMinor: -30n,
        bigBlindsWon: -1n,
        bbPer100Bps: -10_000,
        winRateBps: 0,
        avgChipsPerHand: -15n,
        onlinePokerScore: 0
      }),
      expect.objectContaining({
        userId: "user-3",
        handsPlayed: 1,
        handsWon: 0,
        totalChipsWon: 0n,
        totalChipsLost: 0n,
        netChips: 0n,
        netEstimatedMinor: 0n,
        bigBlindsWon: 0n,
        bbPer100Bps: 0,
        winRateBps: 0,
        avgChipsPerHand: 0n,
        onlinePokerScore: 0
      })
    ]);
  });

  it("accumulates onto existing stats and keeps sub-big-blind deltas truncated toward zero", () => {
    const existingByUserId = new Map<string, OnlinePlayerStatsSnapshot>([
      [
        "user-1",
        createOnlinePlayerStatsSnapshot({
          userId: "user-1",
          handsPlayed: 2,
          handsWon: 1,
          totalChipsWon: 30n,
          totalChipsLost: 20n,
          netChips: 10n,
          netEstimatedMinor: 40n,
          bigBlindsWon: 1n,
          bbPer100Bps: 5_000,
          winRateBps: 5_000,
          avgChipsPerHand: 5n,
          onlinePokerScore: 37
        })
      ]
    ]);

    const [result] = calculateCompletedVirtualHandStats({
      players: [
        {
          userId: "user-1",
          startingStackChips: 100n,
          finalStackChips: 95n
        }
      ],
      bigBlindChips: 10n,
      existingByUserId
    });

    expect(result).toEqual(
      expect.objectContaining({
        userId: "user-1",
        handsPlayed: 3,
        handsWon: 1,
        totalChipsWon: 30n,
        totalChipsLost: 25n,
        netChips: 5n,
        netEstimatedMinor: 40n,
        bigBlindsWon: 1n,
        bbPer100Bps: 3_333,
        winRateBps: 3_333,
        avgChipsPerHand: 1n
      })
    );
  });
});

function createOnlinePlayerStatsSnapshot(
  overrides: Partial<OnlinePlayerStats> & Pick<OnlinePlayerStats, "userId">
): OnlinePlayerStatsSnapshot {
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
    onlinePokerScore: overrides.onlinePokerScore ?? 0
  };
}

import type { OnlinePlayerStats } from "@prisma/client";

export type OnlinePlayerStatsSnapshot = Pick<
  OnlinePlayerStats,
  | "userId"
  | "handsPlayed"
  | "handsWon"
  | "totalChipsWon"
  | "totalChipsLost"
  | "netChips"
  | "netEstimatedMinor"
  | "bigBlindsWon"
  | "bbPer100Bps"
  | "winRateBps"
  | "avgChipsPerHand"
  | "onlinePokerScore"
>;

export type CompletedVirtualHandStatsPlayer = {
  userId: string;
  startingStackChips: bigint;
  finalStackChips: bigint;
};

type CalculateCompletedVirtualHandStatsInput = {
  players: CompletedVirtualHandStatsPlayer[];
  bigBlindChips: bigint;
  chipValueMinor?: bigint | null;
  existingByUserId?: ReadonlyMap<string, OnlinePlayerStatsSnapshot>;
};

export function calculateCompletedVirtualHandStats({
  players,
  bigBlindChips,
  chipValueMinor,
  existingByUserId
}: CalculateCompletedVirtualHandStatsInput): OnlinePlayerStatsSnapshot[] {
  if (bigBlindChips <= 0n) {
    throw new Error("bigBlindChips must be positive");
  }

  return players.map((player) => {
    const current = existingByUserId?.get(player.userId) ?? createEmptyOnlinePlayerStats(player.userId);
    const deltaChips = player.finalStackChips - player.startingStackChips;
    const handsPlayed = current.handsPlayed + 1;
    const handsWon = current.handsWon + (deltaChips > 0n ? 1 : 0);
    const totalChipsWon =
      current.totalChipsWon + (deltaChips > 0n ? deltaChips : 0n);
    const totalChipsLost =
      current.totalChipsLost + (deltaChips < 0n ? -deltaChips : 0n);
    const netChips = current.netChips + deltaChips;
    const netEstimatedMinor =
      chipValueMinor === null || chipValueMinor === undefined
        ? current.netEstimatedMinor
        : current.netEstimatedMinor + deltaChips * chipValueMinor;
    // We keep whole big blinds only. BigInt division truncates toward zero.
    const bigBlindsWon = current.bigBlindsWon + deltaChips / bigBlindChips;
    const bbPer100Bps = divideBigIntToInt(bigBlindsWon * 10_000n, BigInt(handsPlayed));
    const winRateBps = Math.trunc((handsWon * 10_000) / handsPlayed);
    const avgChipsPerHand = netChips / BigInt(handsPlayed);

    return {
      userId: player.userId,
      handsPlayed,
      handsWon,
      totalChipsWon,
      totalChipsLost,
      netChips,
      netEstimatedMinor,
      bigBlindsWon,
      bbPer100Bps,
      winRateBps,
      avgChipsPerHand,
      onlinePokerScore: calculateOnlinePokerScore(winRateBps, bbPer100Bps)
    };
  });
}

export function toOnlinePlayerStatsUpsertData(
  stats: OnlinePlayerStatsSnapshot
): Omit<OnlinePlayerStatsSnapshot, "userId"> {
  return {
    handsPlayed: stats.handsPlayed,
    handsWon: stats.handsWon,
    totalChipsWon: stats.totalChipsWon,
    totalChipsLost: stats.totalChipsLost,
    netChips: stats.netChips,
    netEstimatedMinor: stats.netEstimatedMinor,
    bigBlindsWon: stats.bigBlindsWon,
    bbPer100Bps: stats.bbPer100Bps,
    winRateBps: stats.winRateBps,
    avgChipsPerHand: stats.avgChipsPerHand,
    onlinePokerScore: stats.onlinePokerScore
  };
}

function createEmptyOnlinePlayerStats(userId: string): OnlinePlayerStatsSnapshot {
  return {
    userId,
    handsPlayed: 0,
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
  };
}

function divideBigIntToInt(dividend: bigint, divisor: bigint): number {
  return Number(dividend / divisor);
}

function calculateOnlinePokerScore(winRateBps: number, bbPer100Bps: number): number {
  const winRateComponent = Math.trunc((winRateBps * 70) / 10_000);
  const positiveBbPer100 = bbPer100Bps > 0 ? Math.trunc(bbPer100Bps / 100) : 0;
  const bbComponent = Math.min(30, Math.trunc(positiveBbPer100 / 2));

  return clamp(winRateComponent + bbComponent, 0, 100);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

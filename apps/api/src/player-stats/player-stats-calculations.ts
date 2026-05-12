export type ClosedGameStatRow = {
  userId: string;
  displayName: string;
  username: string | null;
  roomId: string;
  title: string;
  currency: string;
  closedAt: Date;
  rebuyAmountMinor: bigint;
  totalBuyinMinor: bigint;
  finalAmountMinor: bigint;
  netResultMinor: bigint;
  playersCount: number;
};

export type CalculatedPlayerStats = {
  gamesCount: number;
  totalBuyinsMinor: bigint;
  totalProfitMinor: bigint;
  avgProfitMinor: bigint;
  roiBps: number;
  winRateBps: number;
  stabilityScoreBps: number;
  pokerScore: number;
  bestGameMinor: bigint;
  worstGameMinor: bigint;
};

export type LeaderboardSortableStats = Pick<
  CalculatedPlayerStats,
  "gamesCount" | "totalProfitMinor" | "pokerScore"
> & {
  userId: string;
};

export function calculatePlayerStats(
  rows: ClosedGameStatRow[]
): CalculatedPlayerStats | null {
  if (rows.length === 0) {
    return null;
  }

  let totalBuyinsMinor = 0n;
  let totalProfitMinor = 0n;
  let positiveGames = 0;
  let stableGames = 0;
  let bestGameMinor = rows[0]!.netResultMinor;
  let worstGameMinor = rows[0]!.netResultMinor;

  for (const row of rows) {
    totalBuyinsMinor += row.totalBuyinMinor;
    totalProfitMinor += row.netResultMinor;

    if (row.netResultMinor > 0n) {
      positiveGames += 1;
    }

    if (row.netResultMinor >= row.rebuyAmountMinor * -1n) {
      stableGames += 1;
    }

    if (row.netResultMinor > bestGameMinor) {
      bestGameMinor = row.netResultMinor;
    }

    if (row.netResultMinor < worstGameMinor) {
      worstGameMinor = row.netResultMinor;
    }
  }

  const gamesCount = rows.length;
  const avgProfitMinor = totalProfitMinor / BigInt(gamesCount);
  const roiBps =
    totalBuyinsMinor === 0n
      ? 0
      : toSafeNumber((totalProfitMinor * 10000n) / totalBuyinsMinor);
  const winRateBps = Math.round((positiveGames / gamesCount) * 10000);
  const stabilityScoreBps = Math.round((stableGames / gamesCount) * 10000);
  const roiScore = normalizeRoiToScore(roiBps);
  const pokerScore = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        roiScore * 0.4 +
          (winRateBps / 100) * 0.3 +
          (stabilityScoreBps / 100) * 0.2 +
          volumeConfidence(gamesCount) * 0.1
      )
    )
  );

  return {
    gamesCount,
    totalBuyinsMinor,
    totalProfitMinor,
    avgProfitMinor,
    roiBps,
    winRateBps,
    stabilityScoreBps,
    pokerScore,
    bestGameMinor,
    worstGameMinor
  };
}

export function volumeConfidence(gamesCount: number): number {
  if (gamesCount <= 0) {
    return 0;
  }

  if (gamesCount <= 2) {
    return 20;
  }

  if (gamesCount <= 5) {
    return 50;
  }

  if (gamesCount <= 10) {
    return 75;
  }

  return 100;
}

export function normalizeRoiToScore(roiBps: number): number {
  const min = -5000;
  const max = 5000;
  const clamped = Math.max(min, Math.min(max, roiBps));

  return Math.round(((clamped - min) / (max - min)) * 100);
}

export function compareLeaderboardStats(
  left: LeaderboardSortableStats,
  right: LeaderboardSortableStats
): number {
  if (left.pokerScore !== right.pokerScore) {
    return right.pokerScore - left.pokerScore;
  }

  if (left.gamesCount !== right.gamesCount) {
    return right.gamesCount - left.gamesCount;
  }

  if (left.totalProfitMinor !== right.totalProfitMinor) {
    return left.totalProfitMinor > right.totalProfitMinor ? -1 : 1;
  }

  return left.userId.localeCompare(right.userId);
}

function toSafeNumber(value: bigint): number {
  const max = BigInt(Number.MAX_SAFE_INTEGER);
  const min = BigInt(Number.MIN_SAFE_INTEGER);

  if (value > max) {
    return Number.MAX_SAFE_INTEGER;
  }

  if (value < min) {
    return Number.MIN_SAFE_INTEGER;
  }

  return Number(value);
}

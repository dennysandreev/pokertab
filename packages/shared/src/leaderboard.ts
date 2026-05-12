export const LEADERBOARD_SCOPES = ["all", "played-with-me"] as const;

export type LeaderboardScope = (typeof LEADERBOARD_SCOPES)[number];

export const LEADERBOARD_PERIODS = ["all-time", "month", "last-10"] as const;

export type LeaderboardPeriod = (typeof LEADERBOARD_PERIODS)[number];

export type GetLeaderboardQueryDto = {
  scope: LeaderboardScope;
  period: LeaderboardPeriod;
  limit: number;
  cursor: string | null;
};

export type LeaderboardItemDto = {
  rank: number;
  userId: string;
  displayName: string;
  totalBuyinsMinor: string;
  totalProfitMinor: string;
  gamesCount: number;
  roiBps: number;
  winRateBps: number;
  stabilityScoreBps: number;
  avgProfitMinor: string;
  pokerScore: number;
};

export type GetLeaderboardResponseDto = {
  items: LeaderboardItemDto[];
  nextCursor: string | null;
};

export type PlayerProfileUserDto = {
  id: string;
  displayName: string;
  username: string | null;
};

export type PlayerProfileStatsDto = {
  gamesCount: number;
  totalBuyinsMinor: string;
  totalProfitMinor: string;
  roiBps: number;
  winRateBps: number;
  stabilityScoreBps: number;
  avgProfitMinor: string;
  pokerScore: number;
  bestGameMinor: string;
  worstGameMinor: string;
};

export type RecentPlayerGameDto = {
  roomId: string;
  title: string;
  status: "CLOSED";
  closedAt: string;
  myNetResultMinor: string;
  playersCount: number;
  currency: string;
};

export type GetPlayerProfileResponseDto = {
  user: PlayerProfileUserDto;
  stats: PlayerProfileStatsDto;
  recentGames: RecentPlayerGameDto[];
};

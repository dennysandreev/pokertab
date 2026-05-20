import type { LeaderboardPeriod, LeaderboardScope } from "./leaderboard.js";

export const VIRTUAL_TABLE_STATUSES = [
  "WAITING_FOR_PLAYERS",
  "ACTIVE",
  "PAUSED",
  "FINISHED",
  "CANCELLED"
] as const;

export type VirtualTableStatus = (typeof VIRTUAL_TABLE_STATUSES)[number];

export const VIRTUAL_SEAT_ROLES = ["OWNER", "ADMIN", "PLAYER"] as const;

export type VirtualSeatRole = (typeof VIRTUAL_SEAT_ROLES)[number];

export const VIRTUAL_SEAT_STATUSES = [
  "ACTIVE",
  "WAITING_FOR_TURN",
  "ACTING",
  "FOLDED",
  "ALL_IN",
  "SIT_OUT_REQUESTED",
  "SITTING_OUT",
  "RETURN_REQUESTED",
  "LEFT",
  "NO_CHIPS"
] as const;

export type VirtualSeatStatus = (typeof VIRTUAL_SEAT_STATUSES)[number];

export const VIRTUAL_HAND_STATUSES = [
  "CREATED",
  "DEALING",
  "IN_PROGRESS",
  "SHOWDOWN",
  "COMPLETED",
  "CANCELLED"
] as const;

export type VirtualHandStatus = (typeof VIRTUAL_HAND_STATUSES)[number];

export const VIRTUAL_STREETS = [
  "PRE_FLOP",
  "FLOP",
  "TURN",
  "RIVER",
  "SHOWDOWN"
] as const;

export type VirtualStreet = (typeof VIRTUAL_STREETS)[number];

export const VIRTUAL_TIMEOUT_AUTO_ACTION_RULES = [
  "CHECK_OR_FOLD",
  "FOLD_ONLY"
] as const;

export type VirtualTimeoutAutoActionRule =
  (typeof VIRTUAL_TIMEOUT_AUTO_ACTION_RULES)[number];

export const VIRTUAL_ACTION_TYPES = [
  "FOLD",
  "CHECK",
  "CALL",
  "BET",
  "RAISE",
  "ALL_IN"
] as const;

export type VirtualActionType = (typeof VIRTUAL_ACTION_TYPES)[number];

export const VIRTUAL_TABLE_REACTION_EMOJIS = [
  "😂",
  "😎",
  "🤡",
  "💀",
  "🔥",
  "👏",
  "🐟",
  "🦈",
  "🍀",
  "🎯",
  "😴",
  "🫠"
] as const;

export type VirtualTableReactionEmoji =
  (typeof VIRTUAL_TABLE_REACTION_EMOJIS)[number];

export type CreateVirtualTableRequestDto = {
  title: string;
  maxSeats: number;
  startingStackChips: string;
  chipValueMinor?: string | null;
  chipValueCurrency?: string | null;
  smallBlindChips: string;
  bigBlindChips: string;
  turnDurationSeconds: number;
  reminderDelaySeconds: number;
  timeoutAutoActionRule: VirtualTimeoutAutoActionRule;
  winProbabilityEnabled: boolean;
};

export type CreateVirtualTableResponseDto = {
  table: {
    id: string;
    title: string;
    status: VirtualTableStatus;
    inviteCode: string;
    inviteUrl: string;
    startingStackChips: string;
    smallBlindChips: string;
    bigBlindChips: string;
    chipValueMinor: string | null;
    chipValueCurrency: string | null;
    winProbabilityEnabled: boolean;
  };
};

export type JoinVirtualTableRequestDto = {
  inviteCode: string;
};

export type JoinVirtualTableResponseDto = {
  tableId: string;
  seatId: string;
  status: VirtualTableStatus;
};

export type VirtualTableDto = {
  id: string;
  title: string;
  status: VirtualTableStatus;
  maxSeats: number;
  inviteCode: string;
  startingStackChips: string;
  chipValueMinor: string | null;
  chipValueCurrency: string | null;
  smallBlindChips: string;
  bigBlindChips: string;
  pendingSmallBlindChips: string | null;
  pendingBigBlindChips: string | null;
  turnDurationSeconds: number;
  reminderDelaySeconds: number;
  timeoutAutoActionRule: VirtualTimeoutAutoActionRule;
  winProbabilityEnabled: boolean;
  potTotalChips: string;
  currentHandId: string | null;
  createdAt: string;
  startedAt: string | null;
  pausedAt: string | null;
  finishedAt: string | null;
};

export type VirtualSeatDto = {
  id: string;
  userId: string;
  displayName: string | null;
  seatNumber: number;
  role: VirtualSeatRole;
  stackChips: string;
  status: VirtualSeatStatus;
  isDealer: boolean;
  isSmallBlind: boolean;
  isBigBlind: boolean;
  winProbabilityPercent: number | null;
};

export type VirtualLegalActionDto =
  | { type: "FOLD" }
  | { type: "CHECK" }
  | { type: "CALL"; amountChips: string }
  | { type: "BET"; minAmountChips: string; maxAmountChips?: string }
  | { type: "RAISE"; minAmountChips: string; maxAmountChips?: string }
  | { type: "ALL_IN"; amountChips: string };

export type VirtualTurnTimerDto = {
  id: string;
  seatId: string;
  status: "ACTIVE" | "REMINDED";
  startedAt: string;
  reminderDueAt: string;
  expiresAt: string;
  remindedAt: string | null;
};

export type VirtualHandResultSummaryDto = {
  revealUntil: string;
  wonByFold: boolean;
  winners: Array<{
    seatId: string;
    displayName: string;
    amountChips: string;
    handRank: string | null;
    handRankLabel: string | null;
    bestFiveCards: string[];
  }>;
};

export type VirtualHandDto = {
  id: string;
  handNumber: number;
  status: VirtualHandStatus;
  street: VirtualStreet;
  board: string[];
  currentActorSeatId: string | null;
  currentTimer: VirtualTurnTimerDto | null;
  currentBetChips: string;
  callAmountChips: string;
  myPrivateCards: string[];
  myLegalActions: VirtualLegalActionDto[];
  resultSummary: VirtualHandResultSummaryDto | null;
};

export type GetVirtualTableResponseDto = {
  table: VirtualTableDto;
  seats: VirtualSeatDto[];
  reactions: VirtualTableReactionDto[];
  hand?: VirtualHandDto;
  settlement?: VirtualTableSettlementDto;
};

export type VirtualTableReactionDto = {
  id: string;
  tableId: string;
  seatId: string;
  userId: string;
  displayName: string;
  emoji: string;
  createdAt: string;
};

export type SubmitVirtualReactionRequestDto = {
  emoji: string;
};

export type SubmitVirtualReactionResponseDto = {
  reaction: VirtualTableReactionDto;
};

export type VirtualTableSettlementPlayerDto = {
  seatId: string;
  displayName: string;
  startingStackChips: string;
  finalStackChips: string;
  netChips: string;
  netEstimatedMinor: string | null;
};

export type VirtualTableSettlementTransferDto = {
  fromSeatId: string;
  fromName: string;
  toSeatId: string;
  toName: string;
  amountChips: string;
  amountEstimatedMinor: string | null;
};

export type VirtualTableSettlementDto = {
  totalStartingStackChips: string;
  totalFinalStackChips: string;
  differenceChips: string;
  players: VirtualTableSettlementPlayerDto[];
  transfers: VirtualTableSettlementTransferDto[];
};

export type VirtualTablesListItemDto = {
  id: string;
  title: string;
  status: VirtualTableStatus;
  inviteCode: string;
  maxSeats: number;
  currentHandId: string | null;
  startingStackChips: string;
  chipValueMinor: string | null;
  chipValueCurrency: string | null;
  smallBlindChips: string;
  bigBlindChips: string;
  turnDurationSeconds: number;
  reminderDelaySeconds: number;
  timeoutAutoActionRule: VirtualTimeoutAutoActionRule;
  winProbabilityEnabled: boolean;
  potTotalChips: string;
  createdAt: string;
  startedAt: string | null;
  pausedAt: string | null;
  finishedAt: string | null;
  seatsCount: number;
  activeSeatsCount: number;
  mySeatId: string;
  mySeatStatus: VirtualSeatStatus;
  currentActorSeatId: string | null;
  currentStreet: VirtualStreet | null;
  lastHandNumber: number | null;
};

export type GetVirtualTablesResponseDto = {
  items: VirtualTablesListItemDto[];
};

export type VirtualHandHistoryTableSummaryDto = {
  id: string;
  title: string;
  status: VirtualTableStatus;
  inviteCode: string;
  maxSeats: number;
  startingStackChips: string;
  chipValueMinor: string | null;
  chipValueCurrency: string | null;
  smallBlindChips: string;
  bigBlindChips: string;
};

export type VirtualHandHistorySummaryDto = {
  id: string;
  handNumber: number;
  status: VirtualHandStatus;
  street: VirtualStreet;
  potTotalChips: string;
  startedAt: string;
  completedAt: string | null;
};

export type VirtualHandHistoryActionDto = {
  id: string;
  street: VirtualStreet;
  actionType: string;
  amountChips: string | null;
  seatId: string | null;
  displayName: string;
  actorType: string;
  createdAt: string;
};

export type VirtualHandHistoryAwardDto = {
  winnerSeatId: string;
  displayName: string;
  amountChips: string;
  handRankJson: unknown;
};

export type VirtualHandHistoryPlayerDto = {
  seatId: string;
  displayName: string;
  status: VirtualSeatStatus;
  committedTotalChips: string;
  stackAfterChips: string;
  showdownCards: string[];
};

export type VirtualHandHistoryPotDto = {
  id: string;
  amountChips: string;
  eligibleSeatIds: string[];
  awards: VirtualHandHistoryAwardDto[];
};

export type GetVirtualHandHistoryResponseDto = {
  table: VirtualHandHistoryTableSummaryDto;
  hand: VirtualHandHistorySummaryDto;
  board: string[];
  players: VirtualHandHistoryPlayerDto[];
  actions: VirtualHandHistoryActionDto[];
  pots: VirtualHandHistoryPotDto[];
};

export type GetVirtualHandHistoriesQueryDto = {
  limit: number;
  cursor: string | null;
};

export type VirtualHandHistoryListWinnerDto = {
  seatId: string;
  displayName: string;
  amountChips: string;
  handRankLabel: string | null;
  bestFiveCards: string[];
};

export type VirtualHandHistoryListItemDto = {
  id: string;
  handNumber: number;
  status: VirtualHandStatus;
  street: VirtualStreet;
  potTotalChips: string;
  board: string[];
  startedAt: string;
  completedAt: string | null;
  actionsCount: number;
  winners: VirtualHandHistoryListWinnerDto[];
};

export type GetVirtualHandHistoriesResponseDto = {
  items: VirtualHandHistoryListItemDto[];
  nextCursor: string | null;
};

export type GetVirtualLeaderboardQueryDto = {
  scope: LeaderboardScope;
  period: LeaderboardPeriod;
  limit: number;
  cursor: string | null;
};

export type VirtualOnlineStatsDto = {
  userId: string;
  displayName: string;
  username: string | null;
  handsPlayed: number;
  handsWon: number;
  netChips: string;
  netEstimatedMinor: string;
  bigBlindsWon: string;
  bbPer100Bps: number;
  winRateBps: number;
  avgChipsPerHand: string;
  onlinePokerScore: number;
};

export type VirtualLeaderboardItemDto = VirtualOnlineStatsDto & {
  rank: number;
};

export type GetVirtualLeaderboardResponseDto = {
  items: VirtualLeaderboardItemDto[];
  nextCursor: string | null;
};

export type GetMyVirtualStatsResponseDto = {
  stats: VirtualOnlineStatsDto;
};

export type VirtualPlayerProfileUserDto = {
  id: string;
  displayName: string;
  username: string | null;
};

export type VirtualRecentProfileTableDto = {
  tableId: string;
  title: string;
  finishedAt: string;
  playersCount: number;
  smallBlindChips: string;
  bigBlindChips: string;
};

export type VirtualRecentProfileResultDto = {
  tableId: string;
  title: string;
  finishedAt: string;
  playersCount: number;
  netChips: string;
  netEstimatedMinor: string;
  cumulativeNetChips: string;
  cumulativeNetEstimatedMinor: string;
};

export type VirtualProfileTrendPointDto = {
  tableId: string;
  finishedAt: string;
  netChips: string;
  cumulativeNetChips: string;
  netEstimatedMinor: string;
  cumulativeNetEstimatedMinor: string;
};

export type VirtualPlayerProfileTableStatsDto = {
  tablesPlayed: number;
  tablesWon: number;
  tableWinRateBps: number;
  totalBuyInEstimatedMinor: string;
  roiBps: number;
};

export const VIRTUAL_PLAYER_ARCHETYPES = [
  "LEARNING",
  "SHARK",
  "MANIAC",
  "ROCK",
  "FISH",
  "LUCKY",
  "TANKER",
  "CHAOS_PLAYER",
  "BALANCED"
] as const;

export type VirtualPlayerArchetype = (typeof VIRTUAL_PLAYER_ARCHETYPES)[number];

export type VirtualPlayerStyleStatsDto = {
  vpipBps: number;
  pfrBps: number;
  aggressionFactorBps: number;
  foldToRaiseBps: number | null;
  showdownRateBps: number;
  showdownWinRateBps: number | null;
  allInWinRateBps: number | null;
  bbPer100Bps: number;
  averagePotWonChips: string;
  biggestPotWonChips: string;
  averageDecisionTimeSeconds: number;
  remindersReceived: number;
  autoActionsCount: number;
};

export type VirtualPlayerStyleProfileDto = {
  sample: {
    handsDealt: number;
    minimumRequired: number;
    isEnoughData: boolean;
  };
  archetype: {
    code: VirtualPlayerArchetype;
    title: string;
    description: string;
  };
  styleStats: VirtualPlayerStyleStatsDto;
};

export type GetVirtualPlayerProfileResponseDto = {
  user: VirtualPlayerProfileUserDto;
  stats: VirtualOnlineStatsDto;
  tableStats: VirtualPlayerProfileTableStatsDto;
  style: VirtualPlayerStyleProfileDto;
  recentTables: VirtualRecentProfileTableDto[];
  recentResults: VirtualRecentProfileResultDto[];
  trend: VirtualProfileTrendPointDto[];
};

export type StartVirtualTableResponseDto = {
  tableId: string;
  status: VirtualTableStatus;
  startedAt: string;
  currentHandId: string | null;
};

export type StartNextVirtualHandResponseDto = StartVirtualTableResponseDto;

export type PauseVirtualTableResponseDto = {
  tableId: string;
  status: Extract<VirtualTableStatus, "PAUSED">;
  pausedAt: string;
};

export type ResumeVirtualTableResponseDto = {
  tableId: string;
  status: Extract<VirtualTableStatus, "ACTIVE">;
  resumedAt: string;
};

export type FinishVirtualTableResponseDto = {
  tableId: string;
  status: Extract<VirtualTableStatus, "FINISHED">;
  finishedAt: string;
  currentHandId: string | null;
};

export type CancelVirtualTableResponseDto = {
  tableId: string;
  status: Extract<VirtualTableStatus, "CANCELLED">;
  finishedAt: string;
  currentHandId: string | null;
};

export type RaiseVirtualBlindsRequestDto = {
  smallBlindChips: string;
  bigBlindChips: string;
};

export type RaiseVirtualBlindsResponseDto = {
  pendingSmallBlindChips: string;
  pendingBigBlindChips: string;
  applies: "NEXT_HAND";
};

export type RequestVirtualSitOutRequestDto = {
  autoCheck: boolean;
  autoFold: boolean;
};

export type RequestVirtualSitOutResponseDto = {
  seatStatus: Extract<VirtualSeatStatus, "SIT_OUT_REQUESTED">;
  autoCheck: boolean;
  autoFold: boolean;
};

export type ReturnToVirtualTableResponseDto = {
  seatStatus: Extract<VirtualSeatStatus, "ACTIVE" | "RETURN_REQUESTED">;
};

export type SubmitVirtualActionRequestDto = {
  handId: string;
  actionType: VirtualActionType;
  amountChips?: string;
  idempotencyKey: string;
};

export type SubmitVirtualActionResponseDto = {
  tableId: string;
  handId: string;
  actionType: VirtualActionType;
  amountChips: string | null;
  handStatus: VirtualHandStatus;
  actedAt: string;
  nextActorSeatId: string | null;
};

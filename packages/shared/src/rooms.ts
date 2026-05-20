export const ROOM_STATUSES = [
  "DRAFT",
  "WAITING",
  "RUNNING",
  "SETTLEMENT",
  "CLOSED",
  "CANCELLED"
] as const;

export type RoomStatus = (typeof ROOM_STATUSES)[number];

export const ROOM_PLAYER_ROLES = ["OWNER", "ADMIN", "PLAYER"] as const;

export type RoomPlayerRole = (typeof ROOM_PLAYER_ROLES)[number];

export const ROOM_PLAYER_STATUSES = ["ACTIVE", "REMOVED", "LEFT"] as const;

export type RoomPlayerStatus = (typeof ROOM_PLAYER_STATUSES)[number];

export const GAME_TYPES = ["CASH", "TOURNAMENT", "SIMPLE_TRACKING"] as const;

export type GameType = (typeof GAME_TYPES)[number];

export const REBUY_PERMISSIONS = [
  "PLAYER_SELF",
  "ADMIN_APPROVAL",
  "ADMIN_ONLY"
] as const;

export type RebuyPermission = (typeof REBUY_PERMISSIONS)[number];

export const REBUY_EVENT_SOURCES = [
  "PLAYER_SELF",
  "ADMIN_FOR_PLAYER",
  "SYSTEM_IMPORT"
] as const;

export type RebuyEventSource = (typeof REBUY_EVENT_SOURCES)[number];

export const REBUY_EVENT_STATUSES = ["ACTIVE", "CANCELLED"] as const;

export type RebuyEventStatus = (typeof REBUY_EVENT_STATUSES)[number];

export const SETTLEMENT_STATUSES = ["DRAFT", "VALID", "CLOSED"] as const;

export type SettlementStatus = (typeof SETTLEMENT_STATUSES)[number];

export const SETTLEMENT_TRANSFER_STATUSES = [
  "PENDING",
  "MARKED_PAID",
  "CANCELLED"
] as const;

export type SettlementTransferStatus = (typeof SETTLEMENT_TRANSFER_STATUSES)[number];

export type RoomListItemDto = {
  id: string;
  title: string;
  status: RoomStatus;
  currency: string;
  buyInChips: string;
  rebuyChips: string;
  chipsPerCurrencyUnit: string;
  playersCount: number;
  totalPotChips: string;
  myBuyinsChips: string;
  closedAt?: string;
  myNetResultChips?: string;
};

export type RoomsListResponseDto = {
  active: RoomListItemDto[];
  recent: RoomListItemDto[];
};

export type CreateRoomRequestDto = {
  title: string;
  currency: string;
  buyInChips: string;
  rebuyChips: string;
  chipsPerCurrencyUnit: string;
  gameType: GameType;
  rebuyPermission: RebuyPermission;
};

export type CreateRoomResponseDto = {
  room: {
    id: string;
    title: string;
    status: RoomStatus;
    inviteCode: string;
    inviteUrl: string;
  };
};

export type RoomPlayerDto = {
  id: string;
  userId: string;
  displayName: string;
  role: RoomPlayerRole;
  status: RoomPlayerStatus;
  rebuyCount: number;
  totalBuyinChips: string;
  finalAmountChips: string | null;
  netResultChips: string | null;
};

export type RoomDetailsDto = {
  id: string;
  title: string;
  status: RoomStatus;
  currency: string;
  buyInChips: string;
  rebuyChips: string;
  chipsPerCurrencyUnit: string;
  gameType: GameType;
  rebuyPermission: RebuyPermission;
  inviteCode: string;
  inviteUrl: string;
  totalPotChips: string;
  myBuyinsChips: string;
  playersCount: number;
  myRole: RoomPlayerRole;
  myPlayerId: string;
  myPlayerStatus: RoomPlayerStatus;
  startedAt: string | null;
  createdAt: string;
};

export type GetRoomResponseDto = {
  room: RoomDetailsDto;
  players: RoomPlayerDto[];
  settlement: RoomSettlementDto | null;
};

export type JoinRoomRequestDto = {
  inviteCode: string;
};

export type JoinRoomResponseDto = {
  roomId: string;
  status: RoomStatus;
  playerId: string;
};

export type StartRoomResponseDto = {
  roomId: string;
  status: RoomStatus;
  startedAt: string;
};

export type SubmitFinalChipsRequestDto = {
  finalAmountChips: string;
};

export type LeaveRoomResponseDto = {
  roomId: string;
  playerId: string;
  playerStatus: RoomPlayerStatus;
  finalAmountChips: string;
  netResultChips: string;
};

export type ReturnToRoomResponseDto = {
  roomId: string;
  playerId: string;
  playerStatus: RoomPlayerStatus;
  finalAmountChips: null;
  netResultChips: null;
};

export type CreateRebuyRequestDto = {
  roomPlayerId: string;
  idempotencyKey: string;
};

export type RebuyEventDto = {
  id: string;
  roomId: string;
  roomPlayerId: string;
  amountChips: string;
  source: RebuyEventSource;
  status: RebuyEventStatus;
  createdAt: string;
};

export type RebuyPlayerTotalsDto = {
  rebuyCount: number;
  totalBuyinChips: string;
};

export type RebuyRoomTotalsDto = {
  totalPotChips: string;
};

export type CreateRebuyResponseDto = {
  rebuy: RebuyEventDto;
  playerTotals: RebuyPlayerTotalsDto;
  roomTotals: RebuyRoomTotalsDto;
};

export type CancelRebuyRequestDto = {
  idempotencyKey: string;
  reason?: string | null;
};

export type CancelRebuyResponseDto = {
  rebuyId: string;
  status: RebuyEventStatus;
  cancelledAt: string;
  cancelledByUserId: string;
  cancellationReason: string | null;
  playerTotals: RebuyPlayerTotalsDto;
  roomTotals: RebuyRoomTotalsDto;
};

export type RebuyHistoryItemDto = {
  id: string;
  roomId: string;
  roomPlayerId: string;
  playerName: string;
  amountChips: string;
  source: RebuyEventSource;
  status: RebuyEventStatus;
  createdAt: string;
  createdByUserId: string;
  createdByName: string;
  cancelledAt: string | null;
  cancelledByUserId: string | null;
  cancelledByName: string | null;
  cancellationReason: string | null;
};

export type GetRebuyHistoryResponseDto = {
  rebuys: RebuyHistoryItemDto[];
};

export type SettlementFinalAmountInputDto = {
  roomPlayerId: string;
  finalAmountChips: string;
};

export type SettlementPreviewRequestDto = {
  finalAmounts: SettlementFinalAmountInputDto[];
};

export type CloseSettlementRequestDto = SettlementPreviewRequestDto;

export type SettlementPlayerResultDto = {
  roomPlayerId: string;
  displayName: string;
  totalBuyinChips: string;
  finalAmountChips: string;
  netResultChips: string;
};

export type SettlementTransferDto = {
  fromRoomPlayerId: string;
  fromName: string;
  toRoomPlayerId: string;
  toName: string;
  amountChips: string;
};

export type RoomSettlementDto = {
  id: string;
  status: SettlementStatus;
  totalBuyinsChips: string;
  totalFinalAmountChips: string;
  differenceChips: string;
  calculatedAt: string;
  players: SettlementPlayerResultDto[];
  transfers: SettlementTransferDto[];
};

export type SettlementPreviewResponseDto = {
  totalBuyinsChips: string;
  totalFinalAmountChips: string;
  differenceChips: string;
  players: SettlementPlayerResultDto[];
  transfers: SettlementTransferDto[];
};

export type CloseSettlementResponseDto = {
  roomId: string;
  status: RoomStatus;
  settlementId: string;
};

export function parseMajorMoneyToMinor(input: string): string | null {
  const normalized = input.replace(",", ".").trim();

  if (normalized.length === 0) {
    return null;
  }

  const match = /^(?<sign>-?)(?<units>\d+)(?:\.(?<fraction>\d{0,2}))?$/.exec(normalized);

  if (!match?.groups) {
    return null;
  }

  const units = (match.groups.units ?? "0").replace(/^0+(?=\d)/, "");
  const fraction = (match.groups.fraction ?? "").padEnd(2, "0");
  const sign = match.groups.sign === "-" ? "-" : "";
  const digits = `${units}${fraction}`.replace(/^0+(?=\d)/, "");

  return `${sign}${digits}`;
}

export function formatMinorMoney(minor: string, currency: string): string {
  const amount = BigInt(minor);
  const isNegative = amount < 0n;
  const absolute = isNegative ? amount * -1n : amount;
  const units = absolute / 100n;
  const remainder = absolute % 100n;
  const formattedUnits = units
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, "\u00A0");
  const formattedRemainder = remainder.toString().padStart(2, "0");
  const prefix = isNegative ? "-" : "";
  const currencyCode = currency.trim().toUpperCase();

  if (currencyCode === "RUB" && remainder === 0n) {
    return `${prefix}${formattedUnits} ${getCurrencySymbol(currencyCode)}`;
  }

  return `${prefix}${formattedUnits},${formattedRemainder} ${getCurrencySymbol(currencyCode)}`;
}

export function formatChips(value: string | number | bigint): string {
  const chips = typeof value === "bigint" ? value : BigInt(value);
  const isNegative = chips < 0n;
  const absolute = isNegative ? chips * -1n : chips;
  const formatted = absolute.toString().replace(/\B(?=(\d{3})+(?!\d))/g, "\u00A0");

  return isNegative ? `-${formatted}` : formatted;
}

export function chipsToMoneyMinor(
  chips: string | number | bigint,
  chipsPerCurrencyUnit: string | number | bigint
): string {
  const chipAmount = typeof chips === "bigint" ? chips : BigInt(chips);
  const rate =
    typeof chipsPerCurrencyUnit === "bigint"
      ? chipsPerCurrencyUnit
      : BigInt(chipsPerCurrencyUnit);

  if (rate <= 0n) {
    throw new RangeError("chipsPerCurrencyUnit must be positive");
  }

  return ((chipAmount * 100n) / rate).toString();
}

export function formatChipsWithCurrencyApprox(
  chips: string | number | bigint,
  currency: string,
  chipsPerCurrencyUnit: string | number | bigint
): string {
  const formattedChips = formatChips(chips);
  const approxMoney = formatMinorMoney(chipsToMoneyMinor(chips, chipsPerCurrencyUnit), currency);

  return `${formattedChips} фишек (~${approxMoney})`;
}

function getCurrencySymbol(currency: string): string {
  switch (currency) {
    case "RUB":
      return "₽";
    case "USD":
      return "$";
    case "EUR":
      return "€";
    default:
      return currency;
  }
}

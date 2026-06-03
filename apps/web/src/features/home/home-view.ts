import type {
  GetVirtualTableResponseDto,
  RoomListItemDto,
  VirtualLegalActionDto,
  VirtualTablesListItemDto
} from "@pokertable/shared";
import { formatChips } from "@pokertable/shared";
import type { ClubEventListItemDto } from "../clubs/types";

export type HomeClubEvent = ClubEventListItemDto & {
  clubName?: string | null;
};

export type HomeTarget =
  | {
      kind: "active-turn";
      tableId: string;
    }
  | {
      kind: "virtual-table";
      tableId: string;
    }
  | {
      kind: "offline-room";
      roomId: string;
    }
  | {
      kind: "event";
      clubId: string;
      eventId: string;
    }
  | {
      kind: "club";
    };

export type HomeActiveTableCard = {
  id: string;
  typeLabel: "Онлайн" | "Оффлайн";
  title: string;
  meta: string;
  statusLabel: string;
  isUserTurn: boolean;
  target: HomeTarget;
};

export type HomeFocusCard = {
  title: string;
  meta: string;
  actionLabel: string;
  target: HomeTarget;
};

export type HomeViewModel = {
  activeTurns: VirtualTablesListItemDto[];
  activeTables: HomeActiveTableCard[];
  eventsTodayCount: number;
  focus: HomeFocusCard;
  pokerScore: {
    value: number | null;
    progress: number;
  };
  calendarStartAt: string;
  upcomingEvents: HomeClubEvent[];
};

export function buildHomeViewModel(input: {
  activeRooms?: RoomListItemDto[];
  recentRooms?: RoomListItemDto[];
  tables: VirtualTablesListItemDto[];
  events: HomeClubEvent[];
  offlinePokerScore?: number | null | undefined;
  offlineGamesCount?: number | undefined;
  onlinePokerScore?: number | null | undefined;
  onlineHandsPlayed?: number | undefined;
  activeTurnDetail?: GetVirtualTableResponseDto | null;
  now?: Date;
}): HomeViewModel {
  const now = input.now ?? new Date();
  const activeTurns = getActiveTurns(input.tables);
  const activeTables = getActiveTableCards(input.activeRooms ?? [], input.tables);
  const upcomingEvents = getUpcomingEvents(input.events, now);
  const firstActiveTurn = activeTurns[0] ?? null;
  const activeTurnDetail = getActiveTurnDetail(input.activeTurnDetail, now);

  const nearestEvent = upcomingEvents[0] ?? null;

  return {
    activeTurns,
    activeTables,
    eventsTodayCount: countTablesToday(input.activeRooms ?? [], input.recentRooms ?? [], input.tables, now),
    focus: getHomeFocusCard(firstActiveTurn, nearestEvent, activeTurnDetail),
    pokerScore: getAveragePokerScoreView({
      offlinePokerScore: input.offlinePokerScore,
      offlineGamesCount: input.offlineGamesCount ?? 0,
      onlinePokerScore: input.onlinePokerScore,
      onlineHandsPlayed: input.onlineHandsPlayed ?? 0
    }),
    calendarStartAt: now.toISOString(),
    upcomingEvents
  };
}

export function getPrimaryActiveTurn(tables: VirtualTablesListItemDto[]): VirtualTablesListItemDto | null {
  return getActiveTurns(tables)[0] ?? null;
}

export function getActiveTurns(tables: VirtualTablesListItemDto[]): VirtualTablesListItemDto[] {
  return [...tables]
    .filter(
      (table) =>
        table.status === "ACTIVE" &&
        table.mySeatStatus === "ACTIVE" &&
        table.currentActorSeatId === table.mySeatId
    )
    .sort(compareTablesByFreshness);
}

export function getPokerScoreView(value: number | null | undefined): HomeViewModel["pokerScore"] {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return {
      value: null,
      progress: 0
    };
  }

  const clamped = clamp(value, 0, 100);

  return {
    value: clamped,
    progress: clamped
  };
}

export function getAveragePokerScoreView(input: {
  offlinePokerScore?: number | null | undefined;
  offlineGamesCount: number;
  onlinePokerScore?: number | null | undefined;
  onlineHandsPlayed: number;
}): HomeViewModel["pokerScore"] {
  const scores = [
    input.offlineGamesCount > 0 ? input.offlinePokerScore : null,
    input.onlineHandsPlayed > 0 ? input.onlinePokerScore : null
  ].filter((value): value is number => typeof value === "number" && !Number.isNaN(value));

  if (scores.length === 0) {
    return {
      value: null,
      progress: 0
    };
  }

  const average = Math.round(scores.reduce((total, value) => total + value, 0) / scores.length);

  return getPokerScoreView(average);
}

export function getActiveTurnDetail(
  detail: GetVirtualTableResponseDto | null | undefined,
  now: Date = new Date()
): {
  actionLabel: string;
  timerLabel: string | null;
} {
  return {
    actionLabel: getActionLabel(detail?.hand?.myLegalActions ?? []),
    timerLabel: getTimerLabel(detail?.hand?.currentTimer?.expiresAt ?? null, now)
  };
}

function getHomeFocusCard(
  activeTurn: VirtualTablesListItemDto | null,
  nearestEvent: HomeClubEvent | null,
  activeTurnDetail: ReturnType<typeof getActiveTurnDetail>
): HomeFocusCard {
  if (activeTurn) {
    return {
      title: activeTurn.title,
      meta: activeTurnDetail.timerLabel ? `Ваш ход · ${activeTurnDetail.timerLabel}` : "Ваш ход",
      actionLabel: activeTurnDetail.actionLabel,
      target: {
        kind: "active-turn",
        tableId: activeTurn.id
      }
    };
  }

  if (nearestEvent) {
    return {
      title: nearestEvent.title,
      meta: nearestEvent.clubName ? nearestEvent.clubName : "Клубное событие",
      actionLabel: "Открыть событие",
      target: {
        kind: "event",
        clubId: nearestEvent.clubId,
        eventId: nearestEvent.id
      }
    };
  }

  return {
    title: "Клубная игра",
    meta: "Найдите ближайший стол",
    actionLabel: "Открыть клуб",
    target: {
      kind: "club"
    }
  };
}

function getUpcomingEvents(events: HomeClubEvent[], now: Date): HomeClubEvent[] {
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  return [...events]
    .filter((event) => {
      const scheduledAt = new Date(event.scheduledStartAt);

      return (
        Number.isFinite(scheduledAt.getTime()) &&
        scheduledAt >= todayStart &&
        event.status !== "COMPLETED" &&
        event.status !== "CANCELLED"
      );
    })
    .sort((left, right) => {
      const leftTime = new Date(left.scheduledStartAt).getTime();
      const rightTime = new Date(right.scheduledStartAt).getTime();

      return leftTime - rightTime;
    });
}

function getActiveTableCards(activeRooms: RoomListItemDto[], tables: VirtualTablesListItemDto[]): HomeActiveTableCard[] {
  const offlineCards: HomeActiveTableCard[] = activeRooms.map((room) => ({
    id: `offline-${room.id}`,
    typeLabel: "Оффлайн",
    title: room.title,
    meta: `${room.playersCount} ${getPlayersLabel(room.playersCount)}`,
    statusLabel: getOfflineRoomStatusLabel(room.status),
    isUserTurn: false,
    target: {
      kind: "offline-room",
      roomId: room.id
    }
  }));
  const onlineCards: HomeActiveTableCard[] = tables.filter(isLiveVirtualTable).map((table) => {
    const isUserTurn = table.status === "ACTIVE" && table.currentActorSeatId === table.mySeatId;

    return {
      id: `online-${table.id}`,
      typeLabel: "Онлайн",
      title: table.title,
      meta: table.lastHandNumber ? `Раздача #${table.lastHandNumber}` : `${table.activeSeatsCount}/${table.maxSeats} за столом`,
      statusLabel: isUserTurn ? "Ваш ход" : getVirtualTableStatusLabel(table.status),
      isUserTurn,
      target: {
        kind: isUserTurn ? "active-turn" : "virtual-table",
        tableId: table.id
      }
    };
  });

  return [...onlineCards, ...offlineCards].sort((left, right) => Number(right.isUserTurn) - Number(left.isUserTurn));
}

function isSameLocalDay(value: string, now: Date): boolean {
  const date = new Date(value);

  return (
    Number.isFinite(date.getTime()) &&
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

function countTablesToday(
  activeRooms: RoomListItemDto[],
  recentRooms: RoomListItemDto[],
  tables: VirtualTablesListItemDto[],
  now: Date
): number {
  const offlineActiveCount = activeRooms.length;
  const offlineRecentCount = recentRooms.filter((room) => room.closedAt && isSameLocalDay(room.closedAt, now)).length;
  const onlineCount = tables.filter((table) => isVirtualTableToday(table, now)).length;

  return offlineActiveCount + offlineRecentCount + onlineCount;
}

function isVirtualTableToday(table: VirtualTablesListItemDto, now: Date): boolean {
  return isSameLocalDay(table.finishedAt ?? table.startedAt ?? table.createdAt, now);
}

function isLiveVirtualTable(table: VirtualTablesListItemDto): boolean {
  return table.status === "WAITING_FOR_PLAYERS" || table.status === "ACTIVE" || table.status === "PAUSED";
}

function getOfflineRoomStatusLabel(status: RoomListItemDto["status"]): string {
  switch (status) {
    case "WAITING":
      return "Ждёт игроков";
    case "RUNNING":
      return "Игра идёт";
    case "SETTLEMENT":
      return "Расчёт";
    default:
      return "Открыт";
  }
}

function getVirtualTableStatusLabel(status: VirtualTablesListItemDto["status"]): string {
  switch (status) {
    case "WAITING_FOR_PLAYERS":
      return "Ждёт игроков";
    case "ACTIVE":
      return "Игра идёт";
    case "PAUSED":
      return "Пауза";
    default:
      return "Открыт";
  }
}

function getPlayersLabel(value: number): string {
  const normalized = Math.abs(value);
  const lastDigit = normalized % 10;
  const lastTwoDigits = normalized % 100;

  if (lastDigit === 1 && lastTwoDigits !== 11) {
    return "игрок";
  }

  if (lastDigit >= 2 && lastDigit <= 4 && (lastTwoDigits < 12 || lastTwoDigits > 14)) {
    return "игрока";
  }

  return "игроков";
}

function getActionLabel(actions: VirtualLegalActionDto[]): string {
  const action = getPreferredAction(actions);

  if (!action) {
    return "Открыть стол";
  }

  switch (action.type) {
    case "CALL":
      return `Колл ${formatChips(action.amountChips)} фишек`;
    case "CHECK":
      return "Чек";
    case "BET":
      return `Бет от ${formatChips(action.minAmountChips)} фишек`;
    case "RAISE":
      return `Рейз от ${formatChips(action.minAmountChips)} фишек`;
    case "ALL_IN":
      return `Ва-банк ${formatChips(action.amountChips)} фишек`;
    case "FOLD":
      return "Пас";
    default:
      return "Открыть стол";
  }
}

function getPreferredAction(actions: VirtualLegalActionDto[]): VirtualLegalActionDto | null {
  return (
    actions.find((action) => action.type === "CALL") ??
    actions.find((action) => action.type === "CHECK") ??
    actions.find((action) => action.type === "BET") ??
    actions.find((action) => action.type === "RAISE") ??
    actions.find((action) => action.type === "ALL_IN") ??
    actions.find((action) => action.type === "FOLD") ??
    null
  );
}

function getTimerLabel(expiresAt: string | null, now: Date): string | null {
  if (!expiresAt) {
    return null;
  }

  const expiresAtMs = new Date(expiresAt).getTime();

  if (!Number.isFinite(expiresAtMs)) {
    return null;
  }

  const secondsLeft = Math.max(0, Math.ceil((expiresAtMs - now.getTime()) / 1000));

  if (secondsLeft <= 0) {
    return "время вышло";
  }

  if (secondsLeft < 60) {
    return `${secondsLeft} сек`;
  }

  return `${Math.ceil(secondsLeft / 60)} мин`;
}

function compareTablesByFreshness(left: VirtualTablesListItemDto, right: VirtualTablesListItemDto): number {
  return getTableSortTime(right) - getTableSortTime(left);
}

function getTableSortTime(table: VirtualTablesListItemDto): number {
  return new Date(table.startedAt ?? table.createdAt).getTime();
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

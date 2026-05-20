import type {
  GetVirtualTableResponseDto,
  RaiseVirtualBlindsRequestDto,
  RequestVirtualSitOutRequestDto,
  SubmitVirtualActionRequestDto,
  VirtualTableReactionDto,
  VirtualTableReactionEmoji,
  VirtualActionType,
  VirtualHandDto,
  VirtualHandStatus,
  VirtualLegalActionDto,
  VirtualSeatDto,
  VirtualSeatRole,
  VirtualSeatStatus,
  VirtualTableStatus
} from "@pokertable/shared";
import { VIRTUAL_TABLE_REACTION_EMOJIS } from "@pokertable/shared";

export type VirtualCardModel = {
  code: string;
  rank: string;
  suit: "S" | "H" | "D" | "C";
  suitSymbol: string;
  suitLabel: string;
  tone: "dark" | "red";
};

export type VirtualSeatLayoutItem = {
  seat: VirtualSeatDto;
  isMe: boolean;
  isCurrentActor: boolean;
  left: string;
  top: string;
};

export type VirtualActionButtonModel = {
  id: string;
  actionType: VirtualActionType;
  label: string;
  amountChips?: string;
  tone: "ghost" | "neutral" | "accent";
};

export type VirtualSizingPreset = {
  label: "Мин" | "1/4 стека" | "1/2 стека" | "Ва-банк";
  amountChips: string;
};

export type VirtualSizingControlModel = {
  actionType: Extract<VirtualActionType, "BET" | "RAISE">;
  label: "Поставить" | "Повысить";
  minAmountChips: string;
  maxAmountChips: string;
  initialAmountChips: string;
  presets: VirtualSizingPreset[];
};

export type VirtualActionControlsModel = {
  foldButton: VirtualActionButtonModel | null;
  primaryButton: VirtualActionButtonModel | null;
  raiseButton: VirtualActionButtonModel | null;
  secondaryButton: VirtualActionButtonModel | null;
  sizingControl: VirtualSizingControlModel | null;
};

export type VirtualAdminAction =
  | "pause"
  | "resume"
  | "raise-blinds"
  | "finish"
  | "cancel"
  | "next-hand";

export type VirtualTableSurface =
  | "waiting"
  | "running"
  | "paused"
  | "finished"
  | "cancelled";

export type VirtualTableCallbacks = {
  onSubmitAction?: (payload: SubmitVirtualActionRequestDto) => void | Promise<void>;
  onSubmitReaction?: (emoji: VirtualTableReactionEmoji) => void | Promise<void>;
  onRequestSitOut?: (payload: RequestVirtualSitOutRequestDto) => void | Promise<void>;
  onReturnToTable?: () => void | Promise<void>;
  onPauseTable?: () => void | Promise<void>;
  onResumeTable?: () => void | Promise<void>;
  onRaiseBlinds?: (payload: RaiseVirtualBlindsRequestDto) => void | Promise<void>;
  onFinishTable?: () => void | Promise<void>;
  onCancelTable?: () => void | Promise<void>;
  onStartNextHand?: () => void | Promise<void>;
};

export type VirtualTableReactionAnimation = {
  key: string;
  reactionId: string | null;
  seatId: string;
  userId: string | null;
  displayName: string | null;
  emoji: VirtualTableReactionEmoji;
};

export type VirtualReactionAnimationCandidate = Pick<
  VirtualTableReactionDto,
  "id" | "seatId" | "userId" | "displayName" | "emoji"
>;

export type PendingOptimisticReaction = {
  seatId: string;
  userId: string | null;
  emoji: VirtualTableReactionEmoji;
  submittedAt: number;
};

export const VIRTUAL_REACTIONS_STORAGE_KEY = "pokertable.virtual.reactions.visible";
export const VIRTUAL_REACTION_ANIMATION_MS = 2000;
export const virtualReactionEmojis = [...VIRTUAL_TABLE_REACTION_EMOJIS];

const ACTION_LABELS: Record<VirtualActionType, string> = {
  FOLD: "Пас",
  CHECK: "Чек",
  CALL: "Колл",
  BET: "Поставить",
  RAISE: "Повысить",
  ALL_IN: "Ва-банк"
};

const SUIT_META: Record<VirtualCardModel["suit"], Omit<VirtualCardModel, "code" | "rank" | "suit">> = {
  S: { suitSymbol: "♠", suitLabel: "Пики", tone: "dark" },
  H: { suitSymbol: "♥", suitLabel: "Червы", tone: "red" },
  D: { suitSymbol: "♦", suitLabel: "Бубны", tone: "red" },
  C: { suitSymbol: "♣", suitLabel: "Трефы", tone: "dark" }
};

const ACTIVE_SIT_OUT_STATUSES = new Set<VirtualSeatStatus>([
  "SIT_OUT_REQUESTED",
  "SITTING_OUT",
  "RETURN_REQUESTED"
]);

const ADMIN_ROLES = new Set<VirtualSeatRole>(["OWNER", "ADMIN"]);

export function getVirtualTableSurface(
  tableStatus: VirtualTableStatus
): VirtualTableSurface {
  switch (tableStatus) {
    case "WAITING_FOR_PLAYERS":
      return "waiting";
    case "ACTIVE":
      return "running";
    case "PAUSED":
      return "paused";
    case "FINISHED":
      return "finished";
    case "CANCELLED":
      return "cancelled";
  }
}

export function isSitOutSeatStatus(status: VirtualSeatStatus | null | undefined): boolean {
  return status ? ACTIVE_SIT_OUT_STATUSES.has(status) : false;
}

export function getMySeat(
  seats: VirtualSeatDto[],
  mySeatId: string | null | undefined
): VirtualSeatDto | null {
  if (!mySeatId) {
    return null;
  }

  return seats.find((seat) => seat.id === mySeatId) ?? null;
}

export function formatChips(value: string | number | bigint | null | undefined): string {
  if (value === null || value === undefined) {
    return "0";
  }

  const normalized = typeof value === "string" ? value : String(value);

  return normalized.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

export function formatTimerRemaining(
  expiresAt: string | null | undefined,
  now = Date.now()
): string {
  if (!expiresAt) {
    return "00:00";
  }

  const remainingMs = Math.max(0, Date.parse(expiresAt) - now);
  const totalSeconds = Math.ceil(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function parseVirtualCard(cardCode: string): VirtualCardModel | null {
  if (typeof cardCode !== "string") {
    return null;
  }

  const normalized = cardCode.trim().toUpperCase();

  if (normalized.length !== 2) {
    return null;
  }

  const [rankCode, suitCode] = normalized.split("") as [string, VirtualCardModel["suit"]];
  const suit = SUIT_META[suitCode];

  if (!suit) {
    return null;
  }

  const rank = rankCode === "T" ? "10" : rankCode;

  if (!/^(?:[2-9]|10|A|K|Q|J)$/.test(rank)) {
    return null;
  }

  return {
    code: normalized,
    rank,
    suit: suitCode,
    ...suit
  };
}

export function getSeatStatusLabel(status: VirtualSeatStatus): string {
  switch (status) {
    case "ACTIVE":
      return "За столом";
    case "WAITING_FOR_TURN":
      return "Ждет ход";
    case "ACTING":
      return "Ходит";
    case "FOLDED":
      return "Пас";
    case "ALL_IN":
      return "Ва-банк";
    case "SIT_OUT_REQUESTED":
      return "Уходит на отдых";
    case "SITTING_OUT":
      return "Отдыхает";
    case "RETURN_REQUESTED":
      return "Вернется со следующей";
    case "LEFT":
      return "Вышел";
    case "NO_CHIPS":
      return "Без фишек";
  }
}

export function getStreetLabel(street: VirtualHandDto["street"] | undefined): string {
  switch (street) {
    case "PRE_FLOP":
      return "Префлоп";
    case "FLOP":
      return "Флоп";
    case "TURN":
      return "Терн";
    case "RIVER":
      return "Ривер";
    case "SHOWDOWN":
      return "Шоудаун";
    default:
      return "Раздача";
  }
}

export function getActionControlsModel(
  legalActions: VirtualLegalActionDto[],
  _potTotalChips: string,
  playerStackChips?: string
): VirtualActionControlsModel {
  let foldButton: VirtualActionButtonModel | null = null;
  let primaryButton: VirtualActionButtonModel | null = null;
  let raiseButton: VirtualActionButtonModel | null = null;
  let secondaryButton: VirtualActionButtonModel | null = null;
  let sizingControl: VirtualSizingControlModel | null = null;

  for (const action of legalActions) {
    switch (action.type) {
      case "FOLD":
        foldButton = {
          id: "FOLD",
          actionType: "FOLD",
          label: ACTION_LABELS.FOLD,
          tone: "ghost"
        };
        break;
      case "CHECK":
        primaryButton = {
          id: "CHECK",
          actionType: "CHECK",
          label: ACTION_LABELS.CHECK,
          tone: "neutral"
        };
        break;
      case "CALL":
        primaryButton = {
          id: "CALL",
          actionType: "CALL",
          label: ACTION_LABELS.CALL,
          amountChips: action.amountChips,
          tone: "accent"
        };
        break;
      case "ALL_IN":
        secondaryButton = {
          id: "ALL_IN",
          actionType: "ALL_IN",
          label: ACTION_LABELS.ALL_IN,
          amountChips: action.amountChips,
          tone: "neutral"
        };
        break;
      case "BET": {
        const nextSizingControl = createSizingControl(action, playerStackChips);
        sizingControl = nextSizingControl;

        const nextButton: VirtualActionButtonModel = {
          id: "BET",
          actionType: "BET",
          label: ACTION_LABELS.BET,
          amountChips: nextSizingControl.initialAmountChips,
          tone: primaryButton ? "neutral" : "accent"
        };

        if (primaryButton) {
          raiseButton = nextButton;
        } else {
          primaryButton = nextButton;
        }
        break;
      }
      case "RAISE":
        sizingControl = createSizingControl(action, playerStackChips);
        raiseButton = {
          id: "RAISE",
          actionType: "RAISE",
          label: ACTION_LABELS.RAISE,
          amountChips: sizingControl.initialAmountChips,
          tone: "neutral"
        };
        break;
    }
  }

  return {
    foldButton,
    primaryButton,
    raiseButton,
    secondaryButton,
    sizingControl
  };
}

function createSizingControl(
  action: Extract<VirtualLegalActionDto, { type: "BET" | "RAISE" }>,
  playerStackChips?: string
): VirtualSizingControlModel {
  const minAmount = parseChipAmount(action.minAmountChips);
  const maxAmount = parseChipAmount(action.maxAmountChips ?? action.minAmountChips);
  const stackAmount = parseChipAmount(playerStackChips ?? action.maxAmountChips ?? action.minAmountChips);
  const presets: VirtualSizingPreset[] = [
    { label: "Мин", amountChips: String(minAmount) },
    {
      label: "1/4 стека",
      amountChips: String(clampChipAmount(Math.max(minAmount, Math.floor(stackAmount / 4)), minAmount, maxAmount))
    },
    {
      label: "1/2 стека",
      amountChips: String(clampChipAmount(Math.max(minAmount, Math.floor(stackAmount / 2)), minAmount, maxAmount))
    },
    {
      label: "Ва-банк",
      amountChips: String(maxAmount)
    }
  ];

  return {
    actionType: action.type,
    label: action.type === "BET" ? "Поставить" : "Повысить",
    minAmountChips: String(minAmount),
    maxAmountChips: String(maxAmount),
    initialAmountChips: presets[0]?.amountChips ?? String(minAmount),
    presets
  };
}

export function buildActionPayload(
  handId: string,
  actionType: VirtualActionType,
  amountChips?: string
): SubmitVirtualActionRequestDto {
  return {
    handId,
    actionType,
    ...(amountChips ? { amountChips } : {}),
    idempotencyKey: createIdempotencyKey()
  };
}

export function createIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `virtual-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

export function getVisibleAdminActions(input: {
  myRole: VirtualSeatRole | null | undefined;
  tableStatus: VirtualTableStatus;
  currentHandId: string | null;
  handStatus?: VirtualHandStatus | undefined;
}): VirtualAdminAction[] {
  if (!input.myRole || !ADMIN_ROLES.has(input.myRole)) {
    return [];
  }

  const actions: VirtualAdminAction[] = [];

  if (input.tableStatus === "ACTIVE") {
    actions.push("pause", "raise-blinds", "finish");

    if (!input.currentHandId || input.handStatus === "COMPLETED" || input.handStatus === "CANCELLED") {
      actions.push("next-hand");
    }
  }

  if (input.tableStatus === "PAUSED") {
    actions.push("resume", "raise-blinds", "finish");
  }

  if (input.tableStatus === "WAITING_FOR_PLAYERS") {
    actions.push("finish");

    if (!input.currentHandId) {
      actions.push("cancel");
    }
  }

  return actions;
}

export function getInitialBlindDraft(
  table: GetVirtualTableResponseDto["table"]
): RaiseVirtualBlindsRequestDto {
  return {
    smallBlindChips: table.pendingSmallBlindChips ?? table.smallBlindChips,
    bigBlindChips: table.pendingBigBlindChips ?? table.bigBlindChips
  };
}

export function getStoredVirtualReactionsVisibility(): boolean {
  if (typeof window === "undefined") {
    return true;
  }

  try {
    return window.localStorage.getItem(VIRTUAL_REACTIONS_STORAGE_KEY) !== "false";
  } catch {
    return true;
  }
}

export function setStoredVirtualReactionsVisibility(visible: boolean): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(VIRTUAL_REACTIONS_STORAGE_KEY, String(visible));
  } catch {
    return;
  }
}

export function getNewReactionAnimations(input: {
  reactions: VirtualReactionAnimationCandidate[];
  seenReactionIds: Iterable<string>;
  optimisticReactions?: PendingOptimisticReaction[];
  currentUserId: string | null;
  now?: number;
}): {
  animations: VirtualTableReactionAnimation[];
  nextSeenReactionIds: Set<string>;
  remainingOptimisticReactions: PendingOptimisticReaction[];
} {
  const seenReactionIds = new Set(input.seenReactionIds);
  const now = input.now ?? Date.now();
  const optimisticReactions = (input.optimisticReactions ?? []).filter(
    (entry) => now - entry.submittedAt < 10000
  );
  const animations: VirtualTableReactionAnimation[] = [];

  for (const reaction of input.reactions) {
    if (seenReactionIds.has(reaction.id)) {
      continue;
    }

    seenReactionIds.add(reaction.id);

    const optimisticIndex = optimisticReactions.findIndex(
      (entry) =>
        entry.userId !== null &&
        entry.userId === input.currentUserId &&
        entry.userId === reaction.userId &&
        entry.seatId === reaction.seatId &&
        entry.emoji === reaction.emoji
    );

    if (optimisticIndex >= 0) {
      optimisticReactions.splice(optimisticIndex, 1);
      continue;
    }

    animations.push({
      key: reaction.id,
      reactionId: reaction.id,
      seatId: reaction.seatId,
      userId: reaction.userId,
      displayName: reaction.displayName,
      emoji: reaction.emoji as VirtualTableReactionEmoji
    });
  }

  return {
    animations,
    nextSeenReactionIds: seenReactionIds,
    remainingOptimisticReactions: optimisticReactions
  };
}

export function buildSeatLayout(
  seats: VirtualSeatDto[],
  tableMaxSeats: number,
  mySeatId: string | null | undefined,
  currentActorSeatId: string | null | undefined
): VirtualSeatLayoutItem[] {
  const mySeat = getMySeat(seats, mySeatId) ?? seats[0] ?? null;
  const totalSeats = Math.max(tableMaxSeats, seats.length, 2);

  if (!mySeat) {
    return [];
  }

  const step = 360 / totalSeats;
  const horizontalRadius = 42;
  const verticalRadius = 34;

  return [...seats]
    .sort((left, right) => left.seatNumber - right.seatNumber)
    .map((seat) => {
      const relativeSeat =
        ((seat.seatNumber - mySeat.seatNumber) % totalSeats + totalSeats) % totalSeats;
      const angle = (90 - relativeSeat * step) * (Math.PI / 180);
      const left = 50 + Math.cos(angle) * horizontalRadius;
      const top = 50 + Math.sin(angle) * verticalRadius;

      return {
        seat,
        isMe: seat.id === mySeatId,
        isCurrentActor: seat.id === currentActorSeatId,
        left: `${left}%`,
        top: `${top}%`
      };
    });
}

function parseChipAmount(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? "0", 10);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function clampChipAmount(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

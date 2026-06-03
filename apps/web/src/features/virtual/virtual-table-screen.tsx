import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type Dispatch,
  type JSX,
  type ReactNode,
  type SetStateAction
} from "react";
import type {
  GetVirtualHandHistoriesResponseDto,
  VirtualHandHistoryListItemDto,
  GetVirtualTableResponseDto,
  VirtualTableSettlementDto,
  VirtualHandResultSummaryDto
} from "@pokertable/shared";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ConfirmationModal, getAvatarInitials } from "./virtual-ui";
import { VirtualActionControls } from "./virtual-action-controls";
import { VirtualPlayingCard } from "./virtual-playing-card";
import { deriveSmallBlindChips } from "./virtual-table-form";
import {
  buildSeatStackDeltaAnimations,
  createSeatStackMap,
  type SeatStackDeltaAnimation
} from "./virtual-table-stack-delta";
import {
  formatChips,
  formatTimerRemaining,
  getInitialBlindDraft,
  getMySeat,
  getStoredVirtualReactionsVisibility,
  getSeatStatusLabel,
  getStreetLabel,
  setStoredVirtualReactionsVisibility,
  getVisibleAdminActions,
  getVirtualTableSurface,
  isSitOutSeatStatus,
  virtualReactionEmojis,
  type VirtualAdminAction,
  type VirtualTableReactionAnimation,
  type VirtualTableCallbacks
} from "./virtual-table-view";

type VirtualTableScreenProps = {
  data: GetVirtualTableResponseDto;
  mySeatId: string | null;
  pendingAction?: string | null;
  callbacks?: VirtualTableCallbacks;
  reactionsVisible?: boolean;
  reactionAnimations?: VirtualTableReactionAnimation[];
  onReactionsVisibleChange?: (visible: boolean) => void;
  initialReactionPickerOpen?: boolean;
  historyOverlay?: {
    status: "idle" | "loading" | "ready" | "error";
    data: GetVirtualHandHistoriesResponseDto | null;
    errorMessage: string | null;
    isLoadingMore?: boolean;
    onOpen?: () => void;
    onRetry?: () => void;
    onLoadMore?: () => void;
    onOpenHand?: (handId: string) => void;
  };
};

type TableOverlayKey = "history" | "admin" | "break" | "state" | null;
type TableMenuItem = {
  key: Exclude<TableOverlayKey, null>;
  label: string;
  icon: string;
};

type ResultOverlayModel = {
  type: "showdown" | "fold";
  winnerDisplayName: string;
  handRankLabel: string | null;
  bestFiveCards: string[];
  amountChips: string | null;
};

type ChipFlowAnimation = {
  key: string;
  amountChips: string;
  from: { left: string; top: string };
  to: { left: string; top: string };
  kind: "seat-to-bet-pile" | "bet-pile-to-pot" | "pot-to-seat";
  seatId?: string;
  winnerSeatId?: string;
};

type BetPile = {
  seatId: string;
  amountChips: string;
  left: string;
  top: string;
};

type CenterPotPile = {
  amountChips: string;
  key: string;
};

type ChipFlowTransition = {
  animations: ChipFlowAnimation[];
  betPiles: BetPile[];
  shouldPulsePot: boolean;
};

type SeatLayoutItem = {
  seat: GetVirtualTableResponseDto["seats"][number];
  isMe: boolean;
  isCurrentActor: boolean;
  left: string;
  top: string;
};

const CHIP_FLOW_DURATION_MS = 900;
const POT_PULSE_DURATION_MS = 650;
const CHIP_FLOW_POT_COORDINATES = { left: "50%", top: "40%" } as const;

export function createFinishTableConfirmationHandlers(
  setIsOpen: (isOpen: boolean) => void,
  onConfirm?: () => void | Promise<void>
): {
  requestFinish: () => void;
  cancelFinish: () => void;
  confirmFinish: () => void | Promise<void>;
} {
  return {
    requestFinish: () => setIsOpen(true),
    cancelFinish: () => setIsOpen(false),
    confirmFinish: () => {
      setIsOpen(false);
      return onConfirm?.();
    }
  };
}

export function VirtualTableScreen({
  data,
  mySeatId,
  pendingAction = null,
  callbacks,
  reactionsVisible: reactionsVisibleProp,
  reactionAnimations = [],
  onReactionsVisibleChange,
  initialReactionPickerOpen = false,
  historyOverlay
}: VirtualTableScreenProps): JSX.Element {
  const { table, seats, hand } = data;
  const mySeat = getMySeat(seats, mySeatId);
  const surface = getVirtualTableSurface(table.status);
  const isGameSurface = surface === "running" || surface === "paused";
  const [now, setNow] = useState(() => Date.now());
  const [blindDraft, setBlindDraft] = useState(() => getInitialBlindDraft(table));
  const [sitOutDraft, setSitOutDraft] = useState({
    autoCheck: true,
    autoFold: true
  });
  const [isFinishConfirmOpen, setIsFinishConfirmOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeOverlay, setActiveOverlay] = useState<TableOverlayKey>(null);
  const [isReactionPickerOpen, setIsReactionPickerOpen] = useState(initialReactionPickerOpen);
  const [stackAnimations, setStackAnimations] = useState<Record<string, SeatStackDeltaAnimation>>({});
  const [chipFlowAnimations, setChipFlowAnimations] = useState<ChipFlowAnimation[]>([]);
  const [betPiles, setBetPiles] = useState<BetPile[]>([]);
  const initialCenterPotPile = buildCenterPotPile(data);
  const [centerPotPile, setCenterPotPile] = useState<CenterPotPile | null>(() => initialCenterPotPile);
  const [potPulseKey, setPotPulseKey] = useState<string | null>(null);
  const [reactionsVisible, setReactionsVisible] = useState(
    () => reactionsVisibleProp ?? getStoredVirtualReactionsVisibility()
  );
  const previousStacksRef = useRef<Record<string, string>>(createSeatStackMap(seats));
  const animationTimeoutsRef = useRef<Record<string, number>>({});
  const previousChipFlowDataRef = useRef<GetVirtualTableResponseDto | null>(null);
  const chipFlowTimeoutRef = useRef<number | null>(null);
  const betPilesRef = useRef<BetPile[]>([]);
  const centerPotPileRef = useRef<CenterPotPile | null>(initialCenterPotPile);
  const potPulseTimeoutRef = useRef<number | null>(null);
  const normalizedResultSummary = normalizeResultSummary(hand);
  const currentResultOverlayKey = getResultOverlayKey(hand, normalizedResultSummary);
  const [visibleResultOverlayKey, setVisibleResultOverlayKey] = useState<string | null>(currentResultOverlayKey);

  useEffect(() => {
    setBlindDraft(getInitialBlindDraft(table));
  }, [
    table.smallBlindChips,
    table.bigBlindChips,
    table.pendingSmallBlindChips,
    table.pendingBigBlindChips
  ]);

  useEffect(() => {
    if (!hand?.currentTimer) {
      return undefined;
    }

    const timerId = window.setInterval(() => setNow(Date.now()), 1000);

    return () => window.clearInterval(timerId);
  }, [hand?.currentTimer?.expiresAt]);

  useEffect(() => {
    if (!isMenuOpen && !activeOverlay && !isReactionPickerOpen) {
      return undefined;
    }

    const handleEscape = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        setIsMenuOpen(false);
        setActiveOverlay(null);
        setIsReactionPickerOpen(false);
      }
    };

    window.addEventListener("keydown", handleEscape);

    return () => window.removeEventListener("keydown", handleEscape);
  }, [activeOverlay, isMenuOpen, isReactionPickerOpen]);

  useEffect(() => {
    if (typeof reactionsVisibleProp === "boolean") {
      setReactionsVisible(reactionsVisibleProp);
    }
  }, [reactionsVisibleProp]);

  useEffect(() => {
    const nextStacks = createSeatStackMap(seats);
    const nextAnimations = buildSeatStackDeltaAnimations(previousStacksRef.current, seats);

    if (Object.keys(nextAnimations).length > 0) {
      setStackAnimations((current) => ({ ...current, ...nextAnimations }));

      Object.keys(nextAnimations).forEach((seatId) => {
        const currentTimeout = animationTimeoutsRef.current[seatId];

        if (currentTimeout) {
          window.clearTimeout(currentTimeout);
        }

        animationTimeoutsRef.current[seatId] = window.setTimeout(() => {
          setStackAnimations((current) => {
            const next = { ...current };
            delete next[seatId];
            return next;
          });
          delete animationTimeoutsRef.current[seatId];
        }, 1200);
      });
    }

    previousStacksRef.current = nextStacks;
  }, [seats]);

  useEffect(() => {
    return () => {
      Object.values(animationTimeoutsRef.current).forEach((timeoutId) => window.clearTimeout(timeoutId));
    };
  }, []);

  useEffect(() => {
    const previousChipFlowData = previousChipFlowDataRef.current;
    const nextTransition = buildChipFlowTransition(
      previousChipFlowData,
      data,
      mySeatId,
      betPilesRef.current
    );
    previousChipFlowDataRef.current = data;

    const didHandChange =
      previousChipFlowData?.hand?.id &&
      data.hand?.id &&
      previousChipFlowData.hand.id !== data.hand.id;
    const hasCollectionAnimation = nextTransition.animations.some(
      (animation) => animation.kind === "bet-pile-to-pot"
    );
    const hasWinnerAnimation = nextTransition.animations.some(
      (animation) => animation.kind === "pot-to-seat"
    );

    if (didHandChange) {
      centerPotPileRef.current = null;
      setCenterPotPile(null);
    }

    betPilesRef.current = nextTransition.betPiles;
    setBetPiles(nextTransition.betPiles);

    if (nextTransition.animations.length > 0) {
      if (chipFlowTimeoutRef.current) {
        window.clearTimeout(chipFlowTimeoutRef.current);
      }

      setChipFlowAnimations(nextTransition.animations);
      chipFlowTimeoutRef.current = window.setTimeout(() => {
        setChipFlowAnimations([]);
        if (hasCollectionAnimation) {
          centerPotPileRef.current = buildCenterPotPile(data);
          setCenterPotPile(centerPotPileRef.current);
        }
        if (hasWinnerAnimation) {
          centerPotPileRef.current = null;
          setCenterPotPile(null);
        }
        chipFlowTimeoutRef.current = null;
      }, CHIP_FLOW_DURATION_MS);
    }

    if (!hasCollectionAnimation && !hasWinnerAnimation) {
      centerPotPileRef.current = buildCenterPotPile(data);
      setCenterPotPile(centerPotPileRef.current);
    }

    if (nextTransition.shouldPulsePot) {
      if (potPulseTimeoutRef.current) {
        window.clearTimeout(potPulseTimeoutRef.current);
      }

      setPotPulseKey(`${data.table.potTotalChips}:${Date.now()}`);
      potPulseTimeoutRef.current = window.setTimeout(() => {
        setPotPulseKey(null);
        potPulseTimeoutRef.current = null;
      }, POT_PULSE_DURATION_MS);
    }

    return undefined;
  }, [data, mySeatId]);

  useEffect(() => {
    return () => {
      if (chipFlowTimeoutRef.current) {
        window.clearTimeout(chipFlowTimeoutRef.current);
      }
      if (potPulseTimeoutRef.current) {
        window.clearTimeout(potPulseTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!currentResultOverlayKey) {
      setVisibleResultOverlayKey(null);
      return undefined;
    }

    setVisibleResultOverlayKey(currentResultOverlayKey);

    const timeoutId = window.setTimeout(() => {
      setVisibleResultOverlayKey((current) => (current === currentResultOverlayKey ? null : current));
    }, 10000);

    return () => window.clearTimeout(timeoutId);
  }, [currentResultOverlayKey]);

  const seatLayout = useMemo(
    () => buildActiveSeatLayout(seats, table.maxSeats, mySeatId, hand?.currentActorSeatId),
    [seats, table.maxSeats, mySeatId, hand?.currentActorSeatId]
  );
  const rawAdminActions = getVisibleAdminActions({
    myRole: mySeat?.role,
    tableStatus: table.status,
    currentHandId: table.currentHandId,
    ...(hand ? { handStatus: hand.status } : {})
  });
  const timerLabel = formatTimerRemaining(hand?.currentTimer?.expiresAt, now);
  const showActionControls = Boolean(
    hand && mySeat?.id === hand.currentActorSeatId && callbacks?.onSubmitAction
  );
  const showResultOverlay = Boolean(currentResultOverlayKey && visibleResultOverlayKey === currentResultOverlayKey);
  const adminActions = filterAdminActionsForResultOverlay(rawAdminActions, showResultOverlay);
  const showBreakMenuItem = Boolean(callbacks?.onRequestSitOut || callbacks?.onReturnToTable);
  const mySeatAnimation = mySeat ? stackAnimations[mySeat.id] : undefined;
  const centerDeltaLabel = mySeatAnimation?.label ?? null;
  const opponentSeatLayout = seatLayout.filter((item) => !item.isMe);
  const mySeatLayout = seatLayout.find((item) => item.isMe) ?? null;
  const canSendReaction = isGameSurface && Boolean(mySeat?.id) && Boolean(callbacks?.onSubmitReaction);
  const visibleReactionAnimations = reactionsVisible ? reactionAnimations : [];
  const showActionOverlay = Boolean(showActionControls && !showResultOverlay && hand && callbacks?.onSubmitAction);
  const finishConfirmationHandlers = useMemo(
    () => createFinishTableConfirmationHandlers(setIsFinishConfirmOpen, callbacks?.onFinishTable),
    [callbacks?.onFinishTable]
  );
  const menuItems: TableMenuItem[] = [
    { key: "history", label: "История", icon: "history" },
    ...(adminActions.length > 0 ? ([{ key: "admin", label: "Управление", icon: "tune" }] satisfies TableMenuItem[]) : []),
    ...(showBreakMenuItem
      ? ([
          {
            key: "break",
            label: isSitOutSeatStatus(mySeat?.status) ? "Вернуться" : "Отдых",
            icon: isSitOutSeatStatus(mySeat?.status) ? "keyboard_return" : "person_off"
          }
        ] satisfies TableMenuItem[])
      : []),
    { key: "state", label: "Состояние", icon: "info" }
  ];

  return (
    <div
      className={cn(
        "relative isolate text-white",
        isGameSurface
          ? "h-[100dvh] overflow-hidden bg-[#040705]"
          : surface === "finished"
            ? "space-y-4 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[calc(env(safe-area-inset-top)+5.25rem)]"
            : "space-y-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] px-4 pt-4"
      )}
    >
      <TableAnimationStyles />

      {isFinishConfirmOpen ? (
        <ConfirmationModal
          cancelLabel="Остаться"
          confirmLabel="Завершить"
          description="Текущая раздача остановится, а ставки этой раздачи вернутся игрокам. После этого откроем расчёт стола."
          isConfirming={pendingAction === "finish"}
          onCancel={finishConfirmationHandlers.cancelFinish}
          onConfirm={() => {
            void finishConfirmationHandlers.confirmFinish();
          }}
          title="Завершить стол?"
        />
      ) : null}

      {activeOverlay ? (
        <TableOverlay title={getOverlayTitle(activeOverlay)} onClose={() => setActiveOverlay(null)}>
          {activeOverlay === "history" ? (
            <HistoryOverlay handNumber={hand?.handNumber ?? null} historyOverlay={historyOverlay} />
          ) : null}
          {activeOverlay === "admin" ? (
            <AdminOverlay
              adminActions={adminActions}
              blindDraft={blindDraft}
              callbacks={
                callbacks
                  ? {
                      ...callbacks,
                      onFinishTable: finishConfirmationHandlers.requestFinish
                    }
                  : undefined
              }
              onBlindDraftChange={setBlindDraft}
            />
          ) : null}
          {activeOverlay === "break" ? (
            <BreakOverlay
              callbacks={callbacks}
              mySeatStatus={mySeat?.status}
              sitOutDraft={sitOutDraft}
              onSitOutDraftChange={setSitOutDraft}
            />
          ) : null}
          {activeOverlay === "state" ? (
            <StateOverlay
              reactionsVisible={reactionsVisible}
              playersCount={seats.length}
              surface={surface}
              table={table}
              onReactionsVisibleChange={(visible) => {
                setReactionsVisible(visible);
                setStoredVirtualReactionsVisibility(visible);
                onReactionsVisibleChange?.(visible);
              }}
            />
          ) : null}
        </TableOverlay>
      ) : null}

      {isMenuOpen ? (
        <div className="absolute inset-0 z-40" onClick={() => setIsMenuOpen(false)}>
          <div
            className="absolute right-4 top-[max(4.5rem,calc(env(safe-area-inset-top)+3.5rem))] w-52 rounded-[1.35rem] border border-white/10 bg-[#171717]/96 p-2 shadow-2xl backdrop-blur-xl"
            onClick={(event) => event.stopPropagation()}
          >
            {menuItems.map((item) => (
              <button
                key={item.key}
                className="flex w-full items-center gap-3 rounded-[1rem] px-3 py-3 text-left text-sm font-medium text-white transition hover:bg-white/[0.06]"
                onClick={() => {
                  setIsMenuOpen(false);
                  if (item.key === "history") {
                    historyOverlay?.onOpen?.();
                  }
                  setActiveOverlay(item.key);
                }}
                type="button"
              >
                <span className="material-symbols-outlined text-[18px] text-[#8e9192]">{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {isGameSurface ? (
        <section
          className="relative mx-auto h-full w-full max-w-[560px]"
          data-testid="virtual-table-stage"
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_18%,rgba(92,136,118,0.18),transparent_24%),radial-gradient(circle_at_80%_16%,rgba(124,78,45,0.16),transparent_22%),linear-gradient(180deg,#0b100d_0%,#060806_44%,#040504_100%)]" />
          <div className="pointer-events-none absolute inset-x-[-12%] bottom-[-20%] top-[42%] bg-[radial-gradient(circle_at_center,rgba(0,0,0,0.68),transparent_62%)] blur-2xl" />

          <div
            className="pointer-events-none absolute inset-x-[2.5%] top-[13%] bottom-[8%] rounded-[999px] bg-[radial-gradient(circle_at_50%_40%,rgba(0,0,0,0.1),transparent_58%),linear-gradient(135deg,rgba(109,77,54,0.78)_0%,#261810_30%,#14100c_52%,rgba(100,70,49,0.78)_100%)] shadow-[0_48px_90px_rgba(0,0,0,0.55)]"
            data-testid="virtual-table-felt"
          />
          <div className="pointer-events-none absolute inset-x-[4.8%] top-[15.2%] bottom-[10.2%] rounded-[999px] bg-[linear-gradient(180deg,#251f19_0%,#100d0a_100%)] shadow-[inset_0_2px_0_rgba(255,245,225,0.12),inset_0_-10px_22px_rgba(0,0,0,0.42)]" />
          <div className="pointer-events-none absolute inset-x-[8.6%] top-[18%] bottom-[13%] rounded-[999px] bg-[radial-gradient(circle_at_50%_42%,rgba(125,231,171,0.18),transparent_34%),radial-gradient(circle_at_50%_50%,#22714d_0%,#16563b_42%,#0f3d2c_70%,#0a241a_100%)] shadow-[inset_0_10px_22px_rgba(255,255,255,0.06),inset_0_-16px_28px_rgba(0,0,0,0.26)]" />
          <div className="pointer-events-none absolute inset-x-[10.8%] top-[20.5%] bottom-[15.5%] rounded-[999px] bg-[radial-gradient(circle_at_50%_38%,rgba(255,255,255,0.08),transparent_24%),repeating-linear-gradient(135deg,rgba(255,255,255,0.018)_0_4px,rgba(0,0,0,0)_4px_11px)] opacity-70" />
          <div
            className="absolute inset-x-0 top-[calc(env(safe-area-inset-top)+2.75rem)] z-30 px-3"
            data-testid="virtual-table-floating-controls"
          >
            <div className="flex items-start justify-between gap-3">
              <FloatingInfoPill
                icon="casino"
                label="Блайнды"
                value={
                  table.pendingSmallBlindChips && table.pendingBigBlindChips
                    ? `${formatChips(table.smallBlindChips)} / ${formatChips(table.bigBlindChips)} -> ${formatChips(table.pendingSmallBlindChips)} / ${formatChips(table.pendingBigBlindChips)}`
                    : `${formatChips(table.smallBlindChips)} / ${formatChips(table.bigBlindChips)}`
                }
              />
              <div className="ml-auto flex items-center gap-2">
                <FloatingInfoPill
                  icon="timer"
                  label="Время хода"
                  value={timerLabel}
                />
                <FloatingSceneButton
                  ariaExpanded={isMenuOpen}
                  ariaLabel="Открыть настройки стола"
                  icon="settings"
                  onClick={() => {
                    setIsReactionPickerOpen(false);
                    setActiveOverlay(null);
                    setIsMenuOpen((current) => !current);
                  }}
                />
              </div>
            </div>
          </div>

          <button
            aria-expanded={isReactionPickerOpen}
            aria-label="Отправить реакцию"
            className={cn(
              "absolute right-4 z-30 inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/12 bg-[#161816]/84 text-[20px] text-white shadow-[0_18px_40px_rgba(0,0,0,0.42)] backdrop-blur-xl transition hover:bg-[#1d221f]",
              !canSendReaction && "opacity-40"
            )}
            data-testid="virtual-table-reaction-trigger"
            disabled={!canSendReaction}
            onClick={() => {
              setIsMenuOpen(false);
              setActiveOverlay(null);
              setIsReactionPickerOpen((current) => !current);
            }}
            style={{
              bottom: showActionOverlay
                ? "calc(env(safe-area-inset-bottom) + 8.5rem)"
                : "calc(env(safe-area-inset-bottom) + 1.25rem)"
            }}
            type="button"
          >
            <span aria-hidden="true">🙂</span>
          </button>
          {isReactionPickerOpen ? (
            <div
              className="absolute right-4 z-30 w-[12.75rem] rounded-[1.15rem] border border-white/10 bg-[#171717]/96 p-2 shadow-2xl backdrop-blur-xl"
              data-testid="virtual-table-reaction-picker"
              style={{
                bottom: showActionOverlay
                  ? "calc(env(safe-area-inset-bottom) + 12rem)"
                  : "calc(env(safe-area-inset-bottom) + 4.5rem)"
              }}
            >
              <div className="grid grid-cols-4 gap-1.5">
                {virtualReactionEmojis.map((emoji) => (
                  <button
                    key={emoji}
                    aria-label={`Отправить ${emoji}`}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/8 bg-white/[0.03] text-[18px] transition hover:bg-white/[0.08]"
                    onClick={() => {
                      setIsReactionPickerOpen(false);
                      void callbacks?.onSubmitReaction?.(emoji);
                    }}
                    type="button"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="relative z-10 h-full">
            {showResultOverlay && normalizedResultSummary ? (
              <ResultSummaryOverlay summary={normalizedResultSummary} />
            ) : null}
            {visibleReactionAnimations.length > 0 ? (
              <VirtualTableReactionLayer animations={visibleReactionAnimations} seatLayout={seatLayout} />
            ) : null}
            <BetPileLayer piles={betPiles} />
            <CenterPotPileLayer pile={centerPotPile} />
            <ChipFlowLayer animations={chipFlowAnimations} />

            <div
              className={cn(
                "pointer-events-none absolute left-1/2 top-[37.5%] z-20 -translate-x-1/2 text-center text-4xl font-bold sm:text-5xl",
                centerDeltaLabel
                  ? "animate-[stack-delta-float_1.35s_ease-out_forwards]"
                  : "opacity-0",
                mySeatAnimation?.direction === "win" && "text-[#79f6bf]",
                mySeatAnimation?.direction === "loss" && "text-[#ff7b95]"
              )}
              data-testid="virtual-table-center-delta"
            >
              {centerDeltaLabel ?? ""}
            </div>

            <div
              className="pointer-events-none absolute inset-x-[31%] top-[40%] z-10 text-center"
              data-testid="virtual-table-pot"
            >
              <span
                className={cn("sr-only", potPulseKey && "animate-[virtual-pot-pulse_650ms_ease-out]")}
                data-testid="virtual-table-pot-total"
              >
                {formatChips(table.potTotalChips)}
              </span>
            </div>

            <div
              className="pointer-events-none absolute inset-x-[17%] top-[46%] z-10 text-center"
              data-testid="virtual-table-board"
            >
              <div className="text-[11px] uppercase tracking-[0.2em] text-[#d6e4da]/62">
                {hand ? getStreetLabel(hand.street) : surfaceTitle(surface)}
              </div>
              <div className="mt-2 flex justify-center gap-1.5">
                {Array.from({ length: 5 }, (_, index) => (
                  <VirtualPlayingCard
                    key={hand?.board[index] ?? `board-${index}`}
                    cardCode={hand?.board[index] ?? null}
                    compact
                    className={cn("virtual-card-reveal", getCardRevealDelayClassName(index))}
                  />
                ))}
              </div>
            </div>

            {opponentSeatLayout.map(({ seat, isCurrentActor, left, top }) => {
              const animation = stackAnimations[seat.id];
              const badges = getSeatBadges(seat).slice(0, 3);

              return (
                <article
                  key={seat.id}
                  className="absolute w-[5.4rem] -translate-x-1/2 -translate-y-1/2 text-center"
                  data-testid="seat-chip"
                  style={{ left, top }}
                >
                  {animation ? (
                    <div
                      className={cn(
                        "pointer-events-none absolute left-1/2 top-[-1.45rem] -translate-x-1/2 text-[11px] font-bold animate-[stack-delta-float_1.2s_ease-out_forwards]",
                        animation.direction === "win" ? "text-[#79f6bf]" : "text-[#ff7b95]"
                      )}
                    >
                      {animation.label}
                    </div>
                  ) : null}

                  <div className="flex flex-col items-center gap-1.5">
                    <SeatAvatar
                      animation={animation}
                      isCurrentActor={isCurrentActor}
                      seat={seat}
                      size="h-8 w-8"
                    />
                    <div
                      className={cn(
                        "min-w-[4.85rem] rounded-[0.9rem] border border-white/10 bg-[#0c1310]/74 px-2 py-1 shadow-[0_12px_24px_rgba(0,0,0,0.26)] backdrop-blur-md",
                        seat.status === "FOLDED" && "opacity-60",
                        isCurrentActor && "border-[#4edea3]/42 bg-[#10201a]/82 shadow-[0_0_26px_rgba(78,222,163,0.14)]",
                        animation?.direction === "win" && "border-[#4edea3]/38 bg-[#10241b]/84",
                        animation?.direction === "loss" && "border-[#ff7b95]/24 bg-[#1b1417]/84"
                      )}
                    >
                      <div className="truncate text-[9px] font-semibold text-white">
                        {seat.displayName ?? `Игрок ${seat.seatNumber}`}
                      </div>
                      <div
                        className="mt-0.5 truncate text-[10px] font-semibold text-[#e3ece5]"
                        data-testid="seat-chip-stack"
                      >
                        {formatChips(seat.stackChips)}
                      </div>
                      {badges.length > 0 ? (
                        <div className="mt-0.5 flex flex-wrap items-center justify-center gap-0.5 text-[8px] text-[#8e9192]">
                          {badges.map((badge) => (
                            <SeatBadge compact key={badge.label} tone={badge.tone}>
                              {badge.label}
                            </SeatBadge>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })}

            <div
              className={cn(
                "absolute left-1/2 top-[67%] z-10 flex -translate-x-1/2 items-end justify-center gap-2 rounded-[1.4rem] px-2 py-1 transition",
                mySeatAnimation?.direction === "win" &&
                  "shadow-[0_0_30px_rgba(78,222,163,0.24)] ring-1 ring-[#4edea3]/35",
                mySeatAnimation?.direction === "loss" && "bg-[#1a1216]/35 ring-1 ring-[#ff7b95]/25"
              )}
              data-testid="table-private-cards"
            >
              {(hand?.myPrivateCards.length ? hand.myPrivateCards : [undefined, undefined]).map(
                (cardCode, index) => (
                  <VirtualPlayingCard
                    key={cardCode ?? `private-${index}`}
                    cardCode={cardCode ?? null}
                    className={cn(
                      "virtual-card-reveal h-[5.25rem] w-[3.6rem] rounded-[0.9rem] border border-[#4edea3]/25 ring-1 ring-[#4edea3]/15 shadow-[0_18px_36px_rgba(0,0,0,0.28)]",
                      getCardRevealDelayClassName(index + 5)
                    )}
                  />
                )
              )}
            </div>

            {mySeatLayout ? (
              <article
                className="absolute left-1/2 top-[79%] z-10 w-[9.2rem] -translate-x-1/2 -translate-y-1/2 text-center"
                data-testid="my-seat-chip"
              >
                {mySeatAnimation ? (
                  <div
                    className={cn(
                      "pointer-events-none absolute left-1/2 top-[-1.35rem] -translate-x-1/2 text-[11px] font-bold animate-[stack-delta-float_1.2s_ease-out_forwards]",
                      mySeatAnimation.direction === "win" ? "text-[#79f6bf]" : "text-[#ff7b95]"
                    )}
                  >
                    {mySeatAnimation.label}
                  </div>
                ) : null}
                <div className="flex items-center justify-center gap-1.5">
                  <SeatAvatar
                    animation={mySeatAnimation}
                    isCurrentActor={mySeatLayout.isCurrentActor}
                    seat={mySeatLayout.seat}
                    size="h-7 w-7"
                  />
                  <div
                    className={cn(
                      "min-w-0 flex-1 rounded-[0.9rem] border border-white/10 bg-[#0c1310]/78 px-2 py-1 shadow-[0_12px_28px_rgba(0,0,0,0.28)] backdrop-blur-md",
                      mySeatAnimation?.direction === "win" &&
                        "border-[#4edea3]/36 shadow-[0_0_24px_rgba(78,222,163,0.18)]",
                      mySeatAnimation?.direction === "loss" &&
                        "border-[#ff7b95]/25 bg-[#1b1518]/86",
                      mySeatLayout.isCurrentActor && "border-[#4edea3]/46 bg-[#102019]/84"
                    )}
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span className="truncate text-[9px] font-semibold text-white">Вы</span>
                      {getSeatBadges(mySeatLayout.seat)
                        .filter((badge) => badge.label === "D" || badge.label === "SB" || badge.label === "BB")
                        .slice(0, 3)
                        .map((badge) => (
                          <SeatBadge compact key={badge.label} tone={badge.tone}>
                            {badge.label}
                          </SeatBadge>
                        ))}
                    </div>
                    <div className="mt-0.5 flex items-center justify-center gap-1.5">
                      <span className="text-[11px] font-semibold leading-none text-[#e7eee9]">
                        {formatChips(mySeatLayout.seat.stackChips)}
                      </span>
                      {table.winProbabilityEnabled && mySeatLayout.seat.winProbabilityPercent != null ? (
                        <span
                          className="inline-flex items-center gap-0.5 text-[8px] font-semibold leading-none text-[#bdeed6]"
                          data-testid="my-seat-win-probability"
                        >
                          <span className="material-symbols-outlined text-[11px] leading-none">bolt</span>
                          {formatCompactWinProbability(mySeatLayout.seat.winProbabilityPercent)}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              </article>
            ) : null}
          </div>

          {showActionOverlay && hand && callbacks?.onSubmitAction ? (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30">
              <div className="pointer-events-auto mx-auto max-w-[560px] px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                <VirtualActionControls
                  disabled={Boolean(pendingAction)}
                  hand={hand}
                  pendingActionType={pendingAction}
                  playerStackChips={mySeat?.stackChips}
                  onSubmitAction={callbacks.onSubmitAction}
                  potTotalChips={table.potTotalChips}
                />
              </div>
            </div>
          ) : null}
        </section>
      ) : (
        <div className="mx-auto flex w-full max-w-[430px] flex-col">
          <div className="mt-3 flex min-h-0 flex-col">
            {surface === "finished" ? (
              <VirtualFinishedTableResults
                mySeatId={mySeatId}
                seats={seats}
                settlement={data.settlement ?? null}
                table={table}
              />
            ) : (
              <section
                data-testid="virtual-table-stage"
                className="relative overflow-hidden rounded-[2.35rem] border border-white/8 bg-[radial-gradient(circle_at_top,rgba(78,222,163,0.12),transparent_22rem),linear-gradient(180deg,#141414_0%,#0d0d0d_100%)] px-3 pb-8 pt-5 shadow-[0_30px_60px_rgba(0,0,0,0.4)]"
              >
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8e9192]">
                  Состояние стола
                </div>
                <div className="mt-2 text-lg font-semibold text-white">{surfaceTitle(surface)}</div>
                <p className="mt-2 text-sm leading-6 text-[#c4c7c8]">{surfaceDescription(surface)}</p>
              </section>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function buildActiveSeatLayout(
  seats: GetVirtualTableResponseDto["seats"],
  tableMaxSeats: number,
  mySeatId: string | null | undefined,
  currentActorSeatId: string | null | undefined
): SeatLayoutItem[] {
  const mySeat = getMySeat(seats, mySeatId) ?? seats[0] ?? null;

  if (!mySeat) {
    return [];
  }

  const totalSeats = Math.max(tableMaxSeats, seats.length, 2);
  const orderedSeats = [...seats].sort((left, right) => {
    const leftRelative =
      ((left.seatNumber - mySeat.seatNumber) % totalSeats + totalSeats) % totalSeats;
    const rightRelative =
      ((right.seatNumber - mySeat.seatNumber) % totalSeats + totalSeats) % totalSeats;

    return leftRelative - rightRelative;
  });
  const opponents = orderedSeats.filter((seat) => seat.id !== mySeat.id);
  const opponentPositions = getOpponentSeatPositions(opponents.length);

  return orderedSeats.map((seat) => {
    const isMe = seat.id === mySeat.id;
    const opponentIndex = opponents.findIndex((item) => item.id === seat.id);
    const position = isMe
      ? { left: "50%", top: "64%" }
      : opponentPositions[opponentIndex] ?? { left: "50%", top: "24%" };

    return {
      seat,
      isMe,
      isCurrentActor: seat.id === currentActorSeatId,
      left: position.left,
      top: position.top
    };
  });
}

export function buildChipFlowAnimations(
  previousData: GetVirtualTableResponseDto | null,
  currentData: GetVirtualTableResponseDto,
  mySeatId: string | null
): ChipFlowAnimation[] {
  return buildChipFlowTransition(previousData, currentData, mySeatId, []).animations;
}

export function buildChipFlowTransition(
  previousData: GetVirtualTableResponseDto | null,
  currentData: GetVirtualTableResponseDto,
  mySeatId: string | null,
  currentBetPiles: BetPile[] = []
): ChipFlowTransition {
  const currentCommittedBetPiles = buildCommittedBetPiles(currentData, mySeatId);

  if (!previousData) {
    return {
      animations: [],
      betPiles: currentCommittedBetPiles,
      shouldPulsePot: false
    };
  }

  const seatLayout = buildActiveSeatLayout(
    currentData.seats,
    currentData.table.maxSeats,
    mySeatId,
    currentData.hand?.currentActorSeatId
  );
  const seatCoordinates = new Map(
    seatLayout.map((item) => [item.seat.id, { left: item.left, top: item.top }])
  );
  const previousStacks = new Map(previousData.seats.map((seat) => [seat.id, parseChipValue(seat.stackChips)]));
  const previousCommitted = new Map(
    previousData.seats.map((seat) => [seat.id, getSeatCommittedStreetChips(seat)])
  );
  const previousPot = parseChipValue(previousData.table.potTotalChips);
  const currentPot = parseChipValue(currentData.table.potTotalChips);
  const potIncrease = currentPot > previousPot ? currentPot - previousPot : 0n;
  const potDrop = previousPot > currentPot ? previousPot - currentPot : 0n;
  const animations: ChipFlowAnimation[] = [];
  const previousCommittedTotal = sumSeatStreetCommitments(previousData.seats);
  const currentCommittedTotal = sumSeatStreetCommitments(currentData.seats);
  const didRoundComplete =
    isBettingRoundTransition(previousData.hand, currentData.hand) ||
    (previousCommittedTotal > 0n && currentCommittedTotal === 0n);
  const nextBetPiles = new Map(
    (didRoundComplete ? currentBetPiles : currentCommittedBetPiles).map((pile) => [
      pile.seatId,
      { ...pile }
    ])
  );

  currentData.seats.forEach((seat, index) => {
    const previousStack = previousStacks.get(seat.id) ?? parseChipValue(seat.stackChips);
    const currentCommitted = getSeatCommittedStreetChips(seat);
    const previousCommittedAmount = previousCommitted.get(seat.id) ?? 0n;

    if (didRoundComplete || currentCommitted <= previousCommittedAmount) {
      return;
    }

    const seatContribution = currentCommitted - previousCommittedAmount;
    const stackDrop = previousStack - parseChipValue(seat.stackChips);
    const visibleAmount = stackDrop > 0n && stackDrop < seatContribution ? stackDrop : seatContribution;
    const from = seatCoordinates.get(seat.id);
    const to = from ? getBetPileCoordinates(from) : null;

    if (!from || !to || visibleAmount <= 0n) {
      return;
    }

    animations.push({
      key: `${currentData.hand?.id ?? currentData.table.id}:bet:${seat.id}:${index}`,
      amountChips: visibleAmount.toString(),
      from,
      to,
      kind: "seat-to-bet-pile",
      seatId: seat.id
    });
  });

  if (didRoundComplete) {
    for (const pile of currentBetPiles) {
      animations.push({
        key: `${currentData.hand?.id ?? currentData.table.id}:collect:${pile.seatId}:${pile.amountChips}`,
        amountChips: pile.amountChips,
        from: { left: pile.left, top: pile.top },
        to: CHIP_FLOW_POT_COORDINATES,
        kind: "bet-pile-to-pot",
        seatId: pile.seatId
      });
    }
    nextBetPiles.clear();
  }

  const winners = currentData.hand?.resultSummary?.winners ?? [];
  const resultKeyChanged =
    getChipFlowResultKey(previousData.hand) !== getChipFlowResultKey(currentData.hand);

  if (winners.length > 0 && (resultKeyChanged || potDrop > 0n)) {
    const fallbackShare = potDrop > 0n ? potDrop / BigInt(winners.length) : 0n;

    winners.forEach((winner, index) => {
      const winnerTarget = seatCoordinates.get(winner.seatId);
      const winnerAmount = parseChipValue(winner.amountChips);
      const visibleAmount =
        winnerAmount > 0n
          ? winnerAmount
          : fallbackShare > 0n
            ? fallbackShare
            : previousPot > 0n
              ? previousPot / BigInt(winners.length)
              : currentPot / BigInt(winners.length);

      if (winnerTarget && visibleAmount > 0n) {
        animations.push({
          key: `${currentData.hand?.id ?? currentData.table.id}:win:${winner.seatId}:${index}`,
          amountChips: visibleAmount.toString(),
          from: CHIP_FLOW_POT_COORDINATES,
          to: winnerTarget,
          kind: "pot-to-seat",
          winnerSeatId: winner.seatId
        });
      }
    });
  }

  return {
    animations,
    betPiles: Array.from(nextBetPiles.values()),
    shouldPulsePot: potIncrease > 0n || didRoundComplete || potDrop > 0n
  };
}

export function buildBetPileCollectionAnimations(
  piles: BetPile[],
  animationKeyPrefix: string
): ChipFlowAnimation[] {
  return piles.map((pile, index) => ({
    key: `${animationKeyPrefix}:collect-local:${pile.seatId}:${pile.amountChips}:${index}`,
    amountChips: pile.amountChips,
    from: { left: pile.left, top: pile.top },
    to: CHIP_FLOW_POT_COORDINATES,
    kind: "bet-pile-to-pot",
    seatId: pile.seatId
  }));
}

export function mergeCenterPotPile(
  currentPile: CenterPotPile | null,
  amount: bigint
): CenterPotPile | null {
  if (amount <= 0n) {
    return currentPile;
  }

  const currentAmount = parseChipValue(currentPile?.amountChips);
  const nextAmount = currentAmount + amount;

  return {
    amountChips: nextAmount.toString(),
    key: `${nextAmount.toString()}:${Date.now()}`
  };
}

export function buildCenterPotPile(data: GetVirtualTableResponseDto): CenterPotPile | null {
  const potAmount = parseChipValue(data.table.potTotalChips);
  const streetCommitments = sumSeatStreetCommitments(data.seats);
  const centerAmount = potAmount > streetCommitments ? potAmount - streetCommitments : 0n;

  if (centerAmount <= 0n) {
    return null;
  }

  return {
    amountChips: centerAmount.toString(),
    key: `${data.hand?.id ?? data.table.id}:${centerAmount.toString()}`
  };
}

export function buildCommittedBetPiles(
  data: GetVirtualTableResponseDto,
  mySeatId: string | null
): BetPile[] {
  const seatLayout = buildActiveSeatLayout(
    data.seats,
    data.table.maxSeats,
    mySeatId,
    data.hand?.currentActorSeatId
  );
  const seatCoordinates = new Map(
    seatLayout.map((item) => [item.seat.id, { left: item.left, top: item.top }])
  );

  return data.seats.flatMap((seat) => {
    const amount = getSeatCommittedStreetChips(seat);
    const coordinates = seatCoordinates.get(seat.id);

    if (amount <= 0n || !coordinates) {
      return [];
    }

    const pileCoordinates = getBetPileCoordinates(coordinates);

    return [
      {
        seatId: seat.id,
        amountChips: amount.toString(),
        left: pileCoordinates.left,
        top: pileCoordinates.top
      }
    ];
  });
}

function sumSeatStreetCommitments(seats: GetVirtualTableResponseDto["seats"]): bigint {
  return seats.reduce((total, seat) => total + getSeatCommittedStreetChips(seat), 0n);
}

function getSeatCommittedStreetChips(seat: GetVirtualTableResponseDto["seats"][number]): bigint {
  return parseChipValue(
    (seat as GetVirtualTableResponseDto["seats"][number] & { committedStreetChips?: string })
      .committedStreetChips
  );
}

function getBetPileCoordinates(seatCoordinates: { left: string; top: string }): { left: string; top: string } {
  const left = parsePercentValue(seatCoordinates.left);
  const top = parsePercentValue(seatCoordinates.top);

  if (top >= 58) {
    return {
      left: `${roundCoordinate(clampCoordinate(left, 38, 62))}%`,
      top: "63%"
    };
  }

  if (top <= 30) {
    return {
      left: `${roundCoordinate(clampCoordinate(left + (50 - left) * 0.08, 24, 76))}%`,
      top: `${roundCoordinate(clampCoordinate(top + 8, 30, 35))}%`
    };
  }

  if (left < 35) {
    return {
      left: `${roundCoordinate(clampCoordinate(left + 8, 20, 34))}%`,
      top: `${roundCoordinate(clampCoordinate(top - 2, 33, 50))}%`
    };
  }

  if (left > 65) {
    return {
      left: `${roundCoordinate(clampCoordinate(left - 8, 66, 80))}%`,
      top: `${roundCoordinate(clampCoordinate(top - 2, 33, 50))}%`
    };
  }

  return {
    left: `${roundCoordinate(clampCoordinate(left + (50 - left) * 0.08, 32, 68))}%`,
    top: `${roundCoordinate(clampCoordinate(top + 7, 31, 42))}%`
  };
}

function isBettingRoundTransition(
  previousHand: GetVirtualTableResponseDto["hand"] | undefined,
  currentHand: GetVirtualTableResponseDto["hand"] | undefined
): boolean {
  if (!previousHand) {
    return false;
  }

  if (!currentHand) {
    return true;
  }

  if (previousHand.id !== currentHand.id) {
    return true;
  }

  if (previousHand.street !== currentHand.street) {
    return true;
  }

  return previousHand.status === "IN_PROGRESS" && currentHand.status !== "IN_PROGRESS";
}

function parsePercentValue(value: string): number {
  const parsed = Number.parseFloat(value.replace("%", ""));

  return Number.isFinite(parsed) ? parsed : 50;
}

function roundCoordinate(value: number): number {
  return Math.round(value * 10) / 10;
}

function clampCoordinate(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function getOpponentSeatPositions(count: number): Array<{ left: string; top: string }> {
  const presets: Record<number, Array<{ left: string; top: string }>> = {
    0: [],
    1: [{ left: "50%", top: "24%" }],
    2: [
      { left: "26%", top: "28%" },
      { left: "74%", top: "28%" }
    ],
    3: [
      { left: "18%", top: "39%" },
      { left: "50%", top: "22%" },
      { left: "82%", top: "39%" }
    ],
    4: [
      { left: "14%", top: "47%" },
      { left: "31%", top: "24%" },
      { left: "69%", top: "24%" },
      { left: "86%", top: "47%" }
    ],
    5: [
      { left: "12%", top: "50%" },
      { left: "24%", top: "27%" },
      { left: "50%", top: "20%" },
      { left: "76%", top: "27%" },
      { left: "88%", top: "50%" }
    ]
  };

  return presets[count] ?? [
    { left: "10%", top: "52%" },
    { left: "18%", top: "32%" },
    { left: "36%", top: "21%" },
    { left: "64%", top: "21%" },
    { left: "82%", top: "32%" },
    { left: "90%", top: "52%" }
  ];
}

function VirtualTableReactionLayer({
  animations,
  seatLayout
}: {
  animations: VirtualTableReactionAnimation[];
  seatLayout: SeatLayoutItem[];
}): JSX.Element {
  const seatCoordinates = new Map(
    seatLayout.map((item) => [
      item.seat.id,
      item.isMe ? { left: "50%", top: "64%" } : { left: item.left, top: item.top }
    ])
  );
  const seatOffsets = new Map<string, number>();

  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden" data-testid="virtual-table-reaction-layer">
      {animations.map((animation) => {
        const origin = seatCoordinates.get(animation.seatId) ?? { left: "50%", top: "60%" };
        const seatOffsetIndex = seatOffsets.get(animation.seatId) ?? 0;
        seatOffsets.set(animation.seatId, seatOffsetIndex + 1);
        const laneOffset = seatOffsetIndex * 10 - 8;

        return (
          <div
            key={animation.key}
            className="virtual-table-reaction-burst absolute flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-[#171717]/82 text-[22px] shadow-[0_12px_30px_rgba(0,0,0,0.3)] backdrop-blur"
            data-reaction-id={animation.reactionId ?? ""}
            data-testid="virtual-table-reaction-burst"
            style={{
              left: origin.left,
              top: origin.top,
              "--reaction-target-left": `calc(50% + ${laneOffset}px)`,
              "--reaction-target-top": "43%",
              "--reaction-rotate": `${laneOffset * 0.7}deg`
            } as CSSProperties}
          >
            {animation.emoji}
          </div>
        );
      })}
    </div>
  );
}

export function BetPileLayer({ piles }: { piles: BetPile[] }): JSX.Element | null {
  if (piles.length === 0) {
    return null;
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-[18] overflow-hidden" data-testid="virtual-table-bet-pile-layer">
      {piles.map((pile) => (
        <div
          key={pile.seatId}
          className="absolute -translate-x-1/2 -translate-y-1/2"
          data-testid="virtual-table-bet-pile"
          style={{ left: pile.left, top: pile.top }}
        >
          <ChipStack amountChips={pile.amountChips} />
        </div>
      ))}
    </div>
  );
}

export function CenterPotPileLayer({ pile }: { pile: CenterPotPile | null }): JSX.Element | null {
  if (!pile) {
    return null;
  }

  return (
    <div
      className="pointer-events-none absolute inset-0 z-[19] overflow-hidden"
      data-testid="virtual-table-center-pot-pile-layer"
    >
      <div
        key={pile.key}
        className="virtual-table-center-pot-pile absolute -translate-x-1/2 -translate-y-1/2"
        data-testid="virtual-table-center-pot-pile"
        style={{ left: CHIP_FLOW_POT_COORDINATES.left, top: CHIP_FLOW_POT_COORDINATES.top }}
      >
        <ChipStack amountChips={pile.amountChips} center />
      </div>
    </div>
  );
}

export function ChipFlowLayer({ animations }: { animations: ChipFlowAnimation[] }): JSX.Element | null {
  if (animations.length === 0) {
    return null;
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden" data-testid="virtual-table-chip-flow-layer">
      {animations.map((animation) => (
        <div
          key={animation.key}
          className="virtual-table-chip-flow absolute"
          data-flow-kind={animation.kind}
          data-testid="virtual-table-chip-flow"
          style={{
            left: animation.from.left,
            top: animation.from.top,
            "--chip-flow-left-start": animation.from.left,
            "--chip-flow-top-start": animation.from.top,
            "--chip-flow-left-end": animation.to.left,
            "--chip-flow-top-end": animation.to.top
          } as CSSProperties}
        >
          <ChipStack amountChips={animation.amountChips} compact />
        </div>
      ))}
    </div>
  );
}

function ChipStack({
  amountChips,
  compact = false,
  center = false
}: {
  amountChips: string;
  compact?: boolean;
  center?: boolean;
}): JSX.Element {
  const chipCount = getVisibleChipCount(amountChips);
  const chipSizeClassName = compact ? "h-3 w-3" : center ? "h-4 w-4" : "h-3.5 w-3.5";
  const chipPalette = getChipPalette(amountChips);

  return (
    <div className={cn("relative flex items-center justify-center", center ? "min-h-9 min-w-12" : "min-h-8 min-w-11")}>
      {Array.from({ length: chipCount }, (_, index) => (
        <span
          key={index}
          className={cn(
            "absolute rounded-full border border-white/55 shadow-[0_2px_8px_rgba(0,0,0,0.32)] ring-1 ring-black/20",
            chipSizeClassName
          )}
          data-testid="virtual-table-poker-chip"
          style={{
            background: getPokerChipBackground(chipPalette, index),
            left: `${(index % 2) * 6 - 3}px`,
            top: `${center ? 12 - index * 2 : 10 - index * 2}px`
          }}
        >
          <span className="absolute left-1/2 top-1/2 h-1/2 w-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/50 bg-black/12" />
        </span>
      ))}
      <span
        className={cn(
          "absolute rounded-full bg-[#101512]/78 px-1.5 py-0.5 font-semibold leading-none text-[#f4efcf] shadow-[0_6px_14px_rgba(0,0,0,0.24)]",
          center ? "top-8 text-[14px]" : "top-7 text-[11px]"
        )}
      >
        {formatChips(amountChips)}
      </span>
    </div>
  );
}

export function sanitizeBlindDraftInput(value: string): string {
  return value.replace(/[^\d]/g, "");
}

export function getBlindDraftValidation(draft: {
  smallBlindChips: string;
  bigBlindChips: string;
}): { isValid: boolean } {
  const bigBlind = Number.parseInt(draft.bigBlindChips, 10);

  if (
    draft.bigBlindChips === "" ||
    !Number.isFinite(bigBlind) ||
    bigBlind < 2
  ) {
    return { isValid: false };
  }

  return { isValid: true };
}

export function filterAdminActionsForResultOverlay(
  actions: VirtualAdminAction[],
  showResultOverlay: boolean
): VirtualAdminAction[] {
  if (!showResultOverlay) {
    return actions;
  }

  return actions.filter((action) => action !== "next-hand");
}

function normalizeResultSummary(
  hand: GetVirtualTableResponseDto["hand"] | undefined
): ResultOverlayModel | null {
  if (!hand || hand.status !== "COMPLETED" || !hand.resultSummary) {
    return null;
  }

  const primaryWinner = getPrimaryResultWinner(hand.resultSummary);

  if (!primaryWinner) {
    return null;
  }

  return {
    type: hand.resultSummary.wonByFold ? "fold" : "showdown",
    winnerDisplayName: primaryWinner.displayName,
    handRankLabel: primaryWinner.handRankLabel,
    bestFiveCards: primaryWinner.bestFiveCards,
    amountChips: primaryWinner.amountChips
  };
}

function getResultOverlayKey(
  hand: GetVirtualTableResponseDto["hand"] | undefined,
  summary: ResultOverlayModel | null
): string | null {
  if (!hand || !summary) {
    return null;
  }

  return `${hand.id}:${summary.type}:${summary.winnerDisplayName}:${summary.amountChips ?? ""}`;
}

function getPrimaryResultWinner(
  resultSummary: VirtualHandResultSummaryDto
): VirtualHandResultSummaryDto["winners"][number] | null {
  return resultSummary.winners[0] ?? null;
}

function getCardRevealDelayClassName(index: number): string {
  const delays = [
    "virtual-card-delay-0",
    "virtual-card-delay-1",
    "virtual-card-delay-2",
    "virtual-card-delay-3",
    "virtual-card-delay-4",
    "virtual-card-delay-5",
    "virtual-card-delay-6"
  ];

  return delays[index] ?? delays[delays.length - 1]!;
}

function formatCompactWinProbability(value: number): string {
  const rounded = Math.round(value * 10) / 10;

  return new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: Number.isInteger(rounded) ? 0 : 1,
    maximumFractionDigits: 1
  }).format(rounded) + "%";
}

function getChipFlowResultKey(hand: GetVirtualTableResponseDto["hand"] | undefined): string {
  if (!hand || hand.status !== "COMPLETED" || !hand.resultSummary) {
    return "";
  }

  const winnersKey = hand.resultSummary.winners
    .map((winner) => `${winner.seatId}:${winner.amountChips}`)
    .join("|");

  return `${hand.id}:${hand.status}:${winnersKey}`;
}

function parseChipValue(value: string | null | undefined): bigint {
  if (!value) {
    return 0n;
  }

  try {
    return BigInt(value);
  } catch {
    return 0n;
  }
}

function getVisibleChipCount(amountChips: string): number {
  const amount = Number.parseInt(amountChips, 10);

  if (!Number.isFinite(amount) || amount <= 0) {
    return 2;
  }

  if (amount >= 5000) {
    return 5;
  }

  if (amount >= 1000) {
    return 4;
  }

  if (amount >= 300) {
    return 3;
  }

  return 2;
}

function getChipPalette(amountChips: string): { base: string; dark: string; light: string } {
  const amount = Number.parseInt(amountChips, 10);

  if (!Number.isFinite(amount) || amount < 300) {
    return { base: "#2f80ed", dark: "#17437e", light: "#74b7ff" };
  }

  if (amount < 1000) {
    return { base: "#27ae60", dark: "#145c35", light: "#7de7a9" };
  }

  if (amount < 5000) {
    return { base: "#d94a4a", dark: "#782020", light: "#ff9b9b" };
  }

  return { base: "#5b3fd6", dark: "#26176f", light: "#a897ff" };
}

function getPokerChipBackground(
  palette: { base: string; dark: string; light: string },
  index: number
): string {
  const rotation = index % 2 === 0 ? "0deg" : "22deg";

  return `conic-gradient(from ${rotation}, #f7f5ed 0deg 18deg, ${palette.base} 18deg 50deg, #f7f5ed 50deg 68deg, ${palette.base} 68deg 112deg, #f7f5ed 112deg 130deg, ${palette.base} 130deg 180deg, #f7f5ed 180deg 198deg, ${palette.base} 198deg 242deg, #f7f5ed 242deg 260deg, ${palette.base} 260deg 310deg, #f7f5ed 310deg 328deg, ${palette.base} 328deg 360deg), radial-gradient(circle at 35% 28%, ${palette.light} 0%, ${palette.base} 46%, ${palette.dark} 100%)`;
}

function TableAnimationStyles(): JSX.Element {
  return (
    <style>{`
      @keyframes stack-delta-float {
        0% { opacity: 0; transform: translate(-50%, 10px) scale(0.94); }
        15% { opacity: 1; transform: translate(-50%, 0) scale(1); }
        100% { opacity: 0; transform: translate(-50%, -18px) scale(1.02); }
      }

      @keyframes virtual-card-reveal {
        0% { opacity: 0; transform: translateY(8px) scale(0.96); }
        100% { opacity: 1; transform: translateY(0) scale(1); }
      }

      @keyframes virtual-chip-flow {
        0% {
          opacity: 0;
          left: var(--chip-flow-left-start, 50%);
          top: var(--chip-flow-top-start, 45%);
          transform: translate(-50%, -50%) scale(0.78);
        }
        18% {
          opacity: 1;
          left: var(--chip-flow-left-start, 50%);
          top: var(--chip-flow-top-start, 45%);
          transform: translate(-50%, -50%) scale(1);
        }
        82% {
          opacity: 1;
          left: var(--chip-flow-left-end, 50%);
          top: var(--chip-flow-top-end, 45%);
          transform: translate(-50%, -50%) scale(1);
        }
        100% {
          opacity: 0;
          left: var(--chip-flow-left-end, 50%);
          top: var(--chip-flow-top-end, 45%);
          transform: translate(-50%, -50%) scale(0.92);
        }
      }

      @keyframes virtual-pot-pulse {
        0% { transform: scale(1); box-shadow: 0 12px 24px rgba(0,0,0,0.24); }
        35% { transform: scale(1.12); box-shadow: 0 0 0 6px rgba(78,222,163,0.12), 0 18px 32px rgba(0,0,0,0.32); }
        100% { transform: scale(1); box-shadow: 0 12px 24px rgba(0,0,0,0.24); }
      }

      @keyframes virtual-center-pot-pile-pop {
        0% { opacity: 0; transform: translate(-50%, -50%) scale(0.82); }
        45% { opacity: 1; transform: translate(-50%, -50%) scale(1.08); }
        100% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
      }

      @keyframes virtual-table-reaction-burst {
        0% {
          opacity: 0;
          transform: translate(-50%, -50%) scale(0.72);
        }
        14% {
          opacity: 1;
          transform: translate(-50%, -68%) scale(1.04) rotate(var(--reaction-rotate, 0deg));
        }
        72% {
          opacity: 1;
          left: var(--reaction-target-left, 50%);
          top: var(--reaction-target-top, 43%);
          transform: translate(-50%, -50%) scale(1.02) rotate(calc(var(--reaction-rotate, 0deg) * 0.25));
        }
        100% {
          opacity: 0;
          left: var(--reaction-target-left, 50%);
          top: calc(var(--reaction-target-top, 43%) - 5%);
          transform: translate(-50%, -50%) scale(0.92);
        }
      }

      .virtual-card-reveal {
        opacity: 0;
        animation: virtual-card-reveal 320ms ease-out forwards;
      }

      .virtual-table-reaction-burst {
        animation: virtual-table-reaction-burst 2s ease-out forwards;
      }

      .virtual-table-chip-flow {
        animation: virtual-chip-flow 900ms cubic-bezier(0.2, 0.72, 0.25, 1) forwards;
      }

      .virtual-table-center-pot-pile {
        animation: virtual-center-pot-pile-pop 420ms ease-out forwards;
      }

      .virtual-card-delay-0 { animation-delay: 0ms; }
      .virtual-card-delay-1 { animation-delay: 60ms; }
      .virtual-card-delay-2 { animation-delay: 120ms; }
      .virtual-card-delay-3 { animation-delay: 180ms; }
      .virtual-card-delay-4 { animation-delay: 240ms; }
      .virtual-card-delay-5 { animation-delay: 300ms; }
      .virtual-card-delay-6 { animation-delay: 360ms; }

      @media (prefers-reduced-motion: reduce) {
        .virtual-card-reveal {
          opacity: 1;
          animation: none;
        }

        .virtual-table-reaction-burst {
          opacity: 1;
          animation: none;
          transform: translate(-50%, calc(-50% - 10rem));
        }

        .virtual-table-chip-flow {
          opacity: 1;
          animation: none;
          left: var(--chip-flow-left-end, 50%);
          top: var(--chip-flow-top-end, 45%);
          transform: translate(-50%, -50%);
        }

        .virtual-table-center-pot-pile {
          opacity: 1;
          animation: none;
        }
      }
    `}</style>
  );
}

function ResultSummaryOverlay({ summary }: { summary: ResultOverlayModel }): JSX.Element {
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center px-5 py-6">
      <div
        className="w-full max-w-[18rem] rounded-[1.5rem] border border-white/10 bg-[#0f1312]/88 px-4 py-5 text-center shadow-[0_28px_56px_rgba(0,0,0,0.38)] backdrop-blur"
        data-testid="virtual-table-result-overlay"
      >
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#79f6bf]">
          Итог раздачи
        </div>
        <div className="mt-2 text-2xl font-semibold text-white">{summary.winnerDisplayName}</div>
        {summary.type === "showdown" ? (
          <>
            <div className="mt-2 text-sm text-[#d5d9da]">
              Победная комбинация: {summary.handRankLabel ?? "Комбинация собрана"}
            </div>
            <div className="mt-4 flex justify-center gap-1.5">
              {summary.bestFiveCards.slice(0, 5).map((cardCode, index) => (
                <VirtualPlayingCard
                  key={`${cardCode}-${index}`}
                  cardCode={cardCode}
                  compact
                />
              ))}
            </div>
          </>
        ) : (
          <div className="mt-3 text-sm text-[#d5d9da]">
            {summary.winnerDisplayName} забрал банк без вскрытия
          </div>
        )}
        {summary.amountChips ? (
          <div className="mt-4 text-lg font-semibold text-[#dffdec]">{formatChips(summary.amountChips)}</div>
        ) : null}
      </div>
    </div>
  );
}

function FloatingSceneButton({
  icon,
  ariaLabel,
  ariaExpanded,
  onClick
}: {
  icon: string;
  ariaLabel: string;
  ariaExpanded?: boolean;
  onClick: () => void;
}): JSX.Element {
  return (
    <button
      {...(typeof ariaExpanded === "boolean" ? { "aria-expanded": ariaExpanded } : {})}
      aria-label={ariaLabel}
      className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-[#101512]/72 text-white shadow-[0_14px_32px_rgba(0,0,0,0.34)] backdrop-blur-xl transition hover:bg-[#18201b]"
      onClick={onClick}
      type="button"
    >
      <span className="material-symbols-outlined text-[20px]">{icon}</span>
    </button>
  );
}

function FloatingInfoPill({
  icon,
  label,
  value,
  tone = "default"
}: {
  icon: string;
  label: string;
  value: string;
  tone?: "default" | "accent" | "muted";
}): JSX.Element {
  return (
    <div
      className={cn(
        "flex min-w-[8.35rem] items-center gap-2 rounded-full border px-3 py-2 shadow-[0_14px_32px_rgba(0,0,0,0.34)] backdrop-blur-xl",
        tone === "default" && "border-white/10 bg-[#101512]/72 text-[#e6eee8]",
        tone === "accent" && "border-[#4edea3]/26 bg-[#102119]/76 text-[#dff7e8]",
        tone === "muted" && "border-[#e0c78a]/16 bg-[#181612]/72 text-[#efe6bf]"
      )}
    >
      <span className="material-symbols-outlined text-[20px] text-[#4edea3]">{icon}</span>
      <span className="min-w-0">
        <span className="block truncate text-[0.82rem] font-semibold leading-tight text-white">{value}</span>
        <span className="block truncate text-[0.66rem] font-medium leading-tight text-[#b9c2bd]">{label}</span>
      </span>
    </div>
  );
}

function SeatAvatar({
  seat,
  isCurrentActor,
  animation,
  size
}: {
  seat: GetVirtualTableResponseDto["seats"][number];
  isCurrentActor: boolean;
  animation: SeatStackDeltaAnimation | undefined;
  size: string;
}): JSX.Element {
  const avatarUrl = getSeatAvatarUrl(seat);
  const initials = getAvatarInitials(seat.displayName ?? `Игрок ${seat.seatNumber}`);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-full border border-white/12 bg-[#202622] shadow-[0_16px_32px_rgba(0,0,0,0.34)]",
        size,
        seat.status === "FOLDED" && "opacity-60",
        isCurrentActor && "ring-4 ring-[#4edea3]/22 shadow-[0_0_0_1px_rgba(78,222,163,0.26),0_0_26px_rgba(78,222,163,0.26)]",
        animation?.direction === "win" &&
          "ring-4 ring-[#4edea3]/30 shadow-[0_0_24px_rgba(78,222,163,0.32)]",
        animation?.direction === "loss" && "ring-2 ring-[#ff7b95]/20"
      )}
      data-testid="seat-avatar"
    >
      {avatarUrl ? (
        <img
          alt={seat.displayName ?? `Игрок ${seat.seatNumber}`}
          className="h-full w-full object-cover"
          src={avatarUrl}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_30%_25%,#48524c_0%,#232924_62%,#161a17_100%)] text-[11px] font-semibold text-white">
          {initials}
        </div>
      )}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.18),transparent_42%)]" />
    </div>
  );
}

function VirtualFinishedTableResults({
  table,
  seats,
  settlement,
  mySeatId
}: {
  table: GetVirtualTableResponseDto["table"];
  seats: GetVirtualTableResponseDto["seats"];
  settlement: VirtualTableSettlementDto | null | undefined;
  mySeatId: string | null;
}): JSX.Element {
  if (!settlement) {
    return (
      <div className="space-y-4" data-testid="virtual-finished-results">
        <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] px-4 py-5">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#79f6bf]">
            Игра завершена
          </div>
          <h2 className="mt-3 text-2xl font-semibold text-white">Расчёт пока недоступен</h2>
          <p className="mt-2 text-sm leading-6 text-[#c4c7c8]">
            Мы покажем общий итог и переводы сразу после подготовки расчёта стола.
          </p>
        </div>
      </div>
    );
  }

  const totalBuyins = settlement.totalStartingStackChips;
  const totalFinalAmount = settlement.totalFinalStackChips;
  const myResult = getMySettlementResult(settlement, seats, mySeatId);

  return (
    <div className="space-y-4" data-testid="virtual-finished-results">
      <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] px-4 py-5">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#79f6bf]">
          Игра завершена
        </div>
        <h2 className="mt-3 text-2xl font-semibold text-white">Итоги стола</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <FinishedMetric label="Ваш итог" value={formatSettlementMoney(myResult?.netChips ?? "0", table)} />
          <FinishedMetric label="Всего на входе" value={formatSettlementAbsoluteMoney(totalBuyins, table)} />
          <FinishedMetric label="На финише" value={formatSettlementAbsoluteMoney(totalFinalAmount, table)} />
        </div>
      </div>

      <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] px-4 py-5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-lg font-semibold text-white">Игроки</h3>
          <span className="text-sm text-[#8e9192]">{settlement.players.length}</span>
        </div>
        <div className="mt-4 space-y-3">
          {settlement.players.map((player) => (
            <div
              key={player.seatId}
              className="flex items-center justify-between gap-3 rounded-xl border border-white/8 bg-white/[0.03] px-3 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">{player.displayName}</p>
                <p className="mt-1 text-xs text-[#8e9192]">
                  {formatChips(player.finalStackChips)} фишек
                </p>
              </div>
              <p className={cn("text-sm font-semibold", getResultTextColor(player.netChips))}>
                {formatSettlementMoney(player.netChips, table)}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] px-4 py-5">
        <h3 className="text-lg font-semibold text-white">Кто кому переводит</h3>
        {settlement.transfers.length === 0 ? (
          <p className="mt-3 text-sm leading-6 text-[#8e9192]">
            Переводы не нужны. Итог можно закрывать без дополнительных действий.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {settlement.transfers.map((transfer, index) => (
              <div
                key={`${transfer.fromSeatId}:${transfer.toSeatId}:${index}`}
                className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-3"
              >
                <p className="text-sm text-white">
                  <span className="font-semibold">{transfer.fromName}</span> переводит{" "}
                  <span className="font-semibold">{transfer.toName}</span>
                </p>
                <p className="mt-1 text-sm font-semibold text-[#79f6bf]">
                  {formatSettlementMoney(transfer.amountChips, table)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SeatBadge({
  children,
  tone,
  compact = false
}: {
  children: ReactNode;
  tone: "accent" | "warning" | "muted" | "danger";
  compact?: boolean;
}): JSX.Element {
  return (
    <span
      className={cn(
        "rounded-full font-semibold uppercase tracking-[0.08em]",
        compact ? "px-1 py-0.5 text-[8px]" : "px-1.5 py-0.5 text-[9px]",
        tone === "accent" && "bg-[#4edea3]/14 text-[#79f6bf]",
        tone === "warning" && "bg-[#f3d48d]/18 text-[#f3d48d]",
        tone === "muted" && "bg-white/[0.08] text-[#c4c7c8]",
        tone === "danger" && "bg-[#ff7b95]/18 text-[#ff9bb0]"
      )}
    >
      {children}
    </span>
  );
}

function FinishedMetric({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8e9192]">
        {label}
      </div>
      <div className="mt-2 text-lg font-semibold text-white">{value}</div>
    </div>
  );
}

function getMySettlementResult(
  settlement: VirtualTableSettlementDto,
  seats: GetVirtualTableResponseDto["seats"],
  mySeatId: string | null
): VirtualTableSettlementDto["players"][number] | null {
  const mySeat = getMySeat(seats, mySeatId);

  if (!mySeat) {
    return settlement.players[0] ?? null;
  }

  return settlement.players.find((player) => player.seatId === mySeat.id) ?? null;
}

function formatSettlementMoney(
  chips: string,
  table: GetVirtualTableResponseDto["table"]
): string {
  if (!table.chipValueMinor || !table.chipValueCurrency) {
    return `${formatSignedChips(chips)} фишек`;
  }

  const chipAmount = BigInt(chips);
  const sign = chipAmount > 0n ? "+" : chipAmount < 0n ? "-" : "";
  const absolute = chipAmount < 0n ? chipAmount * -1n : chipAmount;
  const minor = absolute * BigInt(table.chipValueMinor);
  const rubles = Number(minor) / 100;
  const formatted = new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: table.chipValueCurrency
  }).format(rubles);

  return `${sign}${formatted}`;
}

function formatSettlementAbsoluteMoney(
  chips: string,
  table: GetVirtualTableResponseDto["table"]
): string {
  if (!table.chipValueMinor || !table.chipValueCurrency) {
    return `${formatChips(chips)} фишек`;
  }

  const minor = BigInt(chips) * BigInt(table.chipValueMinor);
  const rubles = Number(minor) / 100;

  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: table.chipValueCurrency
  }).format(rubles);
}

function formatSignedChips(chips: string): string {
  const chipAmount = BigInt(chips);
  const sign = chipAmount > 0n ? "+" : chipAmount < 0n ? "-" : "";
  const absolute = chipAmount < 0n ? chipAmount * -1n : chipAmount;

  return `${sign}${formatChips(absolute)}`;
}

function getResultTextColor(chips: string): string {
  const amount = BigInt(chips);

  if (amount > 0n) {
    return "text-[#79f6bf]";
  }

  if (amount < 0n) {
    return "text-[#ff9bb0]";
  }

  return "text-white";
}

function getSeatAvatarUrl(seat: GetVirtualTableResponseDto["seats"][number]): string | null {
  const avatarUrl = (seat as GetVirtualTableResponseDto["seats"][number] & { avatarUrl?: string | null }).avatarUrl;

  return typeof avatarUrl === "string" && avatarUrl.length > 0 ? avatarUrl : null;
}

function getSeatBadges(
  seat: GetVirtualTableResponseDto["seats"][number]
): Array<{ label: string; tone: "accent" | "warning" | "muted" | "danger" }> {
  const badges: Array<{ label: string; tone: "accent" | "warning" | "muted" | "danger" }> = [];

  if (seat.isDealer) {
    badges.push({ label: "D", tone: "warning" });
  }

  if (seat.isSmallBlind) {
    badges.push({ label: "SB", tone: "muted" });
  }

  if (seat.isBigBlind) {
    badges.push({ label: "BB", tone: "muted" });
  }

  if (seat.status === "ALL_IN") {
    badges.push({ label: "ALL-IN", tone: "danger" });
  } else if (seat.status === "FOLDED") {
    badges.push({ label: "FOLD", tone: "muted" });
  } else if (isSitOutSeatStatus(seat.status)) {
    badges.push({ label: "AWAY", tone: "muted" });
  } else {
    const label = getSeatStatusLabel(seat.status);

    if (label !== "За столом" && label !== "Ждет ход" && label !== "Ходит") {
      badges.push({ label, tone: "muted" });
    }
  }

  return badges;
}

export function HistoryOverlay({
  handNumber,
  historyOverlay
}: {
  handNumber: number | null;
  historyOverlay: VirtualTableScreenProps["historyOverlay"] | undefined;
}): JSX.Element {
  if (!historyOverlay) {
    return (
      <div className="space-y-4">
        <p className="text-sm leading-6 text-[#c4c7c8]">История раздач пока недоступна.</p>
      </div>
    );
  }

  const { data, errorMessage, isLoadingMore = false, onLoadMore, onOpenHand, onRetry, status } = historyOverlay;

  return (
    <div className="space-y-4">
      {handNumber ? (
        <div className="rounded-[1.2rem] border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-[#c4c7c8]">
          Сейчас идет раздача #{handNumber}.
        </div>
      ) : null}
      {status === "loading" && !data ? (
        <div className="rounded-[1.2rem] border border-white/8 bg-white/[0.03] px-4 py-4 text-sm text-[#c4c7c8]">
          Поднимаем последние раздачи.
        </div>
      ) : null}
      {status === "error" && !data ? (
        <div className="space-y-3 rounded-[1.2rem] border border-[#ffb4ab]/20 bg-[#2b1c1c]/60 px-4 py-4">
          <p className="text-sm leading-6 text-[#f0c7c1]">
            {errorMessage ?? "Не получилось загрузить историю раздач."}
          </p>
          {onRetry ? (
            <Button className="w-full" onClick={onRetry}>
              Попробовать еще раз
            </Button>
          ) : null}
        </div>
      ) : null}
      {data ? (
        <>
          {status === "error" && errorMessage ? (
            <div className="rounded-[1.2rem] border border-[#ffb4ab]/20 bg-[#2b1c1c]/60 px-4 py-3 text-sm text-[#f0c7c1]">
              {errorMessage}
            </div>
          ) : null}
          {data.items.length === 0 ? (
            <div className="rounded-[1.2rem] border border-white/8 bg-white/[0.03] px-4 py-4 text-sm text-[#c4c7c8]">
              Завершенных раздач пока нет.
            </div>
          ) : (
            <div className="space-y-2">
              {data.items.map((item) => (
                <button
                  key={item.id}
                  className="w-full rounded-[1.2rem] border border-white/8 bg-white/[0.03] px-4 py-3 text-left transition hover:bg-white/[0.05]"
                  data-testid="history-overlay-item"
                  onClick={() => onOpenHand?.(item.id)}
                  type="button"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-white/8 bg-white/[0.04] px-2 py-0.5 text-[11px] font-semibold text-white/90">
                          #{item.handNumber}
                        </span>
                        <span className="text-[11px] text-[#8e9192]">{getStreetLabel(item.street)}</span>
                      </div>
                      <div className="mt-2 truncate text-sm font-semibold text-white">
                        {formatHistoryOverlayWinners(item)}
                      </div>
                      <div className="mt-1 text-sm text-[#c4c7c8]">{formatHistoryOverlayResult(item)}</div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-sm font-semibold text-[#dffdec]">{formatHistoryOverlayAmount(item)}</div>
                      <span className="material-symbols-outlined mt-2 text-[18px] text-[#8e9192]">arrow_forward</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
          {data.nextCursor && onLoadMore ? (
            <Button className="w-full" disabled={isLoadingMore} onClick={onLoadMore}>
              {isLoadingMore ? "Подгружаем еще" : "Показать еще"}
            </Button>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function formatHistoryOverlayWinners(item: VirtualHandHistoryListItemDto): string {
  if (item.winners.length === 0) {
    return "Победитель уточняется";
  }

  const [primaryWinner, ...otherWinners] = item.winners;

  if (!primaryWinner) {
    return "Победитель уточняется";
  }

  return otherWinners.length === 0
    ? primaryWinner.displayName
    : `${primaryWinner.displayName} и еще ${otherWinners.length}`;
}

function formatHistoryOverlayResult(item: VirtualHandHistoryListItemDto): string {
  const primaryWinner = item.winners[0] as
    | (VirtualHandHistoryListItemDto["winners"][number] & {
        handRankLabel?: string | null;
        bestFiveCards?: string[] | null;
      })
    | undefined;

  return primaryWinner?.handRankLabel ?? "Без вскрытия";
}

function formatHistoryOverlayAmount(item: VirtualHandHistoryListItemDto): string {
  if (item.winners.length === 0) {
    return formatChips(item.potTotalChips);
  }

  const total = item.winners.reduce<bigint>((sum, winner) => sum + BigInt(winner.amountChips), 0n);
  return formatChips(total);
}

export function AdminOverlay({
  adminActions,
  blindDraft,
  callbacks,
  onBlindDraftChange
}: {
  adminActions: ReturnType<typeof getVisibleAdminActions>;
  blindDraft: {
    smallBlindChips: string;
    bigBlindChips: string;
  };
  callbacks: VirtualTableCallbacks | undefined;
  onBlindDraftChange: Dispatch<
    SetStateAction<{
      smallBlindChips: string;
      bigBlindChips: string;
    }>
  >;
}): JSX.Element {
  const blindDraftValidation = getBlindDraftValidation(blindDraft);
  const derivedSmallBlindChips = deriveSmallBlindChips(blindDraft.bigBlindChips);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        {adminActions.includes("pause") ? (
          <AdminActionButton label="Пауза" onClick={callbacks?.onPauseTable} />
        ) : null}
        {adminActions.includes("resume") ? (
          <AdminActionButton label="Продолжить" onClick={callbacks?.onResumeTable} />
        ) : null}
        {adminActions.includes("finish") ? (
          <AdminActionButton
            label="Завершить стол"
            onClick={callbacks?.onFinishTable}
            tone="danger"
          />
        ) : null}
        {adminActions.includes("cancel") ? (
          <AdminActionButton label="Отменить стол" onClick={callbacks?.onCancelTable} tone="danger" />
        ) : null}
        {adminActions.includes("next-hand") ? (
          <AdminActionButton label="Следующая раздача" onClick={callbacks?.onStartNextHand} tone="accent" />
        ) : null}
      </div>

      {adminActions.includes("raise-blinds") ? (
        <div className="rounded-[1.25rem] border border-white/8 bg-white/[0.03] p-3">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8e9192]">
            Следующие блайнды
          </div>
          <p className="mt-2 text-sm text-[#c4c7c8]">Обновятся с новой раздачей.</p>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <label className="rounded-xl border border-white/8 bg-[#1c1c1c] px-3 py-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8e9192]">
                Большой
              </span>
              <input
                className="mt-1 w-full bg-transparent text-lg font-semibold text-white outline-none"
                inputMode="numeric"
                onChange={(event) =>
                  onBlindDraftChange((current) => ({
                    ...current,
                    bigBlindChips: sanitizeBlindDraftInput(event.target.value)
                  }))
                }
                value={blindDraft.bigBlindChips}
              />
            </label>
            <div className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8e9192]">
                Малый
              </span>
              <div className="mt-1 text-lg font-semibold text-white">
                {derivedSmallBlindChips ? formatChips(derivedSmallBlindChips) : "—"}
              </div>
            </div>
          </div>

          {!blindDraftValidation.isValid ? (
            <p className="mt-3 text-sm text-[#f3d48d]">
              Большой блайнд должен быть от 2 фишек
            </p>
          ) : null}

          <button
            className="mt-3 w-full rounded-xl border border-white/10 bg-[#232323] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#2a2a2a] disabled:opacity-40"
            disabled={!blindDraftValidation.isValid}
            onClick={() => {
              void callbacks?.onRaiseBlinds?.({
                bigBlindChips: blindDraft.bigBlindChips,
                smallBlindChips: derivedSmallBlindChips
              });
            }}
            type="button"
          >
            Поднять блайнды
          </button>
        </div>
      ) : null}
    </div>
  );
}

function BreakOverlay({
  callbacks,
  mySeatStatus,
  sitOutDraft,
  onSitOutDraftChange
}: {
  callbacks: VirtualTableCallbacks | undefined;
  mySeatStatus: GetVirtualTableResponseDto["seats"][number]["status"] | undefined;
  sitOutDraft: {
    autoCheck: boolean;
    autoFold: boolean;
  };
  onSitOutDraftChange: Dispatch<
    SetStateAction<{
      autoCheck: boolean;
      autoFold: boolean;
    }>
  >;
}): JSX.Element {
  if (isSitOutSeatStatus(mySeatStatus)) {
    return (
      <div className="space-y-4">
        <div>
          <div className="text-sm font-semibold text-white">
            {mySeatStatus === "RETURN_REQUESTED" ? "Вы уже возвращаетесь" : "Сейчас вы отдыхаете"}
          </div>
          <p className="mt-2 text-sm leading-6 text-[#c4c7c8]">
            {mySeatStatus === "SIT_OUT_REQUESTED"
              ? "Текущая раздача закончится без вас."
              : mySeatStatus === "RETURN_REQUESTED"
                ? "Стол вернет вас в игру со следующей раздачи."
                : "Можно спокойно вернуться, когда будете готовы."}
          </p>
        </div>

        <div className="space-y-3 rounded-[1.25rem] border border-white/8 bg-white/[0.03] p-3">
          <ToggleRow
            checked={sitOutDraft.autoCheck}
            description="Когда можно, ход пройдет без вложений."
            label="Авточек"
            onChange={(checked) => onSitOutDraftChange((current) => ({ ...current, autoCheck: checked }))}
          />
          <ToggleRow
            checked={sitOutDraft.autoFold}
            description="Если чек недоступен, карты уйдут в пас."
            label="Автофолд"
            onChange={(checked) => onSitOutDraftChange((current) => ({ ...current, autoFold: checked }))}
          />
        </div>

        <div className="flex gap-2">
          {callbacks?.onReturnToTable ? (
            <Button
              className="flex-1"
              onClick={() => {
                void callbacks.onReturnToTable?.();
              }}
            >
              Вернуться
            </Button>
          ) : null}

          {callbacks?.onRequestSitOut ? (
            <button
              className="flex-1 rounded-xl border border-white/10 bg-[#232323] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#2a2a2a]"
              onClick={() => {
                void callbacks.onRequestSitOut?.(sitOutDraft);
              }}
              type="button"
            >
              Обновить отдых
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="text-sm font-semibold text-white">Нужна пауза</div>
        <p className="mt-2 text-sm leading-6 text-[#c4c7c8]">
          Стол доиграет текущую ситуацию и мягко переведет вас в режим отдыха.
        </p>
      </div>

      <div className="space-y-3 rounded-[1.25rem] border border-white/8 bg-white/[0.03] p-3">
        <ToggleRow
          checked={sitOutDraft.autoCheck}
          description="Когда можно, ход просто пройдет."
          label="Авточек"
          onChange={(checked) => onSitOutDraftChange((current) => ({ ...current, autoCheck: checked }))}
        />
        <ToggleRow
          checked={sitOutDraft.autoFold}
          description="Если чек недоступен, карты уйдут в пас."
          label="Автофолд"
          onChange={(checked) => onSitOutDraftChange((current) => ({ ...current, autoFold: checked }))}
        />
      </div>

      <button
        className="w-full rounded-xl border border-white/10 bg-[#232323] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#2a2a2a]"
        onClick={() => {
          void callbacks?.onRequestSitOut?.(sitOutDraft);
        }}
        type="button"
      >
        Уйти на отдых
      </button>
    </div>
  );
}

function StateOverlay({
  table,
  surface,
  playersCount,
  reactionsVisible,
  onReactionsVisibleChange
}: {
  table: GetVirtualTableResponseDto["table"];
  surface: ReturnType<typeof getVirtualTableSurface>;
  playersCount: number;
  reactionsVisible: boolean;
  onReactionsVisibleChange: (visible: boolean) => void;
}): JSX.Element {
  return (
    <div className="space-y-4">
      <div className="rounded-[1.25rem] border border-white/8 bg-white/[0.03] p-4">
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8e9192]">
          Состояние
        </div>
        <div className="mt-2 text-lg font-semibold text-white">{surfaceTitle(surface)}</div>
        <p className="mt-2 text-sm leading-6 text-[#c4c7c8]">{surfaceDescription(surface)}</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <InfoTile label="Игроков" value={`${playersCount}/${table.maxSeats}`} />
        <InfoTile
          label="Блайнды"
          value={`${formatChips(table.smallBlindChips)}/${formatChips(table.bigBlindChips)}`}
        />
      </div>

      <div className="rounded-[1.25rem] border border-white/8 bg-white/[0.03] p-3">
        <ToggleRow
          checked={reactionsVisible}
          description="Анимации реакций можно скрыть только на этом устройстве."
          label="Показывать реакции"
          onChange={onReactionsVisibleChange}
        />
      </div>

      {table.pendingSmallBlindChips && table.pendingBigBlindChips ? (
        <div className="rounded-[1.25rem] border border-[#4edea3]/12 bg-[#4edea3]/8 p-4 text-sm text-[#c7f8df]">
          Следующие блайнды {formatChips(table.pendingSmallBlindChips)}/
          {formatChips(table.pendingBigBlindChips)} уже запланированы.
        </div>
      ) : null}
    </div>
  );
}

export function TableOverlay({
  title,
  children,
  onClose
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}): JSX.Element {
  return (
    <div className="fixed inset-0 z-[80] bg-black/75 backdrop-blur-sm" onClick={onClose}>
      <div
        className="absolute inset-x-2 bottom-[calc(env(safe-area-inset-bottom)+1rem)] top-[calc(env(safe-area-inset-top)+5.25rem)] mx-auto flex w-auto max-w-lg flex-col overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#171717]/96 shadow-2xl"
        data-testid="virtual-table-overlay-panel"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex min-h-0 flex-1 flex-col px-4 pb-4 pt-4">
          <div className="mx-auto h-1.5 w-14 rounded-full bg-white/10" />
          <div className="sticky top-0 z-10 mt-4 flex items-start justify-between gap-3 bg-[#171717]/96 pb-3">
            <h3 className="text-xl font-semibold text-white">{title}</h3>
            <button
              aria-label="Закрыть окно"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white transition hover:bg-white/[0.08]"
              onClick={onClose}
              type="button"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-2 pt-1" data-testid="virtual-table-overlay-scroll">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

function AdminActionButton({
  label,
  onClick,
  tone = "neutral"
}: {
  label: string;
  onClick?: (() => void | Promise<void>) | undefined;
  tone?: "neutral" | "danger" | "accent";
}): JSX.Element {
  return (
    <button
      className={cn(
        "rounded-xl border px-4 py-3 text-sm font-semibold transition",
        tone === "neutral" && "border-white/10 bg-[#232323] text-white hover:bg-[#2a2a2a]",
        tone === "danger" && "border-rose-400/25 bg-rose-500/10 text-rose-100 hover:bg-rose-500/16",
        tone === "accent" && "border-[#4edea3]/25 bg-[#4edea3]/12 text-[#79f6bf] hover:bg-[#4edea3]/18"
      )}
      disabled={!onClick}
      onClick={() => {
        void onClick?.();
      }}
      type="button"
    >
      {label}
    </button>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}): JSX.Element {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <div className="text-sm font-semibold text-white">{label}</div>
        <div className="mt-1 text-sm text-[#8e9192]">{description}</div>
      </div>
      <button
        aria-pressed={checked}
        className={cn(
          "relative mt-1 h-7 w-12 rounded-full transition",
          checked ? "bg-[#4edea3]" : "bg-[#333333]"
        )}
        onClick={() => onChange(!checked)}
        type="button"
      >
        <span
          className={cn(
            "absolute top-1 h-5 w-5 rounded-full bg-white transition",
            checked ? "left-6" : "left-1"
          )}
        />
      </button>
    </div>
  );
}

function InfoTile({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="rounded-[1rem] border border-white/8 bg-white/[0.03] px-3 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8e9192]">{label}</div>
      <div className="mt-2 text-lg font-semibold text-white">{value}</div>
    </div>
  );
}

function getOverlayTitle(key: Exclude<TableOverlayKey, null>): string {
  switch (key) {
    case "history":
      return "История раздач";
    case "admin":
      return "Управление столом";
    case "break":
      return "Перерыв";
    case "state":
      return "Стол и блайнды";
  }
}

function surfaceTitle(surface: ReturnType<typeof getVirtualTableSurface>): string {
  switch (surface) {
    case "waiting":
      return "Ждем начало игры";
    case "paused":
      return "Игра на паузе";
    case "finished":
      return "Стол завершен";
    case "cancelled":
      return "Стол отменен";
    default:
      return "Раздача идет";
  }
}

function surfaceDescription(surface: ReturnType<typeof getVirtualTableSurface>): string {
  switch (surface) {
    case "waiting":
      return "Как только соберутся игроки, администратор сможет запустить первую раздачу.";
    case "paused":
      return "Игра остановлена. Продолжить ее можно из меню управления.";
    case "finished":
      return "Новые действия за этим столом уже недоступны.";
    case "cancelled":
      return "Стол закрыт до начала игры.";
    default:
      return "Следите за банком, блайндами и очередью хода.";
  }
}

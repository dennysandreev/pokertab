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
  const [reactionsVisible, setReactionsVisible] = useState(
    () => reactionsVisibleProp ?? getStoredVirtualReactionsVisibility()
  );
  const previousStacksRef = useRef<Record<string, string>>(createSeatStackMap(seats));
  const animationTimeoutsRef = useRef<Record<string, number>>({});
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
        "relative text-white",
        isGameSurface
          ? "flex h-[100dvh] flex-col overflow-hidden px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-[calc(env(safe-area-inset-top)+3.75rem)]"
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
            className="absolute right-5 top-[max(4.5rem,calc(env(safe-area-inset-top)+3.75rem))] w-52 rounded-[1.35rem] border border-white/10 bg-[#171717]/96 p-2 shadow-2xl backdrop-blur-xl"
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

      <div className={cn("mx-auto flex w-full max-w-[430px] flex-col", isGameSurface && "min-h-0 flex-1")}>
        <div
          className="relative shrink-0 rounded-[1.15rem] border border-white/8 bg-white/[0.02] px-3 py-2.5 backdrop-blur"
          data-testid="virtual-table-game-header"
        >
          <div className="flex items-start gap-3 pr-20">
            <div className="min-w-0 flex-1">
              <div className="truncate text-[1rem] font-semibold leading-tight text-white">
                {table.title}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-[#aeb4b5]">
                <span className="rounded-full border border-white/8 bg-white/[0.04] px-2 py-0.5 text-white/90">
                  {hand ? `Раздача #${hand.handNumber}` : "Ждем раздачу"}
                </span>
                <span>Блайнды {formatChips(table.smallBlindChips)}/{formatChips(table.bigBlindChips)}</span>
                {table.pendingSmallBlindChips && table.pendingBigBlindChips ? (
                  <span className="text-[#79f6bf]">
                    Следом {formatChips(table.pendingSmallBlindChips)}/{formatChips(table.pendingBigBlindChips)}
                  </span>
                ) : null}
              </div>
            </div>
            <div className="shrink-0 rounded-full border border-white/8 bg-[#121212]/88 px-2.5 py-1 text-[12px] font-semibold text-white">
              {timerLabel}
            </div>
          </div>
          <button
            aria-label="Открыть меню стола"
            className="absolute right-2.5 top-2.5 inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-[#161616]/88 text-white shadow-lg backdrop-blur transition hover:bg-[#1f1f1f]"
            onClick={() => {
              setIsReactionPickerOpen(false);
              setIsMenuOpen((current) => !current);
            }}
            type="button"
          >
            <span className="material-symbols-outlined text-[18px]">more_horiz</span>
          </button>
        </div>

        <div className={cn("mt-3 flex min-h-0 flex-col", isGameSurface && "flex-1")}>
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
              className={cn(
                "relative overflow-hidden rounded-[2.35rem] border border-white/8 bg-[radial-gradient(circle_at_top,rgba(78,222,163,0.12),transparent_22rem),linear-gradient(180deg,#141414_0%,#0d0d0d_100%)] shadow-[0_30px_60px_rgba(0,0,0,0.4)]",
                isGameSurface
                  ? "mx-auto h-full w-full flex-1"
                  : "px-3 pb-8 pt-5"
              )}
            >
            <div className="pointer-events-none absolute inset-x-[6%] top-[4.8%] bottom-[6%] rounded-[2.4rem] border-[14px] border-[#2a2a2a]" />
            <div className="pointer-events-none absolute inset-x-[10%] top-[7%] bottom-[10%] rounded-[50%] bg-[radial-gradient(circle_at_center,#1f5a42_0%,#13372a_50%,#0b1713_100%)] shadow-[inset_0_18px_30px_rgba(255,255,255,0.04)]" />

            <button
              aria-expanded={isReactionPickerOpen}
              aria-label="Отправить реакцию"
              className={cn(
                "absolute bottom-3 right-3 z-30 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-[#161616]/88 text-[18px] shadow-lg backdrop-blur transition hover:bg-[#1f1f1f]",
                !canSendReaction && "opacity-40"
              )}
              data-testid="virtual-table-reaction-trigger"
              disabled={!canSendReaction}
              onClick={() => {
                setIsMenuOpen(false);
                setActiveOverlay(null);
                setIsReactionPickerOpen((current) => !current);
              }}
              type="button"
            >
              <span aria-hidden="true">🙂</span>
            </button>
            {isReactionPickerOpen ? (
              <div
                className="absolute bottom-14 right-3 z-30 w-[12.75rem] rounded-[1.15rem] border border-white/10 bg-[#171717]/96 p-2 shadow-2xl backdrop-blur-xl"
                data-testid="virtual-table-reaction-picker"
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

            <div className="relative z-10 h-full px-2 pb-4 pt-2 sm:px-3">
              {showResultOverlay && normalizedResultSummary ? (
                <ResultSummaryOverlay summary={normalizedResultSummary} />
              ) : null}
              {visibleReactionAnimations.length > 0 ? (
                <VirtualTableReactionLayer animations={visibleReactionAnimations} seatLayout={seatLayout} />
              ) : null}

              <div
                className={cn(
                  "pointer-events-none absolute left-1/2 top-[38%] z-20 -translate-x-1/2 text-center text-4xl font-bold sm:text-5xl",
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

              <div className="pointer-events-none absolute inset-x-[26%] top-[43%] text-center" data-testid="virtual-table-pot">
                <div className="text-[1rem] font-semibold leading-none text-[#dffdec] sm:text-[1.15rem]">
                  {formatChips(table.potTotalChips)}
                </div>
              </div>
              <div className="pointer-events-none absolute inset-x-[22%] top-[49%] text-center" data-testid="virtual-table-board">
                <div className="text-[11px] text-[#d1e8de]">
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

                return (
                  <article
                    key={seat.id}
                    className="absolute w-[4.35rem] -translate-x-1/2 -translate-y-1/2 text-center"
                    data-testid="seat-chip"
                    style={{ left, top }}
                  >
                    {animation ? (
                      <div
                        className={cn(
                          "pointer-events-none absolute left-1/2 top-[-1.2rem] -translate-x-1/2 text-[11px] font-bold animate-[stack-delta-float_1.2s_ease-out_forwards]",
                          animation.direction === "win" ? "text-[#79f6bf]" : "text-[#ff7b95]"
                        )}
                      >
                        {animation.label}
                      </div>
                    ) : null}
                    <div
                      className={cn(
                        "mx-auto flex h-7 w-7 items-center justify-center rounded-full border border-white/12 bg-[#232323] text-[11px] font-semibold text-white shadow-[0_12px_28px_rgba(0,0,0,0.38)]",
                        seat.status === "FOLDED" && "opacity-55",
                        isCurrentActor && "ring-4 ring-[#4edea3]/20",
                        animation?.direction === "win" &&
                          "ring-4 ring-[#4edea3]/35 shadow-[0_0_24px_rgba(78,222,163,0.38)]",
                        animation?.direction === "loss" &&
                          "animate-[stack-delta-shake_1.2s_ease-in-out] opacity-65"
                      )}
                    >
                      {getAvatarInitials(seat.displayName ?? `Игрок ${seat.seatNumber}`)}
                    </div>
                    <div
                      className={cn(
                        "mt-1 rounded-full border border-white/10 bg-[#121212]/92 px-2 py-1 shadow-[0_10px_18px_rgba(0,0,0,0.24)] backdrop-blur",
                        isCurrentActor && "border-[#4edea3]/30",
                        animation?.direction === "win" && "border-[#4edea3]/30 bg-[#11261d]/95",
                        animation?.direction === "loss" && "border-[#ff7b95]/25 bg-[#1b1518]/95"
                      )}
                    >
                      <div className="truncate text-[9px] font-semibold text-white">
                        {seat.displayName ?? `Игрок ${seat.seatNumber}`}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center justify-center gap-1 text-[9px] text-[#8e9192]">
                        {getSeatBadges(seat, isCurrentActor).slice(0, 3).map((badge) => (
                          <SeatBadge compact key={badge.label} tone={badge.tone}>
                            {badge.label}
                          </SeatBadge>
                        ))}
                      </div>
                      <div
                        className="mt-0.5 truncate text-[10px] font-semibold text-[#d5d9da]"
                        data-testid="seat-chip-stack"
                      >
                        {formatChips(seat.stackChips)}
                      </div>
                    </div>
                  </article>
                );
              })}

              <div
                className={cn(
                  "absolute bottom-[3.8rem] left-1/2 flex -translate-x-1/2 items-end justify-center gap-2 rounded-[1.4rem] px-2 py-1 transition",
                  mySeatAnimation?.direction === "win" &&
                    "shadow-[0_0_30px_rgba(78,222,163,0.24)] ring-1 ring-[#4edea3]/35",
                  mySeatAnimation?.direction === "loss" &&
                    "animate-[stack-delta-shake_1.2s_ease-in-out] bg-[#1a1216]/35 ring-1 ring-[#ff7b95]/25"
                )}
                data-testid="table-private-cards"
              >
                {(hand?.myPrivateCards.length ? hand.myPrivateCards : [undefined, undefined]).map(
                  (cardCode, index) => (
                    <VirtualPlayingCard
                      key={cardCode ?? `private-${index}`}
                      cardCode={cardCode ?? null}
                      className={cn(
                        "virtual-card-reveal h-[5.25rem] w-[3.6rem] rounded-[0.9rem] border border-[#4edea3]/25 ring-1 ring-[#4edea3]/15",
                        getCardRevealDelayClassName(index + 5)
                      )}
                    />
                  )
                )}
              </div>

              {mySeatLayout ? (
                <article
                  className="absolute bottom-1 left-1/2 w-[6.1rem] -translate-x-1/2 text-center"
                  data-testid="my-seat-chip"
                >
                  {mySeatAnimation ? (
                    <div
                      className={cn(
                        "pointer-events-none absolute left-1/2 top-[-1.2rem] -translate-x-1/2 text-[11px] font-bold animate-[stack-delta-float_1.2s_ease-out_forwards]",
                        mySeatAnimation.direction === "win" ? "text-[#79f6bf]" : "text-[#ff7b95]"
                      )}
                    >
                      {mySeatAnimation.label}
                    </div>
                  ) : null}
                  <div
                    className={cn(
                      "rounded-[1rem] border border-white/10 bg-[#121212]/92 px-2 py-1.5 shadow-[0_10px_18px_rgba(0,0,0,0.24)] backdrop-blur",
                      mySeatAnimation?.direction === "win" &&
                        "ring-1 ring-[#4edea3]/35 shadow-[0_0_24px_rgba(78,222,163,0.2)]",
                      mySeatAnimation?.direction === "loss" &&
                        "animate-[stack-delta-shake_1.2s_ease-in-out] border-[#ff7b95]/25 bg-[#1b1518]/95"
                    )}
                  >
                    <div className="flex items-center justify-center gap-1">
                      {mySeatLayout.isCurrentActor ? (
                        <span className="text-[9px] font-semibold uppercase tracking-[0.08em] text-[#79f6bf]">
                          Ход
                        </span>
                      ) : null}
                      <span className="truncate text-[10px] font-semibold text-white">Вы</span>
                      {getSeatBadges(mySeatLayout.seat, mySeatLayout.isCurrentActor)
                        .filter((badge) => badge.label === "D" || badge.label === "SB" || badge.label === "BB")
                        .slice(0, 2)
                        .map((badge) => (
                          <SeatBadge compact key={badge.label} tone={badge.tone}>
                            {badge.label}
                          </SeatBadge>
                        ))}
                    </div>
                    <div className="mt-0.5 flex items-center justify-center gap-1 text-[12px] font-semibold text-[#d5d9da]">
                      <span>{formatChips(mySeatLayout.seat.stackChips)}</span>
                      {getSeatBadges(mySeatLayout.seat, mySeatLayout.isCurrentActor)
                        .filter((badge) => !["D", "SB", "BB", "Ход"].includes(badge.label))
                        .slice(0, 1)
                        .map((badge) => (
                          <SeatBadge compact key={badge.label} tone={badge.tone}>
                            {badge.label}
                          </SeatBadge>
                        ))}
                    </div>
                    {table.winProbabilityEnabled && mySeatLayout.seat.winProbabilityPercent != null ? (
                      <div
                        className="mt-0.5 flex items-center justify-center gap-1 text-[10px] font-semibold leading-none text-[#bdeed6]"
                        data-testid="my-seat-win-probability"
                      >
                        <span className="material-symbols-outlined text-[13px] leading-none">bolt</span>
                        {formatCompactWinProbability(mySeatLayout.seat.winProbabilityPercent)}
                      </div>
                    ) : null}
                  </div>
                </article>
              ) : null}
            </div>
            </section>
          )}
        </div>

        <div className="mt-2 shrink-0">
          {showActionControls && !showResultOverlay && hand && callbacks?.onSubmitAction ? (
            <div className="mt-3">
              <VirtualActionControls
                disabled={Boolean(pendingAction)}
                hand={hand}
                pendingActionType={pendingAction}
                playerStackChips={mySeat?.stackChips}
                onSubmitAction={callbacks.onSubmitAction}
                potTotalChips={table.potTotalChips}
              />
            </div>
          ) : !isGameSurface && surface !== "finished" ? (
            <div className="mt-4 rounded-[1.25rem] border border-white/10 bg-white/[0.03] px-4 py-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8e9192]">
                Состояние стола
              </div>
              <div className="mt-2 text-lg font-semibold text-white">{surfaceTitle(surface)}</div>
              <p className="mt-2 text-sm leading-6 text-[#c4c7c8]">{surfaceDescription(surface)}</p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function buildActiveSeatLayout(
  seats: GetVirtualTableResponseDto["seats"],
  tableMaxSeats: number,
  mySeatId: string | null | undefined,
  currentActorSeatId: string | null | undefined
): Array<{
  seat: GetVirtualTableResponseDto["seats"][number];
  isMe: boolean;
  isCurrentActor: boolean;
  left: string;
  top: string;
}> {
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
      ? { left: "50%", top: "72%" }
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

function getOpponentSeatPositions(count: number): Array<{ left: string; top: string }> {
  const presets: Record<number, Array<{ left: string; top: string }>> = {
    0: [],
    1: [{ left: "50%", top: "21%" }],
    2: [
      { left: "28%", top: "25%" },
      { left: "72%", top: "25%" }
    ],
    3: [
      { left: "18%", top: "37%" },
      { left: "50%", top: "19%" },
      { left: "82%", top: "37%" }
    ],
    4: [
      { left: "14%", top: "46%" },
      { left: "30%", top: "23%" },
      { left: "70%", top: "23%" },
      { left: "86%", top: "46%" }
    ],
    5: [
      { left: "12%", top: "49%" },
      { left: "24%", top: "25%" },
      { left: "50%", top: "18%" },
      { left: "76%", top: "25%" },
      { left: "88%", top: "49%" }
    ]
  };

  return presets[count] ?? [
    { left: "10%", top: "52%" },
    { left: "18%", top: "31%" },
    { left: "36%", top: "20%" },
    { left: "64%", top: "20%" },
    { left: "82%", top: "31%" },
    { left: "90%", top: "52%" }
  ];
}

function VirtualTableReactionLayer({
  animations,
  seatLayout
}: {
  animations: VirtualTableReactionAnimation[];
  seatLayout: Array<{
    seat: GetVirtualTableResponseDto["seats"][number];
    isMe: boolean;
    isCurrentActor: boolean;
    left: string;
    top: string;
  }>;
}): JSX.Element {
  const seatCoordinates = new Map(
    seatLayout.map((item) => [
      item.seat.id,
      item.isMe ? { left: "50%", top: "92%" } : { left: item.left, top: item.top }
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

export function sanitizeBlindDraftInput(value: string): string {
  return value.replace(/[^\d]/g, "");
}

export function getBlindDraftValidation(draft: {
  smallBlindChips: string;
  bigBlindChips: string;
}): { isValid: boolean } {
  const smallBlind = Number.parseInt(draft.smallBlindChips, 10);
  const bigBlind = Number.parseInt(draft.bigBlindChips, 10);

  if (
    draft.smallBlindChips === "" ||
    draft.bigBlindChips === "" ||
    !Number.isFinite(smallBlind) ||
    !Number.isFinite(bigBlind) ||
    smallBlind <= 0 ||
    bigBlind <= 0 ||
    bigBlind <= smallBlind
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

function TableAnimationStyles(): JSX.Element {
  return (
    <style>{`
      @keyframes stack-delta-float {
        0% { opacity: 0; transform: translate(-50%, 10px) scale(0.94); }
        15% { opacity: 1; transform: translate(-50%, 0) scale(1); }
        100% { opacity: 0; transform: translate(-50%, -18px) scale(1.02); }
      }

      @keyframes stack-delta-shake {
        0%, 100% { transform: translateX(0); }
        20% { transform: translateX(-2px); }
        40% { transform: translateX(2px); }
        60% { transform: translateX(-2px); }
        80% { transform: translateX(1px); }
      }

      @keyframes virtual-card-reveal {
        0% { opacity: 0; transform: translateY(8px) scale(0.96); }
        100% { opacity: 1; transform: translateY(0) scale(1); }
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

function getSeatBadges(
  seat: GetVirtualTableResponseDto["seats"][number],
  isCurrentActor: boolean
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
  } else if (isCurrentActor) {
    badges.push({ label: "Ход", tone: "accent" });
  } else {
    const label = getSeatStatusLabel(seat.status);

    if (label !== "За столом" && label !== "Ждет ход") {
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
                Малый
              </span>
              <input
                className="mt-1 w-full bg-transparent text-lg font-semibold text-white outline-none"
                inputMode="numeric"
                onChange={(event) =>
                  onBlindDraftChange((current) => ({
                    ...current,
                    smallBlindChips: sanitizeBlindDraftInput(event.target.value)
                  }))
                }
                value={blindDraft.smallBlindChips}
              />
            </label>
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
          </div>

          {!blindDraftValidation.isValid ? (
            <p className="mt-3 text-sm text-[#f3d48d]">
              Блайнды должны быть больше нуля, большой больше малого
            </p>
          ) : null}

          <button
            className="mt-3 w-full rounded-xl border border-white/10 bg-[#232323] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#2a2a2a] disabled:opacity-40"
            disabled={!blindDraftValidation.isValid}
            onClick={() => {
              void callbacks?.onRaiseBlinds?.(blindDraft);
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

function TableOverlay({
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
        className="absolute inset-x-2 bottom-0 mx-auto w-auto max-w-lg overflow-hidden rounded-t-[1.75rem] border border-white/10 bg-[#171717]/96 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4">
          <div className="mx-auto h-1.5 w-14 rounded-full bg-white/10" />
          <div className="mt-4 flex items-start justify-between gap-3">
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
          <div className="mt-4">{children}</div>
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

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { GetVirtualTableResponseDto, VirtualHandResultSummaryDto } from "@pokertable/shared";
import {
  AdminOverlay,
  filterAdminActionsForResultOverlay,
  getBlindDraftValidation,
  HistoryOverlay,
  sanitizeBlindDraftInput,
  VirtualTableScreen
} from "./virtual-table-screen";
import { virtualReactionEmojis } from "./virtual-table-view";
import { buildSeatStackDeltaAnimations } from "./virtual-table-stack-delta";

const activeTableData: GetVirtualTableResponseDto = {
  table: {
    id: "table-1",
    title: "Ночной стол",
    status: "ACTIVE",
    maxSeats: 6,
    inviteCode: "AB12CD34",
    startingStackChips: "5000",
    chipValueMinor: "1",
    chipValueCurrency: "RUB",
    smallBlindChips: "50",
    bigBlindChips: "100",
    pendingSmallBlindChips: null,
    pendingBigBlindChips: null,
    turnDurationSeconds: 30,
    reminderDelaySeconds: 10,
    timeoutAutoActionRule: "CHECK_OR_FOLD",
    winProbabilityEnabled: false,
    potTotalChips: "900",
    currentHandId: "hand-1",
    createdAt: "2026-05-14T10:00:00.000Z",
    startedAt: "2026-05-14T10:05:00.000Z",
    pausedAt: null,
    finishedAt: null
  },
  seats: [
    {
      id: "seat-1",
      userId: "user-1",
      displayName: "Denis Andreev",
      seatNumber: 1,
      role: "OWNER",
      stackChips: "4200",
      status: "WAITING_FOR_TURN",
      isDealer: false,
      isSmallBlind: false,
      isBigBlind: false,
      winProbabilityPercent: 37.5
    },
    {
      id: "seat-2",
      userId: "user-2",
      displayName: "Alex Blue",
      seatNumber: 2,
      role: "PLAYER",
      stackChips: "3900",
      status: "ACTING",
      isDealer: true,
      isSmallBlind: true,
      isBigBlind: false,
      winProbabilityPercent: 37
    },
    {
      id: "seat-3",
      userId: "user-3",
      displayName: "Ira Green",
      seatNumber: 3,
      role: "PLAYER",
      stackChips: "0",
      status: "ALL_IN",
      isDealer: false,
      isSmallBlind: false,
      isBigBlind: true,
      winProbabilityPercent: null
    }
  ],
  reactions: [],
  hand: {
    id: "hand-1",
    handNumber: 18,
    status: "IN_PROGRESS",
    street: "TURN",
    board: ["AS", "KH", "TD", "2C"],
    currentActorSeatId: "seat-1",
    currentTimer: {
      id: "timer-1",
      seatId: "seat-1",
      status: "ACTIVE",
      startedAt: "2026-05-14T10:06:00.000Z",
      reminderDueAt: "2026-05-14T10:06:10.000Z",
      expiresAt: "2099-05-14T10:06:30.000Z",
      remindedAt: null
    },
    currentBetChips: "200",
    callAmountChips: "200",
    myPrivateCards: ["QC", "QS"],
    resultSummary: null,
    myLegalActions: [
      { type: "FOLD" },
      { type: "CALL", amountChips: "200" },
      { type: "RAISE", minAmountChips: "400", maxAmountChips: "4200" },
      { type: "ALL_IN", amountChips: "4200" }
    ]
  }
};

const pausedTableData: GetVirtualTableResponseDto = {
  ...activeTableData,
  table: {
    ...activeTableData.table,
    status: "PAUSED"
  }
};

const completedShowdownTableData = {
  ...activeTableData,
  hand: {
    ...activeTableData.hand,
    status: "COMPLETED",
    resultSummary: {
      revealUntil: "2099-05-14T10:06:40.000Z",
      wonByFold: false,
      winners: [
        {
          seatId: "seat-2",
          displayName: "Alex Blue",
          amountChips: "1500",
          handRank: "STRAIGHT",
          handRankLabel: "Стрит",
          bestFiveCards: ["9S", "TS", "JS", "QH", "KC"]
        }
      ]
    } satisfies VirtualHandResultSummaryDto
  }
} as GetVirtualTableResponseDto;

const completedFoldTableData = {
  ...activeTableData,
  hand: {
    ...activeTableData.hand,
    status: "COMPLETED",
    resultSummary: {
      revealUntil: "2099-05-14T10:06:40.000Z",
      wonByFold: true,
      winners: [
        {
          seatId: "seat-2",
          displayName: "Alex Blue",
          amountChips: "900",
          handRank: null,
          handRankLabel: null,
          bestFiveCards: []
        }
      ]
    } satisfies VirtualHandResultSummaryDto
  }
} as GetVirtualTableResponseDto;

const historyOverlayData = {
  items: [
    {
      id: "hand-18",
      handNumber: 18,
      status: "COMPLETED",
      street: "SHOWDOWN",
      potTotalChips: "900",
      board: ["AS", "KH", "TD", "2C", "2D"],
      startedAt: "2026-05-14T10:06:00.000Z",
      completedAt: "2026-05-14T10:07:00.000Z",
      actionsCount: 12,
      winners: [
        {
          seatId: "seat-2",
          displayName: "Alex Blue",
          amountChips: "900",
          handRankLabel: "Стрит"
        }
      ]
    },
    {
      id: "hand-17",
      handNumber: 17,
      status: "COMPLETED",
      street: "TURN",
      potTotalChips: "450",
      board: ["9S", "9D", "4C", "2H"],
      startedAt: "2026-05-14T10:02:00.000Z",
      completedAt: "2026-05-14T10:03:00.000Z",
      actionsCount: 8,
      winners: [
        {
          seatId: "seat-1",
          displayName: "Denis Andreev",
          amountChips: "450"
        }
      ]
    }
  ],
  nextCursor: "cursor-2"
};

describe("virtual table screen", () => {
  it("renders centered table title without legacy running status copy", () => {
    const markup = renderToStaticMarkup(
      <VirtualTableScreen data={activeTableData} mySeatId="seat-1" />
    );

    expect(markup).toContain("Ночной стол");
    expect(markup).not.toContain("Стол в игре");
  });

  it("renders action bar labels and keeps raise sheet closed by default", () => {
    const markup = renderToStaticMarkup(
      <VirtualTableScreen
        callbacks={{ onSubmitAction: vi.fn() }}
        data={activeTableData}
        mySeatId="seat-1"
      />
    );

    expect(markup).toContain("Пас");
    expect(markup).toContain("Колл");
    expect(markup).toContain("Повысить");
    expect(markup).toContain("All-in");
    expect(markup).not.toContain("1/2 банка");
    expect(markup).not.toContain("Закрыть подбор ставки");
  });

  it("renders compact seat chips instead of large seat cards", () => {
    const markup = renderToStaticMarkup(
      <VirtualTableScreen data={activeTableData} mySeatId="seat-1" />
    );

    expect(markup).toContain('data-testid="seat-chip"');
    expect(markup).toContain('data-testid="my-seat-chip"');
    expect(markup).not.toContain("w-[4.9rem]");
    expect(markup).not.toContain("sm:w-[5.4rem]");
  });

  it("shows win probability only on my seat when the table toggle is enabled", () => {
    const disabledMarkup = renderToStaticMarkup(
      <VirtualTableScreen data={activeTableData} mySeatId="seat-1" />
    );
    const enabledMarkup = renderToStaticMarkup(
      <VirtualTableScreen
        data={{
          ...activeTableData,
          table: {
            ...activeTableData.table,
            winProbabilityEnabled: true
          }
        }}
        mySeatId="seat-1"
      />
    );

    expect(disabledMarkup).not.toContain("37%");
    expect(disabledMarkup).not.toContain("37,5%");
    expect(enabledMarkup).not.toContain("37%");
    expect(enabledMarkup).toContain("37,5%");
  });

  it("renders the compact game header instead of the old top info pills", () => {
    const markup = renderToStaticMarkup(
      <VirtualTableScreen data={activeTableData} mySeatId="seat-1" />
    );

    expect(markup).toContain('data-testid="virtual-table-game-header"');
    expect(markup).not.toContain('data-testid="virtual-table-top-info"');
    expect(markup).toContain("pt-[calc(env(safe-area-inset-top)+3.75rem)]");
    expect(markup).toContain("Раздача #18");
    expect(markup).toContain("Блайнды 50/100");
  });

  it("uses the same game canvas layout for paused tables", () => {
    const markup = renderToStaticMarkup(
      <VirtualTableScreen data={pausedTableData} mySeatId="seat-1" />
    );

    expect(markup).toContain('data-testid="virtual-table-stage"');
    expect(markup).toContain("flex h-[100dvh] flex-col overflow-hidden");
    expect(markup).not.toContain("Состояние стола");
  });

  it("renders the reaction trigger and opens the compact picker with whitelisted emoji", () => {
    const markup = renderToStaticMarkup(
      <VirtualTableScreen
        callbacks={{ onSubmitReaction: vi.fn() }}
        data={activeTableData}
        initialReactionPickerOpen
        mySeatId="seat-1"
      />
    );

    expect(markup).toContain('data-testid="virtual-table-reaction-trigger"');
    expect(markup).toContain('data-testid="virtual-table-reaction-picker"');

    for (const emoji of virtualReactionEmojis) {
      expect(markup).toContain(emoji);
    }
  });

  it("hides reaction animations when local visibility is off", () => {
    const visibleMarkup = renderToStaticMarkup(
      <VirtualTableScreen
        callbacks={{ onSubmitReaction: vi.fn() }}
        data={activeTableData}
        mySeatId="seat-1"
        reactionAnimations={[
          {
            key: "reaction-1",
            reactionId: "reaction-1",
            seatId: "seat-2",
            userId: "user-2",
            displayName: "Alex Blue",
            emoji: "🔥"
          }
        ]}
        reactionsVisible
      />
    );
    const hiddenMarkup = renderToStaticMarkup(
      <VirtualTableScreen
        callbacks={{ onSubmitReaction: vi.fn() }}
        data={activeTableData}
        mySeatId="seat-1"
        reactionAnimations={[
          {
            key: "reaction-1",
            reactionId: "reaction-1",
            seatId: "seat-2",
            userId: "user-2",
            displayName: "Alex Blue",
            emoji: "🔥"
          }
        ]}
        reactionsVisible={false}
      />
    );

    expect(visibleMarkup).toContain('data-testid="virtual-table-reaction-layer"');
    expect(hiddenMarkup).not.toContain('data-testid="virtual-table-reaction-layer"');
  });

  it("keeps private cards between the board and my seat on the table", () => {
    const markup = renderToStaticMarkup(
      <VirtualTableScreen data={activeTableData} mySeatId="seat-1" />
    );

    const tableStageIndex = markup.indexOf('data-testid="virtual-table-stage"');
    const boardIndex = markup.indexOf('data-testid="virtual-table-board"');
    const privateCardsIndex = markup.indexOf('data-testid="table-private-cards"');
    const mySeatIndex = markup.indexOf('data-testid="my-seat-chip"');

    expect(tableStageIndex).toBeGreaterThanOrEqual(0);
    expect(boardIndex).toBeGreaterThan(tableStageIndex);
    expect(privateCardsIndex).toBeGreaterThan(boardIndex);
    expect(mySeatIndex).toBeGreaterThan(privateCardsIndex);
    expect(markup).toContain("absolute bottom-[3.8rem] left-1/2");
    expect(markup).toContain("absolute bottom-1 left-1/2 w-[6.1rem] -translate-x-1/2 text-center");
  });

  it("renders a compact my seat chip without the old separate avatar block", () => {
    const markup = renderToStaticMarkup(
      <VirtualTableScreen data={activeTableData} mySeatId="seat-1" />
    );

    expect(markup).toContain(">Ход<");
    expect(markup.match(/>Ход</g)?.length).toBe(1);
    expect(markup).toContain(">Вы<");
    expect(markup).not.toContain("Ваш");
    expect(markup).not.toContain("mx-auto flex h-10 w-10 items-center justify-center rounded-full border border-[#4edea3]/60");
  });

  it("renders opponent stack on a dedicated row below badges", () => {
    const markup = renderToStaticMarkup(
      <VirtualTableScreen data={activeTableData} mySeatId="seat-1" />
    );

    expect(markup).toContain('data-testid="seat-chip-stack"');
    expect(markup).toContain("flex flex-wrap items-center justify-center gap-1 text-[9px] text-[#8e9192]");
    expect(markup).toContain("mt-0.5 truncate text-[10px] font-semibold text-[#d5d9da]");
    expect(markup).not.toContain("mt-0.5 flex items-center justify-center gap-1 text-[9px] text-[#8e9192]");
  });

  it("renders bolt icon before my win probability only on my seat", () => {
    const markup = renderToStaticMarkup(
      <VirtualTableScreen
        data={{
          ...activeTableData,
          table: {
            ...activeTableData.table,
            winProbabilityEnabled: true
          }
        }}
        mySeatId="seat-1"
      />
    );

    expect(markup).toContain('data-testid="my-seat-win-probability"');
    expect(markup).toContain(">bolt<");
    expect(markup.match(/>bolt</g)?.length).toBe(1);
    expect(markup).toContain("37,5%");
    expect(markup).not.toContain("37%");
  });

  it("renders central delta selector and card reveal classes", () => {
    const markup = renderToStaticMarkup(
      <VirtualTableScreen data={activeTableData} mySeatId="seat-1" />
    );

    expect(markup).toContain('data-testid="virtual-table-center-delta"');
    expect(markup).toContain("text-4xl font-bold sm:text-5xl");
    expect(markup).toContain("virtual-card-reveal");
    expect(markup).toContain("virtual-card-delay-0");
    expect(markup).toContain("virtual-card-delay-5");
  });

  it("positions pot below the top opponent and board below the pot", () => {
    const markup = renderToStaticMarkup(
      <VirtualTableScreen data={activeTableData} mySeatId="seat-1" />
    );

    expect(markup).toContain('data-testid="virtual-table-pot"');
    expect(markup).toContain('data-testid="virtual-table-board"');
    expect(markup).not.toContain("Банк");
    expect(markup).toContain("absolute inset-x-[26%] top-[43%] text-center");
    expect(markup).toContain("absolute inset-x-[22%] top-[49%] text-center");
  });

  it("renders showdown result overlay with rank label and five best cards", () => {
    const markup = renderToStaticMarkup(
      <VirtualTableScreen data={completedShowdownTableData} mySeatId="seat-1" />
    );

    expect(markup).toContain('data-testid="virtual-table-result-overlay"');
    expect(markup).toContain("Alex Blue");
    expect(markup).toContain("Победная комбинация: Стрит");
    expect(markup).toContain("1 500");
    expect((markup.match(/aria-label=/g) ?? []).length).toBeGreaterThanOrEqual(5);
  });

  it("renders fold result overlay without combo cards", () => {
    const markup = renderToStaticMarkup(
      <VirtualTableScreen data={completedFoldTableData} mySeatId="seat-1" />
    );

    expect(markup).toContain("без вскрытия");
    expect(markup).not.toContain("Победная комбинация:");
  });

  it("hides action panel while completed result overlay is visible", () => {
    const markup = renderToStaticMarkup(
      <VirtualTableScreen
        callbacks={{ onSubmitAction: vi.fn() }}
        data={completedShowdownTableData}
        mySeatId="seat-1"
      />
    );

    expect(markup).toContain('data-testid="virtual-table-result-overlay"');
    expect(markup).not.toContain("Пас");
    expect(markup).not.toContain("Колл");
  });

  it("hides manual next hand action while completed result overlay is visible", () => {
    expect(
      filterAdminActionsForResultOverlay(["pause", "raise-blinds", "next-hand", "finish"], true)
    ).toEqual(["pause", "raise-blinds", "finish"]);
    expect(filterAdminActionsForResultOverlay(["next-hand"], false)).toEqual(["next-hand"]);
  });

  it("uses a large table stage marker instead of the old surface strip", () => {
    const markup = renderToStaticMarkup(
      <VirtualTableScreen data={activeTableData} mySeatId="seat-1" />
    );

    expect(markup).not.toContain('data-testid="virtual-table-surface"');
    expect(markup).toContain('data-testid="virtual-table-stage"');
    expect(markup).not.toContain("max-h-[min(49vh,24rem)]");
    expect(markup).not.toContain("min-h-[20rem]");
    expect(markup).not.toContain('data-testid="virtual-table-top-info"');
  });
});

describe("history overlay", () => {
  it("renders recent hands inline with winner, amount and result label", () => {
    const markup = renderToStaticMarkup(
      <HistoryOverlay
        handNumber={18}
        historyOverlay={{
          status: "ready",
          data: historyOverlayData as never,
          errorMessage: null,
          onOpenHand: vi.fn(),
          onLoadMore: vi.fn()
        }}
      />
    );

    expect(markup).toContain("Сейчас идет раздача #18.");
    expect(markup).toContain('data-testid="history-overlay-item"');
    expect(markup).toContain("Alex Blue");
    expect(markup).toContain("Стрит");
    expect(markup).toContain("900");
    expect(markup).toContain("Без вскрытия");
    expect(markup).toContain("Показать еще");
  });

  it("shows retry state when popup history fails to load", () => {
    const markup = renderToStaticMarkup(
      <HistoryOverlay
        handNumber={null}
        historyOverlay={{
          status: "error",
          data: null,
          errorMessage: "Не получилось загрузить историю раздач",
          onRetry: vi.fn()
        }}
      />
    );

    expect(markup).toContain("Не получилось загрузить историю раздач");
    expect(markup).toContain("Попробовать еще раз");
  });
});

describe("buildSeatStackDeltaAnimations", () => {
  it("returns win and loss animation states from stack changes", () => {
    const seatOne: GetVirtualTableResponseDto["seats"][number] = activeTableData.seats[0]!;
    const seatTwo: GetVirtualTableResponseDto["seats"][number] = activeTableData.seats[1]!;
    const seatThree: GetVirtualTableResponseDto["seats"][number] = activeTableData.seats[2]!;

    const result = buildSeatStackDeltaAnimations(
      {
        "seat-1": "4200",
        "seat-2": "3900",
        "seat-3": "0"
      },
      [
        { ...seatOne, stackChips: "4500" },
        { ...seatTwo, stackChips: "3600" },
        seatThree
      ]
    );

    expect(result).toEqual({
      "seat-1": {
        delta: 300,
        direction: "win",
        label: "+300"
      },
      "seat-2": {
        delta: 300,
        direction: "loss",
        label: "-300"
      }
    });
  });
});

describe("blind draft helpers", () => {
  it("keeps blind input empty when the user clears the field", () => {
    expect(sanitizeBlindDraftInput("")).toBe("");
    expect(sanitizeBlindDraftInput("12a3")).toBe("123");
  });

  it("marks empty or inverted blinds as invalid", () => {
    expect(getBlindDraftValidation({ smallBlindChips: "", bigBlindChips: "200" }).isValid).toBe(false);
    expect(getBlindDraftValidation({ smallBlindChips: "200", bigBlindChips: "100" }).isValid).toBe(false);
    expect(getBlindDraftValidation({ smallBlindChips: "50", bigBlindChips: "100" }).isValid).toBe(true);
  });

  it("disables blind submit when the draft is invalid", () => {
    const markup = renderToStaticMarkup(
      <AdminOverlay
        adminActions={["raise-blinds"]}
        blindDraft={{ smallBlindChips: "", bigBlindChips: "100" }}
        callbacks={{ onRaiseBlinds: vi.fn() }}
        onBlindDraftChange={vi.fn()}
      />
    );

    expect(markup).toContain("Блайнды должны быть больше нуля, большой больше малого");
    expect(markup).toContain("disabled");
  });
});

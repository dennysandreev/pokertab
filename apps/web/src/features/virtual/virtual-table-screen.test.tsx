import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { GetVirtualTableResponseDto, VirtualHandResultSummaryDto } from "@pokertable/shared";
import {
  AdminOverlay,
  BetPileLayer,
  buildBetPileCollectionAnimations,
  buildCenterPotPile,
  buildChipFlowAnimations,
  buildChipFlowTransition,
  buildCommittedBetPiles,
  CenterPotPileLayer,
  ChipFlowLayer,
  filterAdminActionsForResultOverlay,
  getBlindDraftValidation,
  HistoryOverlay,
  mergeCenterPotPile,
  sanitizeBlindDraftInput,
  TableOverlay,
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
      avatarUrl: null,
      seatNumber: 1,
      role: "OWNER",
      stackChips: "4200",
      committedStreetChips: "0",
      committedTotalChips: "0",
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
      avatarUrl: null,
      seatNumber: 2,
      role: "PLAYER",
      stackChips: "3900",
      committedStreetChips: "0",
      committedTotalChips: "0",
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
      avatarUrl: null,
      seatNumber: 3,
      role: "PLAYER",
      stackChips: "0",
      committedStreetChips: "0",
      committedTotalChips: "0",
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
  it("renders active table without the old title header copy", () => {
    const markup = renderToStaticMarkup(
      <VirtualTableScreen data={activeTableData} mySeatId="seat-1" />
    );

    expect(markup).not.toContain("Ночной стол");
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
    expect(markup).not.toContain("All-in");
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

  it("renders floating table controls instead of the old top header card", () => {
    const markup = renderToStaticMarkup(
      <VirtualTableScreen data={activeTableData} mySeatId="seat-1" />
    );

    expect(markup).toContain('data-testid="virtual-table-floating-controls"');
    expect(markup).not.toContain('data-testid="virtual-table-game-header"');
    expect(markup).not.toContain('data-testid="virtual-table-top-info"');
    expect(markup).toContain("h-[100dvh] overflow-hidden bg-[#040705]");
    expect(markup).not.toContain("Ночной стол");
    expect(markup).not.toContain("Раздача #18");
    expect(markup).toContain(">50 / 100<");
    expect(markup).toContain(">Блайнды<");
    expect(markup).toContain(">Время хода<");
    expect(markup).toContain(">settings<");
    expect(markup).toContain("top-[calc(env(safe-area-inset-top)+2.75rem)]");
    expect(markup).toContain("flex items-start justify-between gap-3");
    expect(markup).toContain("ml-auto flex items-center gap-2");
    expect(markup).not.toContain("6.75rem");
    expect(markup).not.toContain(">arrow_back<");
    expect(markup).not.toContain(">keyboard_arrow_down<");
  });

  it("uses the same game canvas layout for paused tables", () => {
    const markup = renderToStaticMarkup(
      <VirtualTableScreen data={pausedTableData} mySeatId="seat-1" />
    );

    expect(markup).toContain('data-testid="virtual-table-stage"');
    expect(markup).toContain("h-[100dvh] overflow-hidden bg-[#040705]");
    expect(markup).not.toContain("Состояние стола");
  });

  it("renders the reaction trigger and opens the compact picker with whitelisted emoji", () => {
    const markup = renderToStaticMarkup(
      <VirtualTableScreen
        callbacks={{ onSubmitAction: vi.fn(), onSubmitReaction: vi.fn() }}
        data={activeTableData}
        initialReactionPickerOpen
        mySeatId="seat-1"
      />
    );

    expect(markup).toContain('data-testid="virtual-table-reaction-trigger"');
    expect(markup).toContain('data-testid="virtual-table-reaction-picker"');
    expect(markup).toContain("calc(env(safe-area-inset-bottom) + 8.5rem)");
    expect(markup).toContain("calc(env(safe-area-inset-bottom) + 12rem)");
    expect(markup).not.toContain("calc(env(safe-area-inset-bottom) + 11rem)");

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

  it("keeps private cards above my seat and above the action overlay", () => {
    const markup = renderToStaticMarkup(
      <VirtualTableScreen data={activeTableData} mySeatId="seat-1" />
    );

    const tableStageIndex = markup.indexOf('data-testid="virtual-table-stage"');
    const boardIndex = markup.indexOf('data-testid="virtual-table-board"');
    const mySeatIndex = markup.indexOf('data-testid="my-seat-chip"');
    const privateCardsIndex = markup.indexOf('data-testid="table-private-cards"');

    expect(tableStageIndex).toBeGreaterThanOrEqual(0);
    expect(boardIndex).toBeGreaterThan(tableStageIndex);
    expect(privateCardsIndex).toBeGreaterThan(boardIndex);
    expect(mySeatIndex).toBeGreaterThan(privateCardsIndex);
    expect(markup).toContain("absolute left-1/2 top-[67%]");
    expect(markup).toContain("absolute left-1/2 top-[79%] z-10 w-[9.2rem] -translate-x-1/2 -translate-y-1/2 text-center");
  });

  it("renders a compact my seat chip without text turn indicators", () => {
    const markup = renderToStaticMarkup(
      <VirtualTableScreen data={activeTableData} mySeatId="seat-1" />
    );
    const mySeatSection = markup.slice(markup.indexOf('data-testid="my-seat-chip"'));

    expect(markup).toContain(">Вы<");
    expect(markup).not.toContain("Ваш ход");
    expect(markup).not.toContain(">Ход<");
    expect(markup).not.toContain("Ходит");
    expect(markup).not.toContain(">ходит<");
    expect(markup).toContain("ring-[#4edea3]/22");
    expect(mySeatSection).toContain("h-7 w-7");
    expect(mySeatSection).toContain("rounded-[0.9rem] border border-white/10 bg-[#0c1310]/78 px-2 py-1");
    expect(mySeatSection).not.toContain("h-12 w-12");
    expect(mySeatSection).not.toContain("w-[10.5rem]");
  });

  it("renders opponent stack on its own row between name and badges", () => {
    const markup = renderToStaticMarkup(
      <VirtualTableScreen data={activeTableData} mySeatId="seat-1" />
    );

    expect(markup).toContain('data-testid="seat-chip-stack"');
    expect(markup).toContain("mt-0.5 truncate text-[10px] font-semibold text-[#e3ece5]");
    expect(markup).toContain("mt-0.5 flex flex-wrap items-center justify-center gap-0.5 text-[8px] text-[#8e9192]");
    expect(markup).not.toContain("mt-0.5 truncate text-[10px] font-semibold text-[#d5d9da]");
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
    expect(markup).toContain("absolute inset-x-[31%] top-[40%] z-10 text-center");
    expect(markup).toContain("absolute inset-x-[17%] top-[46%] z-10 text-center");
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

  it("uses a fullscreen layered table stage instead of the old surface strip", () => {
    const markup = renderToStaticMarkup(
      <VirtualTableScreen data={activeTableData} mySeatId="seat-1" />
    );

    expect(markup).toContain('data-testid="virtual-table-stage"');
    expect(markup).toContain('data-testid="virtual-table-felt"');
    expect(markup).toContain('data-testid="virtual-table-floating-controls"');
    expect(markup).not.toContain("max-h-[min(49vh,24rem)]");
    expect(markup).not.toContain("min-h-[20rem]");
    expect(markup).not.toContain('data-testid="virtual-table-top-info"');
  });

  it("does not render the old inner white oval or stack shake animation", () => {
    const markup = renderToStaticMarkup(
      <VirtualTableScreen data={activeTableData} mySeatId="seat-1" />
    );

    expect(markup).not.toContain("inset-x-[19%] top-[38%] bottom-[30%] rounded-full border");
    expect(markup).not.toContain("stack-delta-shake");
    expect(markup).not.toContain("animate-[stack-delta-shake_1.2s_ease-in-out]");
  });

  it("renders chip flow toward a local bet pile when street commitment grows", () => {
    const changedData = {
      ...activeTableData,
      table: {
        ...activeTableData.table,
        potTotalChips: "1100"
      },
      seats: activeTableData.seats.map((seat) =>
        seat.id === "seat-2"
          ? {
              ...seat,
              stackChips: "3700",
              committedStreetChips: "200",
              committedTotalChips: "200"
            }
          : seat
      )
    } satisfies GetVirtualTableResponseDto;

    const transition = buildChipFlowTransition(activeTableData, changedData, "seat-1", []);
    const animations = buildChipFlowAnimations(activeTableData, changedData, "seat-1");
    const pileMarkup = renderToStaticMarkup(<BetPileLayer piles={transition.betPiles} />);
    const changedMarkup = renderToStaticMarkup(<ChipFlowLayer animations={animations} />);
    const idleMarkup = renderToStaticMarkup(<ChipFlowLayer animations={[]} />);

    expect(animations).toHaveLength(1);
    expect(animations[0]).toMatchObject({
      amountChips: "200",
      kind: "seat-to-bet-pile",
      seatId: "seat-2"
    });
    expect(transition.betPiles).toHaveLength(1);
    expect(transition.betPiles[0]).toMatchObject({
      seatId: "seat-2",
      amountChips: "200",
      left: "27.9%",
      top: "35%"
    });
    expect(buildCenterPotPile(changedData)).toMatchObject({ amountChips: "900" });
    expect(transition.shouldPulsePot).toBe(true);
    expect(pileMarkup).toContain('data-testid="virtual-table-bet-pile-layer"');
    expect(pileMarkup).toContain('data-testid="virtual-table-bet-pile"');
    expect(pileMarkup).toContain('data-testid="virtual-table-poker-chip"');
    expect(pileMarkup).toContain("conic-gradient");
    expect(pileMarkup).not.toContain("#e1c36f");
    expect(pileMarkup).not.toContain("#946a1b");
    expect(changedMarkup).toContain('data-testid="virtual-table-chip-flow-layer"');
    expect(changedMarkup).toContain('data-testid="virtual-table-chip-flow"');
    expect(idleMarkup).toBe("");
  });

  it("keeps my local bet pile above the private cards safe zone", () => {
    const changedData = {
      ...activeTableData,
      table: {
        ...activeTableData.table,
        potTotalChips: "1100"
      },
      seats: activeTableData.seats.map((seat) =>
        seat.id === "seat-1"
          ? {
              ...seat,
              stackChips: "4000",
              committedStreetChips: "200",
              committedTotalChips: "200"
            }
          : seat
      )
    } satisfies GetVirtualTableResponseDto;

    const piles = buildCommittedBetPiles(changedData, "seat-1");

    expect(piles).toHaveLength(1);
    expect(piles[0]).toMatchObject({
      seatId: "seat-1",
      amountChips: "200",
      left: "50%",
      top: "63%"
    });
  });

  it("keeps local bet piles by the players until the betting round changes street", () => {
    const previousData = {
      ...activeTableData,
      table: {
        ...activeTableData.table,
        potTotalChips: "1100"
      },
      seats: activeTableData.seats.map((seat) =>
        seat.id === "seat-2"
          ? {
              ...seat,
              stackChips: "3700",
              committedStreetChips: "200",
              committedTotalChips: "200"
            }
          : seat
      )
    } satisfies GetVirtualTableResponseDto;
    const turnData = {
      ...previousData,
      hand: {
        ...previousData.hand!,
        street: "RIVER"
      },
      seats: previousData.seats.map((seat) => ({ ...seat, committedStreetChips: "0" }))
    } satisfies GetVirtualTableResponseDto;

    const previousPiles = buildCommittedBetPiles(previousData, "seat-1");
    const transition = buildChipFlowTransition(previousData, turnData, "seat-1", [
      { seatId: "seat-2", amountChips: "200", left: "36%", top: "33%" }
    ]);

    expect(previousPiles).toHaveLength(1);
    expect(previousPiles[0]).toMatchObject({ seatId: "seat-2", amountChips: "200" });
    expect(transition.betPiles).toEqual([]);
    expect(transition.animations).toHaveLength(1);
    expect(transition.animations[0]).toMatchObject({
      amountChips: "200",
      kind: "bet-pile-to-pot",
      seatId: "seat-2"
    });
    expect(transition.shouldPulsePot).toBe(true);
  });

  it("builds local pile collection into a persistent center pot pile", () => {
    const localPiles = [
      { seatId: "seat-2", amountChips: "200", left: "36%", top: "33%" },
      { seatId: "seat-1", amountChips: "100", left: "50%", top: "58%" }
    ];

    const animations = buildBetPileCollectionAnimations(localPiles, "hand-1");
    const centerPile = mergeCenterPotPile(null, 300n);
    const centerMarkup = renderToStaticMarkup(<CenterPotPileLayer pile={centerPile} />);

    expect(animations).toHaveLength(2);
    expect(animations[0]).toMatchObject({
      amountChips: "200",
      kind: "bet-pile-to-pot",
      seatId: "seat-2"
    });
    expect(animations[1]).toMatchObject({
      amountChips: "100",
      kind: "bet-pile-to-pot",
      seatId: "seat-1"
    });
    expect(centerPile).toMatchObject({ amountChips: "300" });
    expect(centerMarkup).toContain('data-testid="virtual-table-center-pot-pile-layer"');
    expect(centerMarkup).toContain('data-testid="virtual-table-center-pot-pile"');
    expect(centerMarkup).toContain("text-[14px]");
    expect(centerMarkup).toContain('data-testid="virtual-table-poker-chip"');
    expect(centerMarkup).toContain("300");
  });

  it("keeps the center pot pile when the same hand changes street", () => {
    const currentPile = { amountChips: "300", key: "300:test" };
    const nextPile = mergeCenterPotPile(currentPile, 200n);

    expect(nextPile).toMatchObject({ amountChips: "500" });
  });

  it("builds pot-to-winner chip flow when a completed hand resolves the pot", () => {
    const previousData = {
      ...activeTableData,
      table: {
        ...activeTableData.table,
        potTotalChips: "900"
      }
    } satisfies GetVirtualTableResponseDto;
    const settledData = {
      ...completedShowdownTableData,
      table: {
        ...completedShowdownTableData.table,
        potTotalChips: "0"
      }
    } satisfies GetVirtualTableResponseDto;

    const animations = buildChipFlowAnimations(previousData, settledData, "seat-1");

    expect(animations).toHaveLength(1);
    expect(animations[0]).toMatchObject({
      amountChips: "1500",
      kind: "pot-to-seat",
      winnerSeatId: "seat-2"
    });
  });

  it("defines pot pulse animation for pot growth", () => {
    const markup = renderToStaticMarkup(
      <VirtualTableScreen data={activeTableData} mySeatId="seat-1" />
    );

    expect(markup).not.toContain('data-testid="virtual-table-pot-value"');
    expect(markup).toContain('data-testid="virtual-table-pot-total"');
    expect(markup).toContain('data-testid="virtual-table-center-pot-pile"');
    expect(markup).toContain("@keyframes virtual-pot-pulse");
  });

  it("uses seat avatar images when avatarUrl is present", () => {
    const markup = renderToStaticMarkup(
      <VirtualTableScreen
        data={{
          ...activeTableData,
          seats: activeTableData.seats.map((seat) =>
            seat.id === "seat-2"
              ? { ...seat, avatarUrl: "https://example.com/avatar.png" }
              : seat
          )
        }}
        mySeatId="seat-1"
      />
    );

    expect(markup).toContain('src="https://example.com/avatar.png"');
    expect(markup).toContain('alt="Alex Blue"');
  });
});

describe("history overlay", () => {
  it("keeps table popup close button visible and content scrollable", () => {
    const markup = renderToStaticMarkup(
      <TableOverlay title="История раздач" onClose={vi.fn()}>
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
      </TableOverlay>
    );

    expect(markup).toContain('data-testid="virtual-table-overlay-panel"');
    expect(markup).toContain("top-[calc(env(safe-area-inset-top)+5.25rem)]");
    expect(markup).toContain('data-testid="virtual-table-overlay-scroll"');
    expect(markup).toContain("overflow-y-auto");
    expect(markup).toContain("Закрыть окно");
  });

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

  it("validates only the big blind draft", () => {
    expect(getBlindDraftValidation({ smallBlindChips: "", bigBlindChips: "" }).isValid).toBe(false);
    expect(getBlindDraftValidation({ smallBlindChips: "200", bigBlindChips: "1" }).isValid).toBe(false);
    expect(getBlindDraftValidation({ smallBlindChips: "", bigBlindChips: "100" }).isValid).toBe(true);
  });

  it("disables blind submit when the draft is invalid", () => {
    const markup = renderToStaticMarkup(
      <AdminOverlay
        adminActions={["raise-blinds"]}
        blindDraft={{ smallBlindChips: "50", bigBlindChips: "1" }}
        callbacks={{ onRaiseBlinds: vi.fn() }}
        onBlindDraftChange={vi.fn()}
      />
    );

    expect(markup).toContain("Большой блайнд должен быть от 2 фишек");
    expect(markup).toContain("disabled");
  });

  it("renders only big blind input with computed small blind preview", () => {
    const markup = renderToStaticMarkup(
      <AdminOverlay
        adminActions={["raise-blinds"]}
        blindDraft={{ smallBlindChips: "999", bigBlindChips: "75" }}
        callbacks={{ onRaiseBlinds: vi.fn() }}
        onBlindDraftChange={vi.fn()}
      />
    );

    expect(markup).toContain(">Большой<");
    expect(markup).toContain(">Малый<");
    expect(markup).toContain(">37<");
    expect(markup).not.toContain('value="999"');
  });
});

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type {
  GetVirtualTableResponseDto,
  VirtualTableDto,
  VirtualTableSettlementDto,
  VirtualTablesListItemDto
} from "@pokertable/shared";
import {
  CreateVirtualTableScreen,
  JoinVirtualTableScreen,
  RECENT_TABLES_PAGE_SIZE,
  VirtualLobbyScreen,
  VirtualWaitingRoomScreen
} from "./virtual-screens";
import {
  createFinishTableConfirmationHandlers,
  VirtualTableScreen
} from "./virtual-table-screen";

function buildListItem(index: number): VirtualTablesListItemDto {
  return {
    id: `table-${index}`,
    title: `Стол ${index}`,
    status: "FINISHED",
    inviteCode: `CODE000${index}`.slice(-8),
    maxSeats: 6,
    currentHandId: null,
    startingStackChips: "10000",
    chipValueMinor: "1",
    chipValueCurrency: "RUB",
    smallBlindChips: "50",
    bigBlindChips: "100",
    turnDurationSeconds: 30,
    reminderDelaySeconds: 10,
    timeoutAutoActionRule: "CHECK_OR_FOLD",
    winProbabilityEnabled: false,
    potTotalChips: "0",
    createdAt: "2026-05-14T10:00:00.000Z",
    startedAt: "2026-05-14T10:05:00.000Z",
    pausedAt: null,
    finishedAt: "2026-05-14T11:00:00.000Z",
    seatsCount: 4,
    activeSeatsCount: 4,
    mySeatId: "seat-1",
    mySeatStatus: "ACTIVE",
    currentActorSeatId: null,
    currentStreet: null,
    lastHandNumber: 12
  };
}

const waitingTable: VirtualTableDto = {
  id: "table-1",
  title: "Ночной стол",
  status: "WAITING_FOR_PLAYERS",
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
  potTotalChips: "0",
  currentHandId: null,
  createdAt: "2026-05-14T10:00:00.000Z",
  startedAt: null,
  pausedAt: null,
  finishedAt: null
};

const finishedTableData: GetVirtualTableResponseDto = {
  table: {
    ...waitingTable,
    status: "FINISHED",
    startedAt: "2026-05-14T10:05:00.000Z",
    finishedAt: "2026-05-14T11:00:00.000Z"
  },
  seats: [
    {
      id: "seat-1",
      userId: "user-1",
      displayName: "Denis Andreev",
      seatNumber: 1,
      role: "OWNER",
      stackChips: "4200",
      status: "ACTIVE",
      isDealer: false,
      isSmallBlind: false,
      isBigBlind: false,
      winProbabilityPercent: null
    },
    {
      id: "seat-2",
      userId: "user-2",
      displayName: "Alex Blue",
      seatNumber: 2,
      role: "PLAYER",
      stackChips: "5800",
      status: "ACTIVE",
      isDealer: true,
      isSmallBlind: true,
      isBigBlind: false,
      winProbabilityPercent: null
    }
  ],
  reactions: [],
  settlement: {
    totalStartingStackChips: "10000",
    totalFinalStackChips: "10000",
    differenceChips: "0",
    players: [
      {
        seatId: "seat-2",
        displayName: "Alex Blue",
        startingStackChips: "5000",
        finalStackChips: "5800",
        netChips: "800",
        netEstimatedMinor: "80000"
      },
      {
        seatId: "seat-1",
        displayName: "Denis Andreev",
        startingStackChips: "5000",
        finalStackChips: "4200",
        netChips: "-800",
        netEstimatedMinor: "-80000"
      }
    ],
    transfers: [
      {
        fromSeatId: "seat-1",
        fromName: "Denis Andreev",
        toSeatId: "seat-2",
        toName: "Alex Blue",
        amountChips: "800",
        amountEstimatedMinor: "80000"
      }
    ]
  } satisfies VirtualTableSettlementDto
};

describe("virtual screens", () => {
  it("renders join empty-state copy", () => {
    const markup = renderToStaticMarkup(
      <JoinVirtualTableScreen inviteCode="" onInviteCodeChange={vi.fn()} onSubmit={vi.fn()} />
    );

    expect(markup).toContain("Код приглашения еще не добавлен");
    expect(markup).toContain("Введите 8-символьный код приглашения");
    expect(markup).toContain("Войти за стол");
    expect(markup).toContain("AB12CD34");
  });

  it("renders compact lobby without the old top header and paginates recent tables by five", () => {
    const recentTables = Array.from({ length: RECENT_TABLES_PAGE_SIZE + 1 }, (_, index) => buildListItem(index + 1));
    const markup = renderToStaticMarkup(
      <VirtualLobbyScreen
        activeTables={[]}
        joinCode=""
        myTables={recentTables}
        recentTables={recentTables}
        waitingTables={[]}
        onCreateTable={vi.fn()}
        onJoinCodeChange={vi.fn()}
        onJoinSubmit={vi.fn()}
      />
    );

    expect(markup).toContain("Мои столы");
    expect(markup.indexOf("Быстрый вход по коду")).toBeLessThan(markup.indexOf("Мои столы"));
    expect(markup).toContain("Присоединиться");
    expect(markup).not.toContain("Быстро посмотреть");
    expect(markup).not.toContain(">Лобби<");
    expect(markup).not.toContain("Виртуальные столы");
    expect(markup).not.toContain(">В игре<");
    expect(markup).toContain("Стол 1");
    expect(markup).toContain("Стол 5");
    expect(markup).not.toContain("Стол 6");
    expect(markup).toContain("Показать ещё");
  });

  it("renders waiting room without invitation link block", () => {
    const markup = renderToStaticMarkup(
      <VirtualWaitingRoomScreen
        canCancel
        canStart
        onCancelTable={vi.fn()}
        onCopyCode={vi.fn()}
        onStartGame={vi.fn()}
        seats={finishedTableData.seats}
        table={waitingTable}
      />
    );

    expect(markup).toContain("Код стола");
    expect(markup).toContain("pt-[calc(env(safe-area-inset-top)+5.25rem)]");
    expect(markup).toContain("pb-[calc(env(safe-area-inset-bottom)+13rem)]");
    expect(markup).toContain("bottom-[calc(env(safe-area-inset-bottom)+1rem)]");
    expect(markup).not.toContain("bottom-[calc(env(safe-area-inset-bottom)+5.75rem)]");
    expect(markup).not.toContain("Ссылка-приглашение");
    expect(markup).not.toContain("Скопировать ссылку");
  });

  it("keeps create form numeric inputs editable and shows ruble rate", () => {
    const markup = renderToStaticMarkup(
      <CreateVirtualTableScreen
        values={{
          title: "Новый стол",
          maxSeats: "",
          startingStackChips: "10000",
          chipsPerCurrencyUnit: "100",
          smallBlindChips: "50",
          bigBlindChips: "100",
          turnDurationSeconds: "",
          reminderDelaySeconds: "",
          timeoutAutoActionRule: "CHECK_OR_FOLD",
          winProbabilityEnabled: false
        }}
        onChange={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    expect(markup).toContain("1 ₽ = 100 фишек");
    expect(markup).toContain('role="switch"');
    expect(markup).toContain('aria-checked="false"');
    expect(markup).toContain("Показывать шанс выигрыша");
    expect(markup).toContain("Каждый игрок увидит свой шанс по открытым картам.");
    expect(markup).not.toContain("Валюта оценки");
    expect(markup).not.toContain("Стоимость фишки");
    expect(markup).toContain('value=""');
  });

  it("does not call finish callback before confirmation", async () => {
    const setOpen = vi.fn();
    const onConfirm = vi.fn();
    const handlers = createFinishTableConfirmationHandlers(setOpen, onConfirm);

    handlers.requestFinish();

    expect(setOpen).toHaveBeenCalledWith(true);
    expect(onConfirm).not.toHaveBeenCalled();

    await handlers.confirmFinish();

    expect(setOpen).toHaveBeenLastCalledWith(false);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("renders settlement results for finished table and hides game canvas", () => {
    const markup = renderToStaticMarkup(
      <VirtualTableScreen data={finishedTableData} mySeatId="seat-1" />
    );

    expect(markup).toContain("Итоги стола");
    expect(markup).toContain("pt-[calc(env(safe-area-inset-top)+5.25rem)]");
    expect(markup).toContain("Alex Blue");
    expect(markup).toContain("Denis Andreev");
    expect(markup).toContain("Кто кому переводит");
    expect(markup).toContain("8,00");
    expect(markup).not.toContain('data-testid="virtual-table-stage"');
  });
});

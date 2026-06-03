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
      avatarUrl: null,
      seatNumber: 1,
      role: "OWNER",
      stackChips: "4200",
      committedStreetChips: "0",
      committedTotalChips: "0",
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
      avatarUrl: null,
      seatNumber: 2,
      role: "PLAYER",
      stackChips: "5800",
      committedStreetChips: "0",
      committedTotalChips: "0",
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
    expect(markup).toContain('src="/visuals/join-code.svg"');
  });

  it("renders lobby hero and paginates recent tables by five", () => {
    const recentTables = Array.from({ length: RECENT_TABLES_PAGE_SIZE + 1 }, (_, index) => buildListItem(index + 1));
    const markup = renderToStaticMarkup(
      <VirtualLobbyScreen
        activeTables={[]}
        joinCode=""
        myTables={recentTables}
        nearestEvent={{
          club: {
            id: "club-1",
            ownerUserId: "user-1",
            name: "Poker Club Denis",
            privacy: "PRIVATE_INVITE_ONLY",
            inviteCode: "CLUB2026",
            createdAt: "2026-05-01T00:00:00.000Z",
            updatedAt: "2026-05-01T00:00:00.000Z"
          },
          event: {
            id: "event-1",
            clubId: "club-1",
            createdByUserId: "user-1",
            type: "ONLINE_TABLE",
            title: "Sunday Online",
            scheduledStartAt: "2026-05-24T18:00:00.000Z",
            status: "RSVP_OPEN",
            maxPlayers: 9,
            myRsvpStatus: "GOING",
            createdAt: "2026-05-01T00:00:00.000Z",
            updatedAt: "2026-05-01T00:00:00.000Z",
            rsvpSummary: {
              goingCount: 6
            }
          }
        }}
        recentTables={recentTables}
        waitingTables={[]}
        onCreateTable={vi.fn()}
        onJoinCodeChange={vi.fn()}
        onJoinSubmit={vi.fn()}
        onOpenNearestEvent={vi.fn()}
      />
    );

    expect(markup).toContain("Активные игры");
    expect(markup).toContain('data-testid="online-action-hero"');
    expect(markup).toContain('srcSet="/visuals/online-hero.webp"');
    expect(markup).toContain('src="/visuals/online-hero.png"');
    expect(markup).toContain("whitespace-nowrap");
    expect(markup).toContain("Онлайн-столы");
    expect(markup).toContain("Играйте за виртуальными столами");
    expect(markup).toContain("Найти открытые столы");
    expect(markup).toContain("Создать стол");
    expect(markup).toContain("Войти по коду");
    expect(markup).toContain("Ближайшие столы");
    expect(markup).toContain("Sunday Online");
    expect(markup).toContain("Вы: Играю");
    expect(markup).toContain("6 / 9 игроков");
    expect(markup).toContain("h-8");
    expect(markup).toContain("py-3");
    expect(markup.indexOf("Создать стол")).toBeLessThan(markup.indexOf("Войти по коду"));
    expect(markup.indexOf("Войти по коду")).toBeLessThan(markup.indexOf("Найти открытые столы"));
    expect(markup).not.toContain("max-w-4xl");
    expect(markup).not.toContain(">Лобби<");
    expect(markup).not.toContain("Можно открыть");
    expect(markup).toContain("Стол 1");
    expect(markup).toContain("Стол 5");
    expect(markup).not.toContain("Стол 6");
    expect(markup).toContain("Показать ещё");
  });

  it("renders empty lobby sections without repeated large illustrations", () => {
    const markup = renderToStaticMarkup(
      <VirtualLobbyScreen
        activeTables={[]}
        joinCode=""
        myTables={[]}
        recentTables={[]}
        waitingTables={[]}
        onCreateTable={vi.fn()}
        onJoinCodeChange={vi.fn()}
        onJoinSubmit={vi.fn()}
      />
    );

    expect(markup).toContain("Пока нет онлайн-столов");
    expect(markup).not.toContain("Можно открыть");
    expect(markup).toContain("Последние игры");
    expect(markup).not.toContain('/visuals/empty-state.svg');
    expect(markup).not.toContain("h-36");
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
        clubs={[]}
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
          winProbabilityEnabled: false,
          clubId: "",
          scheduledStartAt: "",
          sendNotifications: true
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
    expect(markup).toContain("Дата и время игры");
    expect(markup).toContain("Выберите дату и время");
    expect(markup).toContain("calendar_month");
    expect(markup).toContain("Большой блайнд");
    expect(markup).toContain("Малый блайнд");
    expect(markup).toContain(">50<");
    expect(markup).not.toContain('value="50"');
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

import type { RoomListItemDto, VirtualTablesListItemDto } from "@pokertable/shared";
import { describe, expect, it } from "vitest";
import type { HomeClubEvent } from "./home-view";
import { buildHomeViewModel } from "./home-view";

const now = new Date("2026-05-23T10:00:00.000Z");

describe("home view helpers", () => {
  it("counts today's tables and active turns", () => {
    const model = buildHomeViewModel({
      activeRooms: [createRoom({ id: "room-active" })],
      recentRooms: [
        createRoom({ id: "room-today", status: "CLOSED", closedAt: "2026-05-23T20:00:00.000Z" }),
        createRoom({ id: "room-old", status: "CLOSED", closedAt: "2026-05-22T20:00:00.000Z" })
      ],
      tables: [
        createTable({ id: "table-1", currentActorSeatId: "seat-1", mySeatId: "seat-1" }),
        createTable({ id: "table-2", currentActorSeatId: "seat-2", mySeatId: "seat-2", startedAt: "2026-05-23T08:00:00.000Z" }),
        createTable({ id: "table-finished", status: "FINISHED", finishedAt: "2026-05-23T09:00:00.000Z" }),
        createTable({ id: "table-old", status: "FINISHED", finishedAt: "2026-05-22T09:00:00.000Z" }),
        createTable({ id: "table-3", currentActorSeatId: "seat-9", mySeatId: "seat-3" })
      ],
      events: [
        createEvent({ id: "event-today", scheduledStartAt: "2026-05-23T18:00:00.000Z" }),
        createEvent({ id: "event-tomorrow", scheduledStartAt: "2026-05-24T18:00:00.000Z" })
      ],
      offlinePokerScore: 48,
      offlineGamesCount: 1,
      now
    });

    expect(model.activeTurns).toHaveLength(2);
    expect(model.eventsTodayCount).toBe(6);
  });

  it("averages available online and offline poker score", () => {
    expect(
      buildHomeViewModel({
        tables: [],
        events: [],
        offlinePokerScore: 80,
        offlineGamesCount: 3,
        onlinePokerScore: 60,
        onlineHandsPlayed: 20,
        now
      }).pokerScore
    ).toEqual({
      value: 70,
      progress: 70
    });

    expect(
      buildHomeViewModel({
        tables: [],
        events: [],
        offlinePokerScore: 80,
        offlineGamesCount: 3,
        onlinePokerScore: 30,
        onlineHandsPlayed: 0,
        now
      }).pokerScore
    ).toEqual({
      value: 80,
      progress: 80
    });

    expect(
      buildHomeViewModel({
        tables: [],
        events: [],
        offlinePokerScore: null,
        offlineGamesCount: 0,
        onlinePokerScore: null,
        onlineHandsPlayed: 0,
        now
      }).pokerScore
    ).toEqual({
      value: null,
      progress: 0
    });
  });

  it("prioritizes an active turn over the nearest event", () => {
    const model = buildHomeViewModel({
      tables: [createTable({ id: "table-1", currentActorSeatId: "seat-1", mySeatId: "seat-1" })],
      events: [createEvent({ id: "event-1", scheduledStartAt: "2026-05-23T11:00:00.000Z" })],
      offlinePokerScore: 72,
      offlineGamesCount: 1,
      activeTurnDetail: {
        table: {} as never,
        seats: [],
        reactions: [],
        hand: {
          id: "hand-1",
          handNumber: 1,
          status: "IN_PROGRESS",
          street: "PRE_FLOP",
          board: [],
          currentActorSeatId: "seat-1",
          currentTimer: {
            id: "timer-1",
            seatId: "seat-1",
            status: "ACTIVE",
            startedAt: "2026-05-23T09:59:00.000Z",
            reminderDueAt: "2026-05-23T10:00:30.000Z",
            expiresAt: "2026-05-23T10:01:00.000Z",
            remindedAt: null
          },
          currentBetChips: "300",
          callAmountChips: "300",
          myPrivateCards: [],
          myLegalActions: [{ type: "CALL", amountChips: "300" }],
          resultSummary: null
        }
      },
      now
    });

    expect(model.focus.target).toEqual({ kind: "active-turn", tableId: "table-1" });
    expect(model.focus.actionLabel).toBe("Колл 300 фишек");
    expect(model.focus.meta).toBe("Ваш ход · 1 мин");
  });

  it("builds active table cards and excludes finished tables", () => {
    const model = buildHomeViewModel({
      activeRooms: [createRoom({ id: "room-1", title: "Домашний стол", status: "RUNNING", playersCount: 4 })],
      tables: [
        createTable({ id: "table-1", title: "Онлайн ход", currentActorSeatId: "seat-1", mySeatId: "seat-1" }),
        createTable({ id: "table-2", title: "Пауза", status: "PAUSED", currentActorSeatId: null }),
        createTable({ id: "table-3", title: "Финиш", status: "FINISHED", finishedAt: "2026-05-23T12:00:00.000Z" })
      ],
      events: [],
      offlinePokerScore: 40,
      offlineGamesCount: 1,
      now
    });

    expect(model.activeTables.map((card) => card.title)).toEqual(["Онлайн ход", "Пауза", "Домашний стол"]);
    expect(model.activeTables[0]).toMatchObject({
      isUserTurn: true,
      statusLabel: "Ваш ход",
      target: { kind: "active-turn", tableId: "table-1" }
    });
  });
});

function createRoom(overrides: Partial<RoomListItemDto> = {}): RoomListItemDto {
  return {
    id: "room-1",
    title: "Оффлайн стол",
    status: "RUNNING",
    currency: "RUB",
    buyInChips: "1000",
    rebuyChips: "1000",
    chipsPerCurrencyUnit: "1",
    playersCount: 3,
    totalPotChips: "3000",
    myBuyinsChips: "1000",
    ...overrides
  };
}

function createTable(overrides: Partial<VirtualTablesListItemDto> = {}): VirtualTablesListItemDto {
  return {
    id: "table-1",
    title: "Быстрый стол",
    status: "ACTIVE",
    inviteCode: "AB12CD34",
    maxSeats: 6,
    currentHandId: "hand-1",
    startingStackChips: "5000",
    chipValueMinor: null,
    chipValueCurrency: null,
    smallBlindChips: "50",
    bigBlindChips: "100",
    turnDurationSeconds: 60,
    reminderDelaySeconds: 30,
    timeoutAutoActionRule: "CHECK_OR_FOLD",
    winProbabilityEnabled: false,
    potTotalChips: "0",
    createdAt: "2026-05-23T09:00:00.000Z",
    startedAt: "2026-05-23T09:30:00.000Z",
    pausedAt: null,
    finishedAt: null,
    seatsCount: 4,
    activeSeatsCount: 4,
    mySeatId: "seat-1",
    mySeatStatus: "ACTIVE",
    currentActorSeatId: "seat-1",
    currentStreet: "PRE_FLOP",
    lastHandNumber: 1,
    ...overrides
  };
}

function createEvent(overrides: Partial<HomeClubEvent> = {}): HomeClubEvent {
  return {
    id: "event-1",
    clubId: "club-1",
    createdByUserId: "user-1",
    type: "ONLINE_TABLE",
    title: "Вечерний стол",
    description: null,
    scheduledStartAt: "2026-05-23T18:00:00.000Z",
    timezone: null,
    status: "RSVP_OPEN",
    maxPlayers: 6,
    offlineRoomId: null,
    virtualTableId: null,
    location: null,
    createdAt: "2026-05-22T18:00:00.000Z",
    updatedAt: "2026-05-22T18:00:00.000Z",
    cancelledAt: null,
    myRsvpStatus: null,
    rsvpSummary: null,
    resultSummary: null,
    clubName: "Poker Club",
    ...overrides
  };
}

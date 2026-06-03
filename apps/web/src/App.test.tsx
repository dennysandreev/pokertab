import type { GetVirtualLeaderboardResponseDto, VirtualTablesListItemDto } from "@pokertable/shared";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import {
  GamesScreenContent,
  HomeActiveNowSection,
  HomeScreenContent,
  LeaderboardEntriesSection,
  LeaderboardFiltersSection,
  LeaderboardHeaderSection,
  ProfileHeaderSection,
  getChromeSubtitle
} from "./App";
import { buildHomeViewModel } from "./features/home/home-view";
import { getPlayerRoute } from "./features/rooms/routes";

const now = new Date("2026-05-23T10:00:00.000Z");

describe("App UI sections", () => {
  it("does not render focus day section on home and links Poker Score to current profile", () => {
    const model = buildHomeViewModel({
      tables: [createTable()],
      events: [],
      offlinePokerScore: 72,
      offlineGamesCount: 4,
      onlinePokerScore: 68,
      onlineHandsPlayed: 12,
      now
    });

    const markup = renderToStaticMarkup(
      <MemoryRouter>
        <HomeScreenContent
          errorMessage={null}
          inviteCode=""
          inviteErrorMessage={null}
          isInviteSubmitting={false}
          model={model}
          onInviteCodeChange={vi.fn()}
          onInviteSubmit={vi.fn()}
          onOpenTarget={vi.fn()}
          profileRoute={getPlayerRoute("user-me")}
        />
      </MemoryRouter>
    );

    expect(markup).not.toContain("Фокус дня");
    expect(markup).toContain(`href="${getPlayerRoute("user-me")}"`);
    expect(markup.indexOf("Введите код приглашения")).toBeGreaterThan(-1);
    expect(markup.indexOf("Введите код приглашения")).toBeLessThan(markup.indexOf("Календарь"));
    expect(markup).toContain("AB12CD34");
  });

  it("renders future event dots in the home mini calendar", () => {
    const model = buildHomeViewModel({
      tables: [],
      events: [
        {
          id: "event-1",
          clubId: "club-1",
          clubName: "Poker Club",
          createdByUserId: "user-1",
          type: "OFFLINE_POKER",
          status: "SCHEDULED",
          title: "Friday Poker",
          scheduledStartAt: "2026-05-24T18:00:00.000Z",
          myRsvpStatus: "NO_RESPONSE",
          location: null,
          offlineRoomId: null,
          virtualTableId: null,
          createdAt: "2026-05-23T10:00:00.000Z",
          updatedAt: "2026-05-23T10:00:00.000Z",
          resultSummary: null
        }
      ],
      offlinePokerScore: 72,
      offlineGamesCount: 4,
      onlinePokerScore: null,
      onlineHandsPlayed: 0,
      now
    });

    const markup = renderToStaticMarkup(
      <MemoryRouter>
        <HomeScreenContent
          errorMessage={null}
          inviteCode=""
          inviteErrorMessage={null}
          isInviteSubmitting={false}
          model={model}
          onInviteCodeChange={vi.fn()}
          onInviteSubmit={vi.fn()}
          onOpenTarget={vi.fn()}
          profileRoute={null}
        />
      </MemoryRouter>
    );

    expect(markup).toContain("Календарь");
    expect(markup).toContain("Ближайшие события");
    expect(markup).toContain("bg-accent");
  });

  it("adds an emerald highlight to active-turn cards", () => {
    const markup = renderToStaticMarkup(
      <HomeActiveNowSection
        cards={[
          {
            id: "table-1",
            title: "Онлайн ход",
            meta: "Блайнды 50/100",
            typeLabel: "Онлайн",
            statusLabel: "Ваш ход",
            isUserTurn: true,
            target: { kind: "active-turn", tableId: "table-1" }
          }
        ]}
        errorMessage={null}
        onOpenTarget={vi.fn()}
      />
    );

    expect(markup).toContain("ring-[#56df9d]/70");
    expect(markup).toContain("bg-[#56df9d]/[0.035]");
  });

  it("renders leaderboard mode toggle inside the compact header", () => {
    const markup = renderToStaticMarkup(
      <LeaderboardHeaderSection mode="online" onInfoClick={vi.fn()} onModeChange={vi.fn()} scope="played-with-me" />
    );

    expect(markup).toContain('data-testid="leaderboard-header"');
    expect(markup).toContain(">Офлайн<");
    expect(markup).toContain(">Онлайн<");
    expect(markup).toContain("Онлайн-рейтинг");
    expect(markup).not.toContain(">Рейтинг<");
  });

  it("keeps leaderboard filters compact without helper labels", () => {
    const markup = renderToStaticMarkup(
      <LeaderboardFiltersSection
        onPeriodChange={vi.fn()}
        onScopeChange={vi.fn()}
        period="all-time"
        scope="all"
      />
    );

    expect(markup).not.toContain("Кого показать");
    expect(markup).not.toContain("Период");
  });

  it("shows online leaderboard profit in rubles or a dash without chips", () => {
    const onlineItems: GetVirtualLeaderboardResponseDto["items"] = [
      {
        userId: "user-1",
        rank: 1,
        displayName: "Denis",
        username: "denis",
        handsPlayed: 15,
        handsWon: 7,
        netChips: "777777",
        netEstimatedMinor: "12345",
        bigBlindsWon: "1200",
        bbPer100Bps: 315,
        winRateBps: 2550,
        avgChipsPerHand: "51",
        onlinePokerScore: 81
      },
      {
        userId: "user-2",
        rank: 2,
        displayName: "Alex",
        username: null,
        handsPlayed: 8,
        handsWon: 3,
        netChips: "-888888",
        netEstimatedMinor: "",
        bigBlindsWon: "-900",
        bbPer100Bps: -220,
        winRateBps: 1200,
        avgChipsPerHand: "-35",
        onlinePokerScore: 64
      }
    ];

    const markup = renderToStaticMarkup(
      <MemoryRouter>
        <LeaderboardEntriesSection currentUserId={null} mode="online" offlineItems={[]} onlineItems={onlineItems} />
      </MemoryRouter>
    );

    expect(markup).toContain(">+123<");
    expect(markup).toContain(">—<");
    expect(markup).not.toContain("₽");
    expect(markup).not.toContain("123,45");
    expect(markup).not.toContain("777 777");
    expect(markup).not.toContain("888 888");
  });

  it("renders player profile header with the mode toggle inside the same surface", () => {
    const markup = renderToStaticMarkup(
      <ProfileHeaderSection
        mode="offline"
        onInfoClick={vi.fn()}
        onModeChange={vi.fn()}
        score="74"
        subtitle="@denis"
        title="Denis Andreev"
      />
    );

    expect(markup).toContain('data-testid="player-profile-header"');
    expect(markup).toContain(">Офлайн<");
    expect(markup).toContain(">Онлайн<");
    expect(markup).not.toContain("rounded-full bg-white/[0.05]");
  });

  it("renders a unified offline action hero with both actions inside", () => {
    const markup = renderToStaticMarkup(
      <GamesScreenContent
        activeRooms={[]}
        inviteCode={null}
        onCreateRoom={vi.fn()}
        onJoinCodeSubmit={vi.fn()}
        onOpenInvite={null}
        onOpenNearestEvent={vi.fn()}
        onOpenRecentRoom={vi.fn()}
        onOpenRoom={vi.fn()}
        onRefresh={vi.fn()}
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
            type: "OFFLINE_POKER",
            title: "Friday Home Game",
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
        recentRooms={[]}
        roomsState={{ status: "ready", data: { active: [], recent: [] }, errorMessage: null }}
      />
    );

    expect(markup).toContain('data-testid="offline-action-hero"');
    expect(markup).toContain('srcSet="/visuals/offline-hero.webp"');
    expect(markup).toContain('src="/visuals/offline-hero.png"');
    expect(markup).toContain("Оффлайн-игры");
    expect(markup).toContain("Реальные игры, ребаи и итоги");
    expect(markup).toContain("Создать игру");
    expect(markup).toContain("Новая оффлайн игра");
    expect(markup).toContain("Войти по коду");
    expect(markup).toContain("Присоединиться");
    expect(markup).toContain("Ближайшая игра");
    expect(markup).toContain("Friday Home Game");
    expect(markup).toContain("Вы: Приду");
    expect(markup).toContain("6 / 9 игроков");
    expect(markup).toContain("h-8");
    expect(markup).toContain("py-3");
    expect(markup).not.toContain("Соберите стол и начните партию без лишних шагов");
    expect(markup).not.toContain("Создайте игру для своей компании");
    expect(markup).toContain("Активные игры");
    expect(markup).toContain("Последние игры");
  });

  it("uses rating wording in the leaderboard app chrome", () => {
    expect(getChromeSubtitle("/leaderboard")).toBe("Рейтинг");
    expect(getChromeSubtitle("/leaderboard")).not.toBe("Лидерборд");
  });
});

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

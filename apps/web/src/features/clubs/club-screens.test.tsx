import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  ClubDashboardScreen,
  ClubEventDetailsScreen,
  ClubInviteScreen,
  ClubsHomeScreen
} from "./club-screens";
import type { ClubEventListItemDto, ClubSummaryDto } from "./types";

const club: ClubSummaryDto = {
  id: "club-1",
  ownerUserId: "user-1",
  name: "Poker Club Denis",
  description: "Домашние игры",
  privacy: "PRIVATE_INVITE_ONLY",
  defaultCurrency: "RUB",
  inviteCode: "INVITE42",
  createdAt: "2026-05-20T10:00:00.000Z",
  updatedAt: "2026-05-20T10:00:00.000Z",
  membersCount: 18,
  myRole: "OWNER",
  nearestEvent: {
    id: "event-1",
    clubId: "club-1",
    createdByUserId: "user-1",
    type: "OFFLINE_POKER",
    title: "Friday Poker",
    scheduledStartAt: "2026-05-24T18:00:00.000Z",
    status: "SCHEDULED",
    createdAt: "2026-05-20T10:00:00.000Z",
    updatedAt: "2026-05-20T10:00:00.000Z"
  }
};

const event: ClubEventListItemDto = {
  id: "event-1",
  clubId: "club-1",
  createdByUserId: "user-1",
  type: "OFFLINE_POKER",
  title: "Friday Poker",
  scheduledStartAt: "2026-05-24T18:00:00.000Z",
  status: "RSVP_OPEN",
  location: "У Дениса",
  maxPlayers: 9,
  offlineRoomId: "room-1",
  createdAt: "2026-05-20T10:00:00.000Z",
  updatedAt: "2026-05-20T10:00:00.000Z"
};

describe("club screens", () => {
  it("renders clubs empty state and create CTA", () => {
    const markup = renderToStaticMarkup(
      <ClubsHomeScreen
        clubs={[]}
        onCreateClub={vi.fn()}
        onJoinClubCode={vi.fn()}
        onOpenClub={vi.fn()}
      />
    );

    expect(markup).toContain('data-testid="clubs-home-hero"');
    expect(markup).toContain('srcSet="/visuals/club-hero-wide.webp"');
    expect(markup).toContain('src="/visuals/club-hero-wide.jpg"');
    expect(markup).toContain("Покерные клубы");
    expect(markup).toContain("Игры, участники и события");
    expect(markup).toContain("У вас пока нет клубов");
    expect(markup).toContain("Создайте клуб для своей покерной компании");
    expect(markup).toContain("Создать клуб");
    expect(markup).toContain("Войти по коду");
    expect(markup).not.toContain("Клубов");
  });

  it("renders club home like the reference with event cards, emblems and history", () => {
    const rsvpEvent: ClubEventListItemDto = {
      ...event,
      id: "event-rsvp",
      title: "Sunday Online",
      type: "ONLINE_TABLE",
      scheduledStartAt: "2026-05-25T17:00:00.000Z",
      myRsvpStatus: "NO_RESPONSE",
      rsvpSummary: {
        goingCount: 4,
        noResponseCount: 1
      }
    };
    const historyEvent: ClubEventListItemDto = {
      ...event,
      id: "event-history",
      title: "Wednesday Deepstack",
      status: "COMPLETED",
      scheduledStartAt: "2026-05-15T17:00:00.000Z",
      rsvpSummary: {
        goingCount: 7
      }
    };
    const markup = renderToStaticMarkup(
      <ClubsHomeScreen
        clubs={[club]}
        historyEvents={[{ club, event: historyEvent }]}
        upcomingEvents={[
          {
            club,
            event: {
              ...event,
              myRsvpStatus: "GOING",
              rsvpSummary: {
                goingCount: 6
              }
            }
          },
          { club, event: rsvpEvent }
        ]}
        onCreateClub={vi.fn()}
        onJoinClubCode={vi.fn()}
        onOpenClub={vi.fn()}
        onOpenEvent={vi.fn()}
      />
    );

    expect(markup).toContain("Ближайшая игра");
    expect(markup).toContain("Friday Poker");
    expect(markup).toContain("Вы: Приду");
    expect(markup).toContain("6 / 9 игроков");
    expect(markup).toContain("Требует ответа");
    expect(markup).toContain("Sunday Online");
    expect(markup).toContain("Ответ не выбран");
    expect(markup).toContain("Мои клубы");
    expect(markup).toContain("Poker Club Denis");
    expect(markup).toContain("Владелец");
    expect(markup).toContain("18 участников");
    expect(markup).toContain("История");
    expect(markup).toContain("Смотреть все");
    expect(markup).toContain("Wednesday Deepstack");
    expect(markup).not.toContain("Ближайшие игры появятся здесь");
  });

  it("renders club invite as a code without refresh action", () => {
    const markup = renderToStaticMarkup(
      <ClubInviteScreen
        clubName={club.name}
        inviteCode="INVITE42"
        inviteLink="https://t.me/pokertablebot/app?startapp=club_INVITE42"
        onCopy={vi.fn()}
        onShare={vi.fn()}
      />
    );

    expect(markup).toContain("Код приглашения");
    expect(markup).toContain("INVITE42");
    expect(markup).toContain("Скопировать код приглашения");
    expect(markup).toContain("Поделиться в Telegram");
    expect(markup).not.toContain("Ссылка готова");
    expect(markup).not.toContain("Скопировать ссылку");
    expect(markup).not.toContain("Обновить");
  });

  it("renders event details with RSVP groups and admin actions", () => {
    const markup = renderToStaticMarkup(
      <ClubEventDetailsScreen
        canManage
        clubName={club.name}
        event={event}
        myRsvpStatus="GOING"
        rsvpGroups={{
          going: [
            {
              id: "rsvp-1",
              userId: "user-1",
              displayName: "Denis",
              status: "GOING"
            }
          ],
          maybe: [],
          declined: [],
          noResponse: [],
          waitlist: []
        }}
        onCancelEvent={vi.fn()}
        onOpenLinkedRoom={vi.fn()}
        onSendReminder={vi.fn()}
        onSetRsvp={vi.fn()}
      />
    );

    expect(markup).toContain("Ваш ответ");
    expect(markup).toContain("Приду");
    expect(markup).toContain("Придут");
    expect(markup).toContain("Открыть оффлайн-комнату");
    expect(markup).toContain("Отправить напоминание");
    expect(markup).toContain("Отменить мероприятие");
  });

  it("renders compact empty sections without duplicate decorative illustrations", () => {
    const markup = renderToStaticMarkup(
      <ClubDashboardScreen
        activeTab="events"
        canCreateEvents
        canDeleteClub={false}
        canInviteMembers
        canManageClub
        club={club}
        currentMemberId="user-1"
        historyEvents={[]}
        memberActionInFlightId={null}
        members={[]}
        nearestEvent={null}
        settingsValues={{
          name: club.name,
          description: club.description ?? "",
          defaultCurrency: club.defaultCurrency ?? "RUB"
        }}
        upcomingEvents={[]}
        onChangeSettings={vi.fn()}
        onChangeTab={vi.fn()}
        onMakeMember={vi.fn()}
        onOpenCreateOffline={vi.fn()}
        onOpenCreateOnline={vi.fn()}
        onOpenEvent={vi.fn()}
        onOpenInvite={vi.fn()}
        onPromoteToAdmin={vi.fn()}
        onRemoveMember={vi.fn()}
        onSaveSettings={vi.fn()}
      />
    );

    expect(markup).toContain("Пока ничего не запланировано");
    expect(markup).toContain("Участники");
    expect(markup).toContain("События");
    expect(markup).toContain("Пригласить");
    expect(markup).toContain("Новая оффлайн игра");
    expect(markup).toContain("Новая онлайн игра");
    expect(markup).toContain("Актуальные события");
    expect(markup).toContain("Календарь");
    expect(markup).not.toContain('/visuals/empty-state.svg');
    expect(markup).not.toContain("h-36");
  });
});

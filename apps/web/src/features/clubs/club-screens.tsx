import { useState, type JSX, type ReactNode } from "react";
import {
  ActionTile,
  CompactGameRow,
  VisualEmptyState
} from "@/components/visual";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { resolveMiniAppVisual } from "../visual/mini-app-visuals";
import {
  formatEventDateTime,
  getAllowedRsvpStatuses,
  getClubEventResponseSummary,
  getClubEventStatusLabel,
  getClubEventTypeLabel,
  getClubMembersCount,
  getClubRoleLabel,
  getClubRsvpLabel,
  getGroupedRsvpSections,
  getHistoryHeadline,
  getHistoryMetaLine,
  getHistoryResultLine
} from "./club-view";
import type {
  ClubEventListItemDto,
  ClubEventRsvpGroupsDto,
  ClubEventRsvpStatus,
  ClubMemberDto,
  ClubSummaryDto
} from "./types";

const screenClassName = "mx-auto w-full max-w-4xl space-y-6";
const cardClassName =
  "rounded-2xl border border-white/[0.06] bg-[#101211]/96 p-4 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]";
const secondaryButtonClassName =
  "border border-white/[0.06] bg-[#171918] text-white shadow-none hover:bg-[#202322]";
const tertiaryButtonClassName =
  "border border-white/[0.06] bg-transparent text-white shadow-none hover:bg-white/[0.025]";
const inputClassName =
  "mt-2 min-h-12 w-full rounded-xl border border-white/[0.06] bg-[#171918] px-4 text-sm text-white outline-none transition placeholder:text-[#89918c] focus:border-[#56df9d] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#56df9d]";

type ClubsHomeScreenProps = {
  clubs: ClubSummaryDto[];
  upcomingEvents?: ClubHomeEvent[];
  historyEvents?: ClubHomeEvent[];
  isLoading?: boolean;
  errorMessage?: string | null;
  onRetry?: () => void;
  onOpenClub: (clubId: string) => void;
  onOpenEvent?: (clubId: string, eventId: string) => void;
  onCreateClub: () => void;
  onJoinClubCode: (inviteCode: string) => void;
};

type ClubHomeEvent = {
  club: ClubSummaryDto;
  event: ClubEventListItemDto;
};

type CreateClubScreenProps = {
  values: {
    name: string;
    description: string;
    defaultCurrency: string;
  };
  errorMessage?: string | null;
  isSubmitting?: boolean;
  onChange: (field: "name" | "description" | "defaultCurrency", value: string) => void;
  onSubmit: () => void;
};

type ClubDashboardScreenProps = {
  club: ClubSummaryDto;
  members: ClubMemberDto[];
  upcomingEvents: ClubEventListItemDto[];
  historyEvents: ClubEventListItemDto[];
  activeTab: "events" | "members" | "history" | "settings";
  isSubmitting?: boolean;
  settingsErrorMessage?: string | null;
  memberActionInFlightId?: string | null;
  settingsValues: {
    name: string;
    description: string;
    defaultCurrency: string;
  };
  currentMemberId?: string | null | undefined;
  canCreateEvents: boolean;
  canInviteMembers: boolean;
  canManageClub: boolean;
  canDeleteClub?: boolean | undefined;
  nearestEvent?: ClubEventListItemDto | null | undefined;
  onChangeTab: (tab: ClubDashboardScreenProps["activeTab"]) => void;
  onOpenEvent: (eventId: string) => void;
  onOpenCreateOffline: () => void;
  onOpenCreateOnline: () => void;
  onOpenInvite: () => void;
  onChangeSettings: (field: "name" | "description" | "defaultCurrency", value: string) => void;
  onSaveSettings: () => void;
  onPromoteToAdmin: (memberId: string) => void;
  onMakeMember: (memberId: string) => void;
  onRemoveMember: (memberId: string) => void;
  onDeleteClub?: (() => void) | undefined;
};

type ClubInviteScreenProps = {
  clubName: string;
  inviteCode: string | null;
  inviteLink: string | null;
  isLoading?: boolean;
  errorMessage?: string | null;
  onCopy: () => void;
  onShare: () => void;
};

type JoinClubScreenProps = {
  inviteCode: string;
  preview: ClubSummaryDto | null;
  alreadyMember?: boolean | undefined;
  isLoading?: boolean;
  isSubmitting?: boolean;
  errorMessage?: string | null;
  onJoin: () => void;
  onOpenClub: () => void;
};

type ClubEventDetailsScreenProps = {
  clubName: string;
  event: ClubEventListItemDto;
  myRsvpStatus?: ClubEventRsvpStatus | null;
  rsvpGroups: ClubEventRsvpGroupsDto;
  canManage?: boolean | undefined;
  isUpdatingRsvp?: boolean;
  isSendingReminder?: boolean;
  isCancellingEvent?: boolean;
  errorMessage?: string | null;
  onSetRsvp: (status: Exclude<ClubEventRsvpStatus, "NO_RESPONSE">) => void;
  onOpenLinkedRoom?: (() => void) | undefined;
  onOpenLinkedTable?: (() => void) | undefined;
  onSendReminder?: (() => void) | undefined;
  onCancelEvent?: (() => void) | undefined;
};

export function ClubsHomeScreen({
  clubs,
  upcomingEvents = [],
  historyEvents = [],
  isLoading = false,
  errorMessage = null,
  onRetry,
  onOpenClub,
  onOpenEvent,
  onCreateClub,
  onJoinClubCode
}: ClubsHomeScreenProps): JSX.Element {
  const [isJoinOpen, setIsJoinOpen] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const derivedNearestEvents = clubs
    .map((club) => (club.nearestEvent ? { club, event: club.nearestEvent } : null))
    .filter((item): item is { club: ClubSummaryDto; event: ClubEventListItemDto } => item !== null)
    .sort((left, right) => new Date(left.event.scheduledStartAt).getTime() - new Date(right.event.scheduledStartAt).getTime());
  const visibleUpcomingEvents = [...(upcomingEvents.length > 0 ? upcomingEvents : derivedNearestEvents)].sort(
    (left, right) => new Date(left.event.scheduledStartAt).getTime() - new Date(right.event.scheduledStartAt).getTime()
  );
  const nearestEvent = visibleUpcomingEvents[0] ?? null;
  const rsvpNeededEvent =
    visibleUpcomingEvents.find(({ event }) => event.myRsvpStatus === "NO_RESPONSE") ?? null;
  const latestHistoryEvent = historyEvents[0] ?? null;
  const normalizedJoinCode = joinCode.trim().toUpperCase();
  const openEvent = (item: ClubHomeEvent): void => {
    if (onOpenEvent) {
      onOpenEvent(item.club.id, item.event.id);
      return;
    }

    onOpenClub(item.club.id);
  };

  return (
    <div className="mx-auto w-full max-w-4xl space-y-3 pb-3">
      <section
        className="relative min-h-[158px] overflow-hidden rounded-[22px] bg-[#060706] shadow-[0_18px_42px_rgba(0,0,0,0.42),inset_0_1px_0_rgba(255,255,255,0.04)]"
        data-testid="clubs-home-hero"
      >
        <img
          alt="Покерный клуб"
          className="absolute inset-0 h-full w-full object-cover"
          decoding="async"
          fetchPriority="high"
          loading="eager"
          src={resolveMiniAppVisual("club-hero")}
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(3,5,4,0.88)_0%,rgba(3,5,4,0.48)_58%,rgba(3,5,4,0.1)_100%),linear-gradient(180deg,rgba(0,0,0,0.08),rgba(0,0,0,0.42))]" />
        <div className="absolute left-5 right-[34%] top-1/2 -translate-y-1/2 text-left">
          <p className="whitespace-nowrap font-display text-[clamp(1.45rem,6vw,2rem)] font-semibold leading-none text-white drop-shadow-[0_8px_22px_rgba(0,0,0,0.62)]">
            Покерные клубы
          </p>
          <p className="mt-2 text-sm font-medium leading-none text-white/78">Игры, участники и события</p>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3">
        <ClubHomeActionButton
          description="Для своей компании"
          icon="add_circle"
          title="Создать клуб"
          onClick={onCreateClub}
        />
        <ClubHomeActionButton
          description="Присоединиться к клубу"
          icon="qr_code_2"
          title="Войти по коду"
          onClick={() => setIsJoinOpen((current) => !current)}
        />
      </div>

      {isJoinOpen ? (
        <section className="rounded-2xl bg-[#151716] p-3 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.055)]">
          <div className="flex gap-2">
            <input
              aria-label="Код клуба"
              className={cn(inputClassName, "mt-0 min-h-11 flex-1 text-center font-semibold uppercase tracking-[0.2em]")}
              maxLength={16}
              placeholder="CLUB2026"
              value={joinCode}
              onChange={(event) => setJoinCode(event.target.value.toUpperCase().replace(/\s+/g, ""))}
            />
            <Button
              className="min-h-11 shrink-0 rounded-xl bg-[#4edea3] px-4 text-[#04130d] shadow-none hover:bg-[#67edb3]"
              disabled={normalizedJoinCode.length === 0}
              onClick={() => onJoinClubCode(normalizedJoinCode)}
            >
              Войти
            </Button>
          </div>
        </section>
      ) : null}

      {isLoading ? (
        <section className={cardClassName}>
          <h2 className="text-lg font-semibold text-white">Загружаем клубы</h2>
          <p className="mt-2 text-sm text-[#a8b0ab]">Собираем список и ближайшие игры.</p>
        </section>
      ) : null}

      {errorMessage ? (
        <section className={cn(cardClassName, "space-y-3")}>
          <div>
            <h2 className="text-lg font-semibold text-white">Пока не получилось</h2>
            <p className="mt-2 text-sm text-[#a8b0ab]">{errorMessage}</p>
          </div>
          {onRetry ? (
            <Button className={cn("w-full sm:w-auto", secondaryButtonClassName)} onClick={onRetry}>
              Попробовать снова
            </Button>
          ) : null}
        </section>
      ) : null}

      {!isLoading && !errorMessage && clubs.length === 0 ? (
        <VisualEmptyState
          compact
          action={
            <Button className="w-full" onClick={onCreateClub}>
              Создать клуб
            </Button>
          }
          description="Создайте клуб для своей покерной компании или вступите по приглашению."
          imageSrc={resolveMiniAppVisual("club")}
          title="У вас пока нет клубов"
        />
      ) : null}

      {nearestEvent ? (
        <ClubHomeEventCard
          icon="calendar_month"
          item={nearestEvent}
          title="Ближайшая игра"
          variant="nearest"
          onClick={() => openEvent(nearestEvent)}
        />
      ) : null}

      {rsvpNeededEvent ? (
        <ClubHomeEventCard
          icon="hourglass_empty"
          item={rsvpNeededEvent}
          title="Требует ответа"
          variant="rsvp"
          onClick={() => openEvent(rsvpNeededEvent)}
        />
      ) : null}

      <section className="space-y-3">
        <h2 className="text-[1.15rem] font-semibold leading-tight text-white">Мои клубы</h2>
        {clubs.map((club) => {
          const eventCount = visibleUpcomingEvents.filter((item) => item.club.id === club.id).length;

          return (
            <ClubHomeClubRow
              key={club.id}
              club={club}
              eventCount={eventCount}
              onClick={() => onOpenClub(club.id)}
            />
          );
        })}
      </section>

      <section className="overflow-hidden rounded-2xl bg-[linear-gradient(180deg,rgba(13,55,37,0.28),rgba(16,18,17,0.98))] shadow-[inset_0_0_0_1px_rgba(78,222,163,0.12),0_18px_38px_rgba(0,0,0,0.32)]">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2 text-white">
            <ClubIcon className="text-[#4edea3]" icon="history" />
            <p className="font-semibold">История</p>
          </div>
          {latestHistoryEvent ? (
            <button
              className="inline-flex items-center gap-1 text-sm font-semibold text-[#4edea3]"
              type="button"
              onClick={() => onOpenClub(latestHistoryEvent.club.id)}
            >
              Смотреть все
              <ClubIcon className="text-[16px]" icon="chevron_right" />
            </button>
          ) : null}
        </div>
        {latestHistoryEvent ? (
          <button
            className="flex w-full items-center gap-3 border-t border-[#4edea3]/10 px-4 py-3 text-left transition hover:bg-white/[0.025]"
            type="button"
            onClick={() => openEvent(latestHistoryEvent)}
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#123524] text-[#4edea3] shadow-[inset_0_0_0_1px_rgba(78,222,163,0.18)]">
              <ClubIcon className="text-[24px]" icon="emoji_events" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-white">{latestHistoryEvent.event.title}</span>
              <span className="mt-1 block truncate text-xs text-[#a8b0ab]">
                {formatCompactEventDate(latestHistoryEvent.event.scheduledStartAt)} · {getClubEventTypeLabel(latestHistoryEvent.event.type)}
              </span>
            </span>
            <span className="shrink-0 text-right">
              <span className="block text-sm font-semibold text-[#4edea3]">{getClubEventStatusLabel(latestHistoryEvent.event.status)}</span>
              <span className="mt-1 block text-xs text-[#a8b0ab]">{getEventPlayersLine(latestHistoryEvent.event)}</span>
            </span>
          </button>
        ) : (
          <div className="border-t border-[#4edea3]/10 px-4 py-3 text-sm text-[#a8b0ab]">Завершённые игры появятся здесь.</div>
        )}
      </section>
    </div>
  );
}

function ClubHomeActionButton({
  description,
  icon,
  title,
  onClick
}: {
  description: string;
  icon: string;
  title: string;
  onClick: () => void;
}): JSX.Element {
  return (
    <button
      className="min-h-[72px] rounded-2xl bg-[#151716] px-2 py-3 text-left shadow-[inset_0_0_0_1px_rgba(78,222,163,0.12),0_12px_28px_rgba(0,0,0,0.25)] transition hover:bg-[#19201c] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4edea3]"
      type="button"
      onClick={onClick}
    >
      <span className="flex items-center gap-1.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#4edea3] shadow-[inset_0_0_0_2px_rgba(78,222,163,0.72)]">
          <ClubIcon className="text-[23px]" icon={icon} />
        </span>
        <span className="min-w-0">
          <span className="block whitespace-nowrap text-[13px] font-semibold leading-tight text-white">{title}</span>
          <span className="mt-1 block whitespace-nowrap text-[10px] font-medium text-[#a8b0ab]">{description}</span>
        </span>
      </span>
    </button>
  );
}

function ClubHomeEventCard({
  icon,
  item,
  title,
  variant,
  onClick
}: {
  icon: string;
  item: ClubHomeEvent;
  title: string;
  variant: "nearest" | "rsvp";
  onClick: () => void;
}): JSX.Element {
  const { club, event } = item;
  const isRsvp = variant === "rsvp";
  const rsvpText =
    isRsvp && event.myRsvpStatus === "NO_RESPONSE"
      ? "Ответ не выбран"
      : event.myRsvpStatus
        ? getClubRsvpLabel(event.myRsvpStatus, event.type)
        : "Ответ не выбран";
  const eventType = getClubEventTypeLabel(event.type);

  return (
    <button
      className="w-full rounded-2xl bg-[#151716] p-3 text-left shadow-[inset_0_0_0_1px_rgba(255,255,255,0.055),0_14px_32px_rgba(0,0,0,0.28)] transition hover:bg-[#181b1a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4edea3]"
      type="button"
      onClick={onClick}
    >
      <span className="mb-3 flex items-center justify-between gap-3">
        <span className="flex items-center gap-2">
          <ClubIcon className={cn("text-[21px]", isRsvp ? "text-[#d99a44]" : "text-[#4edea3]")} icon={icon} />
          <span className="text-sm font-semibold text-white">{title}</span>
          {isRsvp ? (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#6d4318] px-1.5 text-[11px] font-bold text-[#ffc47a]">
              1
            </span>
          ) : null}
        </span>
        <ClubIcon className="text-[22px] text-white/55" icon="chevron_right" />
      </span>
      <span className="flex gap-3">
        <span className="relative h-[82px] w-[82px] shrink-0 overflow-hidden rounded-xl bg-[#0d0f0e]">
          <img
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover opacity-85"
            src={resolveMiniAppVisual(event.type === "OFFLINE_POKER" ? "offline-hero" : "online-hero")}
          />
          <span className="absolute inset-0 bg-black/25" />
        </span>
        <span className="min-w-0 flex-1 py-0.5">
          <span className="block truncate text-lg font-semibold leading-tight text-white">{event.title}</span>
          <span className="mt-1 block truncate text-sm text-[#a8b0ab]">
            {formatRelativeEventDate(event.scheduledStartAt)} · <span className="text-[#4edea3]">{eventType}</span>
          </span>
          <span className="mt-1 flex min-w-0 items-center gap-1.5 text-sm text-[#c7cbc8]">
            <ClubIcon className="text-[16px] text-[#a8b0ab]" icon="groups" />
            <span className="truncate">{club.name}</span>
          </span>
          <span className="mt-3 flex items-center justify-between gap-3">
            <span
              className={cn(
                "inline-flex min-h-7 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold",
                event.myRsvpStatus === "GOING"
                  ? "bg-[#1b6b48] text-[#bfffe1]"
                  : isRsvp
                    ? "bg-[#3a2514] text-[#ffbf75]"
                    : "bg-white/[0.05] text-[#c7cbc8]"
              )}
            >
              {event.myRsvpStatus === "GOING" ? <ClubIcon className="text-[15px]" icon="check_circle" /> : null}
              {event.myRsvpStatus === "GOING" ? `Вы: ${rsvpText}` : rsvpText}
            </span>
            <span className="shrink-0 text-xs font-semibold text-[#c7cbc8]">{getEventPlayersLine(event)}</span>
          </span>
        </span>
      </span>
    </button>
  );
}

function ClubHomeClubRow({
  club,
  eventCount,
  onClick
}: {
  club: ClubSummaryDto;
  eventCount: number;
  onClick: () => void;
}): JSX.Element {
  const membersCount = getClubMembersCount(club);

  return (
    <button
      className="flex min-h-[108px] w-full items-center gap-3 rounded-2xl bg-[#151716] px-3 py-3 text-left shadow-[inset_0_0_0_1px_rgba(255,255,255,0.055),0_12px_28px_rgba(0,0,0,0.24)] transition hover:bg-[#181b1a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4edea3]"
      type="button"
      onClick={onClick}
    >
      <ClubGeneratedEmblem name={club.name} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-lg font-semibold leading-tight text-white">{club.name}</span>
        <span className={cn("mt-1 inline-flex rounded-md px-2 py-0.5 text-xs font-semibold", club.myRole === "OWNER" ? "bg-[#153f2d] text-[#4edea3]" : "bg-white/[0.06] text-[#a8b0ab]")}>
          {club.myRole ? getClubRoleLabel(club.myRole) : "Клуб"}
        </span>
        <span className="mt-2 grid gap-1 text-xs text-[#a8b0ab]">
          <span className="flex items-center gap-1.5">
            <ClubIcon className="text-[15px]" icon="groups" />
            {membersCount} {getMembersLabel(membersCount)}
          </span>
          <span className="flex min-w-0 items-center gap-1.5">
            <ClubIcon className="text-[15px]" icon="event" />
            <span className="truncate">{club.nearestEvent ? `Ближайшая игра: ${formatShortEventDate(club.nearestEvent.scheduledStartAt)}` : "Нет ближайших игр"}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <ClubIcon className="text-[15px]" icon="event_note" />
            {eventCount} {getEventsLabel(eventCount)}
          </span>
        </span>
      </span>
      <ClubIcon className="shrink-0 text-[24px] text-white/55" icon="chevron_right" />
    </button>
  );
}

function ClubGeneratedEmblem({ name }: { name: string }): JSX.Element {
  const hash = getStableHash(name);
  const suit = ["♠", "♣", "♦", "♥"][hash % 4]!;
  const accent = hash % 2 === 0 ? "#d5b06a" : "#4edea3";
  const words = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3);
  const label = words.length > 0 ? words.join("\n") : "Poker\nClub";

  return (
    <span
      aria-hidden="true"
      className="grid h-[78px] w-[78px] shrink-0 place-items-center rounded-full bg-[#080b09] p-1 shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_0_0_3px_rgba(0,0,0,0.4)]"
      style={{
        background: `radial-gradient(circle at 50% 34%, rgba(255,255,255,0.08), transparent 34%), linear-gradient(180deg,#111411,#050706)`,
        boxShadow: `inset 0 0 0 1px ${accent}88, inset 0 0 0 4px rgba(255,255,255,0.035), 0 10px 24px rgba(0,0,0,0.32)`
      }}
    >
      <span className="grid h-full w-full place-items-center rounded-full border border-white/[0.04] text-center">
        <span>
          <span className="block text-xl leading-none" style={{ color: accent }}>{suit}</span>
          <span className="mt-1 block whitespace-pre-line text-[10px] font-bold uppercase leading-[0.92] tracking-[0.08em] text-white">
            {label}
          </span>
        </span>
      </span>
    </span>
  );
}

export function CreateClubScreen({
  values,
  errorMessage = null,
  isSubmitting = false,
  onChange,
  onSubmit
}: CreateClubScreenProps): JSX.Element {
  return (
    <div className={screenClassName}>
      <section className={cn(cardClassName, "space-y-4")}>
        <CompactClubTitle
          eyebrow="Новый клуб"
          title="Создать клуб"
          description="Название, короткое описание и валюта по умолчанию."
        />
        <Field label="Как назвать клуб?">
          <input
            className={inputClassName}
            maxLength={80}
            placeholder="Например, Poker Club Denis"
            value={values.name}
            onChange={(event) => onChange("name", event.target.value)}
          />
        </Field>

        <Field label="Пара слов о клубе">
          <textarea
            className={cn(inputClassName, "min-h-28 py-3")}
            placeholder="Что это за компания и как вы обычно играете"
            value={values.description}
            onChange={(event) => onChange("description", event.target.value)}
          />
        </Field>

        <Field label="В какой валюте считать по умолчанию?">
          <div className="mt-2 grid grid-cols-3 gap-3">
            {["RUB", "USD", "EUR"].map((currency) => (
              <button
                key={currency}
                className={getChoiceButtonClass(values.defaultCurrency === currency)}
                type="button"
                onClick={() => onChange("defaultCurrency", currency)}
              >
                {currency}
              </button>
            ))}
          </div>
        </Field>

        <p className="rounded-xl border border-white/[0.06] bg-white/[0.025] px-4 py-3 text-sm leading-6 text-[#a8b0ab]">
          Клуб работает по приглашениям. События и комнаты видят только участники.
        </p>

        {errorMessage ? <ErrorBanner text={errorMessage} /> : null}

        <Button className="w-full" disabled={isSubmitting} onClick={onSubmit}>
          {isSubmitting ? "Создаем клуб" : "Создать клуб"}
        </Button>
      </section>
    </div>
  );
}

export function ClubDashboardScreen({
  club,
  members,
  upcomingEvents,
  historyEvents,
  activeTab,
  isSubmitting = false,
  settingsErrorMessage = null,
  memberActionInFlightId = null,
  settingsValues,
  currentMemberId = null,
  canCreateEvents,
  canInviteMembers,
  canManageClub,
  canDeleteClub = false,
  nearestEvent,
  onChangeTab,
  onOpenEvent,
  onOpenCreateOffline,
  onOpenCreateOnline,
  onOpenInvite,
  onChangeSettings,
  onSaveSettings,
  onPromoteToAdmin,
  onMakeMember,
  onRemoveMember,
  onDeleteClub
}: ClubDashboardScreenProps): JSX.Element {
  const [isSettingsOpen, setIsSettingsOpen] = useState(activeTab === "settings");
  const [openPopup, setOpenPopup] = useState<"members" | null>(null);
  const activeListTab = activeTab === "history" ? "history" : "events";

  return (
    <div className={screenClassName}>
      <section className={cn(cardClassName, "space-y-4")}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#89918c]">
              {club.myRole ? getClubRoleLabel(club.myRole) : "Клуб"}
            </p>
            <h1 className="mt-1 truncate text-[1.65rem] font-semibold leading-tight text-white">{club.name}</h1>
            <p className="mt-1 truncate text-sm text-[#a8b0ab]">
              {nearestEvent ? `Ближайшая игра: ${nearestEvent.title}` : "Пока без ближайшей игры"}
            </p>
          </div>
          {canManageClub ? (
            <button
              aria-label="Настройки клуба"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/[0.05] text-white transition hover:bg-white/[0.08] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#56df9d]"
              type="button"
              onClick={() => setIsSettingsOpen(true)}
            >
              <span className="material-symbols-outlined text-[22px]">settings</span>
            </button>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            className="rounded-2xl bg-white/[0.04] p-4 text-left transition hover:bg-white/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#56df9d]"
            type="button"
            onClick={() => setOpenPopup("members")}
          >
            <span className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-[#a8b0ab]">Участники</span>
              <span className="material-symbols-outlined text-[18px] text-[#56df9d]">arrow_forward</span>
            </span>
            <span className="mt-2 block text-2xl font-semibold text-white">{getClubMembersCount(club)}</span>
          </button>
          <div className="rounded-2xl bg-white/[0.04] p-4 text-left">
            <span className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-[#a8b0ab]">События</span>
            </span>
            <span className="mt-2 block text-2xl font-semibold text-white">{upcomingEvents.length}</span>
          </div>
        </div>

        <Button
          className="min-h-12 w-full justify-center gap-2 border border-white/[0.06] bg-[#151817] text-white shadow-none hover:bg-[#1d211f]"
          disabled={!canInviteMembers}
          onClick={onOpenInvite}
        >
          <span className="material-symbols-outlined text-[19px]">group_add</span>
          Пригласить
        </Button>
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        <ActionTile
          description="Собрать домашнюю игру"
          imageSrc={resolveMiniAppVisual("offline")}
          title="Новая оффлайн игра"
          disabled={!canCreateEvents}
          onClick={onOpenCreateOffline}
        />
        <ActionTile
          description="Открыть онлайн-стол"
          imageSrc={resolveMiniAppVisual("online")}
          title="Новая онлайн игра"
          disabled={!canCreateEvents}
          onClick={onOpenCreateOnline}
        />
      </section>

      <section className="rounded-2xl bg-white/[0.03] p-1.5">
        <div className="grid grid-cols-2 gap-2">
          {[
            { value: "events", label: "Актуальные события" },
            { value: "history", label: "История" }
          ].map((tab) => (
            <button
              key={tab.value}
              className={getChoiceButtonClass(activeListTab === tab.value, true)}
              type="button"
              onClick={() => onChangeTab(tab.value as ClubDashboardScreenProps["activeTab"])}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      {activeTab === "events" ? (
        <section className="space-y-3">
          <ClubMiniCalendar events={upcomingEvents} onOpenEvent={onOpenEvent} />
          {upcomingEvents.length === 0 ? (
            <VisualEmptyState
              compact
              description="Создайте оффлайн-игру или онлайн-стол, и участники увидят приглашение."
              title="Пока ничего не запланировано"
            />
          ) : null}
          {upcomingEvents.map((event) => (
            <CompactGameRow
              key={event.id}
              detail={getClubEventResponseSummary(event)}
              imageSrc={resolveMiniAppVisual(event.type === "OFFLINE_POKER" ? "offline" : "online")}
              statusLabel={getClubEventStatusLabel(event.status)}
              subtitle={`${getClubEventTypeLabel(event.type)} · ${formatEventDateTime(event.scheduledStartAt)}`}
              title={event.title}
              value={event.location ?? "RSVP"}
              onClick={() => onOpenEvent(event.id)}
            />
          ))}
        </section>
      ) : null}

      {activeTab === "members" ? (
        <ClubMembersList
          canManageClub={canManageClub}
          currentMemberId={currentMemberId}
          memberActionInFlightId={memberActionInFlightId}
          members={members}
          onMakeMember={onMakeMember}
          onPromoteToAdmin={onPromoteToAdmin}
          onRemoveMember={onRemoveMember}
        />
      ) : null}

      {activeTab === "history" ? (
        <section className="space-y-3">
          {historyEvents.length === 0 ? (
            <VisualEmptyState
              compact
              description="Завершенные клубные игры появятся здесь."
              title="История пока пустая"
            />
          ) : null}
          {historyEvents.map((event) => (
            <CompactGameRow
              key={event.id}
              detail={getHistoryMetaLine(event.resultSummary) ?? "Результаты появятся после завершения"}
              imageSrc={resolveMiniAppVisual("settlement-history")}
              statusLabel={getClubEventStatusLabel(event.status)}
              subtitle={`${getHistoryHeadline(event)} · ${getClubEventTypeLabel(event.type)}`}
              title={event.title}
              value={getHistoryResultLine(event.resultSummary) ?? "Без итогов"}
              onClick={() => onOpenEvent(event.id)}
            />
          ))}
        </section>
      ) : null}

      {openPopup === "members" ? (
        <ClubModal title="Участники" onClose={() => setOpenPopup(null)}>
          <ClubMembersList
            canManageClub={canManageClub}
            currentMemberId={currentMemberId}
            memberActionInFlightId={memberActionInFlightId}
            members={members}
            onMakeMember={onMakeMember}
            onPromoteToAdmin={onPromoteToAdmin}
            onRemoveMember={onRemoveMember}
          />
        </ClubModal>
      ) : null}

      {isSettingsOpen || activeTab === "settings" ? (
        <ClubModal
          title="Настройки"
          onClose={() => {
            setIsSettingsOpen(false);
            if (activeTab === "settings") {
              onChangeTab("events");
            }
          }}
        >
          <div className="space-y-4">
            <div>
              <CompactClubTitle eyebrow="Настройки" title="Параметры клуба" description="Название, описание и валюта." />
            </div>
            <Field label="Название клуба">
              <input
                className={inputClassName}
                value={settingsValues.name}
                onChange={(event) => onChangeSettings("name", event.target.value)}
              />
            </Field>

            <Field label="Описание">
              <textarea
                className={cn(inputClassName, "min-h-28 py-3")}
                value={settingsValues.description}
                onChange={(event) => onChangeSettings("description", event.target.value)}
              />
            </Field>

            <Field label="Валюта по умолчанию">
              <div className="mt-2 grid grid-cols-3 gap-3">
                {["RUB", "USD", "EUR"].map((currency) => (
                  <button
                    key={currency}
                    className={getChoiceButtonClass(settingsValues.defaultCurrency === currency)}
                    type="button"
                    onClick={() => onChangeSettings("defaultCurrency", currency)}
                  >
                    {currency}
                  </button>
                ))}
              </div>
            </Field>

            {settingsErrorMessage ? <ErrorBanner text={settingsErrorMessage} /> : null}

            <Button className="w-full" disabled={isSubmitting} onClick={onSaveSettings}>
              {isSubmitting ? "Сохраняем" : "Сохранить"}
            </Button>

            {canDeleteClub && onDeleteClub ? (
              <Button className={cn("w-full", tertiaryButtonClassName)} disabled={isSubmitting} onClick={onDeleteClub}>
                Удалить клуб
              </Button>
            ) : null}
          </div>
        </ClubModal>
      ) : null}
    </div>
  );
}

function ClubMembersList({
  members,
  canManageClub,
  currentMemberId,
  memberActionInFlightId,
  onPromoteToAdmin,
  onMakeMember,
  onRemoveMember
}: {
  members: ClubMemberDto[];
  canManageClub: boolean;
  currentMemberId?: string | null | undefined;
  memberActionInFlightId?: string | null | undefined;
  onPromoteToAdmin: (memberId: string) => void;
  onMakeMember: (memberId: string) => void;
  onRemoveMember: (memberId: string) => void;
}): JSX.Element {
  return (
    <section className="space-y-3">
      {members.map((member) => {
        const canEditMember =
          canManageClub && member.role !== "OWNER" && member.status === "ACTIVE" && member.id !== currentMemberId;
        const isPending = memberActionInFlightId === member.id;

        return (
          <article key={member.id} className={cn(cardClassName, "space-y-3")}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-lg font-semibold text-white">
                  {member.displayName || "Игрок без имени"}
                </p>
                <p className="mt-1 text-sm text-[#a8b0ab]">{getClubRoleLabel(member.role)}</p>
              </div>
              <span className="shrink-0 rounded-full border border-white/[0.06] px-3 py-1 text-xs font-semibold text-[#cfd6d1]">
                {member.status === "ACTIVE" ? "В клубе" : "Не активен"}
              </span>
            </div>

            {canEditMember ? (
              <div className="grid gap-2 md:grid-cols-3">
                <Button
                  className={cn("w-full", secondaryButtonClassName)}
                  disabled={isPending || member.role === "ADMIN"}
                  onClick={() => onPromoteToAdmin(member.id)}
                >
                  Сделать админом
                </Button>
                <Button
                  className={cn("w-full", secondaryButtonClassName)}
                  disabled={isPending || member.role === "MEMBER"}
                  onClick={() => onMakeMember(member.id)}
                >
                  Оставить участником
                </Button>
                <Button
                  className={cn("w-full", tertiaryButtonClassName)}
                  disabled={isPending}
                  onClick={() => onRemoveMember(member.id)}
                >
                  Убрать из клуба
                </Button>
              </div>
            ) : null}
          </article>
        );
      })}
    </section>
  );
}

function ClubModal({
  title,
  children,
  onClose
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}): JSX.Element {
  return (
    <div className="fixed inset-0 z-[80] bg-black/75 px-4 py-[calc(env(safe-area-inset-top)+5rem)]">
      <section className="mx-auto flex max-h-[calc(100dvh-9rem)] max-w-xl flex-col overflow-hidden rounded-2xl bg-[#101211] text-white shadow-[0_24px_80px_rgba(0,0,0,0.55)]">
        <header className="sticky top-0 z-10 flex items-center justify-between gap-3 bg-[#101211] px-4 py-4 shadow-[inset_0_-1px_0_rgba(255,255,255,0.06)]">
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <button
            aria-label="Закрыть"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-white"
            type="button"
            onClick={onClose}
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </header>
        <div className="overflow-y-auto overscroll-contain px-4 py-4">{children}</div>
      </section>
    </div>
  );
}

function ClubMiniCalendar({
  events,
  onOpenEvent
}: {
  events: ClubEventListItemDto[];
  onOpenEvent: (eventId: string) => void;
}): JSX.Element {
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);
  const today = startOfLocalDay(new Date());
  const days = Array.from({ length: 14 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() + index);
    return date;
  });
  const eventsByDay = new Map<string, ClubEventListItemDto[]>();

  events.forEach((event) => {
    const date = new Date(event.scheduledStartAt);
    if (!Number.isFinite(date.getTime())) {
      return;
    }
    const key = getLocalDayKey(date);
    eventsByDay.set(key, [...(eventsByDay.get(key) ?? []), event]);
  });
  const selectedEvents = selectedDayKey ? eventsByDay.get(selectedDayKey) ?? [] : [];

  return (
    <section className={cn(cardClassName, "space-y-3")}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-white">Календарь</h2>
        <span className="text-xs font-semibold text-[#a8b0ab]">14 дней</span>
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {days.map((day, index) => {
          const key = getLocalDayKey(day);
          const dayEvents = eventsByDay.get(key) ?? [];
          const isSelected = selectedDayKey === key;

          return (
            <button
              key={key}
              className={cn(
                "flex min-h-[3.5rem] flex-col items-center justify-center rounded-xl bg-white/[0.035] text-center transition",
                index === 0 && "bg-[#56df9d]/12",
                isSelected && "bg-[#56df9d]/18 shadow-[inset_0_0_0_1px_rgba(86,223,157,0.24)]",
                "hover:bg-[#56df9d]/12 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#56df9d]"
              )}
              type="button"
              onClick={() => setSelectedDayKey((current) => (current === key ? null : key))}
            >
              <span className="text-[0.6rem] font-semibold uppercase text-[#89918c]">
                {day.toLocaleDateString("ru-RU", { weekday: "short" }).replace(".", "")}
              </span>
              <span className="mt-1 text-sm font-semibold text-white">{day.toLocaleDateString("ru-RU", { day: "2-digit" })}</span>
              <span className="mt-1 flex h-2 gap-0.5">
                {dayEvents.slice(0, 3).map((event) => (
                  <span key={event.id} className="h-1.5 w-1.5 rounded-full bg-[#56df9d]" />
                ))}
              </span>
            </button>
          );
        })}
      </div>
      {selectedDayKey ? (
        <div className="space-y-2 rounded-xl bg-black/20 p-2">
          {selectedEvents.length === 0 ? (
            <p className="px-2 py-2 text-sm text-[#a8b0ab]">На этот день игр нет</p>
          ) : (
            selectedEvents.map((event) => (
              <button
                key={event.id}
                className="flex w-full items-center justify-between gap-3 rounded-lg bg-white/[0.035] px-3 py-2 text-left transition hover:bg-white/[0.06]"
                type="button"
                onClick={() => onOpenEvent(event.id)}
              >
                <span className="min-w-0 truncate text-sm font-semibold text-white">{event.title}</span>
                <span className="shrink-0 text-xs text-[#a8b0ab]">
                  {new Date(event.scheduledStartAt).toLocaleTimeString("ru-RU", {
                    hour: "2-digit",
                    minute: "2-digit"
                  })}
                </span>
              </button>
            ))
          )}
        </div>
      ) : null}
    </section>
  );
}

export function ClubInviteScreen({
  clubName,
  inviteCode,
  inviteLink,
  isLoading = false,
  errorMessage = null,
  onCopy,
  onShare
}: ClubInviteScreenProps): JSX.Element {
  return (
    <div className={screenClassName}>
      <CompactClubHeader
        eyebrow="Приглашение"
        title={`Приглашение в ${clubName}`}
        description="Отправьте код тем, кого хотите видеть за клубным столом."
      />

      {isLoading ? (
        <section className={cardClassName}>
          <h2 className="text-lg font-semibold text-white">Готовим код</h2>
          <p className="mt-2 text-sm text-[#a8b0ab]">Скоро можно будет поделиться приглашением.</p>
        </section>
      ) : null}

      {inviteCode ? (
        <section className={cn(cardClassName, "text-center")}>
          <h2 className="text-lg font-semibold text-white">Код приглашения</h2>
          <p className="mt-4 rounded-2xl bg-black/28 px-4 py-5 font-display text-[2.2rem] font-semibold uppercase tracking-[0.22em] text-[#56df9d]">
            {inviteCode}
          </p>
          {inviteLink ? <p className="mt-3 break-all text-xs text-[#7f8984]">{inviteLink}</p> : null}
        </section>
      ) : null}

      {errorMessage ? <ErrorBanner text={errorMessage} /> : null}

      <section className="grid gap-3 md:grid-cols-2">
        <Button className="w-full" disabled={!inviteCode} onClick={onCopy}>
          Скопировать код приглашения
        </Button>
        <Button className={cn("w-full", secondaryButtonClassName)} disabled={!inviteCode || !inviteLink} onClick={onShare}>
          Поделиться в Telegram
        </Button>
      </section>
    </div>
  );
}

export function JoinClubScreen({
  inviteCode,
  preview,
  alreadyMember = false,
  isLoading = false,
  isSubmitting = false,
  errorMessage = null,
  onJoin,
  onOpenClub
}: JoinClubScreenProps): JSX.Element {
  return (
    <div className={screenClassName}>
      <section className={cn(cardClassName, "space-y-4")}>
        <CompactClubTitle
          eyebrow="Приглашение"
          title="Вас пригласили в клуб"
          description="Проверим приглашение и покажем детали."
        />
        {isLoading ? (
          <p className="rounded-xl border border-white/[0.06] bg-white/[0.025] px-4 py-3 text-sm text-[#a8b0ab]">
            Проверяем приглашение.
          </p>
        ) : null}

        {preview ? (
          <section className="rounded-xl border border-white/[0.06] bg-white/[0.025] px-4 py-3">
            <h2 className="text-lg font-semibold text-white">{preview.name}</h2>
            <p className="mt-1 text-sm text-[#a8b0ab]">
              {getClubMembersCount(preview)} {getMembersLabel(getClubMembersCount(preview))}
            </p>
          </section>
        ) : (
          <section className="rounded-xl border border-white/[0.06] bg-white/[0.025] px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#9ea6a2]">Код приглашения</p>
            <p className="mt-2 text-lg font-semibold text-white">{inviteCode}</p>
          </section>
        )}

        {errorMessage ? <ErrorBanner text={errorMessage} /> : null}

        {alreadyMember ? (
          <Button className="w-full" onClick={onOpenClub}>
            Открыть клуб
          </Button>
        ) : (
          <Button className="w-full" disabled={isSubmitting || isLoading || !preview} onClick={onJoin}>
            {isSubmitting ? "Вступаем" : "Вступить в клуб"}
          </Button>
        )}
      </section>
    </div>
  );
}

export function ClubEventDetailsScreen({
  clubName,
  event,
  myRsvpStatus = null,
  rsvpGroups,
  canManage = false,
  isUpdatingRsvp = false,
  isSendingReminder = false,
  isCancellingEvent = false,
  errorMessage = null,
  onSetRsvp,
  onOpenLinkedRoom,
  onOpenLinkedTable,
  onSendReminder,
  onCancelEvent
}: ClubEventDetailsScreenProps): JSX.Element {
  const rsvpOptions = getAllowedRsvpStatuses(event.type);

  return (
    <div className={screenClassName}>
      <CompactClubHeader
        description={[
          `${getClubEventTypeLabel(event.type)} · ${formatEventDateTime(event.scheduledStartAt)}`,
          event.location ?? null,
          typeof event.maxPlayers === "number" ? `до ${event.maxPlayers} игроков` : null
        ]
          .filter(Boolean)
          .join(" · ")}
        eyebrow={clubName}
        title={event.title}
      />

      <section className={cn(cardClassName, "space-y-3")}>
        <div>
          <h2 className="text-lg font-semibold text-white">Ваш ответ</h2>
          <p className="mt-1 text-sm text-[#a8b0ab]">
            {myRsvpStatus ? getClubRsvpLabel(myRsvpStatus, event.type) : "Вы еще не ответили"}
          </p>
        </div>
        <div className="grid gap-2 md:grid-cols-3">
          {rsvpOptions.map((status) => (
            <button
              key={status}
              className={getChoiceButtonClass(myRsvpStatus === status)}
              disabled={isUpdatingRsvp}
              type="button"
              onClick={() => onSetRsvp(status)}
            >
              {getClubRsvpLabel(status, event.type)}
            </button>
          ))}
        </div>
      </section>

      {errorMessage ? <ErrorBanner text={errorMessage} /> : null}

      <section className="space-y-3">
        {getGroupedRsvpSections(rsvpGroups).map((group) => (
          <article key={group.key} className={cn(cardClassName, "space-y-3")}>
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-white">{group.label}</h2>
              <span className="text-sm text-[#a8b0ab]">{group.items.length}</span>
            </div>
            {group.items.length === 0 ? (
              <p className="text-sm text-[#a8b0ab]">Пока никого нет</p>
            ) : (
              <div className="space-y-2">
                {group.items.map((person) => (
                  <div
                    key={person.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.018] px-3 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-white">
                        {person.displayName || "Игрок без имени"}
                      </p>
                      {person.role ? <p className="mt-1 text-xs text-[#a8b0ab]">{getClubRoleLabel(person.role)}</p> : null}
                    </div>
                    <span className="text-xs font-semibold text-[#cfd6d1]">
                      {getClubRsvpLabel(person.status, event.type)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </article>
        ))}
      </section>

      {canManage ? (
        <section className={cn(cardClassName, "space-y-3")}>
          <h2 className="text-lg font-semibold text-white">Действия для организатора</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {event.offlineRoomId && onOpenLinkedRoom ? (
              <Button className="w-full" onClick={onOpenLinkedRoom}>
                Открыть оффлайн-комнату
              </Button>
            ) : null}
            {event.virtualTableId && onOpenLinkedTable ? (
              <Button className="w-full" onClick={onOpenLinkedTable}>
                Открыть онлайн-стол
              </Button>
            ) : null}
            {onSendReminder ? (
              <Button
                className={cn("w-full", secondaryButtonClassName)}
                disabled={isSendingReminder}
                onClick={onSendReminder}
              >
                {isSendingReminder ? "Отправляем" : "Отправить напоминание"}
              </Button>
            ) : null}
            {onCancelEvent ? (
              <Button
                className={cn("w-full", tertiaryButtonClassName)}
                disabled={isCancellingEvent}
                onClick={onCancelEvent}
              >
                {isCancellingEvent ? "Отменяем" : "Отменить мероприятие"}
              </Button>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function CompactClubHeader({
  eyebrow,
  title,
  description,
  aside,
  children
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  aside?: ReactNode;
  children?: ReactNode;
}): JSX.Element {
  return (
    <section className={cn(cardClassName, "space-y-4")}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <CompactClubTitle
          title={title}
          {...(eyebrow ? { eyebrow } : {})}
          {...(description ? { description } : {})}
        />
        {aside ? <div className="shrink-0">{aside}</div> : null}
      </div>
      {children ? <div className="grid gap-3 sm:grid-cols-2">{children}</div> : null}
    </section>
  );
}

function CompactClubTitle({
  eyebrow,
  title,
  description
}: {
  eyebrow?: string;
  title: string;
  description?: string;
}): JSX.Element {
  return (
    <div className="min-w-0">
      {eyebrow ? (
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#9ea6a2]">{eyebrow}</p>
      ) : null}
      <h1 className={cn("font-['Hanken_Grotesk',Inter,sans-serif] text-[1.7rem] font-bold leading-tight text-white", eyebrow ? "mt-1" : "")}>
        {title}
      </h1>
      {description ? <p className="mt-2 text-sm leading-6 text-[#a8b0ab]">{description}</p> : null}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }): JSX.Element {
  return (
    <label className="block">
      <span className="text-sm font-medium text-white">{label}</span>
      {children}
    </label>
  );
}

function ErrorBanner({ text }: { text: string }): JSX.Element {
  return (
    <p className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
      {text}
    </p>
  );
}

function ClubIcon({
  icon,
  className
}: {
  icon: string;
  className?: string;
}): JSX.Element {
  return <span className={cn("material-symbols-outlined text-[18px]", className)}>{icon}</span>;
}

function getChoiceButtonClass(isActive: boolean, compact = false): string {
  return cn(
    "inline-flex items-center justify-center rounded-xl border font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#56df9d]",
    compact ? "min-h-10 px-3 text-sm" : "min-h-12 px-4 text-[0.95rem]",
    isActive
      ? "border-[#56df9d] bg-[#56df9d] text-[#032517]"
      : "border-white/[0.06] bg-[#171918] text-white hover:bg-[#202322]"
  );
}

function startOfLocalDay(value: Date): Date {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function getLocalDayKey(value: Date): string {
  const date = startOfLocalDay(value);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function getMembersLabel(count: number): string {
  const lastTwo = count % 100;
  const last = count % 10;

  if (lastTwo >= 11 && lastTwo <= 14) {
    return "участников";
  }

  if (last === 1) {
    return "участник";
  }

  if (last >= 2 && last <= 4) {
    return "участника";
  }

  return "участников";
}

function getEventsLabel(count: number): string {
  const lastTwo = count % 100;
  const last = count % 10;

  if (lastTwo >= 11 && lastTwo <= 14) {
    return "событий";
  }

  if (last === 1) {
    return "событие";
  }

  if (last >= 2 && last <= 4) {
    return "события";
  }

  return "событий";
}

function getEventPlayersLine(event: ClubEventListItemDto): string {
  const goingCount = event.rsvpSummary?.goingCount ?? 0;

  if (event.maxPlayers && event.maxPlayers > 0) {
    return `${goingCount} / ${event.maxPlayers} игроков`;
  }

  return goingCount > 0 ? `${goingCount} игроков` : "Ждём ответы";
}

function formatRelativeEventDate(value: string): string {
  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) {
    return "Время уточняется";
  }

  const now = new Date();
  const today = startOfLocalDay(now);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const eventDay = startOfLocalDay(date);
  const time = date.toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit"
  });

  if (eventDay.getTime() === today.getTime()) {
    return `Сегодня, ${time}`;
  }

  if (eventDay.getTime() === tomorrow.getTime()) {
    return `Завтра, ${time}`;
  }

  return formatEventDateTime(value);
}

function formatShortEventDate(value: string): string {
  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) {
    return "время уточняется";
  }

  return date.toLocaleString("ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatCompactEventDate(value: string): string {
  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) {
    return "Время уточняется";
  }

  return date.toLocaleString("ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function getStableHash(value: string): number {
  return Array.from(value).reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) >>> 0, 7);
}

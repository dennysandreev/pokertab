import { formatMinorMoney } from "@pokertable/shared";
import type {
  ClubEventListItemDto,
  ClubEventResultSummaryDto,
  ClubEventRsvpGroupsDto,
  ClubEventRsvpStatus,
  ClubEventStatus,
  ClubEventType,
  ClubMemberRole,
  ClubSummaryDto
} from "./types";

export function getClubMembersCount(club: ClubSummaryDto): number {
  return club.membersCount ?? club.activeMembersCount ?? 0;
}

export function getClubRoleLabel(role: ClubMemberRole): string {
  switch (role) {
    case "OWNER":
      return "Владелец";
    case "ADMIN":
      return "Админ";
    default:
      return "Участник";
  }
}

export function getClubEventTypeLabel(type: ClubEventType): string {
  return type === "ONLINE_TABLE" ? "Онлайн" : "Оффлайн";
}

export function getClubEventStatusLabel(status: ClubEventStatus): string {
  switch (status) {
    case "COMPLETED":
      return "Завершено";
    case "CANCELLED":
      return "Отменено";
    case "IN_PROGRESS":
      return "Идёт сейчас";
    case "RSVP_OPEN":
      return "Ждём ответы";
    default:
      return "Запланировано";
  }
}

export function getClubRsvpLabel(status: ClubEventRsvpStatus, eventType: ClubEventType): string {
  if (eventType === "ONLINE_TABLE") {
    switch (status) {
      case "GOING":
        return "Играю";
      case "DECLINED":
        return "Не смогу";
      case "WAITLIST":
        return "Лист ожидания";
      case "NO_RESPONSE":
        return "Не ответил";
      default:
        return "Возможно";
    }
  }

  switch (status) {
    case "GOING":
      return "Приду";
    case "MAYBE":
      return "Возможно";
    case "DECLINED":
      return "Не смогу";
    case "WAITLIST":
      return "Лист ожидания";
    default:
      return "Не ответил";
  }
}

export function getClubEventResponseSummary(event: ClubEventListItemDto): string {
  const summary = event.rsvpSummary;

  if (!summary) {
    return "Ответы появятся здесь";
  }

  const parts = [
    summary.goingCount ? `${summary.goingCount} ${event.type === "ONLINE_TABLE" ? "играют" : "идут"}` : null,
    summary.maybeCount ? `${summary.maybeCount} возможно` : null,
    summary.declinedCount ? `${summary.declinedCount} отказались` : null,
    summary.noResponseCount ? `${summary.noResponseCount} не ответили` : null,
    summary.waitlistCount ? `${summary.waitlistCount} в листе ожидания` : null
  ].filter((part): part is string => !!part);

  return parts.length > 0 ? parts.join(" · ") : "Ответы появятся здесь";
}

export function getNearestEventText(club: ClubSummaryDto): string {
  if (!club.nearestEvent) {
    return "Ближайшее событие появится после первой игры";
  }

  return `${club.nearestEvent.title} · ${formatEventDateTime(club.nearestEvent.scheduledStartAt)}`;
}

export function formatEventDateTime(value: string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export function formatDateTimeLocalInput(value: string | null | undefined): string {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);

  return localDate.toISOString().slice(0, 16);
}

export function buildOffsetDateTimeString(value: string): string | null {
  const normalized = value.trim();

  if (!normalized) {
    return null;
  }

  const date = new Date(normalized);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absoluteOffsetMinutes = Math.abs(offsetMinutes);
  const offsetHours = String(Math.floor(absoluteOffsetMinutes / 60)).padStart(2, "0");
  const offsetRemainderMinutes = String(absoluteOffsetMinutes % 60).padStart(2, "0");
  const [datePart, timePart] = normalized.split("T");

  if (!datePart || !timePart) {
    return null;
  }

  return `${datePart}T${timePart}:00${sign}${offsetHours}:${offsetRemainderMinutes}`;
}

export function getHistoryHeadline(event: ClubEventListItemDto): string {
  return event.type === "ONLINE_TABLE" ? "Онлайн" : "Оффлайн";
}

export function getHistoryResultLine(resultSummary: ClubEventResultSummaryDto | null | undefined): string | null {
  if (!resultSummary) {
    return null;
  }

  if (resultSummary.winnerName && resultSummary.winnerNetMinor) {
    return `Победитель: ${resultSummary.winnerName} ${formatSignedMinor(resultSummary.winnerNetMinor, "RUB")}`;
  }

  if (resultSummary.leaderName && resultSummary.leaderNetChips) {
    return `Лидер: ${resultSummary.leaderName} ${formatSignedChips(resultSummary.leaderNetChips)}`;
  }

  return null;
}

export function getHistoryMetaLine(resultSummary: ClubEventResultSummaryDto | null | undefined): string | null {
  if (!resultSummary) {
    return null;
  }

  if (typeof resultSummary.handsCount === "number" && resultSummary.handsCount > 0) {
    return `Раздач: ${resultSummary.handsCount}`;
  }

  if (typeof resultSummary.participantsCount === "number" && resultSummary.participantsCount > 0) {
    return `Участников: ${resultSummary.participantsCount}`;
  }

  return null;
}

export function getAllowedRsvpStatuses(
  eventType: ClubEventType
): Exclude<ClubEventRsvpStatus, "NO_RESPONSE">[] {
  return eventType === "ONLINE_TABLE"
    ? (["GOING", "DECLINED"] as Exclude<ClubEventRsvpStatus, "NO_RESPONSE">[])
    : (["GOING", "MAYBE", "DECLINED"] as Exclude<ClubEventRsvpStatus, "NO_RESPONSE">[]);
}

export function isClubManager(role: ClubMemberRole | null | undefined): boolean {
  return role === "OWNER" || role === "ADMIN";
}

export function getGroupedRsvpSections(groups: ClubEventRsvpGroupsDto): Array<{
  key: string;
  label: string;
  items: ClubEventRsvpGroupsDto[keyof ClubEventRsvpGroupsDto];
}> {
  return [
    { key: "going", label: "Придут", items: groups.going },
    { key: "maybe", label: "Возможно", items: groups.maybe },
    { key: "declined", label: "Не смогут", items: groups.declined },
    { key: "noResponse", label: "Не ответили", items: groups.noResponse },
    { key: "waitlist", label: "Лист ожидания", items: groups.waitlist }
  ];
}

function formatSignedMinor(value: string, currency: string): string {
  const amount = BigInt(value);
  const formatted = formatMinorMoney(value, currency);

  return amount > 0n ? `+${formatted}` : formatted;
}

function formatSignedChips(value: string): string {
  const amount = BigInt(value);
  const absolute = amount < 0n ? amount * -1n : amount;
  const formatted = new Intl.NumberFormat("ru-RU").format(Number(absolute)).replace(/\u00A0/g, " ");
  const sign = amount > 0n ? "+" : amount < 0n ? "-" : "";

  return `${sign}${formatted} chips`;
}

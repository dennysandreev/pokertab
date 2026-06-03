import type { JSX } from "react";
import { cn } from "@/lib/utils";
import { resolveMiniAppVisual } from "../visual/mini-app-visuals";
import { getClubEventTypeLabel, getClubRsvpLabel } from "./club-view";
import type { ClubHomeEventItem } from "./club-home-events";

type ClubEventPreviewCardProps = {
  item: ClubHomeEventItem;
  title?: string;
  onClick: () => void;
};

export function ClubEventPreviewCard({ item, title, onClick }: ClubEventPreviewCardProps): JSX.Element {
  const { club, event } = item;
  const rsvpLabel = getPreviewRsvpLabel(event);

  return (
    <button
      className="w-full rounded-[22px] bg-[#151716] p-3 text-left shadow-[inset_0_0_0_1px_rgba(255,255,255,0.055),0_12px_28px_rgba(0,0,0,0.26)] transition hover:bg-[#191c1a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4edea3]"
      type="button"
      onClick={onClick}
    >
      {title ? <p className="mb-3 text-[1.15rem] font-semibold leading-tight text-white">{title}</p> : null}
      <span className="flex items-center gap-3">
        <span className="relative h-[82px] w-[82px] shrink-0 overflow-hidden rounded-xl bg-[#0d0f0e]">
          <img
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover opacity-85"
            src={resolveMiniAppVisual(event.type === "OFFLINE_POKER" ? "offline-hero" : "online-hero")}
          />
          <span className="absolute inset-0 bg-black/24" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-lg font-semibold leading-tight text-white">{event.title}</span>
          <span className="mt-2 flex items-center gap-1.5 text-sm text-[#a8b0ab]">
            <ClubPreviewIcon icon="calendar_month" />
            <span className="truncate">
              {formatClubPreviewDate(event.scheduledStartAt)} · <span className="text-[#4edea3]">{getClubEventTypeLabel(event.type)}</span>
            </span>
          </span>
          <span className="mt-1 flex items-center gap-1.5 text-sm text-[#a8b0ab]">
            <ClubPreviewIcon icon="groups" />
            <span className="truncate">{club.name}</span>
          </span>
          <span className="mt-3 flex items-center justify-between gap-3">
            {rsvpLabel ? (
              <span
                className={cn(
                  "inline-flex min-h-7 items-center rounded-full px-2.5 text-xs font-semibold",
                  event.myRsvpStatus === "GOING"
                    ? "bg-[#1b6b48] text-[#bfffe1]"
                    : event.myRsvpStatus === "NO_RESPONSE"
                      ? "bg-[#3a2514] text-[#ffbf75]"
                      : "bg-white/[0.05] text-[#c7cbc8]"
                )}
              >
                {rsvpLabel}
              </span>
            ) : null}
            <span className="ml-auto shrink-0 text-xs font-semibold text-[#c7cbc8]">{getClubPreviewPlayers(event)}</span>
          </span>
        </span>
        <ClubPreviewIcon className="shrink-0 text-[24px] text-white/55" icon="chevron_right" />
      </span>
    </button>
  );
}

function ClubPreviewIcon({ icon, className }: { icon: string; className?: string }): JSX.Element {
  return <span className={cn("material-symbols-outlined text-[18px]", className)}>{icon}</span>;
}

function getPreviewRsvpLabel(event: ClubHomeEventItem["event"]): string | null {
  if (!event.myRsvpStatus) {
    return null;
  }

  if (event.myRsvpStatus === "GOING") {
    return `Вы: ${getClubRsvpLabel(event.myRsvpStatus, event.type)}`;
  }

  if (event.myRsvpStatus === "NO_RESPONSE") {
    return "Ответ не выбран";
  }

  return getClubRsvpLabel(event.myRsvpStatus, event.type);
}

function getClubPreviewPlayers(event: ClubHomeEventItem["event"]): string {
  const goingCount = event.rsvpSummary?.goingCount ?? 0;

  if (event.maxPlayers && event.maxPlayers > 0) {
    return `${goingCount} / ${event.maxPlayers} игроков`;
  }

  return goingCount > 0 ? `${goingCount} игроков` : "";
}

function formatClubPreviewDate(value: string): string {
  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) {
    return "Дата скоро";
  }

  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  const time = new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);

  if (isSameDay(date, today)) {
    return `Сегодня, ${time}`;
  }

  if (isSameDay(date, tomorrow)) {
    return `Завтра, ${time}`;
  }

  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function isSameDay(left: Date, right: Date): boolean {
  return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth() && left.getDate() === right.getDate();
}

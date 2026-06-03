import type { JSX } from "react";
import { cn } from "@/lib/utils";

export type ClubOption = {
  id: string;
  name: string;
};

type ClubSchedulingSectionProps = {
  clubId: string;
  scheduledStartAt: string;
  sendNotifications: boolean;
  maxPlayers?: string;
  location?: string;
  clubs: ClubOption[];
  isLoadingClubs?: boolean;
  title: string;
  description: string;
  scheduledLabel: string;
  onClubIdChange: (value: string) => void;
  onScheduledStartAtChange: (value: string) => void;
  onSendNotificationsChange: (value: boolean) => void;
  onMaxPlayersChange?: (value: string) => void;
  onLocationChange?: (value: string) => void;
};

const sectionClassName =
  "glass-card rounded-2xl bg-white/[0.03] px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.025)]";
const fieldClassName =
  "mt-2 min-h-12 w-full min-w-0 max-w-full rounded-xl border border-white/10 bg-surfaceHigher px-4 text-sm text-foreground outline-none transition placeholder:text-muted/60 focus:border-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

export function ClubSchedulingSection({
  clubId,
  scheduledStartAt,
  sendNotifications,
  maxPlayers,
  location,
  clubs,
  isLoadingClubs = false,
  title,
  description,
  scheduledLabel,
  onClubIdChange,
  onScheduledStartAtChange,
  onSendNotificationsChange,
  onMaxPlayersChange,
  onLocationChange
}: ClubSchedulingSectionProps): JSX.Element {
  const hasSelectedClub = clubId.trim().length > 0;
  const scheduledDateLabel = formatScheduledDateTime(scheduledStartAt);

  return (
    <section className={sectionClassName}>
      <div>
        <p className="text-sm font-semibold text-white">{title}</p>
        <p className="mt-2 text-sm leading-6 text-muted">{description}</p>
      </div>

      <div className="mt-4 space-y-4">
        <label className="block">
          <span className="text-sm font-medium text-foreground">Клуб</span>
          <select
            className={fieldClassName}
            value={clubId}
            onChange={(event) => onClubIdChange(event.target.value)}
          >
            <option value="">
              {isLoadingClubs ? "Загружаем клубы" : clubs.length > 0 ? "Без клуба" : "Пока без клуба"}
            </option>
            {clubs.map((club) => (
              <option key={club.id} value={club.id}>
                {club.name}
              </option>
            ))}
          </select>
        </label>

        <div className={cn("grid min-w-0 gap-4 md:grid-cols-2", !hasSelectedClub && "opacity-75")}>
          <label className="block min-w-0">
            <span className="text-sm font-medium text-foreground">Дата и время игры</span>
            <span
              className={cn(
                "relative mt-2 flex min-h-12 w-full min-w-0 max-w-full items-center gap-3 overflow-hidden rounded-xl border border-white/10 bg-surfaceHigher px-3 text-left outline-none transition",
                hasSelectedClub ? "focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/30" : "text-muted"
              )}
            >
              <span className="material-symbols-outlined shrink-0 text-[20px] text-accent">calendar_month</span>
              <span className="min-w-0 flex-1">
                <span className={cn("block truncate text-sm font-semibold", scheduledStartAt ? "text-foreground" : "text-muted")}>
                  {scheduledDateLabel}
                </span>
                <span className="mt-0.5 block truncate text-xs text-muted">
                  {scheduledStartAt ? "Можно изменить" : "Нажмите, чтобы выбрать дату"}
                </span>
              </span>
              <span className="material-symbols-outlined shrink-0 text-[18px] text-muted">expand_more</span>
              <input
                aria-label={scheduledLabel}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
                disabled={!hasSelectedClub}
                type="datetime-local"
                value={scheduledStartAt}
                onChange={(event) => onScheduledStartAtChange(event.target.value)}
              />
            </span>
          </label>

          {onMaxPlayersChange ? (
            <label className="block min-w-0">
              <span className="text-sm font-medium text-foreground">Лимит игроков</span>
              <input
                className={fieldClassName}
                disabled={!hasSelectedClub}
                inputMode="numeric"
                placeholder="Например, 9"
                value={maxPlayers ?? ""}
                onChange={(event) => onMaxPlayersChange(event.target.value)}
              />
            </label>
          ) : null}
        </div>

        {onLocationChange ? (
          <label className="block">
            <span className="text-sm font-medium text-foreground">Где собираетесь</span>
            <input
              className={fieldClassName}
              disabled={!hasSelectedClub}
              placeholder="Например, у Дениса"
              value={location ?? ""}
              onChange={(event) => onLocationChange(event.target.value)}
            />
          </label>
        ) : null}

        <button
          aria-checked={sendNotifications}
          className={cn(
            "flex min-h-12 w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
            hasSelectedClub
              ? sendNotifications
                ? "border-accent/50 bg-accent/10"
                : "border-white/10 bg-surfaceHigh hover:bg-surfaceHigher"
              : "border-white/8 bg-white/[0.02] text-muted"
          )}
          disabled={!hasSelectedClub}
          role="switch"
          type="button"
          onClick={() => onSendNotificationsChange(!sendNotifications)}
        >
          <span>
            <span className="block text-sm font-medium text-white">Отправить приглашения</span>
            <span className="mt-1 block text-sm leading-5 text-muted">
              Участники клуба получат приглашение и смогут ответить заранее.
            </span>
          </span>
          <span
            className={cn(
              "relative inline-flex h-7 w-12 shrink-0 rounded-full border transition",
              sendNotifications ? "border-accent/40 bg-accent/20" : "border-white/12 bg-[#202020]"
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 h-[22px] w-[22px] rounded-full bg-white shadow-[0_4px_10px_rgba(0,0,0,0.3)] transition-transform",
                sendNotifications ? "translate-x-6" : "translate-x-1"
              )}
            />
          </span>
        </button>
      </div>
    </section>
  );
}

function formatScheduledDateTime(value: string): string {
  if (!value) {
    return "Выберите дату и время";
  }

  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) {
    return "Выберите дату и время";
  }

  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  });
}

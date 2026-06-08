import { useState, type JSX, type ReactNode } from "react";
import type {
  OpenVirtualTableListItemDto,
  VirtualSeatDto,
  VirtualTableDto,
  VirtualTablesListItemDto
} from "@pokertable/shared";
import {
  CompactGameRow,
  VisualEmptyState
} from "@/components/visual";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ClubEventPreviewCard } from "../clubs/club-event-preview";
import type { ClubHomeEventItem } from "../clubs/club-home-events";
import { ClubSchedulingSection, type ClubOption } from "../clubs/club-form";
import { resolveMiniAppVisual } from "../visual/mini-app-visuals";
import {
  AvatarInitials,
  BottomActionBar,
  FieldLabel,
  GlassPanel,
  RolePill,
  ScreenHeader,
  SectionStack,
  formatBlindPair,
  formatDurationMinutes,
  formatSeatCount,
  formatStackReference,
  formatVirtualChips,
  formatVirtualChipsRate,
  getJoinEmptyCopy,
  getLobbyEmptyCopy,
  getSeatStatusLabel,
  getTableStatusLabel,
  virtualInputClassName,
  virtualScreenClassName,
  virtualSectionTitleClassName
} from "./virtual-ui";
import {
  convertChipsPerCurrencyUnitToChipValueMinor,
  deriveSmallBlindChips,
  type CreateVirtualTableFormValues
} from "./virtual-table-form";

type LobbyScreenProps = {
  myTables: VirtualTablesListItemDto[];
  activeTables: VirtualTablesListItemDto[];
  waitingTables: VirtualTablesListItemDto[];
  recentTables: VirtualTablesListItemDto[];
  nearestEvent?: ClubHomeEventItem | null;
  joinCode: string;
  onJoinCodeChange: (value: string) => void;
  onJoinSubmit: () => void;
  onCreateTable: () => void;
  onOpenTables: () => void;
  onOpenTable?: (tableId: string) => void;
  onOpenNearestEvent?: (clubId: string, eventId: string) => void;
};

type CreateVirtualTableScreenProps = {
  values: CreateVirtualTableFormValues;
  clubs: ClubOption[];
  isLoadingClubs?: boolean;
  validationMessage?: string | null;
  isSubmitting?: boolean;
  onChange: <K extends keyof CreateVirtualTableFormValues>(
    field: K,
    value: CreateVirtualTableFormValues[K]
  ) => void;
  onSubmit: () => void;
};

type JoinVirtualTableScreenProps = {
  inviteCode: string;
  title?: string;
  description?: string;
  helperText?: string | null;
  isSubmitting?: boolean;
  onInviteCodeChange: (value: string) => void;
  onSubmit: () => void;
};

type OpenVirtualTablesScreenProps = {
  tables: OpenVirtualTableListItemDto[];
  isLoading?: boolean;
  errorMessage?: string | null;
  joiningTableId?: string | null;
  onRefresh: () => void;
  onJoinTable: (tableId: string) => void;
};

type WaitingRoomScreenProps = {
  table: VirtualTableDto;
  seats: VirtualSeatDto[];
  isStarting?: boolean;
  isCancelling?: boolean;
  canStart?: boolean;
  canCancel?: boolean;
  onCopyCode: () => void;
  onStartGame?: () => void;
  onCancelTable?: () => void;
  footer?: ReactNode;
};

export const RECENT_TABLES_PAGE_SIZE = 5;

export function VirtualLobbyScreen({
  myTables,
  recentTables,
  nearestEvent = null,
  joinCode,
  onJoinCodeChange,
  onJoinSubmit,
  onCreateTable,
  onOpenTables,
  onOpenTable,
  onOpenNearestEvent
}: LobbyScreenProps): JSX.Element {
  const [recentLimit, setRecentLimit] = useState(RECENT_TABLES_PAGE_SIZE);
  const visibleRecentTables = recentTables.slice(0, recentLimit);
  const currentTables = myTables.filter(
    (table) => table.status === "ACTIVE" || table.status === "PAUSED" || table.status === "WAITING_FOR_PLAYERS"
  );

  return (
    <div className="pb-[calc(env(safe-area-inset-bottom)+7rem)] text-white">
      <div className="space-y-4">
        <OnlineActionHero
          joinCode={joinCode}
          onCreateTable={onCreateTable}
          onOpenTables={onOpenTables}
          onJoinCodeChange={onJoinCodeChange}
          onJoinSubmit={onJoinSubmit}
        />

        <TableCollectionSection
          empty={{
            title: "Пока нет онлайн-столов",
            description: "Создайте новый стол или войдите по коду, когда вас пригласят."
          }}
          tables={currentTables}
          title="Активные игры"
          {...(onOpenTable ? { onOpenTable } : {})}
        />

        {nearestEvent && onOpenNearestEvent ? (
          <section className="space-y-3">
            <ClubEventPreviewCard
              item={nearestEvent}
              title="Ближайшие столы"
              onClick={() => onOpenNearestEvent(nearestEvent.club.id, nearestEvent.event.id)}
            />
          </section>
        ) : null}

        <TableCollectionSection
          empty={getLobbyEmptyCopy("recent")}
          footer={
            recentTables.length > visibleRecentTables.length ? (
              <Button
                className="w-full border border-white/[0.06] bg-[#171818] text-white shadow-none hover:bg-[#202121]"
                onClick={() => setRecentLimit((current) => current + RECENT_TABLES_PAGE_SIZE)}
              >
                Показать ещё
              </Button>
            ) : null
          }
          tables={visibleRecentTables}
          title="Последние игры"
          {...(onOpenTable ? { onOpenTable } : {})}
        />
      </div>
    </div>
  );
}

function OnlineActionHero({
  joinCode,
  onJoinCodeChange,
  onJoinSubmit,
  onCreateTable,
  onOpenTables
}: {
  joinCode: string;
  onJoinCodeChange: (value: string) => void;
  onJoinSubmit: () => void;
  onCreateTable: () => void;
  onOpenTables: () => void;
}): JSX.Element {
  const [isJoinOpen, setIsJoinOpen] = useState(false);

  return (
    <div className="space-y-3" data-testid="online-action-hero">
      <section className="relative min-h-[158px] overflow-hidden rounded-[22px] bg-[#060706] shadow-[0_18px_42px_rgba(0,0,0,0.42),inset_0_1px_0_rgba(255,255,255,0.04)]">
        <picture>
          <source srcSet={resolveMiniAppVisual("online-hero-webp")} type="image/webp" />
          <img
            alt="Онлайн-покер"
            className="absolute inset-0 h-full w-full object-cover object-[50%_42%]"
            decoding="async"
            fetchPriority="high"
            loading="eager"
            src={resolveMiniAppVisual("online-hero")}
          />
        </picture>
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(2,4,3,0.9)_0%,rgba(2,4,3,0.46)_58%,rgba(2,4,3,0.08)_100%),linear-gradient(180deg,rgba(0,0,0,0.04),rgba(0,0,0,0.44))]" />
        <div className="absolute left-5 right-[34%] top-1/2 -translate-y-1/2 text-left">
          <p className="whitespace-nowrap font-display text-[clamp(1.45rem,6vw,2rem)] font-semibold leading-none text-white drop-shadow-[0_8px_22px_rgba(0,0,0,0.62)]">
            Онлайн-столы
          </p>
          <p className="mt-2 text-sm font-medium leading-none text-white/78">Играйте за виртуальными столами</p>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3">
        <button
          className="min-h-[72px] rounded-2xl bg-[#151716] px-2 py-3 text-left text-white shadow-[inset_0_0_0_1px_rgba(78,222,163,0.12),0_12px_28px_rgba(0,0,0,0.25)] transition hover:bg-[#19201c] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4edea3]"
          onClick={onCreateTable}
          type="button"
        >
          <span className="flex items-center gap-1.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#4edea3] shadow-[inset_0_0_0_2px_rgba(78,222,163,0.72)]">
              <span className="material-symbols-outlined text-[23px]">add_circle</span>
            </span>
            <span className="min-w-0">
              <span className="block whitespace-nowrap text-[13px] font-semibold leading-tight">Создать стол</span>
              <span className="mt-1 block whitespace-nowrap text-[10px] font-medium text-[#a8b0ab]">Новая онлайн игра</span>
            </span>
          </span>
        </button>

        <button
          className="min-h-[72px] rounded-2xl bg-[#151716] px-2 py-3 text-left text-white shadow-[inset_0_0_0_1px_rgba(78,222,163,0.12),0_12px_28px_rgba(0,0,0,0.25)] transition hover:bg-[#19201c] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4edea3]"
          onClick={() => setIsJoinOpen((current) => !current)}
          type="button"
        >
          <span className="flex items-center gap-1.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#4edea3] shadow-[inset_0_0_0_2px_rgba(78,222,163,0.72)]">
              <span className="material-symbols-outlined text-[23px]">tag</span>
            </span>
            <span className="min-w-0">
              <span className="block whitespace-nowrap text-[13px] font-semibold leading-tight">Войти по коду</span>
              <span className="mt-1 block whitespace-nowrap text-[10px] font-medium text-[#a8b0ab]">Присоединиться</span>
            </span>
          </span>
        </button>
      </div>

      {isJoinOpen ? (
        <section className="rounded-2xl bg-[#151716] p-3 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.055)]">
          <div className="flex gap-2">
            <input
              aria-label="Код приглашения"
              className={cn(virtualInputClassName, "mt-0 min-h-11 flex-1 rounded-xl px-4 text-center text-sm font-semibold uppercase tracking-[0.2em]")}
              maxLength={8}
              placeholder="AB12CD34"
              value={joinCode}
              onChange={(event) => onJoinCodeChange(event.target.value.toUpperCase().replace(/\s+/g, ""))}
            />
            <Button
              className="min-h-11 shrink-0 rounded-xl bg-[#4edea3] px-4 text-[#04130d] shadow-none hover:bg-[#67edb3]"
              disabled={joinCode.trim().length === 0}
              onClick={onJoinSubmit}
            >
              Войти
            </Button>
          </div>
        </section>
      ) : null}

      <button
        className="min-h-[72px] w-full rounded-2xl bg-[#151716] px-3 py-3 text-left text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.055),0_12px_28px_rgba(0,0,0,0.24)]"
        type="button"
        onClick={onOpenTables}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#4edea3] shadow-[inset_0_0_0_2px_rgba(78,222,163,0.45)]">
            <span className="material-symbols-outlined text-[23px]">travel_explore</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold leading-tight">Найти открытые столы</p>
            <p className="mt-1 truncate text-xs font-medium text-[#a8b0ab]">Столы, куда можно сесть сейчас</p>
          </div>
          <span className="material-symbols-outlined text-[22px] text-white/55">search</span>
        </div>
      </button>
    </div>
  );
}

export function OpenVirtualTablesScreen({
  tables,
  isLoading = false,
  errorMessage = null,
  joiningTableId = null,
  onRefresh,
  onJoinTable
}: OpenVirtualTablesScreenProps): JSX.Element {
  return (
    <div className={virtualScreenClassName}>
      <div className="mx-auto max-w-4xl space-y-4 pb-[calc(env(safe-area-inset-bottom)+7rem)]">
        <section className="relative overflow-hidden rounded-[22px] bg-[#151716] p-4 shadow-[0_18px_42px_rgba(0,0,0,0.34),inset_0_1px_0_rgba(255,255,255,0.035)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(78,222,163,0.18),transparent_36%),linear-gradient(135deg,rgba(14,42,29,0.65),rgba(10,12,11,0.92))]" />
          <div className="relative flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#4edea3]">Открытые столы</p>
              <h1 className="mt-2 text-2xl font-semibold leading-tight text-white">Найдите игру</h1>
              <p className="mt-2 max-w-[22rem] text-sm leading-6 text-[#a8b0ab]">
                Только публичные столы, где еще есть свободные места.
              </p>
            </div>
            <Button
              className="shrink-0 border border-white/[0.06] bg-[#171818] text-white shadow-none hover:bg-[#202121]"
              disabled={isLoading}
              onClick={onRefresh}
            >
              <span className="material-symbols-outlined text-[18px]">refresh</span>
            </Button>
          </div>
        </section>

        {errorMessage ? (
          <div className="rounded-2xl bg-[#3a1515]/70 px-4 py-3 text-sm text-[#ffb4ab]">
            {errorMessage}
          </div>
        ) : null}

        {isLoading && tables.length === 0 ? (
          <VisualEmptyState
            compact
            description="Смотрим, какие столы сейчас ждут игроков."
            title="Загружаем столы"
          />
        ) : tables.length === 0 ? (
          <VisualEmptyState
            compact
            description="Публичные столы появятся здесь, когда кто-то создаст игру без приватного режима."
            title="Открытых столов пока нет"
          />
        ) : (
          <div className="space-y-3">
            {tables.map((table) => (
              <OpenVirtualTableRow
                key={table.id}
                isJoining={joiningTableId === table.id}
                table={table}
                onJoin={() => onJoinTable(table.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function OpenVirtualTableRow({
  table,
  isJoining,
  onJoin
}: {
  table: OpenVirtualTableListItemDto;
  isJoining: boolean;
  onJoin: () => void;
}): JSX.Element {
  return (
    <button
      className="w-full rounded-[22px] bg-[#151716] px-4 py-4 text-left text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.045),0_14px_34px_rgba(0,0,0,0.26)] transition hover:bg-[#19201c] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4edea3]"
      disabled={isJoining}
      type="button"
      onClick={onJoin}
    >
      <div className="flex items-center gap-3">
        <img
          alt=""
          className="h-14 w-14 shrink-0 rounded-2xl object-cover"
          src={resolveMiniAppVisual("online")}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-lg font-semibold leading-tight">{table.title}</p>
            {table.winProbabilityEnabled ? <RolePill tone="positive">шанс</RolePill> : null}
          </div>
          <p className="mt-1 truncate text-sm text-[#a8b0ab]">
            {formatSeatCount(table.seatsCount, table.maxSeats)} · {formatBlindPair(table.smallBlindChips, table.bigBlindChips)}
          </p>
          <p className="mt-1 truncate text-xs text-[#777f7a]">
            {formatVirtualChips(table.startingStackChips)} · {formatDurationMinutes(table.turnDurationSeconds)} · {table.ownerDisplayName}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-[#4edea3] px-4 py-2 text-sm font-semibold text-[#04130d]">
          {isJoining ? "Садимся" : "Сесть"}
        </span>
      </div>
    </button>
  );
}

export function CreateVirtualTableScreen({
  values,
  clubs,
  isLoadingClubs = false,
  validationMessage,
  isSubmitting = false,
  onChange,
  onSubmit
}: CreateVirtualTableScreenProps): JSX.Element {
  return (
    <div className={virtualScreenClassName}>
      <div className="mx-auto max-w-4xl space-y-4 pb-8">
        <header className="glass-card rounded-2xl bg-card p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent/12 text-accent">
              <span className="material-symbols-outlined text-[25px]">playing_cards</span>
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#93a099]">Новый стол</p>
              <h1 className="mt-1 text-[1.45rem] font-semibold leading-tight text-white">Создать стол</h1>
            </div>
            <span className="ml-auto">
              <RolePill tone="positive">Холдем</RolePill>
            </span>
          </div>
        </header>

        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="md:col-span-2">
              <FieldLabel detail={`${values.title.length}/40`}>Название стола</FieldLabel>
              <input
                className={virtualInputClassName}
                maxLength={40}
                placeholder="Например, Вечерний NLH"
                value={values.title}
                onChange={(event) => onChange("title", event.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <NumericField
              detail="Игроков"
              label="Мест за столом"
              placeholder="6"
              value={values.maxSeats}
              onChange={(value) => onChange("maxSeats", value)}
            />
            <NumericField
              detail="Фишек"
              label="Стартовый стек"
              placeholder="10000"
              value={values.startingStackChips}
              onChange={(value) => onChange("startingStackChips", value)}
            />
            <NumericField
              detail="Фишек за 1 ₽"
              label="Курс"
              placeholder="100"
              value={values.chipsPerCurrencyUnit}
              onChange={(value) => onChange("chipsPerCurrencyUnit", value)}
            />
            <NumericField
              detail="BB"
              label="Большой блайнд"
              placeholder="100"
              value={values.bigBlindChips}
              onChange={(value) => onChange("bigBlindChips", value)}
            />
            <ReadonlyMetric
              detail="SB"
              label="Малый блайнд"
              value={deriveSmallBlindChips(values.bigBlindChips) || "—"}
            />
            <NumericField
              detail="Секунд"
              label="Время на ход"
              placeholder="30"
              value={values.turnDurationSeconds}
              onChange={(value) => onChange("turnDurationSeconds", value)}
            />
            <NumericField
              detail="Секунд"
              label="Напоминание"
              placeholder="15"
              value={values.reminderDelaySeconds}
              onChange={(value) => onChange("reminderDelaySeconds", value)}
            />
          </div>

          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white/[0.025] px-4 py-3">
              <div>
                <p className={virtualSectionTitleClassName}>Стек и курс</p>
                <p className="mt-1 text-sm text-[#8e9192]">
                  {getChipValueMinorPreview(values.chipsPerCurrencyUnit)
                    ? `${formatStackReference(
                        values.startingStackChips || "0",
                        getChipValueMinorPreview(values.chipsPerCurrencyUnit),
                        "RUB"
                      )} · ${formatVirtualChipsRate(values.chipsPerCurrencyUnit)}`
                    : formatVirtualChips(values.startingStackChips || "0")}
                </p>
              </div>
              <RolePill>{values.bigBlindChips || "—"} BB</RolePill>
            </div>

            <div className="rounded-2xl bg-white/[0.025] px-4 py-3">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <FieldLabel>Показывать шанс выигрыша</FieldLabel>
                  <p className="mt-3 text-sm leading-6 text-[#8e9192]">
                    Каждый игрок увидит свой шанс по открытым картам.
                  </p>
                </div>
                <button
                  aria-checked={values.winProbabilityEnabled}
                  aria-label="Показывать шанс выигрыша"
                  className={cn(
                    "relative inline-flex h-8 w-14 shrink-0 rounded-full border transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4edea3]",
                    values.winProbabilityEnabled
                      ? "border-[#4edea3]/40 bg-[#173227]"
                      : "border-white/[0.06] bg-[#1b1c1c]"
                  )}
                  role="switch"
                  type="button"
                  onClick={() => onChange("winProbabilityEnabled", !values.winProbabilityEnabled)}
                >
                  <span
                    className={cn(
                      "absolute top-1 h-5 w-5 rounded-full bg-white shadow-[0_4px_10px_rgba(0,0,0,0.3)] transition-transform",
                      values.winProbabilityEnabled ? "translate-x-7" : "translate-x-1"
                    )}
                  />
                </button>
              </div>
            </div>

            <div className="rounded-2xl bg-white/[0.025] px-4 py-3">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <FieldLabel>Приватный матч</FieldLabel>
                  <p className="mt-3 text-sm leading-6 text-[#8e9192]">
                    Скрыт из открытых столов, вход только по коду.
                  </p>
                </div>
                <button
                  aria-checked={values.isPrivate}
                  aria-label="Приватный матч"
                  className={cn(
                    "relative inline-flex h-8 w-14 shrink-0 rounded-full border transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4edea3]",
                    values.isPrivate
                      ? "border-[#4edea3]/40 bg-[#173227]"
                      : "border-white/[0.06] bg-[#1b1c1c]"
                  )}
                  role="switch"
                  type="button"
                  onClick={() => onChange("isPrivate", !values.isPrivate)}
                >
                  <span
                    className={cn(
                      "absolute top-1 h-5 w-5 rounded-full bg-white shadow-[0_4px_10px_rgba(0,0,0,0.3)] transition-transform",
                      values.isPrivate ? "translate-x-7" : "translate-x-1"
                    )}
                  />
                </button>
              </div>
            </div>

            <div className="rounded-2xl bg-white/[0.025] px-4 py-3">
              <FieldLabel>Автодействие по таймауту</FieldLabel>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <ChoiceChip
                  active={values.timeoutAutoActionRule === "CHECK_OR_FOLD"}
                  description="Если можно чекнуть, система не сбросит руку раньше времени."
                  label="Чек или пас"
                  onClick={() => onChange("timeoutAutoActionRule", "CHECK_OR_FOLD")}
                />
                <ChoiceChip
                  active={values.timeoutAutoActionRule === "FOLD_ONLY"}
                  description="Стол быстрее двигается, если таймер всегда завершает ход пасом."
                  label="Только пас"
                  onClick={() => onChange("timeoutAutoActionRule", "FOLD_ONLY")}
                />
              </div>
              {validationMessage ? <p className="mt-4 text-sm text-[#ffb4ab]">{validationMessage}</p> : null}
            </div>

            <ClubSchedulingSection
              clubId={values.clubId ?? ""}
              clubs={clubs}
              description="Если стол привязан к клубу, участники получат приглашение и смогут ответить заранее."
              isLoadingClubs={isLoadingClubs}
              scheduledLabel="Когда запускаете стол"
              scheduledStartAt={values.scheduledStartAt ?? ""}
              sendNotifications={values.sendNotifications ?? true}
              title="Клуб и расписание"
              onClubIdChange={(value) => onChange("clubId", value)}
              onScheduledStartAtChange={(value) => onChange("scheduledStartAt", value)}
              onSendNotificationsChange={(value) => onChange("sendNotifications", value)}
            />

            <Button className="min-h-12 w-full" disabled={isSubmitting} onClick={onSubmit}>
              {isSubmitting ? "Создаем стол" : "Создать стол"}
              <span className="material-symbols-outlined text-[18px]">bolt</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function JoinVirtualTableScreen({
  inviteCode,
  title = "Войти по коду",
  description = "Введите 8-символьный код приглашения. Если стол уже вас ждет, откроем лобби сразу.",
  helperText,
  isSubmitting = false,
  onInviteCodeChange,
  onSubmit
}: JoinVirtualTableScreenProps): JSX.Element {
  const emptyCopy = getJoinEmptyCopy();

  return (
    <div className={virtualScreenClassName}>
      <div className="mx-auto flex max-w-xl flex-col gap-3 px-4 pb-[calc(env(safe-area-inset-bottom)+12rem)] pt-[calc(env(safe-area-inset-top)+0.125rem)]">
        <GlassPanel className="w-full space-y-4">
          <ScreenHeader eyebrow="Быстрый вход" title={title} description={description} />
          <div className="space-y-4">
            <FieldLabel detail="8 символов без пробелов">Код стола</FieldLabel>
            <input
              aria-label="Код стола"
              autoCapitalize="characters"
              className={cn(
                virtualInputClassName,
                "text-center font-['Hanken_Grotesk',Inter,sans-serif] text-[2rem] font-bold uppercase tracking-[0.26em]"
              )}
              inputMode="text"
              maxLength={8}
              placeholder="AB12CD34"
              value={inviteCode}
              onChange={(event) => onInviteCodeChange(event.target.value.toUpperCase().replace(/\s+/g, ""))}
            />
            <p className="text-sm leading-6 text-[#8e9192]">{helperText ?? emptyCopy.description}</p>
          </div>
        </GlassPanel>

        {inviteCode.trim().length === 0 ? (
          <VisualEmptyState
            compact
            description={emptyCopy.description}
            imageSrc={resolveMiniAppVisual("join-code")}
            title={emptyCopy.title}
          />
        ) : (
          <GlassPanel className="flex items-center justify-between gap-3">
            <div>
              <p className={virtualSectionTitleClassName}>Готово к проверке</p>
              <p className="mt-2 text-lg font-semibold text-white">{inviteCode}</p>
              <p className="mt-1 text-sm text-[#8e9192]">Проверим доступ и откроем стол.</p>
            </div>
            <RolePill tone="positive">Приглашение</RolePill>
          </GlassPanel>
        )}
      </div>

      <BottomActionBar
        primaryDisabled={isSubmitting || inviteCode.trim().length === 0}
        primaryIcon="login"
        primaryLabel={isSubmitting ? "Подключаем стол" : "Войти за стол"}
        onPrimaryAction={onSubmit}
      />
    </div>
  );
}

export function VirtualWaitingRoomScreen({
  table,
  seats,
  isStarting = false,
  isCancelling = false,
  canStart = false,
  canCancel = false,
  onCopyCode,
  onStartGame,
  onCancelTable,
  footer
}: WaitingRoomScreenProps): JSX.Element {
  return (
    <div className={virtualScreenClassName}>
      <div className="mx-auto max-w-3xl space-y-4 px-4 pb-[calc(env(safe-area-inset-bottom)+13rem)] pt-[calc(env(safe-area-inset-top)+5.25rem)]">
        <GlassPanel className="space-y-4">
          <ScreenHeader
            eyebrow={getTableStatusLabel(table.status)}
            title={table.title}
            description="Соберите состав и запускайте игру, когда все займут места."
            trailing={<RolePill tone={canStart ? "positive" : "neutral"}>{formatSeatCount(seats.length, table.maxSeats)}</RolePill>}
          />
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <div>
              <p className={virtualSectionTitleClassName}>Код стола</p>
              <p className="mt-2 font-['Hanken_Grotesk',Inter,sans-serif] text-2xl font-bold tracking-[0.18em] text-white">
                {table.inviteCode}
              </p>
            </div>
            <Button
              className="w-full border border-white/[0.06] bg-[#171818] text-white shadow-none hover:bg-[#202121] sm:w-auto"
              onClick={onCopyCode}
            >
              <span className="material-symbols-outlined text-[18px]">content_copy</span>
              Скопировать код
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <CompactMetric label="Стек" value={formatVirtualChips(table.startingStackChips)} />
            <CompactMetric label="Блайнды" value={formatBlindPair(table.smallBlindChips, table.bigBlindChips)} />
            <CompactMetric label="Таймер" value={formatDurationMinutes(table.turnDurationSeconds)} />
          </div>
        </GlassPanel>

        <GlassPanel>
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-xl font-semibold text-white">Состав игроков</p>
              <p className="mt-1 text-sm text-[#8e9192]">Стол можно запустить, когда все готовы к раздаче.</p>
            </div>
            <span className={virtualSectionTitleClassName}>{formatSeatCount(seats.length, table.maxSeats)}</span>
          </div>
          <div className="mt-4 space-y-3">
            {seats.map((seat) => (
              <SeatRow key={seat.id} seat={seat} />
            ))}
          </div>
        </GlassPanel>

        {footer}
      </div>

      <BottomActionBar
        caption={canStart ? "Минимум игроков уже собран" : "Открыть раздачу можно после сбора состава"}
        offset="screen"
        primaryDisabled={!canStart || isStarting}
        primaryIcon="play_circle"
        primaryLabel={isStarting ? "Запускаем игру" : "Начать игру"}
        {...(onStartGame ? { onPrimaryAction: onStartGame } : {})}
        secondaryAction={
          canCancel && onCancelTable ? (
            <Button
              className="min-h-12 w-full border border-white/[0.06] bg-[#171818] text-white shadow-none hover:bg-[#202121]"
              disabled={isCancelling}
              onClick={onCancelTable}
            >
              <span className="material-symbols-outlined text-[18px]">block</span>
              {isCancelling ? "Отменяем стол" : "Отменить стол"}
            </Button>
          ) : undefined
        }
      />
    </div>
  );
}

function TableCollectionSection({
  title,
  tables,
  empty,
  footer,
  onOpenTable
}: {
  title: string;
  tables: VirtualTablesListItemDto[];
  empty: { title: string; description: string };
  footer?: ReactNode;
  onOpenTable?: (tableId: string) => void;
}): JSX.Element {
  return (
    <SectionStack>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-white">{title}</h2>
        <RolePill>{tables.length}</RolePill>
      </div>

      {tables.length === 0 ? (
        <VisualEmptyState
          compact
          description={empty.description}
          title={empty.title}
        />
      ) : (
        <div className="space-y-3">
          {tables.map((table) => (
            <TableCard key={table.id} table={table} {...(onOpenTable ? { onOpenTable } : {})} />
          ))}
        </div>
      )}
      {footer}
    </SectionStack>
  );
}

function TableCard({
  table,
  onOpenTable
}: {
  table: VirtualTablesListItemDto;
  onOpenTable?: (tableId: string) => void;
}): JSX.Element {
  const isWaiting = table.status === "WAITING_FOR_PLAYERS";
  const isActive = table.status === "ACTIVE" || table.status === "PAUSED";
  const mainValue =
    table.status === "ACTIVE"
      ? formatVirtualChips(table.potTotalChips)
      : formatVirtualChips(table.myStackChips ?? table.startingStackChips);
  const activeStackValue =
    table.status === "ACTIVE" || table.status === "PAUSED" || table.status === "WAITING_FOR_PLAYERS"
      ? formatVirtualChips(table.myStackChips ?? table.startingStackChips)
      : mainValue;

  return (
    <CompactGameRow
      detail={`${formatBlindPair(table.smallBlindChips, table.bigBlindChips)} · ${formatDurationMinutes(table.turnDurationSeconds)}`}
      imageSrc={resolveMiniAppVisual(isWaiting ? "join-code" : "online")}
      statusLabel={getTableStatusLabel(table.status)}
      statusTone={isActive ? "success" : isWaiting ? "warning" : "neutral"}
      subtitle={`${formatSeatCount(table.seatsCount, table.maxSeats)} · код ${table.inviteCode}`}
      title={table.title}
      {...(onOpenTable ? { onClick: () => onOpenTable(table.id) } : {})}
      value={activeStackValue}
    />
  );
}

function CompactMetric({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 py-3">
      <p className={virtualSectionTitleClassName}>{label}</p>
      <p className="mt-1 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

function ReadonlyMetric({
  label,
  detail,
  value
}: {
  label: string;
  detail?: string;
  value: string;
}): JSX.Element {
  return (
    <div className="rounded-2xl bg-white/[0.035] p-4">
      <FieldLabel detail={detail}>{label}</FieldLabel>
      <div className="mt-3 rounded-xl bg-white/[0.035] px-3 py-3 text-lg font-semibold text-white">
        {value}
      </div>
    </div>
  );
}

function NumericField({
  label,
  detail,
  value,
  placeholder,
  onChange
}: {
  label: string;
  detail?: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}): JSX.Element {
  return (
    <div className="rounded-2xl bg-white/[0.035] p-4">
      <FieldLabel detail={detail}>{label}</FieldLabel>
      <input
        className={virtualInputClassName}
        inputMode="numeric"
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value.replace(/[^\d]/g, ""))}
      />
    </div>
  );
}

function ChoiceChip({
  label,
  description,
  active,
  onClick
}: {
  label: string;
  description: string;
  active: boolean;
  onClick: () => void;
}): JSX.Element {
  return (
    <button
      className={cn(
        "rounded-xl px-4 py-4 text-left transition",
        active
          ? "bg-[#4edea3]/12 text-white shadow-[inset_0_0_0_1px_rgba(78,222,163,0.12)]"
          : "bg-white/[0.025] text-[#c4c7c8] hover:bg-white/[0.04]"
      )}
      type="button"
      onClick={onClick}
    >
      <p className="text-sm font-semibold">{label}</p>
      <p className="mt-2 text-sm leading-6 text-[#8e9192]">{description}</p>
    </button>
  );
}

function SeatRow({ seat }: { seat: VirtualSeatDto }): JSX.Element {
  const roleTone = seat.role === "OWNER" || seat.role === "ADMIN" ? "positive" : "neutral";
  const statusTone = seat.status === "LEFT" || seat.status === "NO_CHIPS" ? "negative" : "neutral";

  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/[0.06] bg-[#171818]/92 px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      <div className="flex min-w-0 items-center gap-3">
        <AvatarInitials name={seat.displayName ?? `Seat ${seat.seatNumber}`} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">{seat.displayName ?? `Игрок ${seat.seatNumber}`}</p>
          <p className="mt-1 text-sm text-[#8e9192]">
            Место {seat.seatNumber} · {formatVirtualChips(seat.stackChips)}
          </p>
        </div>
      </div>
      <div className="flex flex-col items-end gap-2">
        <RolePill tone={roleTone}>
          {seat.role === "OWNER" ? "Создатель" : seat.role === "ADMIN" ? "Помогает вести стол" : "За столом"}
        </RolePill>
        <RolePill tone={statusTone}>{getSeatStatusLabel(seat.status)}</RolePill>
      </div>
    </div>
  );
}

function getChipValueMinorPreview(chipsPerCurrencyUnit: string): string | null {
  if (!/^\d+$/.test(chipsPerCurrencyUnit.trim())) {
    return null;
  }

  try {
    return convertChipsPerCurrencyUnitToChipValueMinor(chipsPerCurrencyUnit);
  } catch {
    return null;
  }
}

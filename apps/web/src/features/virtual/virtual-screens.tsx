import { useState, type JSX, type ReactNode } from "react";
import type {
  VirtualSeatDto,
  VirtualTableDto,
  VirtualTablesListItemDto
} from "@pokertable/shared";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  AvatarInitials,
  BottomActionBar,
  EmptyState,
  FieldLabel,
  GlassPanel,
  RolePill,
  SectionStack,
  StatBlock,
  formatBlindPair,
  formatDurationMinutes,
  formatSeatCount,
  formatStackReference,
  formatVirtualChips,
  formatVirtualChipsWithHint,
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
  type CreateVirtualTableFormValues
} from "./virtual-table-form";

type LobbyScreenProps = {
  myTables: VirtualTablesListItemDto[];
  activeTables: VirtualTablesListItemDto[];
  waitingTables: VirtualTablesListItemDto[];
  recentTables: VirtualTablesListItemDto[];
  joinCode: string;
  onJoinCodeChange: (value: string) => void;
  onJoinSubmit: () => void;
  onCreateTable: () => void;
  onOpenTable?: (tableId: string) => void;
};

type CreateVirtualTableScreenProps = {
  values: CreateVirtualTableFormValues;
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
  joinCode,
  onJoinCodeChange,
  onJoinSubmit,
  onCreateTable,
  onOpenTable
}: LobbyScreenProps): JSX.Element {
  const [recentLimit, setRecentLimit] = useState(RECENT_TABLES_PAGE_SIZE);
  const visibleRecentTables = recentTables.slice(0, recentLimit);
  const currentTables = myTables.filter(
    (table) => table.status === "ACTIVE" || table.status === "PAUSED" || table.status === "WAITING_FOR_PLAYERS"
  );

  return (
    <div className={virtualScreenClassName}>
      <div className="mx-auto max-w-4xl space-y-6 pb-8">
        <section>
          <GlassPanel className="flex flex-col justify-between gap-4">
            <div>
              <Button className="w-full" onClick={onCreateTable}>
                Создать стол
                <span className="material-symbols-outlined text-[18px]">add_circle</span>
              </Button>
            </div>
            <div>
              <FieldLabel detail="8 символов">Быстрый вход по коду</FieldLabel>
              <input
                aria-label="Код приглашения"
                className={cn(virtualInputClassName, "mt-4 text-center text-xl font-semibold uppercase tracking-[0.28em]")}
                maxLength={8}
                placeholder="AB12CD34"
                value={joinCode}
                onChange={(event) => onJoinCodeChange(event.target.value.toUpperCase())}
              />
            </div>
            <Button className="w-full" disabled={joinCode.trim().length === 0} onClick={onJoinSubmit}>
              Присоединиться
              <span className="material-symbols-outlined text-[18px]">login</span>
            </Button>
          </GlassPanel>
        </section>

        <TableCollectionSection
          empty={{
            title: "Пока нет онлайн-столов",
            description: "Создайте новый стол или войдите по коду, когда вас пригласят."
          }}
          tables={currentTables}
          title="Мои столы"
          {...(onOpenTable ? { onOpenTable } : {})}
        />

        <TableCollectionSection
          empty={getLobbyEmptyCopy("recent")}
          footer={
            recentTables.length > visibleRecentTables.length ? (
              <Button
                className="w-full border border-white/10 bg-[#1d1c1c] text-white shadow-none hover:bg-[#262525]"
                onClick={() => setRecentLimit((current) => current + RECENT_TABLES_PAGE_SIZE)}
              >
                Показать ещё
              </Button>
            ) : null
          }
          tables={visibleRecentTables}
          title="Недавно завершились"
          {...(onOpenTable ? { onOpenTable } : {})}
        />
      </div>
    </div>
  );
}

export function CreateVirtualTableScreen({
  values,
  validationMessage,
  isSubmitting = false,
  onChange,
  onSubmit
}: CreateVirtualTableScreenProps): JSX.Element {
  return (
    <div className={virtualScreenClassName}>
      <div className="mx-auto max-w-4xl space-y-6 pb-8 pt-[calc(env(safe-area-inset-top)+0.25rem)]">
        <div>
          <p className={virtualSectionTitleClassName}>Новый стол</p>
          <h1 className="mt-2 text-[2rem] font-bold leading-none text-white">Создать стол</h1>
        </div>

        <SectionStack className="grid gap-3 md:grid-cols-2">
          <GlassPanel className="md:col-span-2">
            <FieldLabel detail={`${values.title.length}/40`}>Название стола</FieldLabel>
            <input
              className={virtualInputClassName}
              maxLength={40}
              placeholder="Например, Вечерний NLH"
              value={values.title}
              onChange={(event) => onChange("title", event.target.value)}
            />
          </GlassPanel>

          <StatBlock
            hint="Формат виртуальной сессии"
            label="Режим"
            tone="positive"
            value="Онлайн-покер"
          />
          <StatBlock
            hint="1 ₽ = N фишек"
            label="Курс"
            value={formatVirtualChipsRate(values.chipsPerCurrencyUnit)}
          />
        </SectionStack>

        <SectionStack className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
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
            detail="SB"
            label="Малый блайнд"
            placeholder="50"
            value={values.smallBlindChips}
            onChange={(value) => onChange("smallBlindChips", value)}
          />
          <NumericField
            detail="BB"
            label="Большой блайнд"
            placeholder="100"
            value={values.bigBlindChips}
            onChange={(value) => onChange("bigBlindChips", value)}
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
        </SectionStack>

        <GlassPanel>
          <FieldLabel detail="RUB">Стек и курс</FieldLabel>
          <p className="mt-3 text-sm text-[#8e9192]">
            {getChipValueMinorPreview(values.chipsPerCurrencyUnit)
              ? `${formatStackReference(
                  values.startingStackChips || "0",
                  getChipValueMinorPreview(values.chipsPerCurrencyUnit),
                  "RUB"
                )} · ${formatVirtualChipsRate(values.chipsPerCurrencyUnit)}`
              : formatVirtualChips(values.startingStackChips || "0")}
          </p>
        </GlassPanel>

        <GlassPanel>
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
                  : "border-white/10 bg-[#202020]"
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
        </GlassPanel>

        <GlassPanel>
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
        </GlassPanel>

        <Button className="min-h-12 w-full" disabled={isSubmitting} onClick={onSubmit}>
          {isSubmitting ? "Создаем стол" : "Создать стол"}
          <span className="material-symbols-outlined text-[18px]">bolt</span>
        </Button>
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
      <div className="mx-auto flex max-w-xl flex-col gap-6 pt-[calc(env(safe-area-inset-top)+0.25rem)]">
        <div>
          <p className={virtualSectionTitleClassName}>Быстрый вход</p>
          <h1 className="mt-2 text-[2rem] font-bold leading-none text-white">{title}</h1>
          <p className="mt-3 text-sm leading-6 text-[#c4c7c8]">{description}</p>
        </div>

        <GlassPanel className="space-y-4">
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
        </GlassPanel>

        {inviteCode.trim().length === 0 ? (
          <EmptyState description={emptyCopy.description} icon="key" title={emptyCopy.title} />
        ) : (
          <GlassPanel>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className={virtualSectionTitleClassName}>Готово к проверке</p>
                <p className="mt-2 text-xl font-semibold text-white">{inviteCode}</p>
              </div>
              <RolePill tone="positive">Приглашение</RolePill>
            </div>
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
      <div className="mx-auto max-w-3xl space-y-6 px-4 pb-[calc(env(safe-area-inset-bottom)+13rem)] pt-[calc(env(safe-area-inset-top)+5.25rem)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className={virtualSectionTitleClassName}>{getTableStatusLabel(table.status)}</p>
            <h1 className="mt-2 text-[2rem] font-bold leading-none text-white">{table.title}</h1>
            <p className="mt-3 text-sm leading-6 text-[#c4c7c8]">
              Соберите состав и запускайте игру, когда все займут места.
            </p>
          </div>
          <RolePill tone={canStart ? "positive" : "neutral"}>{formatSeatCount(seats.length, table.maxSeats)}</RolePill>
        </div>

        <section className="grid gap-3">
          <GlassPanel className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className={virtualSectionTitleClassName}>Код стола</p>
                <p className="mt-2 font-['Hanken_Grotesk',Inter,sans-serif] text-[2rem] font-bold uppercase tracking-[0.18em] text-white">
                  {table.inviteCode}
                </p>
              </div>
              <Button className="min-h-11 bg-[#252525] px-4 text-white shadow-none hover:bg-[#2d2d2d]" onClick={onCopyCode}>
                <span className="material-symbols-outlined text-[18px]">content_copy</span>
                Код
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <CompactMetric label="Стек" value={formatVirtualChips(table.startingStackChips)} />
              <CompactMetric label="Блайнды" value={formatBlindPair(table.smallBlindChips, table.bigBlindChips)} />
              <CompactMetric label="Таймер" value={formatDurationMinutes(table.turnDurationSeconds)} />
            </div>
          </GlassPanel>
        </section>

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
              className="min-h-12 w-full border border-white/10 bg-[#1d1c1c] text-white shadow-none hover:bg-[#262525]"
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
        <div>
          <h2 className="text-xl font-semibold text-white">{title}</h2>
        </div>
        <RolePill>{tables.length}</RolePill>
      </div>

      {tables.length === 0 ? (
        <EmptyState description={empty.description} icon="view_cozy" title={empty.title} />
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
  const mainValue =
    table.status === "ACTIVE"
      ? formatVirtualChipsWithHint(table.potTotalChips, table.chipValueMinor, table.chipValueCurrency)
      : formatVirtualChipsWithHint(table.startingStackChips, table.chipValueMinor, table.chipValueCurrency);

  return (
    <GlassPanel className="py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <RolePill tone={table.status === "ACTIVE" ? "positive" : "neutral"}>
              {getTableStatusLabel(table.status)}
            </RolePill>
            <span className="text-[11px] uppercase tracking-[0.2em] text-[#8e9192]">{table.inviteCode}</span>
          </div>
          <h3 className="mt-2 truncate text-base font-semibold text-white">{table.title}</h3>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#8e9192]">
            <span>{formatSeatCount(table.seatsCount, table.maxSeats)}</span>
            <span>{formatBlindPair(table.smallBlindChips, table.bigBlindChips)}</span>
            <span>{formatDurationMinutes(table.turnDurationSeconds)}</span>
            <span className="text-[#c4c7c8]">{mainValue}</span>
          </div>
        </div>
        {onOpenTable ? (
          <Button className="min-h-10 shrink-0 px-4" onClick={() => onOpenTable(table.id)}>
            Открыть
            <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
          </Button>
        ) : null}
      </div>
    </GlassPanel>
  );
}

function CompactMetric({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-3">
      <p className={virtualSectionTitleClassName}>{label}</p>
      <p className="mt-1 text-sm font-semibold text-white">{value}</p>
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
    <GlassPanel>
      <FieldLabel detail={detail}>{label}</FieldLabel>
      <input
        className={virtualInputClassName}
        inputMode="numeric"
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value.replace(/[^\d]/g, ""))}
      />
    </GlassPanel>
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
        "rounded-xl border px-4 py-4 text-left transition",
        active
          ? "border-[#4edea3]/40 bg-[#4edea3]/12 text-white"
          : "border-white/10 bg-white/[0.03] text-[#c4c7c8] hover:bg-white/[0.05]"
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
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#1d1c1c]/90 px-3 py-3">
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

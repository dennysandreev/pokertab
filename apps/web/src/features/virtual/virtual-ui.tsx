import type { HTMLAttributes, JSX, ReactNode } from "react";
import { chipsToMoneyMinor, formatChips, formatMinorMoney } from "@pokertable/shared";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const virtualScreenClassName =
  "min-h-[100dvh] bg-[#0f0f0f] pb-[calc(env(safe-area-inset-bottom)+11rem)] pt-4 text-white";

export const virtualInputClassName =
  "mt-3 min-h-12 w-full rounded-xl border border-white/10 bg-[#1c1b1b] px-4 py-3 text-[15px] text-white outline-none transition placeholder:text-[#7f8487] focus:border-[#4edea3] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4edea3]";

export const virtualSectionTitleClassName =
  "text-[11px] font-semibold uppercase tracking-[0.24em] text-[#8e9192]";

export type Tone = "positive" | "neutral" | "negative";

type GlassPanelProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
};

type StatBlockProps = {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: Tone;
  className?: string;
};

type EmptyStateProps = {
  title: string;
  description: string;
  icon?: string;
  action?: ReactNode;
};

type ScreenHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  trailing?: ReactNode;
};

type BottomActionBarProps = {
  primaryLabel: string;
  primaryIcon?: string;
  onPrimaryAction?: () => void;
  primaryDisabled?: boolean;
  secondaryAction?: ReactNode;
  caption?: string;
  offset?: "app-nav" | "screen";
};

type ConfirmationModalProps = {
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  isConfirming?: boolean;
};

export function GlassPanel({ children, className, ...props }: GlassPanelProps): JSX.Element {
  return (
    <div
      className={cn(
        "rounded-2xl border border-white/10 bg-[#1a1a1a]/80 p-4 shadow-[0_18px_60px_rgba(0,0,0,0.28)] backdrop-blur-[20px]",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function ScreenHeader({
  eyebrow,
  title,
  description,
  trailing
}: ScreenHeaderProps): JSX.Element {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        {eyebrow ? <p className={virtualSectionTitleClassName}>{eyebrow}</p> : null}
        <h1 className="mt-2 font-['Hanken_Grotesk',Inter,sans-serif] text-[2rem] font-bold leading-none text-white">
          {title}
        </h1>
        {description ? (
          <p className="mt-3 max-w-[34rem] text-sm leading-6 text-[#c4c7c8]">{description}</p>
        ) : null}
      </div>
      {trailing ? <div className="shrink-0">{trailing}</div> : null}
    </div>
  );
}

export function StatBlock({
  label,
  value,
  hint,
  tone = "neutral",
  className
}: StatBlockProps): JSX.Element {
  return (
    <GlassPanel className={cn("flex min-h-[7.5rem] flex-col justify-between", className)}>
      <span className={virtualSectionTitleClassName}>{label}</span>
      <div>
        <div className={cn("text-[1.45rem] font-semibold leading-tight", getToneTextClassName(tone))}>
          {value}
        </div>
        {hint ? <div className="mt-2 text-sm text-[#8e9192]">{hint}</div> : null}
      </div>
    </GlassPanel>
  );
}

export function AvatarInitials({
  name,
  className
}: {
  name: string;
  className?: string;
}): JSX.Element {
  const initials = getAvatarInitials(name);

  return (
    <div
      aria-label={`Аватар ${name}`}
      className={cn(
        "flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-[#232222] font-semibold text-[#f3f4f4]",
        className
      )}
    >
      <span className="text-sm tracking-[0.08em]">{initials}</span>
    </div>
  );
}

export function RolePill({
  children,
  tone = "neutral"
}: {
  children: ReactNode;
  tone?: Tone;
}): JSX.Element {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em]",
        tone === "positive" && "border-[#4edea3]/30 bg-[#4edea3]/10 text-[#4edea3]",
        tone === "negative" && "border-[#ff8b8b]/25 bg-[#ff8b8b]/10 text-[#ffb4ab]",
        tone === "neutral" && "border-white/10 bg-white/[0.03] text-[#c4c7c8]"
      )}
    >
      {children}
    </span>
  );
}

export function EmptyState({
  title,
  description,
  icon = "ink_pen",
  action
}: EmptyStateProps): JSX.Element {
  return (
    <GlassPanel className="flex min-h-[12rem] flex-col items-center justify-center text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#4edea3]/12 text-[#4edea3]">
        <span className="material-symbols-outlined text-[22px]">{icon}</span>
      </div>
      <h2 className="mt-4 text-lg font-semibold text-white">{title}</h2>
      <p className="mt-2 max-w-[22rem] text-sm leading-6 text-[#8e9192]">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </GlassPanel>
  );
}

export function BottomActionBar({
  primaryLabel,
  primaryIcon = "arrow_forward",
  onPrimaryAction,
  primaryDisabled = false,
  secondaryAction,
  caption,
  offset = "app-nav"
}: BottomActionBarProps): JSX.Element {
  return (
    <div
      className={cn(
        "pointer-events-none fixed inset-x-0 z-20 bg-gradient-to-t from-[#0f0f0f] via-[#0f0f0f] to-transparent px-4 pb-4 pt-4",
        offset === "app-nav"
          ? "bottom-[calc(env(safe-area-inset-bottom)+5.75rem)]"
          : "bottom-[calc(env(safe-area-inset-bottom)+1rem)]"
      )}
    >
      <div className="pointer-events-auto mx-auto flex w-full max-w-3xl flex-col gap-3">
        {secondaryAction}
        <Button className="w-full min-h-14 text-base font-bold" disabled={primaryDisabled} onClick={onPrimaryAction}>
          {primaryLabel}
          <span className="material-symbols-outlined text-[18px]">{primaryIcon}</span>
        </Button>
        {caption ? (
          <p className="text-center text-xs text-[#8e9192]">{caption}</p>
        ) : null}
      </div>
    </div>
  );
}

export function ConfirmationModal({
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  isConfirming = false
}: ConfirmationModalProps): JSX.Element {
  return (
    <div className="fixed inset-0 z-[90] bg-black/80 backdrop-blur-sm" onClick={onCancel}>
      <div
        className="absolute inset-x-4 bottom-0 mx-auto max-w-md rounded-t-[1.75rem] border border-white/10 bg-[#171717]/96 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4">
          <div className="mx-auto h-1.5 w-14 rounded-full bg-white/10" />
          <h3 className="mt-4 text-xl font-semibold text-white">{title}</h3>
          <p className="mt-3 text-sm leading-6 text-[#c4c7c8]">{description}</p>
          <div className="mt-5 flex flex-col gap-3">
            <Button className="min-h-12 w-full" disabled={isConfirming} onClick={onConfirm}>
              {isConfirming ? "Завершаем" : confirmLabel}
            </Button>
            <Button
              className="min-h-12 w-full border border-white/10 bg-[#1d1c1c] text-white shadow-none hover:bg-[#262525]"
              disabled={isConfirming}
              onClick={onCancel}
            >
              {cancelLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function FieldLabel({
  children,
  detail
}: {
  children: ReactNode;
  detail?: ReactNode;
}): JSX.Element {
  return (
    <div className="flex items-center justify-between gap-3">
      <label className={virtualSectionTitleClassName}>{children}</label>
      {detail ? <span className="text-xs text-[#4edea3]">{detail}</span> : null}
    </div>
  );
}

export function InlineMetric({
  label,
  value,
  tone = "neutral"
}: {
  label: string;
  value: ReactNode;
  tone?: Tone;
}): JSX.Element {
  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.03] px-3 py-3">
      <p className={virtualSectionTitleClassName}>{label}</p>
      <p className={cn("mt-2 text-base font-semibold", getToneTextClassName(tone))}>{value}</p>
    </div>
  );
}

export function SectionStack({ children, className }: { children: ReactNode; className?: string }): JSX.Element {
  return <section className={cn("space-y-4", className)}>{children}</section>;
}

export function formatVirtualChips(value: string | number | bigint): string {
  return `${formatChips(value)} фишек`;
}

export function formatVirtualSignedChips(value: string | number | bigint): string {
  const amount = typeof value === "bigint" ? value : BigInt(value);
  const sign = amount > 0n ? "+" : amount < 0n ? "-" : "";
  const absolute = amount < 0n ? amount * -1n : amount;

  return `${sign}${formatChips(absolute)}`;
}

export function formatVirtualMoneyHint(
  chips: string | number | bigint,
  chipValueMinor?: string | null,
  currency?: string | null
): string | null {
  if (!chipValueMinor || !currency) {
    return null;
  }

  return `~${formatMinorMoney(calculateVirtualMinor(chips, chipValueMinor), currency)}`;
}

export function calculateVirtualMinor(
  chips: string | number | bigint,
  chipValueMinor: string | number | bigint
): string {
  const chipAmount = typeof chips === "bigint" ? chips : BigInt(chips);
  const perChipMinor = typeof chipValueMinor === "bigint" ? chipValueMinor : BigInt(chipValueMinor);

  return (chipAmount * perChipMinor).toString();
}

export function formatVirtualChipsWithHint(
  chips: string | number | bigint,
  chipValueMinor?: string | null,
  currency?: string | null
): string {
  const primary = formatVirtualChips(chips);
  const hint = formatVirtualMoneyHint(chips, chipValueMinor, currency);

  return hint ? `${primary} (${hint})` : primary;
}

export function formatSeatCount(value: number, maxSeats: number): string {
  return `${value} / ${maxSeats}`;
}

export function formatBlindPair(smallBlindChips: string, bigBlindChips: string): string {
  return `${formatChips(smallBlindChips)} / ${formatChips(bigBlindChips)}`;
}

export function formatDurationMinutes(seconds: number): string {
  const minutes = Math.max(1, Math.round(seconds / 60));
  return `${minutes} мин`;
}

export function getAvatarInitials(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) {
    return "??";
  }

  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
}

export function getVirtualResultTone(value: string | number | bigint): Tone {
  const amount = typeof value === "bigint" ? value : BigInt(value);

  if (amount > 0n) {
    return "positive";
  }

  if (amount < 0n) {
    return "negative";
  }

  return "neutral";
}

export function getTableStatusLabel(status: string): string {
  switch (status) {
    case "WAITING_FOR_PLAYERS":
      return "Ожидание игроков";
    case "ACTIVE":
      return "Игра идет";
    case "PAUSED":
      return "Пауза";
    case "FINISHED":
      return "Завершен";
    case "CANCELLED":
      return "Отменен";
    default:
      return status;
  }
}

export function getSeatStatusLabel(status: string): string {
  switch (status) {
    case "ACTIVE":
      return "В игре";
    case "WAITING_FOR_TURN":
      return "Ждет ход";
    case "ACTING":
      return "Думает";
    case "FOLDED":
      return "Пас";
    case "ALL_IN":
      return "Олл-ин";
    case "SIT_OUT_REQUESTED":
      return "Собирается выйти";
    case "SITTING_OUT":
      return "Сидит вне игры";
    case "RETURN_REQUESTED":
      return "Возвращается";
    case "LEFT":
      return "Покинул стол";
    case "NO_CHIPS":
      return "Без фишек";
    default:
      return status;
  }
}

export function getStreetLabel(street: string): string {
  switch (street) {
    case "PRE_FLOP":
      return "Префлоп";
    case "FLOP":
      return "Флоп";
    case "TURN":
      return "Терн";
    case "RIVER":
      return "Ривер";
    case "SHOWDOWN":
      return "Шоудаун";
    default:
      return street;
  }
}

export function getJoinEmptyCopy(): { title: string; description: string } {
  return {
    title: "Код приглашения еще не добавлен",
    description: "Введите 8-символьный код стола, и мы сразу проверим, можно ли занять место."
  };
}

export function getLobbyEmptyCopy(kind: "active" | "waiting" | "recent"): {
  title: string;
  description: string;
} {
  switch (kind) {
    case "active":
      return {
        title: "Пока нет активных столов",
        description: "Как только игра начнется, здесь появятся столы, к которым можно быстро вернуться."
      };
    case "waiting":
      return {
        title: "Новых лобби пока нет",
        description: "Создайте стол или зайдите по коду, чтобы собрать следующую игру."
      };
    case "recent":
      return {
        title: "История еще пустая",
        description: "Завершенные виртуальные столы появятся здесь вместе с последними результатами."
      };
    default:
      return {
        title: "Пусто",
        description: ""
      };
  }
}

export function formatVirtualRate(
  chipValueMinor?: string | null,
  currency?: string | null
): string {
  if (!chipValueMinor || !currency) {
    return "Курс не задан";
  }

  return `1 фишка = ${formatMinorMoney(chipValueMinor, currency)}`;
}

export function formatVirtualChipsRate(chipsPerCurrencyUnit?: string | null): string {
  const normalized = chipsPerCurrencyUnit?.trim();

  if (!normalized || !/^\d+$/.test(normalized) || BigInt(normalized) <= 0n) {
    return "Курс не задан";
  }

  return `1 ₽ = ${formatChips(normalized)} фишек`;
}

export function formatStackReference(
  stackChips: string,
  chipValueMinor?: string | null,
  currency?: string | null
): string {
  if (!chipValueMinor || !currency) {
    return formatVirtualChips(stackChips);
  }

  const money = formatMinorMoney(calculateVirtualMinor(stackChips, chipValueMinor), currency);
  return `${formatVirtualChips(stackChips)} · ${money}`;
}

export function formatChipValueInputPreview(
  chipValueMinor?: string | null,
  currency?: string | null
): string {
  if (!chipValueMinor || !currency) {
    return "Без денежной привязки";
  }

  return `${formatMinorMoney(chipValueMinor, currency)} за фишку`;
}

export function formatChipsToCurrencyApprox(
  chips: string,
  chipsPerCurrencyUnit: string,
  currency: string
): string {
  return formatMinorMoney(chipsToMoneyMinor(chips, chipsPerCurrencyUnit), currency);
}

function getToneTextClassName(tone: Tone): string {
  switch (tone) {
    case "positive":
      return "text-[#4edea3]";
    case "negative":
      return "text-[#ffb4ab]";
    default:
      return "text-white";
  }
}

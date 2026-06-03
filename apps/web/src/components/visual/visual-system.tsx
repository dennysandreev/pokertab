import type { ButtonHTMLAttributes, CSSProperties, HTMLAttributes, JSX, ReactNode } from "react";
import { cn } from "@/lib/utils";

type VisualTone = "emerald" | "amber" | "graphite";

type CommonVisualProps = {
  imageSrc?: string | undefined;
  imageAlt?: string | undefined;
  tone?: VisualTone;
  className?: string;
};

type VisualHeroProps = CommonVisualProps & {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  aside?: ReactNode;
  children?: ReactNode;
};

type IllustratedPanelProps = CommonVisualProps &
  HTMLAttributes<HTMLDivElement> & {
    title: string;
    description?: string;
    eyebrow?: string;
    action?: ReactNode;
    children?: ReactNode;
  };

type ActionTileProps = CommonVisualProps &
  ButtonHTMLAttributes<HTMLButtonElement> & {
    title: string;
    description?: string;
    badge?: ReactNode;
    icon?: ReactNode;
    meta?: ReactNode;
  };

type FormShellProps = HTMLAttributes<HTMLDivElement> &
  CommonVisualProps & {
    title: string;
    description?: string;
    eyebrow?: string;
    footer?: ReactNode;
    headerAside?: ReactNode;
    children: ReactNode;
  };

type VisualEmptyStateProps = CommonVisualProps & {
  title?: string;
  description?: string;
  action?: ReactNode;
  compact?: boolean;
};

type CompactGameRowProps = CommonVisualProps &
  ButtonHTMLAttributes<HTMLButtonElement> & {
    title: string;
    subtitle?: string;
    statusLabel?: string;
    statusTone?: "neutral" | "success" | "warning";
    detail?: ReactNode;
    value?: ReactNode;
    trailing?: ReactNode;
  };

const eyebrowClassName = "text-[11px] font-semibold uppercase tracking-[0.24em] text-[#9ea6a2]";

const toneClassNames: Record<VisualTone, string> = {
  emerald:
    "border-white/[0.06] before:bg-[radial-gradient(circle_at_top_right,rgba(86,223,157,0.16),transparent_42%)]",
  amber:
    "border-white/[0.06] before:bg-[radial-gradient(circle_at_top_right,rgba(255,191,82,0.14),transparent_42%)]",
  graphite:
    "border-white/[0.05] before:bg-[radial-gradient(circle_at_top_right,rgba(137,153,146,0.08),transparent_42%)]"
};

function getFallbackBackgroundStyle(tone: VisualTone): CSSProperties {
  if (tone === "amber") {
    return {
      backgroundImage:
        "radial-gradient(circle at 18% 18%, rgba(255,191,82,0.16), transparent 34%), radial-gradient(circle at 84% 20%, rgba(255,255,255,0.08), transparent 24%), linear-gradient(145deg, rgba(5,7,7,0.98), rgba(18,20,19,0.92) 48%, rgba(34,44,37,0.88))"
    };
  }

  if (tone === "graphite") {
    return {
      backgroundImage:
        "radial-gradient(circle at 20% 15%, rgba(255,255,255,0.1), transparent 28%), radial-gradient(circle at 80% 18%, rgba(126,176,156,0.12), transparent 26%), linear-gradient(145deg, rgba(6,7,8,0.98), rgba(20,22,23,0.92) 42%, rgba(28,35,33,0.85))"
    };
  }

  return {
    backgroundImage:
      "radial-gradient(circle at 18% 18%, rgba(83,214,150,0.2), transparent 32%), radial-gradient(circle at 82% 20%, rgba(252,196,85,0.12), transparent 24%), linear-gradient(145deg, rgba(4,6,5,0.98), rgba(10,19,15,0.94) 44%, rgba(16,58,41,0.88))"
  };
}

function VisualArtwork({
  imageSrc,
  imageAlt,
  tone = "emerald",
  className
}: CommonVisualProps & {
  className?: string;
}): JSX.Element {
  return (
    <div
      className={cn(
        "relative isolate overflow-hidden rounded-[18px] border border-white/[0.06] bg-[#090b0a] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_12px_30px_rgba(0,0,0,0.3)]",
        className
      )}
      style={getFallbackBackgroundStyle(tone)}
    >
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),transparent_26%,rgba(0,0,0,0.38)_100%)]" />
      <div className="absolute inset-x-0 bottom-0 h-2/3 bg-[radial-gradient(circle_at_bottom,rgba(0,0,0,0.02),rgba(0,0,0,0.5)_62%,rgba(0,0,0,0.78))]" />
      {imageSrc ? (
        <img
          alt={imageAlt ?? ""}
          className="absolute inset-0 h-full w-full object-cover opacity-90 saturate-[0.95]"
          src={imageSrc}
        />
      ) : null}
      <div className="absolute inset-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_-24px_48px_rgba(0,0,0,0.34)]" />
    </div>
  );
}

function VisualSurface({
  children,
  className,
  tone = "emerald"
}: {
  children: ReactNode;
  className?: string;
  tone?: VisualTone;
}): JSX.Element {
  return (
    <section
      className={cn(
        "relative isolate overflow-hidden rounded-[24px] border bg-[#080909]/98 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_18px_56px_rgba(0,0,0,0.44)] before:absolute before:inset-0 before:opacity-100 before:content-['']",
        toneClassNames[tone],
        className
      )}
    >
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),transparent_22%,rgba(0,0,0,0.34)_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(170,198,184,0.045),transparent_24%)]" />
      <div className="absolute inset-0 backdrop-blur-[16px]" />
      <div className="relative">{children}</div>
    </section>
  );
}

export function VisualHero({
  eyebrow,
  title,
  description,
  imageSrc,
  imageAlt,
  actions,
  aside,
  children,
  tone = "emerald",
  className
}: VisualHeroProps): JSX.Element {
  return (
    <VisualSurface className={cn("p-4 sm:p-5", className)} tone={tone}>
      <div className="grid gap-4">
        <div className="flex items-start gap-3">
          {imageSrc ? (
            <VisualArtwork
              className="h-16 w-16 shrink-0 rounded-[16px] sm:h-20 sm:w-20"
              imageAlt={imageAlt}
              imageSrc={imageSrc}
              tone={tone}
            />
          ) : null}
          <div className="min-w-0 flex-1 space-y-3">
            {eyebrow ? <p className={eyebrowClassName}>{eyebrow}</p> : null}
            <div className="max-w-[34rem] space-y-2.5">
              <h1 className="text-[1.6rem] font-semibold leading-[1.04] text-white sm:text-[2rem]">
                {title}
              </h1>
              {description ? <p className="text-sm leading-6 text-[#cbd2ce]">{description}</p> : null}
            </div>
          </div>
        </div>
        {children ? <div className="grid gap-3 sm:grid-cols-2">{children}</div> : null}
        {actions || aside ? (
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
            {actions ? <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">{actions}</div> : <div />}
            {aside ? (
              <div className="rounded-[18px] border border-white/[0.06] bg-black/28 px-3 py-2.5 text-sm text-[#d7ddd9] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                {aside}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </VisualSurface>
  );
}

export function IllustratedPanel({
  title,
  description,
  eyebrow,
  action,
  children,
  imageSrc,
  imageAlt,
  tone = "graphite",
  className,
  ...props
}: IllustratedPanelProps): JSX.Element {
  return (
    <VisualSurface className={cn("p-4", className)} tone={tone}>
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_5rem] md:items-center" {...props}>
        <div className="min-w-0 space-y-3">
          {eyebrow ? <p className={eyebrowClassName}>{eyebrow}</p> : null}
          <div>
            <h2 className="text-lg font-semibold text-white">{title}</h2>
            {description ? <p className="mt-2 text-sm leading-6 text-[#b9c1bc]">{description}</p> : null}
          </div>
          {children ? <div className="space-y-3">{children}</div> : null}
          {action ? <div>{action}</div> : null}
        </div>
        <VisualArtwork className="h-16 w-16 justify-self-start md:h-20 md:w-20" imageAlt={imageAlt} imageSrc={imageSrc} tone={tone} />
      </div>
    </VisualSurface>
  );
}

export function ActionTile({
  title,
  description,
  badge,
  icon,
  meta,
  imageSrc,
  imageAlt,
  tone = "emerald",
  className,
  type = "button",
  ...props
}: ActionTileProps): JSX.Element {
  return (
    <button
      className={cn(
        "group block w-full rounded-[22px] text-left transition duration-200 hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#56df9d]",
        className
      )}
      type={type}
      {...props}
    >
      <VisualSurface className="p-3" tone={tone}>
        <div className="flex items-center gap-3">
          <VisualArtwork
            className="h-14 w-14 shrink-0 rounded-[16px] sm:h-16 sm:w-16"
            imageAlt={imageAlt}
            imageSrc={imageSrc}
            tone={tone}
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                {icon ? (
                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[14px] border border-[#26342f] bg-[#141a17] text-[#f2f5f3] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                    {icon}
                  </div>
                ) : null}
                <div className="min-w-0">
                  <h3 className="truncate text-[1rem] font-semibold text-white">{title}</h3>
                  {description ? <p className="mt-1 text-sm leading-5 text-[#aeb7b2]">{description}</p> : null}
                </div>
              </div>
              {badge ? (
                <div className="shrink-0 rounded-full border border-[#4a351c] bg-[#ffbe52]/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#ffe1a4]">
                  {badge}
                </div>
              ) : null}
            </div>
            {meta ? <div className="mt-2 text-xs leading-5 text-[#8f9792]">{meta}</div> : null}
          </div>
        </div>
      </VisualSurface>
    </button>
  );
}

export function FormShell({
  title,
  description,
  eyebrow,
  imageSrc,
  imageAlt,
  tone = "graphite",
  footer,
  headerAside,
  children,
  className,
  ...props
}: FormShellProps): JSX.Element {
  return (
    <VisualSurface className={cn("p-4 sm:p-5", className)} tone={tone}>
      <div className="grid gap-4" {...props}>
        <div className="flex items-start gap-3">
          {imageSrc ? (
            <VisualArtwork
              className="h-12 w-12 shrink-0 rounded-[15px] sm:h-14 sm:w-14"
              imageAlt={imageAlt}
              imageSrc={imageSrc}
              tone={tone}
            />
          ) : null}
          <div className="min-w-0">
            {eyebrow ? <p className={eyebrowClassName}>{eyebrow}</p> : null}
            <h2 className={cn("text-[1.35rem] font-semibold leading-tight text-white", eyebrow ? "mt-1.5" : "")}>
              {title}
            </h2>
            {description ? <p className="mt-2 text-sm leading-6 text-[#c3cbc7]">{description}</p> : null}
            {headerAside ? <div className="mt-3">{headerAside}</div> : null}
          </div>
        </div>
        <div className="rounded-[18px] border border-white/[0.05] bg-black/24 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)] sm:p-5">
          {children}
        </div>
        {footer ? <div>{footer}</div> : null}
      </div>
    </VisualSurface>
  );
}

export function VisualEmptyState({
  title = "Пока пусто",
  description = "Здесь скоро появится что-то важное.",
  action,
  imageSrc,
  imageAlt,
  tone = "graphite",
  compact = false,
  className
}: VisualEmptyStateProps): JSX.Element {
  return (
    <VisualSurface
      className={cn("p-4 text-center sm:p-5", compact ? "rounded-[20px]" : "rounded-[24px]", className)}
      tone={tone}
    >
      <div
        className={cn(
          "mx-auto grid max-w-[24rem] gap-3.5",
          compact ? "grid-cols-[3rem_minmax(0,1fr)] items-center py-0 text-left" : "py-1"
        )}
      >
        <VisualArtwork
          className={cn("mx-auto w-full", compact ? "h-12 rounded-[14px]" : "h-20 max-w-[6rem] rounded-[16px]")}
          imageAlt={imageAlt}
          imageSrc={imageSrc}
          tone={tone}
        />
        <div>
          <h2 className={cn("font-semibold text-white", compact ? "text-base" : "text-lg")}>{title}</h2>
          <p className={cn("text-sm text-[#b6beb9]", compact ? "mt-1 leading-5" : "mt-2 leading-6")}>
            {description}
          </p>
        </div>
        {action ? (
          <div className={cn("w-full", compact ? "col-span-2" : "mx-auto max-w-xs")}>{action}</div>
        ) : null}
      </div>
    </VisualSurface>
  );
}

export function CompactGameRow({
  title,
  subtitle,
  statusLabel,
  statusTone = "neutral",
  detail,
  value,
  trailing,
  imageSrc,
  imageAlt,
  tone = "graphite",
  className,
  type = "button",
  ...props
}: CompactGameRowProps): JSX.Element {
  return (
    <button
      className={cn(
        "block w-full rounded-[22px] text-left transition duration-200 hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#56df9d]",
        className
      )}
      type={type}
      {...props}
    >
      <VisualSurface className="p-2.5" tone={tone}>
        <div className="flex items-center gap-2.5">
          <VisualArtwork className="h-10 w-10 shrink-0 rounded-[13px]" imageAlt={imageAlt} imageSrc={imageSrc} tone={tone} />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                {statusLabel ? (
                  <span
                    className={cn(
                      "inline-flex rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em]",
                      statusTone === "success" && "border-[#56df9d]/25 bg-[#56df9d]/10 text-[#8ff0be]",
                      statusTone === "warning" && "border-[#ffbe52]/25 bg-[#ffbe52]/10 text-[#ffd38a]",
                      statusTone === "neutral" && "border-[#2a3430] bg-[#141a17] text-[#ccd3cf]"
                    )}
                  >
                    {statusLabel}
                  </span>
                ) : null}
                <h3 className="mt-1.5 truncate text-[0.94rem] font-semibold leading-tight text-white">{title}</h3>
                {subtitle ? <p className="mt-0.5 truncate text-xs text-[#a8b0ab]">{subtitle}</p> : null}
              </div>
              {trailing ? <div className="shrink-0 self-center text-right">{trailing}</div> : null}
            </div>
            {(detail ?? value) ? (
              <div className="mt-2 flex items-center justify-between gap-3">
                <div className="truncate text-[11px] leading-4 text-[#8f9792]">{detail}</div>
                {value ? <div className="shrink-0 text-xs font-semibold text-white">{value}</div> : null}
              </div>
            ) : null}
          </div>
        </div>
      </VisualSurface>
    </button>
  );
}

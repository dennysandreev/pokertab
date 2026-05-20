import type { JSX } from "react";
import { cn } from "@/lib/utils";
import { parseVirtualCard } from "./virtual-table-view";

type VirtualPlayingCardProps = {
  cardCode?: string | null;
  hidden?: boolean;
  compact?: boolean;
  className?: string;
};

export function VirtualPlayingCard({
  cardCode,
  hidden = false,
  compact = false,
  className
}: VirtualPlayingCardProps): JSX.Element {
  const card = cardCode ? parseVirtualCard(cardCode) : null;
  const baseClassName = compact ? "h-16 w-11 rounded-[0.9rem]" : "h-28 w-20 rounded-[1rem]";

  if (hidden || !card) {
    return (
      <div
        className={cn(
          "relative overflow-hidden border border-white/10 bg-white/[0.04] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]",
          baseClassName,
          className
        )}
      >
        <div className="absolute inset-[10%] rounded-[inherit] border border-dashed border-white/10" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(78,222,163,0.08),transparent_55%)]" />
      </div>
    );
  }

  const toneClassName = card.tone === "red" ? "text-[#c9606d]" : "text-[#111111]";
  const rankClassName = compact ? "pt-1.5 text-[0.8rem]" : "pt-2 text-[1.1rem]";
  const suitClassName = compact ? "text-[1.55rem]" : "text-[2.7rem]";

  return (
    <div
      aria-label={`${card.rank} ${card.suitLabel}`}
      className={cn(
        "relative overflow-hidden bg-[#faf8f2] shadow-[0_18px_36px_rgba(0,0,0,0.35)] ring-1 ring-black/8",
        baseClassName,
        className
      )}
    >
      <div className="absolute inset-0 rounded-[inherit] bg-[linear-gradient(180deg,rgba(255,255,255,0.75),rgba(240,234,224,0.88))]" />
      <div className={cn("relative flex h-full flex-col items-center font-semibold", toneClassName)}>
        <div
          className={cn(
            "w-full text-center font-['Hanken_Grotesk',Inter,sans-serif] font-extrabold leading-none",
            rankClassName
          )}
        >
          {card.rank}
        </div>
        <div className={cn("flex flex-1 items-center justify-center leading-none", suitClassName)}>
          {card.suitSymbol}
        </div>
      </div>
    </div>
  );
}

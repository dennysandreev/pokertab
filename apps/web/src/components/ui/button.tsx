import type { ButtonHTMLAttributes, PropsWithChildren } from "react";
import { cn } from "@/lib/utils";

type ButtonProps = PropsWithChildren<ButtonHTMLAttributes<HTMLButtonElement>>;

export function Button({
  children,
  className,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-transparent bg-accent px-4 py-3 text-sm font-semibold text-[#032517] shadow-[0_10px_28px_rgba(78,222,163,0.16)] transition duration-200 hover:brightness-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:pointer-events-none disabled:cursor-not-allowed disabled:border-white/5 disabled:bg-surfaceHigher disabled:text-muted disabled:shadow-none disabled:opacity-100",
        className
      )}
      type={type}
      {...props}
    >
      {children}
    </button>
  );
}

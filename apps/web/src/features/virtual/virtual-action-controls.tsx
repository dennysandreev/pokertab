import { useEffect, useMemo, useState, type JSX } from "react";
import type { VirtualHandDto } from "@pokertable/shared";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  buildActionPayload,
  formatChips,
  type VirtualActionButtonModel,
  getActionControlsModel
} from "./virtual-table-view";

type VirtualActionControlsProps = {
  hand: VirtualHandDto;
  potTotalChips: string;
  playerStackChips?: string | undefined;
  disabled?: boolean;
  pendingActionType?: string | null;
  onSubmitAction: ActionSubmitHandler;
};

type ActionSubmitHandler = (
  payload: ReturnType<typeof buildActionPayload>
) => void | Promise<void>;

export function VirtualActionControls({
  hand,
  potTotalChips,
  playerStackChips,
  disabled = false,
  pendingActionType = null,
  onSubmitAction
}: VirtualActionControlsProps): JSX.Element | null {
  const controlsModel = useMemo(
    () => getActionControlsModel(hand.myLegalActions, potTotalChips, playerStackChips),
    [hand.myLegalActions, playerStackChips, potTotalChips]
  );
  const sizingControl = controlsModel.sizingControl;
  const [amountChips, setAmountChips] = useState(sizingControl?.initialAmountChips ?? "");
  const [isSizingOpen, setIsSizingOpen] = useState(false);

  useEffect(() => {
    setAmountChips(sizingControl?.initialAmountChips ?? "");
  }, [sizingControl?.actionType, sizingControl?.minAmountChips, sizingControl?.maxAmountChips]);

  useEffect(() => {
    if (!sizingControl) {
      setIsSizingOpen(false);
    }
  }, [sizingControl]);

  useEffect(() => {
    if (!isSizingOpen) {
      return undefined;
    }

    const handleEscape = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        setIsSizingOpen(false);
      }
    };

    window.addEventListener("keydown", handleEscape);

    return () => window.removeEventListener("keydown", handleEscape);
  }, [isSizingOpen]);

  if (
    !controlsModel.foldButton &&
    !controlsModel.primaryButton &&
    !controlsModel.raiseButton &&
    !controlsModel.secondaryButton &&
    !sizingControl
  ) {
    return null;
  }

  return (
    <>
      <section
        className="border-t border-white/12 bg-[#121212]/98 px-3.5 pb-3 pt-2.5 shadow-[0_-18px_34px_rgba(0,0,0,0.42)] backdrop-blur-xl rounded-t-[1.55rem]"
        data-testid="virtual-action-panel"
      >
        {controlsModel.secondaryButton ? (
          <div className="mb-2" data-testid="virtual-action-all-in-pill">
            <button
              className={cn(
                "inline-flex min-h-8 items-center justify-center rounded-full border border-[#f1d8ea]/40 bg-[#2a1d28] px-3 py-1.5 text-[12px] font-semibold text-[#ffe7f5] transition hover:bg-[#342330]",
                disabled && "cursor-not-allowed opacity-60"
              )}
              disabled={disabled}
              onClick={() => {
                const button = controlsModel.secondaryButton;

                if (!button) {
                  return;
                }

                void onSubmitAction(buildActionPayload(hand.id, button.actionType, button.amountChips));
              }}
              type="button"
            >
              All-in
            </button>
          </div>
        ) : null}

        <div
          className="mt-2.5 grid grid-cols-[1fr_1.45fr_1fr] gap-2.5"
          data-testid="virtual-action-buttons"
        >
          <ActionBarButton
            button={controlsModel.foldButton}
            disabled={disabled}
            fallbackLabel="Пас"
            testId="virtual-action-button-side-left"
            onClick={() => {
              const button = controlsModel.foldButton;

              if (!button) {
                return;
              }

              void onSubmitAction(buildActionPayload(hand.id, button.actionType, button.amountChips));
            }}
          />
          <ActionBarButton
            button={controlsModel.primaryButton}
            disabled={disabled}
            fallbackLabel="Чек"
            primary
            testId="virtual-action-button-primary"
            onClick={() => {
              const button = controlsModel.primaryButton;

              if (!button) {
                return;
              }

              if (shouldOpenSizingSheet(button)) {
                setIsSizingOpen(true);
                return;
              }

              void onSubmitAction(buildActionPayload(hand.id, button.actionType, button.amountChips));
            }}
          />
          <ActionBarButton
            button={controlsModel.raiseButton}
            disabled={disabled}
            fallbackLabel={sizingControl?.label ?? "Повысить"}
            testId="virtual-action-button-side-right"
            onClick={() => {
              if (!controlsModel.raiseButton) {
                return;
              }

              setIsSizingOpen(true);
            }}
          />
        </div>
      </section>

      {sizingControl && isSizingOpen ? (
        <div
          className="fixed inset-0 z-[90] bg-black/70 backdrop-blur-sm"
          onClick={() => setIsSizingOpen(false)}
        >
          <div
            className="absolute inset-x-0 bottom-0 rounded-t-[1.75rem] border border-white/10 bg-[#171717]/96 px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mx-auto max-w-md">
              <div className="mx-auto h-1.5 w-14 rounded-full bg-white/10" />
              <div className="mt-4 flex items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8e9192]">
                    {sizingControl.label}
                  </div>
                  <div className="mt-1 text-2xl font-semibold text-white">
                    {formatChips(amountChips)}
                  </div>
                </div>
                <button
                  aria-label="Закрыть подбор ставки"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white transition hover:bg-white/[0.08]"
                  onClick={() => setIsSizingOpen(false)}
                  type="button"
                >
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>

              <div className="mt-3 flex items-center justify-between gap-3 text-[11px] text-[#8e9192]">
                <span>От {formatChips(sizingControl.minAmountChips)}</span>
                <span>До {formatChips(sizingControl.maxAmountChips)}</span>
              </div>

              <input
                className="mt-4 w-full accent-[#4edea3]"
                disabled={disabled}
                max={sizingControl.maxAmountChips}
                min={sizingControl.minAmountChips}
                onChange={(event) => setAmountChips(event.target.value)}
                type="range"
                value={amountChips}
              />

              <div className="mt-4 grid grid-cols-4 gap-2">
                {sizingControl.presets.map((preset) => (
                  <button
                    key={preset.label}
                    className={cn(
                      "rounded-xl border px-2 py-2 text-[11px] font-semibold transition",
                      amountChips === preset.amountChips
                        ? "border-[#4edea3]/50 bg-[#4edea3]/12 text-[#79f6bf]"
                        : "border-white/8 bg-[#1f1f1f] text-[#c4c7c8] hover:bg-[#272727]"
                    )}
                    disabled={disabled}
                    onClick={() => setAmountChips(preset.amountChips)}
                  >
                    <span className="block">{preset.label}</span>
                    <span className="mt-1 block text-[10px] opacity-80">
                      {formatChips(preset.amountChips)}
                    </span>
                  </button>
                ))}
              </div>

              <div className="mt-4 flex items-center gap-3">
                <label className="min-w-0 flex-1">
                  <span className="sr-only">Сумма действия</span>
                  <input
                    className="h-12 w-full rounded-xl border border-white/10 bg-[#1d1d1d] px-4 text-right text-lg font-semibold text-white outline-none transition focus:border-[#4edea3]"
                    disabled={disabled}
                    inputMode="numeric"
                    max={sizingControl.maxAmountChips}
                    min={sizingControl.minAmountChips}
                    onChange={(event) => setAmountChips(clampInputValue(event.target.value, sizingControl))}
                    value={amountChips}
                  />
                </label>
                <Button
                  className="min-w-[8.5rem]"
                  disabled={disabled}
                  onClick={() => {
                    setIsSizingOpen(false);
                    void onSubmitAction(buildActionPayload(hand.id, sizingControl.actionType, amountChips));
                  }}
                  type="button"
                >
                  {pendingActionType === sizingControl.actionType ? "Отправляем" : sizingControl.label}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function ActionBarButton({
  button,
  disabled,
  fallbackLabel,
  testId,
  onClick,
  primary = false
}: {
  button: ReturnType<typeof getActionControlsModel>["foldButton"];
  disabled: boolean;
  fallbackLabel: string;
  testId: string;
  onClick: () => void;
  primary?: boolean;
}): JSX.Element {
  return (
    <button
      className={cn(
        "min-h-[4.4rem] rounded-[1.2rem] border px-3 py-2.5 text-center transition",
        primary
          ? "border-[#4edea3]/45 bg-[#4edea3] text-[#022818] shadow-[0_14px_28px_rgba(78,222,163,0.2)]"
          : "border-white/70 bg-[#242424] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] hover:bg-[#2b2b2b]",
        !button && "opacity-40",
        disabled && "cursor-not-allowed opacity-60"
      )}
      disabled={disabled || !button}
      data-testid={testId}
      onClick={onClick}
      type="button"
    >
      <span
        className={cn(
          "block font-semibold leading-tight",
          primary ? "text-[0.88rem]" : "text-[0.95rem]"
        )}
      >
        {button?.label ?? fallbackLabel}
      </span>
    </button>
  );
}

function clampInputValue(
  rawValue: string,
  sizingControl: NonNullable<ReturnType<typeof getActionControlsModel>["sizingControl"]>
): string {
  const digits = rawValue.replace(/[^\d]/g, "");

  if (digits.length === 0) {
    return sizingControl.minAmountChips;
  }

  const parsed = Number.parseInt(digits, 10);
  const min = Number.parseInt(sizingControl.minAmountChips, 10);
  const max = Number.parseInt(sizingControl.maxAmountChips, 10);

  if (!Number.isFinite(parsed)) {
    return sizingControl.minAmountChips;
  }

  return String(Math.min(Math.max(parsed, min), max));
}

export function shouldOpenSizingSheet(
  button: Pick<VirtualActionButtonModel, "actionType"> | null | undefined
): boolean {
  return button?.actionType === "BET" || button?.actionType === "RAISE";
}

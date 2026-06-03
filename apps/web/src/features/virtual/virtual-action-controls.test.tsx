import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { VirtualHandDto } from "@pokertable/shared";
import { VirtualActionControls, shouldOpenSizingSheet } from "./virtual-action-controls";

const baseHand: VirtualHandDto = {
  id: "hand-1",
  handNumber: 18,
  status: "IN_PROGRESS",
  street: "TURN",
  board: ["AS", "KH", "TD", "2C"],
  currentActorSeatId: "seat-1",
  currentTimer: null,
  currentBetChips: "200",
  callAmountChips: "0",
  myPrivateCards: ["QC", "QS"],
  resultSummary: null,
  myLegalActions: []
};

function renderControls(hand: VirtualHandDto): string {
  return renderToStaticMarkup(
    <VirtualActionControls
      hand={hand}
      onSubmitAction={vi.fn()}
      potTotalChips="900"
    />
  );
}

describe("virtual action controls", () => {
  it("renders fold and check without subtext or fake numeric placeholders", () => {
    const markup = renderControls({
      ...baseHand,
      myLegalActions: [{ type: "FOLD" }, { type: "CHECK" }]
    });

    expect(markup).toContain('data-testid="virtual-action-panel"');
    expect(markup).toContain('data-testid="virtual-action-buttons"');
    expect(markup).not.toContain('data-testid="virtual-action-metrics"');
    expect(markup).toContain("Пас");
    expect(markup).toContain("Чек");
    expect(markup).not.toContain("Сейчас");
    expect(markup).not.toContain("aria-hidden");
    expect(markup).not.toContain("-subtext");
  });

  it("renders call amount under the call label and keeps all-in out of the panel", () => {
    const markup = renderControls({
      ...baseHand,
      callAmountChips: "200",
      myLegalActions: [
        { type: "FOLD" },
        { type: "CALL", amountChips: "200" },
        { type: "RAISE", minAmountChips: "400", maxAmountChips: "4200" },
        { type: "ALL_IN", amountChips: "4200" }
      ]
    });

    expect(markup).toContain("Колл");
    expect(markup).toContain('data-testid="virtual-action-button-primary-amount"');
    expect(markup).toContain("200");
    expect(markup).toContain("Повысить");
    expect(markup).not.toContain('data-testid="virtual-action-all-in-pill"');
    expect(markup).not.toContain("All-in");
    expect(markup).not.toContain("4 200");
  });

  it("keeps the all-in pill hidden when all-in is unavailable", () => {
    const markup = renderControls({
      ...baseHand,
      myLegalActions: [
        { type: "FOLD" },
        { type: "CHECK" },
        { type: "RAISE", minAmountChips: "300", maxAmountChips: "1200" }
      ]
    });

    expect(markup).not.toContain("Ва-банк");
  });

  it("opens the sizing sheet only for raise or bet buttons", () => {
    expect(shouldOpenSizingSheet(null)).toBe(false);
    expect(shouldOpenSizingSheet({ actionType: "FOLD" })).toBe(false);
    expect(shouldOpenSizingSheet({ actionType: "CHECK" })).toBe(false);
    expect(shouldOpenSizingSheet({ actionType: "CALL" })).toBe(false);
    expect(shouldOpenSizingSheet({ actionType: "BET" })).toBe(true);
    expect(shouldOpenSizingSheet({ actionType: "RAISE" })).toBe(true);
  });

  it("keeps the raise presets sheet closed by default", () => {
    const markup = renderControls({
      ...baseHand,
      myLegalActions: [
        { type: "FOLD" },
        { type: "CHECK" },
        { type: "RAISE", minAmountChips: "300", maxAmountChips: "1200" }
      ]
    });

    expect(markup).not.toContain("1/2 банка");
    expect(markup).not.toContain("Закрыть подбор ставки");
  });

  it("uses a transparent overlay with the reference-like three-button structure", () => {
    const markup = renderControls({
      ...baseHand,
      myLegalActions: [
        { type: "FOLD" },
        { type: "CALL", amountChips: "200" },
        { type: "RAISE", minAmountChips: "400", maxAmountChips: "4200" }
      ]
    });

    expect(markup).toContain('data-testid="virtual-action-button-side-left"');
    expect(markup).toContain('data-testid="virtual-action-button-primary"');
    expect(markup).toContain('data-testid="virtual-action-button-side-right"');
    expect(markup).toContain('data-testid="virtual-action-button-primary-amount"');
    expect(markup).toContain("grid-cols-[0.94fr_1.22fr_0.94fr]");
    expect(markup).toContain("px-3 pb-3 pt-2");
    expect(markup).not.toContain("bg-[rgba(11,14,13,0.82)]");
    expect(markup).toContain("min-h-[4.1rem]");
    expect(markup).toContain("rounded-[1.1rem]");
    expect(markup).toContain("bg-[rgba(29,33,31,0.92)]");
    expect(markup).toContain("bg-[#47d97f] text-[#032312]");
    expect(markup).not.toContain("-subtext");
  });

  it("renders fold as danger, call as primary green, and raise as dark action", () => {
    const markup = renderControls({
      ...baseHand,
      myLegalActions: [
        { type: "FOLD" },
        { type: "CALL", amountChips: "50" },
        { type: "RAISE", minAmountChips: "150", maxAmountChips: "9950" }
      ]
    });

    expect(markup).toContain("bg-[#9f3232] text-white");
    expect(markup).toContain("bg-[#47d97f] text-[#032312]");
    expect(markup).toContain("bg-[rgba(29,33,31,0.92)] text-white");
    expect(markup).toContain('data-testid="virtual-action-button-primary-amount"');
    expect(markup).toContain("50");
    expect(markup).not.toContain("4 200");
  });

  it("keeps all-in out of the lower panel", () => {
    const markup = renderControls({
      ...baseHand,
      myLegalActions: [
        { type: "FOLD" },
        { type: "CALL", amountChips: "50" },
        { type: "RAISE", minAmountChips: "150", maxAmountChips: "9950" },
        { type: "ALL_IN", amountChips: "9950" }
      ]
    });

    expect(markup).not.toContain('data-testid="virtual-action-all-in-pill"');
    expect(markup).not.toContain("All-in");
    expect(markup).not.toContain("9 950");
    expect(markup).not.toContain("Ставка");
  });
});

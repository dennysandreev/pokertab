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

  it("renders call and raise without amount labels on the buttons and all-in pill without amount", () => {
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
    expect(markup).toContain("Повысить");
    expect(markup).toContain('data-testid="virtual-action-all-in-pill"');
    expect(markup).toContain("All-in");
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

  it("uses the reference-like big three-button structure and visual class markers", () => {
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
    expect(markup).toContain("grid-cols-[1fr_1.45fr_1fr]");
    expect(markup).toContain("rounded-t-[1.55rem]");
    expect(markup).toContain("min-h-[4.4rem]");
    expect(markup).toContain("rounded-[1.2rem]");
    expect(markup).toContain("border-white/70 bg-[#242424]");
    expect(markup).toContain("bg-[#4edea3] text-[#022818]");
    expect(markup).not.toContain("-subtext");
  });

  it("keeps the all-in pill compact and outlined", () => {
    const markup = renderControls({
      ...baseHand,
      myLegalActions: [
        { type: "FOLD" },
        { type: "CALL", amountChips: "50" },
        { type: "RAISE", minAmountChips: "150", maxAmountChips: "9950" },
        { type: "ALL_IN", amountChips: "9950" }
      ]
    });

    expect(markup).toContain('data-testid="virtual-action-all-in-pill"');
    expect(markup).toContain("rounded-full border border-[#f1d8ea]/40 bg-[#2a1d28]");
    expect(markup).toContain("All-in");
    expect(markup).not.toContain("9 950");
  });
});

import { describe, expect, it } from "vitest";
import { formatHistoryTime, getActionLabel } from "./virtual-history-screens";

describe("virtual history helpers", () => {
  it("formats action copy in Russian for betting actions", () => {
    expect(
      getActionLabel({
        id: "1",
        street: "TURN",
        actionType: "RAISE",
        amountChips: "600",
        seatId: "seat-1",
        displayName: "Denis",
        actorType: "PLAYER",
        createdAt: "2026-05-14T12:00:00.000Z"
      })
    ).toBe("повысил до 600 фишек");
  });

  it("formats time to hour and minute", () => {
    expect(formatHistoryTime("2026-05-14T12:34:00.000Z")).toMatch(/12:34|15:34/);
  });
});

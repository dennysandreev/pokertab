import { describe, expect, it } from "vitest";
import { formatTransferAmountPrimary } from "./room-screens";

describe("room screens helpers", () => {
  it("formats transfer amounts in currency when the room rate is set", () => {
    expect(formatTransferAmountPrimary("1500", "RUB", 100)).toBe("15 ₽");
  });

  it("falls back to chips with a short note when the room rate is missing", () => {
    expect(formatTransferAmountPrimary("1500", "RUB", null)).toBe("1\u00A0500 фишек · Курс не указан");
  });
});

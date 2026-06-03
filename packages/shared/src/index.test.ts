import { describe, expect, it } from "vitest";
import {
  APP_NAME,
  buildClubStartParam,
  buildRoomStartParam,
  chipsToMoneyMinor,
  formatChips,
  formatMinorMoney,
  getClubInviteCodeFromStartParam,
  getInviteCodeFromStartParam,
  parseMajorMoneyToMinor
} from "./index";

describe("shared constants", () => {
  it("exposes app name", () => {
    expect(APP_NAME).toBe("Poker Table");
  });

  it("extracts invite code from Telegram room start parameter", () => {
    expect(getInviteCodeFromStartParam("room_abc123")).toBe("abc123");
    expect(getInviteCodeFromStartParam("room_")).toBeNull();
    expect(getInviteCodeFromStartParam("hello")).toBeNull();
    expect(getInviteCodeFromStartParam(undefined)).toBeNull();
  });

  it("builds Telegram room start parameter", () => {
    expect(buildRoomStartParam("abc123")).toBe("room_abc123");
  });

  it("extracts invite code from Telegram club start parameter", () => {
    expect(getClubInviteCodeFromStartParam("club_club42")).toBe("club42");
    expect(getClubInviteCodeFromStartParam("club_")).toBeNull();
    expect(getClubInviteCodeFromStartParam("hello")).toBeNull();
    expect(getClubInviteCodeFromStartParam(undefined)).toBeNull();
  });

  it("builds Telegram club start parameter", () => {
    expect(buildClubStartParam("club42")).toBe("club_club42");
  });

  it("parses major money input into minor string without floats", () => {
    expect(parseMajorMoneyToMinor("1000")).toBe("100000");
    expect(parseMajorMoneyToMinor("1000,5")).toBe("100050");
    expect(parseMajorMoneyToMinor("1000.56")).toBe("100056");
    expect(parseMajorMoneyToMinor("0.01")).toBe("1");
    expect(parseMajorMoneyToMinor("10.999")).toBeNull();
  });

  it("formats minor money for Russian UI without kopeks by default", () => {
    expect(formatMinorMoney("100000", "RUB")).toBe("1\u00A0000 ₽");
    expect(formatMinorMoney("-450000", "RUB")).toBe("-4\u00A0500 ₽");
  });

  it("keeps decimals when they are present in the minor amount", () => {
    expect(formatMinorMoney("100050", "RUB")).toBe("1\u00A0000,50 ₽");
    expect(formatMinorMoney("123456", "USD")).toBe("1\u00A0234,56 $");
    expect(formatMinorMoney("-789", "EUR")).toBe("-7,89 €");
  });

  it("formats chips with grouped thousands", () => {
    expect(formatChips("12500")).toBe("12\u00A0500");
    expect(formatChips(-9000n)).toBe("-9\u00A0000");
  });

  it("converts chips to minor money using chip rate", () => {
    expect(chipsToMoneyMinor("1000", "100")).toBe("1000");
    expect(chipsToMoneyMinor("250", "4")).toBe("6250");
  });
});

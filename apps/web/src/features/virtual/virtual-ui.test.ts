import { describe, expect, it } from "vitest";
import {
  calculateVirtualMinor,
  formatBlindPair,
  formatStackReference,
  formatVirtualMoneyHint,
  formatVirtualRate,
  getAvatarInitials,
  getLobbyEmptyCopy,
  getVirtualResultTone
} from "./virtual-ui";

describe("virtual ui helpers", () => {
  it("builds avatar initials from the first two words", () => {
    expect(getAvatarInitials("Denis Andreev")).toBe("DA");
    expect(getAvatarInitials("denis")).toBe("D");
  });

  it("formats the virtual rate and stack reference", () => {
    expect(formatVirtualRate("10", "RUB")).toBe("1 фишка = 0,10 ₽");
    expect(formatStackReference("10000", "10", "RUB")).toBe("10\u00A0000 фишек · 1\u00A0000 ₽");
  });

  it("returns null hint when the chip value is not set", () => {
    expect(formatVirtualMoneyHint("1000")).toBeNull();
  });

  it("calculates minor money from chip amounts", () => {
    expect(calculateVirtualMinor("250", "12")).toBe("3000");
    expect(formatBlindPair("50", "100")).toBe("50 / 100");
  });

  it("keeps empty-state copy specific to the lobby section", () => {
    expect(getLobbyEmptyCopy("waiting")).toEqual({
      title: "Новых лобби пока нет",
      description: "Создайте стол или зайдите по коду, чтобы собрать следующую игру."
    });
  });

  it("derives tone from signed chip values", () => {
    expect(getVirtualResultTone("150")).toBe("positive");
    expect(getVirtualResultTone("-1")).toBe("negative");
    expect(getVirtualResultTone("0")).toBe("neutral");
  });
});

import { describe, expect, it } from "vitest";
import {
  buildCreateRoomPayload,
  getCreateRoomValidationMessage,
  ROOM_MAX_BUY_IN_CHIPS,
  ROOM_MAX_CHIPS_PER_CURRENCY_UNIT,
  ROOM_MAX_REBUY_CHIPS,
  ROOM_TITLE_MAX_LENGTH
} from "./room-form";
import {
  getClubRoute,
  getCreateRoomRoute,
  getGamesRoute,
  getJoinRoute,
  getJoinRoomRoute,
  getRoomRoute
} from "./routes";

describe("room form helpers", () => {
  it("builds payload with chip fields", () => {
    expect(
      buildCreateRoomPayload({
        title: "Пятничный покер",
        currency: "rub",
        buyInChips: "10000",
        rebuyChips: "2500",
        chipsPerCurrencyUnit: "100",
        rebuyPermission: "PLAYER_SELF"
      })
    ).toEqual({
      title: "Пятничный покер",
      currency: "RUB",
      buyInChips: "10000",
      rebuyChips: "2500",
      chipsPerCurrencyUnit: "100",
      gameType: "SIMPLE_TRACKING",
      rebuyPermission: "PLAYER_SELF"
    });
  });

  it("rejects invalid chip input", () => {
    expect(
      buildCreateRoomPayload({
        title: "Пятничный покер",
        currency: "RUB",
        buyInChips: "10.999",
        rebuyChips: "1000",
        chipsPerCurrencyUnit: "100",
        rebuyPermission: "PLAYER_SELF"
      })
    ).toBeNull();
  });

  it("rejects zero and negative chip amounts before submit", () => {
    expect(
      buildCreateRoomPayload({
        title: "Пятничный покер",
        currency: "RUB",
        buyInChips: "0",
        rebuyChips: "1000",
        chipsPerCurrencyUnit: "100",
        rebuyPermission: "PLAYER_SELF"
      })
    ).toBeNull();

    expect(
      buildCreateRoomPayload({
        title: "Пятничный покер",
        currency: "RUB",
        buyInChips: "-100",
        rebuyChips: "1000",
        chipsPerCurrencyUnit: "100",
        rebuyPermission: "PLAYER_SELF"
      })
    ).toBeNull();
  });

  it("rejects too long room title", () => {
    expect(
      getCreateRoomValidationMessage({
        title: "а".repeat(ROOM_TITLE_MAX_LENGTH + 1),
        currency: "RUB",
        buyInChips: "1000",
        rebuyChips: "1000",
        chipsPerCurrencyUnit: "100",
        rebuyPermission: "PLAYER_SELF"
      })
    ).toBe("Название слишком длинное");
  });

  it("rejects unsupported currency before submit", () => {
    expect(
      getCreateRoomValidationMessage({
        title: "Пятничный покер",
        currency: "GBP",
        buyInChips: "1000",
        rebuyChips: "1000",
        chipsPerCurrencyUnit: "100",
        rebuyPermission: "PLAYER_SELF"
      })
    ).toBe("Выберите рубли, доллары или евро");
  });

  it("rejects too large buy-in before submit", () => {
    expect(
      getCreateRoomValidationMessage({
        title: "Пятничный покер",
        currency: "RUB",
        buyInChips: String(ROOM_MAX_BUY_IN_CHIPS + 1),
        rebuyChips: "1000",
        chipsPerCurrencyUnit: "100",
        rebuyPermission: "PLAYER_SELF"
      })
    ).toBe("Сумма входа слишком большая");
  });

  it("rejects too large rate before submit", () => {
    expect(
      getCreateRoomValidationMessage({
        title: "Пятничный покер",
        currency: "RUB",
        buyInChips: "1000",
        rebuyChips: "1000",
        chipsPerCurrencyUnit: String(ROOM_MAX_CHIPS_PER_CURRENCY_UNIT + 1),
        rebuyPermission: "PLAYER_SELF"
      })
    ).toBe("Курс слишком большой");
  });

  it("rejects too large rebuy before submit", () => {
    expect(
      getCreateRoomValidationMessage({
        title: "Пятничный покер",
        currency: "RUB",
        buyInChips: "1000",
        rebuyChips: String(ROOM_MAX_REBUY_CHIPS + 1),
        chipsPerCurrencyUnit: "100",
        rebuyPermission: "PLAYER_SELF"
      })
    ).toBe("Ребай слишком большой");
  });

  it("builds room routes", () => {
    expect(getGamesRoute()).toBe("/games");
    expect(getClubRoute()).toBe("/club");
    expect(getCreateRoomRoute()).toBe("/rooms/new");
    expect(getJoinRoute()).toBe("/join");
    expect(getRoomRoute("room-1")).toBe("/rooms/room-1");
    expect(getJoinRoomRoute("invite-1")).toBe("/join/invite-1");
  });
});

import { describe, expect, it } from "vitest";
import {
  buildCreateRoomPayload,
  getCreateRoomValidationMessage,
  ROOM_MAX_REBUY_AMOUNT_MINOR,
  ROOM_MAX_STARTING_STACK,
  ROOM_TITLE_MAX_LENGTH
} from "./room-form";
import {
  getCreateRoomRoute,
  getJoinRoomRoute,
  getRoomRoute
} from "./routes";

describe("room form helpers", () => {
  it("converts rubles into minor string without float math", () => {
    expect(
      buildCreateRoomPayload({
        title: "Пятничный покер",
        currency: "rub",
        rebuyAmount: "1 250"
          .replace(" ", ""),
        startingStack: "10000",
        rebuyPermission: "PLAYER_SELF"
      })
    ).toEqual({
      title: "Пятничный покер",
      currency: "RUB",
      rebuyAmountMinor: "125000",
      startingStack: 10000,
      gameType: "SIMPLE_TRACKING",
      rebuyPermission: "PLAYER_SELF"
    });
  });

  it("rejects invalid money input", () => {
    expect(
      buildCreateRoomPayload({
        title: "Пятничный покер",
        currency: "RUB",
        rebuyAmount: "10.999",
        startingStack: "",
        rebuyPermission: "PLAYER_SELF"
      })
    ).toBeNull();
  });

  it("rejects zero and negative rebuy amounts before submit", () => {
    expect(
      buildCreateRoomPayload({
        title: "Пятничный покер",
        currency: "RUB",
        rebuyAmount: "0",
        startingStack: "",
        rebuyPermission: "PLAYER_SELF"
      })
    ).toBeNull();

    expect(
      buildCreateRoomPayload({
        title: "Пятничный покер",
        currency: "RUB",
        rebuyAmount: "-100",
        startingStack: "",
        rebuyPermission: "PLAYER_SELF"
      })
    ).toBeNull();
  });

  it("rejects too long room title", () => {
    expect(
      getCreateRoomValidationMessage({
        title: "а".repeat(ROOM_TITLE_MAX_LENGTH + 1),
        currency: "RUB",
        rebuyAmount: "1000",
        startingStack: "",
        rebuyPermission: "PLAYER_SELF"
      })
    ).toBe("Название слишком длинное");
  });

  it("rejects unsupported currency before submit", () => {
    expect(
      getCreateRoomValidationMessage({
        title: "Пятничный покер",
        currency: "GBP",
        rebuyAmount: "1000",
        startingStack: "",
        rebuyPermission: "PLAYER_SELF"
      })
    ).toBe("Выберите рубли, доллары или евро");
  });

  it("rejects too large rebuy amount before submit", () => {
    expect(
      getCreateRoomValidationMessage({
        title: "Пятничный покер",
        currency: "RUB",
        rebuyAmount: String(Number(ROOM_MAX_REBUY_AMOUNT_MINOR / 100n) + 1),
        startingStack: "",
        rebuyPermission: "PLAYER_SELF"
      })
    ).toBe("Сумма ребая слишком большая");
  });

  it("rejects too large starting stack before submit", () => {
    expect(
      getCreateRoomValidationMessage({
        title: "Пятничный покер",
        currency: "RUB",
        rebuyAmount: "1000",
        startingStack: String(ROOM_MAX_STARTING_STACK + 1),
        rebuyPermission: "PLAYER_SELF"
      })
    ).toBe("Стартовый стек слишком большой");
  });

  it("builds room routes", () => {
    expect(getCreateRoomRoute()).toBe("/rooms/new");
    expect(getRoomRoute("room-1")).toBe("/rooms/room-1");
    expect(getJoinRoomRoute("invite-1")).toBe("/join/invite-1");
  });
});

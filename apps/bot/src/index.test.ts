import { describe, expect, it } from "vitest";
import {
  buildHelpResponse,
  buildRoomInviteDeepLink,
  buildStartResponse,
  getBotStatus
} from "./index.js";

describe("getBotStatus", () => {
  it("returns bot service status", () => {
    expect(getBotStatus()).toEqual({
      ok: true,
      service: "bot"
    });
  });
});

describe("buildStartResponse", () => {
  it("returns Russian start message with Mini App button", () => {
    expect(buildStartResponse("https://t.me/poker_bot/app")).toEqual({
      text: [
        "👋 Привет! Это Poker Table.",
        "",
        "Здесь удобно вести домашний покер:",
        "— создавать столы;",
        "— фиксировать ребаи;",
        "— считать итоги;",
        "— понимать, кто кому сколько должен.",
        "",
        "Открой приложение, чтобы создать игру или присоединиться к столу."
      ].join("\n"),
      button: {
        text: "Открыть Poker Table",
        url: "https://t.me/poker_bot/app"
      }
    });
  });
});

describe("buildHelpResponse", () => {
  it("returns Russian help message without payment semantics", () => {
    expect(buildHelpResponse()).toEqual({
      text: "Приложение ничего не хранит и не переводит — только помогает вести учёт ребаев и итогов приватной игры.",
      button: null
    });
  });
});

describe("buildRoomInviteDeepLink", () => {
  it("builds Telegram startapp link for room invites", () => {
    expect(buildRoomInviteDeepLink("poker_bot", "invite-1")).toBe(
      "https://t.me/poker_bot/app?startapp=room_invite-1"
    );
  });
});

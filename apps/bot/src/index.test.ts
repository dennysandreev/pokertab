import { describe, expect, it } from "vitest";
import {
  appendMiniAppCacheBuster,
  buildDiagnosticResponse,
  buildHelpResponse,
  buildMiniAppPathUrl,
  buildRoomInviteDeepLink,
  buildStartResponse,
  buildVirtualReminderNotification,
  buildVirtualTableInviteDeepLink,
  buildVirtualTableInviteMessage,
  buildVirtualTableStartResponse,
  buildVirtualTimeoutNotification,
  getBotStatus,
  resolveCommandResponse
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

describe("buildVirtualTableInviteDeepLink", () => {
  it("builds Telegram startapp link for virtual table invites", () => {
    expect(buildVirtualTableInviteDeepLink("poker_bot", "virtual-1")).toBe(
      "https://t.me/poker_bot/app?startapp=virtual_table_virtual-1"
    );
  });
});

describe("buildVirtualTableInviteMessage", () => {
  it("returns invite text with title, link and easy to copy code", () => {
    expect(
      buildVirtualTableInviteMessage({
        botUsername: "poker_bot",
        inviteCode: "v-code-1",
        tableTitle: "Ночная игра"
      })
    ).toEqual({
      text: [
        "Готово: виртуальный стол «Ночная игра».",
        "",
        "Откройте приглашение в Telegram или отправьте код другу.",
        "Ссылка: https://t.me/poker_bot/app?startapp=virtual_table_v-code-1",
        "Код: v-code-1"
      ].join("\n"),
      button: {
        text: "Открыть приглашение",
        url: "https://t.me/poker_bot/app?startapp=virtual_table_v-code-1"
      }
    });
  });
});

describe("virtual notifications", () => {
  it("builds reminder notification with web app button", () => {
    expect(
      buildVirtualReminderNotification({
        tableTitle: "Финальный стол",
        miniAppUrl: "https://pokertab.ru/app"
      })
    ).toEqual({
      text: "Пора сделать ход за столом «Финальный стол».",
      button: {
        text: "Сделать ход",
        url: "https://pokertab.ru/app"
      }
    });
  });

  it("builds timeout notification with action label and web app button", () => {
    expect(
      buildVirtualTimeoutNotification({
        tableTitle: "Финальный стол",
        actionLabel: "Ход пропущен",
        miniAppUrl: "https://pokertab.ru/app"
      })
    ).toEqual({
      text: "В столе «Финальный стол» время вышло. Ход пропущен.",
      button: {
        text: "Открыть стол",
        url: "https://pokertab.ru/app"
      }
    });
  });
});

describe("buildVirtualTableStartResponse", () => {
  it("mentions invite code and returns open app button", () => {
    expect(buildVirtualTableStartResponse("https://pokertab.ru/app", "v-code-1")).toEqual({
      text: [
        "Вы открыли приглашение в виртуальный стол.",
        "Код стола: v-code-1",
        "",
        "Нажмите кнопку ниже, чтобы сразу перейти в игру."
      ].join("\n"),
      button: {
        text: "Открыть стол",
        url: "https://pokertab.ru/app"
      }
    });
  });
});

describe("resolveCommandResponse", () => {
  it("returns help response for /help", () => {
    expect(resolveCommandResponse("/help", "https://pokertab.ru/app")).toEqual(
      buildHelpResponse()
    );
  });

  it("returns virtual table start response for /start deep links", () => {
    expect(
      resolveCommandResponse("/start virtual_table_v-code-1", "https://pokertab.ru/app")
    ).toEqual(buildVirtualTableStartResponse("https://pokertab.ru/app", "v-code-1"));
  });

  it("returns diagnostic response for /diag", () => {
    expect(resolveCommandResponse("/diag", "https://pokertab.ru/?ptb=release-1")).toEqual(
      buildDiagnosticResponse("https://pokertab.ru/mini-probe.html?ptb=release-1")
    );
  });

  it("supports bot username in /start deep links", () => {
    expect(
      resolveCommandResponse("/start@pokertable_bot virtual_table_v-code-1", "https://pokertab.ru/app")
    ).toEqual(buildVirtualTableStartResponse("https://pokertab.ru/app", "v-code-1"));
  });

  it("falls back to default start response for other commands", () => {
    expect(resolveCommandResponse("/start room_room-1", "https://pokertab.ru/app")).toEqual(
      buildStartResponse("https://pokertab.ru/app")
    );
  });
});

describe("buildDiagnosticResponse", () => {
  it("returns diagnostic Mini App button", () => {
    expect(buildDiagnosticResponse("https://pokertab.ru/mini-probe.html")).toEqual({
      text: "Откройте проверочный экран. Он нужен, чтобы понять, запускается ли Mini App на этом телефоне.",
      button: {
        text: "Проверить загрузку",
        url: "https://pokertab.ru/mini-probe.html"
      }
    });
  });
});

describe("appendMiniAppCacheBuster", () => {
  it("adds a deploy marker to Mini App URLs", () => {
    expect(appendMiniAppCacheBuster("https://pokertab.ru", "release-1")).toBe(
      "https://pokertab.ru/?ptb=release-1"
    );
  });

  it("preserves existing query params", () => {
    expect(appendMiniAppCacheBuster("https://pokertab.ru/?startapp=room_1", "release-1")).toBe(
      "https://pokertab.ru/?startapp=room_1&ptb=release-1"
    );
  });
});

describe("buildMiniAppPathUrl", () => {
  it("replaces the path and keeps query params", () => {
    expect(buildMiniAppPathUrl("https://pokertab.ru/?ptb=release-1", "/mini-probe.html")).toBe(
      "https://pokertab.ru/mini-probe.html?ptb=release-1"
    );
  });
});

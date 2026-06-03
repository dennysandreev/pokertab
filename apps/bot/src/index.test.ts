import { afterEach, describe, expect, it, vi } from "vitest";
import {
  appendMiniAppCacheBuster,
  buildDiagnosticResponse,
  buildClubEventRsvpAnswerText,
  buildClubInviteDeepLink,
  buildOfflineClubEventNotificationPayload,
  buildOnlineClubEventNotificationPayload,
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
  handleCallbackQuery,
  parseClubEventRsvpCallback,
  resolveCommandResponse,
  submitClubEventRsvp,
  TELEGRAM_ALLOWED_UPDATES
} from "./index.js";

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.API_URL;
  delete process.env.WEB_APP_URL;
});

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

describe("buildClubInviteDeepLink", () => {
  it("builds Telegram startapp link for club invites", () => {
    expect(buildClubInviteDeepLink("poker_bot", "club-1")).toBe(
      "https://t.me/poker_bot/app?startapp=club_club-1"
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

describe("TELEGRAM_ALLOWED_UPDATES", () => {
  it("includes both messages and callback queries", () => {
    expect(TELEGRAM_ALLOWED_UPDATES).toEqual(["message", "callback_query"]);
  });
});

describe("parseClubEventRsvpCallback", () => {
  it("parses club RSVP callback data", () => {
    expect(parseClubEventRsvpCallback("club_event_rsvp:event-1:GOING")).toEqual({
      eventId: "event-1",
      status: "GOING"
    });
  });

  it("returns null for unsupported callback payloads", () => {
    expect(parseClubEventRsvpCallback("room_rsvp:event-1:GOING")).toBeNull();
    expect(parseClubEventRsvpCallback("club_event_rsvp:event-1:WAITLIST")).toBeNull();
  });
});

describe("club event notification builders", () => {
  it("builds offline notification payload with RSVP and web app buttons", () => {
    expect(
      buildOfflineClubEventNotificationPayload({
        clubName: "Poker Club Denis",
        eventId: "event-1",
        title: "Friday Poker",
        scheduledLabel: "24 мая, 21:00",
        location: "У Дениса",
        buyIn: "1 000 ₽",
        miniAppUrl: "https://pokertab.ru/clubs/event-1"
      })
    ).toEqual({
      text: [
        "🃏 Новая игра в клубе Poker Club Denis",
        "",
        "Friday Poker",
        "24 мая, 21:00",
        "Место: У Дениса",
        "Ребай: 1 000 ₽",
        "",
        "Вы придете?"
      ].join("\n"),
      reply_markup: {
        inline_keyboard: [
          [
            { text: "✅ Приду", callback_data: "club_event_rsvp:event-1:GOING" },
            { text: "❓ Возможно", callback_data: "club_event_rsvp:event-1:MAYBE" },
            { text: "❌ Не смогу", callback_data: "club_event_rsvp:event-1:DECLINED" }
          ],
          [
            {
              text: "Открыть мероприятие",
              web_app: {
                url: "https://pokertab.ru/clubs/event-1"
              }
            }
          ]
        ]
      }
    });
  });

  it("builds online notification payload with RSVP and web app buttons", () => {
    expect(
      buildOnlineClubEventNotificationPayload({
        clubName: "Poker Club Denis",
        eventId: "event-2",
        title: "Sunday Online Poker",
        scheduledLabel: "26 мая, 20:00",
        gameLabel: "Texas Hold'em",
        stackLabel: "10 000 фишек",
        blindsLabel: "50 / 100",
        miniAppUrl: "https://pokertab.ru/clubs/event-2"
      })
    ).toEqual({
      text: [
        "♠️ Запланирован онлайн-стол в клубе Poker Club Denis",
        "",
        "Sunday Online Poker",
        "Старт: 26 мая, 20:00",
        "Texas Hold'em",
        "Стек: 10 000 фишек",
        "Блайнды: 50 / 100",
        "",
        "Будете играть?"
      ].join("\n"),
      reply_markup: {
        inline_keyboard: [
          [
            { text: "✅ Играю", callback_data: "club_event_rsvp:event-2:GOING" },
            { text: "❌ Не смогу", callback_data: "club_event_rsvp:event-2:DECLINED" }
          ],
          [
            {
              text: "Открыть стол",
              web_app: {
                url: "https://pokertab.ru/clubs/event-2"
              }
            }
          ]
        ]
      }
    });
  });
});

describe("buildClubEventRsvpAnswerText", () => {
  it("uses API message when provided", () => {
    expect(
      buildClubEventRsvpAnswerText(
        {
          status: "success",
          message: "Готово из API."
        },
        "GOING"
      )
    ).toBe("Готово из API.");
  });

  it("builds fallback texts for result statuses", () => {
    expect(buildClubEventRsvpAnswerText({ status: "success" }, "GOING")).toBe(
      "Готово. Ваш ответ: Приду."
    );
    expect(buildClubEventRsvpAnswerText({ status: "waitlist" }, "GOING")).toBe(
      "Места закончились. Вы добавлены в лист ожидания."
    );
    expect(buildClubEventRsvpAnswerText({ status: "cancelled" }, "GOING")).toBe(
      "Мероприятие отменено."
    );
    expect(buildClubEventRsvpAnswerText({ status: "non-member" }, "GOING")).toBe(
      "Вы не являетесь участником этого клуба."
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

describe("submitClubEventRsvp", () => {
  it("posts eventId, telegramId and status to the internal API with bot auth header", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: "success" })
    });

    vi.stubGlobal("fetch", fetchMock);

    await expect(
      submitClubEventRsvp({
        apiBaseUrl: "https://api.pokertab.test/base",
        botToken: "bot-token",
        eventId: "event-42",
        telegramId: 123456,
        status: "MAYBE"
      })
    ).resolves.toEqual({ status: "success" });

    expect(fetchMock).toHaveBeenCalledWith(
      new URL("https://api.pokertab.test/api/clubs/telegram/rsvp"),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-telegram-bot-token": "bot-token"
        },
        body: JSON.stringify({
          eventId: "event-42",
          telegramId: 123456,
          status: "MAYBE"
        })
      }
    );
  });
});

describe("handleCallbackQuery", () => {
  it("answers callback with success fallback text", async () => {
    process.env.API_URL = "https://api.pokertab.test/v1";

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: "success" })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ ok: true, result: true })
      });

    vi.stubGlobal("fetch", fetchMock);

    await handleCallbackQuery("telegram-bot-token", {
      id: "callback-1",
      from: { id: 777 },
      data: "club_event_rsvp:event-9:GOING"
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      new URL("https://api.pokertab.test/api/clubs/telegram/rsvp"),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-telegram-bot-token": "telegram-bot-token"
        },
        body: JSON.stringify({
          eventId: "event-9",
          telegramId: 777,
          status: "GOING"
        })
      }
    );

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://api.telegram.org/bottelegram-bot-token/answerCallbackQuery",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          callback_query_id: "callback-1",
          text: "Готово. Ваш ответ: Приду."
        })
      }
    );
  });

  it("answers callback for waitlist, cancelled and non-member results", async () => {
    const scenarios = [
      {
        apiResult: { status: "waitlist" },
        expectedText: "Места закончились. Вы добавлены в лист ожидания."
      },
      {
        apiResult: { status: "cancelled" },
        expectedText: "Мероприятие отменено."
      },
      {
        apiResult: { status: "non-member" },
        expectedText: "Вы не являетесь участником этого клуба."
      }
    ] as const;

    for (const [index, scenario] of scenarios.entries()) {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(scenario.apiResult)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ ok: true, result: true })
        });

      vi.stubGlobal("fetch", fetchMock);

      await handleCallbackQuery("telegram-bot-token", {
        id: `callback-${index}`,
        from: { id: 999 },
        data: "club_event_rsvp:event-11:DECLINED"
      });

      expect(fetchMock).toHaveBeenNthCalledWith(
        2,
        "https://api.telegram.org/bottelegram-bot-token/answerCallbackQuery",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            callback_query_id: `callback-${index}`,
            text: scenario.expectedText
          })
        }
      );
    }
  });
});

import { ActionType } from "@prisma/client";
import { VirtualNotificationsService } from "./virtual-notifications.service";

describe("VirtualNotificationsService", () => {
  const originalFetch = global.fetch;
  const originalTelegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
  const originalWebAppUrl = process.env.WEB_APP_URL;
  const originalNotificationsEnabled = process.env.VIRTUAL_TELEGRAM_NOTIFICATIONS_ENABLED;

  beforeEach(() => {
    jest.resetAllMocks();
    process.env.WEB_APP_URL = "https://miniapp.example";
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.VIRTUAL_TELEGRAM_NOTIFICATIONS_ENABLED;
  });

  afterAll(() => {
    global.fetch = originalFetch;

    if (originalTelegramBotToken === undefined) {
      delete process.env.TELEGRAM_BOT_TOKEN;
    } else {
      process.env.TELEGRAM_BOT_TOKEN = originalTelegramBotToken;
    }

    if (originalWebAppUrl === undefined) {
      delete process.env.WEB_APP_URL;
    } else {
      process.env.WEB_APP_URL = originalWebAppUrl;
    }

    if (originalNotificationsEnabled === undefined) {
      delete process.env.VIRTUAL_TELEGRAM_NOTIFICATIONS_ENABLED;
    } else {
      process.env.VIRTUAL_TELEGRAM_NOTIFICATIONS_ENABLED = originalNotificationsEnabled;
    }
  });

  it("returns disabled when bot token is missing", async () => {
    const fetchMock: jest.MockedFunction<typeof fetch> = jest.fn();
    global.fetch = fetchMock;
    const service = new VirtualNotificationsService();

    const result = await service.sendReminderNotification({
      telegramId: "100",
      tableTitle: "Домашний кеш",
      tableId: "table-1"
    });

    expect(result).toEqual({
      sent: false,
      reason: "disabled"
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends the expected Telegram payload when enabled", async () => {
    process.env.TELEGRAM_BOT_TOKEN = "test-token";
    const fetchMock: jest.MockedFunction<typeof fetch> = jest
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        })
      );
    global.fetch = fetchMock;
    const service = new VirtualNotificationsService();

    const result = await service.sendTimeoutNotification({
      telegramId: "100",
      tableTitle: "Домашний кеш",
      tableId: "table-1",
      actionType: ActionType.AUTO_CHECK
    });

    expect(result).toEqual({
      sent: true
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.telegram.org/bottest-token/sendMessage",
      expect.objectContaining({
        method: "POST",
        headers: {
          "content-type": "application/json"
        }
      })
    );

    const request = fetchMock.mock.calls[0]?.[1];
    const requestBody = typeof request?.body === "string" ? request.body : "{}";
    const payload = JSON.parse(requestBody) as {
      chat_id: string;
      text: string;
      reply_markup: {
        inline_keyboard: Array<
          Array<{
            text: string;
            web_app: {
              url: string;
            };
          }>
        >;
      };
    };

    expect(payload.chat_id).toBe("100");
    expect(payload.text).toContain("Время вышло");
    expect(payload.text).toContain("Авточек");
    const button = payload.reply_markup.inline_keyboard[0]?.[0];

    expect(button?.text).toBe("Открыть стол");
    expect(button?.web_app.url).toMatch(
      /^https:\/\/miniapp\.example\/virtual\/tables\/table-1\?ptb=/
    );
    expect(button).toEqual({
      text: "Открыть стол",
      web_app: {
        url: button?.web_app.url
      }
    });
  });
});

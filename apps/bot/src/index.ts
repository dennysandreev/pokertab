import { APP_NAME } from "@pokertable/shared";
import { createServer } from "node:http";

const ROOM_START_PARAM_PREFIX = "room_";
const TELEGRAM_API_BASE_URL = "https://api.telegram.org";
const TELEGRAM_POLL_TIMEOUT_SECONDS = 25;

export type BotStatus = {
  ok: true;
  service: "bot";
};

export type BotCommandResponse = {
  text: string;
  button: {
    text: string;
    url: string;
  } | null;
};

type TelegramUpdate = {
  update_id: number;
  message?: {
    chat: {
      id: number;
    };
    text?: string;
  };
};

type TelegramApiResponse<T> = {
  ok: boolean;
  result?: T;
  description?: string;
};

export function getBotStatus(): BotStatus {
  return {
    ok: true,
    service: "bot"
  };
}

export function buildStartResponse(miniAppUrl: string): BotCommandResponse {
  return {
    text: [
      `👋 Привет! Это ${APP_NAME}.`,
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
      text: `Открыть ${APP_NAME}`,
      url: miniAppUrl
    }
  };
}

export function buildHelpResponse(): BotCommandResponse {
  return {
    text: "Приложение ничего не хранит и не переводит — только помогает вести учёт ребаев и итогов приватной игры.",
    button: null
  };
}

export function buildRoomInviteDeepLink(
  botUsername: string,
  inviteCode: string
): string {
  return `https://t.me/${botUsername}/app?startapp=${ROOM_START_PARAM_PREFIX}${inviteCode}`;
}

export function startBot(): void {
  const port = Number.parseInt(process.env.BOT_PORT ?? "3100", 10);
  const token = getRequiredEnv("TELEGRAM_BOT_TOKEN");
  const miniAppUrl = process.env.WEB_APP_URL?.trim() ?? "https://pokertab.ru";
  const status = getBotStatus();

  createServer((_request, response) => {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify(status));
  }).listen(port, () => {
    process.stdout.write(`[bot] ${status.service} service is ready on port ${port}\n`);
  });

  void pollTelegram(token, miniAppUrl);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  startBot();
}

async function pollTelegram(token: string, miniAppUrl: string): Promise<void> {
  let offset = 0;

  await telegramRequest(token, "deleteWebhook", {
    drop_pending_updates: true
  });
  await telegramRequest(token, "setMyCommands", {
    commands: [
      { command: "start", description: "Открыть Poker Table" },
      { command: "help", description: "Как это работает" }
    ]
  });

  while (true) {
    try {
      const updates = await telegramRequest<TelegramUpdate[]>(token, "getUpdates", {
        offset,
        timeout: TELEGRAM_POLL_TIMEOUT_SECONDS,
        allowed_updates: ["message"]
      });

      for (const update of updates) {
        offset = update.update_id + 1;
        await handleUpdate(token, miniAppUrl, update);
      }
    } catch (error) {
      process.stderr.write(`[bot] polling failed: ${getErrorMessage(error)}\n`);
      await delay(3000);
    }
  }
}

async function handleUpdate(
  token: string,
  miniAppUrl: string,
  update: TelegramUpdate
): Promise<void> {
  const message = update.message;

  if (!message) {
    return;
  }

  const text = message.text?.trim() ?? "";
  const response = text.startsWith("/help") ? buildHelpResponse() : buildStartResponse(miniAppUrl);

  await telegramRequest(token, "sendMessage", {
    chat_id: message.chat.id,
    text: response.text,
    reply_markup: response.button
      ? {
          inline_keyboard: [
            [
              {
                text: response.button.text,
                web_app: {
                  url: response.button.url
                }
              }
            ]
          ]
        }
      : undefined
  });
}

async function telegramRequest<T>(
  token: string,
  method: string,
  payload: Record<string, unknown>
): Promise<T> {
  const response = await fetch(`${TELEGRAM_API_BASE_URL}/bot${token}/${method}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
  const body = (await response.json()) as TelegramApiResponse<T>;

  if (!response.ok || !body.ok) {
    throw new Error(body.description ?? `Telegram request failed: ${method}`);
  }

  return body.result as T;
}

function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

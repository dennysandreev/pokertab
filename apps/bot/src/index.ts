import { APP_NAME } from "@pokertable/shared";
import { createServer } from "node:http";

const ROOM_START_PARAM_PREFIX = "room_";
const VIRTUAL_TABLE_START_PARAM_PREFIX = "virtual_table_";
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

export type VirtualTableInviteMessageParams = {
  botUsername: string;
  inviteCode: string;
  tableTitle: string;
};

export type VirtualTableNotificationParams = {
  tableTitle: string;
  miniAppUrl: string;
};

export type VirtualTableTimeoutNotificationParams = VirtualTableNotificationParams & {
  actionLabel: string;
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

export function buildVirtualTableInviteDeepLink(
  botUsername: string,
  inviteCode: string
): string {
  return `https://t.me/${botUsername}/app?startapp=${VIRTUAL_TABLE_START_PARAM_PREFIX}${inviteCode}`;
}

export function buildVirtualTableInviteMessage({
  botUsername,
  inviteCode,
  tableTitle
}: VirtualTableInviteMessageParams): BotCommandResponse {
  return {
    text: [
      `Готово: виртуальный стол «${tableTitle}».`,
      "",
      "Откройте приглашение в Telegram или отправьте код другу.",
      `Ссылка: ${buildVirtualTableInviteDeepLink(botUsername, inviteCode)}`,
      `Код: ${inviteCode}`
    ].join("\n"),
    button: {
      text: "Открыть приглашение",
      url: buildVirtualTableInviteDeepLink(botUsername, inviteCode)
    }
  };
}

export function buildVirtualReminderNotification({
  tableTitle,
  miniAppUrl
}: VirtualTableNotificationParams): BotCommandResponse {
  return {
    text: `Пора сделать ход за столом «${tableTitle}».`,
    button: {
      text: "Сделать ход",
      url: miniAppUrl
    }
  };
}

export function buildVirtualTimeoutNotification({
  tableTitle,
  actionLabel,
  miniAppUrl
}: VirtualTableTimeoutNotificationParams): BotCommandResponse {
  return {
    text: `В столе «${tableTitle}» время вышло. ${actionLabel}.`,
    button: {
      text: "Открыть стол",
      url: miniAppUrl
    }
  };
}

export function buildVirtualTableStartResponse(
  miniAppUrl: string,
  inviteCode: string
): BotCommandResponse {
  return {
    text: [
      "Вы открыли приглашение в виртуальный стол.",
      `Код стола: ${inviteCode}`,
      "",
      "Нажмите кнопку ниже, чтобы сразу перейти в игру."
    ].join("\n"),
    button: {
      text: "Открыть стол",
      url: miniAppUrl
    }
  };
}

export function resolveCommandResponse(
  text: string,
  miniAppUrl: string
): BotCommandResponse {
  if (text.startsWith("/help")) {
    return buildHelpResponse();
  }

  if (text.startsWith("/diag")) {
    return buildDiagnosticResponse(buildMiniAppPathUrl(miniAppUrl, "/mini-probe.html"));
  }

  const virtualTableInviteCode = getVirtualTableInviteCodeFromCommand(text);

  if (virtualTableInviteCode) {
    return buildVirtualTableStartResponse(miniAppUrl, virtualTableInviteCode);
  }

  return buildStartResponse(miniAppUrl);
}

export function buildDiagnosticResponse(miniAppUrl: string): BotCommandResponse {
  return {
    text: "Откройте проверочный экран. Он нужен, чтобы понять, запускается ли Mini App на этом телефоне.",
    button: {
      text: "Проверить загрузку",
      url: miniAppUrl
    }
  };
}

export function appendMiniAppCacheBuster(
  miniAppUrl: string,
  cacheBuster = Date.now().toString(36)
): string {
  try {
    const url = new URL(miniAppUrl);
    url.searchParams.set("ptb", cacheBuster);

    return url.toString();
  } catch {
    const separator = miniAppUrl.includes("?") ? "&" : "?";

    return `${miniAppUrl}${separator}ptb=${encodeURIComponent(cacheBuster)}`;
  }
}

export function buildMiniAppPathUrl(miniAppUrl: string, pathname: string): string {
  try {
    const url = new URL(miniAppUrl);
    url.pathname = pathname;

    return url.toString();
  } catch {
    const normalizedBase = miniAppUrl.endsWith("/") ? miniAppUrl.slice(0, -1) : miniAppUrl;
    const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`;

    return `${normalizedBase}${normalizedPath}`;
  }
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
      { command: "diag", description: "Проверить загрузку" },
      { command: "help", description: "Как это работает" }
    ]
  });
  await configureMiniAppMenuButton(token, appendMiniAppCacheBuster(miniAppUrl));

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
  const response = resolveCommandResponse(text, appendMiniAppCacheBuster(miniAppUrl));

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

async function configureMiniAppMenuButton(token: string, miniAppUrl: string): Promise<void> {
  try {
    await telegramRequest(token, "setChatMenuButton", {
      menu_button: {
        type: "web_app",
        text: APP_NAME,
        web_app: {
          url: miniAppUrl
        }
      }
    });
  } catch (error) {
    process.stderr.write(`[bot] menu button setup failed: ${getErrorMessage(error)}\n`);
  }
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

function getVirtualTableInviteCodeFromCommand(text: string): string | null {
  const match = text.match(/^\/start(?:@\w+)?\s+(virtual_table_[^\s]+)$/);
  const startParam = match?.[1];

  if (!startParam || startParam.length <= VIRTUAL_TABLE_START_PARAM_PREFIX.length) {
    return null;
  }

  return startParam.slice(VIRTUAL_TABLE_START_PARAM_PREFIX.length);
}

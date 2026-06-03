import { APP_NAME } from "@pokertable/shared";
import { createServer } from "node:http";

const ROOM_START_PARAM_PREFIX = "room_";
const VIRTUAL_TABLE_START_PARAM_PREFIX = "virtual_table_";
const CLUB_START_PARAM_PREFIX = "club_";
const CLUB_EVENT_RSVP_CALLBACK_PREFIX = "club_event_rsvp:";
const TELEGRAM_API_BASE_URL = "https://api.telegram.org";
const TELEGRAM_POLL_TIMEOUT_SECONDS = 25;
export const TELEGRAM_ALLOWED_UPDATES = ["message", "callback_query"] as const;

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

export type ClubEventRsvpStatus = "GOING" | "MAYBE" | "DECLINED";

export type ClubEventRsvpCallback = {
  eventId: string;
  status: ClubEventRsvpStatus;
};

export type ClubTelegramNotificationPayload = {
  text: string;
  reply_markup: {
    inline_keyboard: Array<
      Array<
        | {
            text: string;
            callback_data: string;
          }
        | {
            text: string;
            web_app: {
              url: string;
            };
          }
      >
    >;
  };
};

export type OfflineClubEventNotificationParams = {
  clubName: string;
  eventId: string;
  title: string;
  scheduledLabel: string;
  location: string;
  buyIn: string;
  miniAppUrl: string;
};

export type OnlineClubEventNotificationParams = {
  clubName: string;
  eventId: string;
  title: string;
  scheduledLabel: string;
  gameLabel: string;
  stackLabel: string;
  blindsLabel: string;
  miniAppUrl: string;
};

export type ClubTelegramRsvpApiResult = {
  status: "success" | "waitlist" | "cancelled" | "non-member";
  message?: string | null;
};

type TelegramUpdate = {
  update_id: number;
  message?: {
    chat: {
      id: number;
    };
    text?: string;
  };
  callback_query?: TelegramCallbackQuery;
};

type TelegramCallbackQuery = {
  id: string;
  from: {
    id: number;
  };
  data?: string;
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

export function buildClubInviteDeepLink(
  botUsername: string,
  inviteCode: string
): string {
  return `https://t.me/${botUsername}/app?startapp=${CLUB_START_PARAM_PREFIX}${inviteCode}`;
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

export function buildClubEventRsvpCallbackData(
  eventId: string,
  status: ClubEventRsvpStatus
): string {
  return `${CLUB_EVENT_RSVP_CALLBACK_PREFIX}${eventId}:${status}`;
}

export function parseClubEventRsvpCallback(
  data: string
): ClubEventRsvpCallback | null {
  const match = data.match(/^club_event_rsvp:([^:]+):(GOING|MAYBE|DECLINED)$/);

  if (!match) {
    return null;
  }

  return {
    eventId: match[1] ?? "",
    status: match[2] as ClubEventRsvpStatus
  };
}

export function buildOfflineClubEventNotificationPayload({
  clubName,
  eventId,
  title,
  scheduledLabel,
  location,
  buyIn,
  miniAppUrl
}: OfflineClubEventNotificationParams): ClubTelegramNotificationPayload {
  return {
    text: [
      `🃏 Новая игра в клубе ${clubName}`,
      "",
      title,
      scheduledLabel,
      `Место: ${location}`,
      `Ребай: ${buyIn}`,
      "",
      "Вы придете?"
    ].join("\n"),
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "✅ Приду",
            callback_data: buildClubEventRsvpCallbackData(eventId, "GOING")
          },
          {
            text: "❓ Возможно",
            callback_data: buildClubEventRsvpCallbackData(eventId, "MAYBE")
          },
          {
            text: "❌ Не смогу",
            callback_data: buildClubEventRsvpCallbackData(eventId, "DECLINED")
          }
        ],
        [
          {
            text: "Открыть мероприятие",
            web_app: {
              url: miniAppUrl
            }
          }
        ]
      ]
    }
  };
}

export function buildOnlineClubEventNotificationPayload({
  clubName,
  eventId,
  title,
  scheduledLabel,
  gameLabel,
  stackLabel,
  blindsLabel,
  miniAppUrl
}: OnlineClubEventNotificationParams): ClubTelegramNotificationPayload {
  return {
    text: [
      `♠️ Запланирован онлайн-стол в клубе ${clubName}`,
      "",
      title,
      `Старт: ${scheduledLabel}`,
      gameLabel,
      `Стек: ${stackLabel}`,
      `Блайнды: ${blindsLabel}`,
      "",
      "Будете играть?"
    ].join("\n"),
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "✅ Играю",
            callback_data: buildClubEventRsvpCallbackData(eventId, "GOING")
          },
          {
            text: "❌ Не смогу",
            callback_data: buildClubEventRsvpCallbackData(eventId, "DECLINED")
          }
        ],
        [
          {
            text: "Открыть стол",
            web_app: {
              url: miniAppUrl
            }
          }
        ]
      ]
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
        allowed_updates: TELEGRAM_ALLOWED_UPDATES
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
  const callbackQuery = update.callback_query;

  if (callbackQuery) {
    await handleCallbackQuery(token, callbackQuery);
    return;
  }

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

export async function handleCallbackQuery(
  token: string,
  callbackQuery: TelegramCallbackQuery
): Promise<void> {
  const callbackData = callbackQuery.data?.trim() ?? "";
  const parsedCallback = parseClubEventRsvpCallback(callbackData);

  if (!parsedCallback) {
    return;
  }

  const result = await submitClubEventRsvp({
    apiBaseUrl: getApiBaseUrl(),
    botToken: token,
    eventId: parsedCallback.eventId,
    telegramId: callbackQuery.from.id,
    status: parsedCallback.status
  });

  await telegramRequest(token, "answerCallbackQuery", {
    callback_query_id: callbackQuery.id,
    text: buildClubEventRsvpAnswerText(result, parsedCallback.status)
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

export function buildClubEventRsvpAnswerText(
  result: ClubTelegramRsvpApiResult,
  requestedStatus: ClubEventRsvpStatus
): string {
  const message = result.message?.trim();

  if (message) {
    return message;
  }

  switch (result.status) {
    case "success":
      return `Готово. Ваш ответ: ${getRsvpStatusLabel(requestedStatus)}.`;
    case "waitlist":
      return "Места закончились. Вы добавлены в лист ожидания.";
    case "cancelled":
      return "Мероприятие отменено.";
    case "non-member":
      return "Вы не являетесь участником этого клуба.";
  }
}

export function getApiBaseUrl(): string {
  const apiUrl = process.env.API_URL?.trim();

  if (apiUrl) {
    return apiUrl;
  }

  const webAppUrl = process.env.WEB_APP_URL?.trim();

  if (!webAppUrl) {
    return "https://pokertab.ru";
  }

  try {
    return new URL(webAppUrl).origin;
  } catch {
    return webAppUrl;
  }
}

export async function submitClubEventRsvp(params: {
  apiBaseUrl: string;
  botToken: string;
  eventId: string;
  telegramId: number;
  status: ClubEventRsvpStatus;
}): Promise<ClubTelegramRsvpApiResult> {
  const response = await fetch(new URL("/api/clubs/telegram/rsvp", params.apiBaseUrl), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-telegram-bot-token": params.botToken
    },
    body: JSON.stringify({
      eventId: params.eventId,
      telegramId: params.telegramId,
      status: params.status
    })
  });
  const body = (await response.json()) as ClubTelegramRsvpApiResult & {
    error?: string;
  };

  if (!response.ok) {
    throw new Error(body.message?.trim() || body.error || "Club RSVP request failed");
  }

  return body;
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

function getRsvpStatusLabel(status: ClubEventRsvpStatus): string {
  switch (status) {
    case "GOING":
      return "Приду";
    case "MAYBE":
      return "Возможно";
    case "DECLINED":
      return "Не смогу";
  }
}

function getVirtualTableInviteCodeFromCommand(text: string): string | null {
  const match = text.match(/^\/start(?:@\w+)?\s+(virtual_table_[^\s]+)$/);
  const startParam = match?.[1];

  if (!startParam || startParam.length <= VIRTUAL_TABLE_START_PARAM_PREFIX.length) {
    return null;
  }

  return startParam.slice(VIRTUAL_TABLE_START_PARAM_PREFIX.length);
}

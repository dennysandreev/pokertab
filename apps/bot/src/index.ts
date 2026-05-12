import { APP_NAME } from "@pokertable/shared";

const ROOM_START_PARAM_PREFIX = "room_";

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
  const status = getBotStatus();

  process.stdout.write(`[bot] ${status.service} service is ready on port ${port}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  startBot();
}

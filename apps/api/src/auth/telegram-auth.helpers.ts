import { createHmac, timingSafeEqual } from "node:crypto";
import { HttpStatus } from "@nestjs/common";
import { ApiError } from "../shared/api-error";
import { AUTH_ERROR_CODES } from "./auth.constants";
import type { TelegramMiniAppUser, ValidatedTelegramInitData } from "./auth.types";

type TelegramValidationOptions = {
  initData: string;
  botToken: string;
  maxAgeSeconds: number;
  now: Date;
};

type TelegramRawUser = {
  id?: number | string;
  username?: string;
  first_name?: string;
  last_name?: string;
  photo_url?: string;
};

export function parseInitData(initData: string): Map<string, string> {
  const params = new URLSearchParams(initData);
  const entries = new Map<string, string>();

  for (const [key, value] of params.entries()) {
    entries.set(key, value);
  }

  return entries;
}

export function buildDataCheckString(entries: Map<string, string>): string {
  return [...entries.entries()]
    .filter(([key]) => key !== "hash")
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
}

export function createTelegramHash(initData: string, botToken: string): string {
  const entries = parseInitData(initData);
  const dataCheckString = buildDataCheckString(entries);
  const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest();

  return createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
}

export function validateTelegramInitData({
  initData,
  botToken,
  maxAgeSeconds,
  now
}: TelegramValidationOptions): ValidatedTelegramInitData {
  const entries = parseInitData(initData);
  const hash = entries.get("hash");

  if (!hash) {
    throw new ApiError(
      AUTH_ERROR_CODES.invalidInitData,
      "Не удалось подтвердить вход через Telegram",
      HttpStatus.UNAUTHORIZED
    );
  }

  const expectedHash = createTelegramHash(initData, botToken);

  if (!safeCompare(hash, expectedHash)) {
    throw new ApiError(
      AUTH_ERROR_CODES.invalidInitData,
      "Не удалось подтвердить вход через Telegram",
      HttpStatus.UNAUTHORIZED
    );
  }

  const authDateRaw = entries.get("auth_date");

  if (!authDateRaw) {
    throw new ApiError(
      AUTH_ERROR_CODES.invalidInitData,
      "Не удалось подтвердить вход через Telegram",
      HttpStatus.UNAUTHORIZED
    );
  }

  const authDateSeconds = Number.parseInt(authDateRaw, 10);

  if (!Number.isFinite(authDateSeconds)) {
    throw new ApiError(
      AUTH_ERROR_CODES.invalidInitData,
      "Не удалось подтвердить вход через Telegram",
      HttpStatus.UNAUTHORIZED
    );
  }

  const nowSeconds = Math.floor(now.getTime() / 1000);

  if (nowSeconds - authDateSeconds > maxAgeSeconds) {
    throw new ApiError(
      AUTH_ERROR_CODES.initDataExpired,
      "Сессия Telegram устарела. Откройте приложение заново",
      HttpStatus.UNAUTHORIZED
    );
  }

  const user = parseTelegramUser(entries.get("user"));

  return {
    authDate: new Date(authDateSeconds * 1000),
    queryId: entries.get("query_id") ?? null,
    startParam: entries.get("start_param") ?? null,
    user
  };
}

export function parseTelegramUser(rawUser: string | null | undefined): TelegramMiniAppUser {
  if (!rawUser) {
    throw new ApiError(
      AUTH_ERROR_CODES.invalidUserPayload,
      "Не удалось получить профиль Telegram",
      HttpStatus.UNAUTHORIZED
    );
  }

  let parsedUser: TelegramRawUser;

  try {
    parsedUser = JSON.parse(rawUser) as TelegramRawUser;
  } catch {
    throw new ApiError(
      AUTH_ERROR_CODES.invalidUserPayload,
      "Не удалось получить профиль Telegram",
      HttpStatus.UNAUTHORIZED
    );
  }

  if (parsedUser.id === undefined || parsedUser.id === null) {
    throw new ApiError(
      AUTH_ERROR_CODES.invalidUserPayload,
      "Не удалось получить профиль Telegram",
      HttpStatus.UNAUTHORIZED
    );
  }

  return {
    id: String(parsedUser.id),
    username: normalizeOptionalValue(parsedUser.username),
    firstName: normalizeOptionalValue(parsedUser.first_name),
    lastName: normalizeOptionalValue(parsedUser.last_name),
    avatarUrl: normalizeOptionalValue(parsedUser.photo_url)
  };
}

function normalizeOptionalValue(value: string | undefined): string | null {
  return value && value.trim().length > 0 ? value : null;
}

function safeCompare(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

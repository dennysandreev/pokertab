import { HttpStatus } from "@nestjs/common";
import type {
  CancelRebuyRequestDto,
  CloseSettlementRequestDto,
  CreateRoomRequestDto,
  CreateRebuyRequestDto,
  GameType,
  JoinRoomRequestDto,
  RebuyPermission,
  SubmitFinalChipsRequestDto,
  SettlementFinalAmountInputDto,
  SettlementPreviewRequestDto
} from "@pokertable/shared";
import { ApiError } from "../shared/api-error";
import { ROOM_ERROR_CODES } from "./rooms.constants";

export function normalizeCreateRoomRequest(body: unknown): CreateRoomRequestDto {
  const payload = getRecord(body);
  const title = getString(payload.title, "Укажите название игры").trim();
  const currency = getString(payload.currency, "Выберите валюту").trim().toUpperCase();
  const buyInChips = getIntegerString(
    payload.buyInChips,
    "Стартовый стек должен быть больше нуля"
  );
  const rebuyChips = getIntegerString(payload.rebuyChips, "Ребай должен быть больше нуля");
  const chipsPerCurrencyUnit = getIntegerString(
    payload.chipsPerCurrencyUnit,
    "Укажите, сколько фишек соответствует одной единице валюты"
  );
  const gameType = getString(payload.gameType, "Не удалось определить формат игры")
    .trim() as GameType;
  const rebuyPermission = getString(
    payload.rebuyPermission,
    "Не удалось определить правила ребаев"
  ).trim() as RebuyPermission;
  const clubId = normalizeNullableString(payload.clubId);
  const scheduledStartAt = normalizeNullableString(payload.scheduledStartAt);
  const sendClubInvites = getOptionalBoolean(payload.sendClubInvites) ?? false;
  const maxPlayers = getOptionalInteger(payload.maxPlayers);
  const location = normalizeNullableString(payload.location);

  return {
    title,
    currency,
    buyInChips,
    rebuyChips,
    chipsPerCurrencyUnit,
    gameType,
    rebuyPermission,
    ...(clubId !== undefined ? { clubId } : {}),
    ...(scheduledStartAt !== undefined ? { scheduledStartAt } : {}),
    ...(sendClubInvites ? { sendClubInvites } : {}),
    ...(maxPlayers !== undefined ? { maxPlayers } : {}),
    ...(location !== undefined ? { location } : {})
  };
}

export function normalizeJoinRoomRequest(body: unknown): JoinRoomRequestDto {
  const payload = getRecord(body);
  const inviteCode = getString(payload.inviteCode, "Нужен код приглашения").trim();

  if (inviteCode.length === 0) {
    throw invalidInput("Нужен код приглашения");
  }

  return {
    inviteCode
  };
}

export function normalizeCreateRebuyRequest(body: unknown): CreateRebuyRequestDto {
  const payload = getRecord(body);
  const roomPlayerId = getString(payload.roomPlayerId, "Не удалось определить игрока").trim();
  const idempotencyKey = getString(
    payload.idempotencyKey,
    "Не получилось подтвердить действие. Попробуйте ещё раз."
  ).trim();

  if (roomPlayerId.length === 0) {
    throw invalidInput("Не удалось определить игрока");
  }

  if (idempotencyKey.length === 0) {
    throw invalidInput("Не получилось подтвердить действие. Попробуйте ещё раз.");
  }

  return {
    roomPlayerId,
    idempotencyKey
  };
}

export function normalizeCancelRebuyRequest(body: unknown): CancelRebuyRequestDto {
  const payload = getRecord(body);
  const idempotencyKey = getString(
    payload.idempotencyKey,
    "Не получилось подтвердить действие. Попробуйте ещё раз."
  ).trim();
  const reason = getOptionalString(payload.reason)?.trim() || null;

  if (idempotencyKey.length === 0) {
    throw invalidInput("Не получилось подтвердить действие. Попробуйте ещё раз.");
  }

  return {
    idempotencyKey,
    reason
  };
}

export function normalizeSettlementPreviewRequest(
  body: unknown
): SettlementPreviewRequestDto {
  const payload = getRecord(body);
  const finalAmountsValue = payload.finalAmounts;

  if (!Array.isArray(finalAmountsValue)) {
    throw invalidInput("Нужны финальные суммы всех игроков");
  }

  return {
    finalAmounts: finalAmountsValue.map(normalizeSettlementFinalAmount)
  };
}

export function normalizeCloseSettlementRequest(body: unknown): CloseSettlementRequestDto {
  return normalizeSettlementPreviewRequest(body);
}

export function normalizeSubmitFinalChipsRequest(
  body: unknown
): SubmitFinalChipsRequestDto {
  const payload = getRecord(body);
  const finalAmountChips = getIntegerString(
    payload.finalAmountChips,
    "Сколько фишек у вас осталось?"
  );

  if (!/^\d+$/.test(finalAmountChips)) {
    throw invalidInput("Сколько фишек у вас осталось?");
  }

  return {
    finalAmountChips
  };
}

function getRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw invalidInput("Некорректные данные комнаты");
  }

  return value as Record<string, unknown>;
}

function getString(value: unknown, message: string): string {
  if (typeof value !== "string") {
    throw invalidInput(message);
  }

  return value;
}

function getIntegerString(value: unknown, message: string): string {
  if (typeof value === "number") {
    if (!Number.isInteger(value)) {
      throw invalidInput(message);
    }

    return String(value);
  }

  if (typeof value !== "string") {
    throw invalidInput(message);
  }

  return value.trim();
}

function getOptionalString(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== "string") {
    throw invalidInput("Некорректные данные комнаты");
  }

  return value;
}

function normalizeNullableString(value: unknown): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw invalidInput("Некорректные данные комнаты");
  }

  const normalized = value.trim();

  return normalized.length > 0 ? normalized : null;
}

function getOptionalBoolean(value: unknown): boolean | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== "boolean") {
    throw invalidInput("Некорректные данные комнаты");
  }

  return value;
}

function getOptionalInteger(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw invalidInput("Некорректные данные комнаты");
  }

  return value;
}

function normalizeSettlementFinalAmount(value: unknown): SettlementFinalAmountInputDto {
  const payload = getRecord(value);
  const roomPlayerId = getString(payload.roomPlayerId, "Не удалось определить игрока").trim();
  const finalAmountChips = getIntegerString(
    payload.finalAmountChips,
    "Финальный стек должен быть нулём или больше"
  );

  if (roomPlayerId.length === 0) {
    throw invalidInput("Не удалось определить игрока");
  }

  if (!/^\d+$/.test(finalAmountChips)) {
    throw invalidInput("Финальный стек должен быть нулём или больше");
  }

  return {
    roomPlayerId,
    finalAmountChips
  };
}

function invalidInput(message: string): ApiError {
  return new ApiError(ROOM_ERROR_CODES.invalidInput, message, HttpStatus.BAD_REQUEST);
}

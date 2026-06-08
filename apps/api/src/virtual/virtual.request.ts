import { HttpStatus } from "@nestjs/common";
import type {
  CreateVirtualTableRequestDto,
  GetVirtualHandHistoriesQueryDto,
  GetVirtualLeaderboardQueryDto,
  LeaderboardPeriod,
  LeaderboardScope,
  JoinVirtualTableRequestDto,
  RaiseVirtualBlindsRequestDto,
  RequestVirtualSitOutRequestDto,
  SubmitVirtualActionRequestDto,
  SubmitVirtualReactionRequestDto,
  VirtualActionType,
  VirtualTimeoutAutoActionRule
} from "@pokertable/shared";
import { LEADERBOARD_PERIODS, LEADERBOARD_SCOPES } from "@pokertable/shared";
import { ApiError } from "../shared/api-error";
import { VIRTUAL_ERROR_CODES } from "./virtual.constants";
import { decodeVirtualLeaderboardCursor } from "./virtual-leaderboard-cursor";

export function normalizeCreateVirtualTableRequest(
  body: unknown
): CreateVirtualTableRequestDto {
  const payload = getRecord(body);
  const title = getString(payload.title, "Как назвать стол?").trim();
  const maxSeats = getInteger(payload.maxSeats, "Выберите от 2 до 9 мест");
  const startingStackChips = getIntegerString(
    payload.startingStackChips,
    "Стартовый стек должен быть больше нуля"
  );
  const chipValueMinor = getOptionalIntegerString(payload.chipValueMinor);
  const chipValueCurrency = getOptionalString(payload.chipValueCurrency)?.trim().toUpperCase() ?? null;
  const smallBlindChips = getIntegerString(
    payload.smallBlindChips,
    "Малый блайнд должен быть больше нуля"
  );
  const bigBlindChips = getIntegerString(
    payload.bigBlindChips,
    "Большой блайнд должен быть больше нуля"
  );
  const turnDurationSeconds = getInteger(
    payload.turnDurationSeconds,
    "Укажите время на ход в секундах"
  );
  const reminderDelaySeconds = getInteger(
    payload.reminderDelaySeconds,
    "Укажите, когда присылать напоминание"
  );
  const timeoutAutoActionRule = getString(
    payload.timeoutAutoActionRule,
    "Не удалось определить действие по тайм-ауту"
  ).trim() as VirtualTimeoutAutoActionRule;
  const winProbabilityEnabled = getOptionalBoolean(payload.winProbabilityEnabled) ?? false;
  const isPrivate = getOptionalBoolean(payload.isPrivate) ?? false;
  const clubId = normalizeNullableString(payload.clubId);
  const scheduledStartAt = normalizeNullableString(payload.scheduledStartAt);
  const sendClubInvites = getOptionalBoolean(payload.sendClubInvites) ?? false;
  const maxPlayers = getOptionalInteger(payload.maxPlayers);

  if (turnDurationSeconds <= 0 || reminderDelaySeconds <= 0) {
    throw invalidInput("Время должно быть больше нуля");
  }

  if (reminderDelaySeconds >= turnDurationSeconds) {
    throw invalidInput("Напоминание должно прийти раньше тайм-аута");
  }

  return {
    title,
    maxSeats,
    startingStackChips,
    chipValueMinor,
    chipValueCurrency,
    smallBlindChips,
    bigBlindChips,
    turnDurationSeconds,
    reminderDelaySeconds,
    timeoutAutoActionRule,
    winProbabilityEnabled,
    isPrivate,
    ...(clubId !== undefined ? { clubId } : {}),
    ...(scheduledStartAt !== undefined ? { scheduledStartAt } : {}),
    ...(sendClubInvites ? { sendClubInvites } : {}),
    ...(maxPlayers !== undefined ? { maxPlayers } : {})
  };
}

export function normalizeJoinVirtualTableRequest(
  body: unknown
): JoinVirtualTableRequestDto {
  const payload = getRecord(body);
  const inviteCode = getString(payload.inviteCode, "Нужен код приглашения").trim();

  if (inviteCode.length === 0) {
    throw invalidInput("Нужен код приглашения");
  }

  return {
    inviteCode
  };
}

export function normalizeSubmitVirtualActionRequest(
  body: unknown
): SubmitVirtualActionRequestDto {
  const payload = getRecord(body);
  const handId = getString(payload.handId, "Не удалось определить раздачу").trim();
  const actionType = getString(payload.actionType, "Не удалось определить действие").trim() as VirtualActionType;
  const amountChips = getOptionalIntegerString(payload.amountChips);
  const idempotencyKey = getString(
    payload.idempotencyKey,
    "Не получилось подтвердить действие. Попробуйте ещё раз."
  ).trim();

  if (handId.length === 0) {
    throw invalidInput("Не удалось определить раздачу");
  }

  if (idempotencyKey.length === 0) {
    throw invalidInput("Не получилось подтвердить действие. Попробуйте ещё раз.");
  }

  return {
    handId,
    actionType,
    ...(amountChips ? { amountChips } : {}),
    idempotencyKey
  };
}

export function normalizeSubmitVirtualReactionRequest(
  body: unknown
): SubmitVirtualReactionRequestDto {
  const payload = getRecord(body);
  const emoji = getString(payload.emoji, "Не удалось прочитать реакцию").trim();

  if (emoji.length === 0) {
    throw invalidInput("Не удалось прочитать реакцию");
  }

  return {
    emoji
  };
}

export function normalizeRaiseVirtualBlindsRequest(
  body: unknown
): RaiseVirtualBlindsRequestDto {
  const payload = getRecord(body);

  return {
    smallBlindChips: getIntegerString(
      payload.smallBlindChips,
      "Малый блайнд должен быть больше нуля"
    ),
    bigBlindChips: getIntegerString(
      payload.bigBlindChips,
      "Большой блайнд должен быть больше нуля"
    )
  };
}

export function normalizeRequestVirtualSitOutRequest(
  body: unknown
): RequestVirtualSitOutRequestDto {
  const payload = getRecord(body);

  return {
    autoCheck: getBoolean(payload.autoCheck, "Не удалось сохранить авто-чек"),
    autoFold: getBoolean(payload.autoFold, "Не удалось сохранить авто-фолд")
  };
}

export function normalizeGetVirtualLeaderboardQuery(
  query: unknown
): GetVirtualLeaderboardQueryDto {
  const payload = getOptionalRecord(query);
  const scope = getOptionalLeaderboardScope(payload.scope) ?? "all";
  const period = getOptionalLeaderboardPeriod(payload.period) ?? "all-time";
  const limit = getOptionalBoundedInteger(payload.limit, 1, 100) ?? 50;
  const cursor = getOptionalString(payload.cursor)?.trim() ?? null;

  if (cursor && cursor.length > 0) {
    decodeVirtualLeaderboardCursor(cursor);
  }

  return {
    scope,
    period,
    limit,
    cursor: cursor && cursor.length > 0 ? cursor : null
  };
}

export function normalizeVirtualLeaderboardPeriodQuery(
  query: unknown
): LeaderboardPeriod {
  const payload = getOptionalRecord(query);

  return getOptionalLeaderboardPeriod(payload.period) ?? "all-time";
}

export function normalizeGetVirtualHandHistoriesQuery(
  query: unknown
): GetVirtualHandHistoriesQueryDto {
  const payload = getOptionalRecord(query);
  const limit = getOptionalBoundedInteger(payload.limit, 1, 100) ?? 20;
  const cursor = normalizeHandHistoriesCursor(payload.cursor);

  return {
    limit,
    cursor
  };
}

function normalizeHandHistoriesCursor(value: unknown): string | null {
  const cursor = getOptionalString(value)?.trim() ?? null;

  if (!cursor || cursor.length === 0) {
    return null;
  }

  if (!/^\d+$/.test(cursor) || Number(cursor) <= 0) {
    throw invalidInput("Курсор истории раздач должен быть положительным числом");
  }

  return String(Number(cursor));
}

function getRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw invalidInput("Некорректные данные стола");
  }

  return value as Record<string, unknown>;
}

function getOptionalRecord(value: unknown): Record<string, unknown> {
  if (value === null || value === undefined) {
    return {};
  }

  return getRecord(value);
}

function getString(value: unknown, message: string): string {
  if (typeof value !== "string") {
    throw invalidInput(message);
  }

  return value;
}

function getOptionalString(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== "string") {
    throw invalidInput("Некорректные данные стола");
  }

  return value;
}

function getOptionalBoolean(value: unknown): boolean | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== "boolean") {
    throw invalidInput("Некорректные данные стола");
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
    throw invalidInput("Некорректные данные стола");
  }

  const normalized = value.trim();

  return normalized.length > 0 ? normalized : null;
}

function getOptionalInteger(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw invalidInput("Некорректные данные стола");
  }

  return value;
}

function getOptionalLeaderboardScope(value: unknown): LeaderboardScope | null {
  const scope = getOptionalString(value)?.trim() ?? null;

  if (scope === null || scope.length === 0) {
    return null;
  }

  if ((LEADERBOARD_SCOPES as readonly string[]).includes(scope)) {
    return scope as LeaderboardScope;
  }

  throw invalidInput("Не удалось определить область лидерборда");
}

function getOptionalLeaderboardPeriod(value: unknown): LeaderboardPeriod | null {
  const period = getOptionalString(value)?.trim() ?? null;

  if (period === null || period.length === 0) {
    return null;
  }

  if ((LEADERBOARD_PERIODS as readonly string[]).includes(period)) {
    return period as LeaderboardPeriod;
  }

  throw invalidInput("Не удалось определить период");
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

function getOptionalIntegerString(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();

    return trimmed.length === 0 ? null : trimmed;
  }

  if (typeof value === "number" && Number.isInteger(value)) {
    return String(value);
  }

  throw invalidInput("Некорректные данные стола");
}

function getInteger(value: unknown, message: string): number {
  if (typeof value === "number") {
    if (!Number.isInteger(value)) {
      throw invalidInput(message);
    }

    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);

    if (Number.isInteger(parsed)) {
      return parsed;
    }
  }

  throw invalidInput(message);
}

function getBoolean(value: unknown, message: string): boolean {
  if (typeof value !== "boolean") {
    throw invalidInput(message);
  }

  return value;
}

function getOptionalBoundedInteger(
  value: unknown,
  min: number,
  max: number
): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = getInteger(value, `Покажу от ${min} до ${max} игроков`);

  if (parsed < min || parsed > max) {
    throw invalidInput(`Покажу от ${min} до ${max} игроков`);
  }

  return parsed;
}

function invalidInput(message: string): ApiError {
  return new ApiError(VIRTUAL_ERROR_CODES.invalidInput, message, HttpStatus.BAD_REQUEST);
}

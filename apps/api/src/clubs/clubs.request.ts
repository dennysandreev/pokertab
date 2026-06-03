import { HttpStatus } from "@nestjs/common";
import type {
  ClubEventRsvpStatus,
  ClubMemberRole,
  ClubMemberStatus,
  CreateClubRequestDto,
  GetClubEventsQueryDto,
  JoinClubRequestDto,
  TelegramClubEventRsvpRequestDto,
  UpdateClubEventRsvpRequestDto,
  UpdateClubMemberRequestDto,
  UpdateClubRequestDto
} from "@pokertable/shared";
import {
  CLUB_EVENT_RSVP_STATUSES,
  CLUB_MEMBER_ROLES,
  CLUB_MEMBER_STATUSES
} from "@pokertable/shared";
import { ApiError } from "../shared/api-error";
import { CLUB_ERROR_CODES } from "./clubs.constants";

export function normalizeCreateClubRequest(body: unknown): CreateClubRequestDto {
  const payload = getRecord(body);
  const name = getString(payload.name, "Как назвать клуб?").trim();
  const description = getOptionalString(payload.description)?.trim() || null;
  const defaultCurrency =
    getOptionalString(payload.defaultCurrency)?.trim().toUpperCase() || null;

  if (name.length === 0) {
    throw invalidInput("Как назвать клуб?");
  }

  return {
    name,
    description,
    defaultCurrency
  };
}

export function normalizeUpdateClubRequest(body: unknown): UpdateClubRequestDto {
  const payload = getRecord(body);
  const name = getOptionalString(payload.name)?.trim();
  const description = normalizeNullableString(payload.description);
  const defaultCurrency = normalizeNullableUppercaseString(payload.defaultCurrency);

  if (name !== undefined && name.length === 0) {
    throw invalidInput("Как назвать клуб?");
  }

  if (name === undefined && description === undefined && defaultCurrency === undefined) {
    throw invalidInput("Не удалось понять, что вы хотите изменить");
  }

  return {
    ...(name !== undefined ? { name } : {}),
    ...(description !== undefined ? { description } : {}),
    ...(defaultCurrency !== undefined ? { defaultCurrency } : {})
  };
}

export function normalizeJoinClubRequest(body: unknown): JoinClubRequestDto {
  const payload = getOptionalRecord(body);
  const inviteCode = getOptionalString(payload.inviteCode)?.trim() || null;

  return {
    inviteCode
  };
}

export function normalizeUpdateClubMemberRequest(body: unknown): UpdateClubMemberRequestDto {
  const payload = getRecord(body);
  const role = getOptionalEnum<ClubMemberRole>(
    payload.role,
    CLUB_MEMBER_ROLES,
    "Не удалось определить роль участника"
  );
  const status = getOptionalEnum<ClubMemberStatus>(
    payload.status,
    CLUB_MEMBER_STATUSES,
    "Не удалось определить статус участника"
  );

  if (!role && !status) {
    throw invalidInput("Не удалось понять, что вы хотите изменить");
  }

  return {
    ...(role ? { role } : {}),
    ...(status ? { status } : {})
  };
}

export function normalizeGetClubEventsQuery(query: unknown): GetClubEventsQueryDto {
  const payload = getOptionalRecord(query);
  const type = getOptionalString(payload.type)?.trim() || "all";
  const status = getOptionalString(payload.status)?.trim() || "all";

  if (!["all", "offline", "online"].includes(type)) {
    throw invalidInput("Не удалось определить тип мероприятий");
  }

  if (!["all", "upcoming", "completed", "cancelled"].includes(status)) {
    throw invalidInput("Не удалось определить статус мероприятий");
  }

  return {
    type: type as GetClubEventsQueryDto["type"],
    status: status as GetClubEventsQueryDto["status"]
  };
}

export function normalizeUpdateClubEventRsvpRequest(
  body: unknown
): UpdateClubEventRsvpRequestDto {
  const payload = getRecord(body);
  const status = getEnum<ClubEventRsvpStatus>(
    payload.status,
    CLUB_EVENT_RSVP_STATUSES,
    "Не удалось определить ваш ответ"
  );

  return {
    status
  };
}

export function normalizeTelegramClubEventRsvpRequest(
  body: unknown
): TelegramClubEventRsvpRequestDto {
  const payload = getRecord(body);
  const eventId = getString(payload.eventId, "Не удалось определить мероприятие").trim();
  const telegramId = getString(payload.telegramId, "Не удалось определить пользователя").trim();
  const status = getEnum<Extract<ClubEventRsvpStatus, "GOING" | "MAYBE" | "DECLINED">>(
    payload.status,
    ["GOING", "MAYBE", "DECLINED"],
    "Не удалось определить ответ участника"
  );

  if (eventId.length === 0) {
    throw invalidInput("Не удалось определить мероприятие");
  }

  if (telegramId.length === 0) {
    throw invalidInput("Не удалось определить пользователя");
  }

  return {
    eventId,
    telegramId,
    status
  };
}

function getRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw invalidInput("Некорректные данные клуба");
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

function getOptionalString(value: unknown): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return "";
  }

  if (typeof value !== "string") {
    throw invalidInput("Некорректные данные клуба");
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
    throw invalidInput("Некорректные данные клуба");
  }

  const normalized = value.trim();

  return normalized.length > 0 ? normalized : null;
}

function normalizeNullableUppercaseString(
  value: unknown
): string | null | undefined {
  const normalized = normalizeNullableString(value);

  return typeof normalized === "string" ? normalized.toUpperCase() : normalized;
}

function getEnum<T extends string>(
  value: unknown,
  allowedValues: readonly T[],
  message: string
): T {
  if (typeof value !== "string") {
    throw invalidInput(message);
  }

  const normalized = value.trim();

  if (!allowedValues.includes(normalized as T)) {
    throw invalidInput(message);
  }

  return normalized as T;
}

function getOptionalEnum<T extends string>(
  value: unknown,
  allowedValues: readonly T[],
  message: string
): T | undefined {
  if (value === undefined) {
    return undefined;
  }

  return getEnum(value, allowedValues, message);
}

function invalidInput(message: string): ApiError {
  return new ApiError(CLUB_ERROR_CODES.invalidInput, message, HttpStatus.BAD_REQUEST);
}

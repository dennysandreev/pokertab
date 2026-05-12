import { HttpStatus } from "@nestjs/common";
import type {
  GetLeaderboardQueryDto,
  LeaderboardPeriod,
  LeaderboardScope
} from "@pokertable/shared";
import { ApiError } from "../shared/api-error";
import {
  DEFAULT_LEADERBOARD_LIMIT,
  MAX_LEADERBOARD_LIMIT,
  PLAYER_STATS_ERROR_CODES
} from "./player-stats.constants";

const LEADERBOARD_SCOPES: readonly LeaderboardScope[] = ["all", "played-with-me"] as const;
const LEADERBOARD_PERIODS: readonly LeaderboardPeriod[] = [
  "all-time",
  "month",
  "last-10"
] as const;

export function normalizeGetLeaderboardQuery(query: unknown): GetLeaderboardQueryDto {
  const payload = getRecord(query);
  const scope = getOptionalString(payload.scope)?.trim() ?? "all";
  const period = getOptionalString(payload.period)?.trim() ?? "all-time";
  const limitValue = getOptionalString(payload.limit)?.trim();
  const cursorValue = getOptionalString(payload.cursor)?.trim() ?? null;

  if (!LEADERBOARD_SCOPES.includes(scope as LeaderboardScope)) {
    throw invalidInput("Не удалось определить список игроков");
  }

  if (!LEADERBOARD_PERIODS.includes(period as LeaderboardPeriod)) {
    throw invalidInput("Не удалось определить период");
  }

  let limit = DEFAULT_LEADERBOARD_LIMIT;

  if (limitValue !== undefined) {
    if (!/^\d+$/.test(limitValue) || Number(limitValue) <= 0) {
      throw invalidInput("Лимит должен быть больше нуля");
    }

    limit = Math.min(Number(limitValue), MAX_LEADERBOARD_LIMIT);
  }

  return {
    scope: scope as LeaderboardScope,
    period: period as LeaderboardPeriod,
    limit,
    cursor: cursorValue && cursorValue.length > 0 ? cursorValue : null
  };
}

function getRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw invalidInput("Некорректные параметры списка игроков");
  }

  return value as Record<string, unknown>;
}

function getOptionalString(value: unknown): string | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw invalidInput("Некорректные параметры списка игроков");
  }

  return value;
}

function invalidInput(message: string): ApiError {
  return new ApiError(PLAYER_STATS_ERROR_CODES.invalidInput, message, HttpStatus.BAD_REQUEST);
}

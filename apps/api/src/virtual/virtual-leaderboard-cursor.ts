import { HttpStatus } from "@nestjs/common";
import { ApiError } from "../shared/api-error";
import { VIRTUAL_ERROR_CODES } from "./virtual.constants";

export type VirtualLeaderboardCursor = {
  onlinePokerScore: number;
  handsPlayed: number;
  netChips: bigint;
  userId: string;
};

type VirtualLeaderboardCursorJson = {
  onlinePokerScore: number;
  handsPlayed: number;
  netChips: string;
  userId: string;
};

const LEADERBOARD_CURSOR_ERROR_MESSAGE = "Не удалось прочитать курсор лидерборда";

export function encodeVirtualLeaderboardCursor(
  cursor: VirtualLeaderboardCursor
): string {
  const payload: VirtualLeaderboardCursorJson = {
    onlinePokerScore: cursor.onlinePokerScore,
    handsPlayed: cursor.handsPlayed,
    netChips: cursor.netChips.toString(),
    userId: cursor.userId
  };

  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export function decodeVirtualLeaderboardCursor(
  value: string
): VirtualLeaderboardCursor {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) {
    throw invalidCursor();
  }

  let payload: unknown;

  try {
    payload = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
  } catch {
    throw invalidCursor();
  }

  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    throw invalidCursor();
  }

  const record = payload as Record<string, unknown>;
  const onlinePokerScore = getInteger(record.onlinePokerScore);
  const handsPlayed = getInteger(record.handsPlayed);
  const netChips = getBigInt(record.netChips);
  const userId = getNonEmptyString(record.userId);

  return {
    onlinePokerScore,
    handsPlayed,
    netChips,
    userId
  };
}

function getInteger(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value)) {
    throw invalidCursor();
  }

  return value;
}

function getBigInt(value: unknown): bigint {
  if (typeof value !== "string" || !/^-?\d+$/.test(value)) {
    throw invalidCursor();
  }

  try {
    return BigInt(value);
  } catch {
    throw invalidCursor();
  }
}

function getNonEmptyString(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) {
    throw invalidCursor();
  }

  return value;
}

function invalidCursor(): ApiError {
  return new ApiError(
    VIRTUAL_ERROR_CODES.invalidInput,
    LEADERBOARD_CURSOR_ERROR_MESSAGE,
    HttpStatus.BAD_REQUEST
  );
}

import { HttpStatus } from "@nestjs/common";
import type { ResolveInviteCodeRequestDto } from "@pokertable/shared";
import { ApiError } from "../shared/api-error";
import { INVITES_ERROR_CODES } from "./invites.constants";

export function normalizeResolveInviteCodeRequest(
  body: unknown
): ResolveInviteCodeRequestDto {
  const payload = getRecord(body);
  const inviteCode = getString(payload.inviteCode).trim().toUpperCase();

  if (inviteCode.length === 0) {
    throw new ApiError(
      INVITES_ERROR_CODES.invalidInput,
      "Нужен код приглашения",
      HttpStatus.BAD_REQUEST
    );
  }

  return {
    inviteCode
  };
}

function getRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function getString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

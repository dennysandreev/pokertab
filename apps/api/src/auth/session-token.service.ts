import { createHmac, timingSafeEqual } from "node:crypto";
import { HttpStatus, Injectable } from "@nestjs/common";
import type { UserDto } from "@pokertable/shared";
import { ApiError } from "../shared/api-error";
import { getNumberEnv, getRequiredEnv } from "../shared/env";
import { AUTH_ERROR_CODES } from "./auth.constants";
import type { SessionTokenIssuer, SessionTokenPayload } from "./auth.types";

const TOKEN_HEADER = {
  alg: "HS256",
  typ: "JWT"
} as const;

@Injectable()
export class SessionTokenService implements SessionTokenIssuer {
  private readonly secret = getRequiredEnv("APP_SESSION_SECRET");
  private readonly ttlSeconds = getNumberEnv("APP_SESSION_TTL_SECONDS", 60 * 60 * 24 * 7);

  createToken(user: UserDto): string {
    const issuedAt = Math.floor(Date.now() / 1000);
    const payload: SessionTokenPayload = {
      sub: user.id,
      telegramId: user.telegramId,
      iat: issuedAt,
      exp: issuedAt + this.ttlSeconds
    };

    const encodedHeader = base64UrlEncode(JSON.stringify(TOKEN_HEADER));
    const encodedPayload = base64UrlEncode(JSON.stringify(payload));
    const signature = this.sign(`${encodedHeader}.${encodedPayload}`);

    return `${encodedHeader}.${encodedPayload}.${signature}`;
  }

  verifyToken(token: string): SessionTokenPayload {
    const [encodedHeader, encodedPayload, signature] = token.split(".");

    if (!encodedHeader || !encodedPayload || !signature) {
      throw new ApiError(
        AUTH_ERROR_CODES.unauthorized,
        "Нужна авторизация",
        HttpStatus.UNAUTHORIZED
      );
    }

    const data = `${encodedHeader}.${encodedPayload}`;
    const expectedSignature = this.sign(data);

    if (!safeCompare(signature, expectedSignature)) {
      throw new ApiError(
        AUTH_ERROR_CODES.unauthorized,
        "Нужна авторизация",
        HttpStatus.UNAUTHORIZED
      );
    }

    const payload = parseSessionTokenPayload(encodedPayload);
    const nowSeconds = Math.floor(Date.now() / 1000);

    if (payload.exp <= nowSeconds) {
      throw new ApiError(
        AUTH_ERROR_CODES.unauthorized,
        "Сессия истекла. Войдите заново",
        HttpStatus.UNAUTHORIZED
      );
    }

    return payload;
  }

  private sign(value: string): string {
    return createHmac("sha256", this.secret).update(value).digest("base64url");
  }
}

function parseSessionTokenPayload(encodedPayload: string): SessionTokenPayload {
  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as Partial<SessionTokenPayload>;

    if (
      typeof payload.sub !== "string" ||
      typeof payload.telegramId !== "string" ||
      typeof payload.iat !== "number" ||
      !Number.isFinite(payload.iat) ||
      typeof payload.exp !== "number" ||
      !Number.isFinite(payload.exp)
    ) {
      throw new Error("Invalid session payload");
    }

    return payload as SessionTokenPayload;
  } catch {
    throw new ApiError(
      AUTH_ERROR_CODES.unauthorized,
      "Нужна авторизация",
      HttpStatus.UNAUTHORIZED
    );
  }
}

function base64UrlEncode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function safeCompare(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

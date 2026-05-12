import { createHmac } from "node:crypto";
import { HttpStatus } from "@nestjs/common";
import type { UserDto } from "@pokertable/shared";
import { ApiError } from "../shared/api-error";
import { AUTH_ERROR_CODES } from "./auth.constants";
import { SessionTokenService } from "./session-token.service";

describe("SessionTokenService", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      APP_SESSION_SECRET: "session-test-secret",
      APP_SESSION_TTL_SECONDS: "3600"
    };
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  it("creates token that can be verified", () => {
    const service = new SessionTokenService();
    const user: UserDto = {
      id: "user-1",
      telegramId: "123456",
      username: "denis",
      firstName: "Denis",
      lastName: null,
      avatarUrl: null
    };

    const payload = service.verifyToken(service.createToken(user));

    expect(payload.sub).toBe("user-1");
    expect(payload.telegramId).toBe("123456");
    expect(payload.exp).toBeGreaterThan(payload.iat);
  });

  it("returns unauthorized for malformed token", () => {
    const service = new SessionTokenService();

    expectUnauthorized(() => service.verifyToken("not-a-token"));
  });

  it("returns unauthorized for signed payload with invalid json", () => {
    const service = new SessionTokenService();
    const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" }), "utf8").toString(
      "base64url"
    );
    const invalidPayload = Buffer.from("{", "utf8").toString("base64url");
    const token = `${header}.${invalidPayload}.${signToken(`${header}.${invalidPayload}`)}`;

    expectUnauthorized(() => service.verifyToken(token));
  });

  it("returns unauthorized for signed payload with invalid shape", () => {
    const service = new SessionTokenService();
    const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" }), "utf8").toString(
      "base64url"
    );
    const invalidPayload = Buffer.from(JSON.stringify({ exp: "tomorrow" }), "utf8").toString(
      "base64url"
    );
    const token = `${header}.${invalidPayload}.${signToken(`${header}.${invalidPayload}`)}`;

    expectUnauthorized(() => service.verifyToken(token));
  });

  it("returns unauthorized for expired token", () => {
    jest.spyOn(Date, "now").mockReturnValue(new Date("2026-05-11T12:00:00.000Z").getTime());
    const service = new SessionTokenService();
    const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" }), "utf8").toString(
      "base64url"
    );
    const expiredPayload = Buffer.from(
      JSON.stringify({
        sub: "user-1",
        telegramId: "123456",
        iat: 100,
        exp: 101
      }),
      "utf8"
    ).toString("base64url");
    const token = `${header}.${expiredPayload}.${signToken(`${header}.${expiredPayload}`)}`;

    try {
      service.verifyToken(token);
      throw new Error("Expected verifyToken to throw");
    } catch (error: unknown) {
      expectApiError(error, {
        code: AUTH_ERROR_CODES.unauthorized,
        status: HttpStatus.UNAUTHORIZED,
        message: "Сессия истекла. Войдите заново"
      });
    }
  });
});

function expectUnauthorized(callback: () => unknown): void {
  try {
    callback();
    throw new Error("Expected verifyToken to throw");
  } catch (error: unknown) {
    expectApiError(error, {
      code: AUTH_ERROR_CODES.unauthorized,
      status: HttpStatus.UNAUTHORIZED,
      message: "Нужна авторизация"
    });
  }
}

function expectApiError(
  error: unknown,
  expected: {
    code: string;
    status: HttpStatus;
    message: string;
  }
): void {
  expect(error).toBeInstanceOf(ApiError);

  const apiError = error as ApiError;
  expect(apiError.code).toBe(expected.code);
  expect(apiError.getStatus()).toBe(expected.status);
  expect(apiError.getResponse()).toEqual({
    error: {
      code: expected.code,
      message: expected.message
    }
  });
}

function signToken(value: string): string {
  return createHmac("sha256", "session-test-secret").update(value).digest("base64url");
}

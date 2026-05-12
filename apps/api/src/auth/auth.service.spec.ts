import { HttpStatus } from "@nestjs/common";
import type { UserDto } from "@pokertable/shared";
import { AUTH_ERROR_CODES } from "./auth.constants";
import { AuthService } from "./auth.service";
import type { SessionTokenIssuer, TelegramMiniAppUser, UsersRepository } from "./auth.types";
import { createTelegramHash } from "./telegram-auth.helpers";

describe("AuthService", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      TELEGRAM_BOT_TOKEN: "telegram-test-token",
      APP_SESSION_SECRET: "session-test-secret",
      TELEGRAM_INIT_DATA_MAX_AGE_SECONDS: "600"
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  function createAuthService(
    overrides?: Partial<{
      upsertTelegramUser: UsersRepository["upsertTelegramUser"];
      findById: UsersRepository["findById"];
      createToken: SessionTokenIssuer["createToken"];
      verifyToken: SessionTokenIssuer["verifyToken"];
    }>
  ): AuthService {
    const repository: UsersRepository = {
      upsertTelegramUser:
        overrides?.upsertTelegramUser ?? ((input) => Promise.resolve(toUserDto(input))),
      findById: overrides?.findById ?? (() => Promise.resolve(null))
    };

    const sessionTokenService: SessionTokenIssuer = {
      createToken: overrides?.createToken ?? (() => "session-token"),
      verifyToken:
        overrides?.verifyToken ??
        (() => ({
          sub: "user-1",
          telegramId: "123456",
          iat: 100,
          exp: 9999999999
        }))
    };

    return new AuthService(repository, sessionTokenService);
  }

  function createValidInitData(user: TelegramMiniAppUser): string {
    const rawUser: Record<string, string> = {
      id: user.id
    };

    if (user.username) {
      rawUser.username = user.username;
    }

    if (user.firstName) {
      rawUser.first_name = user.firstName;
    }

    if (user.lastName) {
      rawUser.last_name = user.lastName;
    }

    if (user.avatarUrl) {
      rawUser.photo_url = user.avatarUrl;
    }

    const params = new URLSearchParams({
      auth_date: String(Math.floor(Date.now() / 1000)),
      user: JSON.stringify(rawUser)
    });
    const initDataWithoutHash = params.toString();
    params.set("hash", createTelegramHash(initDataWithoutHash, "telegram-test-token"));
    return params.toString();
  }

  it("creates or updates user and returns access token", async () => {
    const upsertTelegramUser = jest.fn((input: TelegramMiniAppUser) =>
      Promise.resolve(toUserDto(input))
    );
    const createToken = jest.fn(() => "token-123");
    const service = createAuthService({
      upsertTelegramUser,
      createToken
    });

    const response = await service.authenticateWithTelegram(
      createValidInitData({
        id: "123456",
        username: "denis",
        firstName: "Denis",
        lastName: "Andreev",
        avatarUrl: null
      })
    );

    expect(upsertTelegramUser).toHaveBeenCalledWith({
      id: "123456",
      username: "denis",
      firstName: "Denis",
      lastName: "Andreev",
      avatarUrl: null
    });
    expect(createToken).toHaveBeenCalled();
    expect(response).toEqual({
      accessToken: "token-123",
      user: {
        id: "user-123456",
        telegramId: "123456",
        username: "denis",
        firstName: "Denis",
        lastName: "Andreev",
        avatarUrl: null
      }
    });
  });

  it("returns user by verified access token", async () => {
    const user: UserDto = {
      id: "user-1",
      telegramId: "123456",
      username: "denis",
      firstName: "Denis",
      lastName: null,
      avatarUrl: null
    };
    const service = createAuthService({
      findById: () => Promise.resolve(user)
    });

    await expect(service.authenticateAccessToken("token-123")).resolves.toEqual(user);
  });

  it("rejects empty initData", async () => {
    const service = createAuthService();

    await expect(service.authenticateWithTelegram("   ")).rejects.toMatchObject({
      code: AUTH_ERROR_CODES.invalidInitData,
      status: HttpStatus.UNAUTHORIZED
    });
  });
});

function toUserDto(input: TelegramMiniAppUser): UserDto {
  return {
    id: `user-${input.id}`,
    telegramId: input.id,
    username: input.username,
    firstName: input.firstName,
    lastName: input.lastName,
    avatarUrl: input.avatarUrl
  };
}

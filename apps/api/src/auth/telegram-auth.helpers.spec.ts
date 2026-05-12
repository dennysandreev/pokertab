import { AUTH_ERROR_CODES } from "./auth.constants";
import { ApiError } from "../shared/api-error";
import { createTelegramHash, validateTelegramInitData } from "./telegram-auth.helpers";

describe("validateTelegramInitData", () => {
  const botToken = "telegram-test-token";
  const now = new Date("2026-05-11T12:00:00.000Z");

  function createInitData(params: Record<string, string>): string {
    const initDataWithoutHash = new URLSearchParams(params).toString();
    const hash = createTelegramHash(initDataWithoutHash, botToken);
    const fullParams = new URLSearchParams(params);
    fullParams.set("hash", hash);
    return fullParams.toString();
  }

  it("validates signed initData and parses user payload", () => {
    const initData = createInitData({
      auth_date: String(Math.floor(now.getTime() / 1000) - 30),
      query_id: "AAHdF6IQAAAAAN0XohDhrOrc",
      start_param: "room_abc123",
      user: JSON.stringify({
        id: 123456,
        username: "denis",
        first_name: "Denis",
        last_name: "A",
        photo_url: "https://example.com/avatar.png"
      })
    });

    expect(
      validateTelegramInitData({
        initData,
        botToken,
        maxAgeSeconds: 600,
        now
      })
    ).toEqual({
      authDate: new Date("2026-05-11T11:59:30.000Z"),
      queryId: "AAHdF6IQAAAAAN0XohDhrOrc",
      startParam: "room_abc123",
      user: {
        id: "123456",
        username: "denis",
        firstName: "Denis",
        lastName: "A",
        avatarUrl: "https://example.com/avatar.png"
      }
    });
  });

  it("rejects invalid hash", () => {
    const initData = new URLSearchParams({
      auth_date: String(Math.floor(now.getTime() / 1000) - 30),
      user: JSON.stringify({
        id: 123456,
        first_name: "Denis"
      }),
      hash: "bad-hash"
    }).toString();

    try {
      validateTelegramInitData({
        initData,
        botToken,
        maxAgeSeconds: 600,
        now
      });
      throw new Error("Expected validateTelegramInitData to throw");
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).code).toBe(AUTH_ERROR_CODES.invalidInitData);
    }
  });

  it("rejects expired initData", () => {
    const initData = createInitData({
      auth_date: String(Math.floor(now.getTime() / 1000) - 601),
      user: JSON.stringify({
        id: 123456,
        first_name: "Denis"
      })
    });

    try {
      validateTelegramInitData({
        initData,
        botToken,
        maxAgeSeconds: 600,
        now
      });
      throw new Error("Expected validateTelegramInitData to throw");
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).code).toBe(AUTH_ERROR_CODES.initDataExpired);
    }
  });
});

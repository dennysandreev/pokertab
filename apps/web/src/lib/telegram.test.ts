import { describe, expect, it, vi } from "vitest";
import {
  canUseBrowserBack,
  getTelegramBackFallbackPath,
  hideTelegramBackButton,
  offTelegramBackButtonClick,
  onTelegramBackButtonClick,
  readTelegramLaunchData,
  showTelegramBackButton
} from "./telegram";

describe("readTelegramLaunchData", () => {
  it("reads initData and start_param from Telegram WebApp", () => {
    expect(
      readTelegramLaunchData({
        Telegram: {
          WebApp: {
            initData: "auth_date=1&start_param=room_abc123",
            initDataUnsafe: {
              start_param: "room_override"
            }
          }
        }
      })
    ).toEqual({
      initData: "auth_date=1&start_param=room_abc123",
      startParam: "room_override",
      inviteCode: "override"
    });
  });

  it("parses invite code from initData when unsafe payload is absent", () => {
    expect(
      readTelegramLaunchData({
        Telegram: {
          WebApp: {
            initData: "auth_date=1&start_param=room_abc123"
          }
        }
      })
    ).toEqual({
      initData: "auth_date=1&start_param=room_abc123",
      startParam: "room_abc123",
      inviteCode: "abc123"
    });
  });

  it("returns null values outside Telegram", () => {
    expect(readTelegramLaunchData({})).toEqual({
      initData: null,
      startParam: null,
      inviteCode: null
    });
  });
});

describe("Telegram Back Button helpers", () => {
  it("does not throw outside Telegram", () => {
    const callback = vi.fn();

    expect(() => {
      showTelegramBackButton({});
      hideTelegramBackButton({});
      onTelegramBackButtonClick(callback, {});
      offTelegramBackButtonClick(callback, {});
    }).not.toThrow();
  });

  it("returns route fallback for Telegram back button", () => {
    expect(getTelegramBackFallbackPath("/players/user-1")).toBe("/leaderboard");
    expect(getTelegramBackFallbackPath("/rooms/room-1")).toBe("/");
    expect(getTelegramBackFallbackPath("/rooms/new")).toBe("/");
  });

  it("uses browser history idx when available", () => {
    expect(
      canUseBrowserBack({
        history: {
          length: 1,
          state: {
            idx: 1
          }
        } as History
      })
    ).toBe(true);

    expect(
      canUseBrowserBack({
        history: {
          length: 5,
          state: {
            idx: 0
          }
        } as History
      })
    ).toBe(false);
  });
});

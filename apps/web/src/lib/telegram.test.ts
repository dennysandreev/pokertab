import { describe, expect, it, vi } from "vitest";
import {
  canUseBrowserBack,
  getTelegramBackFallbackPath,
  hideTelegramBackButton,
  initializeTelegramWebApp,
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
  it("initializes Telegram WebApp when helpers are available", () => {
    const ready = vi.fn();
    const expand = vi.fn();
    const requestFullscreen = vi.fn();
    const disableVerticalSwipes = vi.fn();

    initializeTelegramWebApp({
      Telegram: {
        WebApp: {
          version: "8.0",
          ready,
          expand,
          requestFullscreen,
          disableVerticalSwipes
        }
      }
    });

    expect(ready).toHaveBeenCalledOnce();
    expect(expand).toHaveBeenCalledOnce();
    expect(requestFullscreen).toHaveBeenCalledOnce();
    expect(disableVerticalSwipes).toHaveBeenCalledOnce();
  });

  it("does not call newer Telegram methods on older SDK versions", () => {
    const requestFullscreen = vi.fn();
    const disableVerticalSwipes = vi.fn();

    initializeTelegramWebApp({
      Telegram: {
        WebApp: {
          version: "6.0",
          requestFullscreen,
          disableVerticalSwipes
        }
      }
    });

    expect(requestFullscreen).not.toHaveBeenCalled();
    expect(disableVerticalSwipes).not.toHaveBeenCalled();
  });

  it("ignores fullscreen errors from partial Telegram SDKs", () => {
    expect(() =>
      initializeTelegramWebApp({
        Telegram: {
          WebApp: {
            version: "8.0",
            requestFullscreen: () => {
              throw new Error("unsupported");
            },
            disableVerticalSwipes: () => {
              throw new Error("unsupported");
            }
          }
        }
      })
    ).not.toThrow();
  });

  it("ignores rejected fullscreen promises from Telegram SDK", async () => {
    const requestFullscreen = vi.fn().mockRejectedValue(new Error("unsupported"));

    expect(() =>
      initializeTelegramWebApp({
        Telegram: {
          WebApp: {
            version: "8.0",
            requestFullscreen
          }
        }
      })
    ).not.toThrow();

    await Promise.resolve();
    expect(requestFullscreen).toHaveBeenCalledOnce();
  });

  it("does not throw outside Telegram", () => {
    const callback = vi.fn();

    expect(() => {
      initializeTelegramWebApp({});
      showTelegramBackButton({});
      hideTelegramBackButton({});
      onTelegramBackButtonClick(callback, {});
      offTelegramBackButtonClick(callback, {});
    }).not.toThrow();
  });

  it("does not call BackButton on unsupported SDK versions", () => {
    const show = vi.fn();
    const hide = vi.fn();
    const onClick = vi.fn();
    const offClick = vi.fn();
    const callback = vi.fn();
    const source = {
      Telegram: {
        WebApp: {
          version: "6.0",
          BackButton: {
            show,
            hide,
            onClick,
            offClick
          }
        }
      }
    };

    showTelegramBackButton(source);
    hideTelegramBackButton(source);
    onTelegramBackButtonClick(callback, source);
    offTelegramBackButtonClick(callback, source);

    expect(show).not.toHaveBeenCalled();
    expect(hide).not.toHaveBeenCalled();
    expect(onClick).not.toHaveBeenCalled();
    expect(offClick).not.toHaveBeenCalled();
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

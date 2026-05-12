import { getInviteCodeFromStartParam } from "@pokertable/shared";

type TelegramWebApp = {
  version?: string;
  initData?: string;
  initDataUnsafe?: {
    start_param?: string;
  };
  isVersionAtLeast?: (version: string) => boolean;
  ready?: () => void;
  expand?: () => void;
  requestFullscreen?: () => void | Promise<void>;
  disableVerticalSwipes?: () => void;
  BackButton?: {
    show: () => void;
    hide: () => void;
    onClick: (callback: () => void) => void;
    offClick: (callback: () => void) => void;
  };
};

type PromiseLikeResult = {
  catch?: (onRejected: (error: unknown) => void) => unknown;
};

type TelegramWindow = {
  Telegram?: {
    WebApp?: TelegramWebApp;
  };
};

export type TelegramLaunchData = {
  initData: string | null;
  startParam: string | null;
  inviteCode: string | null;
};

export function getTelegramBackFallbackPath(pathname: string): string {
  if (/^\/players\/[^/]+$/.test(pathname)) {
    return "/leaderboard";
  }

  return "/";
}

export function readTelegramLaunchData(
  source: TelegramWindow | undefined = globalThis as TelegramWindow | undefined
): TelegramLaunchData {
  const webApp = source?.Telegram?.WebApp;
  const initData = normalizeValue(webApp?.initData);
  const startParamFromUnsafe = normalizeValue(webApp?.initDataUnsafe?.start_param);
  const startParamFromInitData = extractStartParam(initData);
  const startParam = startParamFromUnsafe ?? startParamFromInitData;

  return {
    initData,
    startParam,
    inviteCode: getInviteCodeFromStartParam(startParam)
  };
}

export function initializeTelegramWebApp(
  source: TelegramWindow | undefined = globalThis as TelegramWindow | undefined
): void {
  const webApp = source?.Telegram?.WebApp;

  invokeOptionalMethod(() => webApp?.ready?.());
  invokeOptionalMethod(() => webApp?.expand?.());

  if (supportsTelegramVersion(webApp, "7.7")) {
    invokeOptionalMethod(() => webApp?.disableVerticalSwipes?.());
  }

  if (supportsTelegramVersion(webApp, "8.0")) {
    invokeOptionalMethod(() => webApp?.requestFullscreen?.());
  }
}

export function showTelegramBackButton(
  source: TelegramWindow | undefined = globalThis as TelegramWindow | undefined
): void {
  const webApp = source?.Telegram?.WebApp;

  if (supportsTelegramVersion(webApp, "6.1")) {
    webApp?.BackButton?.show();
  }
}

export function hideTelegramBackButton(
  source: TelegramWindow | undefined = globalThis as TelegramWindow | undefined
): void {
  const webApp = source?.Telegram?.WebApp;

  if (supportsTelegramVersion(webApp, "6.1")) {
    webApp?.BackButton?.hide();
  }
}

export function onTelegramBackButtonClick(
  callback: () => void,
  source: TelegramWindow | undefined = globalThis as TelegramWindow | undefined
): void {
  const webApp = source?.Telegram?.WebApp;

  if (supportsTelegramVersion(webApp, "6.1")) {
    webApp?.BackButton?.onClick(callback);
  }
}

export function offTelegramBackButtonClick(
  callback: () => void,
  source: TelegramWindow | undefined = globalThis as TelegramWindow | undefined
): void {
  const webApp = source?.Telegram?.WebApp;

  if (supportsTelegramVersion(webApp, "6.1")) {
    webApp?.BackButton?.offClick(callback);
  }
}

export function canUseBrowserBack(
  source: Pick<Window, "history"> | undefined = globalThis
): boolean {
  const historyState = source?.history.state as { idx?: number } | null | undefined;

  if (typeof historyState?.idx === "number") {
    return historyState.idx > 0;
  }

  return (source?.history.length ?? 0) > 1;
}

function extractStartParam(initData: string | null): string | null {
  if (!initData) {
    return null;
  }

  return normalizeValue(new URLSearchParams(initData).get("start_param"));
}

function normalizeValue(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : null;
}

function supportsTelegramVersion(
  webApp: TelegramWebApp | undefined,
  requiredVersion: string
): boolean {
  if (!webApp) {
    return false;
  }

  if (typeof webApp.isVersionAtLeast === "function") {
    return webApp.isVersionAtLeast(requiredVersion);
  }

  if (!webApp.version) {
    return true;
  }

  return compareVersions(webApp.version, requiredVersion) >= 0;
}

function compareVersions(left: string, right: string): number {
  const leftParts = left.split(".").map((part) => Number.parseInt(part, 10));
  const rightParts = right.split(".").map((part) => Number.parseInt(part, 10));
  const length = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < length; index += 1) {
    const leftPart = leftParts[index] ?? 0;
    const rightPart = rightParts[index] ?? 0;

    if (leftPart !== rightPart) {
      return leftPart - rightPart;
    }
  }

  return 0;
}

function invokeOptionalMethod(callback: () => void | Promise<void> | undefined): void {
  try {
    const result = callback() as PromiseLikeResult | void;
    result?.catch?.(() => {
      // Ignore async Telegram SDK failures in browser previews.
    });
  } catch {
    // Ignore unsupported SDK implementations in browser previews.
  }
}

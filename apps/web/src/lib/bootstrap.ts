import type { AuthTelegramResponseDto } from "@pokertable/shared";
import type { TelegramLaunchData } from "./telegram";

export type BootstrapStatus =
  | "unsupported"
  | "idle"
  | "loading"
  | "authenticated"
  | "error";

export type SessionState = {
  status: BootstrapStatus;
  initData: string | null;
  startParam: string | null;
  inviteCode: string | null;
  accessToken: string | null;
  session: AuthTelegramResponseDto | null;
  errorMessage: string | null;
};

export function createInitialSessionState(launchData: TelegramLaunchData): SessionState {
  if (!launchData.initData) {
    return {
      status: "unsupported",
      initData: null,
      startParam: launchData.startParam,
      inviteCode: launchData.inviteCode,
      accessToken: null,
      session: null,
      errorMessage: null
    };
  }

  return {
    status: "idle",
    initData: launchData.initData,
    startParam: launchData.startParam,
    inviteCode: launchData.inviteCode,
    accessToken: null,
    session: null,
    errorMessage: null
  };
}

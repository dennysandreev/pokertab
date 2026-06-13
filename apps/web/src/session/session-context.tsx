import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { postTelegramAuth } from "@/lib/api";
import { createInitialSessionState, type SessionState } from "@/lib/bootstrap";
import { sendClientBootBeacon } from "@/lib/client-boot";
import {
  initializeTelegramWebApp,
  loadTelegramWebAppSdk,
  waitForTelegramLaunchData
} from "@/lib/telegram";

type SessionContextValue = {
  state: SessionState;
  bootstrap: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({
  children
}: React.PropsWithChildren): React.JSX.Element {
  const hasBootstrappedRef = useRef(false);
  const [state, setState] = useState<SessionState>(() => ({
    status: "loading",
    initData: null,
    startParam: null,
    inviteCode: null,
    accessToken: null,
    session: null,
    errorMessage: null
  }));

  useEffect(() => {
    let isMounted = true;

    sendClientBootBeacon("session-provider-mounted");

    void loadTelegramWebAppSdk().then(async (sdkStatus) => {
      sendClientBootBeacon(`telegram-sdk-${sdkStatus}`);
      initializeTelegramWebApp();

      const launchData = await waitForTelegramLaunchData();

      if (!isMounted) {
        return;
      }

      initializeTelegramWebApp();
      sendClientBootBeacon(launchData.initData ? "launch-data-ready" : "launch-data-missing");
      setState(createInitialSessionState(launchData));
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const bootstrap = useCallback(async () => {
    if (!state.initData) {
      sendClientBootBeacon("auth-skipped-no-init-data");
      return;
    }

    sendClientBootBeacon("auth-start");
    setState((currentState) => ({
      ...currentState,
      status: "loading",
      errorMessage: null
    }));

    try {
      const session = await postTelegramAuth(state.initData);

      sendClientBootBeacon("auth-success");
      setState((currentState) => ({
        ...currentState,
        status: "authenticated",
        accessToken: session.accessToken,
        session,
        errorMessage: null
      }));
    } catch (error) {
      sendClientBootBeacon("auth-error");
      setState((currentState) => ({
        ...currentState,
        status: "error",
        errorMessage:
          error instanceof Error ? error.message : "Не удалось войти в приложение"
      }));
    }
  }, [state.initData]);

  useEffect(() => {
    if (state.status === "idle" && !hasBootstrappedRef.current) {
      hasBootstrappedRef.current = true;
      void bootstrap();
    }
  }, [bootstrap, state.status]);

  const value = useMemo(
    () => ({
      state,
      bootstrap
    }),
    [bootstrap, state]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);

  if (!context) {
    throw new Error("SessionProvider is missing");
  }

  return context;
}

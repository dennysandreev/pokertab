import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";
import { getClubs } from "@/lib/api";
import { useSession } from "@/session/session-context";
import type { GetMyClubsResponseDto } from "./types";

type LoadState<T> =
  | {
      status: "idle" | "loading";
      data: T | null;
      errorMessage: string | null;
    }
  | {
      status: "ready";
      data: T;
      errorMessage: null;
    }
  | {
      status: "error";
      data: T | null;
      errorMessage: string;
    };

type ClubsContextValue = {
  clubsState: LoadState<GetMyClubsResponseDto>;
  refreshClubs: () => Promise<void>;
};

const ClubsContext = createContext<ClubsContextValue | null>(null);

const backgroundRefreshIntervalMs = 15_000;

export function ClubsProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const { state } = useSession();
  const refreshRequestIdRef = useRef(0);
  const [clubsState, setClubsState] = useState<LoadState<GetMyClubsResponseDto>>({
    status: "idle",
    data: null,
    errorMessage: null
  });

  const refreshClubsInternal = useCallback(async (background = false): Promise<void> => {
    if (!state.accessToken) {
      refreshRequestIdRef.current += 1;
      setClubsState({
        status: "idle",
        data: null,
        errorMessage: null
      });
      return;
    }

    const requestId = refreshRequestIdRef.current + 1;
    refreshRequestIdRef.current = requestId;

    setClubsState((current) => {
      if (background && current.data) {
        return {
          status: "ready" as const,
          data: current.data,
          errorMessage: null
        };
      }

      return {
        status: "loading" as const,
        data: current.data,
        errorMessage: null
      };
    });

    try {
      const data = await getClubs(state.accessToken);

      if (refreshRequestIdRef.current !== requestId) {
        return;
      }

      setClubsState({
        status: "ready",
        data,
        errorMessage: null
      });
    } catch (error) {
      if (refreshRequestIdRef.current !== requestId) {
        return;
      }

      setClubsState((current) => ({
        status: "error",
        data: current.data,
        errorMessage: error instanceof Error ? error.message : "Не получилось загрузить клубы"
      }));
    }
  }, [state.accessToken]);

  const refreshClubs = useCallback(async (): Promise<void> => {
    await refreshClubsInternal();
  }, [refreshClubsInternal]);

  useEffect(() => {
    void refreshClubs();
  }, [refreshClubs]);

  useEffect(() => {
    if (!state.accessToken) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void refreshClubsInternal(true);
    }, backgroundRefreshIntervalMs);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [refreshClubsInternal, state.accessToken]);

  useEffect(() => {
    if (!state.accessToken) {
      return;
    }

    const handleWindowFocus = (): void => {
      void refreshClubsInternal(true);
    };

    const handleVisibilityChange = (): void => {
      if (document.visibilityState === "visible") {
        void refreshClubsInternal(true);
      }
    };

    window.addEventListener("focus", handleWindowFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", handleWindowFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [refreshClubsInternal, state.accessToken]);

  const value = useMemo(
    () => ({
      clubsState,
      refreshClubs
    }),
    [clubsState, refreshClubs]
  );

  return <ClubsContext.Provider value={value}>{children}</ClubsContext.Provider>;
}

export function useClubsList(): ClubsContextValue {
  const context = useContext(ClubsContext);

  if (!context) {
    throw new Error("useClubsList must be used inside ClubsProvider");
  }

  return context;
}

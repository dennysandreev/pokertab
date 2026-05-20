import type { GetVirtualTablesResponseDto } from "@pokertable/shared";
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
import { getVirtualTables } from "@/lib/api";
import { useSession } from "@/session/session-context";

export type VirtualTablesLoadState =
  | {
      status: "idle" | "loading";
      data: GetVirtualTablesResponseDto | null;
      errorMessage: string | null;
    }
  | {
      status: "ready";
      data: GetVirtualTablesResponseDto;
      errorMessage: null;
    }
  | {
      status: "error";
      data: GetVirtualTablesResponseDto | null;
      errorMessage: string;
    };

type VirtualTablesContextValue = {
  virtualTablesState: VirtualTablesLoadState;
  refreshVirtualTables: () => Promise<void>;
};

const VirtualTablesContext = createContext<VirtualTablesContextValue | null>(null);

export function createIdleVirtualTablesState(): VirtualTablesLoadState {
  return {
    status: "idle",
    data: null,
    errorMessage: null
  };
}

export function getNextVirtualTablesRefreshState(
  current: VirtualTablesLoadState,
  background: boolean
): VirtualTablesLoadState {
  if (background && current.data) {
    return {
      status: "ready",
      data: current.data,
      errorMessage: null
    };
  }

  return {
    status: "loading",
    data: current.data,
    errorMessage: null
  };
}

export function VirtualTablesProvider({
  children
}: {
  children: ReactNode;
}): React.JSX.Element {
  const { state } = useSession();
  const refreshRequestIdRef = useRef(0);
  const [virtualTablesState, setVirtualTablesState] = useState<VirtualTablesLoadState>(
    createIdleVirtualTablesState
  );

  const refreshVirtualTablesInternal = useCallback(
    async (background = false): Promise<void> => {
      if (!state.accessToken) {
        refreshRequestIdRef.current += 1;
        setVirtualTablesState(createIdleVirtualTablesState());
        return;
      }

      const requestId = refreshRequestIdRef.current + 1;
      refreshRequestIdRef.current = requestId;

      setVirtualTablesState((current) =>
        getNextVirtualTablesRefreshState(current, background)
      );

      try {
        const data = await getVirtualTables(state.accessToken);

        if (refreshRequestIdRef.current !== requestId) {
          return;
        }

        setVirtualTablesState({
          status: "ready",
          data,
          errorMessage: null
        });
      } catch (error) {
        if (refreshRequestIdRef.current !== requestId) {
          return;
        }

        setVirtualTablesState((current) => ({
          status: "error",
          data: current.data,
          errorMessage: getErrorMessage(error, "Не получилось загрузить столы")
        }));
      }
    },
    [state.accessToken]
  );

  const refreshVirtualTables = useCallback(async (): Promise<void> => {
    await refreshVirtualTablesInternal();
  }, [refreshVirtualTablesInternal]);

  useEffect(() => {
    void refreshVirtualTables();
  }, [refreshVirtualTables]);

  useEffect(() => {
    if (!state.accessToken) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void refreshVirtualTablesInternal(true);
    }, 5000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [refreshVirtualTablesInternal, state.accessToken]);

  useEffect(() => {
    if (!state.accessToken) {
      return;
    }

    const handleWindowFocus = (): void => {
      void refreshVirtualTablesInternal(true);
    };

    const handleVisibilityChange = (): void => {
      if (document.visibilityState === "visible") {
        void refreshVirtualTablesInternal(true);
      }
    };

    window.addEventListener("focus", handleWindowFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", handleWindowFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [refreshVirtualTablesInternal, state.accessToken]);

  const value = useMemo(
    () => ({
      virtualTablesState,
      refreshVirtualTables
    }),
    [refreshVirtualTables, virtualTablesState]
  );

  return <VirtualTablesContext.Provider value={value}>{children}</VirtualTablesContext.Provider>;
}

export function useVirtualTablesList(): VirtualTablesContextValue {
  const context = useContext(VirtualTablesContext);

  if (!context) {
    throw new Error("useVirtualTablesList must be used inside VirtualTablesProvider");
  }

  return context;
}

function getErrorMessage(error: unknown, fallbackMessage: string): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return fallbackMessage;
}

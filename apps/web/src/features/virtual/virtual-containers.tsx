import { useCallback, useEffect, useMemo, useRef, useState, type JSX } from "react";
import type {
  GetMyVirtualStatsResponseDto,
  GetVirtualHandHistoriesResponseDto,
  GetVirtualHandHistoryResponseDto,
  GetVirtualLeaderboardResponseDto,
  GetVirtualTableResponseDto,
  GetVirtualTablesResponseDto,
  RaiseVirtualBlindsRequestDto,
  RequestVirtualSitOutRequestDto,
  SubmitVirtualActionRequestDto,
  VirtualSeatDto,
  VirtualTableReactionDto,
  VirtualTableReactionEmoji
} from "@pokertable/shared";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  ApiRequestError,
  cancelVirtualTable,
  createVirtualTable,
  finishVirtualTable,
  getMyVirtualStats,
  getVirtualHandHistories,
  getVirtualHandHistory,
  getVirtualLeaderboard,
  getVirtualTable,
  joinVirtualTable,
  pauseVirtualTable,
  raiseVirtualBlinds,
  requestVirtualSitOut,
  resumeVirtualTable,
  returnToVirtualTable,
  startNextVirtualHand,
  startVirtualTable,
  submitVirtualReaction,
  submitVirtualAction
} from "@/lib/api";
import { useSession } from "@/session/session-context";
import {
  buildCreateVirtualTablePayload,
  buildJoinVirtualTablePayload,
  getCreateVirtualTableValidationMessage,
  getJoinVirtualTableValidationMessage,
  normalizeVirtualInviteCode,
  type CreateVirtualTableFormValues,
  type JoinVirtualTableFormValues
} from "./virtual-table-form";
import {
  getCreateVirtualTableRoute,
  getVirtualHandRoute,
  getVirtualTableHistoryRoute,
  getVirtualTableRoute
} from "./routes";
import {
  useVirtualTablesList
} from "./virtual-data";
import {
  VirtualHandHistoryDetailScreen,
  VirtualHandHistoryListScreen
} from "./virtual-history-screens";
import {
  CreateVirtualTableScreen,
  JoinVirtualTableScreen,
  VirtualLobbyScreen,
  VirtualWaitingRoomScreen
} from "./virtual-screens";
import {
  VirtualLeaderboardScreen,
  VirtualStatsScreen
} from "./virtual-stats-screens";
import { VirtualTableScreen } from "./virtual-table-screen";
import {
  getNewReactionAnimations,
  getStoredVirtualReactionsVisibility,
  setStoredVirtualReactionsVisibility,
  VIRTUAL_REACTION_ANIMATION_MS,
  type PendingOptimisticReaction,
  type VirtualTableReactionAnimation
} from "./virtual-table-view";
import {
  EmptyState,
  GlassPanel,
  RolePill,
  ScreenHeader,
  virtualScreenClassName
} from "./virtual-ui";

const DEFAULT_CREATE_VALUES: CreateVirtualTableFormValues = {
  title: "",
  maxSeats: "6",
  startingStackChips: "10000",
  chipsPerCurrencyUnit: "100",
  smallBlindChips: "50",
  bigBlindChips: "100",
  turnDurationSeconds: "30",
  reminderDelaySeconds: "15",
  timeoutAutoActionRule: "CHECK_OR_FOLD",
  winProbabilityEnabled: false
};

export const VIRTUAL_TABLE_TOAST_DISMISS_MS = 5000;
export const VIRTUAL_TABLE_HISTORY_OVERLAY_PAGE_SIZE = 10;

type AsyncState<T> =
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

export async function fetchVirtualTableHistoryOverlayPage(
  accessToken: string,
  tableId: string,
  cursor?: string | null
): Promise<GetVirtualHandHistoriesResponseDto> {
  return getVirtualHandHistories(accessToken, tableId, {
    cursor: cursor ?? null,
    limit: VIRTUAL_TABLE_HISTORY_OVERLAY_PAGE_SIZE
  });
}

export function mergeVirtualHandHistoryPages(
  current: GetVirtualHandHistoriesResponseDto | null,
  next: GetVirtualHandHistoriesResponseDto,
  cursor?: string | null
): GetVirtualHandHistoriesResponseDto {
  if (!cursor || !current) {
    return next;
  }

  return {
    items: [...current.items, ...next.items],
    nextCursor: next.nextCursor
  };
}

export function openVirtualHandHistoryDetail(
  navigate: ReturnType<typeof useNavigate>,
  tableId: string,
  handId: string
): void {
  void navigate(getVirtualHandRoute(tableId, handId));
}

export function VirtualLobbyContainer(): JSX.Element {
  const navigate = useNavigate();
  const { state } = useSession();
  const { virtualTablesState, refreshVirtualTables } = useVirtualTablesList();
  const [joinCode, setJoinCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const items = virtualTablesState.data?.items ?? [];
  const myTables = items;
  const activeTables = items.filter((table) => table.status === "ACTIVE" || table.status === "PAUSED");
  const waitingTables = items.filter((table) => table.status === "WAITING_FOR_PLAYERS");
  const recentTables = items.filter((table) => table.status === "FINISHED" || table.status === "CANCELLED");

  const handleJoinSubmit = useCallback(async (): Promise<void> => {
    if (!state.accessToken) {
      return;
    }

    const payload = buildJoinVirtualTablePayload({ inviteCode: joinCode });

    if (!payload) {
      setErrorMessage(getJoinVirtualTableValidationMessage({ inviteCode: joinCode }));
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const data = await joinVirtualTable(state.accessToken, payload);
      await refreshVirtualTables();
      void navigate(getVirtualTableRoute(data.tableId));
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Не получилось подключиться к столу"));
    } finally {
      setIsSubmitting(false);
    }
  }, [joinCode, navigate, refreshVirtualTables, state.accessToken]);

  if (!state.accessToken) {
    return (
      <VirtualRouteState
        description="После входа здесь появятся ваши активные столы, онлайн-история и быстрый вход по коду."
        title="Онлайн-покер"
      />
    );
  }

  if (virtualTablesState.status === "loading" && !virtualTablesState.data) {
    return (
      <VirtualRouteState
        description="Собираем ваши столы и последние раздачи."
        title="Онлайн-покер"
        tone="loading"
      />
    );
  }

  if (virtualTablesState.status === "error" && !virtualTablesState.data) {
    return (
      <VirtualRouteState
        action={
          <Button className="w-full" onClick={() => void refreshVirtualTables()}>
            Обновить
          </Button>
        }
        description={virtualTablesState.errorMessage}
        title="Онлайн-покер"
        tone="error"
      />
    );
  }

  return (
    <div className="space-y-4">
      {errorMessage ? <InlineVirtualMessage message={errorMessage} tone="error" /> : null}
      {virtualTablesState.status === "error" && virtualTablesState.data ? (
        <InlineVirtualMessage message={virtualTablesState.errorMessage} tone="error" />
      ) : null}
      {isSubmitting ? <InlineVirtualMessage message="Подключаем стол по коду" tone="loading" /> : null}
      <VirtualLobbyScreen
        activeTables={activeTables}
        joinCode={joinCode}
        myTables={myTables}
        onCreateTable={() => {
          void navigate(getCreateVirtualTableRoute());
        }}
        onJoinCodeChange={(value) => {
          setJoinCode(value);
          if (errorMessage) {
            setErrorMessage(null);
          }
        }}
        onJoinSubmit={() => void handleJoinSubmit()}
        onOpenTable={(tableId) => {
          void navigate(getVirtualTableRoute(tableId));
        }}
        recentTables={recentTables}
        waitingTables={waitingTables}
      />
    </div>
  );
}

export function CreateVirtualTableContainer(): JSX.Element {
  const navigate = useNavigate();
  const { state } = useSession();
  const { refreshVirtualTables } = useVirtualTablesList();
  const [values, setValues] = useState<CreateVirtualTableFormValues>(DEFAULT_CREATE_VALUES);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validationMessage = getCreateVirtualTableValidationMessage(values) ?? submitError;

  const handleSubmit = useCallback(async (): Promise<void> => {
    if (!state.accessToken) {
      return;
    }

    const payload = buildCreateVirtualTablePayload(values);

    if (!payload) {
      setSubmitError(getCreateVirtualTableValidationMessage(values));
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const data = await createVirtualTable(state.accessToken, payload);
      await refreshVirtualTables();
      void navigate(getVirtualTableRoute(data.table.id));
    } catch (error) {
      setSubmitError(getErrorMessage(error, "Не получилось создать стол"));
    } finally {
      setIsSubmitting(false);
    }
  }, [navigate, refreshVirtualTables, state.accessToken, values]);

  if (!state.accessToken) {
    return (
      <VirtualRouteState
        description="Создание виртуального стола откроется сразу после входа."
        title="Новый стол"
      />
    );
  }

  return (
    <CreateVirtualTableScreen
      isSubmitting={isSubmitting}
      onChange={(field, value) => {
        setValues((current) => ({
          ...current,
          [field]: toCreateFormValue(field, value)
        }));
        if (submitError) {
          setSubmitError(null);
        }
      }}
      onSubmit={() => void handleSubmit()}
      validationMessage={validationMessage}
      values={values}
    />
  );
}

export function JoinVirtualTableContainer(): JSX.Element {
  const navigate = useNavigate();
  const { inviteCode: inviteCodeParam } = useParams();
  const { state } = useSession();
  const { refreshVirtualTables } = useVirtualTablesList();
  const [values, setValues] = useState<JoinVirtualTableFormValues>({
    inviteCode: inviteCodeParam ? normalizeVirtualInviteCode(inviteCodeParam) : ""
  });
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setValues({
      inviteCode: inviteCodeParam ? normalizeVirtualInviteCode(inviteCodeParam) : ""
    });
    setSubmitError(null);
  }, [inviteCodeParam]);

  const handleSubmit = useCallback(async (): Promise<void> => {
    if (!state.accessToken) {
      return;
    }

    const payload = buildJoinVirtualTablePayload(values);

    if (!payload) {
      setSubmitError(getJoinVirtualTableValidationMessage(values));
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const data = await joinVirtualTable(state.accessToken, payload);
      await refreshVirtualTables();
      void navigate(getVirtualTableRoute(data.tableId));
    } catch (error) {
      setSubmitError(getErrorMessage(error, "Не получилось войти по коду"));
    } finally {
      setIsSubmitting(false);
    }
  }, [navigate, refreshVirtualTables, state.accessToken, values]);

  if (!state.accessToken) {
    return (
      <VirtualRouteState
        description="Вход по коду будет доступен сразу после авторизации."
        title="Войти по коду"
      />
    );
  }

  return (
    <JoinVirtualTableScreen
      helperText={submitError}
      inviteCode={values.inviteCode}
      isSubmitting={isSubmitting}
      onInviteCodeChange={(value) => {
        setValues({ inviteCode: value });
        if (submitError) {
          setSubmitError(null);
        }
      }}
      onSubmit={() => void handleSubmit()}
    />
  );
}

export function VirtualTableContainer(): JSX.Element {
  const { tableId = "" } = useParams();
  const navigate = useNavigate();
  const { state } = useSession();
  const { refreshVirtualTables, virtualTablesState } = useVirtualTablesList();
  const [tableState, setTableState] = useState<AsyncState<GetVirtualTableResponseDto>>({
    status: "idle",
    data: null,
    errorMessage: null
  });
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [pendingStart, setPendingStart] = useState(false);
  const [pendingCancel, setPendingCancel] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [activeToastKey, setActiveToastKey] = useState<string | null>(null);
  const [reactionAnimations, setReactionAnimations] = useState<VirtualTableReactionAnimation[]>([]);
  const [reactionsVisible, setReactionsVisible] = useState<boolean>(() => getStoredVirtualReactionsVisibility());
  const tableRequestIdRef = useRef(0);
  const historyOverlayRequestIdRef = useRef(0);
  const reactionTimeoutsRef = useRef<Record<string, number>>({});
  const seenReactionIdsRef = useRef<Set<string>>(new Set());
  const optimisticReactionsRef = useRef<PendingOptimisticReaction[]>([]);
  const [historyOverlayState, setHistoryOverlayState] = useState<AsyncState<GetVirtualHandHistoriesResponseDto>>({
    status: "idle",
    data: null,
    errorMessage: null
  });
  const [isHistoryOverlayLoadingMore, setIsHistoryOverlayLoadingMore] = useState(false);

  const queueReactionAnimations = useCallback((animations: VirtualTableReactionAnimation[]): void => {
    if (animations.length === 0) {
      return;
    }

    setReactionAnimations((current) => [...current, ...animations]);

    animations.forEach((animation) => {
      const currentTimeout = reactionTimeoutsRef.current[animation.key];

      if (currentTimeout) {
        window.clearTimeout(currentTimeout);
      }

      reactionTimeoutsRef.current[animation.key] = window.setTimeout(() => {
        setReactionAnimations((current) => current.filter((item) => item.key !== animation.key));
        delete reactionTimeoutsRef.current[animation.key];
      }, VIRTUAL_REACTION_ANIMATION_MS);
    });
  }, []);

  const registerReactions = useCallback(
    (reactions: VirtualTableReactionDto[]): void => {
      const next = getNewReactionAnimations({
        reactions,
        seenReactionIds: seenReactionIdsRef.current,
        optimisticReactions: optimisticReactionsRef.current,
        currentUserId: state.session?.user.id ?? null
      });

      seenReactionIdsRef.current = next.nextSeenReactionIds;
      optimisticReactionsRef.current = next.remainingOptimisticReactions;

      if (reactionsVisible) {
        queueReactionAnimations(next.animations);
      }
    },
    [queueReactionAnimations, reactionsVisible, state.session?.user.id]
  );

  const refreshTable = useCallback(
    async (background = false): Promise<GetVirtualTableResponseDto | null> => {
      if (!state.accessToken || !tableId) {
        setTableState({
          status: "idle",
          data: null,
          errorMessage: null
        });
        return null;
      }

      const requestId = tableRequestIdRef.current + 1;
      tableRequestIdRef.current = requestId;

      setTableState((current) => {
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
      });

      try {
        const data = await getVirtualTable(state.accessToken, tableId);

        registerReactions(data.reactions ?? []);

        if (tableRequestIdRef.current !== requestId) {
          return data;
        }

        setTableState({
          status: "ready",
          data,
          errorMessage: null
        });

        return data;
      } catch (error) {
        if (tableRequestIdRef.current !== requestId) {
          return null;
        }

        setTableState((current) => ({
          status: "error",
          data: current.data,
          errorMessage: getErrorMessage(error, "Не получилось открыть стол")
        }));

        return null;
      }
    },
    [registerReactions, state.accessToken, tableId]
  );

  useEffect(() => {
    void refreshTable();
  }, [refreshTable]);

  useEffect(() => {
    historyOverlayRequestIdRef.current += 1;
    setHistoryOverlayState({
      status: "idle",
      data: null,
      errorMessage: null
    });
    setIsHistoryOverlayLoadingMore(false);
    seenReactionIdsRef.current = new Set();
    optimisticReactionsRef.current = [];
    Object.values(reactionTimeoutsRef.current).forEach((timeoutId) => window.clearTimeout(timeoutId));
    reactionTimeoutsRef.current = {};
    setReactionAnimations([]);
  }, [tableId, state.accessToken]);

  useEffect(() => {
    setStoredVirtualReactionsVisibility(reactionsVisible);
  }, [reactionsVisible]);

  useEffect(() => {
    return () => {
      Object.values(reactionTimeoutsRef.current).forEach((timeoutId) => window.clearTimeout(timeoutId));
    };
  }, []);

  useEffect(() => {
    const tableStatus = tableState.data?.table.status;

    if (!tableStatus || !["WAITING_FOR_PLAYERS", "ACTIVE", "PAUSED"].includes(tableStatus)) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void refreshTable(true);
    }, 2000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [refreshTable, tableState.data?.table.status]);

  const mySeat = useMemo(() => {
    const currentUserId = state.session?.user.id;

    if (!currentUserId) {
      return null;
    }

    return tableState.data?.seats.find((seat) => seat.userId === currentUserId) ?? null;
  }, [state.session?.user.id, tableState.data?.seats]);

  const canManageTable = mySeat?.role === "OWNER" || mySeat?.role === "ADMIN";
  const canStartTable =
    canManageTable &&
    tableState.data?.table.status === "WAITING_FOR_PLAYERS" &&
    (tableState.data?.seats.length ?? 0) >= 2;
  const currentTableStatus = tableState.data?.table.status ?? null;
  const tableErrorMessageForToast =
    tableState.status === "error" && tableState.data ? tableState.errorMessage : null;
  const shouldUseToastOverlay = currentTableStatus
    ? shouldRenderVirtualTableToastOverlay(currentTableStatus)
    : false;
  const toastSource = useMemo(
    () =>
      getVirtualTableToastSource({
        feedbackMessage,
        tableErrorMessage: tableErrorMessageForToast,
        tableStatus: currentTableStatus
      }),
    [currentTableStatus, feedbackMessage, tableErrorMessageForToast]
  );

  const runMutation = useCallback(
    async (
      actionName: string,
      callback: (accessToken: string) => Promise<unknown>,
      options?: {
        onSettled?: () => void;
      }
    ): Promise<void> => {
      if (!state.accessToken || !tableId) {
        return;
      }

      setFeedbackMessage(null);
      setPendingAction(actionName);

      try {
        await callback(state.accessToken);
        await Promise.all([refreshTable(), refreshVirtualTables()]);
      } catch (error) {
        setFeedbackMessage(getErrorMessage(error, "Не получилось обновить стол"));
      } finally {
        setPendingAction(null);
        options?.onSettled?.();
      }
    },
    [refreshTable, refreshVirtualTables, state.accessToken, tableId]
  );

  const callbacks = useMemo(
    () => ({
      onSubmitAction: async (payload: SubmitVirtualActionRequestDto): Promise<void> => {
        await runMutation(payload.actionType, (accessToken) =>
          submitVirtualAction(accessToken, tableId, payload)
        );
      },
      onSubmitReaction: async (emoji: VirtualTableReactionEmoji): Promise<void> => {
        if (!state.accessToken || !tableId || !mySeat) {
          return;
        }

        const optimisticKey = `optimistic:${Date.now()}:${Math.random().toString(16).slice(2, 8)}`;
        const optimisticEntry: PendingOptimisticReaction = {
          seatId: mySeat.id,
          userId: state.session?.user.id ?? null,
          emoji,
          submittedAt: Date.now()
        };

        optimisticReactionsRef.current = [...optimisticReactionsRef.current, optimisticEntry];
        queueReactionAnimations([
          {
            key: optimisticKey,
            reactionId: null,
            seatId: mySeat.id,
            userId: state.session?.user.id ?? null,
            displayName: mySeat.displayName,
            emoji
          }
        ]);

        try {
          const response = await submitVirtualReaction(state.accessToken, tableId, { emoji });
          seenReactionIdsRef.current = new Set(seenReactionIdsRef.current).add(response.reaction.id);
          optimisticReactionsRef.current = optimisticReactionsRef.current.filter(
            (entry) => entry !== optimisticEntry
          );
          setTableState((current) => {
            if (current.status === "idle" || !current.data) {
              return current;
            }

            return {
              ...current,
              data: mergeTableReaction(current.data, response.reaction)
            };
          });
        } catch (error) {
          optimisticReactionsRef.current = optimisticReactionsRef.current.filter(
            (entry) => entry !== optimisticEntry
          );
          setFeedbackMessage(getVirtualReactionErrorMessage(error));
        }
      },
      onRequestSitOut: async (payload: RequestVirtualSitOutRequestDto): Promise<void> => {
        await runMutation("sit-out", (accessToken) =>
          requestVirtualSitOut(accessToken, tableId, payload)
        );
      },
      onReturnToTable: async (): Promise<void> => {
        await runMutation("return", (accessToken) => returnToVirtualTable(accessToken, tableId));
      },
      onPauseTable: async (): Promise<void> => {
        await runMutation("pause", (accessToken) => pauseVirtualTable(accessToken, tableId));
      },
      onResumeTable: async (): Promise<void> => {
        await runMutation("resume", (accessToken) => resumeVirtualTable(accessToken, tableId));
      },
      onRaiseBlinds: async (payload: RaiseVirtualBlindsRequestDto): Promise<void> => {
        await runMutation("raise-blinds", (accessToken) =>
          raiseVirtualBlinds(accessToken, tableId, payload)
        );
      },
      onFinishTable: async (): Promise<void> => {
        await runMutation("finish", (accessToken) => finishVirtualTable(accessToken, tableId));
      },
      onCancelTable: async (): Promise<void> => {
        await runMutation("cancel", (accessToken) => cancelVirtualTable(accessToken, tableId));
      },
      onStartNextHand: async (): Promise<void> => {
        await runMutation("next-hand", (accessToken) => startNextVirtualHand(accessToken, tableId));
      }
    }),
    [mySeat, queueReactionAnimations, runMutation, state.accessToken, state.session?.user.id, tableId]
  );

  const handleStartTable = useCallback(async (): Promise<void> => {
    if (!state.accessToken || !tableId) {
      return;
    }

    setPendingStart(true);
    setFeedbackMessage(null);

    try {
      await startVirtualTable(state.accessToken, tableId);
      await Promise.all([refreshTable(), refreshVirtualTables()]);
    } catch (error) {
      setFeedbackMessage(getErrorMessage(error, "Не получилось начать игру"));
    } finally {
      setPendingStart(false);
    }
  }, [refreshTable, refreshVirtualTables, state.accessToken, tableId]);

  const handleCancelWaitingTable = useCallback(async (): Promise<void> => {
    if (!state.accessToken || !tableId) {
      return;
    }

    setPendingCancel(true);
    setFeedbackMessage(null);

    try {
      await cancelVirtualTable(state.accessToken, tableId);
      await Promise.all([refreshTable(), refreshVirtualTables()]);
    } catch (error) {
      setFeedbackMessage(getErrorMessage(error, "Не получилось отменить стол"));
    } finally {
      setPendingCancel(false);
    }
  }, [refreshTable, refreshVirtualTables, state.accessToken, tableId]);

  const loadHistoryOverlay = useCallback(
    async (cursor?: string | null): Promise<void> => {
      if (!state.accessToken || !tableId) {
        historyOverlayRequestIdRef.current += 1;
        setHistoryOverlayState({
          status: "idle",
          data: null,
          errorMessage: null
        });
        setIsHistoryOverlayLoadingMore(false);
        return;
      }

      const requestId = historyOverlayRequestIdRef.current + 1;
      historyOverlayRequestIdRef.current = requestId;

      if (cursor) {
        setIsHistoryOverlayLoadingMore(true);
      } else {
        setHistoryOverlayState((current) => ({
          status: "loading",
          data: current.data,
          errorMessage: null
        }));
      }

      try {
        const data = await fetchVirtualTableHistoryOverlayPage(state.accessToken, tableId, cursor);

        if (historyOverlayRequestIdRef.current !== requestId) {
          return;
        }

        setHistoryOverlayState((current) => ({
          status: "ready",
          data: mergeVirtualHandHistoryPages(current.data, data, cursor),
          errorMessage: null
        }));
      } catch (error) {
        if (historyOverlayRequestIdRef.current !== requestId) {
          return;
        }

        setHistoryOverlayState((current) => ({
          status: "error",
          data: current.data,
          errorMessage: getErrorMessage(error, "Не получилось загрузить историю раздач")
        }));
      } finally {
        if (historyOverlayRequestIdRef.current === requestId) {
          setIsHistoryOverlayLoadingMore(false);
        }
      }
    },
    [state.accessToken, tableId]
  );

  useEffect(() => {
    if (!toastSource) {
      setActiveToastKey(null);
      return undefined;
    }

    setActiveToastKey(toastSource.key);

    return scheduleVirtualTableToastDismiss(() => {
      setActiveToastKey((current) => (current === toastSource.key ? null : current));
    });
  }, [toastSource]);

  if (!state.accessToken) {
    return (
      <VirtualRouteState
        description="Стол откроется сразу после входа."
        title="Онлайн-покер"
      />
    );
  }

  if (tableState.status === "loading" && !tableState.data) {
    return (
      <VirtualRouteState
        description="Поднимаем состояние стола, состав и текущую раздачу."
        title="Онлайн-покер"
        tone="loading"
      />
    );
  }

  if (tableState.status === "error" && !tableState.data) {
    return (
      <VirtualRouteState
        action={
          <Button className="w-full" onClick={() => void refreshTable()}>
            Обновить стол
          </Button>
        }
        description={tableState.errorMessage}
        title="Онлайн-покер"
        tone="error"
      />
    );
  }

  if (!tableState.data) {
    return (
      <VirtualRouteState
        description="Похоже, этот стол пока недоступен."
        title="Онлайн-покер"
      />
    );
  }

  const { table, seats } = tableState.data;
  const activeToast = toastSource && activeToastKey === toastSource.key ? toastSource : null;

  if (table.status === "WAITING_FOR_PLAYERS") {
    return (
      <div className="space-y-4">
        {feedbackMessage ? <InlineVirtualMessage message={feedbackMessage} tone="error" /> : null}
        <VirtualWaitingRoomScreen
          canCancel={canManageTable}
          canStart={Boolean(canStartTable)}
          isCancelling={pendingCancel}
          isStarting={pendingStart}
          onCancelTable={() => void handleCancelWaitingTable()}
          onCopyCode={() => void copyText(table.inviteCode)}
          onStartGame={() => void handleStartTable()}
          seats={seats}
          table={table}
        />
      </div>
    );
  }

  return (
    <div
      className={
        table.status === "ACTIVE" || table.status === "PAUSED"
          ? "relative h-full"
          : "space-y-4"
      }
    >
      {shouldUseToastOverlay && activeToast ? (
        <VirtualToastOverlay
          message={activeToast.message}
          onDismiss={() => setActiveToastKey(null)}
          tone={activeToast.tone}
        />
      ) : null}
      <VirtualTableScreen
        callbacks={callbacks}
        data={tableState.data}
        historyOverlay={{
          status: historyOverlayState.status,
          data: historyOverlayState.data,
          errorMessage: historyOverlayState.errorMessage,
          isLoadingMore: isHistoryOverlayLoadingMore,
          onOpen: () => {
            if (historyOverlayState.status === "idle") {
              void loadHistoryOverlay();
            }
          },
          onRetry: () => {
            void loadHistoryOverlay();
          },
          onOpenHand: (handId) => {
            openVirtualHandHistoryDetail(navigate, tableId, handId);
          },
          ...(historyOverlayState.data?.nextCursor
            ? {
                onLoadMore: () => {
                  void loadHistoryOverlay(historyOverlayState.data?.nextCursor);
                }
              }
            : {})
        }}
        mySeatId={mySeat?.id ?? findMySeatId(table.id, state.session?.user.id ?? null, tableState.data.seats, virtualTablesState.data)}
        onReactionsVisibleChange={setReactionsVisible}
        pendingAction={pendingAction}
        reactionAnimations={reactionAnimations}
        reactionsVisible={reactionsVisible}
      />
    </div>
  );
}

export function VirtualTableHistoryContainer(): JSX.Element {
  const { tableId = "" } = useParams();
  const navigate = useNavigate();
  const { state } = useSession();
  const historyRequestIdRef = useRef(0);
  const [historyState, setHistoryState] = useState<AsyncState<GetVirtualHandHistoriesResponseDto>>({
    status: "idle",
    data: null,
    errorMessage: null
  });
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const loadHistory = useCallback(
    async (cursor?: string | null): Promise<void> => {
      if (!state.accessToken || !tableId) {
        historyRequestIdRef.current += 1;
        setHistoryState({
          status: "idle",
          data: null,
          errorMessage: null
        });
        return;
      }

      const requestId = historyRequestIdRef.current + 1;
      historyRequestIdRef.current = requestId;

      if (cursor) {
        setIsLoadingMore(true);
      } else {
        setHistoryState((current) => ({
          status: "loading",
          data: current.data,
          errorMessage: null
        }));
      }

      try {
        const data = await getVirtualHandHistories(state.accessToken, tableId, {
          cursor: cursor ?? null,
          limit: 20
        });

        if (historyRequestIdRef.current !== requestId) {
          return;
        }

        setHistoryState((current) => ({
          status: "ready",
          data: mergeVirtualHandHistoryPages(current.data, data, cursor),
          errorMessage: null
        }));
      } catch (error) {
        if (historyRequestIdRef.current !== requestId) {
          return;
        }

        setHistoryState((current) => ({
          status: "error",
          data: current.data,
          errorMessage: getErrorMessage(error, "Не получилось загрузить историю раздач")
        }));
      } finally {
        if (historyRequestIdRef.current === requestId) {
          setIsLoadingMore(false);
        }
      }
    },
    [state.accessToken, tableId]
  );

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  if (!state.accessToken) {
    return (
      <VirtualRouteState
        description="История раздач будет доступна сразу после входа."
        title="История раздач"
      />
    );
  }

  if (historyState.status === "loading" && !historyState.data) {
    return (
      <VirtualRouteState
        description="Поднимаем последние раздачи этого стола."
        title="История раздач"
        tone="loading"
      />
    );
  }

  if (historyState.status === "error" && !historyState.data) {
    return (
      <VirtualRouteState
        action={
          <Button className="w-full" onClick={() => void loadHistory()}>
            Обновить историю
          </Button>
        }
        description={historyState.errorMessage}
        title="История раздач"
        tone="error"
      />
    );
  }

  return (
    <div className="space-y-4">
      {historyState.status === "error" && historyState.data ? (
        <InlineVirtualMessage message={historyState.errorMessage} tone="error" />
      ) : null}
      {historyState.data ? (
        <VirtualHandHistoryListScreen
          data={historyState.data}
          isLoadingMore={isLoadingMore}
          onOpenHand={(handId) => {
            openVirtualHandHistoryDetail(navigate, tableId, handId);
          }}
          {...(historyState.data.nextCursor
            ? {
                onLoadMore: () => {
                  void loadHistory(historyState.data!.nextCursor);
                }
              }
            : {})}
        />
      ) : null}
    </div>
  );
}

export function VirtualHandHistoryDetailContainer(): JSX.Element {
  const { handId = "", tableId = "" } = useParams();
  const navigate = useNavigate();
  const { state } = useSession();
  const handRequestIdRef = useRef(0);
  const [historyState, setHistoryState] = useState<AsyncState<GetVirtualHandHistoryResponseDto>>({
    status: "idle",
    data: null,
    errorMessage: null
  });

  const loadHand = useCallback(async (): Promise<void> => {
    if (!state.accessToken || !tableId || !handId) {
      handRequestIdRef.current += 1;
      setHistoryState({
        status: "idle",
        data: null,
        errorMessage: null
      });
      return;
    }

    const requestId = handRequestIdRef.current + 1;
    handRequestIdRef.current = requestId;

    setHistoryState((current) => ({
      status: "loading",
      data: current.data,
      errorMessage: null
    }));

    try {
      const data = await getVirtualHandHistory(state.accessToken, tableId, handId);

      if (handRequestIdRef.current !== requestId) {
        return;
      }

      setHistoryState({
        status: "ready",
        data,
        errorMessage: null
      });
    } catch (error) {
      if (handRequestIdRef.current !== requestId) {
        return;
      }

      setHistoryState((current) => ({
        status: "error",
        data: current.data,
        errorMessage: getErrorMessage(error, "Не получилось открыть раздачу")
      }));
    }
  }, [handId, state.accessToken, tableId]);

  useEffect(() => {
    void loadHand();
  }, [loadHand]);

  if (!state.accessToken) {
    return (
      <VirtualRouteState
        description="Детали раздачи появятся после входа."
        title="История раздач"
      />
    );
  }

  if (historyState.status === "loading" && !historyState.data) {
    return (
      <VirtualRouteState
        description="Открываем последовательность действий и шоудаун."
        title="История раздач"
        tone="loading"
      />
    );
  }

  if (historyState.status === "error" && !historyState.data) {
    return (
      <VirtualRouteState
        action={
          <Button className="w-full" onClick={() => void loadHand()}>
            Открыть еще раз
          </Button>
        }
        description={historyState.errorMessage}
        title="История раздач"
        tone="error"
      />
    );
  }

  return (
    <div className="space-y-4">
      {historyState.status === "error" && historyState.data ? (
        <InlineVirtualMessage message={historyState.errorMessage} tone="error" />
      ) : null}
      {historyState.data ? (
        <VirtualHandHistoryDetailScreen
          data={historyState.data}
          onBack={() => {
            void navigate(getVirtualTableHistoryRoute(tableId));
          }}
        />
      ) : null}
    </div>
  );
}

export function VirtualLeaderboardContainer(): JSX.Element {
  const { state } = useSession();
  const [leaderboardState, setLeaderboardState] = useState<AsyncState<GetVirtualLeaderboardResponseDto>>({
    status: "idle",
    data: null,
    errorMessage: null
  });
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const loadLeaderboard = useCallback(
    async (cursor?: string | null): Promise<void> => {
      if (!state.accessToken) {
        setLeaderboardState({
          status: "idle",
          data: null,
          errorMessage: null
        });
        return;
      }

      if (cursor) {
        setIsLoadingMore(true);
      } else {
        setLeaderboardState((current) => ({
          status: "loading",
          data: current.data,
          errorMessage: null
        }));
      }

      try {
        const data = await getVirtualLeaderboard(state.accessToken, {
          cursor: cursor ?? null,
          limit: 25
        });

        setLeaderboardState((current) => ({
          status: "ready",
          data:
            cursor && current.data
              ? {
                  items: [...current.data.items, ...data.items],
                  nextCursor: data.nextCursor
                }
              : data,
          errorMessage: null
        }));
      } catch (error) {
        setLeaderboardState((current) => ({
          status: "error",
          data: current.data,
          errorMessage: getErrorMessage(error, "Не получилось загрузить онлайн-рейтинг")
        }));
      } finally {
        setIsLoadingMore(false);
      }
    },
    [state.accessToken]
  );

  useEffect(() => {
    void loadLeaderboard();
  }, [loadLeaderboard]);

  if (!state.accessToken) {
    return (
      <VirtualRouteState
        description="Онлайн-рейтинг откроется после входа."
        title="Онлайн-рейтинг"
      />
    );
  }

  if (leaderboardState.status === "loading" && !leaderboardState.data) {
    return (
      <VirtualRouteState
        description="Считаем текущие места и очки за онлайн-игру."
        title="Онлайн-рейтинг"
        tone="loading"
      />
    );
  }

  if (leaderboardState.status === "error" && !leaderboardState.data) {
    return (
      <VirtualRouteState
        action={
          <Button className="w-full" onClick={() => void loadLeaderboard()}>
            Обновить рейтинг
          </Button>
        }
        description={leaderboardState.errorMessage}
        title="Онлайн-рейтинг"
        tone="error"
      />
    );
  }

  return (
    <div className="space-y-4">
      {leaderboardState.status === "error" && leaderboardState.data ? (
        <InlineVirtualMessage message={leaderboardState.errorMessage} tone="error" />
      ) : null}
      {leaderboardState.data ? (
        <VirtualLeaderboardScreen
          data={leaderboardState.data}
          isLoadingMore={isLoadingMore}
          {...(leaderboardState.data.nextCursor
            ? {
                onLoadMore: () => {
                  void loadLeaderboard(leaderboardState.data!.nextCursor);
                }
              }
            : {})}
        />
      ) : null}
    </div>
  );
}

export function VirtualStatsContainer(): JSX.Element {
  const { state } = useSession();
  const [statsState, setStatsState] = useState<AsyncState<GetMyVirtualStatsResponseDto>>({
    status: "idle",
    data: null,
    errorMessage: null
  });

  const loadStats = useCallback(async (): Promise<void> => {
    if (!state.accessToken) {
      setStatsState({
        status: "idle",
        data: null,
        errorMessage: null
      });
      return;
    }

    setStatsState((current) => ({
      status: "loading",
      data: current.data,
      errorMessage: null
    }));

    try {
      const data = await getMyVirtualStats(state.accessToken);
      setStatsState({
        status: "ready",
        data,
        errorMessage: null
      });
    } catch (error) {
      setStatsState((current) => ({
        status: "error",
        data: current.data,
        errorMessage: getErrorMessage(error, "Не получилось загрузить статистику")
      }));
    }
  }, [state.accessToken]);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  if (!state.accessToken) {
    return (
      <VirtualRouteState
        description="Личная статистика по онлайн-игре появится после входа."
        title="Статистика"
      />
    );
  }

  if (statsState.status === "loading" && !statsState.data) {
    return (
      <VirtualRouteState
        description="Собираем число рук, процент побед и результат по виртуальным столам."
        title="Статистика"
        tone="loading"
      />
    );
  }

  if (statsState.status === "error" && !statsState.data) {
    return (
      <VirtualRouteState
        action={
          <Button className="w-full" onClick={() => void loadStats()}>
            Обновить статистику
          </Button>
        }
        description={statsState.errorMessage}
        title="Статистика"
        tone="error"
      />
    );
  }

  return (
    <div className="space-y-4">
      {statsState.status === "error" && statsState.data ? (
        <InlineVirtualMessage message={statsState.errorMessage} tone="error" />
      ) : null}
      {statsState.data ? <VirtualStatsScreen data={statsState.data} recentTables={[]} /> : null}
    </div>
  );
}

function InlineVirtualMessage({
  message,
  tone
}: {
  message: string;
  tone: "error" | "loading";
}): JSX.Element {
  return (
    <section className="px-4">
      <div className="mx-auto max-w-3xl">
        <GlassPanel className={tone === "error" ? "border-[#ffb4ab]/25" : "border-[#4edea3]/20"}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-white">
                {tone === "error" ? "Пока не получилось" : "Обновляем стол"}
              </p>
              <p className="mt-1 text-sm text-[#8e9192]">{message}</p>
            </div>
            <RolePill tone={tone === "error" ? "negative" : "positive"}>
              {tone === "error" ? "Ошибка" : "В игре"}
            </RolePill>
          </div>
        </GlassPanel>
      </div>
    </section>
  );
}

type VirtualToastTone = "error" | "loading";

type VirtualTableToastSource = {
  key: string;
  message: string;
  tone: VirtualToastTone;
} | null;

function VirtualToastOverlay({
  message,
  tone,
  onDismiss
}: {
  message: string;
  tone: VirtualToastTone;
  onDismiss: () => void;
}): JSX.Element {
  return (
    <div className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+0.75rem)] z-[70] px-3">
      <div className="mx-auto max-w-[30rem] pointer-events-auto">
        <GlassPanel
          className={
            tone === "error"
              ? "border-[#ffb4ab]/25 bg-[#1a1a1a]/95"
              : "border-[#4edea3]/20 bg-[#1a1a1a]/95"
          }
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white">
                {tone === "error" ? "Пока не получилось" : "Обновляем стол"}
              </p>
              <p className="mt-1 text-sm text-[#8e9192]">{message}</p>
            </div>
            <div className="flex items-center gap-2">
              <RolePill tone={tone === "error" ? "negative" : "positive"}>
                {tone === "error" ? "Ошибка" : "В игре"}
              </RolePill>
              <button
                aria-label="Скрыть уведомление"
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white transition hover:bg-white/[0.08]"
                onClick={onDismiss}
                type="button"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
          </div>
        </GlassPanel>
      </div>
    </div>
  );
}

function VirtualRouteState({
  title,
  description,
  tone = "idle",
  action
}: {
  title: string;
  description: string;
  tone?: "idle" | "loading" | "error";
  action?: JSX.Element;
}): JSX.Element {
  return (
    <div className={virtualScreenClassName}>
      <div className="mx-auto max-w-3xl space-y-6 pb-8">
        <ScreenHeader
          eyebrow={title}
          title={title}
          description={description}
          trailing={tone === "loading" ? <RolePill tone="positive">В игре</RolePill> : undefined}
        />
        <EmptyState
          action={action}
          description={description}
          icon={tone === "error" ? "warning" : tone === "loading" ? "hourglass_top" : "lock"}
          title={
            tone === "error"
              ? "Нужно еще одно действие"
              : tone === "loading"
                ? "Загружаем"
                : "Пока недоступно"
          }
        />
      </div>
    </div>
  );
}

function findMySeatId(
  tableId: string,
  currentUserId: string | null,
  seats: VirtualSeatDto[],
  listData: GetVirtualTablesResponseDto | null | undefined
): string | null {
  const seat = currentUserId ? seats.find((item) => item.userId === currentUserId) : null;

  if (seat) {
    return seat.id;
  }

  return listData?.items.find((item) => item.id === tableId)?.mySeatId ?? null;
}

export function shouldRenderVirtualTableToastOverlay(tableStatus: string | null): boolean {
  return tableStatus !== null && tableStatus !== "WAITING_FOR_PLAYERS";
}

export function getVirtualTableToastSource(input: {
  feedbackMessage: string | null;
  tableErrorMessage: string | null;
  tableStatus: string | null;
}): VirtualTableToastSource {
  if (!shouldRenderVirtualTableToastOverlay(input.tableStatus)) {
    return null;
  }

  if (input.feedbackMessage) {
    return {
      key: `feedback:${input.feedbackMessage}`,
      message: input.feedbackMessage,
      tone: "error"
    };
  }

  if (input.tableErrorMessage) {
    return {
      key: `table-error:${input.tableErrorMessage}`,
      message: input.tableErrorMessage,
      tone: "error"
    };
  }

  return null;
}

export function scheduleVirtualTableToastDismiss(onDismiss: () => void): () => void {
  const timeoutId = globalThis.setTimeout(onDismiss, VIRTUAL_TABLE_TOAST_DISMISS_MS);

  return () => {
    globalThis.clearTimeout(timeoutId);
  };
}

async function copyText(value: string): Promise<void> {
  if (!navigator.clipboard?.writeText) {
    return;
  }

  try {
    await navigator.clipboard.writeText(value);
  } catch {
    return;
  }
}

export function mergeTableReaction(
  data: GetVirtualTableResponseDto,
  reaction: VirtualTableReactionDto
): GetVirtualTableResponseDto {
  const reactions = data.reactions.some((item) => item.id === reaction.id)
    ? data.reactions
    : [...data.reactions, reaction];

  return {
    ...data,
    reactions
  };
}

export function getVirtualReactionErrorMessage(error: unknown): string {
  if (error instanceof ApiRequestError && error.status === 429) {
    return "Слишком часто. Попробуйте через пару секунд.";
  }

  return getErrorMessage(error, "Не получилось отправить реакцию");
}

function getErrorMessage(error: unknown, fallbackMessage: string): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return fallbackMessage;
}

function toCreateFormValue(
  field: keyof CreateVirtualTableFormValues,
  value: string | number | boolean | null | undefined
): string | boolean {
  if (field === "timeoutAutoActionRule") {
    return typeof value === "string" ? value : "";
  }

  if (field === "winProbabilityEnabled") {
    return value === true;
  }

  if (typeof value === "number") {
    return String(value);
  }

  return value ?? "";
}

import type { JSX } from "react";
import type { Dispatch, FormEvent, PointerEvent as ReactPointerEvent, ReactNode, SetStateAction } from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type {
  GetLeaderboardResponseDto,
  GetPlayerProfileResponseDto,
  GetVirtualTableResponseDto,
  GetRoomResponseDto,
  GetVirtualLeaderboardResponseDto,
  GetVirtualPlayerProfileResponseDto,
  RebuyHistoryItemDto,
  RoomPlayerDto,
  RoomsListResponseDto,
  SettlementPreviewResponseDto,
  SubmitFinalChipsRequestDto
} from "@pokertable/shared";
import { chipsToMoneyMinor, formatChips, formatChipsWithCurrencyApprox, formatMinorMoney } from "@pokertable/shared";
import { Link, Navigate, Route, Routes, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import type { NavigateFunction } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { CompactGameRow } from "@/components/visual";
import {
  ApiRequestError,
  cancelRebuy,
  closeSettlement,
  createRebuy,
  createRoom,
  getClubEvents,
  getLeaderboard,
  getPlayerProfile,
  getVirtualTable,
  getVirtualLeaderboard,
  getVirtualPlayerProfile,
  getRebuyHistory,
  getRoom,
  getRooms,
  joinRoom,
  leaveRoom,
  previewSettlement,
  resolveInviteCode,
  returnToRoom,
  startRoom
} from "@/lib/api";
import { sendClientBootBeacon } from "@/lib/client-boot";
import {
  canUseBrowserBack,
  getClubInviteCodeFromStartParam,
  getTelegramBackFallbackPath,
  getVirtualInviteCodeFromStartParam,
  hideTelegramBackButton,
  offTelegramBackButtonClick,
  onTelegramBackButtonClick,
  showTelegramBackButton
} from "@/lib/telegram";
import { useSession } from "@/session/session-context";
import {
  buildCreateRoomPayload,
  getCreateRoomValidationMessage,
  ROOM_TITLE_MAX_LENGTH,
  type CreateRoomFormValues
} from "./features/rooms/room-form";
import { ClubsProvider, useClubsList } from "./features/clubs/club-data";
import { ClubEventPreviewCard } from "./features/clubs/club-event-preview";
import { useUpcomingClubEvents, type ClubHomeEventItem } from "./features/clubs/club-home-events";
import { ClubSchedulingSection } from "./features/clubs/club-form";
import type { ClubEventListItemDto } from "./features/clubs/types";
import {
  ClubDashboardContainer,
  ClubEventDetailsContainer,
  ClubInviteContainer,
  ClubsHomeContainer,
  CreateClubContainer,
  JoinClubContainer
} from "./features/clubs/club-containers";
import {
  getClubDashboardRoute,
  getClubEventRoute,
  getClubInviteRoute,
  getClubJoinRoute,
  getClubsNewRoute,
  isClubRoutePath
} from "./features/clubs/routes";
import {
  DEFAULT_LEADERBOARD_QUERY,
  formatPercentFromBps,
  formatSignedMinorStat,
  getLeaderboardEmptyCopy,
  getResultTone,
  LEADERBOARD_PERIOD_OPTIONS,
  LEADERBOARD_SCOPE_OPTIONS
} from "./features/leaderboard/leaderboard-view";
import {
  buildHomeViewModel,
  getPrimaryActiveTurn,
  type HomeClubEvent,
  type HomeActiveTableCard,
  type HomeTarget
} from "./features/home/home-view";
import { resolveMiniAppVisual } from "./features/visual/mini-app-visuals";
import {
  ActiveRoomAdmin,
  ActiveRoomPlayer,
  ClosedRoomResults,
  type RebuyHistoryState,
  SettlementInputScreen,
  WaitingRoom
} from "./features/rooms/room-screens";
import {
  getClubRoute,
  getCreateRoomRoute,
  getGamesRoute,
  getHomeRoute,
  getJoinRoute,
  getJoinRoomRoute,
  getLeaderboardRoute,
  getPlayerRoute,
  getRoomRoute
} from "./features/rooms/routes";
import {
  canSelfRebuy,
  getMyPlayer,
  getRoomSurface,
  getSettlementPlayers,
  getSelfRebuyHint
} from "./features/rooms/room-view";
import {
  buildSettlementPreviewPayload,
  getInitialFinalAmountInput,
  getSettlementDraftKey,
  getSettlementDraftPlayers,
  getSettlementDraftSummary
} from "./features/rooms/settlement-view";
import {
  CreateVirtualTableContainer,
  JoinVirtualTableContainer,
  VirtualHandHistoryDetailContainer,
  VirtualLeaderboardContainer,
  VirtualLobbyContainer,
  VirtualStatsContainer,
  VirtualTableContainer,
  VirtualTableHistoryContainer
} from "./features/virtual/virtual-containers";
import { VirtualTablesProvider, useVirtualTablesList } from "./features/virtual/virtual-data";
import {
  getCreateVirtualTableRoute,
  getJoinVirtualTableInviteRoute,
  getJoinVirtualTableRoute,
  getVirtualLeaderboardRoute,
  getVirtualLobbyRoute,
  getVirtualStatsRoute,
  getVirtualTableHistoryRoute,
  getVirtualTableRoute
} from "./features/virtual/routes";
import { cn } from "./lib/utils";

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

type RoomConfirmationState =
  | {
      kind: "create-rebuy";
      idempotencyKey: string;
      roomPlayerId: string;
      playerName: string;
      amountChips: string;
      isSelf: boolean;
    }
  | {
      kind: "cancel-rebuy";
      idempotencyKey: string;
      rebuyId: string;
      playerName: string;
      amountChips: string;
    };

type RoomMode = "overview" | "settlement";
type LeaderboardMode = "offline" | "online";
type ProfileMode = LeaderboardMode;

type LeaveDialogState = {
  finalAmountInput: string;
  errorMessage: string | null;
};

type SettlementPreviewState =
  | {
      status: "idle" | "loading";
      data: SettlementPreviewResponseDto | null;
      errorMessage: string | null;
      draftKey: string | null;
    }
  | {
      status: "ready";
      data: SettlementPreviewResponseDto;
      errorMessage: null;
      draftKey: string;
    }
  | {
      status: "error";
      data: SettlementPreviewResponseDto | null;
      errorMessage: string;
      draftKey: string | null;
    };

type RoomsListContextValue = {
  roomsState: LoadState<RoomsListResponseDto>;
  refreshRooms: () => Promise<void>;
};

const cardClassName = "glass-card rounded-2xl bg-card p-4 shadow-panel";
const mutedCardClassName = "glass-card rounded-2xl bg-white/[0.02] p-4";
const modeToggleClassName =
  "rounded-2xl bg-[linear-gradient(180deg,rgba(17,28,24,0.9),rgba(11,17,14,0.96))] p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]";
const inputClassName =
  "mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-surfaceHigher px-4 text-sm text-foreground outline-none transition placeholder:text-muted/60 focus:border-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const labelClassName = "text-sm font-medium text-foreground";
const secondaryButtonClassName =
  "border border-white/10 bg-surfaceHigh text-foreground shadow-none hover:bg-surfaceHigher";
const tertiaryButtonClassName =
  "border border-white/10 bg-transparent text-foreground shadow-none hover:bg-white/[0.03]";
const appHeaderTopPadding = "calc(env(safe-area-inset-top) + 1.25rem)";
const appMainTopPadding = "calc(env(safe-area-inset-top) + 7.25rem)";
const swipeEdgeWidth = 32;
const swipeBackDistance = 72;
const splashMinDurationMs = 700;
const splashMaxDurationMs = 5000;
const pokerTableLogoPath = "/poker-table-logo.svg";

export default function App(): JSX.Element {
  return (
    <RoomsListProvider>
      <ClubsProvider>
        <VirtualTablesProvider>
          <AppShell />
        </VirtualTablesProvider>
      </ClubsProvider>
    </RoomsListProvider>
  );
}

function AppShell(): JSX.Element {
  const { state } = useSession();
  const location = useLocation();
  const navigate = useNavigate();
  const swipeStateRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
  } | null>(null);
  const splashStartedAtRef = useRef(Date.now());
  const [showSplash, setShowSplash] = useState(true);
  const canSwipeBack = location.pathname !== getHomeRoute();
  const isCompactJoinRoute = isCompactJoinRoutePath(location.pathname);
  const { virtualTablesState } = useVirtualTablesList();
  const virtualTableRouteId = getVirtualTableRouteId(location.pathname);
  const virtualTableListItem = virtualTableRouteId
    ? virtualTablesState.data?.items.find((table) => table.id === virtualTableRouteId)
    : null;
  const isVirtualTableFullscreen =
    virtualTableListItem?.status === "ACTIVE" || virtualTableListItem?.status === "PAUSED";

  useEffect(() => {
    const maxDurationTimeoutId = window.setTimeout(
      () => setShowSplash(false),
      splashMaxDurationMs
    );

    return () => {
      window.clearTimeout(maxDurationTimeoutId);
    };
  }, []);

  useEffect(() => {
    const isBootstrapping = state.status === "idle" || state.status === "loading";

    if (isBootstrapping) {
      return;
    }

    const elapsed = Date.now() - splashStartedAtRef.current;
    const remaining = Math.max(0, splashMinDurationMs - elapsed);
    const timeoutId = window.setTimeout(() => setShowSplash(false), remaining);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [state.status]);

  const handleBackNavigation = useCallback((): void => {
    navigateBack(navigate, location.pathname);
  }, [location.pathname, navigate]);

  function resetSwipe(): void {
    swipeStateRef.current = null;
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>): void {
    if (!canSwipeBack || event.pointerType === "mouse" || event.clientX > swipeEdgeWidth) {
      return;
    }

    swipeStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY
    };
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>): void {
    const swipeState = swipeStateRef.current;

    if (!swipeState || swipeState.pointerId !== event.pointerId) {
      return;
    }

    const deltaX = event.clientX - swipeState.startX;
    const deltaY = event.clientY - swipeState.startY;

    if (Math.abs(deltaY) > 24 && Math.abs(deltaY) > Math.abs(deltaX)) {
      resetSwipe();
      return;
    }

    if (deltaX < 0) {
      return;
    }

    if (deltaX >= swipeBackDistance && Math.abs(deltaX) > Math.abs(deltaY) * 1.4) {
      resetSwipe();
      handleBackNavigation();
    }
  }

  return (
    <div
      className="relative min-h-[100dvh] overflow-x-hidden bg-surface text-foreground"
      onPointerCancel={resetSwipe}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={resetSwipe}
    >
      <div className="pointer-events-none fixed inset-x-0 top-0 z-0 h-[28rem] bg-[radial-gradient(circle_at_top,rgba(78,222,163,0.11),transparent_56%)]" />
      <div className="pointer-events-none fixed inset-y-0 right-[-7rem] z-0 w-[16rem] bg-[radial-gradient(circle,rgba(78,222,163,0.06),transparent_62%)] blur-3xl" />
      <LaunchInviteRedirect />
      <TelegramBackButtonSync />
      {isVirtualTableFullscreen ? null : <AppChrome />}
      <main
        className={cn(
          "relative z-10 flex w-full flex-col",
          isVirtualTableFullscreen ? "gap-0 px-0" : "gap-5 px-4"
        )}
        style={{
          paddingTop: isVirtualTableFullscreen ? "0" : appMainTopPadding,
          paddingBottom: isVirtualTableFullscreen
            ? "0"
            : isCompactJoinRoute
              ? "calc(env(safe-area-inset-bottom) + 1.5rem)"
              : "calc(env(safe-area-inset-bottom) + 6.5rem)",
          minHeight: "100dvh",
          height: isVirtualTableFullscreen ? "100dvh" : undefined
        }}
      >
        <Routes>
          <Route path={getHomeRoute()} element={<HomeScreen />} />
          <Route path={getGamesRoute()} element={<GamesScreen />} />
          <Route path={getClubRoute()} element={<ClubsHomeContainer />} />
          <Route path="/clubs" element={<ClubsHomeContainer />} />
          <Route path={getClubsNewRoute()} element={<CreateClubContainer />} />
          <Route path="/clubs/join/:inviteCode" element={<JoinClubContainer />} />
          <Route path={getClubDashboardRoute(":clubId")} element={<ClubDashboardContainer />} />
          <Route path={getClubInviteRoute(":clubId")} element={<ClubInviteContainer />} />
          <Route path={getClubEventRoute(":clubId", ":eventId")} element={<ClubEventDetailsContainer />} />
          <Route path={getVirtualLobbyRoute()} element={<VirtualLobbyContainer />} />
          <Route path={getCreateVirtualTableRoute()} element={<CreateVirtualTableContainer />} />
          <Route path={getJoinVirtualTableRoute()} element={<JoinVirtualTableContainer />} />
          <Route path="/poker/join/:inviteCode" element={<JoinVirtualTableContainer />} />
          <Route path={getVirtualTableRoute(":tableId")} element={<VirtualTableContainer />} />
          <Route path={getVirtualTableHistoryRoute(":tableId")} element={<VirtualTableHistoryContainer />} />
          <Route path="/poker/tables/:tableId/hands/:handId" element={<VirtualHandHistoryDetailContainer />} />
          <Route path={getVirtualLeaderboardRoute()} element={<VirtualLeaderboardContainer />} />
          <Route path={getVirtualStatsRoute()} element={<VirtualStatsContainer />} />
          <Route path={getLeaderboardRoute()} element={<LeaderboardScreen />} />
          <Route path="/players/:userId" element={<PlayerProfileScreen />} />
          <Route path={getCreateRoomRoute()} element={<CreateRoomScreen />} />
          <Route path="/rooms/:roomId" element={<RoomScreen />} />
          <Route path={getJoinRoute()} element={<JoinRoomScreen />} />
          <Route path="/join/:inviteCode" element={<JoinRoomScreen />} />
          <Route path="*" element={<Navigate to={getHomeRoute()} replace />} />
        </Routes>
      </main>
      {isCompactJoinRoute || isVirtualTableFullscreen ? null : <BottomNav />}
      <AppSplashScreen visible={showSplash} />
    </div>
  );
}

function RoomsListProvider({ children }: { children: ReactNode }): JSX.Element {
  const { state } = useSession();
  const refreshRequestIdRef = useRef(0);
  const [roomsState, setRoomsState] = useState<LoadState<RoomsListResponseDto>>({
    status: "idle",
    data: null,
    errorMessage: null
  });

  const refreshRoomsInternal = useCallback(async (background = false): Promise<void> => {
    if (!state.accessToken) {
      refreshRequestIdRef.current += 1;
      setRoomsState({
        status: "idle",
        data: null,
        errorMessage: null
      });
      return;
    }

    const requestId = refreshRequestIdRef.current + 1;
    refreshRequestIdRef.current = requestId;

    setRoomsState((current) => {
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
      const data = await getRooms(state.accessToken);

      if (refreshRequestIdRef.current !== requestId) {
        return;
      }

      setRoomsState({
        status: "ready",
        data,
        errorMessage: null
      });
    } catch (error) {
      if (refreshRequestIdRef.current !== requestId) {
        return;
      }

      setRoomsState((current) => ({
        status: "error",
        data: current.data,
        errorMessage: getErrorMessage(error, "Не получилось загрузить игры")
      }));
    }
  }, [state.accessToken]);

  const refreshRooms = useCallback(async (): Promise<void> => {
    await refreshRoomsInternal();
  }, [refreshRoomsInternal]);

  useEffect(() => {
    void refreshRooms();
  }, [refreshRooms]);

  useEffect(() => {
    if (!state.accessToken) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void refreshRoomsInternal(true);
    }, 5000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [refreshRoomsInternal, state.accessToken]);

  useEffect(() => {
    if (!state.accessToken) {
      return;
    }

    const handleWindowFocus = (): void => {
      void refreshRoomsInternal(true);
    };

    const handleVisibilityChange = (): void => {
      if (document.visibilityState === "visible") {
        void refreshRoomsInternal(true);
      }
    };

    window.addEventListener("focus", handleWindowFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", handleWindowFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [refreshRoomsInternal, state.accessToken]);

  return (
    <RoomsListContext.Provider
      value={{
        roomsState,
        refreshRooms
      }}
    >
      {children}
    </RoomsListContext.Provider>
  );
}

const RoomsListContext = createContext<RoomsListContextValue | null>(null);

function useRoomsList(): RoomsListContextValue {
  const context = useContext(RoomsListContext);

  if (!context) {
    throw new Error("useRoomsList must be used inside RoomsListProvider");
  }

  return context;
}

function LaunchInviteRedirect(): JSX.Element | null {
  const { state } = useSession();
  const location = useLocation();
  const navigate = useNavigate();
  const virtualInviteCode = getVirtualInviteCodeFromStartParam(state.startParam);
  const clubInviteCode = getClubInviteCodeFromStartParam(state.startParam);

  useEffect(() => {
    if (location.pathname !== getHomeRoute() || state.status !== "authenticated") {
      return;
    }

    if (virtualInviteCode) {
      void navigate(getJoinVirtualTableInviteRoute(virtualInviteCode), { replace: true });
      return;
    }

    if (clubInviteCode) {
      void navigate(`/clubs/join/${clubInviteCode}`, { replace: true });
      return;
    }

    if (state.inviteCode) {
      void navigate(getJoinRoomRoute(state.inviteCode), { replace: true });
    }
  }, [clubInviteCode, location.pathname, navigate, state.inviteCode, state.status, virtualInviteCode]);

  return null;
}

function TelegramBackButtonSync(): JSX.Element | null {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (location.pathname === getHomeRoute()) {
      hideTelegramBackButton();
      return;
    }

    const handleBackClick = (): void => {
      navigateBack(navigate, location.pathname);
    };

    showTelegramBackButton();
    onTelegramBackButtonClick(handleBackClick);

    return () => {
      offTelegramBackButtonClick(handleBackClick);
      hideTelegramBackButton();
    };
  }, [location.pathname, navigate]);

  return null;
}

function AppChrome(): JSX.Element {
  const location = useLocation();
  const isHome = location.pathname === getHomeRoute();
  const isBrandHeader = isHome || isBrandHeaderRoute(location.pathname);
  const title =
    isBrandHeader
        ? "Poker Table"
        : getChromeSubtitle(location.pathname);

  return (
    <header
      className="fixed inset-x-0 top-0 z-40 border-b border-white/10 bg-[#141313]/88 backdrop-blur-xl"
      style={{ paddingTop: appHeaderTopPadding }}
    >
      <div className="flex h-[4.5rem] w-full items-center justify-center px-4 text-center">
        {isBrandHeader ? (
          <div className="flex min-w-0 items-center justify-center gap-3">
            <PokerTableLogo className="h-10 w-10 shrink-0" />
            <p className="truncate font-display text-[1.95rem] font-semibold leading-none text-white">{title}</p>
          </div>
        ) : (
          <p className="truncate text-[1.15rem] font-semibold text-white">{title}</p>
        )}
      </div>
    </header>
  );
}

function BottomNav(): JSX.Element {
  const location = useLocation();
  const { state } = useSession();
  const profileRoute = state.session?.user.id ? getPlayerRoute(state.session.user.id) : getHomeRoute();
  const items = [
    { label: "Главная", icon: "home", href: getHomeRoute(), active: location.pathname === getHomeRoute() },
    {
      label: "Онлайн",
      icon: "playing_cards",
      href: getVirtualLobbyRoute(),
      active: isVirtualPokerRoute(location.pathname)
    },
    { label: "Оффлайн", icon: "style", href: getGamesRoute(), active: isGamesBaseRoute(location.pathname) },
    {
      label: "Клуб",
      icon: "groups",
      href: getClubRoute(),
      active: isClubRoutePath(location.pathname)
    },
    {
      label: "Рейтинг",
      icon: "leaderboard",
      href: getLeaderboardRoute(),
      active:
        location.pathname === getLeaderboardRoute() ||
        (location.pathname.startsWith("/players/") && !isOwnProfilePath(location.pathname, state.session?.user.id ?? null))
    },
    {
      label: "Профиль",
      icon: "person",
      href: profileRoute,
      active: isOwnProfilePath(location.pathname, state.session?.user.id ?? null)
    }
  ];

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#1d1c1c]/88 backdrop-blur-xl"
      style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
    >
      <div
        className="grid w-full gap-1 px-2 pb-1 pt-3"
        style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
      >
        {items.map((item) => (
          <Link
            key={item.label}
            className={cn(
              "flex min-h-12 flex-col items-center justify-center rounded-xl px-1 py-2 text-[10px] font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
              item.active ? "text-accent" : "text-muted hover:bg-white/[0.03] hover:text-foreground"
            )}
            to={item.href}
          >
            <MaterialIcon filled={item.active} icon={item.icon} />
            <span className="mt-1">{item.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}

function HomeScreen(): JSX.Element {
  const { state } = useSession();
  const navigate = useNavigate();
  const { virtualTablesState } = useVirtualTablesList();
  const { clubsState } = useClubsList();
  const { roomsState } = useRoomsList();
  const [profileState, setProfileState] = useState<LoadState<GetPlayerProfileResponseDto>>({
    status: "idle",
    data: null,
    errorMessage: null
  });
  const [clubEventsState, setClubEventsState] = useState<LoadState<HomeClubEvent[]>>({
    status: "idle",
    data: null,
    errorMessage: null
  });
  const [activeTurnDetailState, setActiveTurnDetailState] = useState<{
    tableId: string | null;
    data: GetVirtualTableResponseDto | null;
  }>({
    tableId: null,
    data: null
  });
  const [homeJoinCode, setHomeJoinCode] = useState("");
  const [homeJoinState, setHomeJoinState] = useState({
    isSubmitting: false,
    errorMessage: null as string | null
  });
  const user = state.session?.user ?? null;
  const tables = virtualTablesState.data?.items ?? [];
  const activeRooms = roomsState.data?.active ?? [];
  const recentRooms = roomsState.data?.recent ?? [];
  const clubs = useMemo(() => clubsState.data?.clubs ?? [], [clubsState.data]);
  const primaryActiveTurn = useMemo(() => getPrimaryActiveTurn(tables), [tables]);

  useEffect(() => {
    sendClientBootBeacon("home-mounted");
  }, []);

  useEffect(() => {
    sendClientBootBeacon(`session-${state.status}`);
  }, [state.status]);

  useEffect(() => {
    if (!state.accessToken || !user?.id) {
      setProfileState({
        status: "idle",
        data: null,
        errorMessage: null
      });
      return;
    }

    let isCancelled = false;

    setProfileState({
      status: "loading",
      data: null,
      errorMessage: null
    });

    void getPlayerProfile(state.accessToken, user.id)
      .then((data) => {
        if (isCancelled) {
          return;
        }

        setProfileState({
          status: "ready",
          data,
          errorMessage: null
        });
      })
      .catch((error: unknown) => {
        if (isCancelled) {
          return;
        }

        setProfileState({
          status: "error",
          data: null,
          errorMessage: getErrorMessage(error, "Не получилось обновить Poker Score")
        });
      });

    return () => {
      isCancelled = true;
    };
  }, [state.accessToken, user?.id]);

  useEffect(() => {
    const accessToken = state.accessToken;

    if (!accessToken) {
      setClubEventsState({
        status: "idle",
        data: null,
        errorMessage: null
      });
      return;
    }

    if (clubsState.status === "loading" || clubsState.status === "idle") {
      setClubEventsState((current) => ({
        status: "loading",
        data: current.data,
        errorMessage: null
      }));
      return;
    }

    if (clubs.length === 0) {
      setClubEventsState({
        status: "ready",
        data: [],
        errorMessage: null
      });
      return;
    }

    let isCancelled = false;

    setClubEventsState((current) => ({
      status: "loading",
      data: current.data,
      errorMessage: null
    }));

    void Promise.all(
      clubs.map(async (club) => {
        const data = await getClubEvents(accessToken, club.id, {
          status: "upcoming",
          type: "all"
        });

        return data.events.map((event) => ({
          ...event,
          clubName: club.name
        }));
      })
    )
      .then((eventsByClub) => {
        if (isCancelled) {
          return;
        }

        setClubEventsState({
          status: "ready",
          data: eventsByClub.flat(),
          errorMessage: null
        });
      })
      .catch((error: unknown) => {
        if (isCancelled) {
          return;
        }

        setClubEventsState((current) => ({
          status: "error",
          data: current.data,
          errorMessage: getErrorMessage(error, "Не получилось загрузить события")
        }));
      });

    return () => {
      isCancelled = true;
    };
  }, [clubs, clubsState.status, state.accessToken]);

  useEffect(() => {
    if (!state.accessToken || !primaryActiveTurn) {
      setActiveTurnDetailState({
        tableId: null,
        data: null
      });
      return;
    }

    let isCancelled = false;

    setActiveTurnDetailState((current) =>
      current.tableId === primaryActiveTurn.id
        ? current
        : {
            tableId: primaryActiveTurn.id,
            data: null
          }
    );

    void getVirtualTable(state.accessToken, primaryActiveTurn.id)
      .then((data) => {
        if (isCancelled) {
          return;
        }

        setActiveTurnDetailState({
          tableId: primaryActiveTurn.id,
          data
        });
      })
      .catch(() => {
        if (isCancelled) {
          return;
        }

        setActiveTurnDetailState({
          tableId: primaryActiveTurn.id,
          data: null
        });
      });

    return () => {
      isCancelled = true;
    };
  }, [primaryActiveTurn, state.accessToken]);

  const model = useMemo(
    () =>
      buildHomeViewModel({
        activeRooms,
        recentRooms,
        tables,
        events: clubEventsState.data ?? [],
        offlinePokerScore: profileState.data?.stats.pokerScore,
        offlineGamesCount: profileState.data?.stats.gamesCount,
        onlinePokerScore: profileState.data?.onlineStats.onlinePokerScore,
        onlineHandsPlayed: profileState.data?.onlineStats.handsPlayed,
        activeTurnDetail:
          activeTurnDetailState.tableId === primaryActiveTurn?.id ? activeTurnDetailState.data : null
      }),
    [
      activeRooms,
      activeTurnDetailState,
      clubEventsState.data,
      primaryActiveTurn?.id,
      profileState.data?.onlineStats.handsPlayed,
      profileState.data?.onlineStats.onlinePokerScore,
      profileState.data?.stats.gamesCount,
      profileState.data?.stats.pokerScore,
      recentRooms,
      tables
    ]
  );
  const errorMessage =
    roomsState.status === "error"
      ? roomsState.errorMessage
      : virtualTablesState.status === "error"
      ? virtualTablesState.errorMessage
      : profileState.status === "error"
        ? profileState.errorMessage
        : clubEventsState.status === "error"
          ? clubEventsState.errorMessage
          : null;

  const handleHomeJoinSubmit = useCallback(async (): Promise<void> => {
    const inviteCode = normalizeInviteCode(homeJoinCode);

    if (inviteCode.length === 0 || !state.accessToken) {
      setHomeJoinState({
        isSubmitting: false,
        errorMessage: inviteCode.length === 0 ? "Введите код приглашения" : "Откройте приложение через Telegram"
      });
      return;
    }

    setHomeJoinState({
      isSubmitting: true,
      errorMessage: null
    });

    try {
      const result = await resolveInviteCode(state.accessToken, { inviteCode });

      if (result.kind === "ROOM") {
        void navigate(getJoinRoomRoute(result.inviteCode));
      } else if (result.kind === "VIRTUAL_TABLE") {
        void navigate(getJoinVirtualTableInviteRoute(result.inviteCode));
      } else {
        void navigate(getClubJoinRoute(result.inviteCode));
      }
    } catch (error) {
      setHomeJoinState({
        isSubmitting: false,
        errorMessage:
          error instanceof ApiRequestError && error.status === 409
            ? "Код совпал с несколькими приглашениями. Попросите новый код."
            : getErrorMessage(error, "Код не найден")
      });
    }
  }, [homeJoinCode, navigate, state.accessToken]);

  return (
    <>
      {getSessionBanner(state.status, state.errorMessage)}
      <HomeScreenContent
        errorMessage={errorMessage}
        inviteCode={homeJoinCode}
        inviteErrorMessage={homeJoinState.errorMessage}
        isInviteSubmitting={homeJoinState.isSubmitting}
        model={model}
        onInviteCodeChange={setHomeJoinCode}
        onInviteSubmit={() => void handleHomeJoinSubmit()}
        onOpenTarget={(target) => void navigate(getHomeTargetRoute(target))}
        profileRoute={state.session?.user.id ? getPlayerRoute(state.session.user.id) : null}
      />
    </>
  );
}

export function HomeScreenContent({
  model,
  errorMessage,
  inviteCode,
  inviteErrorMessage,
  isInviteSubmitting,
  onInviteCodeChange,
  onInviteSubmit,
  onOpenTarget,
  profileRoute
}: {
  model: ReturnType<typeof buildHomeViewModel>;
  errorMessage: string | null;
  inviteCode: string;
  inviteErrorMessage: string | null;
  isInviteSubmitting: boolean;
  onInviteCodeChange: (value: string) => void;
  onInviteSubmit: () => void;
  onOpenTarget: (target: HomeTarget) => void;
  profileRoute: string | null;
}): JSX.Element {
  return (
    <div className="space-y-5">
      <HomePokerScoreSection
        profileRoute={profileRoute}
        progress={model.pokerScore.progress}
        score={model.pokerScore.value}
      />
      <HomeJoinCodeSection
        errorMessage={inviteErrorMessage}
        inviteCode={inviteCode}
        isSubmitting={isInviteSubmitting}
        onChange={onInviteCodeChange}
        onSubmit={onInviteSubmit}
      />
      <HomeMiniCalendar calendarStartAt={model.calendarStartAt} events={model.upcomingEvents} onOpenTarget={onOpenTarget} />
      <HomeActiveNowSection cards={model.activeTables} errorMessage={errorMessage} onOpenTarget={onOpenTarget} />
      <HomeEventsSection events={model.upcomingEvents} />
    </div>
  );
}

export function HomePokerScoreSection({
  score,
  progress,
  profileRoute
}: {
  score: number | null;
  progress: number;
  profileRoute: string | null;
}): JSX.Element {
  const content = (
    <section className="glass-card rounded-2xl bg-white/[0.025] p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#93a099]">Poker Score</p>
          <p className="mt-1 text-sm text-muted">Офлайн и онлайн</p>
        </div>
        <div className="text-right">
          <p className="font-display text-[2rem] font-semibold leading-none text-accent">{score == null ? "—" : score}</p>
          <p className="mt-1 text-xs font-semibold text-muted">{score == null ? "Пока без оценки" : `${progress}%`}</p>
        </div>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/12">
        <div
          className="h-full rounded-full bg-accent shadow-[0_0_18px_rgba(78,222,163,0.55)] transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>
    </section>
  );

  const scoreCard = !profileRoute ? (
    content
  ) : (
    <Link className="block" to={profileRoute}>
      {content}
    </Link>
  );

  return scoreCard;
}

function HomeJoinCodeSection({
  inviteCode,
  errorMessage,
  isSubmitting,
  onChange,
  onSubmit
}: {
  inviteCode: string;
  errorMessage: string | null;
  isSubmitting: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
}): JSX.Element {
  const normalizedInviteCode = normalizeInviteCode(inviteCode);

  return (
    <section className="relative overflow-hidden rounded-2xl bg-[linear-gradient(135deg,rgba(78,222,163,0.16),rgba(20,25,22,0.98)_48%,rgba(12,14,13,0.98))] p-3 shadow-[0_16px_34px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.035)]">
      <div className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-[#4edea3]/12 blur-2xl" />
      <div className="mb-3 flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0f2419] text-[#4edea3] shadow-[inset_0_0_0_1px_rgba(78,222,163,0.28)]">
          <MaterialIcon icon="mail" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white">Введите код приглашения</p>
          <p className="mt-0.5 text-xs font-medium text-[#a8b0ab]">Откроем комнату, онлайн-стол или клуб</p>
        </div>
      </div>
      <div className="relative flex items-center gap-2">
        <input
          aria-label="Код приглашения"
          className="min-h-11 min-w-0 flex-1 rounded-xl border border-[#4edea3]/14 bg-[#101512]/90 px-3 text-center text-sm font-semibold uppercase tracking-[0.16em] text-white outline-none transition placeholder:text-[#89918c] focus:border-[#56df9d] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#56df9d]"
          maxLength={16}
          placeholder="AB12CD34"
          value={inviteCode}
          onChange={(event) => onChange(normalizeInviteCode(event.target.value))}
        />
        <Button
          className="min-h-11 shrink-0 rounded-xl bg-[#4edea3] px-4 text-[#04130d] shadow-none hover:bg-[#67edb3]"
          disabled={isSubmitting || normalizedInviteCode.length === 0}
          onClick={onSubmit}
        >
          {isSubmitting ? "Ищем" : "Войти"}
        </Button>
      </div>
      {errorMessage ? <p className="mt-2 px-1 text-sm font-medium text-[#ffb4a8]">{errorMessage}</p> : null}
    </section>
  );
}

function HomeMiniCalendar({
  calendarStartAt,
  events,
  onOpenTarget
}: {
  calendarStartAt: string;
  events: HomeClubEvent[];
  onOpenTarget: (target: HomeTarget) => void;
}): JSX.Element {
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);
  const parsedStart = new Date(calendarStartAt);
  const today = startOfDay(Number.isFinite(parsedStart.getTime()) ? parsedStart : new Date());
  const days = Array.from({ length: 14 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() + index);
    return date;
  });
  const eventsByDay = new Map<string, HomeClubEvent[]>();

  events.forEach((event) => {
    const date = new Date(event.scheduledStartAt);
    if (!Number.isFinite(date.getTime())) {
      return;
    }
    const key = getCalendarDayKey(date);
    eventsByDay.set(key, [...(eventsByDay.get(key) ?? []), event]);
  });
  const selectedEvents = selectedDayKey ? eventsByDay.get(selectedDayKey) ?? [] : [];

  return (
    <section className="rounded-2xl bg-white/[0.025] px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.025)]">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#93a099]">Календарь</p>
        <p className="text-xs font-medium text-muted">Ближайшие события</p>
      </div>
      <div className="mt-3 grid grid-cols-7 gap-1.5">
        {days.map((day, index) => {
          const key = getCalendarDayKey(day);
          const dayEvents = eventsByDay.get(key) ?? [];
          const isToday = index === 0;
          const isSelected = selectedDayKey === key;

          return (
            <button
              key={key}
              className={cn(
                "flex min-h-[3.65rem] flex-col items-center justify-center rounded-xl text-center transition",
                isToday ? "bg-accent/14 text-white" : "bg-white/[0.035] text-white/78",
                isSelected && "bg-accent/20 shadow-[inset_0_0_0_1px_rgba(78,222,163,0.24)]",
                "hover:bg-accent/12 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              )}
              type="button"
              onClick={() => setSelectedDayKey((current) => (current === key ? null : key))}
            >
              <span className="text-[0.62rem] font-semibold uppercase text-muted">
                {day.toLocaleDateString("ru-RU", { weekday: "short" }).replace(".", "")}
              </span>
              <span className="mt-1 text-sm font-semibold">{day.toLocaleDateString("ru-RU", { day: "2-digit" })}</span>
              <span className="mt-1 flex h-2 items-center justify-center gap-0.5">
                {dayEvents.slice(0, 3).map((event) => (
                  <span key={event.id} className="h-1.5 w-1.5 rounded-full bg-accent" />
                ))}
              </span>
            </button>
          );
        })}
      </div>
      {selectedDayKey ? (
        <div className="mt-3 space-y-2 rounded-xl bg-black/20 p-2">
          {selectedEvents.length === 0 ? (
            <p className="px-2 py-2 text-sm text-[#a8b0ab]">На этот день игр нет</p>
          ) : (
            selectedEvents.map((event) => (
              <button
                key={event.id}
                className="flex w-full items-center justify-between gap-3 rounded-lg bg-white/[0.035] px-3 py-2 text-left transition hover:bg-white/[0.06]"
                type="button"
                onClick={() => onOpenTarget({ kind: "event", clubId: event.clubId, eventId: event.id })}
              >
                <span className="min-w-0 truncate text-sm font-semibold text-white">{event.title}</span>
                <span className="shrink-0 text-xs text-[#a8b0ab]">
                  {new Date(event.scheduledStartAt).toLocaleTimeString("ru-RU", {
                    hour: "2-digit",
                    minute: "2-digit"
                  })}
                </span>
              </button>
            ))
          )}
        </div>
      ) : null}
    </section>
  );
}

function startOfDay(value: Date): Date {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function getCalendarDayKey(value: Date): string {
  const date = startOfDay(value);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

export function HomeActiveNowSection({
  cards,
  errorMessage,
  onOpenTarget
}: {
  cards: HomeActiveTableCard[];
  errorMessage: string | null;
  onOpenTarget: (target: HomeTarget) => void;
}): JSX.Element {
  return (
    <section className="space-y-3">
      <HomeSectionTitle title="Активные сейчас" />
      {errorMessage ? (
        <div className="rounded-2xl border border-amber-200/20 bg-amber-200/8 px-4 py-3 text-sm font-medium text-amber-100">
          {errorMessage}
        </div>
      ) : null}
      {cards.length === 0 ? (
        <CompactEmptyState
          description="Как только игра начнётся, она появится здесь."
          imageAlt="Нет активных игр"
          imageSrc={resolveMiniAppVisual("empty-state")}
          title="Активных столов нет"
          tone="graphite"
        />
      ) : (
        <div className="space-y-2.5">
          {cards.slice(0, 4).map((card) => (
            <CompactGameRow
              key={card.id}
              className={cn(card.isUserTurn && "rounded-[22px] bg-[#56df9d]/[0.035] ring-1 ring-inset ring-[#56df9d]/70")}
              detail={card.meta}
              imageAlt={card.typeLabel === "Онлайн" ? "Онлайн стол" : "Оффлайн стол"}
              imageSrc={resolveMiniAppVisual(card.typeLabel === "Онлайн" ? "online" : "offline")}
              onClick={() => onOpenTarget(card.target)}
              statusLabel={`${card.typeLabel} · ${card.statusLabel}`}
              statusTone={card.isUserTurn ? "success" : "neutral"}
              title={card.title}
              trailing={
                <span
                  className={cn(
                    "inline-flex items-center rounded-full px-3 py-1.5 text-sm font-semibold",
                    card.isUserTurn ? "bg-[#56df9d]/12 text-[#9af2c2]" : "text-accent"
                  )}
                >
                  Открыть
                </span>
              }
              type="button"
            />
          ))}
        </div>
      )}
    </section>
  );
}

function HomeEventsSection({ events }: { events: HomeClubEvent[] }): JSX.Element {
  return (
    <section className="space-y-4">
      <HomeSectionTitle title="Ближайшие события" />
      {events.length === 0 ? (
        <CompactEmptyState
          description="Когда появятся новые встречи, покажем их здесь."
          imageAlt="Нет событий"
          imageSrc={resolveMiniAppVisual("club")}
          title="Событий пока нет"
          tone="amber"
        />
      ) : (
        <div className="space-y-3">
          {events.slice(0, 4).map((event) => (
            <Link key={`${event.clubId}-${event.id}`} to={getClubEventRoute(event.clubId, event.id)}>
              <article className="glass-card rounded-2xl bg-white/[0.025] p-3 transition hover:bg-white/[0.04]">
                <div className="flex items-center gap-3">
                  <HomeEventDateBadge value={event.scheduledStartAt} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-amber-100">
                      {getHomeEventTypeLabel(event.type)} · {formatHomeEventTime(event.scheduledStartAt)}
                    </p>
                    <h3 className="mt-1 truncate text-base font-semibold text-white">{event.title}</h3>
                    <p className="mt-1 truncate text-sm text-muted">{event.clubName}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-white/[0.05] px-3 py-1.5 text-xs font-semibold text-white/70">
                    {getHomeRsvpLabel(event.myRsvpStatus ?? null)}
                  </span>
                </div>
              </article>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

function HomeEventDateBadge({ value }: { value: string }): JSX.Element {
  const date = new Date(value);
  const weekday = Number.isFinite(date.getTime())
    ? date.toLocaleDateString("ru-RU", { weekday: "short" }).replace(".", "")
    : "";
  const day = Number.isFinite(date.getTime()) ? date.toLocaleDateString("ru-RU", { day: "2-digit" }) : "—";

  return (
    <div className="flex h-[4.25rem] w-[4.25rem] shrink-0 flex-col items-center justify-center rounded-xl bg-white/14 text-center">
      <p className="text-[0.68rem] font-semibold uppercase text-white/70">{weekday}</p>
      <p className="mt-1 text-[1.45rem] font-semibold leading-none text-white">{day}</p>
    </div>
  );
}

function HomeSectionTitle({ title }: { title: string }): JSX.Element {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-[1.55rem] font-semibold leading-tight text-white">{title}</h2>
      {title === "Активные сейчас" ? <span className="h-2.5 w-2.5 rounded-full bg-accent" /> : null}
    </div>
  );
}

function CompactVisualAccent({
  imageSrc,
  imageAlt,
  tone = "graphite",
  className
}: {
  imageSrc?: string | undefined;
  imageAlt?: string | undefined;
  tone?: "emerald" | "amber" | "graphite";
  className?: string;
}): JSX.Element {
  return (
    <span
      className={cn(
        "relative flex h-14 w-14 shrink-0 overflow-hidden rounded-2xl bg-white/[0.06]",
        tone === "emerald" && "shadow-[inset_0_0_0_1px_rgba(78,222,163,0.22)]",
        tone === "amber" && "shadow-[inset_0_0_0_1px_rgba(255,190,82,0.22)]",
        tone === "graphite" && "shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]",
        className
      )}
    >
      {imageSrc ? <img alt={imageAlt ?? ""} className="h-full w-full object-cover opacity-85" src={imageSrc} /> : null}
      <span className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.16),transparent_52%,rgba(0,0,0,0.22))]" />
    </span>
  );
}

function CompactEmptyState({
  title,
  description,
  imageSrc,
  imageAlt,
  tone = "graphite"
}: {
  title: string;
  description: string;
  imageSrc?: string | undefined;
  imageAlt?: string | undefined;
  tone?: "emerald" | "amber" | "graphite";
}): JSX.Element {
  return (
    <section className="glass-card rounded-2xl bg-white/[0.025] p-3">
      <div className="flex items-center gap-3">
        <CompactVisualAccent imageAlt={imageAlt} imageSrc={imageSrc} tone={tone} />
        <div className="min-w-0">
          <p className="font-semibold text-white">{title}</p>
          <p className="mt-1 text-sm leading-5 text-muted">{description}</p>
        </div>
      </div>
    </section>
  );
}

function CompactPanel({
  title,
  description,
  action,
  children,
  className
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}): JSX.Element {
  return (
    <section className={cn("glass-card rounded-2xl bg-white/[0.025] p-4", className)}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          {description ? <p className="mt-1 text-sm leading-5 text-muted">{description}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function CompactFormShell({
  title,
  eyebrow,
  imageSrc,
  imageAlt,
  footer,
  headerAside,
  children,
  tone = "graphite"
}: {
  title: string;
  eyebrow?: string;
  imageSrc?: string | undefined;
  imageAlt?: string | undefined;
  footer?: ReactNode;
  headerAside?: ReactNode;
  children: ReactNode;
  tone?: "emerald" | "amber" | "graphite";
}): JSX.Element {
  return (
    <section className="space-y-4">
      <header className="glass-card rounded-2xl bg-card p-4">
        <div className="flex items-center gap-3">
          {headerAside ?? <CompactVisualAccent imageAlt={imageAlt} imageSrc={imageSrc} tone={tone} />}
          <div className="min-w-0">
            {eyebrow ? <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#93a099]">{eyebrow}</p> : null}
            <h1 className="mt-1 text-[1.45rem] font-semibold leading-tight text-white">{title}</h1>
          </div>
        </div>
      </header>
      {children}
      {footer ? <div>{footer}</div> : null}
    </section>
  );
}

function GamesScreen(): JSX.Element {
  const { state } = useSession();
  const navigate = useNavigate();
  const { roomsState, refreshRooms } = useRoomsList();
  const offlineEventsState = useUpcomingClubEvents("OFFLINE_POKER");
  const activeRooms = roomsState.data?.active ?? [];
  const recentRooms = roomsState.data?.recent ?? [];
  const nearestOfflineEvent = offlineEventsState.events[0] ?? null;

  return (
    <ScreenLayout>
      <GamesScreenContent
        activeRooms={activeRooms}
        inviteCode={state.inviteCode}
        nearestEvent={nearestOfflineEvent}
        onCreateRoom={() => void navigate(getCreateRoomRoute())}
        onJoinCodeSubmit={(inviteCode) => void navigate(getJoinRoomRoute(inviteCode))}
        onOpenInvite={state.inviteCode ? () => void navigate(getJoinRoomRoute(state.inviteCode!)) : null}
        onOpenNearestEvent={(clubId, eventId) => void navigate(getClubEventRoute(clubId, eventId))}
        onOpenRecentRoom={(roomId) => void navigate(getRoomRoute(roomId))}
        onOpenRoom={(roomId) => void navigate(getRoomRoute(roomId))}
        onRefresh={() => void refreshRooms()}
        recentRooms={recentRooms}
        roomsState={roomsState}
      />
    </ScreenLayout>
  );
}

export function GamesScreenContent({
  activeRooms,
  recentRooms,
  roomsState,
  inviteCode,
  nearestEvent,
  onCreateRoom,
  onJoinCodeSubmit,
  onOpenInvite,
  onOpenNearestEvent,
  onOpenRoom,
  onOpenRecentRoom,
  onRefresh
}: {
  activeRooms: RoomsListResponseDto["active"];
  recentRooms: RoomsListResponseDto["recent"];
  roomsState: LoadState<RoomsListResponseDto>;
  inviteCode: string | null;
  nearestEvent?: ClubHomeEventItem | null;
  onCreateRoom: () => void;
  onJoinCodeSubmit: (inviteCode: string) => void;
  onOpenInvite: (() => void) | null;
  onOpenNearestEvent?: (clubId: string, eventId: string) => void;
  onOpenRoom: (roomId: string) => void;
  onOpenRecentRoom: (roomId: string) => void;
  onRefresh: () => void;
}): JSX.Element {
  return (
    <>
      <OfflineActionHero
        hasInvite={Boolean(inviteCode)}
        onCreateRoom={onCreateRoom}
        onJoinCodeSubmit={onJoinCodeSubmit}
        onOpenInvite={onOpenInvite}
      />

      {roomsState.status === "loading" ? (
        <InfoCard title="Загружаем игры" description="Собираем ваши активные и последние столы." />
      ) : null}

      {roomsState.status === "error" ? (
        <div className="space-y-3">
          <InfoCard title="Пока не получилось" description={roomsState.errorMessage} />
          <Button className={cn("w-full", secondaryButtonClassName)} onClick={onRefresh}>
            Попробовать снова
          </Button>
        </div>
      ) : null}

      {nearestEvent && onOpenNearestEvent ? (
        <section className="space-y-3">
          <ClubEventPreviewCard
            item={nearestEvent}
            title="Ближайшая игра"
            onClick={() => onOpenNearestEvent(nearestEvent.club.id, nearestEvent.event.id)}
          />
        </section>
      ) : null}

      <section className="space-y-3">
        <div>
          <h2 className="text-[1.15rem] font-semibold leading-tight text-white">Активные игры</h2>
        </div>
        {roomsState.status !== "loading" && activeRooms.length === 0 ? (
          <CompactEmptyState
            description="Создайте новый стол или откройте приглашение."
            imageAlt="Нет активных офлайн игр"
            imageSrc={resolveMiniAppVisual("offline")}
            title="Пока нет активных игр"
            tone="graphite"
          />
        ) : null}
        {activeRooms.map((room) => (
          <CompactGameRow
            key={room.id}
            detail={formatCurrencyFromChips(room.buyInChips, room.currency, room.chipsPerCurrencyUnit)}
            imageAlt="Активный офлайн стол"
            imageSrc={resolveMiniAppVisual("offline")}
            onClick={() => onOpenRoom(room.id)}
            statusLabel={getRoomStatusText(room.status)}
            statusTone="success"
            subtitle={`${room.playersCount} ${getPlayersLabel(room.playersCount)}`}
            title={room.title}
            value={formatChipsCount(room.buyInChips)}
          />
        ))}
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-[1.15rem] font-semibold leading-tight text-white">Последние игры</h2>
        </div>
        {roomsState.status !== "loading" && recentRooms.length === 0 ? (
          <CompactEmptyState
            description="Завершённые игры появятся здесь автоматически."
            imageAlt="История игр"
            imageSrc={resolveMiniAppVisual("settlement-history")}
            title="История пока пустая"
            tone="graphite"
          />
        ) : null}
        {recentRooms.map((room) => (
          <CompactGameRow
            key={room.id}
            detail={room.closedAt ? formatDate(room.closedAt) : "Игра завершена"}
            imageAlt="Завершённая офлайн игра"
            imageSrc={resolveMiniAppVisual("settlement-history")}
            onClick={() => onOpenRecentRoom(room.id)}
            statusLabel="Завершена"
            title={room.title}
            trailing={
              <div className="text-right">
                <p className={cn("text-base font-semibold", getResultColorClass(room.myNetResultChips ?? "0"))}>
                  {formatSignedCurrencyFromChips(
                    room.myNetResultChips ?? "0",
                    room.currency,
                    room.chipsPerCurrencyUnit
                  )}
                </p>
                <p className="mt-0.5 text-xs text-[#8f9792]">
                  {formatSignedChipsCount(room.myNetResultChips ?? "0")}
                </p>
              </div>
            }
          />
        ))}
      </section>
    </>
  );
}

export function OfflineActionHero({
  hasInvite,
  onCreateRoom,
  onJoinCodeSubmit,
  onOpenInvite
}: {
  hasInvite: boolean;
  onCreateRoom: () => void;
  onJoinCodeSubmit: (inviteCode: string) => void;
  onOpenInvite: (() => void) | null;
}): JSX.Element {
  const [isJoinOpen, setIsJoinOpen] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const normalizedJoinCode = normalizeInviteCode(joinCode);

  return (
    <div className="space-y-3" data-testid="offline-action-hero">
      <section className="relative min-h-[158px] overflow-hidden rounded-[22px] bg-[#060706] shadow-[0_18px_42px_rgba(0,0,0,0.42),inset_0_1px_0_rgba(255,255,255,0.04)]">
        <picture>
          <source srcSet={resolveMiniAppVisual("offline-hero-webp")} type="image/webp" />
          <img
            alt="Оффлайн-покер"
            className="absolute inset-0 h-full w-full object-cover"
            decoding="async"
            fetchPriority="high"
            loading="eager"
            src={resolveMiniAppVisual("offline-hero")}
          />
        </picture>
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(2,4,3,0.9)_0%,rgba(2,4,3,0.46)_58%,rgba(2,4,3,0.08)_100%),linear-gradient(180deg,rgba(0,0,0,0.04),rgba(0,0,0,0.44))]" />
        <div className="absolute left-5 right-[34%] top-1/2 -translate-y-1/2 text-left">
          <p className="whitespace-nowrap font-display text-[clamp(1.45rem,6vw,2rem)] font-semibold leading-none text-white drop-shadow-[0_8px_22px_rgba(0,0,0,0.62)]">
            Оффлайн-игры
          </p>
          <p className="mt-2 text-sm font-medium leading-none text-white/78">Реальные игры, ребаи и итоги</p>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3">
        <button
          className="min-h-[72px] rounded-2xl bg-[#151716] px-2 py-3 text-left text-white shadow-[inset_0_0_0_1px_rgba(78,222,163,0.12),0_12px_28px_rgba(0,0,0,0.25)] transition hover:bg-[#19201c] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4edea3]"
          onClick={onCreateRoom}
          type="button"
        >
          <span className="flex items-center gap-1.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#4edea3] shadow-[inset_0_0_0_2px_rgba(78,222,163,0.72)]">
              <MaterialIcon icon="add_circle" />
            </span>
            <span className="min-w-0">
              <span className="block whitespace-nowrap text-[13px] font-semibold leading-tight">Создать игру</span>
              <span className="mt-1 block whitespace-nowrap text-[10px] font-medium text-[#a8b0ab]">Новая оффлайн игра</span>
            </span>
          </span>
        </button>

        <button
          className="min-h-[72px] rounded-2xl bg-[#151716] px-2 py-3 text-left text-white shadow-[inset_0_0_0_1px_rgba(78,222,163,0.12),0_12px_28px_rgba(0,0,0,0.25)] transition hover:bg-[#19201c] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4edea3]"
          onClick={() => setIsJoinOpen((current) => !current)}
          type="button"
        >
          <span className="flex items-center gap-1.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#4edea3] shadow-[inset_0_0_0_2px_rgba(78,222,163,0.72)]">
              <MaterialIcon icon="tag" />
            </span>
            <span className="min-w-0">
              <span className="block whitespace-nowrap text-[13px] font-semibold leading-tight">Войти по коду</span>
              <span className="mt-1 block whitespace-nowrap text-[10px] font-medium text-[#a8b0ab]">Присоединиться</span>
            </span>
          </span>
        </button>
      </div>

      {isJoinOpen ? (
        <section className="rounded-2xl bg-[#151716] p-3 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.055)]">
          <div className="flex gap-2">
            <input
              aria-label="Код приглашения"
              className="min-h-11 flex-1 rounded-xl border border-white/[0.06] bg-[#171918] px-4 text-center text-sm font-semibold uppercase tracking-[0.2em] text-white outline-none transition placeholder:text-[#89918c] focus:border-[#56df9d] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#56df9d]"
              maxLength={16}
              placeholder="AB12CD"
              value={joinCode}
              onChange={(event) => setJoinCode(normalizeInviteCode(event.target.value))}
            />
            <Button
              className="min-h-11 shrink-0 rounded-xl bg-[#4edea3] px-4 text-[#04130d] shadow-none hover:bg-[#67edb3]"
              disabled={normalizedJoinCode.length === 0}
              onClick={() => onJoinCodeSubmit(normalizedJoinCode)}
            >
              Войти
            </Button>
          </div>
        </section>
      ) : null}

      {hasInvite && onOpenInvite ? (
        <Button className={cn("min-h-11 w-full justify-between rounded-2xl bg-[#151716]", tertiaryButtonClassName)} onClick={onOpenInvite}>
          <span>Открыть приглашение</span>
          <MaterialIcon icon="login" />
        </Button>
      ) : null}
    </div>
  );
}

function LeaderboardScreen(): JSX.Element {
  const { state } = useSession();
  const [mode, setMode] = useState<LeaderboardMode>("offline");
  const [scope, setScope] = useState(DEFAULT_LEADERBOARD_QUERY.scope);
  const [period, setPeriod] = useState(DEFAULT_LEADERBOARD_QUERY.period);
  const [isPokerScoreInfoOpen, setIsPokerScoreInfoOpen] = useState(false);
  const [leaderboardState, setLeaderboardState] = useState<LoadState<GetLeaderboardResponseDto>>({
    status: "idle",
    data: null,
    errorMessage: null
  });
  const [virtualLeaderboardState, setVirtualLeaderboardState] = useState<LoadState<GetVirtualLeaderboardResponseDto>>({
    status: "idle",
    data: null,
    errorMessage: null
  });

  useEffect(() => {
    if (mode !== "offline") {
      return;
    }

    if (!state.accessToken) {
      setLeaderboardState({
        status: "idle",
        data: null,
        errorMessage: null
      });
      return;
    }

    let isCancelled = false;
    setLeaderboardState({
      status: "loading",
      data: null,
      errorMessage: null
    });

    void getLeaderboard(state.accessToken, {
      ...DEFAULT_LEADERBOARD_QUERY,
      scope,
      period
    })
      .then((data) => {
        if (isCancelled) {
          return;
        }

        setLeaderboardState({
          status: "ready",
          data,
          errorMessage: null
        });
      })
      .catch((error: unknown) => {
        if (isCancelled) {
          return;
        }

        setLeaderboardState({
          status: "error",
          data: null,
          errorMessage: getErrorMessage(error, "Не получилось загрузить рейтинг")
        });
      });

    return () => {
      isCancelled = true;
    };
  }, [mode, period, scope, state.accessToken]);

  useEffect(() => {
    if (mode !== "online") {
      return;
    }

    if (!state.accessToken) {
      setVirtualLeaderboardState({
        status: "idle",
        data: null,
        errorMessage: null
      });
      return;
    }

    let isCancelled = false;
    setVirtualLeaderboardState({
      status: "loading",
      data: null,
      errorMessage: null
    });

    void getVirtualLeaderboard(state.accessToken, {
      ...DEFAULT_LEADERBOARD_QUERY,
      scope,
      period
    })
      .then((data) => {
        if (isCancelled) {
          return;
        }

        setVirtualLeaderboardState({
          status: "ready",
          data,
          errorMessage: null
        });
      })
      .catch((error: unknown) => {
        if (isCancelled) {
          return;
        }

        setVirtualLeaderboardState({
          status: "error",
          data: null,
          errorMessage: getErrorMessage(error, "Не получилось загрузить онлайн-рейтинг")
        });
      });

    return () => {
      isCancelled = true;
    };
  }, [mode, period, scope, state.accessToken]);

  const activeLeaderboardState = mode === "online" ? virtualLeaderboardState : leaderboardState;
  const offlineItems = leaderboardState.data?.items ?? [];
  const onlineItems = virtualLeaderboardState.data?.items ?? [];
  const items = mode === "online" ? onlineItems : offlineItems;
  const emptyCopy = getLeaderboardEmptyCopy(scope);

  if (!state.accessToken) {
    return (
      <ScreenLayout
        banner={getSessionBanner(state.status, state.errorMessage)}
      >
        <CompactEmptyState
          title="Нужен вход"
          description="Откройте приложение через Telegram, чтобы увидеть рейтинг."
          imageSrc={resolveMiniAppVisual("leaderboard")}
          tone="graphite"
        />
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout>
      <LeaderboardHeaderSection
        mode={mode}
        onInfoClick={() => setIsPokerScoreInfoOpen(true)}
        onModeChange={setMode}
        scope={scope}
      />

      <LeaderboardFiltersSection
        onPeriodChange={setPeriod}
        onScopeChange={setScope}
        period={period}
        scope={scope}
      />

      {activeLeaderboardState.status === "loading" ? (
        <InfoCard
          title={mode === "online" ? "Собираем онлайн-рейтинг" : "Собираем рейтинг"}
          description={
            mode === "online"
              ? "Обновляем места, профит и очки по онлайн-игре."
              : "Считаем Poker Score и обновляем показатели по выбранному периоду."
          }
        />
      ) : null}

      {activeLeaderboardState.status === "error" ? (
        <InfoCard title="Пока не получилось" description={activeLeaderboardState.errorMessage} />
      ) : null}

      {activeLeaderboardState.status === "ready" && items.length === 0 ? (
        <CompactEmptyState
          description={
            mode === "online"
              ? scope === "played-with-me"
                ? "Статистика появится, когда у вас будут завершённые онлайн-игры друг с другом."
                : "Как только накопятся завершённые онлайн-игры, здесь появится общий рейтинг."
              : emptyCopy.description
          }
          imageAlt="Пустой рейтинг"
          imageSrc={resolveMiniAppVisual("leaderboard")}
          title={mode === "online" ? "Онлайн-рейтинг пока пустой" : emptyCopy.title}
          tone={mode === "online" ? "graphite" : "amber"}
        />
      ) : null}

      {items.length > 0 ? (
        <LeaderboardEntriesSection
          currentUserId={state.session?.user.id ?? null}
          mode={mode}
          offlineItems={offlineItems}
          onlineItems={onlineItems}
        />
      ) : null}
      <PokerScoreInfoModal open={isPokerScoreInfoOpen} onOpenChange={setIsPokerScoreInfoOpen} />
    </ScreenLayout>
  );
}

export function LeaderboardHeaderSection({
  mode,
  onInfoClick,
  scope,
  onModeChange
}: {
  mode: LeaderboardMode;
  onInfoClick: () => void;
  scope: (typeof DEFAULT_LEADERBOARD_QUERY)["scope"];
  onModeChange: (mode: LeaderboardMode) => void;
}): JSX.Element {
  return (
    <section className="glass-card rounded-2xl bg-card p-4" data-testid="leaderboard-header">
      <div className="flex items-start gap-3">
        <CompactVisualAccent imageAlt="Рейтинг игроков" imageSrc={resolveMiniAppVisual("leaderboard")} tone="amber" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="min-w-0 text-[1.45rem] font-semibold leading-tight text-white">
              {mode === "online" ? "Онлайн-рейтинг" : "Оффлайн-рейтинг"}
            </h1>
            <InfoIconButton label="Что такое Poker Score" onClick={onInfoClick} />
          </div>
          <p className="mt-1 text-sm text-muted">
            {scope === "all" ? "Все игроки" : "Играли со мной"} · {mode === "online" ? "онлайн" : "офлайн"}
          </p>
        </div>
      </div>
      <div className={cn("mt-3", modeToggleClassName)}>
        <SegmentedControl
          options={[
            { value: "offline", label: "Офлайн" },
            { value: "online", label: "Онлайн" }
          ]}
          value={mode}
          onChange={(nextMode) => onModeChange(nextMode as LeaderboardMode)}
        />
      </div>
    </section>
  );
}

export function LeaderboardFiltersSection({
  scope,
  period,
  onScopeChange,
  onPeriodChange
}: {
  scope: (typeof DEFAULT_LEADERBOARD_QUERY)["scope"];
  period: (typeof DEFAULT_LEADERBOARD_QUERY)["period"];
  onScopeChange: (scope: (typeof DEFAULT_LEADERBOARD_QUERY)["scope"]) => void;
  onPeriodChange: (period: (typeof DEFAULT_LEADERBOARD_QUERY)["period"]) => void;
}): JSX.Element {
  return (
    <section className="glass-card rounded-2xl bg-white/[0.025] p-3">
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_12rem]">
        <div className="grid grid-cols-2 gap-2">
          {LEADERBOARD_SCOPE_OPTIONS.map((option) => (
            <button
              key={option.value}
              className={getFilterButtonClass(scope === option.value, "px-3 py-2.5", true)}
              onClick={() => onScopeChange(option.value)}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
        <label className="block">
          <select
            aria-label="Интервал рейтинга"
            className="min-h-10 w-full rounded-xl border border-white/10 bg-surfaceHigh px-3 text-sm text-foreground outline-none transition focus:border-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            onChange={(event) => onPeriodChange(event.target.value as (typeof DEFAULT_LEADERBOARD_QUERY)["period"])}
            value={period}
          >
            {LEADERBOARD_PERIOD_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </section>
  );
}

export function LeaderboardEntriesSection({
  mode,
  offlineItems,
  onlineItems,
  currentUserId
}: {
  mode: LeaderboardMode;
  offlineItems: GetLeaderboardResponseDto["items"];
  onlineItems: GetVirtualLeaderboardResponseDto["items"];
  currentUserId: string | null;
}): JSX.Element {
  const leaderboardColumns = "grid-cols-[2.75rem_minmax(7.5rem,1fr)_minmax(5rem,0.72fr)_3rem]";

  return (
    <section className="space-y-3">
      <div className={cn("grid gap-3 px-2 text-[11px] uppercase tracking-[0.18em] text-muted", leaderboardColumns)}>
        <span>Место</span>
        <span>Игрок</span>
        <span className="text-right">Профит</span>
        <span className="text-right">Score</span>
      </div>
      {mode === "online"
        ? onlineItems.map((player) => (
            <Link key={player.userId} to={`${getPlayerRoute(player.userId)}?mode=online`}>
              <article
                className={cn(
                  mutedCardClassName,
                  "grid items-center gap-3 px-4 py-3",
                  leaderboardColumns,
                  player.userId === currentUserId &&
                    "border-accent/40 bg-[linear-gradient(180deg,rgba(78,222,163,0.08),rgba(26,26,26,0.8))]"
                )}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-surfaceHigher text-sm font-semibold text-white">
                  {player.rank}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-lg font-semibold text-white">{player.displayName}</p>
                  <p className="truncate whitespace-nowrap text-xs text-muted">
                    {player.handsPlayed} {getHandsLabel(player.handsPlayed)} • {formatPercentFromBps(player.winRateBps)} побед
                  </p>
                </div>
                <div className="text-right">
                  <p className={cn("text-lg font-semibold", player.netEstimatedMinor ? getToneClass(player.netEstimatedMinor) : "text-muted")}>
                    {formatSignedWholeRubles(player.netEstimatedMinor)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-semibold text-white">{player.onlinePokerScore}</p>
                </div>
              </article>
            </Link>
          ))
        : offlineItems.map((player) => (
            <Link key={player.userId} to={getPlayerRoute(player.userId)}>
              <article
                className={cn(
                  mutedCardClassName,
                  "grid items-center gap-3 px-4 py-3",
                  leaderboardColumns,
                  player.userId === currentUserId &&
                    "border-accent/40 bg-[linear-gradient(180deg,rgba(78,222,163,0.08),rgba(26,26,26,0.8))]"
                )}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-surfaceHigher text-sm font-semibold text-white">
                  {player.rank}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-lg font-semibold text-white">{player.displayName}</p>
                  <p className="truncate whitespace-nowrap text-xs text-muted">
                    {formatPercentFromBps(player.roiBps)} ROI • {player.gamesCount} {getGamesLabel(player.gamesCount)}
                  </p>
                </div>
                <div className="text-right">
                  <p className={cn("text-lg font-semibold", getToneClass(player.totalProfitMinor))}>
                    {formatLeaderboardProfit(player.totalProfitMinor)}
                  </p>
                  <p className="text-xs text-muted">{formatPercentFromBps(player.winRateBps)} побед</p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-semibold text-white">{player.pokerScore}</p>
                </div>
              </article>
            </Link>
          ))}
    </section>
  );
}

function PlayerProfileScreen(): JSX.Element {
  const { userId = "" } = useParams();
  const { state } = useSession();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isPokerScoreInfoOpen, setIsPokerScoreInfoOpen] = useState(false);
  const [isStyleStatsExpanded, setIsStyleStatsExpanded] = useState(false);
  const [isStyleStatsInfoOpen, setIsStyleStatsInfoOpen] = useState(false);
  const [mode, setMode] = useState<ProfileMode>(() => getProfileModeFromSearchParams(searchParams));
  const [profileState, setProfileState] = useState<LoadState<GetPlayerProfileResponseDto>>({
    status: "idle",
    data: null,
    errorMessage: null
  });
  const [virtualProfileState, setVirtualProfileState] = useState<LoadState<GetVirtualPlayerProfileResponseDto>>({
    status: "idle",
    data: null,
    errorMessage: null
  });
  const [isAccessDenied, setIsAccessDenied] = useState(false);
  const [isVirtualAccessDenied, setIsVirtualAccessDenied] = useState(false);

  useEffect(() => {
    setMode(getProfileModeFromSearchParams(searchParams));
  }, [searchParams]);

  const updateMode = useCallback(
    (nextMode: ProfileMode) => {
      setMode(nextMode);
      const nextSearchParams = new URLSearchParams(searchParams);

      if (nextMode === "online") {
        nextSearchParams.set("mode", "online");
      } else {
        nextSearchParams.delete("mode");
      }

      setSearchParams(nextSearchParams, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  useEffect(() => {
    if (mode !== "offline") {
      return;
    }

    if (!state.accessToken || !userId) {
      setProfileState({
        status: "idle",
        data: null,
        errorMessage: null
      });
      setIsAccessDenied(false);
      return;
    }

    let isCancelled = false;
    setProfileState({
      status: "loading",
      data: null,
      errorMessage: null
    });
    setIsAccessDenied(false);

    void getPlayerProfile(state.accessToken, userId)
      .then((data) => {
        if (isCancelled) {
          return;
        }

        setProfileState({
          status: "ready",
          data,
          errorMessage: null
        });
      })
      .catch((error: unknown) => {
        if (isCancelled) {
          return;
        }

        const hasAccessDenied =
          error instanceof ApiRequestError &&
          error.status === 403 &&
          error.code === "PLAYER_ACCESS_DENIED";

        setIsAccessDenied(hasAccessDenied);
        setProfileState({
          status: "error",
          data: null,
          errorMessage: hasAccessDenied
            ? "Статистика откроется, когда у вас появится общая завершённая игра."
            : getErrorMessage(error, "Не получилось открыть профиль игрока")
        });
      });

    return () => {
      isCancelled = true;
    };
  }, [mode, state.accessToken, userId]);

  useEffect(() => {
    if (mode !== "online") {
      return;
    }

    if (!state.accessToken || !userId) {
      setVirtualProfileState({
        status: "idle",
        data: null,
        errorMessage: null
      });
      setIsVirtualAccessDenied(false);
      return;
    }

    let isCancelled = false;
    setVirtualProfileState({
      status: "loading",
      data: null,
      errorMessage: null
    });
    setIsVirtualAccessDenied(false);

    void getVirtualPlayerProfile(state.accessToken, userId)
      .then((data) => {
        if (isCancelled) {
          return;
        }

        setVirtualProfileState({
          status: "ready",
          data,
          errorMessage: null
        });
      })
      .catch((error: unknown) => {
        if (isCancelled) {
          return;
        }

        const hasAccessDenied = error instanceof ApiRequestError && error.status === 403;

        setIsVirtualAccessDenied(hasAccessDenied);
        setVirtualProfileState({
          status: "error",
          data: null,
          errorMessage: hasAccessDenied
            ? "Онлайн-статистика откроется после вашей первой общей завершённой игры."
            : getErrorMessage(error, "Не получилось открыть онлайн-статистику игрока")
        });
      });

    return () => {
      isCancelled = true;
    };
  }, [mode, state.accessToken, userId]);

  if (!state.accessToken) {
    return (
      <ScreenLayout
        title="Профиль игрока"
        subtitle="Статистика доступна после входа через Telegram."
        backTo={getLeaderboardRoute()}
        banner={getSessionBanner(state.status, state.errorMessage)}
      >
        <CompactEmptyState
          title="Нужен вход"
          description="Откройте приложение через Telegram, чтобы увидеть профиль."
          imageSrc={resolveMiniAppVisual("profile")}
          tone="graphite"
        />
      </ScreenLayout>
    );
  }

  const activeProfileState = mode === "online" ? virtualProfileState : profileState;
  const activeAccessDenied = mode === "online" ? isVirtualAccessDenied : isAccessDenied;

  if (activeProfileState.status === "loading" || activeProfileState.status === "idle") {
    return (
      <ScreenLayout
        title="Профиль игрока"
        subtitle={mode === "online" ? "Собираем онлайн-статистику игрока." : "Собираем статистику по завершённым играм."}
        backTo={getLeaderboardRoute()}
      >
        <section className={modeToggleClassName}>
          <SegmentedControl
            options={[
              { value: "offline", label: "Офлайн" },
              { value: "online", label: "Онлайн" }
            ]}
            value={mode}
            onChange={(nextMode) => updateMode(nextMode as ProfileMode)}
          />
        </section>
        <InfoCard
          title={mode === "online" ? "Открываем онлайн-статистику" : "Открываем профиль"}
          description={
            mode === "online"
              ? "Ещё немного, и покажем результат, динамику и последние онлайн-игры."
              : "Ещё немного, и покажем форму игрока и последние результаты."
          }
        />
      </ScreenLayout>
    );
  }

  if (activeProfileState.status === "error") {
    return (
      <ScreenLayout
        title={activeAccessDenied ? "Профиль пока закрыт" : "Профиль игрока"}
        subtitle={
          activeAccessDenied
            ? mode === "online"
              ? "Онлайн-статистика появится, когда у вас будет хотя бы одна общая завершённая игра."
              : "Подробная статистика доступна только игрокам с общими завершёнными столами."
            : mode === "online"
              ? "Пока не удалось загрузить онлайн-статистику игрока."
              : "Пока не удалось загрузить статистику игрока."
        }
        backTo={getLeaderboardRoute()}
      >
        <section className={modeToggleClassName}>
          <SegmentedControl
            options={[
              { value: "offline", label: "Офлайн" },
              { value: "online", label: "Онлайн" }
            ]}
            value={mode}
            onChange={(nextMode) => updateMode(nextMode as ProfileMode)}
          />
        </section>
        <InfoCard
          title={activeAccessDenied ? "Пока доступ закрыт" : "Не получилось"}
          description={activeProfileState.errorMessage}
        />
      </ScreenLayout>
    );
  }

  const profile = profileState.data;
  const virtualProfile = virtualProfileState.data;

  if (mode === "offline" && !profile) {
    return (
      <ScreenLayout
        title="Профиль игрока"
        subtitle="Статистика пока недоступна."
        backTo={getLeaderboardRoute()}
      >
        <InfoCard
          title="Пока пусто"
          description="Попробуйте открыть профиль ещё раз чуть позже."
        />
      </ScreenLayout>
    );
  }

  if (mode === "online" && !virtualProfile) {
    return (
      <ScreenLayout
        title="Профиль игрока"
        subtitle="Онлайн-статистика пока недоступна."
        backTo={getLeaderboardRoute()}
      >
        <section className={modeToggleClassName}>
          <SegmentedControl
            options={[
              { value: "offline", label: "Офлайн" },
              { value: "online", label: "Онлайн" }
            ]}
            value={mode}
            onChange={(nextMode) => updateMode(nextMode as ProfileMode)}
          />
        </section>
        <InfoCard
          title="Пока пусто"
          description="Попробуйте открыть онлайн-статистику ещё раз чуть позже."
        />
      </ScreenLayout>
    );
  }

  if (
    mode === "online" &&
    virtualProfile &&
    virtualProfile.tableStats.tablesPlayed === 0 &&
    virtualProfile.recentResults.length === 0
  ) {
    return (
      <ScreenLayout
        title="Профиль игрока"
        subtitle="Онлайн-игр пока не было."
        backTo={getLeaderboardRoute()}
      >
        <section className={modeToggleClassName}>
          <SegmentedControl
            options={[
              { value: "offline", label: "Офлайн" },
              { value: "online", label: "Онлайн" }
            ]}
            value={mode}
            onChange={(nextMode) => updateMode(nextMode as ProfileMode)}
          />
        </section>
        <InfoCard
          title="Пока нет данных"
          description="Как только у игрока появятся завершённые онлайн-игры, здесь появятся результат и динамика."
        />
      </ScreenLayout>
    );
  }

  if (mode === "online" && virtualProfile) {
    const { recentResults, stats, tableStats, user } = virtualProfile;
    const onlineResultStats = getVirtualRecentMoneyStats(recentResults);

    return (
      <ScreenLayout>
        <ProfileHeaderSection
          mode={mode}
          onInfoClick={() => setIsPokerScoreInfoOpen(true)}
          onModeChange={updateMode}
          score={String(stats.onlinePokerScore)}
          subtitle={user.username ? `@${user.username}` : "Онлайн-статистика"}
          title={user.displayName}
        />

        <section className="grid grid-cols-2 gap-3">
          <Metric
            className={cardClassName}
            label="Общий итог"
            value={formatSignedCurrency(stats.netEstimatedMinor, "RUB")}
            valueClassName={getToneClass(stats.netEstimatedMinor)}
          />
          <Metric className={cardClassName} label="Игр сыграно" value={String(tableStats.tablesPlayed)} />
          <Metric className={cardClassName} label="ROI" value={formatPercentFromBps(tableStats.roiBps)} />
          <Metric
            className={cardClassName}
            label="Победы"
            value={formatPercentFromBps(tableStats.tableWinRateBps)}
          />
        </section>

        <VirtualPlayerArchetypeCard style={virtualProfile.style} />

        <VirtualStyleStatsCard
          isExpanded={isStyleStatsExpanded}
          onInfoClick={() => setIsStyleStatsInfoOpen(true)}
          onToggleExpanded={() => setIsStyleStatsExpanded((current) => !current)}
          style={virtualProfile.style}
        />

        <CompactPanel
          action={
            recentResults.length > 0 ? (
              <p className={cn("text-lg font-semibold", getToneClass(getLatestVirtualCumulativeNetEstimatedMinor(recentResults)))}>
                {formatSignedCurrency(getLatestVirtualCumulativeNetEstimatedMinor(recentResults), "RUB")}
              </p>
            ) : null
          }
          description="Последние завершённые онлайн-игры, от старых к новым."
          title="Динамика результата"
        >
          <VirtualProfileTrendChart recentResults={recentResults} />
        </CompactPanel>

        <CompactPanel title="Последние результаты">
          {recentResults.length === 0 ? (
            <EmptyStatePanel text="Последние результаты появятся после завершённых онлайн-игр." />
          ) : (
            <>
              <StatRow
                label="Лучший стол"
                value={formatSignedCurrency(onlineResultStats.bestMinor, "RUB")}
                valueClassName={getToneClass(onlineResultStats.bestMinor)}
              />
              <StatRow
                label="Самый сложный стол"
                value={formatSignedCurrency(onlineResultStats.worstMinor, "RUB")}
                valueClassName={getToneClass(onlineResultStats.worstMinor)}
              />
              <StatRow
                label="Средний результат"
                value={formatSignedCurrency(onlineResultStats.averageMinor, "RUB")}
                valueClassName={getToneClass(onlineResultStats.averageMinor)}
              />
              <StatRow
                label="Столов в плюсе"
                value={`${tableStats.tablesWon}/${tableStats.tablesPlayed}`}
              />
            </>
          )}
        </CompactPanel>
        <StyleStatsInfoModal open={isStyleStatsInfoOpen} onOpenChange={setIsStyleStatsInfoOpen} />
        <PokerScoreInfoModal open={isPokerScoreInfoOpen} onOpenChange={setIsPokerScoreInfoOpen} />
      </ScreenLayout>
    );
  }

  const { recentGames, stats, user } = profile!;

  return (
    <ScreenLayout>
      <ProfileHeaderSection
        mode={mode}
        onInfoClick={() => setIsPokerScoreInfoOpen(true)}
        onModeChange={updateMode}
        score={String(stats.pokerScore)}
        subtitle={user.username ? `@${user.username}` : "Офлайн-статистика"}
        title={user.displayName}
      />

      <section className="grid grid-cols-2 gap-3">
        <Metric
          className={cardClassName}
          label="Общий итог"
          value={formatSignedMinorStat(stats.totalProfitMinor)}
          valueClassName={getToneClass(stats.totalProfitMinor)}
        />
        <Metric className={cardClassName} label="Игр сыграно" value={String(stats.gamesCount)} />
        <Metric className={cardClassName} label="ROI" value={formatPercentFromBps(stats.roiBps)} />
        <Metric
          className={cardClassName}
          label="Победы"
          value={formatPercentFromBps(stats.winRateBps)}
        />
      </section>

      <CompactPanel
        action={
          recentGames.length > 0 ? (
            <p className={cn("text-lg font-semibold", getToneClass(getLatestCumulativeProfitMinor(recentGames)))}>
              {formatSignedCurrency(getLatestCumulativeProfitMinor(recentGames), recentGames[0]!.currency)}
            </p>
          ) : null
        }
        description="Последние 10 закрытых игр, от старых к новым."
        title="Динамика выигрышей"
      >
        <ProfileTrendChart recentGames={recentGames} />
      </CompactPanel>

      <CompactPanel title="Последние результаты">
        <StatRow
          label="Лучшая игра"
          value={formatSignedMinorStat(stats.bestGameMinor)}
          valueClassName={getToneClass(stats.bestGameMinor)}
        />
        <StatRow
          label="Самая сложная игра"
          value={formatSignedMinorStat(stats.worstGameMinor)}
          valueClassName={getToneClass(stats.worstGameMinor)}
        />
        <StatRow
          label="Средний результат"
          value={formatSignedMinorStat(stats.avgProfitMinor)}
          valueClassName={getToneClass(stats.avgProfitMinor)}
        />
        <StatRow label="Стабильность" value={formatPercentFromBps(stats.stabilityScoreBps)} />
      </CompactPanel>
      <PokerScoreInfoModal open={isPokerScoreInfoOpen} onOpenChange={setIsPokerScoreInfoOpen} />
    </ScreenLayout>
  );
}

export function ProfileHeaderSection({
  title,
  subtitle,
  score,
  mode,
  onModeChange,
  onInfoClick
}: {
  title: string;
  subtitle: string;
  score: string;
  mode: ProfileMode;
  onModeChange: (mode: ProfileMode) => void;
  onInfoClick: () => void;
}): JSX.Element {
  return (
    <section className="glass-card rounded-2xl bg-card p-4" data-testid="player-profile-header">
      <div className="flex items-start gap-3">
        <CompactVisualAccent imageAlt="Профиль игрока" imageSrc={resolveMiniAppVisual("profile")} />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#93a099]">Профиль игрока</p>
          <h1 className="mt-1 truncate text-[1.45rem] font-semibold leading-tight text-white">{title}</h1>
          <p className="mt-1 truncate text-sm text-muted">{subtitle}</p>
        </div>
        <div className="shrink-0 text-right">
          <div className="flex items-center justify-end gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#93a099]">Score</p>
            <InfoIconButton label="Что такое Poker Score" onClick={onInfoClick} />
          </div>
          <p className="mt-1 font-display text-[2rem] font-semibold leading-none text-accent">{score}</p>
        </div>
      </div>
      <div className={cn("mt-3", modeToggleClassName)}>
        <SegmentedControl
          options={[
            { value: "offline", label: "Офлайн" },
            { value: "online", label: "Онлайн" }
          ]}
          value={mode}
          onChange={(nextMode) => onModeChange(nextMode as ProfileMode)}
        />
      </div>
    </section>
  );
}

function CreateRoomScreen(): JSX.Element {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { state } = useSession();
  const { clubsState } = useClubsList();
  const { refreshRooms } = useRoomsList();
  const clubIdFromQuery = searchParams.get("clubId")?.trim() ?? "";
  const [values, setValues] = useState<CreateRoomFormValues>({
    title: "",
    currency: "RUB",
    buyInChips: "",
    rebuyChips: "",
    chipsPerCurrencyUnit: "",
    rebuyPermission: "PLAYER_SELF",
    clubId: "",
    scheduledStartAt: "",
    sendNotifications: true,
    maxPlayers: "",
    location: ""
  });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canSubmit = state.status === "authenticated" && !!state.accessToken;

  useEffect(() => {
    if (!clubIdFromQuery) {
      return;
    }

    setValues((current) =>
      current.clubId === clubIdFromQuery
        ? current
        : {
            ...current,
            clubId: clubIdFromQuery
          }
    );
  }, [clubIdFromQuery]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    const validationMessage = getCreateRoomValidationMessage(values);
    const payload = buildCreateRoomPayload(values);

    if (validationMessage || !payload) {
      setErrorMessage(validationMessage ?? "Проверьте закуп, ребай и курс");
      return;
    }

    if (!state.accessToken) {
      setErrorMessage(
        "В обычном браузере можно только посмотреть интерфейс. Чтобы создать стол, откройте Mini App в Telegram."
      );
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await createRoom(state.accessToken, payload);
      await refreshRooms();
      void navigate(getRoomRoute(response.room.id));
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Не получилось создать стол"));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <ScreenLayout banner={state.status === "unsupported" ? getSessionBanner(state.status, null) : null}>
      <CompactFormShell
        eyebrow="Новый стол"
        footer={
          errorMessage ? (
            <p className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              {errorMessage}
            </p>
          ) : null
        }
        imageAlt="Создание стола"
        imageSrc={resolveMiniAppVisual("create-table")}
        title="Создать офлайн стол"
        tone="emerald"
      >
        <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
          <Field label="Название">
            <input
              className={inputClassName}
              maxLength={ROOM_TITLE_MAX_LENGTH}
              value={values.title}
              onChange={(event) => setValues((current) => ({ ...current, title: event.target.value }))}
              placeholder="Например, Пятничный покер"
            />
          </Field>

          <Field label="Валюта">
            <div className="mt-2 grid grid-cols-3 gap-3">
              {[
                { value: "RUB", label: "RUB" },
                { value: "USD", label: "USD" },
                { value: "EUR", label: "EUR" }
              ].map((option) => (
                <button
                  key={option.value}
                  className={getFilterButtonClass(values.currency === option.value)}
                  onClick={() => setValues((current) => ({ ...current, currency: option.value }))}
                  type="button"
                >
                  {option.label}
                </button>
              ))}
            </div>
          </Field>

          <section className="glass-card rounded-2xl border border-accent/25 bg-[linear-gradient(180deg,rgba(78,222,163,0.08),rgba(20,20,20,0.7))] px-4 py-4">
            <p className="flex items-center gap-2 text-sm font-medium text-accent">
              <MaterialIcon icon="add_circle" />
              Вход
            </p>
            <div className="mt-4 flex items-end justify-between gap-3">
              <input
                className="w-full bg-transparent text-[2.3rem] font-semibold leading-none text-white outline-none placeholder:text-white/25"
                inputMode="numeric"
                value={values.buyInChips}
                onChange={(event) =>
                  setValues((current) => ({ ...current, buyInChips: event.target.value }))
                }
                placeholder="10000"
              />
              <span className="pb-1 text-sm font-semibold uppercase text-accent">фишек</span>
            </div>
            <p className="mt-3 text-sm leading-6 text-muted">Сколько фишек получает игрок на старте.</p>
          </section>

          <Field label="Курс">
            <input
              className={inputClassName}
              inputMode="numeric"
              value={values.chipsPerCurrencyUnit}
              onChange={(event) =>
                setValues((current) => ({ ...current, chipsPerCurrencyUnit: event.target.value }))
              }
              placeholder="Например, 100"
            />
          </Field>

          <Field label="Ребай">
            <input
              className={inputClassName}
              inputMode="numeric"
              value={values.rebuyChips}
              onChange={(event) =>
                setValues((current) => ({ ...current, rebuyChips: event.target.value }))
              }
              placeholder="Например, 2500"
            />
          </Field>

          <Field label="Кто добавляет ребаи">
            <div className="mt-2 space-y-3">
              {([
                {
                  value: "PLAYER_SELF",
                  label: "Игроки сами отмечают ребаи",
                  icon: "person_add"
                },
                {
                  value: "ADMIN_APPROVAL",
                  label: "Админ подтверждает каждый ребай",
                  icon: "verified_user"
                },
                {
                  value: "ADMIN_ONLY",
                  label: "Только админ добавляет ребаи",
                  icon: "admin_panel_settings"
                }
              ] as const).map((option) => {
                const isActive = values.rebuyPermission === option.value;

                return (
                  <button
                    key={option.value}
                    className={cn(
                      "flex min-h-12 w-full items-center justify-between rounded-2xl border px-4 py-4 text-left transition",
                      isActive
                        ? "border-accent/50 bg-accent/10"
                        : "border-white/8 bg-white/[0.02] hover:bg-white/[0.04]"
                    )}
                    onClick={() =>
                      setValues((current) => ({
                        ...current,
                        rebuyPermission: option.value
                      }))
                    }
                    type="button"
                  >
                    <span className="flex items-center gap-3">
                      <span className={cn("text-muted", isActive && "text-accent")}>
                        <MaterialIcon icon={option.icon} />
                      </span>
                      <span className={cn("text-sm", isActive ? "text-white" : "text-muted")}>
                        {option.label}
                      </span>
                    </span>
                    <span
                      className={cn(
                        "h-5 w-5 rounded-full border",
                        isActive ? "border-accent bg-accent" : "border-white/15 bg-transparent"
                      )}
                    />
                  </button>
                );
              })}
            </div>
          </Field>

          <ClubSchedulingSection
            clubId={values.clubId ?? ""}
            clubs={(clubsState.data?.clubs ?? []).map((club) => ({
              id: club.id,
              name: club.name
            }))}
            description="Если игра привязана к клубу, участники увидят приглашение и смогут заранее ответить."
            isLoadingClubs={clubsState.status === "loading"}
            location={values.location ?? ""}
            maxPlayers={values.maxPlayers ?? ""}
            scheduledLabel="Когда собираетесь"
            scheduledStartAt={values.scheduledStartAt ?? ""}
            sendNotifications={values.sendNotifications ?? true}
            title="Клуб и мероприятие"
            onClubIdChange={(value) => setValues((current) => ({ ...current, clubId: value }))}
            onLocationChange={(value) => setValues((current) => ({ ...current, location: value }))}
            onMaxPlayersChange={(value) => setValues((current) => ({ ...current, maxPlayers: value }))}
            onScheduledStartAtChange={(value) =>
              setValues((current) => ({ ...current, scheduledStartAt: value }))
            }
            onSendNotificationsChange={(value) =>
              setValues((current) => ({ ...current, sendNotifications: value }))
            }
          />

          <CompactPanel title="Что получится" description="Проверьте настройки перед стартом.">
            <div className="grid grid-cols-2 gap-3">
              <Metric label="Вход" value={values.buyInChips.trim() || "Не задан"} />
              <Metric label="Ребай" value={values.rebuyChips.trim() || "Не задан"} />
              <Metric label="Валюта" value={getCurrencyLabel(values.currency)} />
              <Metric label="Курс" value={values.chipsPerCurrencyUnit.trim() || "Не задан"} />
              <Metric label="Режим" value={getRebuyPermissionLabel(values.rebuyPermission)} />
              {values.clubId ? (
                <Metric
                  label="Событие"
                  value={values.scheduledStartAt ? values.scheduledStartAt.replace("T", " ") : "Не задано"}
                />
              ) : null}
            </div>
          </CompactPanel>

          <Button className="w-full" disabled={isSubmitting || !canSubmit} type="submit">
            {isSubmitting ? "Создаём стол" : "Создать стол"}
          </Button>
        </form>
      </CompactFormShell>
    </ScreenLayout>
  );
}

function RoomScreen(): JSX.Element {
  const { roomId = "" } = useParams();
  const { state } = useSession();
  const { refreshRooms } = useRoomsList();
  const [roomState, setRoomState] = useState<LoadState<GetRoomResponseDto>>({
    status: "idle",
    data: null,
    errorMessage: null
  });
  const [historyState, setHistoryState] = useState<RebuyHistoryState>(createInitialHistoryState());
  const [isStarting, setIsStarting] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [addingRebuyForPlayerId, setAddingRebuyForPlayerId] = useState<string | null>(null);
  const [cancellingRebuyId, setCancellingRebuyId] = useState<string | null>(null);
  const [leaveDialogState, setLeaveDialogState] = useState<LeaveDialogState | null>(null);
  const [isLeavingRoom, setIsLeavingRoom] = useState(false);
  const [isReturningToRoom, setIsReturningToRoom] = useState(false);
  const [confirmationState, setConfirmationState] = useState<RoomConfirmationState | null>(null);
  const [roomMode, setRoomMode] = useState<RoomMode>("overview");
  const [settlementDraftValues, setSettlementDraftValues] = useState<Record<string, string>>({});
  const [settlementPreviewState, setSettlementPreviewState] = useState<SettlementPreviewState>(
    createInitialSettlementPreviewState()
  );
  const [isClosingSettlement, setIsClosingSettlement] = useState(false);

  useEffect(() => {
    if (!state.accessToken || !roomId) {
      setHistoryState(createInitialHistoryState());
      return;
    }

    const accessToken = state.accessToken;
    let isCancelled = false;
    setRoomState({
      status: "loading",
      data: null,
      errorMessage: null
    });
    setHistoryState(createInitialHistoryState());

    void getRoom(accessToken, roomId)
      .then(async (data) => {
        if (isCancelled) {
          return;
        }

        setRoomState({
          status: "ready",
          data,
          errorMessage: null
        });

        if (data.room.status !== "RUNNING") {
          setHistoryState(createInitialHistoryState());
          return;
        }

        setHistoryState((current) => ({
          ...current,
          status: "loading",
          errorMessage: null
        }));

        try {
          const history = await getRebuyHistory(accessToken, roomId);

          if (isCancelled) {
            return;
          }

          setHistoryState({
            status: "ready",
            items: history.rebuys,
            errorMessage: null
          });
        } catch (error) {
          if (isCancelled) {
            return;
          }

          setHistoryState({
            status: "error",
            items: [],
            errorMessage: getErrorMessage(error, "Не получилось загрузить историю ребаев")
          });
        }
      })
      .catch((error: unknown) => {
        if (isCancelled) {
          return;
        }

        setRoomState({
          status: "error",
          data: null,
          errorMessage: getErrorMessage(error, "Не получилось открыть игру")
        });
      });

    return () => {
      isCancelled = true;
    };
  }, [roomId, state.accessToken]);

  useEffect(() => {
    setRoomMode("overview");
    setSettlementDraftValues({});
    setSettlementPreviewState(createInitialSettlementPreviewState());
    setIsClosingSettlement(false);
    setLeaveDialogState(null);
    setIsLeavingRoom(false);
    setIsReturningToRoom(false);
  }, [roomId]);

  useEffect(() => {
    const roomData = roomState.data;

    if (!roomData) {
      return;
    }

    if (roomData.room.status !== "RUNNING") {
      setRoomMode("overview");
      setSettlementDraftValues({});
      setSettlementPreviewState(createInitialSettlementPreviewState());
      return;
    }

    const settlementPlayers = getSettlementPlayers(roomData.players);

    setSettlementDraftValues((current) => {
      const nextValues: Record<string, string> = {};

      for (const player of settlementPlayers) {
        nextValues[player.id] = current[player.id] ?? getInitialFinalAmountInput(player.finalAmountChips);
      }

      return areSettlementInputsEqual(current, nextValues) ? current : nextValues;
    });
  }, [roomState.data]);

  useEffect(() => {
    if (!state.accessToken || !roomId || !shouldPollRoomStatus(roomState.data?.room.status)) {
      return;
    }

    const accessToken = state.accessToken;
    let isCancelled = false;
    const intervalId = window.setInterval(() => {
      void getRoom(accessToken, roomId)
        .then(async (data) => {
          if (isCancelled) {
            return;
          }

          setRoomState({
            status: "ready",
            data,
            errorMessage: null
          });

          if (data.room.status !== "RUNNING") {
            setHistoryState(createInitialHistoryState());
            return;
          }

          const history = await getRebuyHistory(accessToken, roomId);

          if (isCancelled) {
            return;
          }

          setHistoryState({
            status: "ready",
            items: history.rebuys,
            errorMessage: null
          });
        })
        .catch((error: unknown) => {
          if (isCancelled) {
            return;
          }

          setRoomState((current) => ({
            status: "error",
            data: current.data,
            errorMessage: getErrorMessage(error, "Не получилось обновить игру")
          }));
          setHistoryState((current) => ({
            status: "error",
            items: current.items,
            errorMessage: getErrorMessage(error, "Не получилось обновить историю ребаев")
          }));
        });
    }, 8000);

    return () => {
      isCancelled = true;
      window.clearInterval(intervalId);
    };
  }, [roomId, roomState.data?.room.status, state.accessToken]);

  async function handleStart(): Promise<void> {
    if (!state.accessToken || !roomId) {
      return;
    }

    setIsStarting(true);

    try {
      await startRoom(state.accessToken, roomId);
      await Promise.all([
        refreshRoomState(state.accessToken, roomId, {
          setHistoryLoading: true,
          setRoomState,
          setHistoryState
        }),
        refreshRooms()
      ]);
    } catch (error) {
      setRoomState((current) => ({
        status: "error",
        data: current.data,
        errorMessage: getErrorMessage(error, "Не получилось начать игру")
      }));
    } finally {
      setIsStarting(false);
    }
  }

  async function handleConfirmAction(): Promise<void> {
    if (!state.accessToken || !roomId || !confirmationState) {
      return;
    }

    const isPendingForConfirmation =
      confirmationState.kind === "create-rebuy"
        ? addingRebuyForPlayerId === confirmationState.roomPlayerId
        : cancellingRebuyId === confirmationState.rebuyId;

    if (isPendingForConfirmation) {
      return;
    }

    if (confirmationState.kind === "create-rebuy") {
      setAddingRebuyForPlayerId(confirmationState.roomPlayerId);

      try {
        await createRebuy(state.accessToken, roomId, {
          roomPlayerId: confirmationState.roomPlayerId,
          idempotencyKey: confirmationState.idempotencyKey
        });
        await refreshRoomState(state.accessToken, roomId, {
          setHistoryLoading: true,
          setRoomState,
          setHistoryState
        });
        setConfirmationState(null);
      } catch (error) {
        setRoomState((current) => ({
          status: "error",
          data: current.data,
          errorMessage: getErrorMessage(error, "Не получилось добавить ребай")
        }));
      } finally {
        setAddingRebuyForPlayerId(null);
      }

      return;
    }

    setCancellingRebuyId(confirmationState.rebuyId);

    try {
      await cancelRebuy(state.accessToken, roomId, confirmationState.rebuyId, {
        idempotencyKey: confirmationState.idempotencyKey
      });
      await refreshRoomState(state.accessToken, roomId, {
        setHistoryLoading: true,
        setRoomState,
        setHistoryState
      });
      setConfirmationState(null);
    } catch (error) {
      setRoomState((current) => ({
        status: "error",
        data: current.data,
        errorMessage: getErrorMessage(error, "Не получилось отменить ребай")
      }));
    } finally {
      setCancellingRebuyId(null);
    }
  }

  function handleOpenSelfRebuy(): void {
    const roomData = roomState.data;

    if (!roomData) {
      return;
    }

    const myPlayer = roomData.players.find((player) => player.id === roomData.room.myPlayerId);

    setConfirmationState({
      kind: "create-rebuy",
      idempotencyKey: createIdempotencyKey(),
      roomPlayerId: roomData.room.myPlayerId,
      playerName: myPlayer?.displayName ?? "Вы",
      amountChips: roomData.room.rebuyChips,
      isSelf: true
    });
  }

  function handleOpenLeaveDialog(): void {
    const roomData = roomState.data;
    if (!roomData) {
      return;
    }

    const myPlayer = getMyPlayer(roomData.players, roomData.room.myPlayerId);
    setLeaveDialogState({
      finalAmountInput: getInitialFinalAmountInput(myPlayer?.finalAmountChips ?? "0"),
      errorMessage: null
    });
  }

  async function handleSubmitLeaveRoom(): Promise<void> {
    if (!state.accessToken || !roomId || !leaveDialogState) {
      return;
    }

    const payload = parseLeaveFinalAmountPayload(leaveDialogState.finalAmountInput);
    if (!payload) {
      setLeaveDialogState((current) =>
        current
          ? {
              ...current,
              errorMessage: "Укажите, сколько фишек осталось. Подойдет целое число, например 7500."
            }
          : current
      );
      return;
    }

    setIsLeavingRoom(true);

    try {
      await leaveRoom(state.accessToken, roomId, payload);
      setLeaveDialogState(null);
      await Promise.all([
        refreshRoomState(state.accessToken, roomId, {
          setHistoryLoading: true,
          setRoomState,
          setHistoryState
        }),
        refreshRooms()
      ]);
    } catch (error) {
      setLeaveDialogState((current) =>
        current
          ? {
              ...current,
              errorMessage: getErrorMessage(error, "Не получилось сохранить выход из игры")
            }
          : current
      );
    } finally {
      setIsLeavingRoom(false);
    }
  }

  async function handleReturnToRoom(): Promise<void> {
    if (!state.accessToken || !roomId) {
      return;
    }

    setIsReturningToRoom(true);

    try {
      await returnToRoom(state.accessToken, roomId);
      await Promise.all([
        refreshRoomState(state.accessToken, roomId, {
          setHistoryLoading: true,
          setRoomState,
          setHistoryState
        }),
        refreshRooms()
      ]);
    } catch (error) {
      setRoomState((current) => ({
        status: "error",
        data: current.data,
        errorMessage: getErrorMessage(error, "Не получилось вернуться за стол")
      }));
    } finally {
      setIsReturningToRoom(false);
    }
  }

  function handleOpenAdminRebuy(player: RoomPlayerDto): void {
    if (!roomState.data) {
      return;
    }

    setConfirmationState({
      kind: "create-rebuy",
      idempotencyKey: createIdempotencyKey(),
      roomPlayerId: player.id,
      playerName: player.displayName,
      amountChips: roomState.data.room.rebuyChips,
      isSelf: player.id === roomState.data.room.myPlayerId
    });
  }

  function handleOpenCancelRebuy(rebuy: RebuyHistoryItemDto): void {
    setConfirmationState({
      kind: "cancel-rebuy",
      idempotencyKey: createIdempotencyKey(),
      rebuyId: rebuy.id,
      playerName: rebuy.playerName,
      amountChips: rebuy.amountChips
    });
  }

  function handleSettlementValueChange(roomPlayerId: string, value: string): void {
    setSettlementDraftValues((current) => ({
      ...current,
      [roomPlayerId]: value
    }));
  }

  async function handlePreviewSettlement(): Promise<void> {
    if (!state.accessToken || !roomId || !settlementPreviewPayload || !settlementDraftKey) {
      setSettlementPreviewState({
        status: "error",
        data: null,
        errorMessage: "Сначала укажите корректные финальные суммы для всех игроков.",
        draftKey: null
      });
      return;
    }

    setSettlementPreviewState({
      status: "loading",
      data: null,
      errorMessage: null,
      draftKey: null
    });

    try {
      const preview = await previewSettlement(state.accessToken, roomId, settlementPreviewPayload);

      setSettlementPreviewState({
        status: "ready",
        data: preview,
        errorMessage: null,
        draftKey: settlementDraftKey
      });
    } catch (error) {
      setSettlementPreviewState({
        status: "error",
        data: null,
        errorMessage: getErrorMessage(error, "Не получилось проверить расчёт"),
        draftKey: null
      });
    }
  }

  async function handleCloseSettlement(): Promise<void> {
    if (!state.accessToken || !roomId || !settlementPreviewPayload || !canCloseSettlement) {
      return;
    }

    setIsClosingSettlement(true);

    try {
      await closeSettlement(state.accessToken, roomId, settlementPreviewPayload);
      setRoomMode("overview");
      setSettlementPreviewState(createInitialSettlementPreviewState());
      await Promise.all([
        refreshRoomState(state.accessToken, roomId, {
          setRoomState,
          setHistoryState
        }),
        refreshRooms()
      ]);
    } catch (error) {
      setSettlementPreviewState((current) => ({
        status: "error",
        data: current.data,
        errorMessage: getErrorMessage(error, "Не получилось закрыть игру"),
        draftKey: current.draftKey
      }));
    } finally {
      setIsClosingSettlement(false);
    }
  }

  if (!state.accessToken) {
    return (
      <ScreenLayout
        title="Игра"
        subtitle="Чтобы открыть приватный стол, нужен запуск из Telegram."
        backTo={getHomeRoute()}
        banner={getSessionBanner(state.status, state.errorMessage)}
      >
        <InfoCard
          title="Нужен вход через Telegram"
          description="В браузере можно посмотреть интерфейс, но приватные столы открываются только после авторизации."
        />
      </ScreenLayout>
    );
  }

  if (roomState.status === "loading" || roomState.status === "idle") {
    return (
      <ScreenLayout title="Игра" subtitle="Загружаем состав и настройки стола." backTo={getHomeRoute()}>
        <InfoCard title="Открываем стол" description="Ещё пара секунд, и всё будет на месте." />
      </ScreenLayout>
    );
  }

  if (roomState.status === "error" && !roomState.data) {
    return (
      <ScreenLayout title="Игра" subtitle="Пока не удалось открыть стол." backTo={getHomeRoute()}>
        <InfoCard title="Не получилось" description={roomState.errorMessage} />
      </ScreenLayout>
    );
  }

  const room = roomState.data!.room;
  const canStart = room.status === "WAITING" && ["OWNER", "ADMIN"].includes(room.myRole);
  const roomSurface = getRoomSurface(room);
  const isSelfRebuyPending = addingRebuyForPlayerId === room.myPlayerId;
  const settlementDraftPlayers = getSettlementDraftPlayers(
    roomState.data!.players,
    settlementDraftValues
  );
  const settlementDraftSummary = getSettlementDraftSummary(settlementDraftPlayers);
  const settlementPreviewPayload = buildSettlementPreviewPayload(settlementDraftPlayers);
  const settlementDraftKey = getSettlementDraftKey(settlementDraftPlayers);
  const isSettlementPreviewCurrent =
    settlementPreviewState.status === "ready" &&
    settlementDraftKey !== null &&
    settlementPreviewState.draftKey === settlementDraftKey;
  const isSettlementPreviewStale =
    settlementPreviewState.data !== null &&
    settlementPreviewState.draftKey !== null &&
    settlementPreviewState.draftKey !== settlementDraftKey;
  const canPreviewSettlement =
    settlementPreviewPayload !== null &&
    settlementPreviewState.status !== "loading" &&
    !isClosingSettlement;
  const canCloseSettlement =
    settlementPreviewPayload !== null &&
    settlementDraftSummary.isBalanced &&
    !settlementDraftSummary.hasMissingValues &&
    !settlementDraftSummary.hasInvalidValues &&
    settlementPreviewState.status === "ready" &&
    settlementPreviewState.draftKey === settlementDraftKey &&
    settlementPreviewState.data.differenceChips === "0" &&
    !isClosingSettlement;
  const isConfirmationPending =
    confirmationState?.kind === "create-rebuy"
      ? addingRebuyForPlayerId === confirmationState.roomPlayerId
      : confirmationState?.kind === "cancel-rebuy"
        ? cancellingRebuyId === confirmationState.rebuyId
        : false;

  return (
    <ScreenLayout>
      {roomState.status === "error" ? (
        <p className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {roomState.errorMessage}
        </p>
      ) : null}

      {roomSurface === "waiting" ? (
        <WaitingRoom
          canStart={canStart}
          data={roomState.data!}
          isStarting={isStarting}
          onCopyInvite={() => void copyToClipboard(room.inviteCode.toUpperCase())}
          onShareInvite={() => shareInvite(room.title, room.inviteCode, room.inviteUrl)}
          onStart={() => void handleStart()}
        />
      ) : null}

      {roomSurface === "active-player" ? (
        <ActiveRoomPlayer
          canSelfRebuy={canSelfRebuy(room)}
          data={roomState.data!}
          historyState={historyState}
          isCreatingSelfRebuy={isSelfRebuyPending}
          isLeavingRoom={isLeavingRoom}
          isHistoryOpen={isHistoryOpen}
          isReturningToRoom={isReturningToRoom}
          selfRebuyHint={getSelfRebuyHint(room)}
          onLeaveRoom={handleOpenLeaveDialog}
          onReturnToRoom={() => void handleReturnToRoom()}
          onSelfRebuy={handleOpenSelfRebuy}
          onToggleHistory={() => setIsHistoryOpen((current) => !current)}
        />
      ) : null}

      {roomSurface === "active-admin" && roomMode === "overview" ? (
        <ActiveRoomAdmin
          addingRebuyForPlayerId={addingRebuyForPlayerId}
          cancellingRebuyId={cancellingRebuyId}
          data={roomState.data!}
          historyState={historyState}
          isHistoryOpen={isHistoryOpen}
          isLeavingRoom={isLeavingRoom}
          isReturningToRoom={isReturningToRoom}
          onAddRebuy={handleOpenAdminRebuy}
          onCancelRebuy={handleOpenCancelRebuy}
          onLeaveRoom={handleOpenLeaveDialog}
          onOpenSettlement={() => setRoomMode("settlement")}
          onReturnToRoom={() => void handleReturnToRoom()}
          onToggleHistory={() => setIsHistoryOpen((current) => !current)}
        />
      ) : null}

      {roomSurface === "active-admin" && roomMode === "settlement" ? (
        <SettlementInputScreen
          canClose={canCloseSettlement}
          canPreview={canPreviewSettlement}
          data={roomState.data!}
          draftPlayers={settlementDraftPlayers}
          isClosing={isClosingSettlement}
          isPreviewCurrent={isSettlementPreviewCurrent}
          isPreviewLoading={settlementPreviewState.status === "loading"}
          isPreviewStale={isSettlementPreviewStale}
          onBack={() => setRoomMode("overview")}
          onChangeFinalAmount={handleSettlementValueChange}
          onCloseSettlement={() => void handleCloseSettlement()}
          onPreview={() => void handlePreviewSettlement()}
          preview={settlementPreviewState.data}
          previewErrorMessage={
            settlementPreviewState.status === "error" ? settlementPreviewState.errorMessage : null
          }
          summary={settlementDraftSummary}
        />
      ) : null}

      {roomSurface === "closed" ? <ClosedRoomResults data={roomState.data!} /> : null}

      {roomSurface === "other" ? (
        <InfoCard
          title={getRoomStatusText(room.status)}
          description="Здесь уже можно открыть игру и посмотреть её текущее состояние."
        />
      ) : null}

      <ConfirmationDialog
        confirmationState={confirmationState}
        currency={room.currency}
        isPending={isConfirmationPending}
        onCancel={() => setConfirmationState(null)}
        onConfirm={() => void handleConfirmAction()}
      />
      <LeaveRoomDialog
        currency={room.currency}
        errorMessage={leaveDialogState?.errorMessage ?? null}
        finalAmountInput={leaveDialogState?.finalAmountInput ?? ""}
        isPending={isLeavingRoom}
        roomData={roomState.data!}
        visible={leaveDialogState !== null}
        onCancel={() => setLeaveDialogState(null)}
        onChangeFinalAmount={(value) =>
          setLeaveDialogState((current) =>
            current
              ? {
                  finalAmountInput: value,
                  errorMessage: null
                }
              : current
          )
        }
        onConfirm={() => void handleSubmitLeaveRoom()}
      />
    </ScreenLayout>
  );
}

function JoinRoomScreen(): JSX.Element {
  const navigate = useNavigate();
  const { inviteCode = "" } = useParams();
  const { state } = useSession();
  const { refreshRooms } = useRoomsList();
  const [inviteCodeInput, setInviteCodeInput] = useState(() => normalizeInviteCode(inviteCode));
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const normalizedInviteCode = normalizeInviteCode(inviteCodeInput);

  useEffect(() => {
    setInviteCodeInput(normalizeInviteCode(inviteCode));
  }, [inviteCode]);

  async function handleJoin(): Promise<void> {
    if (!state.accessToken) {
      setErrorMessage(
        "В браузере можно только посмотреть интерфейс. Чтобы присоединиться к игре, откройте Mini App в Telegram."
      );
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await joinRoom(state.accessToken, {
        inviteCode: normalizedInviteCode
      });
      await refreshRooms();
      void navigate(getRoomRoute(response.roomId));
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Не получилось присоединиться к игре"));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <ScreenLayout banner={getSessionBanner(state.status, state.errorMessage)}>
      <div className="pb-[max(1rem,env(safe-area-inset-bottom))]">
        <CompactFormShell
          eyebrow="Приглашение"
          footer={
            state.status === "unsupported" ? (
              <p className="text-sm leading-6 text-muted">
                Для реального входа откройте эту ссылку в Telegram Mini App.
              </p>
            ) : null
          }
          headerAside={
            <div className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-accent/15 text-white shadow-[inset_0_0_0_1px_rgba(78,222,163,0.28)]">
              <span className="font-display text-[1.1rem] font-semibold">
                {getInviteInitials(normalizedInviteCode)}
              </span>
            </div>
          }
          imageAlt="Код приглашения"
          imageSrc={resolveMiniAppVisual("join-code")}
          title="Присоединиться к игре"
          tone="graphite"
        >
          <div className="space-y-4">
            <label className="block text-left">
              <span className={labelClassName}>Код приглашения</span>
              <input
                autoCapitalize="characters"
                autoComplete="off"
                className={cn(inputClassName, "uppercase tracking-[0.18em]")}
                inputMode="text"
                onChange={(event) => setInviteCodeInput(normalizeInviteCode(event.target.value))}
                placeholder="Например, PT2025"
                spellCheck={false}
                type="text"
                value={inviteCodeInput}
              />
            </label>

            {errorMessage ? (
              <p className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                {errorMessage}
              </p>
            ) : null}

            <Button
              className="w-full"
              disabled={isSubmitting || normalizedInviteCode.length === 0}
              onClick={() => void handleJoin()}
            >
              <MaterialIcon icon="login" />
              {isSubmitting ? "Подключаем стол" : "Присоединиться"}
            </Button>
          </div>
        </CompactFormShell>
      </div>
    </ScreenLayout>
  );
}

function ScreenLayout({
  title,
  subtitle,
  backTo,
  banner,
  children
}: {
  title?: string;
  subtitle?: string;
  backTo?: string;
  banner?: JSX.Element | null;
  children: ReactNode;
}): JSX.Element {
  return (
    <>
      {title ? (
        <header className="space-y-3 pt-1">
          {backTo ? (
            <Link className="inline-flex items-center gap-2 text-sm font-medium text-muted" to={backTo}>
              <MaterialIcon icon="arrow_back_ios_new" />
              Назад
            </Link>
          ) : null}
          <div>
            <h1 className="font-display text-[2.1rem] font-semibold leading-tight text-white">{title}</h1>
            {subtitle ? <p className="mt-2 max-w-[24rem] text-base leading-7 text-muted">{subtitle}</p> : null}
          </div>
        </header>
      ) : null}
      {banner}
      <div className="space-y-4">{children}</div>
    </>
  );
}

function Field({
  label,
  children
}: {
  label: string;
  children: ReactNode;
}): JSX.Element {
  return (
    <label className="block">
      <span className={labelClassName}>{label}</span>
      {children}
    </label>
  );
}

function InfoCard({
  title,
  description
}: {
  title: string;
  description: string;
}): JSX.Element {
  return (
    <section className="glass-info rounded-2xl px-4 py-4">
      <p className="text-lg font-semibold text-white">{title}</p>
      <p className="mt-2 text-sm leading-6 text-muted">{description}</p>
    </section>
  );
}

function ConfirmationDialog({
  confirmationState,
  currency,
  isPending,
  onCancel,
  onConfirm
}: {
  confirmationState: RoomConfirmationState | null;
  currency: string;
  isPending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}): JSX.Element | null {
  if (!confirmationState) {
    return null;
  }

  const amountText = formatChipsWithApprox(confirmationState.amountChips, currency, null);
  const title =
    confirmationState.kind === "create-rebuy"
      ? confirmationState.isSelf
        ? "Добавить себе ребай?"
        : `Добавить ребай игроку ${confirmationState.playerName}?`
      : "Отменить ребай?";
  const description =
    confirmationState.kind === "create-rebuy"
      ? confirmationState.isSelf
        ? `Вам сразу добавится ещё один ребай на ${amountText}.`
        : `${confirmationState.playerName} получит ещё один ребай на ${amountText}.`
      : `Запись для игрока ${confirmationState.playerName} останется в истории, но сумма ${amountText} больше не войдёт в общий стол.`;
  const confirmLabel =
    confirmationState.kind === "create-rebuy" ? "Подтвердить ребай" : "Отменить ребай";
  const pendingLabel =
    confirmationState.kind === "create-rebuy" ? "Сохраняем ребай" : "Отменяем ребай";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6">
      <div className="glass-card w-full rounded-[1.5rem] p-5 shadow-2xl sm:max-w-md">
        <p className="font-display text-[1.65rem] font-semibold leading-tight text-white">{title}</p>
        <p className="mt-3 text-sm leading-6 text-muted">{description}</p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Button className={cn(secondaryButtonClassName, "w-full")} disabled={isPending} onClick={onCancel}>
            Пока нет
          </Button>
          <Button className="w-full" disabled={isPending} onClick={onConfirm}>
            {isPending ? pendingLabel : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

function LeaveRoomDialog({
  roomData,
  currency,
  visible,
  finalAmountInput,
  errorMessage,
  isPending,
  onChangeFinalAmount,
  onCancel,
  onConfirm
}: {
  roomData: GetRoomResponseDto;
  currency: string;
  visible: boolean;
  finalAmountInput: string;
  errorMessage: string | null;
  isPending: boolean;
  onChangeFinalAmount: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}): JSX.Element | null {
  if (!visible) {
    return null;
  }

  const myPlayer = getMyPlayer(roomData.players, roomData.room.myPlayerId);
  const myRebuys = myPlayer?.rebuyCount ?? 0;
  const myTotalBuyin = myPlayer?.totalBuyinChips ?? "0";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6">
      <div className="glass-card w-full rounded-[1.5rem] p-5 shadow-2xl sm:max-w-md">
        <p className="font-display text-[1.65rem] font-semibold leading-tight text-white">Выйти со стола?</p>
        <p className="mt-3 text-sm leading-6 text-muted">
          Мы зафиксируем ваши фишки, чтобы итоговый расчет остался точным.
        </p>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <Metric label="Ребаи" value={String(myRebuys)} />
          <Metric
            label="Общий закуп"
            value={formatChipsWithApprox(myTotalBuyin, currency, roomData.room.chipsPerCurrencyUnit)}
          />
        </div>

        <label className="mt-4 block">
          <span className={labelClassName}>Сколько фишек осталось</span>
          <input
            className={inputClassName}
            inputMode="decimal"
            onChange={(event) => onChangeFinalAmount(event.target.value)}
            placeholder="Например, 4 800"
            value={finalAmountInput}
          />
        </label>

        {errorMessage ? (
          <p className="mt-3 rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
            {errorMessage}
          </p>
        ) : null}

        <div className="mt-4 grid grid-cols-2 gap-3">
          <Button className={cn(secondaryButtonClassName, "w-full")} disabled={isPending} onClick={onCancel}>
            Остаться
          </Button>
          <Button className="w-full" disabled={isPending} onClick={onConfirm}>
            {isPending ? "Сохраняем" : "Выйти со стола"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  className,
  valueClassName
}: {
  label: string;
  value: string;
  className?: string;
  valueClassName?: string;
}): JSX.Element {
  return (
    <div className={className}>
      <p className="text-[11px] uppercase tracking-[0.16em] text-muted">{label}</p>
      <p className={cn("mt-1 text-xl font-semibold text-white", valueClassName)}>{value}</p>
    </div>
  );
}

function SegmentedControl({
  options,
  value,
  onChange
}: {
  options: Array<{
    value: string;
    label: string;
  }>;
  value: string;
  onChange: (value: string) => void;
}): JSX.Element {
  return (
    <div className="grid grid-cols-2 gap-2">
      {options.map((option) => (
        <button
          key={option.value}
          className={cn(
            "min-h-9 rounded-xl px-3 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
            value === option.value
              ? "bg-[linear-gradient(180deg,rgba(86,223,157,0.2),rgba(26,38,31,0.96))] text-[#e3fff0] shadow-[inset_0_0_0_1px_rgba(86,223,157,0.08)]"
              : "bg-transparent text-muted hover:bg-white/[0.04] hover:text-white"
          )}
          onClick={() => onChange(option.value)}
          type="button"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function PokerTableLogo({ className }: { className?: string }): JSX.Element {
  return (
    <img
      alt="Poker Table"
      className={cn("h-12 w-12 object-contain", className)}
      src={pokerTableLogoPath}
    />
  );
}

function InfoIconButton({
  label,
  onClick
}: {
  label: string;
  onClick: () => void;
}): JSX.Element {
  return (
    <button
      aria-label={label}
      className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-muted transition hover:border-accent/50 hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onClick();
      }}
      type="button"
    >
      <MaterialIcon icon="info" />
    </button>
  );
}

function AppSplashScreen({ visible }: { visible: boolean }): JSX.Element | null {
  if (!visible) {
    return null;
  }

  return (
    <>
      <style>
        {`
          @keyframes poker-table-loader {
            0% { transform: translateX(-110%); }
            50% { transform: translateX(0%); }
            100% { transform: translateX(110%); }
          }
        `}
      </style>
      <div className="fixed inset-0 z-50 flex flex-col bg-[#0f0f0f]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(78,222,163,0.14),transparent_52%)]" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-48 bg-[radial-gradient(circle_at_bottom,rgba(78,222,163,0.08),transparent_62%)]" />
        <div className="relative flex flex-1 flex-col items-center justify-center px-6">
          <PokerTableLogo className="h-24 w-24" />
          <h1 className="mt-6 font-display text-[2.2rem] font-semibold leading-none text-white">Poker Table</h1>
          <div className="mt-8 h-1 w-32 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full w-full rounded-full bg-accent"
              style={{
                animation: "poker-table-loader 1.7s ease-in-out infinite"
              }}
            />
          </div>
        </div>
        <div className="relative px-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
            Clean utility for private games
          </p>
        </div>
      </div>
    </>
  );
}

function PokerScoreInfoModal({
  open,
  onOpenChange
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}): JSX.Element | null {
  useEffect(() => {
    if (!open) {
      return;
    }

    const handleEscape = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        onOpenChange(false);
      }
    };

    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [onOpenChange, open]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-sm"
      onClick={() => onOpenChange(false)}
    >
      <div
        className="absolute inset-x-2 mx-auto flex w-auto max-w-2xl flex-col overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#171717]/95 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
        style={{
          top: "max(7.5rem, calc(env(safe-area-inset-top) + 5.75rem))",
          bottom: "max(6.75rem, calc(env(safe-area-inset-bottom) + 6.5rem))"
        }}
      >
        <div className="flex items-start justify-between gap-4 px-5 pb-4 pt-5">
          <div className="min-w-0">
            <h2 className="font-display text-[1.55rem] font-semibold leading-tight text-white">
              Что такое Poker Score?
            </h2>
          </div>
          <button
            aria-label="Закрыть"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-muted transition hover:border-accent/50 hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            onClick={() => onOpenChange(false)}
            type="button"
          >
            <MaterialIcon icon="close" />
          </button>
        </div>

        <div
          className="min-h-0 flex-1 overflow-y-auto px-5 pb-6"
          style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
        >
          <p className="text-sm leading-6 text-muted">
            Poker Score — рейтинг игрока от 0 до 100. Он показывает качество игры на дистанции и
            складывается из четырёх коротких метрик.
          </p>

          <div className="space-y-3">
            <CompactInfoBlock
              title="40% ROI Score"
              description="Эффективность игры: чистая прибыль / сумма закупов × 100%."
            />
            <CompactInfoBlock title="30% Win Rate" description="Процент плюсовых игр на дистанции." />
            <CompactInfoBlock
              title="20% Stability Score"
              description="Стабильность результатов без сильных минусовых сессий."
            />
            <CompactInfoBlock
              title="10% Volume Confidence"
              description="Доверие к статистике по количеству сыгранных игр."
            />
          </div>

          <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
            <p className="text-[11px] uppercase tracking-[0.16em] text-accent/90">Формула</p>
            <p className="mt-2 text-sm leading-6 text-white">
              Poker Score = 40% ROI Score + 30% Win Rate + 20% Stability Score + 10% Volume Confidence
            </p>
          </div>

          <p className="mt-4 text-sm leading-6 text-muted">
            Total Profit показывает итог в деньгах, а Poker Score помогает понять, насколько стабильно
            и эффективно игрок держит дистанцию.
          </p>
        </div>
      </div>
    </div>
  );
}

function VirtualPlayerArchetypeCard({
  style
}: {
  style: GetVirtualPlayerProfileResponseDto["style"];
}): JSX.Element {
  return (
    <section className={cn(cardClassName, "space-y-3")}>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">Стиль игрока</p>
        <h3 className="mt-2 text-[1.65rem] font-semibold leading-tight text-white">
          {style.archetype.title}
        </h3>
      </div>
      <p className="text-sm leading-6 text-muted">{style.archetype.description}</p>
      {!style.sample.isEnoughData ? (
        <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-muted">
          Сыграно {style.sample.handsDealt}/{style.sample.minimumRequired} раздач для точного стиля.
        </div>
      ) : null}
    </section>
  );
}

function VirtualStyleStatsCard({
  isExpanded,
  onInfoClick,
  onToggleExpanded,
  style
}: {
  isExpanded: boolean;
  onInfoClick: () => void;
  onToggleExpanded: () => void;
  style: GetVirtualPlayerProfileResponseDto["style"];
}): JSX.Element {
  const compactStats = [
    {
      label: "VPIP",
      value: formatPercentFromBps(style.styleStats.vpipBps),
      description: "Входит в банк"
    },
    {
      label: "PFR",
      value: formatPercentFromBps(style.styleStats.pfrBps),
      description: "Рейзит до флопа"
    },
    {
      label: "Агрессия",
      value: formatAggressionFactor(style.styleStats.aggressionFactorBps),
      description: "Давит ставками"
    },
    {
      label: "BB/100",
      value: formatBbPer100(style.styleStats.bbPer100Bps),
      description: "Результат на дистанции"
    },
    {
      label: "Вскрытия",
      value: formatNullableStylePercent(style.styleStats.showdownWinRateBps, "Нет данных"),
      description: "Победы на шоудауне"
    },
    {
      label: "All-in",
      value: formatNullableStylePercent(style.styleStats.allInWinRateBps, "Нет all-in"),
      description: "Победы в all-in"
    }
  ];
  const expandedStats = [
    ...compactStats,
    {
      label: "Fold to Raise",
      value: formatNullableStylePercent(style.styleStats.foldToRaiseBps, "Нет ситуаций"),
      description: "Сдаётся на давление"
    },
    {
      label: "Showdown Rate",
      value: formatPercentFromBps(style.styleStats.showdownRateBps),
      description: "Доходит до вскрытия"
    },
    {
      label: "Средний банк",
      value: `${formatChips(style.styleStats.averagePotWonChips)} фишек`,
      description: "Средний выигранный банк"
    },
    {
      label: "Крупный банк",
      value: `${formatChips(style.styleStats.biggestPotWonChips)} фишек`,
      description: "Самый большой выигрыш"
    },
    {
      label: "Скорость",
      value: `${style.styleStats.averageDecisionTimeSeconds} сек`,
      description: "Среднее решение"
    },
    {
      label: "Напоминания",
      value: String(style.styleStats.remindersReceived),
      description: "Сколько раз ждали ход"
    },
    {
      label: "Автоходы",
      value: String(style.styleStats.autoActionsCount),
      description: "Пропущенные решения"
    }
  ];
  const stats = isExpanded ? expandedStats : compactStats;

  return (
    <section className={cn(cardClassName, "space-y-4")}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
            Статистика стиля
          </p>
          <h3 className="mt-2 text-[1.35rem] font-semibold text-white">Как играет за столом</h3>
        </div>
        <InfoIconButton label="Что означают показатели стиля" onClick={onInfoClick} />
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        {stats.map((item) => (
          <div key={`${item.label}-${item.description}`} className="rounded-2xl border border-white/8 bg-white/[0.025] px-3 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">{item.label}</p>
            <p className="mt-1 text-xl font-semibold text-white">{item.value}</p>
            <p className="mt-1 text-xs leading-5 text-muted">{item.description}</p>
          </div>
        ))}
      </div>

      <Button
        className={cn("w-full", secondaryButtonClassName)}
        onClick={onToggleExpanded}
        type="button"
      >
        {isExpanded ? "Скрыть подробности" : "Показать подробнее"}
      </Button>
    </section>
  );
}

function StyleStatsInfoModal({
  open,
  onOpenChange
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}): JSX.Element | null {
  useEffect(() => {
    if (!open) {
      return;
    }

    const handleEscape = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        onOpenChange(false);
      }
    };

    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [onOpenChange, open]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-sm" onClick={() => onOpenChange(false)}>
      <div
        className="absolute inset-x-2 mx-auto flex w-auto max-w-2xl flex-col overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#171717]/95 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
        style={{
          top: "max(7.5rem, calc(env(safe-area-inset-top) + 5.75rem))",
          bottom: "max(6.75rem, calc(env(safe-area-inset-bottom) + 6.5rem))"
        }}
      >
        <div className="flex items-start justify-between gap-4 px-5 pb-4 pt-5">
          <h2 className="font-display text-[1.55rem] font-semibold leading-tight text-white">
            Что означают показатели?
          </h2>
          <button
            aria-label="Закрыть"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-muted transition hover:border-accent/50 hover:text-accent"
            onClick={() => onOpenChange(false)}
            type="button"
          >
            <MaterialIcon icon="close" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 pb-6">
          <CompactInfoBlock title="VPIP" description="Как часто игрок входит в банк до флопа." />
          <CompactInfoBlock title="PFR" description="Как часто игрок рейзит до флопа." />
          <CompactInfoBlock title="Агрессия" description="Соотношение ставок и рейзов к коллам." />
          <CompactInfoBlock title="Fold to Raise" description="Как часто игрок сбрасывает карты на чужую ставку или рейз." />
          <CompactInfoBlock title="Showdown Win Rate" description="Как часто игрок выигрывает, когда доходит до вскрытия." />
          <CompactInfoBlock title="All-in Win Rate" description="Как часто игрок выигрывает all-in ситуации." />
          <CompactInfoBlock title="BB/100" description="Результат игрока в big blinds на 100 раздач." />
          <Button className="w-full" onClick={() => onOpenChange(false)} type="button">
            Понятно
          </Button>
        </div>
      </div>
    </div>
  );
}

function CompactInfoBlock({
  title,
  description
}: {
  title: string;
  description: string;
}): JSX.Element {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-3">
      <p className="text-sm font-semibold text-white">{title}</p>
      <p className="mt-1 text-sm leading-6 text-muted">{description}</p>
    </div>
  );
}

function StatRow({
  label,
  value,
  valueClassName
}: {
  label: string;
  value: string;
  valueClassName?: string;
}): JSX.Element {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-base text-muted">{label}</span>
      <span className={cn("text-[1.05rem] font-semibold text-white", valueClassName)}>{value}</span>
    </div>
  );
}

function ProfileTrendChart({
  recentGames
}: {
  recentGames: GetPlayerProfileResponseDto["recentGames"];
}): JSX.Element {
  if (recentGames.length === 0) {
    return <EmptyStatePanel text="График появится, когда у игрока будут закрытые игры." />;
  }

  const series = buildCumulativeProfitSeries(recentGames);
  const chartSeries = buildProfileTrendChartSeries(series);
  const width = 360;
  const height = 120;
  const axisWidth = 72;
  const paddingX = axisWidth;
  const paddingY = 12;
  const values = chartSeries.map((point) => Number(point.valueMinor) / 100);
  const minValue = Math.min(0, ...values);
  const maxValue = Math.max(0, ...values);
  const range = maxValue - minValue || 1;
  const plotWidth = width - paddingX - 10;
  const getYForValue = (value: number): number =>
    height - paddingY - ((value - minValue) / range) * (height - paddingY * 2);
  const points = chartSeries.map((point, index) => {
    const x =
      chartSeries.length === 1
        ? paddingX + plotWidth / 2
        : paddingX + (index * plotWidth) / (chartSeries.length - 1);
    const y = getYForValue(values[index]!);

    return `${x},${y}`;
  });

  const fillPoints = [`${paddingX},${height - paddingY}`, ...points, `${width - 10},${height - paddingY}`].join(" ");
  const zeroY = getYForValue(0);
  const axisTicks = [];

  if (maxValue !== 0) {
    axisTicks.push({
      label: formatTrendAxisCurrency(maxValue, recentGames[0]!.currency),
      y: getYForValue(maxValue)
    });
  }

  axisTicks.push({
    label: formatTrendAxisCurrency(0, recentGames[0]!.currency),
    y: zeroY
  });

  if (minValue !== 0) {
    axisTicks.push({
      label: formatTrendAxisCurrency(minValue, recentGames[0]!.currency),
      y: getYForValue(minValue)
    });
  }
  const gridLines = [paddingY, height - paddingY];

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-3">
        <svg
          aria-label="График накопительного выигрыша"
          className="h-32 w-full"
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
        >
          {axisTicks.map((tick) => (
            <text
              key={`${tick.label}-${tick.y}`}
              fill="rgba(181, 186, 193, 0.78)"
              fontSize="10"
              textAnchor="end"
              x={axisWidth - 8}
              y={tick.y + 3}
            >
              {tick.label}
            </text>
          ))}
          {gridLines.map((y) => (
            <line key={y} x1={paddingX} y1={y} x2={width - 10} y2={y} className="stroke-white/10" />
          ))}
          <line
            x1={paddingX}
            y1={zeroY}
            x2={width - 10}
            y2={zeroY}
            stroke="rgba(255, 255, 255, 0.5)"
            strokeWidth="1.5"
          />
          <polygon points={fillPoints} className="fill-[#4edea3]/12" />
          <polyline
            points={points.join(" ")}
            fill="none"
            stroke="rgb(78 222 163)"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="3"
          />
        </svg>
      </div>
      <div className="flex items-center justify-between gap-3 text-xs text-muted">
        <span>{formatDate(series[0]!.closedAt)}</span>
        <span>{formatDate(series[series.length - 1]!.closedAt)}</span>
      </div>
    </div>
  );
}

function VirtualProfileTrendChart({
  recentResults
}: {
  recentResults: GetVirtualPlayerProfileResponseDto["recentResults"];
}): JSX.Element {
  if (recentResults.length === 0) {
    return <EmptyStatePanel text="График появится, когда у игрока будут завершённые онлайн-игры." />;
  }

  const series = buildVirtualCumulativeProfitSeries(recentResults);
  const chartSeries = buildVirtualProfileTrendChartSeries(series);
  const width = 360;
  const height = 120;
  const axisWidth = 72;
  const paddingX = axisWidth;
  const paddingY = 12;
  const values = chartSeries.map((point) => Number(point.valueMinor) / 100);
  const minValue = Math.min(0, ...values);
  const maxValue = Math.max(0, ...values);
  const range = maxValue - minValue || 1;
  const plotWidth = width - paddingX - 10;
  const getYForValue = (value: number): number =>
    height - paddingY - ((value - minValue) / range) * (height - paddingY * 2);
  const points = chartSeries.map((point, index) => {
    const x =
      chartSeries.length === 1
        ? paddingX + plotWidth / 2
        : paddingX + (index * plotWidth) / (chartSeries.length - 1);
    const y = getYForValue(values[index]!);

    return `${x},${y}`;
  });

  const fillPoints = [`${paddingX},${height - paddingY}`, ...points, `${width - 10},${height - paddingY}`].join(" ");
  const zeroY = getYForValue(0);
  const lastRecentResult = recentResults[recentResults.length - 1];
  const axisTicks = [];

  if (maxValue !== 0) {
    axisTicks.push({
      label: formatTrendAxisCurrency(maxValue, "RUB"),
      y: getYForValue(maxValue)
    });
  }

  axisTicks.push({
    label: formatTrendAxisCurrency(0, "RUB"),
    y: zeroY
  });

  if (minValue !== 0) {
    axisTicks.push({
      label: formatTrendAxisCurrency(minValue, "RUB"),
      y: getYForValue(minValue)
    });
  }

  const gridLines = [paddingY, height - paddingY];

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-3">
        <svg
          aria-label="График накопительного результата в онлайн-играх"
          className="h-32 w-full"
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
        >
          {axisTicks.map((tick) => (
            <text
              key={`${tick.label}-${tick.y}`}
              fill="rgba(181, 186, 193, 0.78)"
              fontSize="10"
              textAnchor="end"
              x={axisWidth - 8}
              y={tick.y + 3}
            >
              {tick.label}
            </text>
          ))}
          {gridLines.map((y) => (
            <line key={y} x1={paddingX} y1={y} x2={width - 10} y2={y} className="stroke-white/10" />
          ))}
          <line
            x1={paddingX}
            y1={zeroY}
            x2={width - 10}
            y2={zeroY}
            stroke="rgba(255, 255, 255, 0.5)"
            strokeWidth="1.5"
          />
          <polygon points={fillPoints} className="fill-[#4edea3]/12" />
          <polyline
            points={points.join(" ")}
            fill="none"
            stroke="rgb(78 222 163)"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="3"
          />
        </svg>
      </div>
      <div className="flex items-center justify-between gap-3 text-xs text-muted">
        <span>{recentResults[0]?.finishedAt ? formatDate(recentResults[0].finishedAt) : "Первая игра"}</span>
        <span>
          {lastRecentResult?.finishedAt ? formatDate(lastRecentResult.finishedAt) : "Последняя игра"}
        </span>
      </div>
    </div>
  );
}

function EmptyStatePanel({ text }: { text: string }): JSX.Element {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-4 text-sm leading-6 text-muted">
      {text}
    </div>
  );
}

function getSessionBanner(
  status: string,
  errorMessage: string | null
): JSX.Element | null {
  if (status === "unsupported") {
    return (
      <section className="glass-info rounded-2xl px-4 py-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 text-accent">
            <MaterialIcon icon="info" />
          </span>
          <div>
            <p className="text-sm font-medium text-white">Режим просмотра в браузере</p>
            <p className="mt-2 text-sm leading-6 text-muted">
              Интерфейс можно проверить локально, но приватные действия работают только после запуска Mini App в Telegram.
            </p>
          </div>
        </div>
      </section>
    );
  }

  if (status === "error" && errorMessage) {
    return (
      <section className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200">
        {errorMessage}
      </section>
    );
  }

  return null;
}

function getRoomStatusText(status: string): string {
  switch (status) {
    case "WAITING":
      return "Ждём остальных";
    case "RUNNING":
      return "Игра идёт";
    case "SETTLEMENT":
      return "Идёт расчёт";
    case "CLOSED":
      return "Игра завершена";
    default:
      return "Стол готов";
  }
}

function getFilterButtonClass(
  isActive: boolean,
  sizeClassName = "px-4",
  compact = false
): string {
  return cn(
    "inline-flex items-center justify-center rounded-xl border font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
    compact ? "min-h-10 text-xs" : "min-h-12 text-[0.95rem]",
    sizeClassName,
    isActive
      ? "border-accent bg-accent text-[#032517]"
      : "border-white/10 bg-surfaceHigh text-foreground hover:bg-surfaceHigher"
  );
}

function formatLeaderboardProfit(value: string): string {
  const amount = BigInt(value);
  const sign = amount > 0n ? "+" : amount < 0n ? "-" : "";
  const absoluteWhole = (amount < 0n ? amount * -1n : amount) / 100n;
  const wholeText = new Intl.NumberFormat("ru-RU").format(Number(absoluteWhole)).replace(/\u00A0/g, " ");

  return `${sign}${wholeText}`;
}

function formatChipsWithApprox(
  chips: string,
  currency: string,
  chipsPerCurrencyUnit: string | null
): string {
  if (chipsPerCurrencyUnit && /^\d+$/.test(chipsPerCurrencyUnit) && BigInt(chipsPerCurrencyUnit) > 0n) {
    return formatChipsWithCurrencyApprox(chips, currency, chipsPerCurrencyUnit);
  }

  return `${formatChips(chips)} фишек`;
}

function formatCurrencyFromChips(
  chips: string,
  currency: string,
  chipsPerCurrencyUnit: string | null
): string {
  if (chipsPerCurrencyUnit && /^\d+$/.test(chipsPerCurrencyUnit) && BigInt(chipsPerCurrencyUnit) > 0n) {
    return formatMinorMoney(chipsToMoneyMinor(chips, chipsPerCurrencyUnit), currency);
  }

  return formatChips(chips);
}

function formatChipsCount(chips: string): string {
  return `${formatChips(chips)} фишек`;
}

function formatSignedCurrency(value: string, currency: string): string {
  const amount = BigInt(value);
  const formatted = formatMinorMoney(value, currency);

  return amount > 0n ? `+${formatted}` : formatted;
}

function formatSignedWholeRubles(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }

  const rubles = BigInt(value) / 100n;
  const formatted = formatChips(rubles.toString());

  return rubles > 0n ? `+${formatted}` : formatted;
}

function formatTrendAxisCurrency(value: number, currency: string): string {
  return formatMinorMoney(String(Math.round(value * 100)), currency);
}

function formatNullableStylePercent(value: number | null, fallback: string): string {
  return value === null ? fallback : formatPercentFromBps(value);
}

function formatAggressionFactor(value: number): string {
  if (value >= 1000) {
    return "10+";
  }

  return new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1
  }).format(value / 100);
}

function formatBbPer100(value: number): string {
  const sign = value > 0 ? "+" : "";
  const formatted = new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  }).format(value / 100);

  return `${sign}${formatted}`;
}

function formatSignedCurrencyFromChips(
  chips: string,
  currency: string,
  chipsPerCurrencyUnit: string | null
): string {
  if (chipsPerCurrencyUnit && /^\d+$/.test(chipsPerCurrencyUnit) && BigInt(chipsPerCurrencyUnit) > 0n) {
    return formatSignedCurrency(chipsToMoneyMinor(chips, chipsPerCurrencyUnit), currency);
  }

  return formatSignedChipsCount(chips);
}

function formatSignedChipsCount(chips: string): string {
  const amount = BigInt(chips);
  const sign = amount > 0n ? "+" : amount < 0n ? "-" : "";
  const absolute = amount < 0n ? amount * -1n : amount;

  return `${sign}${formatChips(absolute.toString())} фишек`;
}

function buildCumulativeProfitSeries(
  recentGames: GetPlayerProfileResponseDto["recentGames"]
): Array<{
  closedAt: string;
  valueMinor: string;
}> {
  const orderedGames = [...recentGames].reverse();
  let runningProfit = 0n;

  return orderedGames.map((game) => {
    const nextValue = (game as GetPlayerProfileResponseDto["recentGames"][number] & {
      cumulativeProfitMinor?: string;
    }).cumulativeProfitMinor;

    if (typeof nextValue === "string") {
      runningProfit = BigInt(nextValue);
    } else {
      runningProfit += BigInt(game.myNetResultMinor);
    }

    return {
      closedAt: game.closedAt,
      valueMinor: runningProfit.toString()
    };
  });
}

function buildVirtualCumulativeProfitSeries(
  recentResults: GetVirtualPlayerProfileResponseDto["recentResults"]
): Array<{
  finishedAt: string | null;
  valueMinor: string;
}> {
  const orderedResults = [...recentResults].reverse();
  let runningProfit = 0n;

  return orderedResults.map((result) => {
    if (result.cumulativeNetEstimatedMinor) {
      runningProfit = BigInt(result.cumulativeNetEstimatedMinor);
    } else {
      runningProfit += BigInt(result.netEstimatedMinor);
    }

    return {
      finishedAt: result.finishedAt,
      valueMinor: runningProfit.toString()
    };
  });
}

function buildProfileTrendChartSeries(
  series: Array<{
    closedAt: string;
    valueMinor: string;
  }>
): Array<{
  closedAt: string;
  valueMinor: string;
}> {
  const firstPoint = series[0];

  if (!firstPoint) {
    return [];
  }

  return [{ closedAt: firstPoint.closedAt, valueMinor: "0" }, ...series];
}

function buildVirtualProfileTrendChartSeries(
  series: Array<{
    finishedAt: string | null;
    valueMinor: string;
  }>
): Array<{
  finishedAt: string | null;
  valueMinor: string;
}> {
  const firstPoint = series[0];

  if (!firstPoint) {
    return [];
  }

  return [{ finishedAt: firstPoint.finishedAt, valueMinor: "0" }, ...series];
}

function getLatestCumulativeProfitMinor(recentGames: GetPlayerProfileResponseDto["recentGames"]): string {
  const series = buildCumulativeProfitSeries(recentGames);

  return series[series.length - 1]?.valueMinor ?? "0";
}

function getLatestVirtualCumulativeNetEstimatedMinor(
  recentResults: GetVirtualPlayerProfileResponseDto["recentResults"]
): string {
  const series = buildVirtualCumulativeProfitSeries(recentResults);

  return series[series.length - 1]?.valueMinor ?? "0";
}

function getVirtualRecentMoneyStats(
  recentResults: GetVirtualPlayerProfileResponseDto["recentResults"]
): {
  bestMinor: string;
  worstMinor: string;
  averageMinor: string;
} {
  if (recentResults.length === 0) {
    return {
      bestMinor: "0",
      worstMinor: "0",
      averageMinor: "0"
    };
  }

  const values = recentResults.map((result) => BigInt(result.netEstimatedMinor));
  const bestMinor = values.reduce((best, value) => (value > best ? value : best), values[0]!);
  const worstMinor = values.reduce((worst, value) => (value < worst ? value : worst), values[0]!);
  const totalMinor = values.reduce((sum, value) => sum + value, 0n);

  return {
    bestMinor: bestMinor.toString(),
    worstMinor: worstMinor.toString(),
    averageMinor: (totalMinor / BigInt(values.length)).toString()
  };
}

function MaterialIcon({
  icon,
  filled = false
}: {
  icon: string;
  filled?: boolean;
}): JSX.Element {
  return (
    <span
      aria-hidden="true"
      className="material-symbols-outlined"
      style={{
        fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' 500, 'GRAD' 0, 'opsz' 24`
      }}
    >
      {icon}
    </span>
  );
}

function getHomeTargetRoute(target: HomeTarget): string {
  switch (target.kind) {
    case "active-turn":
    case "virtual-table":
      return getVirtualTableRoute(target.tableId);
    case "offline-room":
      return getRoomRoute(target.roomId);
    case "event":
      return getClubEventRoute(target.clubId, target.eventId);
    case "club":
      return getClubRoute();
    default:
      return getClubRoute();
  }
}

function getHomeRsvpLabel(status: ClubEventListItemDto["myRsvpStatus"]): string {
  switch (status) {
    case "GOING":
      return "Иду";
    case "MAYBE":
      return "Возможно";
    case "DECLINED":
      return "Не иду";
    case "WAITLIST":
      return "Лист";
    case "NO_RESPONSE":
    case null:
    case undefined:
      return "Ответить";
    default:
      return "Событие";
  }
}

function getHomeEventTypeLabel(type: ClubEventListItemDto["type"]): string {
  return type === "ONLINE_TABLE" ? "Онлайн" : "Оффлайн";
}

function formatHomeEventTime(value: string): string {
  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) {
    return "время уточняется";
  }

  return date.toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function getChromeSubtitle(pathname: string): string {
  if (/^\/clubs\/[^/]+\/events\/[^/]+$/.test(pathname)) {
    return "Мероприятие клуба";
  }

  if (/^\/clubs\/[^/]+\/invite$/.test(pathname)) {
    return "Приглашение";
  }

  if (/^\/clubs\/join\/[^/]+$/.test(pathname)) {
    return "Приглашение в клуб";
  }

  if (pathname === getClubsNewRoute()) {
    return "Новый клуб";
  }

  if (/^\/clubs\/[^/]+$/.test(pathname) || pathname === "/clubs") {
    return "Клуб";
  }

  if (pathname.endsWith("/history") || pathname.includes("/hands/")) {
    return "История раздач";
  }

  if (pathname === getVirtualLobbyRoute() || pathname.startsWith("/poker/tables/")) {
    return "Онлайн-покер";
  }

  if (pathname === getCreateVirtualTableRoute()) {
    return "Новый стол";
  }

  if (pathname === getJoinVirtualTableRoute() || pathname.startsWith("/poker/join/")) {
    return "Войти по коду";
  }

  if (pathname === getVirtualLeaderboardRoute()) {
    return "Онлайн-рейтинг";
  }

  if (pathname === getVirtualStatsRoute()) {
    return "Статистика";
  }

  if (pathname === getGamesRoute()) {
    return "Оффлайн";
  }

  if (pathname === getClubRoute()) {
    return "Клуб";
  }

  if (pathname === getJoinRoute()) {
    return "Присоединиться";
  }

  if (pathname === getLeaderboardRoute()) {
    return "Рейтинг";
  }

  if (pathname === getCreateRoomRoute()) {
    return "Новый стол";
  }

  if (isOfflineJoinRoutePath(pathname)) {
    return "Приглашение в игру";
  }

  if (pathname.startsWith("/players/")) {
    return "Профиль игрока";
  }

  if (pathname.startsWith("/rooms/")) {
    return "Стол и расчёты";
  }

  return "Poker tracker";
}

function isBrandHeaderRoute(pathname: string): boolean {
  return (
    pathname === getGamesRoute() ||
    pathname === getVirtualLobbyRoute() ||
    pathname === getClubRoute() ||
    pathname === getLeaderboardRoute() ||
    /^\/players\/[^/]+$/.test(pathname)
  );
}

function isGamesBaseRoute(pathname: string): boolean {
  return pathname === getGamesRoute() || pathname === getCreateRoomRoute() || isOfflineJoinRoutePath(pathname) || pathname.startsWith("/rooms/");
}

function isCompactJoinRoutePath(pathname: string): boolean {
  return (
    pathname === getJoinVirtualTableRoute() ||
    pathname.startsWith("/poker/join/") ||
    pathname.startsWith("/clubs/join/")
  );
}

function isOfflineJoinRoutePath(pathname: string): boolean {
  return pathname === getJoinRoute() || pathname.startsWith("/join/");
}

function isVirtualPokerRoute(pathname: string): boolean {
  return pathname === getVirtualLobbyRoute() || pathname.startsWith("/poker/");
}

function getVirtualTableRouteId(pathname: string): string | null {
  const match = /^\/poker\/tables\/([^/]+)$/.exec(pathname);
  return match?.[1] ?? null;
}

function parseLeaveFinalAmountPayload(input: string): SubmitFinalChipsRequestDto | null {
  const normalized = input.trim().replace(/\s+/g, "");

  if (!/^\d+$/.test(normalized)) {
    return null;
  }

  return {
    finalAmountChips: normalized
  };
}

function isOwnProfilePath(pathname: string, currentUserId: string | null): boolean {
  return currentUserId !== null && pathname === getPlayerRoute(currentUserId);
}

function getCurrencyLabel(currency: string): string {
  switch (currency.toUpperCase()) {
    case "USD":
      return "Доллары";
    case "EUR":
      return "Евро";
    default:
      return "Рубли";
  }
}

function getRebuyPermissionLabel(permission: CreateRoomFormValues["rebuyPermission"]): string {
  switch (permission) {
    case "ADMIN_APPROVAL":
      return "Через админа";
    case "ADMIN_ONLY":
      return "Только админ";
    default:
      return "Игрок сам";
  }
}

function getInviteInitials(inviteCode: string): string {
  const compact = inviteCode.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();

  return compact.slice(0, 2) || "PT";
}

function getGamesLabel(count: number): string {
  const lastTwo = count % 100;
  const last = count % 10;

  if (lastTwo >= 11 && lastTwo <= 14) {
    return "игр";
  }

  if (last === 1) {
    return "игра";
  }

  if (last >= 2 && last <= 4) {
    return "игры";
  }

  return "игр";
}

function getHandsLabel(count: number): string {
  const lastTwo = count % 100;
  const last = count % 10;

  if (lastTwo >= 11 && lastTwo <= 14) {
    return "рук";
  }

  if (last === 1) {
    return "рука";
  }

  if (last >= 2 && last <= 4) {
    return "руки";
  }

  return "рук";
}

function getPlayersLabel(count: number): string {
  const lastTwo = count % 100;
  const last = count % 10;

  if (lastTwo >= 11 && lastTwo <= 14) {
    return "игроков";
  }

  if (last === 1) {
    return "игрок";
  }

  if (last >= 2 && last <= 4) {
    return "игрока";
  }

  return "игроков";
}

function getToneClass(value: string): string {
  const tone = getResultTone(value);

  if (tone === "positive") {
    return "text-emerald-300";
  }

  if (tone === "negative") {
    return "text-rose-300";
  }

  return "text-foreground";
}

function getResultColorClass(value: string): string {
  return getToneClass(value);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function getProfileModeFromSearchParams(searchParams: URLSearchParams): ProfileMode {
  return searchParams.get("mode") === "online" ? "online" : "offline";
}

function normalizeInviteCode(value: string): string {
  return value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

function navigateBack(navigate: NavigateFunction, pathname: string): void {
  if (canUseBrowserBack()) {
    void navigate(-1);
    return;
  }

  void navigate(getAppBackFallbackPath(pathname), { replace: true });
}

function getAppBackFallbackPath(pathname: string): string {
  if (pathname.includes("/hands/")) {
    const tableId = pathname.match(/^\/poker\/tables\/([^/]+)\/hands\/[^/]+$/)?.[1];

    if (tableId) {
      return getVirtualTableHistoryRoute(tableId);
    }
  }

  if (pathname.endsWith("/history")) {
    const tableId = pathname.match(/^\/poker\/tables\/([^/]+)\/history$/)?.[1];

    if (tableId) {
      return getVirtualTableRoute(tableId);
    }
  }

  if (
    pathname === "/clubs" ||
    pathname === getClubsNewRoute() ||
    pathname.startsWith("/clubs/join/")
  ) {
    return getClubRoute();
  }

  if (/^\/clubs\/[^/]+\/events\/[^/]+$/.test(pathname) || /^\/clubs\/[^/]+\/invite$/.test(pathname)) {
    const clubId = pathname.split("/")[2];

    if (clubId) {
      return getClubDashboardRoute(clubId);
    }
  }

  if (/^\/clubs\/[^/]+$/.test(pathname)) {
    return getClubRoute();
  }

  if (
    pathname === getCreateVirtualTableRoute() ||
    pathname === getJoinVirtualTableRoute() ||
    pathname.startsWith("/poker/join/") ||
    pathname === getVirtualLeaderboardRoute() ||
    pathname === getVirtualStatsRoute() ||
    pathname.startsWith("/poker/tables/")
  ) {
    return getVirtualLobbyRoute();
  }

  return getTelegramBackFallbackPath(pathname);
}

function createInitialHistoryState(): RebuyHistoryState {
  return {
    status: "idle",
    items: [],
    errorMessage: null
  };
}

function createInitialSettlementPreviewState(): SettlementPreviewState {
  return {
    status: "idle",
    data: null,
    errorMessage: null,
    draftKey: null
  };
}

async function refreshRoomState(
  accessToken: string,
  roomId: string,
  {
    setRoomState,
    setHistoryState,
    setHistoryLoading = false
  }: {
    setRoomState: Dispatch<SetStateAction<LoadState<GetRoomResponseDto>>>;
    setHistoryState: Dispatch<SetStateAction<RebuyHistoryState>>;
    setHistoryLoading?: boolean;
  }
): Promise<void> {
  const room = await getRoom(accessToken, roomId);

  setRoomState({
    status: "ready",
    data: room,
    errorMessage: null
  });

  if (room.room.status !== "RUNNING") {
    setHistoryState(createInitialHistoryState());
    return;
  }

  if (setHistoryLoading) {
    setHistoryState((current) => ({
      ...current,
      status: "loading",
      errorMessage: null
    }));
  }

  const history = await getRebuyHistory(accessToken, roomId);

  setHistoryState({
    status: "ready",
    items: history.rebuys,
    errorMessage: null
  });
}

function shouldPollRoomStatus(status: GetRoomResponseDto["room"]["status"] | undefined): boolean {
  return status === "WAITING" || status === "RUNNING" || status === "SETTLEMENT";
}

function createIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function areSettlementInputsEqual(
  current: Record<string, string>,
  next: Record<string, string>
): boolean {
  const currentKeys = Object.keys(current);
  const nextKeys = Object.keys(next);

  if (currentKeys.length !== nextKeys.length) {
    return false;
  }

  return nextKeys.every((key) => current[key] === next[key]);
}

async function copyToClipboard(value: string): Promise<void> {
  await navigator.clipboard?.writeText(value);
}

function shareInvite(roomTitle: string, inviteCode: string, inviteUrl: string): void {
  const shareText = [
    `Комната: ${roomTitle}`,
    `Код: ${inviteCode.toUpperCase()}`,
    "Открой бота или мини-приложение по ссылке и введи код."
  ].join("\n");
  const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(inviteUrl)}&text=${encodeURIComponent(shareText)}`;
  window.open(shareUrl, "_blank", "noopener,noreferrer");
}

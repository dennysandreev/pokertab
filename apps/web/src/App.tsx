import type { JSX } from "react";
import type { Dispatch, FormEvent, ReactNode, SetStateAction } from "react";
import { useEffect, useState } from "react";
import type {
  GetLeaderboardResponseDto,
  GetPlayerProfileResponseDto,
  GetRoomResponseDto,
  RebuyHistoryItemDto,
  RoomPlayerDto,
  RoomsListResponseDto,
  SettlementPreviewResponseDto
} from "@pokertable/shared";
import { formatMinorMoney } from "@pokertable/shared";
import { Link, Navigate, Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  ApiRequestError,
  cancelRebuy,
  closeSettlement,
  createRebuy,
  createRoom,
  getLeaderboard,
  getPlayerProfile,
  getRebuyHistory,
  getRoom,
  getRooms,
  joinRoom,
  previewSettlement,
  startRoom
} from "@/lib/api";
import {
  canUseBrowserBack,
  getTelegramBackFallbackPath,
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
  ActiveRoomAdmin,
  ActiveRoomPlayer,
  ClosedRoomResults,
  type RebuyHistoryState,
  SettlementInputScreen,
  WaitingRoom
} from "./features/rooms/room-screens";
import {
  getCreateRoomRoute,
  getHomeRoute,
  getJoinRoomRoute,
  getLeaderboardRoute,
  getPlayerRoute,
  getRoomRoute
} from "./features/rooms/routes";
import {
  canSelfRebuy,
  getActivePlayers,
  getRoomSurface,
  getSelfRebuyHint
} from "./features/rooms/room-view";
import {
  buildSettlementPreviewPayload,
  getInitialFinalAmountInput,
  getSettlementDraftKey,
  getSettlementDraftPlayers,
  getSettlementDraftSummary
} from "./features/rooms/settlement-view";
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
      amountMinor: string;
      isSelf: boolean;
    }
  | {
      kind: "cancel-rebuy";
      idempotencyKey: string;
      rebuyId: string;
      playerName: string;
      amountMinor: string;
    };

type RoomMode = "overview" | "settlement";

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

const cardClassName = "glass-card rounded-2xl bg-card p-4 shadow-panel";
const mutedCardClassName = "glass-card rounded-2xl bg-white/[0.02] p-4";
const inputClassName =
  "mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-surfaceHigher px-4 text-sm text-foreground outline-none transition placeholder:text-muted/60 focus:border-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const labelClassName = "text-sm font-medium text-foreground";
const secondaryButtonClassName =
  "border border-white/10 bg-surfaceHigh text-foreground shadow-none hover:bg-surfaceHigher";
const tertiaryButtonClassName =
  "border border-white/10 bg-transparent text-foreground shadow-none hover:bg-white/[0.03]";

export default function App(): JSX.Element {
  return (
    <div className="relative min-h-[100dvh] overflow-x-hidden bg-surface text-foreground">
      <div className="pointer-events-none fixed inset-x-0 top-0 z-0 h-[28rem] bg-[radial-gradient(circle_at_top,rgba(78,222,163,0.11),transparent_56%)]" />
      <div className="pointer-events-none fixed inset-y-0 right-[-7rem] z-0 w-[16rem] bg-[radial-gradient(circle,rgba(78,222,163,0.06),transparent_62%)] blur-3xl" />
      <LaunchInviteRedirect />
      <TelegramBackButtonSync />
      <AppChrome />
      <main
        className="relative z-10 flex w-full flex-col gap-5 px-4"
        style={{
          paddingTop: "calc(env(safe-area-inset-top) + 5.75rem)",
          paddingBottom: "calc(env(safe-area-inset-bottom) + 6.5rem)",
          minHeight: "100dvh"
        }}
      >
        <Routes>
          <Route path={getHomeRoute()} element={<HomeScreen />} />
          <Route path={getLeaderboardRoute()} element={<LeaderboardScreen />} />
          <Route path="/players/:userId" element={<PlayerProfileScreen />} />
          <Route path={getCreateRoomRoute()} element={<CreateRoomScreen />} />
          <Route path="/rooms/:roomId" element={<RoomScreen />} />
          <Route path="/join/:inviteCode" element={<JoinRoomScreen />} />
          <Route path="*" element={<Navigate to={getHomeRoute()} replace />} />
        </Routes>
      </main>
      <BottomNav />
    </div>
  );
}

function LaunchInviteRedirect(): JSX.Element | null {
  const { state } = useSession();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (
      state.inviteCode &&
      location.pathname === getHomeRoute() &&
      state.status === "authenticated"
    ) {
      void navigate(getJoinRoomRoute(state.inviteCode), { replace: true });
    }
  }, [location.pathname, navigate, state.inviteCode, state.status]);

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
      if (canUseBrowserBack()) {
        void navigate(-1);
        return;
      }

      void navigate(getTelegramBackFallbackPath(location.pathname), { replace: true });
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
  const navigate = useNavigate();
  const { state } = useSession();
  const isHome = location.pathname === getHomeRoute();
  const canGoBack = !isHome;
  const usesCompactHeader =
    location.pathname === getCreateRoomRoute() || location.pathname.startsWith("/rooms/");
  const userName = state.session?.user.firstName ?? state.session?.user.username ?? "игрок";
  const avatarUrl = state.session?.user.avatarUrl;

  function handleBack(): void {
    if (canUseBrowserBack()) {
      void navigate(-1);
      return;
    }

    void navigate(getTelegramBackFallbackPath(location.pathname), { replace: true });
  }

  return (
    <header
      className="fixed inset-x-0 top-0 z-40 border-b border-white/10 bg-[#141313]/88 backdrop-blur-xl"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div
        className={cn(
          "flex w-full items-center gap-3 px-4",
          usesCompactHeader ? "h-16" : "h-20"
        )}
      >
        {usesCompactHeader && canGoBack ? (
          <button
            aria-label="Назад"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-foreground transition hover:bg-white/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            onClick={handleBack}
            type="button"
          >
            <MaterialIcon icon="arrow_back_ios_new" />
          </button>
        ) : avatarUrl ? (
          <div className="h-12 w-12 overflow-hidden rounded-full border border-white/10 bg-surfaceHigher shadow-panel">
            <img alt="" className="h-full w-full object-cover" src={avatarUrl} />
          </div>
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-surfaceHigher text-accent shadow-panel">
            <MaterialIcon icon="playing_cards" />
          </div>
        )}

        {usesCompactHeader ? (
          <div className="min-w-0">
            <p className="truncate text-[1.1rem] font-semibold text-white">
              {getChromeSubtitle(location.pathname)}
            </p>
          </div>
        ) : (
          <div className="min-w-0">
            <h1 className="truncate font-display text-[2rem] font-bold leading-none text-white">
              Poker Table
            </h1>
            <p className="mt-1 truncate text-sm text-muted">
              {isHome ? `${getGreeting()}, ${userName}` : getChromeSubtitle(location.pathname)}
            </p>
          </div>
        )}
      </div>
    </header>
  );
}

function BottomNav(): JSX.Element {
  const location = useLocation();
  const { state } = useSession();
  const profileRoute = state.session?.user.id ? getPlayerRoute(state.session.user.id) : getHomeRoute();
  const gameRoute = getGamesRoute(location.pathname);
  const items = [
    { label: "Главная", icon: "home", href: getHomeRoute(), active: location.pathname === getHomeRoute() },
    { label: "Игры", icon: "style", href: gameRoute, active: isGamesRoute(location.pathname) },
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
      <div className="grid w-full grid-cols-4 gap-2 px-4 pb-1 pt-3">
        {items.map((item) => (
          <Link
            key={item.label}
            className={cn(
              "flex min-h-12 flex-col items-center justify-center rounded-xl px-2 py-2 text-[11px] font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
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
  const { bootstrap, state } = useSession();
  const [roomsState, setRoomsState] = useState<LoadState<RoomsListResponseDto>>({
    status: "idle",
    data: null,
    errorMessage: null
  });
  useEffect(() => {
    if (!state.accessToken) {
      setRoomsState({
        status: "idle",
        data: null,
        errorMessage: null
      });
      return;
    }

    let isCancelled = false;
    setRoomsState({
      status: "loading",
      data: null,
      errorMessage: null
    });

    void getRooms(state.accessToken)
      .then((data) => {
        if (isCancelled) {
          return;
        }

        setRoomsState({
          status: "ready",
          data,
          errorMessage: null
        });
      })
      .catch((error: unknown) => {
        if (isCancelled) {
          return;
        }

        setRoomsState({
          status: "error",
          data: null,
          errorMessage: getErrorMessage(error, "Не получилось загрузить игры")
        });
      });

    return () => {
      isCancelled = true;
    };
  }, [state.accessToken]);

  const activeRooms = roomsState.data?.active ?? [];
  const recentRooms = roomsState.data?.recent ?? [];
  const inviteRoute = state.inviteCode ? getJoinRoomRoute(state.inviteCode) : null;

  return (
    <ScreenLayout banner={getSessionBanner(state.status, state.errorMessage)}>
      <section className={cn(cardClassName, "relative overflow-hidden px-5 py-6")}>
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(78,222,163,0.09),transparent_45%)]" />
        <div className="absolute right-[-2.5rem] top-[-2.5rem] h-32 w-32 rounded-full bg-accent/10 blur-3xl" />
        <div className="relative space-y-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent/90">
              Ваш стол на вечер
            </p>
            <h2 className="mt-3 font-display text-[2rem] font-semibold leading-tight text-white">
              Создайте игру за минуту
            </h2>
            <p className="mt-3 max-w-[22rem] text-sm leading-6 text-muted">
              Задайте сумму ребая, позовите друзей и следите за результатом без лишних сообщений в чате.
            </p>
          </div>
          <div className="space-y-3">
            <Link className="block" to={getCreateRoomRoute()}>
              <Button className="w-full">
                <MaterialIcon icon="add_circle" />
                Создать стол
              </Button>
            </Link>
            {inviteRoute ? (
              <Link className="block" to={inviteRoute}>
                <Button className={cn("w-full", tertiaryButtonClassName)}>
                  <MaterialIcon icon="group_add" />
                  Перейти к приглашению
                </Button>
              </Link>
            ) : (
              <div className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-muted">
                Как только придёт приглашение в Telegram, мы покажем вход в игру прямо здесь.
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <SectionHeading
          action={
            <Link className="text-sm font-semibold text-accent" to={getCreateRoomRoute()}>
              Новый стол
            </Link>
          }
          title="Активные игры"
          description="Столы, к которым вы уже подключены."
        />

        {state.status === "error" ? (
          <Button className="w-full" onClick={() => void bootstrap()}>
            Попробовать снова
          </Button>
        ) : null}

        {roomsState.status === "loading" ? (
          <InfoCard
            title="Загружаем игры"
            description="Проверяем ваши столы и последние результаты."
          />
        ) : null}
        {roomsState.status === "error" ? (
          <InfoCard title="Пока не получилось" description={roomsState.errorMessage} />
        ) : null}
        {roomsState.status !== "loading" && activeRooms.length === 0 ? (
          <InfoCard
            title="Игр пока нет"
            description="Создайте первый стол или откройте приглашение от друга."
          />
        ) : null}
        {activeRooms.map((room) => (
          <Link key={room.id} to={getRoomRoute(room.id)}>
            <article className={cn(cardClassName, "border-l-4 border-l-accent px-5 py-5")}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[1.65rem] font-semibold leading-tight text-white">{room.title}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-accent" />
                    <span className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">
                      {getRoomStatusText(room.status)}
                    </span>
                  </div>
                </div>
                <span className="text-sm font-semibold text-foreground/85">
                  {room.playersCount} {getPlayersLabel(room.playersCount)}
                </span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 border-y border-white/5 py-4">
                <Metric label="Ребай" value={formatMinorMoney(room.rebuyAmountMinor, room.currency)} />
                <Metric
                  label="Ваши закупы"
                  value={formatMinorMoney(room.myBuyinsMinor, room.currency)}
                  valueClassName="text-accent"
                />
              </div>
              <div className="mt-4">
                <Button className={cn("w-full", secondaryButtonClassName)}>Открыть</Button>
              </div>
            </article>
          </Link>
        ))}
      </section>

      <section className="space-y-3">
        <SectionHeading
          action={<span className="text-sm font-semibold text-accent">Все</span>}
          title="Последние игры"
          description="Здесь появятся закрытые столы с вашим итогом."
        />
        {recentRooms.length === 0 ? (
          <InfoCard
            title="История пока пустая"
            description="Как только игра завершится, итог появится здесь."
          />
        ) : null}
        {recentRooms.map((room) => (
          <article key={room.id} className={cn(mutedCardClassName, "px-4 py-4")}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/5 bg-surfaceHigher text-muted">
                  <MaterialIcon icon="history" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xl font-semibold text-white">{room.title}</p>
                  <p className="mt-1 text-sm text-muted">
                    {room.closedAt ? `Закрыта ${formatDate(room.closedAt)}` : "Игра завершена"}
                  </p>
                </div>
              </div>
              <p className={cn("text-xl font-semibold", getResultColorClass(room.myNetResultMinor ?? "0"))}>
                {formatMinorMoney(room.myNetResultMinor ?? "0", room.currency)}
              </p>
            </div>
          </article>
        ))}
      </section>
    </ScreenLayout>
  );
}

function LeaderboardScreen(): JSX.Element {
  const { state } = useSession();
  const [scope, setScope] = useState(DEFAULT_LEADERBOARD_QUERY.scope);
  const [period, setPeriod] = useState(DEFAULT_LEADERBOARD_QUERY.period);
  const [leaderboardState, setLeaderboardState] = useState<LoadState<GetLeaderboardResponseDto>>({
    status: "idle",
    data: null,
    errorMessage: null
  });

  useEffect(() => {
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
  }, [period, scope, state.accessToken]);

  const items = leaderboardState.data?.items ?? [];
  const emptyCopy = getLeaderboardEmptyCopy(scope);
  const topPlayers = items.slice(0, 3);
  const remainingPlayers = items.slice(3);

  if (!state.accessToken) {
    return (
      <ScreenLayout
        banner={getSessionBanner(state.status, state.errorMessage)}
      >
        <InfoCard
          title="Нужен вход через Telegram"
          description="После авторизации здесь появится общий рейтинг и список игроков, с которыми вы уже играли."
        />
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout>
      <section className="space-y-2 pt-1">
        <h2 className="font-display text-[2.25rem] font-semibold leading-tight text-white">
          Лидерборд
        </h2>
        <p className="text-base leading-7 text-muted">
          Сравнивайте форму игроков по завершённым столам.
        </p>
      </section>

      <section className={`${cardClassName} space-y-4`}>
        <div className="grid grid-cols-2 gap-2">
          {LEADERBOARD_SCOPE_OPTIONS.map((option) => (
            <button
              key={option.value}
              className={getFilterButtonClass(scope === option.value)}
              onClick={() => setScope(option.value)}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
        <p className="text-sm italic leading-6 text-muted">{getScopeDescription(scope)}</p>
        <div className="flex flex-wrap gap-2">
          {LEADERBOARD_PERIOD_OPTIONS.map((option) => (
            <button
              key={option.value}
              className={getFilterButtonClass(period === option.value, "px-3")}
              onClick={() => setPeriod(option.value)}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
      </section>

      {leaderboardState.status === "loading" ? (
        <InfoCard
          title="Собираем рейтинг"
          description="Считаем Poker Score и обновляем показатели по выбранному периоду."
        />
      ) : null}

      {leaderboardState.status === "error" ? (
        <InfoCard title="Пока не получилось" description={leaderboardState.errorMessage} />
      ) : null}

      {leaderboardState.status === "ready" && items.length === 0 ? (
        <InfoCard title={emptyCopy.title} description={emptyCopy.description} />
      ) : null}

      {topPlayers.length > 0 ? (
        <section className="grid grid-cols-3 gap-3">
          {topPlayers.map((player, index) => {
            const highlight = index === 0;

            return (
              <Link key={player.userId} to={getPlayerRoute(player.userId)}>
                <article
                  className={cn(
                    cardClassName,
                    "flex h-full flex-col items-center justify-end px-3 py-4 text-center",
                    highlight && "border-accent/40 bg-[linear-gradient(180deg,rgba(78,222,163,0.12),rgba(26,26,26,0.85))]"
                  )}
                >
                  <div
                    className={cn(
                      "flex h-12 w-12 items-center justify-center rounded-full border bg-surfaceHigher text-sm font-semibold text-white",
                      highlight ? "border-accent text-accent" : "border-white/10"
                    )}
                  >
                    {player.rank}
                  </div>
                  <p className={cn("mt-3 text-sm font-semibold", highlight ? "text-accent" : "text-white")}>
                    {player.displayName}
                  </p>
                  <p className={cn("mt-2 text-[1.1rem] font-semibold", getToneClass(player.totalProfitMinor))}>
                    {formatSignedMinorStat(player.totalProfitMinor)}
                  </p>
                  <div className="mt-3 space-y-1 text-xs text-muted">
                    <p>ROI {formatPercentFromBps(player.roiBps)}</p>
                    <p>
                      <span className="text-base font-semibold text-white">{player.pokerScore}</span> PS
                    </p>
                  </div>
                </article>
              </Link>
            );
          })}
        </section>
      ) : null}

      {remainingPlayers.length > 0 ? (
        <section className="space-y-3">
          <div className="grid grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)_minmax(0,0.8fr)] gap-3 px-2 text-[11px] uppercase tracking-[0.18em] text-muted">
            <span>Игрок</span>
            <span className="text-right">Профит</span>
            <span className="text-right">Score</span>
          </div>
          {remainingPlayers.map((player) => (
            <Link key={player.userId} to={getPlayerRoute(player.userId)}>
              <article
                className={cn(
                  mutedCardClassName,
                  "grid grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)_minmax(0,0.8fr)] items-center gap-3 px-4 py-4",
                  player.userId === state.session?.user.id &&
                    "border-accent/40 bg-[linear-gradient(180deg,rgba(78,222,163,0.08),rgba(26,26,26,0.8))]"
                )}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-surfaceHigher text-sm font-semibold text-white">
                    {player.rank}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-lg font-semibold text-white">{player.displayName}</p>
                    <p className="text-xs text-muted">
                      {formatPercentFromBps(player.roiBps)} ROI • {formatPercentFromBps(player.winRateBps)} побед
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={cn("text-lg font-semibold", getToneClass(player.totalProfitMinor))}>
                    {formatSignedMinorStat(player.totalProfitMinor)}
                  </p>
                  <p className="text-xs text-muted">{player.gamesCount} {getGamesLabel(player.gamesCount)}</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-semibold text-white">{player.pokerScore}</p>
                </div>
              </article>
            </Link>
          ))}
        </section>
      ) : null}
    </ScreenLayout>
  );
}

function PlayerProfileScreen(): JSX.Element {
  const { userId = "" } = useParams();
  const { state } = useSession();
  const [profileState, setProfileState] = useState<LoadState<GetPlayerProfileResponseDto>>({
    status: "idle",
    data: null,
    errorMessage: null
  });
  const [isAccessDenied, setIsAccessDenied] = useState(false);

  useEffect(() => {
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
  }, [state.accessToken, userId]);

  if (!state.accessToken) {
    return (
      <ScreenLayout
        title="Профиль игрока"
        subtitle="Статистика доступна после входа через Telegram."
        backTo={getLeaderboardRoute()}
        banner={getSessionBanner(state.status, state.errorMessage)}
      >
        <InfoCard
          title="Нужен вход через Telegram"
          description="После авторизации здесь будут показатели игрока и его последние завершённые игры."
        />
      </ScreenLayout>
    );
  }

  if (profileState.status === "loading" || profileState.status === "idle") {
    return (
      <ScreenLayout
        title="Профиль игрока"
        subtitle="Собираем статистику по завершённым играм."
        backTo={getLeaderboardRoute()}
      >
        <InfoCard
          title="Открываем профиль"
          description="Ещё немного, и покажем форму игрока и последние результаты."
        />
      </ScreenLayout>
    );
  }

  if (profileState.status === "error") {
    return (
      <ScreenLayout
        title={isAccessDenied ? "Профиль закрыт" : "Профиль игрока"}
        subtitle={
          isAccessDenied
            ? "Подробная статистика доступна только игрокам с общими завершёнными столами."
            : "Пока не удалось загрузить статистику игрока."
        }
        backTo={getLeaderboardRoute()}
      >
        <InfoCard
          title={isAccessDenied ? "Пока доступ закрыт" : "Не получилось"}
          description={profileState.errorMessage}
        />
      </ScreenLayout>
    );
  }

  const profile = profileState.data;

  if (!profile) {
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

  const { recentGames, stats, user } = profile;

  return (
    <ScreenLayout>
      <section className="grid grid-cols-[minmax(0,1fr)_minmax(8rem,11rem)] gap-4">
        <div className="min-w-0">
          <h2 className="truncate font-display text-[2.4rem] font-semibold leading-none text-white">
            {user.displayName}
          </h2>
          <p className="mt-3 text-[1.1rem] text-muted">
            {user.username ? `@${user.username}` : "Показатели по завершённым играм"}
          </p>
        </div>
        <div className={cn(cardClassName, "flex flex-col justify-center px-4 py-4")}>
          <p className="text-xs uppercase tracking-[0.18em] text-muted">Poker Score</p>
          <p className="mt-3 font-display text-[3rem] font-semibold leading-none text-accent">
            {stats.pokerScore}
          </p>
        </div>
      </section>

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

      <section className={cn(cardClassName, "space-y-4")}>
        <h3 className="text-[1.9rem] font-semibold text-white">Последние результаты</h3>
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
        <StatRow label="Средний результат" value={formatSignedMinorStat(stats.avgProfitMinor)} valueClassName={getToneClass(stats.avgProfitMinor)} />
        <StatRow label="Стабильность" value={formatPercentFromBps(stats.stabilityScoreBps)} />
      </section>

      <section className="space-y-3">
        <SectionHeading
          title="Последние игры"
          description="Здесь собраны недавние завершённые столы этого игрока."
        />
        {recentGames.length === 0 ? (
          <InfoCard
            title="Пока без истории"
            description="Как только у игрока появятся завершённые игры, они появятся здесь."
          />
        ) : null}
        {recentGames.map((game: GetPlayerProfileResponseDto["recentGames"][number]) => (
          <article key={game.roomId} className={cn(mutedCardClassName, "px-4 py-4")}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-xl font-semibold text-white">{game.title}</p>
                <p className="mt-1 text-sm text-muted">{formatDate(game.closedAt)}</p>
              </div>
              <span className="rounded-full border border-white/10 bg-surfaceHigher px-3 py-1 text-xs text-muted">
                {game.playersCount} {getPlayersLabel(game.playersCount)}
              </span>
            </div>
            <p className="mt-3 text-sm">
              Результат:{" "}
              <span className={getToneClass(game.myNetResultMinor)}>
                {formatMinorMoney(game.myNetResultMinor, game.currency)}
              </span>
            </p>
          </article>
        ))}
      </section>
    </ScreenLayout>
  );
}

function CreateRoomScreen(): JSX.Element {
  const navigate = useNavigate();
  const { state } = useSession();
  const [values, setValues] = useState<CreateRoomFormValues>({
    title: "",
    currency: "RUB",
    rebuyAmount: "",
    startingStack: "",
    rebuyPermission: "PLAYER_SELF"
  });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canSubmit = state.status === "authenticated" && !!state.accessToken;

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    const validationMessage = getCreateRoomValidationMessage(values);
    const payload = buildCreateRoomPayload(values);

    if (validationMessage || !payload) {
      setErrorMessage(validationMessage ?? "Проверьте сумму ребая и стартовый стек");
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
      void navigate(getRoomRoute(response.room.id));
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Не получилось создать стол"));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <ScreenLayout banner={state.status === "unsupported" ? getSessionBanner(state.status, null) : null}>
      <section className={cn(cardClassName, "relative overflow-hidden px-4 py-4")}>
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(78,222,163,0.08),transparent_55%)]" />
        <div className="relative">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">Настройка стола</p>
          <h2 className="mt-2 text-[1.8rem] font-semibold text-white">Новая игра</h2>
        </div>
      </section>

      <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
        <Field label="Как назовём игру?">
          <input
            className={inputClassName}
            maxLength={ROOM_TITLE_MAX_LENGTH}
            value={values.title}
            onChange={(event) => setValues((current) => ({ ...current, title: event.target.value }))}
            placeholder="Например, Пятничный покер"
          />
        </Field>

        <Field label="В какой валюте считаем?">
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
            Сумма ребая
          </p>
          <div className="mt-4 flex items-end justify-between gap-3">
            <input
              className="w-full bg-transparent text-[2.3rem] font-semibold leading-none text-white outline-none placeholder:text-white/25"
              inputMode="decimal"
              value={values.rebuyAmount}
              onChange={(event) =>
                setValues((current) => ({ ...current, rebuyAmount: event.target.value }))
              }
              placeholder="1000"
            />
            <span className="pb-1 text-[1.8rem] font-semibold text-accent">
              {getCurrencySymbol(values.currency)}
            </span>
          </div>
          <p className="mt-3 text-sm leading-6 text-muted">Фиксированная сумма для каждого нового ребая.</p>
        </section>

        <Field label="Стартовый стек">
          <input
            className={inputClassName}
            inputMode="numeric"
            value={values.startingStack}
            onChange={(event) =>
              setValues((current) => ({ ...current, startingStack: event.target.value }))
            }
            placeholder="Например, 10000"
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

        <section className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
          <p className="text-sm font-semibold text-white">Что получится</p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Metric label="Ребай" value={values.rebuyAmount.trim() || "Не задан"} />
            <Metric label="Стек" value={values.startingStack.trim() || "Не задан"} />
            <Metric label="Валюта" value={getCurrencyLabel(values.currency)} />
            <Metric label="Режим" value={getRebuyPermissionLabel(values.rebuyPermission)} />
          </div>
        </section>

        {errorMessage ? (
          <p className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {errorMessage}
          </p>
        ) : null}

        <Button className="w-full" disabled={isSubmitting || !canSubmit} type="submit">
          {isSubmitting ? "Создаём стол" : "Создать стол"}
        </Button>
      </form>
    </ScreenLayout>
  );
}

function RoomScreen(): JSX.Element {
  const { roomId = "" } = useParams();
  const { state } = useSession();
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

    const activePlayers = getActivePlayers(roomData.players);

    setSettlementDraftValues((current) => {
      const nextValues: Record<string, string> = {};

      for (const player of activePlayers) {
        nextValues[player.id] = current[player.id] ?? getInitialFinalAmountInput(player.finalAmountMinor);
      }

      return areSettlementInputsEqual(current, nextValues) ? current : nextValues;
    });
  }, [roomState.data]);

  useEffect(() => {
    if (!state.accessToken || !roomId || roomState.data?.room.status !== "RUNNING") {
      return;
    }

    const accessToken = state.accessToken;
    let isCancelled = false;
    const intervalId = window.setInterval(() => {
      void Promise.all([getRoom(accessToken, roomId), getRebuyHistory(accessToken, roomId)])
        .then(([data, history]) => {
          if (isCancelled) {
            return;
          }

          setRoomState({
            status: "ready",
            data,
            errorMessage: null
          });
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
      await refreshRoomState(state.accessToken, roomId, {
        setHistoryLoading: true,
        setRoomState,
        setHistoryState
      });
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
      amountMinor: roomData.room.rebuyAmountMinor,
      isSelf: true
    });
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
      amountMinor: roomState.data.room.rebuyAmountMinor,
      isSelf: player.id === roomState.data.room.myPlayerId
    });
  }

  function handleOpenCancelRebuy(rebuy: RebuyHistoryItemDto): void {
    setConfirmationState({
      kind: "cancel-rebuy",
      idempotencyKey: createIdempotencyKey(),
      rebuyId: rebuy.id,
      playerName: rebuy.playerName,
      amountMinor: rebuy.amountMinor
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
      await refreshRoomState(state.accessToken, roomId, {
        setRoomState,
        setHistoryState
      });
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
    settlementPreviewState.data.differenceMinor === "0" &&
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
          onCopyInvite={() => void copyToClipboard(room.inviteUrl)}
          onShareInvite={() => shareInvite(room.inviteUrl)}
          onStart={() => void handleStart()}
        />
      ) : null}

      {roomSurface === "active-player" ? (
        <ActiveRoomPlayer
          canSelfRebuy={canSelfRebuy(room)}
          data={roomState.data!}
          historyState={historyState}
          isCreatingSelfRebuy={isSelfRebuyPending}
          isHistoryOpen={isHistoryOpen}
          selfRebuyHint={getSelfRebuyHint(room)}
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
          onAddRebuy={handleOpenAdminRebuy}
          onCancelRebuy={handleOpenCancelRebuy}
          onOpenSettlement={() => setRoomMode("settlement")}
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
    </ScreenLayout>
  );
}

function JoinRoomScreen(): JSX.Element {
  const navigate = useNavigate();
  const { inviteCode = "" } = useParams();
  const { state } = useSession();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
        inviteCode
      });
      void navigate(getRoomRoute(response.roomId));
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Не получилось присоединиться к игре"));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <ScreenLayout banner={getSessionBanner(state.status, state.errorMessage)}>
      <section className="flex min-h-[calc(100dvh-12rem)] flex-col justify-center gap-5 pb-4 text-center">
        <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-full border-2 border-accent bg-[radial-gradient(circle,rgba(78,222,163,0.14),rgba(18,18,18,0.95))] text-white shadow-glow">
          <span className="font-display text-[2rem] font-semibold">
            {getInviteInitials(inviteCode)}
          </span>
        </div>
        <div className="space-y-3">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-accent">
            Приглашение в игру
          </p>
          <h2 className="font-display text-[2.5rem] font-semibold leading-tight text-white">
            Готовы присоединиться?
          </h2>
          <p className="mx-auto max-w-[20rem] text-base leading-7 text-muted">
            Добавим вас к столу по коду приглашения и сразу откроем текущую игру.
          </p>
        </div>

        <section className="grid grid-cols-2 gap-3">
          <Metric className={cardClassName} label="Код" value={inviteCode.toUpperCase()} />
          <Metric className={cardClassName} label="Статус" value="Ожидает входа" />
        </section>

        {errorMessage ? (
          <p className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {errorMessage}
          </p>
        ) : null}

        <div className="space-y-3">
          <Button className="w-full" disabled={isSubmitting} onClick={() => void handleJoin()}>
            <MaterialIcon icon="login" />
            {isSubmitting ? "Подключаем стол" : "Присоединиться к игре"}
          </Button>
          {state.status === "unsupported" ? (
            <p className="text-sm leading-6 text-muted">
              Для реального входа откройте эту ссылку в Telegram Mini App.
            </p>
          ) : null}
        </div>
      </section>
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

  const amountText = formatMinorMoney(confirmationState.amountMinor, currency);
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
    <div className="fixed inset-0 z-50 flex items-end bg-black/70 px-4 pb-4 pt-10 sm:items-center sm:justify-center">
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

function SectionHeading({
  title,
  description,
  action
}: {
  title: string;
  description: string;
  action?: ReactNode;
}): JSX.Element {
  return (
    <div className="flex items-end justify-between gap-3">
      <div>
        <h2 className="font-display text-[2rem] font-semibold leading-tight text-white">{title}</h2>
        <p className="mt-1 text-sm text-muted">{description}</p>
      </div>
      {action}
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

function getFilterButtonClass(isActive: boolean, sizeClassName = "px-4"): string {
  return cn(
    "inline-flex min-h-12 items-center justify-center rounded-xl border text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
    sizeClassName,
    isActive
      ? "border-accent bg-accent text-[#032517]"
      : "border-white/10 bg-surfaceHigh text-foreground hover:bg-surfaceHigher"
  );
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

function getGreeting(): string {
  const hour = new Date().getHours();

  if (hour < 6) {
    return "Доброй ночи";
  }

  if (hour < 12) {
    return "Доброе утро";
  }

  if (hour < 18) {
    return "Добрый день";
  }

  return "Добрый вечер";
}

function getChromeSubtitle(pathname: string): string {
  if (pathname === getLeaderboardRoute()) {
    return "Рейтинг игроков";
  }

  if (pathname === getCreateRoomRoute()) {
    return "Новый стол";
  }

  if (pathname.startsWith("/join/")) {
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

function isGamesRoute(pathname: string): boolean {
  return (
    pathname === getCreateRoomRoute() ||
    pathname.startsWith("/join/") ||
    pathname.startsWith("/rooms/")
  );
}

function getGamesRoute(pathname: string): string {
  return isGamesRoute(pathname) ? pathname : getCreateRoomRoute();
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

function getScopeDescription(scope: (typeof DEFAULT_LEADERBOARD_QUERY)["scope"]): string {
  return scope === "played-with-me"
    ? "Игроки, с которыми у вас уже был хотя бы один общий завершённый стол."
    : "Общий рейтинг по завершённым играм внутри Poker Table.";
}

function getCurrencySymbol(currency: string): string {
  switch (currency.toUpperCase()) {
    case "USD":
      return "$";
    case "EUR":
      return "€";
    default:
      return "₽";
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

function shareInvite(inviteUrl: string): void {
  const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(inviteUrl)}`;
  window.open(shareUrl, "_blank", "noopener,noreferrer");
}

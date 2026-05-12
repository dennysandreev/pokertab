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

const cardClassName = "rounded-lg border border-border bg-card p-4";
const mutedCardClassName = "rounded-lg border border-border bg-background/50 p-4";
const inputClassName =
  "mt-2 h-11 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none transition focus:border-accent";
const selectClassName = inputClassName;
const labelClassName = "text-sm font-medium text-foreground";

export default function App(): JSX.Element {
  return (
    <main
      className="min-h-screen bg-background px-4 text-foreground"
      style={{
        paddingTop: "max(1.25rem, env(safe-area-inset-top))",
        paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))"
      }}
    >
      <div className="mx-auto flex w-full max-w-md flex-col gap-4 pb-8">
        <LaunchInviteRedirect />
        <TelegramBackButtonSync />
        <Routes>
          <Route path={getHomeRoute()} element={<HomeScreen />} />
          <Route path={getLeaderboardRoute()} element={<LeaderboardScreen />} />
          <Route path="/players/:userId" element={<PlayerProfileScreen />} />
          <Route path={getCreateRoomRoute()} element={<CreateRoomScreen />} />
          <Route path="/rooms/:roomId" element={<RoomScreen />} />
          <Route path="/join/:inviteCode" element={<JoinRoomScreen />} />
          <Route path="*" element={<Navigate to={getHomeRoute()} replace />} />
        </Routes>
      </div>
    </main>
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

function HomeScreen(): JSX.Element {
  const { bootstrap, state } = useSession();
  const [roomsState, setRoomsState] = useState<LoadState<RoomsListResponseDto>>({
    status: "idle",
    data: null,
    errorMessage: null
  });
  const userName = state.session?.user.firstName ?? state.session?.user.username ?? "друг";

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

  return (
    <ScreenLayout
      title="Игры"
      subtitle={`Привет, ${userName}`}
      banner={getSessionBanner(state.status, state.errorMessage)}
    >
      <section className={cardClassName}>
        <p className="text-base font-semibold">Создать покерный стол</p>
        <p className="mt-2 text-sm leading-6 text-muted">
          Задайте ребай, пригласите друзей и спокойно ведите игру в одном месте.
        </p>
        <Link className="mt-4 block" to={getCreateRoomRoute()}>
          <Button className="w-full">Создать стол</Button>
        </Link>
      </section>

      <section className={cardClassName}>
        <p className="text-base font-semibold">Рейтинг игроков</p>
        <p className="mt-2 text-sm leading-6 text-muted">
          Сравните Poker Score, прибыль и стабильность по завершённым играм.
        </p>
        <Link className="mt-4 block" to={getLeaderboardRoute()}>
          <Button className="w-full border border-border bg-background/60 text-foreground">
            Открыть рейтинг
          </Button>
        </Link>
      </section>

      {state.status === "error" ? (
        <Button className="w-full" onClick={() => void bootstrap()}>
          Попробовать снова
        </Button>
      ) : null}

      <section className="space-y-3">
        <SectionHeading
          title="Активные игры"
          description="Здесь будут столы, к которым вы уже присоединились."
        />
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
            <article className={mutedCardClassName}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-base font-semibold">{room.title}</p>
                  <p className="mt-1 text-sm text-muted">{getRoomStatusText(room.status)}</p>
                </div>
                <span className="rounded-full bg-background px-3 py-1 text-xs text-muted">
                  {room.playersCount} игроков
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-sm text-muted">
                <Metric label="Ребай" value={formatMinorMoney(room.rebuyAmountMinor, room.currency)} />
                <Metric label="Твои закупы" value={formatMinorMoney(room.myBuyinsMinor, room.currency)} />
              </div>
            </article>
          </Link>
        ))}
      </section>

      <section className="space-y-3">
        <SectionHeading
          title="Последние игры"
          description="Здесь появятся закрытые столы с вашим результатом."
        />
        {recentRooms.length === 0 ? (
          <InfoCard
            title="История пока пустая"
            description="Как только игра завершится, итог появится здесь."
          />
        ) : null}
        {recentRooms.map((room) => (
          <article key={room.id} className={mutedCardClassName}>
            <p className="text-base font-semibold">{room.title}</p>
            <p className="mt-1 text-sm text-muted">
              {room.closedAt ? `Завершена ${formatDate(room.closedAt)}` : "Игра завершена"}
            </p>
            <p className="mt-3 text-sm">
              Результат:{" "}
              <span className={getResultColorClass(room.myNetResultMinor ?? "0")}>
                {formatMinorMoney(room.myNetResultMinor ?? "0", room.currency)}
              </span>
            </p>
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

  if (!state.accessToken) {
    return (
      <ScreenLayout
        title="Рейтинг игроков"
        subtitle="Статистика доступна после входа через Telegram."
        backTo={getHomeRoute()}
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
    <ScreenLayout
      title="Рейтинг игроков"
      subtitle="Сравнивайте форму игроков по завершённым играм."
      backTo={getHomeRoute()}
    >
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

      {items.length > 0 ? (
        <section className="space-y-3">
          {items.map((player) => (
            <Link key={player.userId} to={getPlayerRoute(player.userId)}>
              <article className={mutedCardClassName}>
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-card text-sm font-semibold text-foreground">
                    {player.rank}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-base font-semibold">{player.displayName}</p>
                        <p className="mt-1 text-sm text-muted">
                          {player.gamesCount} {getGamesLabel(player.gamesCount)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs uppercase tracking-wide text-muted">Poker Score</p>
                        <p className="mt-1 text-lg font-semibold">{player.pokerScore}</p>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                      <Metric
                        label="Прибыль"
                        value={formatSignedMinorStat(player.totalProfitMinor)}
                        valueClassName={getToneClass(player.totalProfitMinor)}
                      />
                      <Metric label="ROI" value={formatPercentFromBps(player.roiBps)} />
                      <Metric label="Победы" value={formatPercentFromBps(player.winRateBps)} />
                      <Metric
                        label="Стабильность"
                        value={formatPercentFromBps(player.stabilityScoreBps)}
                      />
                    </div>
                  </div>
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
    <ScreenLayout
      title={user.displayName}
      subtitle={user.username ? `@${user.username}` : "Показатели по завершённым играм"}
      backTo={getLeaderboardRoute()}
    >
      <section className={`${cardClassName} space-y-4`}>
        <div className="grid grid-cols-2 gap-3">
          <Metric label="Poker Score" value={String(stats.pokerScore)} />
          <Metric label="Игр" value={String(stats.gamesCount)} />
          <Metric
            label="Общая прибыль"
            value={formatSignedMinorStat(stats.totalProfitMinor)}
            valueClassName={getToneClass(stats.totalProfitMinor)}
          />
          <Metric label="ROI" value={formatPercentFromBps(stats.roiBps)} />
          <Metric label="Победы" value={formatPercentFromBps(stats.winRateBps)} />
          <Metric label="Стабильность" value={formatPercentFromBps(stats.stabilityScoreBps)} />
          <Metric
            label="Средний результат"
            value={formatSignedMinorStat(stats.avgProfitMinor)}
            valueClassName={getToneClass(stats.avgProfitMinor)}
          />
          <Metric
            label="Лучшая игра"
            value={formatSignedMinorStat(stats.bestGameMinor)}
            valueClassName={getToneClass(stats.bestGameMinor)}
          />
        </div>
        <div className="border-t border-border pt-4">
          <Metric
            label="Самая сложная игра"
            value={formatSignedMinorStat(stats.worstGameMinor)}
            valueClassName={getToneClass(stats.worstGameMinor)}
          />
        </div>
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
          <article key={game.roomId} className={mutedCardClassName}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-base font-semibold">{game.title}</p>
                <p className="mt-1 text-sm text-muted">{formatDate(game.closedAt)}</p>
              </div>
              <span className="rounded-full bg-card px-3 py-1 text-xs text-muted">
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
    <ScreenLayout
      title="Создать стол"
      subtitle="Подготовьте игру и сразу получите ссылку для приглашения."
      backTo={getHomeRoute()}
      banner={state.status === "unsupported" ? getSessionBanner(state.status, null) : null}
    >
      <form className={`${cardClassName} space-y-4`} onSubmit={(event) => void handleSubmit(event)}>
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
          <select
            className={selectClassName}
            value={values.currency}
            onChange={(event) =>
              setValues((current) => ({ ...current, currency: event.target.value }))
            }
          >
            <option value="RUB">Рубли</option>
            <option value="USD">Доллары</option>
            <option value="EUR">Евро</option>
          </select>
        </Field>

        <Field label="Сколько стоит один ребай?">
          <input
            className={inputClassName}
            inputMode="decimal"
            value={values.rebuyAmount}
            onChange={(event) =>
              setValues((current) => ({ ...current, rebuyAmount: event.target.value }))
            }
            placeholder="Например, 1000"
          />
        </Field>

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

        <Field label="Кто может добавлять ребаи">
          <select
            className={selectClassName}
            value={values.rebuyPermission}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                rebuyPermission: event.target.value as CreateRoomFormValues["rebuyPermission"]
              }))
            }
          >
            <option value="PLAYER_SELF">Игроки могут добавлять себе</option>
            <option value="ADMIN_APPROVAL">Через админа</option>
            <option value="ADMIN_ONLY">Только админ</option>
          </select>
        </Field>

        {errorMessage ? (
          <p className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
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
    <ScreenLayout
      title={room.title}
      subtitle={getRoomScreenSubtitle(roomSurface)}
      backTo={getHomeRoute()}
    >
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
    <ScreenLayout
      title="Вас пригласили в игру"
      subtitle="После входа добавим вас в список игроков и откроем стол."
      backTo={getHomeRoute()}
      banner={getSessionBanner(state.status, state.errorMessage)}
    >
      <section className={`${cardClassName} space-y-3`}>
        <div>
          <p className="text-sm text-muted">Код приглашения</p>
          <p className="mt-2 text-lg font-semibold">{inviteCode}</p>
        </div>
        <p className="text-sm leading-6 text-muted">
          Если вы уже в игре, просто откроем стол. Если нет, добавим вас одним нажатием.
        </p>
        {errorMessage ? (
          <p className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
            {errorMessage}
          </p>
        ) : null}
        <Button className="w-full" disabled={isSubmitting} onClick={() => void handleJoin()}>
          {isSubmitting ? "Подключаем стол" : "Присоединиться"}
        </Button>
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
  title: string;
  subtitle: string;
  backTo?: string;
  banner?: JSX.Element | null;
  children: ReactNode;
}): JSX.Element {
  return (
    <>
      <header className="space-y-3 pt-2">
        {backTo ? (
          <Link className="inline-flex text-sm text-muted" to={backTo}>
            Назад
          </Link>
        ) : null}
        <div>
          <h1 className="text-3xl font-semibold">{title}</h1>
          <p className="mt-2 text-sm leading-6 text-muted">{subtitle}</p>
        </div>
      </header>
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
    <section className={mutedCardClassName}>
      <p className="text-base font-semibold">{title}</p>
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
    <div className="fixed inset-0 z-50 flex items-end bg-black/60 px-4 pb-4 pt-10 sm:items-center sm:justify-center">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-4 shadow-2xl">
        <p className="text-lg font-semibold">{title}</p>
        <p className="mt-2 text-sm leading-6 text-muted">{description}</p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Button className="border border-border bg-background/60 text-foreground" disabled={isPending} onClick={onCancel}>
            Пока нет
          </Button>
          <Button disabled={isPending} onClick={onConfirm}>
            {isPending ? pendingLabel : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

function SectionHeading({
  title,
  description
}: {
  title: string;
  description: string;
}): JSX.Element {
  return (
    <div>
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-muted">{description}</p>
    </div>
  );
}

function Metric({
  label,
  value,
  valueClassName
}: {
  label: string;
  value: string;
  valueClassName?: string;
}): JSX.Element {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className={cn("mt-1 text-sm font-medium text-foreground", valueClassName)}>{value}</p>
    </div>
  );
}

function getSessionBanner(
  status: string,
  errorMessage: string | null
): JSX.Element | null {
  if (status === "unsupported") {
    return (
      <section className="rounded-lg border border-dashed border-border bg-background/50 p-4">
        <p className="text-sm font-medium">Режим просмотра в браузере</p>
        <p className="mt-2 text-sm leading-6 text-muted">
          Интерфейс можно посмотреть и проверить локально, но приватные действия работают
          только после запуска Mini App в Telegram.
        </p>
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

function getRoomScreenSubtitle(surface: ReturnType<typeof getRoomSurface>): string {
  switch (surface) {
    case "waiting":
      return "Ожидание игроков";
    case "active-admin":
      return "Активный стол";
    case "active-player":
      return "Игра уже идёт";
    case "closed":
      return "Финальные результаты";
    default:
      return "Статус игры";
  }
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
    "inline-flex min-h-11 items-center justify-center rounded-md border text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
    sizeClassName,
    isActive
      ? "border-accent bg-accent text-slate-950"
      : "border-border bg-background/60 text-foreground hover:bg-background"
  );
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

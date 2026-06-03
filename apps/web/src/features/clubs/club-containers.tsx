import { useCallback, useEffect, useState, type JSX } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { IllustratedPanel, VisualEmptyState } from "@/components/visual";
import {
  cancelClubEvent,
  createClub,
  createClubInviteLink,
  deleteClub,
  getClub,
  getClubEvent,
  getClubEvents,
  getClubJoinPreview,
  getClubMembers,
  joinClub,
  sendClubEventReminder,
  updateClub,
  updateClubEventRsvp,
  updateClubMember
} from "@/lib/api";
import { useSession } from "@/session/session-context";
import { getCreateRoomRoute, getRoomRoute } from "../rooms/routes";
import { resolveMiniAppVisual } from "../visual/mini-app-visuals";
import { getVirtualTableRoute, getCreateVirtualTableRoute } from "../virtual/routes";
import { useClubsList } from "./club-data";
import {
  ClubDashboardScreen,
  ClubEventDetailsScreen,
  ClubInviteScreen,
  ClubsHomeScreen,
  CreateClubScreen,
  JoinClubScreen
} from "./club-screens";
import {
  getClubDashboardRoute,
  getClubEventRoute,
  getClubInviteRoute,
  getClubJoinRoute,
  getClubsNewRoute
} from "./routes";
import type {
  ClubEventListItemDto,
  ClubEventRsvpStatus,
  ClubMemberDto,
  ClubMemberRole,
  ClubSummaryDto,
  GetClubDashboardResponseDto,
  GetClubEventDetailsResponseDto
} from "./types";

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

type ClubDashboardBundle = {
  dashboard: GetClubDashboardResponseDto;
  members: ClubMemberDto[];
  upcomingEvents: ClubEventListItemDto[];
  historyEvents: ClubEventListItemDto[];
};

type ClubsHomeEventsBundle = {
  upcomingEvents: Array<{
    club: ClubSummaryDto;
    event: ClubEventListItemDto;
  }>;
  historyEvents: Array<{
    club: ClubSummaryDto;
    event: ClubEventListItemDto;
  }>;
};

const DEFAULT_CLUB_FORM = {
  name: "",
  description: "",
  defaultCurrency: "RUB"
};
const EMPTY_CLUBS: ClubSummaryDto[] = [];

export function ClubsHomeContainer(): JSX.Element {
  const navigate = useNavigate();
  const { state } = useSession();
  const { clubsState, refreshClubs } = useClubsList();
  const [eventsState, setEventsState] = useState<AsyncState<ClubsHomeEventsBundle>>({
    status: "idle",
    data: null,
    errorMessage: null
  });
  const clubs = clubsState.data?.clubs ?? EMPTY_CLUBS;

  useEffect(() => {
    const accessToken = state.accessToken;

    if (!accessToken || clubsState.status !== "ready") {
      setEventsState({
        status: "idle",
        data: null,
        errorMessage: null
      });
      return;
    }

    if (clubs.length === 0) {
      setEventsState({
        status: "ready",
        data: {
          upcomingEvents: [],
          historyEvents: []
        },
        errorMessage: null
      });
      return;
    }

    let isCancelled = false;

    setEventsState((current) => ({
      status: "loading",
      data: current.data,
      errorMessage: null
    }));

    void Promise.all(
      clubs.map(async (club) => {
        const [upcoming, completed] = await Promise.all([
          getClubEvents(accessToken, club.id, { status: "upcoming", type: "all" }),
          getClubEvents(accessToken, club.id, { status: "completed", type: "all" })
        ]);

        return {
          club,
          upcoming: upcoming.events,
          completed: completed.events
        };
      })
    )
      .then((items) => {
        if (isCancelled) {
          return;
        }

        setEventsState({
          status: "ready",
          data: {
            upcomingEvents: items
              .flatMap(({ club, upcoming }) => upcoming.map((event) => ({ club, event })))
              .sort((left, right) => new Date(left.event.scheduledStartAt).getTime() - new Date(right.event.scheduledStartAt).getTime()),
            historyEvents: items
              .flatMap(({ club, completed }) => completed.map((event) => ({ club, event })))
              .sort((left, right) => new Date(right.event.scheduledStartAt).getTime() - new Date(left.event.scheduledStartAt).getTime())
          },
          errorMessage: null
        });
      })
      .catch((error) => {
        if (isCancelled) {
          return;
        }

        setEventsState((current) => ({
          status: "error",
          data: current.data,
          errorMessage: getErrorMessage(error, "Не получилось загрузить события клубов")
        }));
      });

    return () => {
      isCancelled = true;
    };
  }, [clubs, clubsState.status, state.accessToken]);

  if (!state.accessToken) {
    return (
      <AuthRequiredState
        description="Список клубов появится после входа через Telegram."
        title="Клубы"
      />
    );
  }

  return (
    <ClubsHomeScreen
      clubs={clubs}
      errorMessage={
        clubsState.status === "error"
          ? clubsState.errorMessage
          : eventsState.status === "error"
            ? eventsState.errorMessage
            : null
      }
      historyEvents={eventsState.data?.historyEvents ?? []}
      isLoading={clubsState.status === "loading"}
      upcomingEvents={eventsState.data?.upcomingEvents ?? []}
      onCreateClub={() => void navigate(getClubsNewRoute())}
      onJoinClubCode={(inviteCode) => void navigate(getClubJoinRoute(inviteCode))}
      onOpenClub={(clubId) => void navigate(getClubDashboardRoute(clubId))}
      onOpenEvent={(clubId, eventId) => void navigate(getClubEventRoute(clubId, eventId))}
      onRetry={() => void refreshClubs()}
    />
  );
}

export function CreateClubContainer(): JSX.Element {
  const navigate = useNavigate();
  const { state } = useSession();
  const { refreshClubs } = useClubsList();
  const [values, setValues] = useState(DEFAULT_CLUB_FORM);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = useCallback(async (): Promise<void> => {
    const name = values.name.trim();

    if (!name) {
      setErrorMessage("Придумайте название клуба");
      return;
    }

    if (!state.accessToken) {
      setErrorMessage("Создание клуба доступно после входа через Telegram.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await createClub(state.accessToken, {
        name,
        description: values.description.trim() || null,
        defaultCurrency: values.defaultCurrency
      });
      await refreshClubs();
      void navigate(getClubDashboardRoute(response.club.id));
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Не получилось создать клуб"));
    } finally {
      setIsSubmitting(false);
    }
  }, [navigate, refreshClubs, state.accessToken, values]);

  return (
    <CreateClubScreen
      errorMessage={errorMessage}
      isSubmitting={isSubmitting}
      values={values}
      onChange={(field, value) => {
        setValues((current) => ({
          ...current,
          [field]: value
        }));
        if (errorMessage) {
          setErrorMessage(null);
        }
      }}
      onSubmit={() => void handleSubmit()}
    />
  );
}

export function ClubDashboardContainer(): JSX.Element {
  const navigate = useNavigate();
  const { clubId = "" } = useParams();
  const { state } = useSession();
  const { refreshClubs } = useClubsList();
  const [searchParams, setSearchParams] = useSearchParams();
  const [bundleState, setBundleState] = useState<AsyncState<ClubDashboardBundle>>({
    status: "idle",
    data: null,
    errorMessage: null
  });
  const [settingsValues, setSettingsValues] = useState(DEFAULT_CLUB_FORM);
  const [settingsErrorMessage, setSettingsErrorMessage] = useState<string | null>(null);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [memberActionInFlightId, setMemberActionInFlightId] = useState<string | null>(null);

  const activeTab = getDashboardTab(searchParams.get("tab"));

  const refreshDashboard = useCallback(async (): Promise<void> => {
    if (!state.accessToken || !clubId) {
      return;
    }

    setBundleState((current) => ({
      status: "loading",
      data: current.data,
      errorMessage: null
    }));

    try {
      const [dashboard, membersResponse, upcomingEventsResponse, historyEventsResponse] = await Promise.all([
        getClub(state.accessToken, clubId),
        getClubMembers(state.accessToken, clubId),
        getClubEvents(state.accessToken, clubId, { status: "upcoming", type: "all" }),
        getClubEvents(state.accessToken, clubId, { status: "completed", type: "all" })
      ]);

      setBundleState({
        status: "ready",
        data: {
          dashboard,
          members: membersResponse.members,
          upcomingEvents: upcomingEventsResponse.events,
          historyEvents: historyEventsResponse.events
        },
        errorMessage: null
      });

      setSettingsValues({
        name: dashboard.club.name,
        description: dashboard.club.description ?? "",
        defaultCurrency: dashboard.club.defaultCurrency ?? "RUB"
      });
    } catch (error) {
      setBundleState((current) => ({
        status: "error",
        data: current.data,
        errorMessage: getErrorMessage(error, "Не получилось открыть клуб")
      }));
    }
  }, [clubId, state.accessToken]);

  useEffect(() => {
    void refreshDashboard();
  }, [refreshDashboard]);

  const handleSaveSettings = useCallback(async (): Promise<void> => {
    if (!state.accessToken || !clubId) {
      return;
    }

    const name = settingsValues.name.trim();

    if (!name) {
      setSettingsErrorMessage("Добавьте название клуба");
      return;
    }

    setIsSavingSettings(true);
    setSettingsErrorMessage(null);

    try {
      await updateClub(state.accessToken, clubId, {
        name,
        description: settingsValues.description.trim() || null,
        defaultCurrency: settingsValues.defaultCurrency
      });
      await Promise.all([refreshDashboard(), refreshClubs()]);
    } catch (error) {
      setSettingsErrorMessage(getErrorMessage(error, "Не получилось сохранить настройки"));
    } finally {
      setIsSavingSettings(false);
    }
  }, [clubId, refreshClubs, refreshDashboard, settingsValues, state.accessToken]);

  const handleChangeMemberRole = useCallback(
    async (memberId: string, role: "ADMIN" | "MEMBER"): Promise<void> => {
      if (!state.accessToken || !clubId) {
        return;
      }

      setMemberActionInFlightId(memberId);

      try {
        await updateClubMember(state.accessToken, clubId, memberId, { role });
        await Promise.all([refreshDashboard(), refreshClubs()]);
      } catch (error) {
        setSettingsErrorMessage(getErrorMessage(error, "Не получилось обновить участника"));
      } finally {
        setMemberActionInFlightId(null);
      }
    },
    [clubId, refreshClubs, refreshDashboard, state.accessToken]
  );

  const handleRemoveMember = useCallback(
    async (memberId: string): Promise<void> => {
      if (!state.accessToken || !clubId) {
        return;
      }

      setMemberActionInFlightId(memberId);

      try {
        await updateClubMember(state.accessToken, clubId, memberId, { status: "REMOVED" });
        await Promise.all([refreshDashboard(), refreshClubs()]);
      } catch (error) {
        setSettingsErrorMessage(getErrorMessage(error, "Не получилось убрать участника"));
      } finally {
        setMemberActionInFlightId(null);
      }
    },
    [clubId, refreshClubs, refreshDashboard, state.accessToken]
  );

  const handleDeleteClub = useCallback(async (): Promise<void> => {
    if (!state.accessToken || !clubId) {
      return;
    }

    if (!window.confirm("Удалить клуб? Это действие нельзя отменить.")) {
      return;
    }

    setIsSavingSettings(true);
    setSettingsErrorMessage(null);

    try {
      await deleteClub(state.accessToken, clubId);
      await refreshClubs();
      void navigate("/club", { replace: true });
    } catch (error) {
      setSettingsErrorMessage(getErrorMessage(error, "Не получилось удалить клуб"));
    } finally {
      setIsSavingSettings(false);
    }
  }, [clubId, navigate, refreshClubs, state.accessToken]);

  if (!state.accessToken) {
    return (
      <AuthRequiredState
        description="Экран клуба откроется после входа через Telegram."
        title="Клуб"
      />
    );
  }

  if (bundleState.status === "loading" && !bundleState.data) {
    return <LoadingState title="Загружаем клуб" description="Собираем участников и события." />;
  }

  if (bundleState.status === "error" && !bundleState.data) {
    return (
      <RetryState
        description={bundleState.errorMessage}
        title="Не получилось открыть клуб"
        onRetry={() => void refreshDashboard()}
      />
    );
  }

  const bundle = bundleState.data;

  if (!bundle) {
    return <LoadingState title="Загружаем клуб" description="Еще немного, и все будет на месте." />;
  }

  const deleteClubProps =
    bundle.dashboard.canDeleteClub
      ? {
          onDeleteClub: () => void handleDeleteClub()
        }
      : {};

  return (
    <ClubDashboardScreen
      activeTab={activeTab}
      canCreateEvents={bundle.dashboard.canCreateEvents ?? isManager(bundle.dashboard.club.myRole)}
      canDeleteClub={bundle.dashboard.canDeleteClub ?? false}
      canInviteMembers={bundle.dashboard.canInviteMembers ?? isManager(bundle.dashboard.club.myRole)}
      canManageClub={bundle.dashboard.canManageClub ?? isManager(bundle.dashboard.club.myRole)}
      club={bundle.dashboard.club}
      currentMemberId={bundle.dashboard.myMembership?.id ?? null}
      historyEvents={bundle.historyEvents}
      isSubmitting={isSavingSettings}
      memberActionInFlightId={memberActionInFlightId}
      members={bundle.members}
      nearestEvent={bundle.dashboard.nearestEvent ?? bundle.dashboard.club.nearestEvent ?? null}
      settingsErrorMessage={settingsErrorMessage ?? bundleState.errorMessage}
      settingsValues={settingsValues}
      upcomingEvents={bundle.upcomingEvents}
      onChangeSettings={(field, value) => {
        setSettingsValues((current) => ({
          ...current,
          [field]: value
        }));
        if (settingsErrorMessage) {
          setSettingsErrorMessage(null);
        }
      }}
      onChangeTab={(tab) => setSearchParams(tab === "events" ? {} : { tab })}
      onMakeMember={(memberId) => void handleChangeMemberRole(memberId, "MEMBER")}
      onOpenCreateOffline={() => void navigate(`${getCreateRoomRoute()}?clubId=${clubId}`)}
      onOpenCreateOnline={() => void navigate(`${getCreateVirtualTableRoute()}?clubId=${clubId}`)}
      onOpenEvent={(eventId) => void navigate(getClubEventRoute(clubId, eventId))}
      onOpenInvite={() => void navigate(getClubInviteRoute(clubId))}
      onPromoteToAdmin={(memberId) => void handleChangeMemberRole(memberId, "ADMIN")}
      onRemoveMember={(memberId) => void handleRemoveMember(memberId)}
      onSaveSettings={() => void handleSaveSettings()}
      {...deleteClubProps}
    />
  );
}

export function ClubInviteContainer(): JSX.Element {
  const { clubId = "" } = useParams();
  const { state } = useSession();
  const [clubName, setClubName] = useState("клуб");
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [stateMessage, setStateMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshInviteLink = useCallback(async (): Promise<void> => {
    if (!state.accessToken || !clubId) {
      return;
    }

    setIsLoading(true);
    setStateMessage(null);

    try {
      const [dashboard, inviteResponse] = await Promise.all([
        getClub(state.accessToken, clubId),
        createClubInviteLink(state.accessToken, clubId)
      ]);

      setClubName(dashboard.club.name);
      setInviteCode(inviteResponse.inviteCode);
      setInviteLink(inviteResponse.inviteLink ?? inviteResponse.inviteUrl);
    } catch (error) {
      setStateMessage(getErrorMessage(error, "Не получилось подготовить приглашение"));
    } finally {
      setIsLoading(false);
    }
  }, [clubId, state.accessToken]);

  useEffect(() => {
    void refreshInviteLink();
  }, [refreshInviteLink]);

  const handleCopy = useCallback((): void => {
    if (!inviteCode) {
      return;
    }

    void navigator.clipboard?.writeText(inviteCode).catch(() => {
      setStateMessage("Не получилось скопировать код");
    });
  }, [inviteCode]);

  const handleShare = useCallback((): void => {
    if (!inviteCode || !inviteLink) {
      return;
    }

    const shareText = encodeURIComponent(
      `Вас пригласили в покерный клуб «${clubName}». Откройте ссылку и нажмите вступить. Код: ${inviteCode}`
    );
    const shareUrl = encodeURIComponent(inviteLink);
    window.open(`https://t.me/share/url?url=${shareUrl}&text=${shareText}`, "_blank", "noopener,noreferrer");
  }, [clubName, inviteCode, inviteLink]);

  if (!state.accessToken) {
    return (
      <AuthRequiredState
        description="Приглашение будет доступно после входа через Telegram."
        title="Приглашение"
      />
    );
  }

  return (
    <ClubInviteScreen
      clubName={clubName}
      errorMessage={stateMessage}
      inviteCode={inviteCode}
      inviteLink={inviteLink}
      isLoading={isLoading}
      onCopy={handleCopy}
      onShare={handleShare}
    />
  );
}

export function JoinClubContainer(): JSX.Element {
  const navigate = useNavigate();
  const { inviteCode = "" } = useParams();
  const { state } = useSession();
  const { refreshClubs } = useClubsList();
  const [previewState, setPreviewState] = useState<AsyncState<ClubSummaryDto & { alreadyMember?: boolean }>>({
    status: "idle",
    data: null,
    errorMessage: null
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const refreshPreview = useCallback(async (): Promise<void> => {
    if (!state.accessToken || !inviteCode) {
      return;
    }

    setPreviewState({
      status: "loading",
      data: null,
      errorMessage: null
    });

    try {
      const preview = await getClubJoinPreview(state.accessToken, inviteCode);
      setPreviewState({
        status: "ready",
        data: {
          ...preview.club,
          ...(typeof preview.alreadyMember === "boolean"
            ? {
                alreadyMember: preview.alreadyMember
              }
            : {})
        },
        errorMessage: null
      });
    } catch (error) {
      setPreviewState({
        status: "error",
        data: null,
        errorMessage: getErrorMessage(error, "Приглашение не найдено")
      });
    }
  }, [inviteCode, state.accessToken]);

  useEffect(() => {
    void refreshPreview();
  }, [refreshPreview]);

  const handleJoin = useCallback(async (): Promise<void> => {
    if (!state.accessToken || !previewState.data) {
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await joinClub(state.accessToken, previewState.data.id, {
        inviteCode
      });
      await refreshClubs();
      void navigate(getClubDashboardRoute(response.club.id), { replace: true });
    } catch (error) {
      setPreviewState((current) => ({
        status: "error",
        data: current.data,
        errorMessage: getErrorMessage(error, "Не получилось вступить в клуб")
      }));
    } finally {
      setIsSubmitting(false);
    }
  }, [inviteCode, navigate, previewState.data, refreshClubs, state.accessToken]);

  if (!state.accessToken) {
    return (
      <AuthRequiredState
        description="Вступить в клуб можно после входа через Telegram."
        title="Приглашение в клуб"
      />
    );
  }

  return (
    <JoinClubScreen
      alreadyMember={previewState.data?.alreadyMember ?? false}
      errorMessage={previewState.status === "error" ? previewState.errorMessage : null}
      inviteCode={inviteCode}
      isLoading={previewState.status === "loading"}
      isSubmitting={isSubmitting}
      preview={previewState.data}
      onJoin={() => void handleJoin()}
      onOpenClub={() => {
        if (previewState.data) {
          void navigate(getClubDashboardRoute(previewState.data.id), { replace: true });
        }
      }}
    />
  );
}

export function ClubEventDetailsContainer(): JSX.Element {
  const navigate = useNavigate();
  const { clubId = "", eventId = "" } = useParams();
  const { state } = useSession();
  const [eventState, setEventState] = useState<AsyncState<GetClubEventDetailsResponseDto>>({
    status: "idle",
    data: null,
    errorMessage: null
  });
  const [isUpdatingRsvp, setIsUpdatingRsvp] = useState(false);
  const [isSendingReminder, setIsSendingReminder] = useState(false);
  const [isCancellingEvent, setIsCancellingEvent] = useState(false);

  const refreshEvent = useCallback(async (): Promise<void> => {
    if (!state.accessToken || !clubId || !eventId) {
      return;
    }

    setEventState((current) => ({
      status: "loading",
      data: current.data,
      errorMessage: null
    }));

    try {
      const data = await getClubEvent(state.accessToken, clubId, eventId);
      setEventState({
        status: "ready",
        data,
        errorMessage: null
      });
    } catch (error) {
      setEventState((current) => ({
        status: "error",
        data: current.data,
        errorMessage: getErrorMessage(error, "Не получилось открыть мероприятие")
      }));
    }
  }, [clubId, eventId, state.accessToken]);

  useEffect(() => {
    void refreshEvent();
  }, [refreshEvent]);

  const handleSetRsvp = useCallback(
    async (statusValue: Exclude<ClubEventRsvpStatus, "NO_RESPONSE">): Promise<void> => {
      if (!state.accessToken || !clubId || !eventId) {
        return;
      }

      setIsUpdatingRsvp(true);

      try {
        await updateClubEventRsvp(state.accessToken, clubId, eventId, {
          status: statusValue
        });
        await refreshEvent();
      } catch (error) {
        setEventState((current) => ({
          status: "error",
          data: current.data,
          errorMessage: getErrorMessage(error, "Не получилось сохранить ответ")
        }));
      } finally {
        setIsUpdatingRsvp(false);
      }
    },
    [clubId, eventId, refreshEvent, state.accessToken]
  );

  const handleSendReminder = useCallback(async (): Promise<void> => {
    if (!state.accessToken || !clubId || !eventId) {
      return;
    }

    setIsSendingReminder(true);

    try {
      await sendClubEventReminder(state.accessToken, clubId, eventId);
      await refreshEvent();
    } catch (error) {
      setEventState((current) => ({
        status: "error",
        data: current.data,
        errorMessage: getErrorMessage(error, "Не получилось отправить напоминание")
      }));
    } finally {
      setIsSendingReminder(false);
    }
  }, [clubId, eventId, refreshEvent, state.accessToken]);

  const handleCancelEvent = useCallback(async (): Promise<void> => {
    if (!state.accessToken || !clubId || !eventId) {
      return;
    }

    if (!window.confirm("Отменить это мероприятие?")) {
      return;
    }

    setIsCancellingEvent(true);

    try {
      await cancelClubEvent(state.accessToken, clubId, eventId);
      await refreshEvent();
    } catch (error) {
      setEventState((current) => ({
        status: "error",
        data: current.data,
        errorMessage: getErrorMessage(error, "Не получилось отменить мероприятие")
      }));
    } finally {
      setIsCancellingEvent(false);
    }
  }, [clubId, eventId, refreshEvent, state.accessToken]);

  if (!state.accessToken) {
    return (
      <AuthRequiredState
        description="Детали мероприятия будут доступны после входа через Telegram."
        title="Мероприятие"
      />
    );
  }

  if (eventState.status === "loading" && !eventState.data) {
    return (
      <LoadingState
        title="Загружаем мероприятие"
        description="Проверяем ответы участников и связанные комнаты."
      />
    );
  }

  if (eventState.status === "error" && !eventState.data) {
    return (
      <RetryState
        description={eventState.errorMessage}
        title="Не получилось открыть мероприятие"
        onRetry={() => void refreshEvent()}
      />
    );
  }

  const data = eventState.data;

  if (!data) {
    return (
      <LoadingState
        title="Загружаем мероприятие"
        description="Еще немного, и детали будут на месте."
      />
    );
  }

  const linkedActions = {
    ...(data.canManage
      ? {
          onCancelEvent: () => void handleCancelEvent(),
          onSendReminder: () => void handleSendReminder()
        }
      : {}),
    ...(data.event.offlineRoomId
      ? {
          onOpenLinkedRoom: () => void navigate(getRoomRoute(data.event.offlineRoomId!))
        }
      : {}),
    ...(data.event.virtualTableId
      ? {
          onOpenLinkedTable: () => void navigate(getVirtualTableRoute(data.event.virtualTableId!))
        }
      : {})
  };

  return (
    <ClubEventDetailsScreen
      canManage={data.canManage ?? false}
      clubName={data.club.name}
      errorMessage={eventState.status === "error" ? eventState.errorMessage : null}
      event={data.event}
      isCancellingEvent={isCancellingEvent}
      isSendingReminder={isSendingReminder}
      isUpdatingRsvp={isUpdatingRsvp}
      myRsvpStatus={data.myRsvp?.status ?? null}
      rsvpGroups={data.rsvpGroups}
      onSetRsvp={(statusValue) => void handleSetRsvp(statusValue)}
      {...linkedActions}
    />
  );
}

function AuthRequiredState({
  title,
  description
}: {
  title: string;
  description: string;
}): JSX.Element {
  const imageSrc = resolveMiniAppVisual("club");

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4">
      <IllustratedPanel
        description={description}
        eyebrow="Клуб"
        imageSrc={imageSrc}
        title={title}
        tone="emerald"
      />
      <VisualEmptyState
        compact
        description={description}
        imageSrc={imageSrc}
        title="Нужен вход"
        tone="graphite"
      />
    </div>
  );
}

function LoadingState({
  title,
  description
}: {
  title: string;
  description: string;
}): JSX.Element {
  return <LoadingCard description={description} title={title} />;
}

function RetryState({
  title,
  description,
  onRetry
}: {
  title: string;
  description: string;
  onRetry: () => void;
}): JSX.Element {
  return (
    <div className="mx-auto w-full max-w-4xl space-y-3">
      <LoadingCard description={description} title={title} />
      <Button className="w-full" onClick={onRetry}>
        Попробовать снова
      </Button>
    </div>
  );
}

function LoadingCard({
  title,
  description
}: {
  title: string;
  description: string;
}): JSX.Element {
  return (
    <div className="mx-auto w-full max-w-4xl">
      <section className="glass-info rounded-2xl px-4 py-4">
        <p className="text-lg font-semibold text-white">{title}</p>
        <p className="mt-2 text-sm leading-6 text-muted">{description}</p>
      </section>
    </div>
  );
}

function getDashboardTab(value: string | null): "events" | "members" | "history" | "settings" {
  switch (value) {
    case "members":
    case "history":
    case "settings":
      return value;
    default:
      return "events";
  }
}

function isManager(role: ClubMemberRole | null | undefined): boolean {
  return role === "OWNER" || role === "ADMIN";
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

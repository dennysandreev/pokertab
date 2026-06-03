import type {
  ApiErrorEnvelope,
  AuthTelegramResponseDto,
  CancelRebuyRequestDto,
  CancelRebuyResponseDto,
  CloseSettlementRequestDto,
  CloseSettlementResponseDto,
  CreateRoomRequestDto,
  CreateRoomResponseDto,
  CreateRebuyRequestDto,
  CreateRebuyResponseDto,
  GetLeaderboardQueryDto,
  GetLeaderboardResponseDto,
  GetPlayerProfileResponseDto,
  GetRebuyHistoryResponseDto,
  GetMyVirtualStatsResponseDto,
  GetRoomResponseDto,
  GetVirtualPlayerProfileResponseDto,
  LeaderboardPeriod,
  LeaderboardScope,
  GetVirtualHandHistoriesQueryDto,
  GetVirtualHandHistoriesResponseDto,
  GetVirtualHandHistoryResponseDto,
  GetVirtualLeaderboardQueryDto,
  GetVirtualLeaderboardResponseDto,
  GetVirtualTableResponseDto,
  GetVirtualTablesResponseDto,
  JoinRoomRequestDto,
  JoinRoomResponseDto,
  JoinVirtualTableRequestDto,
  JoinVirtualTableResponseDto,
  LeaveRoomResponseDto,
  PauseVirtualTableResponseDto,
  RaiseVirtualBlindsRequestDto,
  RaiseVirtualBlindsResponseDto,
  RequestVirtualSitOutRequestDto,
  RequestVirtualSitOutResponseDto,
  ResolveInviteCodeRequestDto,
  ResolveInviteCodeResponseDto,
  ReturnToRoomResponseDto,
  RoomsListResponseDto,
  ReturnToVirtualTableResponseDto,
  SubmitVirtualReactionRequestDto,
  SubmitVirtualReactionResponseDto,
  SubmitFinalChipsRequestDto,
  SubmitVirtualActionRequestDto,
  SubmitVirtualActionResponseDto,
  SettlementPreviewRequestDto,
  SettlementPreviewResponseDto,
  StartNextVirtualHandResponseDto,
  StartRoomResponseDto,
  StartVirtualTableResponseDto,
  CreateVirtualTableRequestDto,
  CreateVirtualTableResponseDto,
  ResumeVirtualTableResponseDto,
  FinishVirtualTableResponseDto,
  CancelVirtualTableResponseDto
} from "@pokertable/shared";
import type {
  CancelClubEventRequestDto,
  CancelClubEventResponseDto,
  ClubEventListItemDto,
  ClubEventsQueryDto,
  ClubSummaryDto,
  ClubInviteLinkResponseDto,
  CreateClubRequestDto,
  CreateClubResponseDto,
  GetClubDashboardResponseDto,
  GetClubEventDetailsResponseDto,
  GetClubEventsResponseDto,
  GetClubJoinPreviewResponseDto,
  GetClubMembersResponseDto,
  GetMyClubsResponseDto,
  JoinClubByInviteRequestDto,
  JoinClubResponseDto,
  UpdateClubEventRsvpRequestDto,
  UpdateClubEventRsvpResponseDto,
  UpdateClubMemberRequestDto,
  UpdateClubMemberResponseDto,
  UpdateClubRequestDto,
  UpdateClubResponseDto
} from "../features/clubs/types";

type VirtualLeaderboardQuery = Partial<
  Pick<GetVirtualLeaderboardQueryDto, "limit" | "cursor"> & {
    scope: LeaderboardScope;
    period: LeaderboardPeriod;
  }
>;

export class ApiRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string | null,
    public readonly details?: Record<string, string>
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

export async function postTelegramAuth(
  initData: string
): Promise<AuthTelegramResponseDto> {
  return apiRequest<AuthTelegramResponseDto>("/api/auth/telegram", {
    method: "POST",
    body: JSON.stringify({
      initData
    })
  });
}

export async function getRooms(accessToken: string): Promise<RoomsListResponseDto> {
  return apiRequest<RoomsListResponseDto>("/api/rooms", {
    headers: getAuthorizedHeaders(accessToken)
  });
}

export async function getLeaderboard(
  accessToken: string,
  query: Partial<GetLeaderboardQueryDto>
): Promise<GetLeaderboardResponseDto> {
  return apiRequest<GetLeaderboardResponseDto>(`/api/leaderboard${buildQueryString(query)}`, {
    headers: getAuthorizedHeaders(accessToken)
  });
}

export async function getPlayerProfile(
  accessToken: string,
  userId: string
): Promise<GetPlayerProfileResponseDto> {
  return apiRequest<GetPlayerProfileResponseDto>(`/api/players/${userId}/profile`, {
    headers: getAuthorizedHeaders(accessToken)
  });
}

export async function createRoom(
  accessToken: string,
  payload: CreateRoomRequestDto
): Promise<CreateRoomResponseDto> {
  return apiRequest<CreateRoomResponseDto>("/api/rooms", {
    method: "POST",
    headers: getAuthorizedHeaders(accessToken),
    body: JSON.stringify(payload)
  });
}

export async function getRoom(
  accessToken: string,
  roomId: string
): Promise<GetRoomResponseDto> {
  return apiRequest<GetRoomResponseDto>(`/api/rooms/${roomId}`, {
    headers: getAuthorizedHeaders(accessToken)
  });
}

export async function joinRoom(
  accessToken: string,
  payload: JoinRoomRequestDto
): Promise<JoinRoomResponseDto> {
  return apiRequest<JoinRoomResponseDto>("/api/rooms/join", {
    method: "POST",
    headers: getAuthorizedHeaders(accessToken),
    body: JSON.stringify(payload)
  });
}

export async function resolveInviteCode(
  accessToken: string,
  payload: ResolveInviteCodeRequestDto
): Promise<ResolveInviteCodeResponseDto> {
  return apiRequest<ResolveInviteCodeResponseDto>("/api/invites/resolve", {
    method: "POST",
    headers: getAuthorizedHeaders(accessToken),
    body: JSON.stringify(payload)
  });
}

export async function startRoom(
  accessToken: string,
  roomId: string
): Promise<StartRoomResponseDto> {
  return apiRequest<StartRoomResponseDto>(`/api/rooms/${roomId}/start`, {
    method: "POST",
    headers: getAuthorizedHeaders(accessToken)
  });
}

export async function leaveRoom(
  accessToken: string,
  roomId: string,
  payload: SubmitFinalChipsRequestDto
): Promise<LeaveRoomResponseDto> {
  return apiRequest<LeaveRoomResponseDto>(`/api/rooms/${roomId}/leave`, {
    method: "POST",
    headers: getAuthorizedHeaders(accessToken),
    body: JSON.stringify(payload)
  });
}

export async function returnToRoom(
  accessToken: string,
  roomId: string
): Promise<ReturnToRoomResponseDto> {
  return apiRequest<ReturnToRoomResponseDto>(`/api/rooms/${roomId}/return`, {
    method: "POST",
    headers: getAuthorizedHeaders(accessToken)
  });
}

export async function createRebuy(
  accessToken: string,
  roomId: string,
  payload: CreateRebuyRequestDto
): Promise<CreateRebuyResponseDto> {
  return apiRequest<CreateRebuyResponseDto>(`/api/rooms/${roomId}/rebuys`, {
    method: "POST",
    headers: getAuthorizedHeaders(accessToken),
    body: JSON.stringify(payload)
  });
}

export async function cancelRebuy(
  accessToken: string,
  roomId: string,
  rebuyId: string,
  payload: CancelRebuyRequestDto
): Promise<CancelRebuyResponseDto> {
  return apiRequest<CancelRebuyResponseDto>(`/api/rooms/${roomId}/rebuys/${rebuyId}/cancel`, {
    method: "POST",
    headers: getAuthorizedHeaders(accessToken),
    body: JSON.stringify(payload)
  });
}

export async function getRebuyHistory(
  accessToken: string,
  roomId: string
): Promise<GetRebuyHistoryResponseDto> {
  return apiRequest<GetRebuyHistoryResponseDto>(`/api/rooms/${roomId}/rebuys`, {
    headers: getAuthorizedHeaders(accessToken)
  });
}

export async function previewSettlement(
  accessToken: string,
  roomId: string,
  payload: SettlementPreviewRequestDto
): Promise<SettlementPreviewResponseDto> {
  return apiRequest<SettlementPreviewResponseDto>(`/api/rooms/${roomId}/settlement/preview`, {
    method: "POST",
    headers: getAuthorizedHeaders(accessToken),
    body: JSON.stringify(payload)
  });
}

export async function closeSettlement(
  accessToken: string,
  roomId: string,
  payload: CloseSettlementRequestDto
): Promise<CloseSettlementResponseDto> {
  return apiRequest<CloseSettlementResponseDto>(`/api/rooms/${roomId}/settlement/close`, {
    method: "POST",
    headers: getAuthorizedHeaders(accessToken),
    body: JSON.stringify(payload)
  });
}

export async function getVirtualTables(
  accessToken: string
): Promise<GetVirtualTablesResponseDto> {
  return apiRequest<GetVirtualTablesResponseDto>("/api/virtual/tables", {
    headers: getAuthorizedHeaders(accessToken)
  });
}

export async function createVirtualTable(
  accessToken: string,
  payload: CreateVirtualTableRequestDto
): Promise<CreateVirtualTableResponseDto> {
  return apiRequest<CreateVirtualTableResponseDto>("/api/virtual/tables", {
    method: "POST",
    headers: getAuthorizedHeaders(accessToken),
    body: JSON.stringify(payload)
  });
}

export async function joinVirtualTable(
  accessToken: string,
  payload: JoinVirtualTableRequestDto
): Promise<JoinVirtualTableResponseDto> {
  return apiRequest<JoinVirtualTableResponseDto>("/api/virtual/tables/join", {
    method: "POST",
    headers: getAuthorizedHeaders(accessToken),
    body: JSON.stringify(payload)
  });
}

export async function getVirtualTable(
  accessToken: string,
  tableId: string
): Promise<GetVirtualTableResponseDto> {
  return apiRequest<GetVirtualTableResponseDto>(`/api/virtual/tables/${tableId}`, {
    headers: getAuthorizedHeaders(accessToken)
  });
}

export async function startVirtualTable(
  accessToken: string,
  tableId: string
): Promise<StartVirtualTableResponseDto> {
  return apiRequest<StartVirtualTableResponseDto>(`/api/virtual/tables/${tableId}/start`, {
    method: "POST",
    headers: getAuthorizedHeaders(accessToken)
  });
}

export async function startNextVirtualHand(
  accessToken: string,
  tableId: string
): Promise<StartNextVirtualHandResponseDto> {
  return apiRequest<StartNextVirtualHandResponseDto>(`/api/virtual/tables/${tableId}/hands/next`, {
    method: "POST",
    headers: getAuthorizedHeaders(accessToken)
  });
}

export async function pauseVirtualTable(
  accessToken: string,
  tableId: string
): Promise<PauseVirtualTableResponseDto> {
  return apiRequest<PauseVirtualTableResponseDto>(`/api/virtual/tables/${tableId}/pause`, {
    method: "POST",
    headers: getAuthorizedHeaders(accessToken)
  });
}

export async function resumeVirtualTable(
  accessToken: string,
  tableId: string
): Promise<ResumeVirtualTableResponseDto> {
  return apiRequest<ResumeVirtualTableResponseDto>(`/api/virtual/tables/${tableId}/resume`, {
    method: "POST",
    headers: getAuthorizedHeaders(accessToken)
  });
}

export async function finishVirtualTable(
  accessToken: string,
  tableId: string
): Promise<FinishVirtualTableResponseDto> {
  return apiRequest<FinishVirtualTableResponseDto>(`/api/virtual/tables/${tableId}/finish`, {
    method: "POST",
    headers: getAuthorizedHeaders(accessToken)
  });
}

export async function cancelVirtualTable(
  accessToken: string,
  tableId: string
): Promise<CancelVirtualTableResponseDto> {
  return apiRequest<CancelVirtualTableResponseDto>(`/api/virtual/tables/${tableId}/cancel`, {
    method: "POST",
    headers: getAuthorizedHeaders(accessToken)
  });
}

export async function raiseVirtualBlinds(
  accessToken: string,
  tableId: string,
  payload: RaiseVirtualBlindsRequestDto
): Promise<RaiseVirtualBlindsResponseDto> {
  return apiRequest<RaiseVirtualBlindsResponseDto>(`/api/virtual/tables/${tableId}/raise-blinds`, {
    method: "POST",
    headers: getAuthorizedHeaders(accessToken),
    body: JSON.stringify(payload)
  });
}

export async function submitVirtualAction(
  accessToken: string,
  tableId: string,
  payload: SubmitVirtualActionRequestDto
): Promise<SubmitVirtualActionResponseDto> {
  return apiRequest<SubmitVirtualActionResponseDto>(`/api/virtual/tables/${tableId}/actions`, {
    method: "POST",
    headers: getAuthorizedHeaders(accessToken),
    body: JSON.stringify(payload)
  });
}

export async function submitVirtualReaction(
  accessToken: string,
  tableId: string,
  payload: SubmitVirtualReactionRequestDto
): Promise<SubmitVirtualReactionResponseDto> {
  return apiRequest<SubmitVirtualReactionResponseDto>(`/api/virtual/tables/${tableId}/reactions`, {
    method: "POST",
    headers: getAuthorizedHeaders(accessToken),
    body: JSON.stringify(payload)
  });
}

export async function requestVirtualSitOut(
  accessToken: string,
  tableId: string,
  payload: RequestVirtualSitOutRequestDto
): Promise<RequestVirtualSitOutResponseDto> {
  return apiRequest<RequestVirtualSitOutResponseDto>(
    `/api/virtual/tables/${tableId}/sit-out/request`,
    {
      method: "POST",
      headers: getAuthorizedHeaders(accessToken),
      body: JSON.stringify(payload)
    }
  );
}

export async function returnToVirtualTable(
  accessToken: string,
  tableId: string
): Promise<ReturnToVirtualTableResponseDto> {
  return apiRequest<ReturnToVirtualTableResponseDto>(`/api/virtual/tables/${tableId}/return`, {
    method: "POST",
    headers: getAuthorizedHeaders(accessToken)
  });
}

export async function getVirtualHandHistories(
  accessToken: string,
  tableId: string,
  query: Partial<GetVirtualHandHistoriesQueryDto> = {}
): Promise<GetVirtualHandHistoriesResponseDto> {
  return apiRequest<GetVirtualHandHistoriesResponseDto>(
    `/api/virtual/tables/${tableId}/hands${buildQueryString(query)}`,
    {
      headers: getAuthorizedHeaders(accessToken)
    }
  );
}

export async function getVirtualHandHistory(
  accessToken: string,
  tableId: string,
  handId: string
): Promise<GetVirtualHandHistoryResponseDto> {
  return apiRequest<GetVirtualHandHistoryResponseDto>(
    `/api/virtual/tables/${tableId}/hands/${handId}/history`,
    {
      headers: getAuthorizedHeaders(accessToken)
    }
  );
}

export async function getVirtualLeaderboard(
  accessToken: string,
  query: VirtualLeaderboardQuery = {}
): Promise<GetVirtualLeaderboardResponseDto> {
  return apiRequest<GetVirtualLeaderboardResponseDto>(
    `/api/virtual/leaderboard${buildQueryString(query)}`,
    {
      headers: getAuthorizedHeaders(accessToken)
    }
  );
}

export async function getVirtualPlayerProfile(
  accessToken: string,
  userId: string,
  query: { period?: LeaderboardPeriod } = {}
): Promise<GetVirtualPlayerProfileResponseDto> {
  return apiRequest<GetVirtualPlayerProfileResponseDto>(
    `/api/virtual/players/${userId}/profile${buildQueryString(query)}`,
    {
      headers: getAuthorizedHeaders(accessToken)
    }
  );
}

export async function getMyVirtualStats(
  accessToken: string
): Promise<GetMyVirtualStatsResponseDto> {
  return apiRequest<GetMyVirtualStatsResponseDto>("/api/virtual/stats/me", {
    headers: getAuthorizedHeaders(accessToken)
  });
}

export async function getClubs(accessToken: string): Promise<GetMyClubsResponseDto> {
  return apiRequest<GetMyClubsResponseDto>("/api/clubs", {
    headers: getAuthorizedHeaders(accessToken)
  });
}

export async function createClub(
  accessToken: string,
  payload: CreateClubRequestDto
): Promise<CreateClubResponseDto> {
  return apiRequest<CreateClubResponseDto>("/api/clubs", {
    method: "POST",
    headers: getAuthorizedHeaders(accessToken),
    body: JSON.stringify(payload)
  });
}

export async function getClub(
  accessToken: string,
  clubId: string
): Promise<GetClubDashboardResponseDto> {
  const response = await apiRequest<GetClubDashboardResponseDto>(`/api/clubs/${clubId}`, {
    headers: getAuthorizedHeaders(accessToken)
  });
  const role = response.club?.myRole;
  const isManager = role === "OWNER" || role === "ADMIN";

  return {
    ...response,
    canCreateEvents: response.canCreateEvents ?? isManager,
    canInviteMembers: response.canInviteMembers ?? isManager,
    canManageClub: response.canManageClub ?? isManager,
    canDeleteClub: response.canDeleteClub ?? role === "OWNER"
  };
}

export async function updateClub(
  accessToken: string,
  clubId: string,
  payload: UpdateClubRequestDto
): Promise<UpdateClubResponseDto> {
  return apiRequest<UpdateClubResponseDto>(`/api/clubs/${clubId}`, {
    method: "PATCH",
    headers: getAuthorizedHeaders(accessToken),
    body: JSON.stringify(payload)
  });
}

export async function deleteClub(
  accessToken: string,
  clubId: string
): Promise<void> {
  await apiRequest<null>(`/api/clubs/${clubId}`, {
    method: "DELETE",
    headers: getAuthorizedHeaders(accessToken)
  });
}

export async function getClubJoinPreview(
  accessToken: string,
  inviteCode: string
): Promise<GetClubJoinPreviewResponseDto> {
  const response = await apiRequest<GetClubJoinPreviewResponseDto>(`/api/clubs/invites/${inviteCode}`, {
    headers: getAuthorizedHeaders(accessToken)
  });

  return {
    ...response,
    club: response.club ? normalizeClubSummary(response.club) : response.club
  };
}

export async function joinClub(
  accessToken: string,
  clubId: string,
  payload: JoinClubByInviteRequestDto
): Promise<JoinClubResponseDto> {
  return apiRequest<JoinClubResponseDto>(`/api/clubs/${clubId}/join`, {
    method: "POST",
    headers: getAuthorizedHeaders(accessToken),
    body: JSON.stringify(payload)
  });
}

export async function getClubMembers(
  accessToken: string,
  clubId: string
): Promise<GetClubMembersResponseDto> {
  return apiRequest<GetClubMembersResponseDto>(`/api/clubs/${clubId}/members`, {
    headers: getAuthorizedHeaders(accessToken)
  });
}

export async function createClubInviteLink(
  accessToken: string,
  clubId: string
): Promise<ClubInviteLinkResponseDto> {
  const response = await apiRequest<ClubInviteLinkResponseDto & { inviteLink?: string }>(`/api/clubs/${clubId}/invite-link`, {
    method: "POST",
    headers: getAuthorizedHeaders(accessToken)
  });

  return {
    ...response,
    inviteUrl: response.inviteUrl ?? response.inviteLink ?? "",
    inviteLink: response.inviteLink ?? response.inviteUrl ?? ""
  };
}

export async function updateClubMember(
  accessToken: string,
  clubId: string,
  memberId: string,
  payload: UpdateClubMemberRequestDto
): Promise<UpdateClubMemberResponseDto> {
  return apiRequest<UpdateClubMemberResponseDto>(`/api/clubs/${clubId}/members/${memberId}`, {
    method: "PATCH",
    headers: getAuthorizedHeaders(accessToken),
    body: JSON.stringify(payload)
  });
}

export async function getClubEvents(
  accessToken: string,
  clubId: string,
  query: ClubEventsQueryDto = {}
): Promise<GetClubEventsResponseDto> {
  const response = await apiRequest<GetClubEventsResponseDto>(`/api/clubs/${clubId}/events${buildQueryString(query)}`, {
    headers: getAuthorizedHeaders(accessToken)
  });

  return {
    ...response,
    events: (response.events ?? []).map(normalizeClubEvent)
  };
}

export async function getClubEvent(
  accessToken: string,
  clubId: string,
  eventId: string
): Promise<GetClubEventDetailsResponseDto> {
  const response = await apiRequest<{
    club?: ClubSummaryDto;
    event: ClubEventListItemDto & Record<string, unknown>;
    myRsvp?: GetClubEventDetailsResponseDto["myRsvp"];
    rsvpGroups?: GetClubEventDetailsResponseDto["rsvpGroups"];
    rsvps?: GetClubEventDetailsResponseDto["rsvpGroups"] | null;
    canManage?: boolean;
    canRespond?: boolean;
  }>(`/api/clubs/${clubId}/events/${eventId}`, {
    headers: getAuthorizedHeaders(accessToken)
  });

  const rawMyRsvpStatus =
    typeof response.event?.myRsvpStatus === "string"
      ? response.event.myRsvpStatus
      : null;
  const fallbackEvent = {
    id: eventId,
    clubId,
    createdByUserId: "",
    type: "OFFLINE_POKER",
    title: "Мероприятие",
    scheduledStartAt: new Date(0).toISOString(),
    status: "SCHEDULED",
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString()
  } as ClubEventListItemDto;
  const event = normalizeClubEvent(response.event ?? fallbackEvent);
  const rsvpGroups = response.rsvpGroups ?? response.rsvps ?? createEmptyClubRsvpGroups();
  const fallbackClub: ClubSummaryDto = {
    id: clubId,
    ownerUserId: "",
    name: "Клуб",
    privacy: "PRIVATE_INVITE_ONLY",
    inviteCode: "",
    createdAt: event.createdAt,
    updatedAt: event.updatedAt
  };

  return {
    club: response.club ?? fallbackClub,
    event,
    myMembership: null,
    myRsvp: response.myRsvp ?? (rawMyRsvpStatus ? {
      id: `${event.id}:${clubId}`,
      clubEventId: event.id,
      clubId,
      userId: "",
      status: rawMyRsvpStatus,
      respondedAt: null,
      createdAt: event.createdAt,
      updatedAt: event.updatedAt
    } : null),
    rsvpGroups,
    canManage: response.canManage ?? false,
    canRespond: response.canRespond ?? true
  };
}

export async function updateClubEventRsvp(
  accessToken: string,
  clubId: string,
  eventId: string,
  payload: UpdateClubEventRsvpRequestDto
): Promise<UpdateClubEventRsvpResponseDto> {
  return apiRequest<UpdateClubEventRsvpResponseDto>(`/api/clubs/${clubId}/events/${eventId}/rsvp`, {
    method: "PATCH",
    headers: getAuthorizedHeaders(accessToken),
    body: JSON.stringify(payload)
  });
}

export async function sendClubEventReminder(
  accessToken: string,
  clubId: string,
  eventId: string
): Promise<void> {
  await apiRequest<null>(`/api/clubs/${clubId}/events/${eventId}/remind`, {
    method: "POST",
    headers: getAuthorizedHeaders(accessToken)
  });
}

export async function cancelClubEvent(
  accessToken: string,
  clubId: string,
  eventId: string,
  payload: CancelClubEventRequestDto = {}
): Promise<CancelClubEventResponseDto> {
  return apiRequest<CancelClubEventResponseDto>(`/api/clubs/${clubId}/events/${eventId}/cancel`, {
    method: "PATCH",
    headers: getAuthorizedHeaders(accessToken),
    body: JSON.stringify(payload)
  });
}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "Cache-Control": "no-cache",
      "Content-Type": "application/json",
      Pragma: "no-cache",
      ...init?.headers
    }
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as unknown;
    const errorEnvelope = isApiErrorEnvelope(payload) ? payload : null;
    const fallbackMessage = extractApiErrorMessage(payload);

    throw new ApiRequestError(
      errorEnvelope?.error.message ?? fallbackMessage ?? "Не удалось выполнить запрос",
      response.status,
      errorEnvelope?.error.code ?? null,
      errorEnvelope?.error.details
    );
  }

  return (await response.json()) as T;
}

function buildQueryString<T extends Record<string, string | number | null | undefined>>(
  query: T
): string {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (typeof value === "string" && value.length > 0) {
      params.set(key, value);
      continue;
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      params.set(key, String(value));
    }
  }

  const search = params.toString();

  return search.length > 0 ? `?${search}` : "";
}

function normalizeClubSummary(club: ClubSummaryDto): ClubSummaryDto {
  return {
    ...club,
    nearestEvent: club.nearestEvent ? normalizeClubEvent(club.nearestEvent) : null
  };
}

function normalizeClubEvent(event: ClubEventListItemDto & Record<string, unknown>): ClubEventListItemDto {
  const rsvpCounts = event.rsvpCounts as
    | {
        going?: number;
        maybe?: number;
        declined?: number;
        noResponse?: number;
        waitlist?: number;
      }
    | undefined;

  return {
    ...event,
    myRsvpStatus: event.myRsvpStatus ?? null,
    offlineRoomId:
      event.offlineRoomId ?? (typeof event.linkedRoomId === "string" ? event.linkedRoomId : null),
    virtualTableId:
      event.virtualTableId ?? (typeof event.linkedTableId === "string" ? event.linkedTableId : null),
    rsvpSummary:
      event.rsvpSummary ??
      (rsvpCounts
        ? {
            goingCount: rsvpCounts.going ?? 0,
            maybeCount: rsvpCounts.maybe ?? 0,
            declinedCount: rsvpCounts.declined ?? 0,
            noResponseCount: rsvpCounts.noResponse ?? 0,
            waitlistCount: rsvpCounts.waitlist ?? 0
          }
        : null)
  };
}

function createEmptyClubRsvpGroups(): GetClubEventDetailsResponseDto["rsvpGroups"] {
  return {
    going: [],
    maybe: [],
    declined: [],
    noResponse: [],
    waitlist: []
  };
}

function getAuthorizedHeaders(accessToken: string): Record<string, string> {
  return {
    Authorization: `Bearer ${accessToken}`
  };
}

function getApiBaseUrl(): string {
  const apiUrl = import.meta.env.VITE_API_URL;

  return typeof apiUrl === "string" && apiUrl.length > 0
    ? apiUrl
    : "http://localhost:3000";
}

function isApiErrorEnvelope(value: unknown): value is ApiErrorEnvelope {
  if (!value || typeof value !== "object") {
    return false;
  }

  if (!("error" in value)) {
    return false;
  }

  const error = value.error;

  return !!error && typeof error === "object" && "message" in error && typeof error.message === "string";
}

function extractApiErrorMessage(value: unknown): string | null {
  if (!value || typeof value !== "object" || !("message" in value)) {
    return null;
  }

  const { message } = value;

  if (typeof message === "string" && message.trim().length > 0) {
    return message;
  }

  if (Array.isArray(message)) {
    const firstMessage = message.find(
      (item): item is string => typeof item === "string" && item.trim().length > 0
    );

    return firstMessage ?? null;
  }

  return null;
}

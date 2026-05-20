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

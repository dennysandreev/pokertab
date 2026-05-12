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
  GetRoomResponseDto,
  JoinRoomRequestDto,
  JoinRoomResponseDto,
  RoomsListResponseDto,
  SettlementPreviewRequestDto,
  SettlementPreviewResponseDto,
  StartRoomResponseDto
} from "@pokertable/shared";

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

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers
    }
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as unknown;
    const errorEnvelope = isApiErrorEnvelope(payload) ? payload : null;

    throw new ApiRequestError(
      errorEnvelope?.error.message ?? "Не удалось выполнить запрос",
      response.status,
      errorEnvelope?.error.code ?? null,
      errorEnvelope?.error.details
    );
  }

  return (await response.json()) as T;
}

function buildQueryString(query: Partial<GetLeaderboardQueryDto>): string {
  const params = new URLSearchParams();

  if (query.scope) {
    params.set("scope", query.scope);
  }

  if (query.period) {
    params.set("period", query.period);
  }

  if (typeof query.limit === "number" && Number.isFinite(query.limit)) {
    params.set("limit", String(query.limit));
  }

  if (typeof query.cursor === "string" && query.cursor.length > 0) {
    params.set("cursor", query.cursor);
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

  return "error" in value;
}

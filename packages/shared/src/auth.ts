export type UserDto = {
  id: string;
  telegramId: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
};

export type AuthTelegramRequestDto = {
  initData: string;
};

export type AuthTelegramResponseDto = {
  accessToken: string;
  user: UserDto;
};

export const AUTH_ERROR_CODES = {
  invalidInitData: "AUTH_INVALID_INIT_DATA",
  initDataExpired: "AUTH_INIT_DATA_EXPIRED",
  invalidUserPayload: "AUTH_INVALID_USER_PAYLOAD",
  unauthorized: "UNAUTHORIZED"
} as const;

export type AuthErrorCode =
  (typeof AUTH_ERROR_CODES)[keyof typeof AUTH_ERROR_CODES];

export type ApiErrorEnvelope<TCode extends string = string> = {
  error: {
    code: TCode;
    message: string;
    details?: Record<string, string>;
  };
};

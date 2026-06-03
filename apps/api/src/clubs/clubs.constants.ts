export const CLUB_ERROR_CODES = {
  invalidInput: "CLUB_INVALID_INPUT",
  notFound: "CLUB_NOT_FOUND",
  forbidden: "CLUB_FORBIDDEN",
  conflict: "CLUB_CONFLICT",
  unauthorized: "CLUB_UNAUTHORIZED"
} as const;

export const CLUB_TITLE_MAX_LENGTH = 80;
export const CLUB_DESCRIPTION_MAX_LENGTH = 500;
export const CLUB_EVENT_TITLE_MAX_LENGTH = 80;
export const CLUB_LOCATION_MAX_LENGTH = 120;
export const CLUB_SUPPORTED_CURRENCIES = ["RUB", "USD", "EUR"] as const;
export const CLUB_INVITE_CODE_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
export const CLUB_INVITE_CODE_LENGTH = 8;

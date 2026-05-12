import type { UserDto } from "@pokertable/shared";

export type TelegramMiniAppUser = {
  id: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
};

export type ValidatedTelegramInitData = {
  authDate: Date;
  queryId: string | null;
  startParam: string | null;
  user: TelegramMiniAppUser;
};

export type PersistedUser = UserDto;

export type UpsertTelegramUserInput = TelegramMiniAppUser;

export type SessionTokenPayload = {
  sub: string;
  telegramId: string;
  iat: number;
  exp: number;
};

export type SessionTokenIssuer = {
  createToken(user: PersistedUser): string;
  verifyToken(token: string): SessionTokenPayload;
};

export type UsersRepository = {
  upsertTelegramUser(input: UpsertTelegramUserInput): Promise<PersistedUser>;
  findById(id: string): Promise<PersistedUser | null>;
};

export type AuthenticatedRequest = {
  headers: {
    authorization?: string;
  };
  user?: PersistedUser;
};

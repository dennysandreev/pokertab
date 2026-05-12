import { HttpStatus, Inject, Injectable } from "@nestjs/common";
import type { AuthTelegramResponseDto, UserDto } from "@pokertable/shared";
import { ApiError } from "../shared/api-error";
import { getNumberEnv, getRequiredEnv } from "../shared/env";
import { AUTH_ERROR_CODES } from "./auth.constants";
import { SESSION_TOKEN_SERVICE, USERS_REPOSITORY } from "./auth.tokens";
import type { SessionTokenIssuer, UsersRepository } from "./auth.types";
import { validateTelegramInitData } from "./telegram-auth.helpers";

@Injectable()
export class AuthService {
  private readonly telegramBotToken = getRequiredEnv("TELEGRAM_BOT_TOKEN");
  private readonly maxInitDataAgeSeconds = getNumberEnv(
    "TELEGRAM_INIT_DATA_MAX_AGE_SECONDS",
    60 * 10
  );

  constructor(
    @Inject(USERS_REPOSITORY) private readonly usersRepository: UsersRepository,
    @Inject(SESSION_TOKEN_SERVICE)
    private readonly sessionTokenService: SessionTokenIssuer
  ) {}

  async authenticateWithTelegram(initData: string): Promise<AuthTelegramResponseDto> {
    if (initData.trim().length === 0) {
      throw new ApiError(
        AUTH_ERROR_CODES.invalidInitData,
        "Не удалось подтвердить вход через Telegram",
        HttpStatus.UNAUTHORIZED
      );
    }

    const validatedData = validateTelegramInitData({
      initData,
      botToken: this.telegramBotToken,
      maxAgeSeconds: this.maxInitDataAgeSeconds,
      now: new Date()
    });

    const user = await this.usersRepository.upsertTelegramUser(validatedData.user);
    const accessToken = this.sessionTokenService.createToken(user);

    return {
      accessToken,
      user
    };
  }

  async authenticateAccessToken(token: string): Promise<UserDto> {
    const payload = this.sessionTokenService.verifyToken(token);
    const user = await this.usersRepository.findById(payload.sub);

    if (!user) {
      throw new ApiError(
        AUTH_ERROR_CODES.unauthorized,
        "Нужна авторизация",
        HttpStatus.UNAUTHORIZED
      );
    }

    return user;
  }
}

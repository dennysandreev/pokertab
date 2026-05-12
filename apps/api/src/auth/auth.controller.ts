import { Body, Controller, HttpCode, HttpStatus, Post } from "@nestjs/common";
import type { AuthTelegramRequestDto, AuthTelegramResponseDto } from "@pokertable/shared";
import { ApiError } from "../shared/api-error";
import { AUTH_ERROR_CODES } from "./auth.constants";
import { AuthService } from "./auth.service";

type RawAuthTelegramRequest = Partial<AuthTelegramRequestDto> | null;

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("telegram")
  @HttpCode(HttpStatus.OK)
  async authenticateWithTelegram(
    @Body() body: RawAuthTelegramRequest
  ): Promise<AuthTelegramResponseDto> {
    if (!body || typeof body.initData !== "string") {
      throw new ApiError(
        AUTH_ERROR_CODES.invalidInitData,
        "Не удалось подтвердить вход через Telegram",
        HttpStatus.BAD_REQUEST
      );
    }

    return this.authService.authenticateWithTelegram(body.initData);
  }
}

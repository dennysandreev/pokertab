import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import type {
  GetPlayerProfileResponseDto,
  UserDto
} from "@pokertable/shared";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import { PlayerStatsService } from "./player-stats.service";

@Controller("players")
@UseGuards(AuthGuard)
export class PlayersController {
  constructor(private readonly playerStatsService: PlayerStatsService) {}

  @Get(":userId/profile")
  getProfile(
    @CurrentUser() user: UserDto,
    @Param("userId") userId: string
  ): Promise<GetPlayerProfileResponseDto> {
    return this.playerStatsService.getPlayerProfile(user, userId);
  }
}

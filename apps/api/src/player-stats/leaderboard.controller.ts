import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import type {
  GetLeaderboardResponseDto,
  UserDto
} from "@pokertable/shared";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import { normalizeGetLeaderboardQuery } from "./player-stats.request";
import { PlayerStatsService } from "./player-stats.service";

@Controller("leaderboard")
@UseGuards(AuthGuard)
export class LeaderboardController {
  constructor(private readonly playerStatsService: PlayerStatsService) {}

  @Get()
  getLeaderboard(
    @CurrentUser() user: UserDto,
    @Query() query: unknown
  ): Promise<GetLeaderboardResponseDto> {
    return this.playerStatsService.getLeaderboard(user, normalizeGetLeaderboardQuery(query));
  }
}

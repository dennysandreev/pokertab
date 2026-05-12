import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaService } from "../prisma/prisma.service";
import { LeaderboardController } from "./leaderboard.controller";
import { PlayerStatsService } from "./player-stats.service";
import { PlayersController } from "./players.controller";

@Module({
  imports: [AuthModule],
  controllers: [LeaderboardController, PlayersController],
  providers: [PlayerStatsService, PrismaService],
  exports: [PlayerStatsService]
})
export class PlayerStatsModule {}

import { Module } from "@nestjs/common";
import { AuthModule } from "./auth/auth.module";
import { HealthModule } from "./health/health.module";
import { PlayerStatsModule } from "./player-stats/player-stats.module";
import { RoomsModule } from "./rooms/rooms.module";

@Module({
  imports: [AuthModule, HealthModule, RoomsModule, PlayerStatsModule]
})
export class AppModule {}

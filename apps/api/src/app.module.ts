import { Module } from "@nestjs/common";
import { AuthModule } from "./auth/auth.module";
import { ClubsModule } from "./clubs/clubs.module";
import { HealthModule } from "./health/health.module";
import { InvitesModule } from "./invites/invites.module";
import { PlayerStatsModule } from "./player-stats/player-stats.module";
import { RoomsModule } from "./rooms/rooms.module";
import { VirtualModule } from "./virtual/virtual.module";

@Module({
  imports: [
    AuthModule,
    ClubsModule,
    HealthModule,
    InvitesModule,
    RoomsModule,
    PlayerStatsModule,
    VirtualModule
  ]
})
export class AppModule {}

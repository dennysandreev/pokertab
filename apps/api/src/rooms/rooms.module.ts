import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ClubsModule } from "../clubs/clubs.module";
import { PlayerStatsModule } from "../player-stats/player-stats.module";
import { PrismaService } from "../prisma/prisma.service";
import { RoomsController } from "./rooms.controller";
import { RoomsService } from "./rooms.service";

@Module({
  imports: [AuthModule, PlayerStatsModule, ClubsModule],
  controllers: [RoomsController],
  providers: [RoomsService, PrismaService]
})
export class RoomsModule {}

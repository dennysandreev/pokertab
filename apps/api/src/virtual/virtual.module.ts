import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ClubsModule } from "../clubs/clubs.module";
import { PrismaService } from "../prisma/prisma.service";
import { VirtualController } from "./virtual.controller";
import { VirtualNotificationsService } from "./virtual-notifications.service";
import { VirtualService } from "./virtual.service";
import { VirtualTimerWorker } from "./virtual-timer.worker";

@Module({
  imports: [AuthModule, ClubsModule],
  controllers: [VirtualController],
  providers: [
    VirtualService,
    VirtualNotificationsService,
    VirtualTimerWorker,
    PrismaService
  ]
})
export class VirtualModule {}

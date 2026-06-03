import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaService } from "../prisma/prisma.service";
import { ClubsController } from "./clubs.controller";
import { ClubsNotificationsService } from "./clubs.notifications.service";
import { ClubsService } from "./clubs.service";

@Module({
  imports: [AuthModule],
  controllers: [ClubsController],
  providers: [ClubsService, ClubsNotificationsService, PrismaService],
  exports: [ClubsService, ClubsNotificationsService]
})
export class ClubsModule {}

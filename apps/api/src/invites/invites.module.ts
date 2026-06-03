import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaService } from "../prisma/prisma.service";
import { InvitesController } from "./invites.controller";
import { InvitesService } from "./invites.service";

@Module({
  imports: [AuthModule],
  controllers: [InvitesController],
  providers: [InvitesService, PrismaService]
})
export class InvitesModule {}

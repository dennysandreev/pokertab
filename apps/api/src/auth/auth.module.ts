import { Module } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { SESSION_TOKEN_SERVICE, USERS_REPOSITORY } from "./auth.tokens";
import { SessionTokenService } from "./session-token.service";
import { PrismaUsersRepository } from "./users.repository";

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    PrismaService,
    {
      provide: USERS_REPOSITORY,
      useClass: PrismaUsersRepository
    },
    {
      provide: SESSION_TOKEN_SERVICE,
      useClass: SessionTokenService
    }
  ],
  exports: [AuthService, USERS_REPOSITORY, SESSION_TOKEN_SERVICE]
})
export class AuthModule {}

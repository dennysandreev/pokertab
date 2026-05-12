import { Injectable } from "@nestjs/common";
import type { User } from "@prisma/client";
import type { UserDto } from "@pokertable/shared";
import { PrismaService } from "../prisma/prisma.service";
import type { PersistedUser, UpsertTelegramUserInput, UsersRepository } from "./auth.types";

function toUserDto(user: User): UserDto {
  return {
    id: user.id,
    telegramId: user.telegramId,
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    avatarUrl: user.avatarUrl
  };
}

@Injectable()
export class PrismaUsersRepository implements UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async upsertTelegramUser(input: UpsertTelegramUserInput): Promise<PersistedUser> {
    const user = await this.prisma.user.upsert({
      where: {
        telegramId: input.id
      },
      create: {
        telegramId: input.id,
        username: input.username,
        firstName: input.firstName,
        lastName: input.lastName,
        avatarUrl: input.avatarUrl
      },
      update: {
        username: input.username,
        firstName: input.firstName,
        lastName: input.lastName,
        avatarUrl: input.avatarUrl
      }
    });

    return toUserDto(user);
  }

  async findById(id: string): Promise<PersistedUser | null> {
    const user = await this.prisma.user.findUnique({
      where: {
        id
      }
    });

    return user ? toUserDto(user) : null;
  }
}

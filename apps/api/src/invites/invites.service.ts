import { HttpStatus, Injectable } from "@nestjs/common";
import type {
  InviteCodeTarget,
  ResolveInviteCodeRequestDto,
  ResolveInviteCodeResponseDto
} from "@pokertable/shared";
import { PrismaService } from "../prisma/prisma.service";
import { ApiError } from "../shared/api-error";
import { INVITES_ERROR_CODES } from "./invites.constants";

@Injectable()
export class InvitesService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveInviteCode(
    input: ResolveInviteCodeRequestDto
  ): Promise<ResolveInviteCodeResponseDto> {
    const inviteCode = input.inviteCode.trim().toUpperCase();

    if (inviteCode.length === 0) {
      throw new ApiError(
        INVITES_ERROR_CODES.invalidInput,
        "Нужен код приглашения",
        HttpStatus.BAD_REQUEST
      );
    }

    const [room, virtualTable, club] = await Promise.all([
      this.prisma.room.findFirst({
        where: {
          inviteCode: {
            equals: inviteCode,
            mode: "insensitive"
          }
        },
        select: {
          inviteCode: true
        }
      }),
      this.prisma.virtualTable.findFirst({
        where: {
          inviteCode: {
            equals: inviteCode,
            mode: "insensitive"
          }
        },
        select: {
          inviteCode: true
        }
      }),
      this.prisma.club.findFirst({
        where: {
          inviteCode: {
            equals: inviteCode,
            mode: "insensitive"
          }
        },
        select: {
          inviteCode: true
        }
      })
    ]);

    const matches: Array<{ kind: InviteCodeTarget; inviteCode: string }> = [
      room ? { kind: "ROOM", inviteCode: room.inviteCode } : null,
      virtualTable ? { kind: "VIRTUAL_TABLE", inviteCode: virtualTable.inviteCode } : null,
      club ? { kind: "CLUB", inviteCode: club.inviteCode } : null
    ].filter((match): match is { kind: InviteCodeTarget; inviteCode: string } => match !== null);

    if (matches.length === 0) {
      throw new ApiError(
        INVITES_ERROR_CODES.notFound,
        "Код не найден",
        HttpStatus.NOT_FOUND
      );
    }

    if (matches.length > 1) {
      throw new ApiError(
        INVITES_ERROR_CODES.ambiguous,
        "Код совпал с несколькими приглашениями",
        HttpStatus.CONFLICT
      );
    }

    const [match] = matches;

    if (!match) {
      throw new ApiError(
        INVITES_ERROR_CODES.notFound,
        "Код не найден",
        HttpStatus.NOT_FOUND
      );
    }

    return match;
  }
}

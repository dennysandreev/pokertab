import { HttpStatus, Injectable } from "@nestjs/common";
import {
  RebuyEventStatus as PrismaRebuyEventStatus,
  RoomStatus as PrismaRoomStatus,
  type Prisma,
  type RebuyEvent,
  type Room,
  type RoomPlayer,
  type User
} from "@prisma/client";
import type {
  GetLeaderboardQueryDto,
  GetLeaderboardResponseDto,
  GetPlayerProfileResponseDto,
  LeaderboardItemDto,
  PlayerProfileStatsDto,
  RecentPlayerGameDto,
  UserDto
} from "@pokertable/shared";
import { PrismaService } from "../prisma/prisma.service";
import { ApiError } from "../shared/api-error";
import {
  calculatePlayerStats,
  compareLeaderboardStats,
  type ClosedGameStatRow
} from "./player-stats-calculations";
import { PLAYER_STATS_ERROR_CODES } from "./player-stats.constants";

type ClosedGameParticipationRecord = RoomPlayer & {
  user: User;
  room: Pick<
    Room,
    "id" | "title" | "currency" | "rebuyAmountMinor" | "closedAt" | "status"
  > & {
    players: Array<Pick<RoomPlayer, "id">>;
  };
  rebuyEvents: Array<Pick<RebuyEvent, "amountMinor">>;
};

type PlayerIdentity = {
  userId: string;
  displayName: string;
  username: string | null;
};

@Injectable()
export class PlayerStatsService {
  constructor(private readonly prisma: PrismaService) {}

  async getLeaderboard(
    user: UserDto,
    query: GetLeaderboardQueryDto
  ): Promise<GetLeaderboardResponseDto> {
    const candidateUserIds =
      query.scope === "played-with-me"
        ? await this.getPlayedWithMeUserIds(user.id)
        : await this.getAllUserIdsWithClosedGames();

    if (candidateUserIds.length === 0) {
      return {
        items: [],
        nextCursor: null
      };
    }

    const monthRange = query.period === "month" ? getCurrentMonthRange(new Date()) : null;
    const rows = await this.getClosedGameRowsForUsers(candidateUserIds, {
      closedAtGte: monthRange?.start ?? null,
      closedAtLt: monthRange?.endExclusive ?? null
    });
    const groupedRows = this.groupRowsByUser(rows);
    const identities = this.collectIdentities(rows);

    const items = candidateUserIds
      .map((userId) => {
        const selectedRows = this.selectRowsForPeriod(groupedRows.get(userId) ?? [], query.period);
        const stats = calculatePlayerStats(selectedRows);
        const identity = identities.get(userId);

        if (!stats || !identity) {
          return null;
        }

        return {
          userId,
          displayName: identity.displayName,
          username: identity.username,
          stats
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((left, right) =>
        compareLeaderboardStats(
          {
            userId: left.userId,
            gamesCount: left.stats.gamesCount,
            totalProfitMinor: left.stats.totalProfitMinor,
            pokerScore: left.stats.pokerScore
          },
          {
            userId: right.userId,
            gamesCount: right.stats.gamesCount,
            totalProfitMinor: right.stats.totalProfitMinor,
            pokerScore: right.stats.pokerScore
          }
        )
      )
      .slice(0, query.limit)
      .map(
        (item, index): LeaderboardItemDto => ({
          rank: index + 1,
          userId: item.userId,
          displayName: item.displayName,
          totalBuyinsMinor: item.stats.totalBuyinsMinor.toString(),
          totalProfitMinor: item.stats.totalProfitMinor.toString(),
          gamesCount: item.stats.gamesCount,
          roiBps: item.stats.roiBps,
          winRateBps: item.stats.winRateBps,
          stabilityScoreBps: item.stats.stabilityScoreBps,
          avgProfitMinor: item.stats.avgProfitMinor.toString(),
          pokerScore: item.stats.pokerScore
        })
      );

    return {
      items,
      nextCursor: null
    };
  }

  async getPlayerProfile(
    viewer: UserDto,
    targetUserId: string
  ): Promise<GetPlayerProfileResponseDto> {
    const targetUser = await this.prisma.user.findUnique({
      where: {
        id: targetUserId
      }
    });

    if (!targetUser) {
      throw new ApiError(
        PLAYER_STATS_ERROR_CODES.notFound,
        "Игрок не найден",
        HttpStatus.NOT_FOUND
      );
    }

    if (viewer.id !== targetUserId) {
      const hasSharedClosedRoom = await this.hasSharedClosedRoom(viewer.id, targetUserId);

      if (!hasSharedClosedRoom) {
        throw new ApiError(
          PLAYER_STATS_ERROR_CODES.accessDenied,
          "Профиль доступен только тем, кто уже играл вместе",
          HttpStatus.FORBIDDEN
        );
      }
    }

    const rows = await this.getClosedGameRowsForUsers([targetUserId]);
    const selectedRows = this.selectRowsForPeriod(rows, "all-time");
    const stats = calculatePlayerStats(selectedRows);

    return {
      user: {
        id: targetUser.id,
        displayName: getUserDisplayName(targetUser),
        username: targetUser.username ?? null
      },
      stats: stats ? toPlayerProfileStatsDto(stats) : createEmptyPlayerProfileStats(),
      recentGames: selectedRows.slice(0, 10).map(toRecentGameDto)
    };
  }

  async recalculateAndUpsertPlayerStats(
    userIds: string[],
    prisma: PrismaService | Prisma.TransactionClient = this.prisma
  ): Promise<void> {
    const uniqueUserIds = [...new Set(userIds.filter((userId) => userId.length > 0))];

    if (uniqueUserIds.length === 0) {
      return;
    }

    const rows = await this.getClosedGameRowsForUsers(uniqueUserIds, {}, prisma);
    const groupedRows = this.groupRowsByUser(rows);

    for (const userId of uniqueUserIds) {
      const stats = calculatePlayerStats(groupedRows.get(userId) ?? []);

      if (!stats) {
        await prisma.playerStats.deleteMany({
          where: {
            userId
          }
        });

        continue;
      }

      await prisma.playerStats.upsert({
        where: {
          userId
        },
        create: {
          userId,
          gamesCount: stats.gamesCount,
          totalBuyinsMinor: stats.totalBuyinsMinor,
          totalProfitMinor: stats.totalProfitMinor,
          avgProfitMinor: stats.avgProfitMinor,
          roiBps: stats.roiBps,
          winRateBps: stats.winRateBps,
          stabilityScoreBps: stats.stabilityScoreBps,
          pokerScore: stats.pokerScore
        },
        update: {
          gamesCount: stats.gamesCount,
          totalBuyinsMinor: stats.totalBuyinsMinor,
          totalProfitMinor: stats.totalProfitMinor,
          avgProfitMinor: stats.avgProfitMinor,
          roiBps: stats.roiBps,
          winRateBps: stats.winRateBps,
          stabilityScoreBps: stats.stabilityScoreBps,
          pokerScore: stats.pokerScore
        }
      });
    }
  }

  private async getAllUserIdsWithClosedGames(
    prisma: PrismaService | Prisma.TransactionClient = this.prisma
  ): Promise<string[]> {
    const rows = await prisma.roomPlayer.findMany({
      where: this.buildClosedParticipationWhere(),
      select: {
        userId: true
      },
      distinct: ["userId"]
    });

    return rows.map((row) => row.userId);
  }

  private async getPlayedWithMeUserIds(
    userId: string,
    prisma: PrismaService | Prisma.TransactionClient = this.prisma
  ): Promise<string[]> {
    const roomIds = await this.getClosedRoomIdsForUser(userId, prisma);

    if (roomIds.length === 0) {
      return [];
    }

    const rows = await prisma.roomPlayer.findMany({
      where: {
        roomId: {
          in: roomIds
        },
        finalAmountMinor: {
          not: null
        },
        netResultMinor: {
          not: null
        }
      },
      select: {
        userId: true
      },
      distinct: ["userId"]
    });

    return rows.map((row) => row.userId);
  }

  private async hasSharedClosedRoom(
    viewerUserId: string,
    targetUserId: string,
    prisma: PrismaService | Prisma.TransactionClient = this.prisma
  ): Promise<boolean> {
    const roomIds = await this.getClosedRoomIdsForUser(viewerUserId, prisma);

    if (roomIds.length === 0) {
      return false;
    }

    const sharedMembership = await prisma.roomPlayer.findFirst({
      where: {
        userId: targetUserId,
        roomId: {
          in: roomIds
        },
        finalAmountMinor: {
          not: null
        },
        netResultMinor: {
          not: null
        }
      },
      select: {
        id: true
      }
    });

    return Boolean(sharedMembership);
  }

  private async getClosedRoomIdsForUser(
    userId: string,
    prisma: PrismaService | Prisma.TransactionClient = this.prisma
  ): Promise<string[]> {
    const memberships = await prisma.roomPlayer.findMany({
      where: this.buildClosedParticipationWhere({
        userIds: [userId]
      }),
      select: {
        roomId: true
      }
    });

    return [...new Set(memberships.map((membership) => membership.roomId))];
  }

  private async getClosedGameRowsForUsers(
    userIds: string[],
    options: {
      closedAtGte?: Date | null;
      closedAtLt?: Date | null;
    } = {},
    prisma: PrismaService | Prisma.TransactionClient = this.prisma
  ): Promise<ClosedGameStatRow[]> {
    if (userIds.length === 0) {
      return [];
    }

    const records = (await prisma.roomPlayer.findMany({
      where: this.buildClosedParticipationWhere({
        userIds,
        closedAtGte: options.closedAtGte ?? null,
        closedAtLt: options.closedAtLt ?? null
      }),
      include: {
        user: true,
        rebuyEvents: {
          where: {
            status: PrismaRebuyEventStatus.ACTIVE
          },
          select: {
            amountMinor: true
          }
        },
        room: {
          select: {
            id: true,
            title: true,
            currency: true,
            rebuyAmountMinor: true,
            closedAt: true,
            status: true,
            players: {
              where: {
                finalAmountMinor: {
                  not: null
                },
                netResultMinor: {
                  not: null
                }
              },
              select: {
                id: true
              }
            }
          }
        }
      }
    })) as ClosedGameParticipationRecord[];

    return records
      .map((record) => {
        if (
          record.room.status !== PrismaRoomStatus.CLOSED ||
          record.room.closedAt === null ||
          record.finalAmountMinor === null ||
          record.netResultMinor === null
        ) {
          return null;
        }

        return {
          userId: record.userId,
          displayName: getUserDisplayName(record.user),
          username: record.user.username ?? null,
          roomId: record.room.id,
          title: record.room.title,
          currency: record.room.currency,
          closedAt: record.room.closedAt,
          rebuyAmountMinor: record.room.rebuyAmountMinor,
          totalBuyinMinor: record.rebuyEvents.reduce(
            (sum, rebuy) => sum + rebuy.amountMinor,
            0n
          ),
          finalAmountMinor: record.finalAmountMinor,
          netResultMinor: record.netResultMinor,
          playersCount: record.room.players.length
        } satisfies ClosedGameStatRow;
      })
      .filter((row): row is ClosedGameStatRow => row !== null)
      .sort(compareClosedGameRowsDesc);
  }

  private groupRowsByUser(rows: ClosedGameStatRow[]): Map<string, ClosedGameStatRow[]> {
    const groupedRows = new Map<string, ClosedGameStatRow[]>();

    for (const row of rows) {
      const currentRows = groupedRows.get(row.userId) ?? [];

      currentRows.push(row);
      groupedRows.set(row.userId, currentRows);
    }

    return groupedRows;
  }

  private collectIdentities(rows: ClosedGameStatRow[]): Map<string, PlayerIdentity> {
    const identities = new Map<string, PlayerIdentity>();

    for (const row of rows) {
      if (identities.has(row.userId)) {
        continue;
      }

      identities.set(row.userId, {
        userId: row.userId,
        displayName: row.displayName,
        username: row.username
      });
    }

    return identities;
  }

  private selectRowsForPeriod(
    rows: ClosedGameStatRow[],
    period: GetLeaderboardQueryDto["period"]
  ): ClosedGameStatRow[] {
    if (period !== "last-10") {
      return rows;
    }

    return rows.slice(0, 10);
  }

  private buildClosedParticipationWhere({
    userIds,
    closedAtGte,
    closedAtLt
  }: {
    userIds?: string[];
    closedAtGte?: Date | null;
    closedAtLt?: Date | null;
  } = {}): Prisma.RoomPlayerWhereInput {
    const closedAtFilter: Prisma.DateTimeNullableFilter = {
      not: null
    };

    if (closedAtGte) {
      closedAtFilter.gte = closedAtGte;
    }

    if (closedAtLt) {
      closedAtFilter.lt = closedAtLt;
    }

    return {
      ...(userIds ? { userId: { in: userIds } } : {}),
      finalAmountMinor: {
        not: null
      },
      netResultMinor: {
        not: null
      },
      room: {
        is: {
          status: PrismaRoomStatus.CLOSED,
          closedAt: closedAtFilter
        }
      }
    };
  }
}

function toPlayerProfileStatsDto(
  stats: NonNullable<ReturnType<typeof calculatePlayerStats>>
): PlayerProfileStatsDto {
  return {
    gamesCount: stats.gamesCount,
    totalBuyinsMinor: stats.totalBuyinsMinor.toString(),
    totalProfitMinor: stats.totalProfitMinor.toString(),
    roiBps: stats.roiBps,
    winRateBps: stats.winRateBps,
    stabilityScoreBps: stats.stabilityScoreBps,
    avgProfitMinor: stats.avgProfitMinor.toString(),
    pokerScore: stats.pokerScore,
    bestGameMinor: stats.bestGameMinor.toString(),
    worstGameMinor: stats.worstGameMinor.toString()
  };
}

function createEmptyPlayerProfileStats(): PlayerProfileStatsDto {
  return {
    gamesCount: 0,
    totalBuyinsMinor: "0",
    totalProfitMinor: "0",
    roiBps: 0,
    winRateBps: 0,
    stabilityScoreBps: 0,
    avgProfitMinor: "0",
    pokerScore: 0,
    bestGameMinor: "0",
    worstGameMinor: "0"
  };
}

function toRecentGameDto(row: ClosedGameStatRow): RecentPlayerGameDto {
  return {
    roomId: row.roomId,
    title: row.title,
    status: "CLOSED",
    closedAt: row.closedAt.toISOString(),
    myNetResultMinor: row.netResultMinor.toString(),
    playersCount: row.playersCount,
    currency: row.currency
  };
}

function compareClosedGameRowsDesc(left: ClosedGameStatRow, right: ClosedGameStatRow): number {
  const timeDifference = right.closedAt.getTime() - left.closedAt.getTime();

  if (timeDifference !== 0) {
    return timeDifference;
  }

  return left.roomId.localeCompare(right.roomId);
}

function getUserDisplayName(user: User): string {
  return user.firstName ?? user.username ?? "Игрок";
}

function getCurrentMonthRange(now: Date): { start: Date; endExclusive: Date } {
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const endExclusive = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  return {
    start,
    endExclusive
  };
}

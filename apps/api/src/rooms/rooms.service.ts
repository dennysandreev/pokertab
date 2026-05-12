import { HttpStatus, Injectable, Optional } from "@nestjs/common";
import {
  IdempotencyAction,
  Prisma,
  RebuyEventSource as PrismaRebuyEventSource,
  RebuyEventStatus as PrismaRebuyEventStatus,
  SettlementStatus as PrismaSettlementStatus,
  type RebuyEvent,
  type Room,
  type RoomPlayer,
  RoomPlayerRole as PrismaRoomPlayerRole,
  RoomPlayerStatus as PrismaRoomPlayerStatus,
  RoomStatus as PrismaRoomStatus,
  type User
} from "@prisma/client";
import {
  type CancelRebuyRequestDto,
  type CancelRebuyResponseDto,
  type CloseSettlementRequestDto,
  type CloseSettlementResponseDto,
  type CreateRoomRequestDto,
  type CreateRoomResponseDto,
  type CreateRebuyRequestDto,
  type CreateRebuyResponseDto,
  type GetRebuyHistoryResponseDto,
  type GetRoomResponseDto,
  type JoinRoomRequestDto,
  type JoinRoomResponseDto,
  type RoomSettlementDto,
  type RoomsListResponseDto,
  type SettlementPlayerResultDto,
  type SettlementFinalAmountInputDto,
  type SettlementPreviewRequestDto,
  type SettlementPreviewResponseDto,
  type SettlementTransferDto,
  type StartRoomResponseDto,
  type UserDto
} from "@pokertable/shared";
import { randomBytes } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import { PlayerStatsService } from "../player-stats/player-stats.service";
import { ApiError } from "../shared/api-error";
import { ROOM_ERROR_CODES } from "./rooms.constants";
import {
  calculatePlayerNetResults,
  calculateTransfers,
  validateSettlementBalance,
  type SettlementPlayerNetResult
} from "./settlement-calculations";

const GAME_TYPES: readonly CreateRoomRequestDto["gameType"][] = [
  "CASH",
  "TOURNAMENT",
  "SIMPLE_TRACKING"
] as const;
const ROOM_TITLE_MAX_LENGTH = 80;
const ROOM_SUPPORTED_CURRENCIES = ["RUB", "USD", "EUR"] as const;
const ROOM_MAX_REBUY_AMOUNT_MINOR = 1_000_000_000n;
const ROOM_MAX_STARTING_STACK = 1_000_000;
const REBUY_PERMISSIONS = ["PLAYER_SELF", "ADMIN_APPROVAL", "ADMIN_ONLY"] as const;
const ROOM_START_PARAM_PREFIX = "room_";
const ZERO_REBUY_TOTALS = {
  rebuyCount: 0,
  totalBuyinMinor: 0n
} as const;

type RoomMembershipWithRoom = RoomPlayer & {
  room: Room & {
    players: Pick<RoomPlayer, "status">[];
  };
};

type RebuyHistoryRecord = RebuyEvent & {
  roomPlayer: RoomPlayer & {
    user: User;
  };
  createdByUser: User;
  cancelledByUser: User | null;
};

type RebuySummary = {
  roomTotals: Map<string, bigint>;
  playerTotals: Map<
    string,
    {
      rebuyCount: number;
      totalBuyinMinor: bigint;
    }
  >;
};

type ActiveSettlementPlayer = RoomPlayer & {
  user: User;
};

type SettlementPreviewData = {
  response: SettlementPreviewResponseDto;
  calculatedPlayers: SettlementPlayerNetResult[];
  transfers: SettlementTransferDto[];
};

type RoomSettlementRecord = {
  id: string;
  status: PrismaSettlementStatus;
  totalBuyinsMinor: bigint;
  totalFinalAmountMinor: bigint;
  differenceMinor: bigint;
  calculatedAt: Date;
  transfers: Array<{
    fromRoomPlayerId: string;
    toRoomPlayerId: string;
    amountMinor: bigint;
    fromPlayer: RoomPlayer & {
      user: User;
    };
    toPlayer: RoomPlayer & {
      user: User;
    };
  }>;
};

class DuplicateIdempotencyReservationError extends Error {}

@Injectable()
export class RoomsService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly playerStatsService?: PlayerStatsService
  ) {}

  async listRooms(user: UserDto): Promise<RoomsListResponseDto> {
    const memberships = await this.prisma.roomPlayer.findMany({
      where: {
        userId: user.id,
        status: {
          not: PrismaRoomPlayerStatus.REMOVED
        }
      },
      include: {
        room: {
          include: {
            players: {
              select: {
                status: true
              }
            }
          }
        }
      },
      orderBy: {
        joinedAt: "desc"
      }
    });

    const rebuySummary = await this.getActiveRebuySummary(
      memberships.map((membership) => membership.room.id)
    );

    const active = memberships
      .filter(
        ({ room }) =>
          room.status !== PrismaRoomStatus.CLOSED &&
          room.status !== PrismaRoomStatus.CANCELLED
      )
      .map((membership) => this.toRoomListItem(membership, rebuySummary));

    const recent = memberships
      .filter(({ room }) => room.status === PrismaRoomStatus.CLOSED)
      .sort((left, right) => {
        const leftTime = left.room.closedAt?.getTime() ?? 0;
        const rightTime = right.room.closedAt?.getTime() ?? 0;

        return rightTime - leftTime;
      })
      .map((membership) => {
        const roomListItem = this.toRoomListItem(membership, rebuySummary);

        return {
          ...roomListItem,
          ...(membership.room.closedAt
            ? {
                closedAt: membership.room.closedAt.toISOString()
              }
            : {}),
          myNetResultMinor: membership.netResultMinor?.toString() ?? "0"
        };
      });

    return {
      active,
      recent
    };
  }

  async createRoom(
    user: UserDto,
    input: CreateRoomRequestDto
  ): Promise<CreateRoomResponseDto> {
    this.validateCreateRoomInput(input);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const inviteCode = this.createInviteCode();

      try {
        const room = await this.prisma.$transaction(async (tx) => {
          const createdRoom = await tx.room.create({
            data: {
              ownerUserId: user.id,
              title: input.title.trim(),
              currency: input.currency.trim().toUpperCase(),
              rebuyAmountMinor: BigInt(input.rebuyAmountMinor),
              startingStack: input.startingStack,
              gameType: input.gameType,
              rebuyPermission: input.rebuyPermission,
              inviteCode,
              status: PrismaRoomStatus.WAITING
            }
          });

          await tx.roomPlayer.create({
            data: {
              roomId: createdRoom.id,
              userId: user.id,
              displayName: getDisplayName(user),
              role: PrismaRoomPlayerRole.OWNER,
              status: PrismaRoomPlayerStatus.ACTIVE
            }
          });

          return createdRoom;
        });

        return {
          room: {
            id: room.id,
            title: room.title,
            status: room.status,
            inviteCode: room.inviteCode,
            inviteUrl: buildRoomInviteUrl(room.inviteCode)
          }
        };
      } catch (error) {
        if (this.isUniqueConstraintError(error)) {
          continue;
        }

        throw error;
      }
    }

    throw new ApiError(
      ROOM_ERROR_CODES.invalidInput,
      "Не удалось создать ссылку приглашения",
      HttpStatus.INTERNAL_SERVER_ERROR
    );
  }

  async getRoom(user: UserDto, roomId: string): Promise<GetRoomResponseDto> {
    const membership = await this.getAccessibleMembership(user.id, roomId);
    const room = await this.prisma.room.findUnique({
      where: {
        id: roomId
      },
      include: {
        players: {
          include: {
            user: true
          },
          orderBy: {
            joinedAt: "asc"
          }
        }
      }
    });

    if (!room) {
      throw new ApiError(
        ROOM_ERROR_CODES.notFound,
        "Игра не найдена",
        HttpStatus.NOT_FOUND
      );
    }

    const rebuySummary = await this.getActiveRebuySummary([roomId]);
    const roomTotalPotMinor = rebuySummary.roomTotals.get(roomId) ?? 0n;
    const myBuyinsMinor = rebuySummary.playerTotals.get(membership.id)?.totalBuyinMinor ?? 0n;
    const settlement =
      room.status === PrismaRoomStatus.CLOSED
        ? await this.getLatestRoomSettlementSnapshot(roomId, room.players, rebuySummary)
        : null;

    return {
      room: {
        id: room.id,
        title: room.title,
        status: room.status,
        currency: room.currency,
        rebuyAmountMinor: room.rebuyAmountMinor.toString(),
        startingStack: room.startingStack,
        gameType: room.gameType,
        rebuyPermission: room.rebuyPermission,
        inviteCode: room.inviteCode,
        inviteUrl: buildRoomInviteUrl(room.inviteCode),
        totalPotMinor: roomTotalPotMinor.toString(),
        myBuyinsMinor: myBuyinsMinor.toString(),
        playersCount: room.players.filter(isActivePlayer).length,
        myRole: membership.role,
        myPlayerId: membership.id,
        myPlayerStatus: membership.status,
        startedAt: room.startedAt?.toISOString() ?? null,
        createdAt: room.createdAt.toISOString()
      },
      players: room.players.map((player) => {
        const totals = rebuySummary.playerTotals.get(player.id) ?? ZERO_REBUY_TOTALS;

        return {
          id: player.id,
          userId: player.userId,
          displayName: player.displayName ?? getUserDisplayName(player.user),
          role: player.role,
          status: player.status,
          rebuyCount: totals.rebuyCount,
          totalBuyinMinor: totals.totalBuyinMinor.toString(),
          finalAmountMinor: player.finalAmountMinor?.toString() ?? null,
          netResultMinor: player.netResultMinor?.toString() ?? null
        };
      }),
      settlement
    };
  }

  async joinRoom(
    user: UserDto,
    input: JoinRoomRequestDto
  ): Promise<JoinRoomResponseDto> {
    const inviteCode = input.inviteCode.trim();

    if (inviteCode.length === 0) {
      throw new ApiError(
        ROOM_ERROR_CODES.invalidInput,
        "Нужен код приглашения",
        HttpStatus.BAD_REQUEST
      );
    }

    const room = await this.prisma.room.findUnique({
      where: {
        inviteCode
      }
    });

    if (!room) {
      throw new ApiError(
        ROOM_ERROR_CODES.notFound,
        "Игра не найдена",
        HttpStatus.NOT_FOUND
      );
    }

    if (room.status === PrismaRoomStatus.CLOSED || room.status === PrismaRoomStatus.CANCELLED) {
      throw new ApiError(
        ROOM_ERROR_CODES.closedJoinBlocked,
        "В эту игру уже нельзя присоединиться",
        HttpStatus.CONFLICT
      );
    }

    const existingMembership = await this.prisma.roomPlayer.findUnique({
      where: {
        roomId_userId: {
          roomId: room.id,
          userId: user.id
        }
      }
    });

    if (existingMembership?.status === PrismaRoomPlayerStatus.REMOVED) {
      throw new ApiError(
        ROOM_ERROR_CODES.removedJoinBlocked,
        "Админ закрыл вам доступ к этой игре",
        HttpStatus.FORBIDDEN
      );
    }

    if (existingMembership?.status === PrismaRoomPlayerStatus.ACTIVE) {
      return {
        roomId: room.id,
        status: room.status,
        playerId: existingMembership.id
      };
    }

    if (existingMembership?.status === PrismaRoomPlayerStatus.LEFT) {
      const restoredMembership = await this.prisma.roomPlayer.update({
        where: {
          id: existingMembership.id
        },
        data: {
          status: PrismaRoomPlayerStatus.ACTIVE,
          removedAt: null,
          displayName: getDisplayName(user)
        }
      });

      return {
        roomId: room.id,
        status: room.status,
        playerId: restoredMembership.id
      };
    }

    const membership = await this.prisma.roomPlayer.create({
      data: {
        roomId: room.id,
        userId: user.id,
        displayName: getDisplayName(user),
        role: PrismaRoomPlayerRole.PLAYER,
        status: PrismaRoomPlayerStatus.ACTIVE
      }
    });

    return {
      roomId: room.id,
      status: room.status,
      playerId: membership.id
    };
  }

  async startRoom(user: UserDto, roomId: string): Promise<StartRoomResponseDto> {
    const membership = await this.getAccessibleMembership(user.id, roomId);

    if (!isRoomAdmin(membership.role)) {
      throw new ApiError(
        ROOM_ERROR_CODES.startForbidden,
        "Начать игру может только админ",
        HttpStatus.FORBIDDEN
      );
    }

    const room = await this.prisma.room.findUnique({
      where: {
        id: roomId
      },
      include: {
        players: true
      }
    });

    if (!room) {
      throw new ApiError(
        ROOM_ERROR_CODES.notFound,
        "Игра не найдена",
        HttpStatus.NOT_FOUND
      );
    }

    if (room.status !== PrismaRoomStatus.WAITING) {
      throw new ApiError(
        ROOM_ERROR_CODES.invalidStatus,
        "Игру можно начать только из ожидания",
        HttpStatus.CONFLICT
      );
    }

    const activePlayersCount = room.players.filter(isActivePlayer).length;

    if (activePlayersCount < 2) {
      throw new ApiError(
        ROOM_ERROR_CODES.startRequiresPlayers,
        "Чтобы начать игру, нужно хотя бы два игрока",
        HttpStatus.CONFLICT
      );
    }

    const startedAt = new Date();
    const updatedRoom = await this.prisma.room.update({
      where: {
        id: roomId
      },
      data: {
        status: PrismaRoomStatus.RUNNING,
        startedAt
      }
    });

    return {
      roomId: updatedRoom.id,
      status: updatedRoom.status,
      startedAt: startedAt.toISOString()
    };
  }

  async createRebuy(
    user: UserDto,
    roomId: string,
    input: CreateRebuyRequestDto
  ): Promise<CreateRebuyResponseDto> {
    const requestHash = JSON.stringify({
      roomId,
      roomPlayerId: input.roomPlayerId
    });
    const storedResponse = await this.getStoredIdempotentResponse<CreateRebuyResponseDto>({
      userId: user.id,
      roomId,
      action: IdempotencyAction.CREATE_REBUY,
      idempotencyKey: input.idempotencyKey,
      requestHash
    });

    if (storedResponse) {
      return storedResponse;
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const membership = await this.getAccessibleMembership(user.id, roomId, tx);
        const room = await this.getRoomOrThrow(roomId, tx);

        this.assertRunningRoom(room.status, "Сейчас ребаи можно добавлять только во время игры");

        const targetPlayer = await tx.roomPlayer.findUnique({
          where: {
            id: input.roomPlayerId
          },
          include: {
            user: true
          }
        });

        if (!targetPlayer || targetPlayer.roomId !== roomId) {
          throw new ApiError(
            ROOM_ERROR_CODES.rebuyPlayerUnavailable,
            "Не удалось найти игрока для ребая",
            HttpStatus.NOT_FOUND
          );
        }

        if (targetPlayer.status !== PrismaRoomPlayerStatus.ACTIVE) {
          throw new ApiError(
            ROOM_ERROR_CODES.rebuyPlayerUnavailable,
            "Ребай можно добавить только игроку за столом",
            HttpStatus.CONFLICT
          );
        }

        const isAdmin = isRoomAdmin(membership.role);
        const isSelfRebuy = membership.id === targetPlayer.id;

        if (!isAdmin && !isSelfRebuy) {
          throw new ApiError(
            ROOM_ERROR_CODES.rebuyForbidden,
            "Можно добавлять ребай только себе",
            HttpStatus.FORBIDDEN
          );
        }

        if (!isAdmin && room.rebuyPermission !== "PLAYER_SELF") {
          throw new ApiError(
            ROOM_ERROR_CODES.rebuyForbidden,
            "Сейчас ребай добавляет админ",
            HttpStatus.FORBIDDEN
          );
        }

        const reservation = await this.reserveIdempotencyKey(tx, {
          userId: user.id,
          roomId,
          action: IdempotencyAction.CREATE_REBUY,
          idempotencyKey: input.idempotencyKey,
          requestHash
        });

        const rebuy = await tx.rebuyEvent.create({
          data: {
            roomId,
            roomPlayerId: targetPlayer.id,
            amountMinor: room.rebuyAmountMinor,
            createdByUserId: user.id,
            source: getRebuySource({
              isAdmin,
              isSelfRebuy,
              rebuyPermission: room.rebuyPermission
            })
          }
        });
        const summary = await this.getActiveRebuySummary([roomId], tx);
        const playerTotals = summary.playerTotals.get(targetPlayer.id) ?? ZERO_REBUY_TOTALS;
        const response: CreateRebuyResponseDto = {
          rebuy: {
            id: rebuy.id,
            roomId: rebuy.roomId,
            roomPlayerId: rebuy.roomPlayerId,
            amountMinor: rebuy.amountMinor.toString(),
            source: rebuy.source,
            status: rebuy.status,
            createdAt: rebuy.createdAt.toISOString()
          },
          playerTotals: {
            rebuyCount: playerTotals.rebuyCount,
            totalBuyinMinor: playerTotals.totalBuyinMinor.toString()
          },
          roomTotals: {
            totalPotMinor: (summary.roomTotals.get(roomId) ?? 0n).toString()
          }
        };

        await tx.idempotencyKey.update({
          where: {
            id: reservation.id
          },
          data: {
            responseJson: response,
            rebuyEventId: rebuy.id
          }
        });

        return response;
      });
    } catch (error) {
      if (error instanceof DuplicateIdempotencyReservationError) {
        return this.getDuplicateIdempotentResponse<CreateRebuyResponseDto>({
          userId: user.id,
          roomId,
          action: IdempotencyAction.CREATE_REBUY,
          idempotencyKey: input.idempotencyKey,
          requestHash
        });
      }

      throw error;
    }
  }

  async cancelRebuy(
    user: UserDto,
    roomId: string,
    rebuyId: string,
    input: CancelRebuyRequestDto
  ): Promise<CancelRebuyResponseDto> {
    const requestHash = JSON.stringify({
      roomId,
      rebuyId,
      reason: input.reason ?? null
    });
    const storedResponse = await this.getStoredIdempotentResponse<CancelRebuyResponseDto>({
      userId: user.id,
      roomId,
      action: IdempotencyAction.CANCEL_REBUY,
      idempotencyKey: input.idempotencyKey,
      requestHash
    });

    if (storedResponse) {
      return storedResponse;
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const membership = await this.getAccessibleMembership(user.id, roomId, tx);

        if (!isRoomAdmin(membership.role)) {
          throw new ApiError(
            ROOM_ERROR_CODES.rebuyForbidden,
            "Отменить ребай может только админ",
            HttpStatus.FORBIDDEN
          );
        }

        const room = await this.getRoomOrThrow(roomId, tx);

        this.assertRunningRoom(room.status, "Отменить ребай можно только во время игры");

        const rebuy = await tx.rebuyEvent.findUnique({
          where: {
            id: rebuyId
          }
        });

        if (!rebuy || rebuy.roomId !== roomId) {
          throw new ApiError(
            ROOM_ERROR_CODES.rebuyNotFound,
            "Ребай не найден",
            HttpStatus.NOT_FOUND
          );
        }

        if (rebuy.status === PrismaRebuyEventStatus.CANCELLED) {
          throw new ApiError(
            ROOM_ERROR_CODES.rebuyAlreadyCancelled,
            "Этот ребай уже отменён",
            HttpStatus.CONFLICT
          );
        }

        const reservation = await this.reserveIdempotencyKey(tx, {
          userId: user.id,
          roomId,
          action: IdempotencyAction.CANCEL_REBUY,
          idempotencyKey: input.idempotencyKey,
          requestHash
        });

        const cancelledAt = new Date();
        const updatedRebuy = await tx.rebuyEvent.update({
          where: {
            id: rebuy.id
          },
          data: {
            status: PrismaRebuyEventStatus.CANCELLED,
            cancelledAt,
            cancelledByUserId: user.id,
            cancellationReason: input.reason ?? null
          }
        });
        const summary = await this.getActiveRebuySummary([roomId], tx);
        const playerTotals = summary.playerTotals.get(updatedRebuy.roomPlayerId) ?? ZERO_REBUY_TOTALS;
        const response: CancelRebuyResponseDto = {
          rebuyId: updatedRebuy.id,
          status: updatedRebuy.status,
          cancelledAt: cancelledAt.toISOString(),
          cancelledByUserId: user.id,
          cancellationReason: updatedRebuy.cancellationReason ?? null,
          playerTotals: {
            rebuyCount: playerTotals.rebuyCount,
            totalBuyinMinor: playerTotals.totalBuyinMinor.toString()
          },
          roomTotals: {
            totalPotMinor: (summary.roomTotals.get(roomId) ?? 0n).toString()
          }
        };

        await tx.idempotencyKey.update({
          where: {
            id: reservation.id
          },
          data: {
            responseJson: response,
            rebuyEventId: updatedRebuy.id
          }
        });

        return response;
      });
    } catch (error) {
      if (error instanceof DuplicateIdempotencyReservationError) {
        return this.getDuplicateIdempotentResponse<CancelRebuyResponseDto>({
          userId: user.id,
          roomId,
          action: IdempotencyAction.CANCEL_REBUY,
          idempotencyKey: input.idempotencyKey,
          requestHash
        });
      }

      throw error;
    }
  }

  async getRebuyHistory(user: UserDto, roomId: string): Promise<GetRebuyHistoryResponseDto> {
    await this.getAccessibleMembership(user.id, roomId);
    const rebuys = await this.prisma.rebuyEvent.findMany({
      where: {
        roomId
      },
      include: {
        roomPlayer: {
          include: {
            user: true
          }
        },
        createdByUser: true,
        cancelledByUser: true
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    return {
      rebuys: rebuys.map((rebuy) => this.toRebuyHistoryItem(rebuy))
    };
  }

  async previewSettlement(
    user: UserDto,
    roomId: string,
    input: SettlementPreviewRequestDto
  ): Promise<SettlementPreviewResponseDto> {
    const membership = await this.getAccessibleMembership(user.id, roomId);

    this.assertSettlementAdmin(membership.role, "Посмотреть расчёт может только админ");

    const room = await this.getRoomOrThrow(roomId);

    this.assertSettlementRoomStatus(
      room.status,
      "Сейчас можно посмотреть расчёт только у активной игры"
    );

    const activePlayers = await this.getActiveSettlementPlayers(roomId);
    const rebuySummary = await this.getActiveRebuySummary([roomId]);

    return this.buildSettlementPreviewData(
      input.finalAmounts,
      activePlayers,
      rebuySummary
    ).response;
  }

  async closeSettlement(
    user: UserDto,
    roomId: string,
    input: CloseSettlementRequestDto
  ): Promise<CloseSettlementResponseDto> {
    return this.prisma.$transaction(async (tx) => {
      const membership = await this.getAccessibleMembership(user.id, roomId, tx);

      this.assertSettlementAdmin(membership.role, "Закрыть игру может только админ");

      const room = await this.getRoomOrThrow(roomId, tx);

      this.assertSettlementRoomStatus(room.status, "Эту игру уже нельзя закрыть повторно");

      const activePlayers = await this.getActiveSettlementPlayers(roomId, tx);
      const rebuySummary = await this.getActiveRebuySummary([roomId], tx);
      const settlementPreview = this.buildSettlementPreviewData(
        input.finalAmounts,
        activePlayers,
        rebuySummary
      );
      const differenceMinor = BigInt(settlementPreview.response.differenceMinor);

      if (differenceMinor !== 0n) {
        throw new ApiError(
          ROOM_ERROR_CODES.settlementNotBalanced,
          getSettlementBalanceMessage(differenceMinor),
          HttpStatus.CONFLICT
        );
      }

      for (const player of settlementPreview.calculatedPlayers) {
        await tx.roomPlayer.update({
          where: {
            id: player.roomPlayerId
          },
          data: {
            finalAmountMinor: player.finalAmountMinor,
            netResultMinor: player.netResultMinor
          }
        });
      }

      const settlement = await tx.settlement.create({
        data: {
          roomId,
          status: PrismaSettlementStatus.CLOSED,
          totalBuyinsMinor: BigInt(settlementPreview.response.totalBuyinsMinor),
          totalFinalAmountMinor: BigInt(settlementPreview.response.totalFinalAmountMinor),
          differenceMinor,
          closedByUserId: user.id
        }
      });

      if (settlementPreview.transfers.length > 0) {
        await tx.settlementTransfer.createMany({
          data: settlementPreview.transfers.map((transfer) => ({
            settlementId: settlement.id,
            fromRoomPlayerId: transfer.fromRoomPlayerId,
            toRoomPlayerId: transfer.toRoomPlayerId,
            amountMinor: BigInt(transfer.amountMinor)
          }))
        });
      }

      const closedAt = new Date();
      const updatedRoom = await tx.room.update({
        where: {
          id: roomId
        },
        data: {
          status: PrismaRoomStatus.CLOSED,
          closedAt
        }
      });

      await this.playerStatsService?.recalculateAndUpsertPlayerStats(
        activePlayers.map((player) => player.userId),
        tx
      );

      return {
        roomId: updatedRoom.id,
        status: updatedRoom.status,
        settlementId: settlement.id
      };
    });
  }

  private validateCreateRoomInput(input: CreateRoomRequestDto): void {
    const title = input.title.trim();
    const currency = input.currency.trim().toUpperCase();
    const rebuyAmountMinor = /^\d+$/.test(input.rebuyAmountMinor) ? BigInt(input.rebuyAmountMinor) : null;

    if (title.length === 0) {
      throw new ApiError(
        ROOM_ERROR_CODES.invalidInput,
        "Укажите название игры",
        HttpStatus.BAD_REQUEST
      );
    }

    if (title.length > ROOM_TITLE_MAX_LENGTH) {
      throw new ApiError(
        ROOM_ERROR_CODES.invalidInput,
        "Название слишком длинное",
        HttpStatus.BAD_REQUEST
      );
    }

    if (currency.length === 0) {
      throw new ApiError(
        ROOM_ERROR_CODES.invalidInput,
        "Выберите валюту",
        HttpStatus.BAD_REQUEST
      );
    }

    if (!ROOM_SUPPORTED_CURRENCIES.includes(currency as (typeof ROOM_SUPPORTED_CURRENCIES)[number])) {
      throw new ApiError(
        ROOM_ERROR_CODES.invalidInput,
        "Выберите рубли, доллары или евро",
        HttpStatus.BAD_REQUEST
      );
    }

    if (rebuyAmountMinor === null || rebuyAmountMinor <= 0n) {
      throw new ApiError(
        ROOM_ERROR_CODES.invalidInput,
        "Сумма ребая должна быть больше нуля",
        HttpStatus.BAD_REQUEST
      );
    }

    if (rebuyAmountMinor > ROOM_MAX_REBUY_AMOUNT_MINOR) {
      throw new ApiError(
        ROOM_ERROR_CODES.invalidInput,
        "Сумма ребая слишком большая",
        HttpStatus.BAD_REQUEST
      );
    }

    if (
      input.startingStack !== null &&
      (!Number.isInteger(input.startingStack) || input.startingStack <= 0)
    ) {
      throw new ApiError(
        ROOM_ERROR_CODES.invalidInput,
        "Стартовый стек должен быть больше нуля",
        HttpStatus.BAD_REQUEST
      );
    }

    if (input.startingStack !== null && input.startingStack > ROOM_MAX_STARTING_STACK) {
      throw new ApiError(
        ROOM_ERROR_CODES.invalidInput,
        "Стартовый стек слишком большой",
        HttpStatus.BAD_REQUEST
      );
    }

    if (!GAME_TYPES.includes(input.gameType)) {
      throw new ApiError(
        ROOM_ERROR_CODES.invalidInput,
        "Не удалось определить формат игры",
        HttpStatus.BAD_REQUEST
      );
    }

    if (!REBUY_PERMISSIONS.includes(input.rebuyPermission)) {
      throw new ApiError(
        ROOM_ERROR_CODES.invalidInput,
        "Не удалось определить правила ребаев",
        HttpStatus.BAD_REQUEST
      );
    }
  }

  private async getAccessibleMembership(
    userId: string,
    roomId: string,
    prisma: PrismaService | Prisma.TransactionClient = this.prisma
  ): Promise<RoomPlayer> {
    const membership = await prisma.roomPlayer.findUnique({
      where: {
        roomId_userId: {
          roomId,
          userId
        }
      }
    });

    if (!membership) {
      throw new ApiError(
        ROOM_ERROR_CODES.accessDenied,
        "Эта игра доступна только участникам",
        HttpStatus.FORBIDDEN
      );
    }

    if (membership.status === PrismaRoomPlayerStatus.REMOVED) {
      throw new ApiError(
        ROOM_ERROR_CODES.accessDenied,
        "Админ закрыл вам доступ к этой игре",
        HttpStatus.FORBIDDEN
      );
    }

    return membership;
  }

  private async getRoomOrThrow(
    roomId: string,
    prisma: PrismaService | Prisma.TransactionClient = this.prisma
  ): Promise<Room> {
    const room = await prisma.room.findUnique({
      where: {
        id: roomId
      }
    });

    if (!room) {
      throw new ApiError(
        ROOM_ERROR_CODES.notFound,
        "Игра не найдена",
        HttpStatus.NOT_FOUND
      );
    }

    return room;
  }

  private assertSettlementAdmin(role: PrismaRoomPlayerRole, message: string): void {
    if (!isRoomAdmin(role)) {
      throw new ApiError(ROOM_ERROR_CODES.settlementForbidden, message, HttpStatus.FORBIDDEN);
    }
  }

  private assertSettlementRoomStatus(status: PrismaRoomStatus, message: string): void {
    if (status !== PrismaRoomStatus.RUNNING) {
      throw new ApiError(
        ROOM_ERROR_CODES.settlementInvalidStatus,
        message,
        HttpStatus.CONFLICT
      );
    }
  }

  private async getActiveSettlementPlayers(
    roomId: string,
    prisma: PrismaService | Prisma.TransactionClient = this.prisma
  ): Promise<ActiveSettlementPlayer[]> {
    return prisma.roomPlayer.findMany({
      where: {
        roomId,
        status: PrismaRoomPlayerStatus.ACTIVE
      },
      include: {
        user: true
      },
      orderBy: {
        joinedAt: "asc"
      }
    });
  }

  private buildSettlementPreviewData(
    finalAmounts: SettlementFinalAmountInputDto[],
    activePlayers: ActiveSettlementPlayer[],
    rebuySummary: RebuySummary
  ): SettlementPreviewData {
    const activePlayersById = new Map(activePlayers.map((player) => [player.id, player]));
    const finalAmountsByPlayerId = new Map<string, bigint>();

    for (const finalAmount of finalAmounts) {
      if (finalAmountsByPlayerId.has(finalAmount.roomPlayerId)) {
        throw new ApiError(
          ROOM_ERROR_CODES.invalidInput,
          "Укажите финальную сумму для каждого игрока только один раз",
          HttpStatus.BAD_REQUEST
        );
      }

      if (!activePlayersById.has(finalAmount.roomPlayerId)) {
        throw new ApiError(
          ROOM_ERROR_CODES.invalidInput,
          "Не удалось найти игрока для расчёта",
          HttpStatus.BAD_REQUEST
        );
      }

      finalAmountsByPlayerId.set(finalAmount.roomPlayerId, BigInt(finalAmount.finalAmountMinor));
    }

    if (finalAmountsByPlayerId.size !== activePlayers.length) {
      throw new ApiError(
        ROOM_ERROR_CODES.invalidInput,
        "Нужны финальные суммы всех игроков за столом",
        HttpStatus.BAD_REQUEST
      );
    }

    const calculatedPlayers = calculatePlayerNetResults(
      activePlayers.map((player) => ({
        roomPlayerId: player.id,
        displayName: getRoomPlayerDisplayName(player),
        totalBuyinMinor: rebuySummary.playerTotals.get(player.id)?.totalBuyinMinor ?? 0n,
        finalAmountMinor: finalAmountsByPlayerId.get(player.id) ?? 0n
      }))
    );
    const balance = validateSettlementBalance(calculatedPlayers);
    const players = calculatedPlayers.map((player) => ({
      roomPlayerId: player.roomPlayerId,
      displayName: player.displayName,
      totalBuyinMinor: player.totalBuyinMinor.toString(),
      finalAmountMinor: player.finalAmountMinor.toString(),
      netResultMinor: player.netResultMinor.toString()
    }));
    const transfers = balance.isBalanced
      ? calculateTransfers(calculatedPlayers).map((transfer) => {
          const fromPlayer = activePlayersById.get(transfer.fromRoomPlayerId);
          const toPlayer = activePlayersById.get(transfer.toRoomPlayerId);

          if (!fromPlayer || !toPlayer) {
            throw new ApiError(
              ROOM_ERROR_CODES.invalidInput,
              "Не удалось подготовить переводы по игрокам",
              HttpStatus.BAD_REQUEST
            );
          }

          return {
            fromRoomPlayerId: transfer.fromRoomPlayerId,
            fromName: getRoomPlayerDisplayName(fromPlayer),
            toRoomPlayerId: transfer.toRoomPlayerId,
            toName: getRoomPlayerDisplayName(toPlayer),
            amountMinor: transfer.amountMinor.toString()
          };
        })
      : [];

    return {
      response: {
        totalBuyinsMinor: balance.totalBuyinsMinor.toString(),
        totalFinalAmountMinor: balance.totalFinalAmountMinor.toString(),
        differenceMinor: balance.differenceMinor.toString(),
        players,
        transfers
      },
      calculatedPlayers,
      transfers
    };
  }

  private assertRunningRoom(status: PrismaRoomStatus, message: string): void {
    if (status !== PrismaRoomStatus.RUNNING) {
      throw new ApiError(ROOM_ERROR_CODES.rebuyInvalidStatus, message, HttpStatus.CONFLICT);
    }
  }

  private async getActiveRebuySummary(
    roomIds: string[],
    prisma: PrismaService | Prisma.TransactionClient = this.prisma
  ): Promise<RebuySummary> {
    const roomTotals = new Map<string, bigint>();
    const playerTotals = new Map<
      string,
      {
        rebuyCount: number;
        totalBuyinMinor: bigint;
      }
    >();

    if (roomIds.length === 0) {
      return {
        roomTotals,
        playerTotals
      };
    }

    const rebuys = await prisma.rebuyEvent.findMany({
      where: {
        roomId: {
          in: roomIds
        },
        status: PrismaRebuyEventStatus.ACTIVE
      },
      select: {
        roomId: true,
        roomPlayerId: true,
        amountMinor: true
      }
    });

    for (const rebuy of rebuys) {
      roomTotals.set(rebuy.roomId, (roomTotals.get(rebuy.roomId) ?? 0n) + rebuy.amountMinor);

      const currentPlayerTotals = playerTotals.get(rebuy.roomPlayerId) ?? {
        rebuyCount: 0,
        totalBuyinMinor: 0n
      };

      playerTotals.set(rebuy.roomPlayerId, {
        rebuyCount: currentPlayerTotals.rebuyCount + 1,
        totalBuyinMinor: currentPlayerTotals.totalBuyinMinor + rebuy.amountMinor
      });
    }

    return {
      roomTotals,
      playerTotals
    };
  }

  private async getStoredIdempotentResponse<T>({
    userId,
    roomId,
    action,
    idempotencyKey,
    requestHash
  }: {
    userId: string;
    roomId: string;
    action: IdempotencyAction;
    idempotencyKey: string;
    requestHash: string;
  }): Promise<T | null> {
    const record = await this.prisma.idempotencyKey.findUnique({
      where: {
        userId_action_idempotencyKey: {
          userId,
          action,
          idempotencyKey
        }
      }
    });

    if (!record) {
      return null;
    }

    if (record.roomId !== roomId || record.requestHash !== requestHash) {
      throw new ApiError(
        ROOM_ERROR_CODES.duplicateRequest,
        "Этот запрос уже выполнялся с другими данными. Попробуйте ещё раз.",
        HttpStatus.CONFLICT
      );
    }

    if (!record.responseJson) {
      throw new ApiError(
        ROOM_ERROR_CODES.duplicateRequest,
        "Похоже, такой запрос уже обрабатывается. Подождите пару секунд.",
        HttpStatus.CONFLICT
      );
    }

    return record.responseJson as T;
  }

  private async getDuplicateIdempotentResponse<T>(params: {
    userId: string;
    roomId: string;
    action: IdempotencyAction;
    idempotencyKey: string;
    requestHash: string;
  }): Promise<T> {
    const storedResponse = await this.getStoredIdempotentResponse<T>(params);

    if (!storedResponse) {
      throw new ApiError(
        ROOM_ERROR_CODES.duplicateRequest,
        "Не получилось повторно восстановить результат запроса",
        HttpStatus.CONFLICT
      );
    }

    return storedResponse;
  }

  private async reserveIdempotencyKey(
    prisma: Prisma.TransactionClient,
    {
      userId,
      roomId,
      action,
      idempotencyKey,
      requestHash
    }: {
      userId: string;
      roomId: string;
      action: IdempotencyAction;
      idempotencyKey: string;
      requestHash: string;
    }
  ) {
    try {
      return await prisma.idempotencyKey.create({
        data: {
          userId,
          roomId,
          action,
          idempotencyKey,
          requestHash
        }
      });
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new DuplicateIdempotencyReservationError();
      }

      throw error;
    }
  }

  private createInviteCode(): string {
    return randomBytes(6).toString("base64url");
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    );
  }

  private toRoomListItem(membership: RoomMembershipWithRoom, rebuySummary: RebuySummary) {
    const myBuyinsMinor = rebuySummary.playerTotals.get(membership.id)?.totalBuyinMinor ?? 0n;

    return {
      id: membership.room.id,
      title: membership.room.title,
      status: membership.room.status,
      currency: membership.room.currency,
      rebuyAmountMinor: membership.room.rebuyAmountMinor.toString(),
      playersCount: membership.room.players.filter(isActivePlayer).length,
      totalPotMinor: (rebuySummary.roomTotals.get(membership.room.id) ?? 0n).toString(),
      myBuyinsMinor: myBuyinsMinor.toString()
    };
  }

  private toRebuyHistoryItem(rebuy: RebuyHistoryRecord) {
    return {
      id: rebuy.id,
      roomId: rebuy.roomId,
      roomPlayerId: rebuy.roomPlayerId,
      playerName: getRoomPlayerDisplayName(rebuy.roomPlayer),
      amountMinor: rebuy.amountMinor.toString(),
      source: rebuy.source,
      status: rebuy.status,
      createdAt: rebuy.createdAt.toISOString(),
      createdByUserId: rebuy.createdByUserId,
      createdByName: getUserDisplayName(rebuy.createdByUser),
      cancelledAt: rebuy.cancelledAt?.toISOString() ?? null,
      cancelledByUserId: rebuy.cancelledByUserId ?? null,
      cancelledByName: rebuy.cancelledByUser ? getUserDisplayName(rebuy.cancelledByUser) : null,
      cancellationReason: rebuy.cancellationReason ?? null
    };
  }

  private async getLatestRoomSettlementSnapshot(
    roomId: string,
    players: Array<
      RoomPlayer & {
        user: User;
      }
    >,
    rebuySummary: RebuySummary
  ): Promise<RoomSettlementDto | null> {
    const settlement = (await this.prisma.settlement.findFirst({
      where: {
        roomId
      },
      include: {
        transfers: {
          include: {
            fromPlayer: {
              include: {
                user: true
              }
            },
            toPlayer: {
              include: {
                user: true
              }
            }
          }
        }
      },
      orderBy: {
        calculatedAt: "desc"
      }
    })) as RoomSettlementRecord | null;

    if (!settlement) {
      return null;
    }

    const settlementPlayers: SettlementPlayerResultDto[] = players
      .filter(
        (player) => player.finalAmountMinor !== null && player.netResultMinor !== null
      )
      .map((player) => {
        const totals = rebuySummary.playerTotals.get(player.id) ?? ZERO_REBUY_TOTALS;

        return {
          roomPlayerId: player.id,
          displayName: getRoomPlayerDisplayName(player),
          totalBuyinMinor: totals.totalBuyinMinor.toString(),
          finalAmountMinor: player.finalAmountMinor!.toString(),
          netResultMinor: player.netResultMinor!.toString()
        };
      });

    return {
      id: settlement.id,
      status: settlement.status,
      totalBuyinsMinor: settlement.totalBuyinsMinor.toString(),
      totalFinalAmountMinor: settlement.totalFinalAmountMinor.toString(),
      differenceMinor: settlement.differenceMinor.toString(),
      calculatedAt: settlement.calculatedAt.toISOString(),
      players: settlementPlayers,
      transfers: settlement.transfers.map((transfer) => ({
        fromRoomPlayerId: transfer.fromRoomPlayerId,
        fromName: getRoomPlayerDisplayName(transfer.fromPlayer),
        toRoomPlayerId: transfer.toRoomPlayerId,
        toName: getRoomPlayerDisplayName(transfer.toPlayer),
        amountMinor: transfer.amountMinor.toString()
      }))
    };
  }
}

function getDisplayName(user: UserDto): string {
  return user.firstName ?? user.username ?? "Игрок";
}

function getUserDisplayName(user: User): string {
  return user.firstName ?? user.username ?? "Игрок";
}

function getRoomPlayerDisplayName(
  player: RoomPlayer & {
    user: User;
  }
): string {
  return player.displayName ?? getUserDisplayName(player.user);
}

function isActivePlayer(player: { status: PrismaRoomPlayerStatus }): boolean {
  return player.status === PrismaRoomPlayerStatus.ACTIVE;
}

function isRoomAdmin(role: PrismaRoomPlayerRole): boolean {
  return role === PrismaRoomPlayerRole.OWNER || role === PrismaRoomPlayerRole.ADMIN;
}

function getRebuySource({
  isAdmin,
  isSelfRebuy,
  rebuyPermission
}: {
  isAdmin: boolean;
  isSelfRebuy: boolean;
  rebuyPermission: Room["rebuyPermission"];
}): PrismaRebuyEventSource {
  if (!isAdmin) {
    return PrismaRebuyEventSource.PLAYER_SELF;
  }

  if (isSelfRebuy && rebuyPermission === "PLAYER_SELF") {
    return PrismaRebuyEventSource.PLAYER_SELF;
  }

  return PrismaRebuyEventSource.ADMIN_FOR_PLAYER;
}

function buildRoomInviteUrl(inviteCode: string): string {
  const startParam = `${ROOM_START_PARAM_PREFIX}${inviteCode}`;
  const botUsername = process.env.TELEGRAM_BOT_USERNAME?.trim();

  if (botUsername) {
    return `https://t.me/${botUsername}/app?startapp=${startParam}`;
  }

  const webAppUrl = process.env.WEB_APP_URL?.trim() ?? "http://localhost:5173";
  const normalizedWebAppUrl = webAppUrl.endsWith("/")
    ? webAppUrl.slice(0, -1)
    : webAppUrl;

  return `${normalizedWebAppUrl}/join/${inviteCode}`;
}

function getSettlementBalanceMessage(differenceMinor: bigint): string {
  if (differenceMinor > 0n) {
    return "Финальных сумм введено больше, чем закупов.";
  }

  return "Финальных сумм введено меньше, чем закупов.";
}

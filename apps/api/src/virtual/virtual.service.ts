import { HttpStatus, Injectable, Optional } from "@nestjs/common";
import {
  advanceStreet,
  applyPlayerAction,
  calculateViewerWinProbability,
  completeShowdown,
  getLegalActions,
  getPrivateCards,
  isBettingRoundComplete,
  shuffleDeck,
  startHand,
  type EvaluatedHand,
  type HandRank,
  type Card,
  type HandState,
  type LegalAction,
  type PlayerAction
} from "@pokertable/poker-engine";
import {
  Prisma,
  ActionActorType as PrismaActionActorType,
  ActionType as PrismaActionType,
  HandPlayerStatus as PrismaHandPlayerStatus,
  PotType as PrismaPotType,
  Street as PrismaStreet,
  TurnTimerResolution as PrismaTurnTimerResolution,
  TurnTimerStatus as PrismaTurnTimerStatus,
  VirtualHandStatus as PrismaVirtualHandStatus,
  VirtualSeatRole as PrismaVirtualSeatRole,
  VirtualSeatStatus as PrismaVirtualSeatStatus,
  VirtualTableStatus as PrismaVirtualTableStatus,
  type CommunityCard,
  type TurnTimer,
  type User,
  type VirtualAction,
  type VirtualHand,
  type VirtualHandPlayer,
  type OnlinePlayerStats,
  type VirtualSeat,
  type VirtualTable,
  type VirtualTableReaction,
} from "@prisma/client";
import {
  VIRTUAL_TABLE_REACTION_EMOJIS,
  type CancelVirtualTableResponseDto,
  type CreateVirtualTableRequestDto,
  type GetVirtualHandHistoriesQueryDto,
  type GetVirtualHandHistoriesResponseDto,
  type GetMyVirtualStatsResponseDto,
  type GetVirtualHandHistoryResponseDto,
  type GetVirtualLeaderboardQueryDto,
  type GetVirtualLeaderboardResponseDto,
  type GetOpenVirtualTablesResponseDto,
  type GetVirtualPlayerProfileResponseDto,
  type CreateVirtualTableResponseDto,
  type FinishVirtualTableResponseDto,
  type GetVirtualTableResponseDto,
  type GetVirtualTablesResponseDto,
  type JoinVirtualTableRequestDto,
  type LeaderboardPeriod,
  type JoinVirtualTableResponseDto,
  type PauseVirtualTableResponseDto,
  type RaiseVirtualBlindsRequestDto,
  type RaiseVirtualBlindsResponseDto,
  type RequestVirtualSitOutRequestDto,
  type RequestVirtualSitOutResponseDto,
  type ResumeVirtualTableResponseDto,
  type ReturnToVirtualTableResponseDto,
  type StartNextVirtualHandResponseDto,
  type StartVirtualTableResponseDto,
  type SubmitVirtualActionRequestDto,
  type SubmitVirtualActionResponseDto,
  type SubmitVirtualReactionRequestDto,
  type SubmitVirtualReactionResponseDto,
  type UserDto,
  type VirtualHandDto,
  type VirtualHandResultSummaryDto,
  type VirtualLegalActionDto,
  type VirtualOnlineStatsDto,
  type VirtualProfileTrendPointDto,
  type VirtualRecentProfileResultDto,
  type VirtualRecentProfileTableDto,
  type VirtualSeatDto,
  type VirtualTableReactionDto,
  type VirtualTableSettlementDto,
  type VirtualTurnTimerDto
} from "@pokertable/shared";
import { randomBytes } from "node:crypto";
import { ClubsService } from "../clubs/clubs.service";
import { PrismaService } from "../prisma/prisma.service";
import { ApiError } from "../shared/api-error";
import { appendWebAppCacheBuster } from "../shared/web-app-url";
import { VirtualNotificationsService } from "./virtual-notifications.service";
import {
  VIRTUAL_ERROR_CODES,
  VIRTUAL_INVITE_CODE_ALPHABET,
  VIRTUAL_INVITE_CODE_LENGTH,
  VIRTUAL_INVITE_PATH,
  VIRTUAL_MAX_CHIPS,
  VIRTUAL_MAX_SEATS,
  VIRTUAL_MIN_SEATS,
  VIRTUAL_TABLE_TITLE_MAX_LENGTH
} from "./virtual.constants";
import {
  calculateCompletedVirtualHandStats,
  type OnlinePlayerStatsSnapshot,
  toOnlinePlayerStatsUpsertData
} from "./virtual-stats";
import { calculateVirtualPlayerStyleProfile } from "./virtual-style-stats";
import {
  decodeVirtualLeaderboardCursor,
  encodeVirtualLeaderboardCursor,
  type VirtualLeaderboardCursor
} from "./virtual-leaderboard-cursor";
import { calculateTransfers } from "../rooms/settlement-calculations";

type TableRecord = VirtualTable & {
  seats: Array<
    VirtualSeat & {
      user: User;
    }
  >;
};

type JoinableTableRecord = VirtualTable & {
  seats: VirtualSeat[];
};

type TableReactionRecord = VirtualTableReaction & {
  seat: VirtualSeat & {
    user: User;
  };
};

type HandRecord = VirtualHand & {
  players: Array<
    VirtualHandPlayer & {
      seat: VirtualSeat & {
        user: User;
      };
    }
  >;
  communityCards: CommunityCard[];
  pots: Array<{
    id: string;
    potType: PrismaPotType;
    amountChips: bigint;
    capChips: bigint | null;
    eligibleSeatIdsJson: Prisma.JsonValue;
    awards: Array<{
      winnerSeatId: string;
      amountChips: bigint;
      handRankJson: Prisma.JsonValue | null;
    }>;
  }>;
};

type HandHistoryRecord = HandRecord & {
  actions: Array<
    VirtualAction & {
      seat: (VirtualSeat & { user: User }) | null;
    }
  >;
};

type LeaderboardStatsRecord = OnlinePlayerStats & {
  user: User;
};

type DynamicLeaderboardRow = OnlinePlayerStatsSnapshot & {
  user: User;
};

type AggregationHandRecord = Pick<
  VirtualHand,
  "id" | "tableId" | "bigBlindChips" | "completedAt"
> & {
  players: Array<
    Pick<
      VirtualHandPlayer,
      | "seatId"
      | "status"
      | "startingStackChips"
      | "currentStackChips"
      | "isEligibleForShowdown"
    > & {
      seat: Pick<VirtualSeat, "userId"> & {
        user: User;
      };
    }
  >;
  actions?: Array<
    Pick<
      VirtualAction,
      "seatId" | "actionType" | "amountChips" | "actorType" | "metadataJson" | "createdAt"
    >
  >;
  pots?: Array<{
    awards: Array<{
      winnerSeatId: string;
      amountChips: bigint;
      handRankJson: Prisma.JsonValue | null;
    }>;
  }>;
  timers?: Array<
    Pick<
      TurnTimer,
      "seatId" | "startedAt" | "expiresAt" | "resolvedAt" | "remindedAt" | "resolutionType"
    >
  >;
  table: Pick<
    VirtualTable,
    | "id"
    | "title"
    | "chipValueMinor"
    | "chipValueCurrency"
    | "smallBlindChips"
    | "bigBlindChips"
    | "finishedAt"
  > & {
    seats: Array<Pick<VirtualSeat, "userId">>;
  };
};

type CompletedProfileTableRecord = Pick<
  VirtualTable,
  | "id"
  | "title"
  | "startingStackChips"
  | "smallBlindChips"
  | "bigBlindChips"
  | "chipValueMinor"
  | "finishedAt"
> & {
  seats: Array<Pick<VirtualSeat, "userId">>;
  hands: AggregationHandRecord[];
};

type VirtualProfileTableResult = {
  tableId: string;
  title: string;
  finishedAt: Date;
  playersCount: number;
  smallBlindChips: bigint;
  bigBlindChips: bigint;
  netChips: bigint;
  netEstimatedMinor: bigint;
  buyInEstimatedMinor: bigint;
};

type PersistedPot = {
  potType: PrismaPotType;
  amountChips: bigint;
  capChips: bigint | null;
  eligibleSeatIds: string[];
  awards: Array<{
    winnerSeatId: string;
    amountChips: bigint;
    handRankJson: Prisma.InputJsonValue | null;
  }>;
};

type HandProgressResult = {
  state: HandState;
  status: PrismaVirtualHandStatus;
  pots: PersistedPot[];
};

type ImmediateSitOutAutoAction = {
  action: PlayerAction;
  actionType: Extract<PrismaActionType, "AUTO_CHECK" | "AUTO_FOLD">;
  metadata: Prisma.InputJsonValue;
};

type CreatedHandResult = {
  hand: VirtualHand;
  tableStartedAt: Date;
};

type NextHandStartResult = CreatedHandResult & {
  autoStarted: boolean;
};

type PersistSeatStateResult = {
  sittingOutSeatIds: string[];
};

type PlayerVirtualActionRecord = VirtualAction & {
  seatId: string;
  handId: string;
  idempotencyKey: string;
};

type CurrentTurnTimerRecord = Pick<
  TurnTimer,
  "id" | "seatId" | "status" | "startedAt" | "reminderDueAt" | "expiresAt" | "remindedAt"
>;

type TimeoutActionType = Extract<PrismaActionType, "AUTO_CHECK" | "AUTO_FOLD">;
type TimeoutResolutionType = Extract<
  PrismaTurnTimerResolution,
  "AUTO_CHECK" | "AUTO_FOLD"
>;

type DueTurnTimerReminder = {
  timerId: string;
  tableId: string;
  handId: string;
  seatId: string;
  remindedAt: Date;
};

type DueTurnTimerTimeout = {
  timerId: string;
  tableId: string;
  handId: string;
  seatId: string;
  actionType: TimeoutActionType;
  actedAt: Date;
  handStatus: PrismaVirtualHandStatus;
  nextActorSeatId: string | null;
};

type ProcessDueTurnTimersResult = {
  reminders: DueTurnTimerReminder[];
  timeouts: DueTurnTimerTimeout[];
};

type WinProbabilityCacheEntry = {
  fingerprint: string;
  valuesBySeatId: Map<string, number | null>;
};

const COMPLETED_HAND_REVEAL_SECONDS = 10;
const VIRTUAL_REACTION_WINDOW_MS = 8_000;
const VIRTUAL_REACTION_RATE_LIMIT_WINDOW_MS = 10_000;
const VIRTUAL_REACTION_RATE_LIMIT_MAX = 3;

type NotificationJob =
  | {
      type: "reminder";
      telegramId: string | null;
      tableId: string;
      tableTitle: string;
    }
  | {
      type: "timeout";
      telegramId: string | null;
      tableId: string;
      tableTitle: string;
      actionType: TimeoutActionType;
    };

@Injectable()
export class VirtualService {
  private readonly winProbabilityCache = new Map<string, WinProbabilityCacheEntry>();

  constructor(
    private readonly prisma: PrismaService,
    @Optional()
    private readonly virtualNotificationsService?: VirtualNotificationsService,
    @Optional() private readonly clubsService?: ClubsService
  ) {}

  async createTable(
    user: UserDto,
    input: CreateVirtualTableRequestDto
  ): Promise<CreateVirtualTableResponseDto> {
    this.validateCreateTableInput(input);
    const scheduledStartAt = input.clubId
      ? parseScheduledStartAt(input.scheduledStartAt, this.invalidInput.bind(this))
      : null;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const inviteCode = this.createInviteCode();

      try {
        const table = await this.prisma.$transaction(async (tx) => {
          const createdTable = await tx.virtualTable.create({
            data: {
              ownerUserId: user.id,
              title: input.title.trim(),
              maxSeats: input.maxSeats,
              startingStackChips: BigInt(input.startingStackChips),
              chipValueMinor: input.chipValueMinor ? BigInt(input.chipValueMinor) : null,
              chipValueCurrency: input.chipValueCurrency ?? null,
              smallBlindChips: BigInt(input.smallBlindChips),
              bigBlindChips: BigInt(input.bigBlindChips),
              winProbabilityEnabled: input.winProbabilityEnabled,
              turnDurationSeconds: input.turnDurationSeconds,
              reminderDelaySeconds: input.reminderDelaySeconds,
              timeoutAutoActionRule: input.timeoutAutoActionRule,
              isPrivate: input.isPrivate ?? false,
              clubId: input.clubId ?? null,
              scheduledStartAt,
              inviteCode,
              status: PrismaVirtualTableStatus.WAITING_FOR_PLAYERS
            }
          });

          await tx.virtualSeat.create({
            data: {
              tableId: createdTable.id,
              userId: user.id,
              displayName: getDisplayName(user),
              seatNumber: 1,
              role: PrismaVirtualSeatRole.OWNER,
              status: PrismaVirtualSeatStatus.ACTIVE,
              stackChips: BigInt(input.startingStackChips)
            }
          });

          if (input.clubId) {
            if (!this.clubsService) {
              throw new ApiError(
                VIRTUAL_ERROR_CODES.conflict,
                "Клубы временно недоступны",
                HttpStatus.INTERNAL_SERVER_ERROR
              );
            }

            const clubEventId = await this.clubsService.createEventForVirtualTable(tx, {
              clubId: input.clubId,
              createdByUserId: user.id,
              type: "ONLINE_TABLE",
              title: input.title,
              scheduledStartAt: scheduledStartAt as Date,
              maxPlayers: input.maxPlayers ?? input.maxSeats,
              location: null,
              virtualTableId: createdTable.id
            });

            return tx.virtualTable.update({
              where: {
                id: createdTable.id
              },
              data: {
                clubEventId
              }
            });
          }

          return createdTable;
        });

        if (input.clubId && input.sendClubInvites && table.clubEventId && this.clubsService) {
          await this.clubsService.sendEventInvites(table.clubEventId, input.clubId);
        }

        return {
          table: {
            id: table.id,
            title: table.title,
            status: table.status,
            inviteCode: table.inviteCode,
            inviteUrl: buildVirtualInviteUrl(table.inviteCode),
            startingStackChips: table.startingStackChips.toString(),
            smallBlindChips: table.smallBlindChips.toString(),
            bigBlindChips: table.bigBlindChips.toString(),
            chipValueMinor: table.chipValueMinor?.toString() ?? null,
            chipValueCurrency: table.chipValueCurrency,
            winProbabilityEnabled: table.winProbabilityEnabled,
            isPrivate: table.isPrivate
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
      VIRTUAL_ERROR_CODES.conflict,
      "Не удалось создать ссылку приглашения",
      HttpStatus.INTERNAL_SERVER_ERROR
    );
  }

  async joinTable(
    user: UserDto,
    input: JoinVirtualTableRequestDto
  ): Promise<JoinVirtualTableResponseDto> {
    const inviteCode = normalizeInviteCode(input.inviteCode);
    const table = await this.prisma.virtualTable.findFirst({
      where: {
        inviteCode: {
          equals: inviteCode,
          mode: "insensitive"
        }
      },
      include: {
        seats: {
          orderBy: {
            seatNumber: "asc"
          }
        }
      }
    });

    if (!table) {
      throw new ApiError(
        VIRTUAL_ERROR_CODES.notFound,
        "Стол не найден",
        HttpStatus.NOT_FOUND
      );
    }

    return this.joinWaitingTable(user, table);
  }

  async joinOpenTable(user: UserDto, tableId: string): Promise<JoinVirtualTableResponseDto> {
    const table = await this.prisma.virtualTable.findUnique({
      where: {
        id: tableId
      },
      include: {
        seats: {
          orderBy: {
            seatNumber: "asc"
          }
        }
      }
    });

    if (!table) {
      throw new ApiError(
        VIRTUAL_ERROR_CODES.notFound,
        "Стол не найден",
        HttpStatus.NOT_FOUND
      );
    }

    if (table.isPrivate) {
      throw new ApiError(
        VIRTUAL_ERROR_CODES.forbidden,
        "Этот стол доступен только по коду",
        HttpStatus.FORBIDDEN
      );
    }

    return this.joinWaitingTable(user, table);
  }

  private async joinWaitingTable(
    user: UserDto,
    table: JoinableTableRecord
  ): Promise<JoinVirtualTableResponseDto> {
    if (table.status !== PrismaVirtualTableStatus.WAITING_FOR_PLAYERS) {
      throw new ApiError(
        VIRTUAL_ERROR_CODES.conflict,
        "Присоединиться к этому столу уже нельзя",
        HttpStatus.CONFLICT
      );
    }

    const existingSeat = table.seats.find((seat) => seat.userId === user.id);

    if (existingSeat) {
      return {
        tableId: table.id,
        seatId: existingSeat.id,
        status: table.status
      };
    }

    const nextSeatNumber = this.findLowestFreeSeatNumber(
      table.seats.map((seat) => seat.seatNumber),
      table.maxSeats
    );

    if (nextSeatNumber === null) {
      throw new ApiError(
        VIRTUAL_ERROR_CODES.conflict,
        "За этим столом уже нет свободных мест",
        HttpStatus.CONFLICT
      );
    }

    const seat = await this.prisma.virtualSeat.create({
      data: {
        tableId: table.id,
        userId: user.id,
        displayName: getDisplayName(user),
        seatNumber: nextSeatNumber,
        role: PrismaVirtualSeatRole.PLAYER,
        status: PrismaVirtualSeatStatus.ACTIVE,
        stackChips: table.startingStackChips
      }
    });

    return {
      tableId: table.id,
      seatId: seat.id,
      status: table.status
    };
  }

  async startTable(user: UserDto, tableId: string): Promise<StartVirtualTableResponseDto> {
    const table = await this.getTableOrThrow(tableId);
    const membership = table.seats.find((seat) => seat.userId === user.id);

    if (!membership) {
      throw new ApiError(
        VIRTUAL_ERROR_CODES.forbidden,
        "Этот стол вам недоступен",
        HttpStatus.FORBIDDEN
      );
    }

    if (!isTableAdmin(membership.role)) {
      throw new ApiError(
        VIRTUAL_ERROR_CODES.forbidden,
        "Начать игру может только владелец или администратор",
        HttpStatus.FORBIDDEN
      );
    }

    if (table.status !== PrismaVirtualTableStatus.WAITING_FOR_PLAYERS) {
      throw new ApiError(
        VIRTUAL_ERROR_CODES.conflict,
        "Стол уже запущен",
        HttpStatus.CONFLICT
      );
    }

    const { hand, tableStartedAt } = await this.createHandForTable(table, null);

    return {
      tableId: table.id,
      status: PrismaVirtualTableStatus.ACTIVE,
      startedAt: tableStartedAt.toISOString(),
      currentHandId: hand.id
    };
  }

  async startNextHand(
    user: UserDto,
    tableId: string
  ): Promise<StartNextVirtualHandResponseDto> {
    const table = await this.getTableOrThrow(tableId);
    const membership = table.seats.find((seat) => seat.userId === user.id);

    if (!membership) {
      throw new ApiError(
        VIRTUAL_ERROR_CODES.forbidden,
        "Этот стол вам недоступен",
        HttpStatus.FORBIDDEN
      );
    }

    if (!isTableAdmin(membership.role)) {
      throw new ApiError(
        VIRTUAL_ERROR_CODES.forbidden,
        "Начать раздачу может только владелец или администратор",
        HttpStatus.FORBIDDEN
      );
    }

    if (table.status !== PrismaVirtualTableStatus.ACTIVE) {
      throw new ApiError(
        VIRTUAL_ERROR_CODES.conflict,
        "Стол сейчас не в игре",
        HttpStatus.CONFLICT
      );
    }

    if (!table.currentHandId) {
      throw new ApiError(
        VIRTUAL_ERROR_CODES.conflict,
        "Текущая раздача не найдена",
        HttpStatus.CONFLICT
      );
    }

    const currentHand = await this.findHandById(this.prisma, table.currentHandId);

    if (!currentHand) {
      throw new ApiError(
        VIRTUAL_ERROR_CODES.conflict,
        "Текущая раздача не найдена",
        HttpStatus.CONFLICT
      );
    }

    if (currentHand.status === PrismaVirtualHandStatus.IN_PROGRESS) {
      throw new ApiError(
        VIRTUAL_ERROR_CODES.conflict,
        "Текущая раздача еще идет",
        HttpStatus.CONFLICT
      );
    }

    if (currentHand.status !== PrismaVirtualHandStatus.COMPLETED) {
      throw new ApiError(
        VIRTUAL_ERROR_CODES.conflict,
        "Следующую раздачу пока нельзя начать",
        HttpStatus.CONFLICT
      );
    }

    if (
      currentHand.completedAt === null ||
      addSeconds(currentHand.completedAt, COMPLETED_HAND_REVEAL_SECONDS) > new Date()
    ) {
      throw new ApiError(
        VIRTUAL_ERROR_CODES.conflict,
        "Итог раздачи еще показывается",
        HttpStatus.CONFLICT
      );
    }

    const { hand, tableStartedAt } = await this.createHandForTable(table, currentHand.dealerSeatId);

    return {
      tableId: table.id,
      status: PrismaVirtualTableStatus.ACTIVE,
      startedAt: tableStartedAt.toISOString(),
      currentHandId: hand.id
    };
  }

  async pauseTable(user: UserDto, tableId: string): Promise<PauseVirtualTableResponseDto> {
    const table = await this.getTableOrThrow(tableId);
    const membership = table.seats.find((seat) => seat.userId === user.id);

    if (!membership) {
      throw new ApiError(
        VIRTUAL_ERROR_CODES.forbidden,
        "Этот стол вам недоступен",
        HttpStatus.FORBIDDEN
      );
    }

    if (!isTableAdmin(membership.role)) {
      throw new ApiError(
        VIRTUAL_ERROR_CODES.forbidden,
        "Поставить стол на паузу может только владелец или администратор",
        HttpStatus.FORBIDDEN
      );
    }

    if (table.status !== PrismaVirtualTableStatus.ACTIVE) {
      throw new ApiError(
        VIRTUAL_ERROR_CODES.conflict,
        "Пауза доступна только во время игры",
        HttpStatus.CONFLICT
      );
    }

    const pausedAt = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.virtualTable.update({
        where: {
          id: table.id
        },
        data: {
          status: PrismaVirtualTableStatus.PAUSED,
          pausedAt
        }
      });

      await tx.turnTimer.updateMany({
        where: {
          tableId: table.id,
          status: {
            in: [PrismaTurnTimerStatus.ACTIVE, PrismaTurnTimerStatus.REMINDED]
          }
        },
        data: {
          status: PrismaTurnTimerStatus.RESOLVED,
          resolvedAt: pausedAt,
          resolutionType: PrismaTurnTimerResolution.TABLE_PAUSED
        }
      });

      await tx.virtualAction.create({
        data: {
          tableId: table.id,
          seatId: membership.id,
          actorType: PrismaActionActorType.ADMIN,
          actionType: PrismaActionType.TABLE_PAUSED,
          createdAt: pausedAt
        }
      });
    });

    return {
      tableId: table.id,
      status: PrismaVirtualTableStatus.PAUSED,
      pausedAt: pausedAt.toISOString()
    };
  }

  async resumeTable(user: UserDto, tableId: string): Promise<ResumeVirtualTableResponseDto> {
    const table = await this.getTableOrThrow(tableId);
    const membership = table.seats.find((seat) => seat.userId === user.id);

    if (!membership) {
      throw new ApiError(
        VIRTUAL_ERROR_CODES.forbidden,
        "Этот стол вам недоступен",
        HttpStatus.FORBIDDEN
      );
    }

    if (!isTableAdmin(membership.role)) {
      throw new ApiError(
        VIRTUAL_ERROR_CODES.forbidden,
        "Снять стол с паузы может только владелец или администратор",
        HttpStatus.FORBIDDEN
      );
    }

    if (table.status !== PrismaVirtualTableStatus.PAUSED) {
      throw new ApiError(
        VIRTUAL_ERROR_CODES.conflict,
        "Стол сейчас не на паузе",
        HttpStatus.CONFLICT
      );
    }

    const resumedAt = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.virtualTable.update({
        where: {
          id: table.id
        },
        data: {
          status: PrismaVirtualTableStatus.ACTIVE,
          pausedAt: null
        }
      });

      if (table.currentHandId) {
        const hand = await this.findHandById(tx, table.currentHandId);

        if (
          hand &&
          hand.status === PrismaVirtualHandStatus.IN_PROGRESS &&
          hand.currentActorSeatId
        ) {
          await this.createTurnTimer(
            tx,
            table,
            hand.id,
            hand.currentActorSeatId,
            resumedAt
          );
        }
      }

      await tx.virtualAction.create({
        data: {
          tableId: table.id,
          seatId: membership.id,
          actorType: PrismaActionActorType.ADMIN,
          actionType: PrismaActionType.TABLE_RESUMED,
          createdAt: resumedAt
        }
      });
    });

    return {
      tableId: table.id,
      status: PrismaVirtualTableStatus.ACTIVE,
      resumedAt: resumedAt.toISOString()
    };
  }

  async finishTable(
    user: UserDto,
    tableId: string
  ): Promise<FinishVirtualTableResponseDto> {
    const table = await this.getTableOrThrow(tableId);
    const membership = table.seats.find((seat) => seat.userId === user.id);

    if (!membership) {
      throw new ApiError(
        VIRTUAL_ERROR_CODES.forbidden,
        "Этот стол вам недоступен",
        HttpStatus.FORBIDDEN
      );
    }

    if (!isTableAdmin(membership.role)) {
      throw new ApiError(
        VIRTUAL_ERROR_CODES.forbidden,
        "Завершить стол может только владелец или администратор",
        HttpStatus.FORBIDDEN
      );
    }

    if (table.status === PrismaVirtualTableStatus.FINISHED) {
      return {
        tableId: table.id,
        status: PrismaVirtualTableStatus.FINISHED,
        finishedAt: (table.finishedAt ?? new Date()).toISOString(),
        currentHandId: table.currentHandId
      };
    }

    if (table.status === PrismaVirtualTableStatus.CANCELLED) {
      throw new ApiError(
        VIRTUAL_ERROR_CODES.conflict,
        "Этот стол уже отменен",
        HttpStatus.CONFLICT
      );
    }

    if (
      table.status !== PrismaVirtualTableStatus.WAITING_FOR_PLAYERS &&
      table.status !== PrismaVirtualTableStatus.ACTIVE &&
      table.status !== PrismaVirtualTableStatus.PAUSED
    ) {
      throw new ApiError(
        VIRTUAL_ERROR_CODES.conflict,
        "Этот стол сейчас нельзя завершить",
        HttpStatus.CONFLICT
      );
    }

    const finishedAt = new Date();

    await this.prisma.$transaction(async (tx) => {
      let hand: HandRecord | null = null;

      if (table.currentHandId) {
        hand = await this.findHandById(tx, table.currentHandId);

        if (
          hand &&
          (hand.status === PrismaVirtualHandStatus.CREATED ||
            hand.status === PrismaVirtualHandStatus.DEALING ||
            hand.status === PrismaVirtualHandStatus.IN_PROGRESS ||
            hand.status === PrismaVirtualHandStatus.SHOWDOWN)
        ) {
          await this.rollbackCancelledHandCommittedChips(tx, hand);
        }
      }

      await tx.virtualTable.update({
        where: {
          id: table.id
        },
        data: {
          status: PrismaVirtualTableStatus.FINISHED,
          finishedAt,
          pausedAt: null
        }
      });

      await tx.turnTimer.updateMany({
        where: {
          tableId: table.id,
          status: {
            in: [PrismaTurnTimerStatus.ACTIVE, PrismaTurnTimerStatus.REMINDED]
          }
        },
        data: {
          status: PrismaTurnTimerStatus.CANCELLED,
          resolvedAt: finishedAt
        }
      });

      if (
        hand &&
        (hand.status === PrismaVirtualHandStatus.CREATED ||
          hand.status === PrismaVirtualHandStatus.DEALING ||
          hand.status === PrismaVirtualHandStatus.IN_PROGRESS ||
          hand.status === PrismaVirtualHandStatus.SHOWDOWN)
      ) {
        await tx.virtualHand.update({
          where: {
            id: hand.id
          },
          data: {
            status: PrismaVirtualHandStatus.CANCELLED,
            currentActorSeatId: null,
            currentBetChips: 0n,
            potTotalChips: 0n,
            completedAt: finishedAt
          }
        });
      }
    });

    return {
      tableId: table.id,
      status: PrismaVirtualTableStatus.FINISHED,
      finishedAt: finishedAt.toISOString(),
      currentHandId: table.currentHandId
    };
  }

  async cancelTable(
    user: UserDto,
    tableId: string
  ): Promise<CancelVirtualTableResponseDto> {
    const table = await this.getTableOrThrow(tableId);
    const membership = table.seats.find((seat) => seat.userId === user.id);

    if (!membership) {
      throw new ApiError(
        VIRTUAL_ERROR_CODES.forbidden,
        "Этот стол вам недоступен",
        HttpStatus.FORBIDDEN
      );
    }

    if (!isTableAdmin(membership.role)) {
      throw new ApiError(
        VIRTUAL_ERROR_CODES.forbidden,
        "Отменить стол может только владелец или администратор",
        HttpStatus.FORBIDDEN
      );
    }

    if (table.status === PrismaVirtualTableStatus.CANCELLED) {
      return {
        tableId: table.id,
        status: PrismaVirtualTableStatus.CANCELLED,
        finishedAt: (table.finishedAt ?? new Date()).toISOString(),
        currentHandId: table.currentHandId
      };
    }

    if (table.status === PrismaVirtualTableStatus.FINISHED) {
      throw new ApiError(
        VIRTUAL_ERROR_CODES.conflict,
        "Этот стол уже завершен",
        HttpStatus.CONFLICT
      );
    }

    if (
      table.status !== PrismaVirtualTableStatus.WAITING_FOR_PLAYERS ||
      table.currentHandId
    ) {
      throw new ApiError(
        VIRTUAL_ERROR_CODES.conflict,
        "Стол с начатой игрой нельзя отменить, его нужно завершить",
        HttpStatus.CONFLICT
      );
    }

    const finishedAt = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.virtualTable.update({
        where: {
          id: table.id
        },
        data: {
          status: PrismaVirtualTableStatus.CANCELLED,
          finishedAt,
          pausedAt: null
        }
      });

      await tx.turnTimer.updateMany({
        where: {
          tableId: table.id,
          status: {
            in: [PrismaTurnTimerStatus.ACTIVE, PrismaTurnTimerStatus.REMINDED]
          }
        },
        data: {
          status: PrismaTurnTimerStatus.CANCELLED,
          resolvedAt: finishedAt
        }
      });
    });

    return {
      tableId: table.id,
      status: PrismaVirtualTableStatus.CANCELLED,
      finishedAt: finishedAt.toISOString(),
      currentHandId: table.currentHandId
    };
  }

  async raiseBlinds(
    user: UserDto,
    tableId: string,
    input: RaiseVirtualBlindsRequestDto
  ): Promise<RaiseVirtualBlindsResponseDto> {
    const table = await this.getTableOrThrow(tableId);
    const membership = table.seats.find((seat) => seat.userId === user.id);

    if (!membership) {
      throw new ApiError(
        VIRTUAL_ERROR_CODES.forbidden,
        "Этот стол вам недоступен",
        HttpStatus.FORBIDDEN
      );
    }

    if (!isTableAdmin(membership.role)) {
      throw new ApiError(
        VIRTUAL_ERROR_CODES.forbidden,
        "Менять блайнды может только владелец или администратор",
        HttpStatus.FORBIDDEN
      );
    }

    if (
      table.status !== PrismaVirtualTableStatus.ACTIVE &&
      table.status !== PrismaVirtualTableStatus.PAUSED
    ) {
      throw new ApiError(
        VIRTUAL_ERROR_CODES.conflict,
        "Блайнды можно менять только у активного стола",
        HttpStatus.CONFLICT
      );
    }

    const smallBlindChips = parsePositiveBigInt(
      input.smallBlindChips,
      "Малый блайнд должен быть больше нуля"
    );
    const bigBlindChips = parsePositiveBigInt(
      input.bigBlindChips,
      "Большой блайнд должен быть больше нуля"
    );

    if (smallBlindChips > VIRTUAL_MAX_CHIPS || bigBlindChips > VIRTUAL_MAX_CHIPS) {
      throw this.invalidInput("Блайнды слишком большие");
    }

    if (bigBlindChips <= smallBlindChips) {
      throw this.invalidInput("Малый блайнд должен быть меньше большого");
    }

    const changedAt = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.virtualTable.update({
        where: {
          id: table.id
        },
        data: {
          pendingSmallBlindChips: smallBlindChips,
          pendingBigBlindChips: bigBlindChips
        }
      });

      await tx.virtualAction.create({
        data: {
          tableId: table.id,
          seatId: membership.id,
          actorType: PrismaActionActorType.ADMIN,
          actionType: PrismaActionType.BLINDS_RAISED,
          metadataJson: {
            smallBlindChips: smallBlindChips.toString(),
            bigBlindChips: bigBlindChips.toString(),
            applies: "NEXT_HAND"
          },
          createdAt: changedAt
        }
      });
    });

    return {
      pendingSmallBlindChips: smallBlindChips.toString(),
      pendingBigBlindChips: bigBlindChips.toString(),
      applies: "NEXT_HAND"
    };
  }

  async requestSitOut(
    user: UserDto,
    tableId: string,
    input: RequestVirtualSitOutRequestDto
  ): Promise<RequestVirtualSitOutResponseDto> {
    const table = await this.getTableOrThrow(tableId);
    const membership = table.seats.find((seat) => seat.userId === user.id);

    if (!membership) {
      throw new ApiError(
        VIRTUAL_ERROR_CODES.forbidden,
        "Этот стол вам недоступен",
        HttpStatus.FORBIDDEN
      );
    }

    if (
      membership.status !== PrismaVirtualSeatStatus.ACTIVE &&
      membership.status !== PrismaVirtualSeatStatus.WAITING_FOR_TURN &&
      membership.status !== PrismaVirtualSeatStatus.ACTING &&
      membership.status !== PrismaVirtualSeatStatus.FOLDED &&
      membership.status !== PrismaVirtualSeatStatus.ALL_IN &&
      membership.status !== PrismaVirtualSeatStatus.SIT_OUT_REQUESTED
    ) {
      throw new ApiError(
        VIRTUAL_ERROR_CODES.conflict,
        "Сейчас нельзя запросить сит-аут",
        HttpStatus.CONFLICT
      );
    }

    const requestedAt = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.virtualSeat.update({
        where: {
          id: membership.id
        },
        data: {
          status: PrismaVirtualSeatStatus.SIT_OUT_REQUESTED,
          sitOutRequestedAt: requestedAt,
          sitOutAutoCheckEnabled: input.autoCheck,
          sitOutAutoFoldEnabled: input.autoFold,
          hasPassedSmallBlindSinceSitOutRequest: false,
          hasPassedBigBlindSinceSitOutRequest: false,
          returnRequestedAt: null
        }
      });

      await tx.virtualAction.create({
        data: {
          tableId: table.id,
          handId: table.currentHandId,
          seatId: membership.id,
          actorType: PrismaActionActorType.PLAYER,
          actionType: PrismaActionType.SIT_OUT_REQUESTED,
          metadataJson: {
            autoCheck: input.autoCheck,
            autoFold: input.autoFold
          },
          createdAt: requestedAt
        }
      });
    });

    return {
      seatStatus: PrismaVirtualSeatStatus.SIT_OUT_REQUESTED,
      autoCheck: input.autoCheck,
      autoFold: input.autoFold
    };
  }

  async returnToTable(
    user: UserDto,
    tableId: string
  ): Promise<ReturnToVirtualTableResponseDto> {
    const table = await this.getTableOrThrow(tableId);
    const membership = table.seats.find((seat) => seat.userId === user.id);

    if (!membership) {
      throw new ApiError(
        VIRTUAL_ERROR_CODES.forbidden,
        "Этот стол вам недоступен",
        HttpStatus.FORBIDDEN
      );
    }

    if (membership.status === PrismaVirtualSeatStatus.RETURN_REQUESTED) {
      return {
        seatStatus: PrismaVirtualSeatStatus.RETURN_REQUESTED
      };
    }

    if (membership.status === PrismaVirtualSeatStatus.SIT_OUT_REQUESTED) {
      await this.prisma.virtualSeat.update({
        where: {
          id: membership.id
        },
        data: {
          status: PrismaVirtualSeatStatus.ACTIVE,
          sitOutRequestedAt: null,
          sitOutAutoCheckEnabled: false,
          sitOutAutoFoldEnabled: false,
          hasPassedSmallBlindSinceSitOutRequest: false,
          hasPassedBigBlindSinceSitOutRequest: false,
          returnRequestedAt: null
        }
      });

      return {
        seatStatus: PrismaVirtualSeatStatus.ACTIVE
      };
    }

    if (membership.status !== PrismaVirtualSeatStatus.SITTING_OUT) {
      throw new ApiError(
        VIRTUAL_ERROR_CODES.conflict,
        "Сейчас возвращаться за стол не нужно",
        HttpStatus.CONFLICT
      );
    }

    const requestedAt = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.virtualSeat.update({
        where: {
          id: membership.id
        },
        data: {
          status: PrismaVirtualSeatStatus.RETURN_REQUESTED,
          returnRequestedAt: requestedAt
        }
      });

      await tx.virtualAction.create({
        data: {
          tableId: table.id,
          handId: table.currentHandId,
          seatId: membership.id,
          actorType: PrismaActionActorType.PLAYER,
          actionType: PrismaActionType.RETURN_REQUESTED,
          createdAt: requestedAt
        }
      });
    });

    return {
      seatStatus: PrismaVirtualSeatStatus.RETURN_REQUESTED
    };
  }

  async listTables(user: UserDto): Promise<GetVirtualTablesResponseDto> {
    const tables = await this.prisma.virtualTable.findMany({
      where: {
        seats: {
          some: {
            userId: user.id
          }
        }
      },
      include: {
        seats: {
          include: {
            user: true
          },
          orderBy: {
            seatNumber: "asc"
          }
        },
        hands: {
          select: {
            handNumber: true
          },
          orderBy: {
            handNumber: "desc"
          },
          take: 1
        }
      }
    });
    const currentHandIds = tables
      .map((table) => table.currentHandId)
      .filter((handId): handId is string => handId !== null);
    const currentHands =
      currentHandIds.length === 0
        ? []
        : await this.prisma.virtualHand.findMany({
            where: {
              id: {
                in: currentHandIds
              }
            },
            select: {
              id: true,
              currentActorSeatId: true,
              currentStreet: true,
              potTotalChips: true
            }
          });
    const currentHandById = new Map(currentHands.map((hand) => [hand.id, hand]));

    return {
      items: tables
        .slice()
        .sort(compareVirtualTablesForList)
        .map((table) => {
          const mySeat = table.seats.find((seat) => seat.userId === user.id);

          if (!mySeat) {
            throw new ApiError(
              VIRTUAL_ERROR_CODES.forbidden,
              "Этот стол вам недоступен",
              HttpStatus.FORBIDDEN
            );
          }

          const currentHand =
            table.currentHandId === null ? null : currentHandById.get(table.currentHandId) ?? null;
          const lastHand = table.hands[0] ?? null;

          return {
            id: table.id,
            title: table.title,
            status: table.status,
            inviteCode: table.inviteCode,
            maxSeats: table.maxSeats,
            currentHandId: table.currentHandId,
            startingStackChips: table.startingStackChips.toString(),
            myStackChips: mySeat.stackChips.toString(),
            chipValueMinor: table.chipValueMinor?.toString() ?? null,
            chipValueCurrency: table.chipValueCurrency,
            smallBlindChips: table.smallBlindChips.toString(),
            bigBlindChips: table.bigBlindChips.toString(),
            winProbabilityEnabled: table.winProbabilityEnabled,
            turnDurationSeconds: table.turnDurationSeconds,
            reminderDelaySeconds: table.reminderDelaySeconds,
            timeoutAutoActionRule: table.timeoutAutoActionRule,
            potTotalChips: currentHand?.potTotalChips.toString() ?? "0",
            isPrivate: table.isPrivate,
            createdAt: table.createdAt.toISOString(),
            startedAt: table.startedAt?.toISOString() ?? null,
            pausedAt: table.pausedAt?.toISOString() ?? null,
            finishedAt: table.finishedAt?.toISOString() ?? null,
            seatsCount: table.seats.length,
            activeSeatsCount: table.seats.filter((seat) => seat.status !== PrismaVirtualSeatStatus.LEFT)
              .length,
            mySeatId: mySeat.id,
            mySeatStatus: mySeat.status,
            currentActorSeatId: currentHand?.currentActorSeatId ?? null,
            currentStreet: currentHand?.currentStreet ?? null,
            lastHandNumber: lastHand?.handNumber ?? null
          };
        })
    };
  }

  async listOpenTables(_user: UserDto): Promise<GetOpenVirtualTablesResponseDto> {
    void _user;

    const tables = await this.prisma.virtualTable.findMany({
      where: {
        isPrivate: false,
        status: PrismaVirtualTableStatus.WAITING_FOR_PLAYERS
      },
      include: {
        owner: true,
        seats: {
          where: {
            status: {
              not: PrismaVirtualSeatStatus.LEFT
            }
          },
          orderBy: {
            seatNumber: "asc"
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      },
      take: 50
    });

    return {
      items: tables
        .filter(
          (table) =>
            !table.isPrivate &&
            table.status === PrismaVirtualTableStatus.WAITING_FOR_PLAYERS &&
            table.seats.length < table.maxSeats
        )
        .map((table) => ({
          id: table.id,
          title: table.title,
          maxSeats: table.maxSeats,
          seatsCount: table.seats.length,
          smallBlindChips: table.smallBlindChips.toString(),
          bigBlindChips: table.bigBlindChips.toString(),
          startingStackChips: table.startingStackChips.toString(),
          turnDurationSeconds: table.turnDurationSeconds,
          winProbabilityEnabled: table.winProbabilityEnabled,
          createdAt: table.createdAt.toISOString(),
          ownerDisplayName: getUserDisplayName(table.owner)
        }))
    };
  }

  async getHandHistory(
    user: UserDto,
    tableId: string,
    handId: string
  ): Promise<GetVirtualHandHistoryResponseDto> {
    const table = await this.getTableOrThrow(tableId);
    const membership = table.seats.find((seat) => seat.userId === user.id);

    if (!membership) {
      throw new ApiError(
        VIRTUAL_ERROR_CODES.forbidden,
        "Этот стол вам недоступен",
        HttpStatus.FORBIDDEN
      );
    }

    const hand = await this.getHandHistoryById(handId);

    if (hand.tableId !== table.id) {
      throw new ApiError(
        VIRTUAL_ERROR_CODES.notFound,
        "Раздача не найдена",
        HttpStatus.NOT_FOUND
      );
    }

    return {
      table: {
        id: table.id,
        title: table.title,
        status: table.status,
        inviteCode: table.inviteCode,
        maxSeats: table.maxSeats,
        startingStackChips: table.startingStackChips.toString(),
        chipValueMinor: table.chipValueMinor?.toString() ?? null,
        chipValueCurrency: table.chipValueCurrency,
        smallBlindChips: table.smallBlindChips.toString(),
        bigBlindChips: table.bigBlindChips.toString()
      },
      hand: {
        id: hand.id,
        handNumber: hand.handNumber,
        status: hand.status,
        street: hand.currentStreet,
        potTotalChips: hand.potTotalChips.toString(),
        startedAt: hand.startedAt.toISOString(),
        completedAt: hand.completedAt?.toISOString() ?? null
      },
      board: hand.communityCards
        .slice()
        .sort((left, right) => left.position - right.position)
        .map((card) => card.card),
      players: hand.players.map((player) => ({
        seatId: player.seatId,
        displayName: getSeatDisplayName(player.seat),
        status: mapHandPlayerStatusToSeatStatus(player.status),
        committedTotalChips: player.committedTotalChips.toString(),
        stackAfterChips: player.currentStackChips.toString(),
        showdownCards: getHandHistoryShowdownCards(hand, player)
      })),
      actions: hand.actions
        .slice()
        .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())
        .map((action) => ({
          id: action.id,
          street: inferActionStreet(action),
          actionType: action.actionType,
          amountChips: action.amountChips?.toString() ?? null,
          seatId: action.seatId,
          displayName: getActionDisplayName(action),
          actorType: action.actorType,
          createdAt: action.createdAt.toISOString()
        })),
      pots: hand.pots.map((pot) => ({
        id: pot.id,
        amountChips: pot.amountChips.toString(),
        eligibleSeatIds: jsonToSeatIds(pot.eligibleSeatIdsJson),
        awards: pot.awards.map((award) => {
          const winner = hand.players.find((player) => player.seatId === award.winnerSeatId);

          return {
            winnerSeatId: award.winnerSeatId,
            displayName: winner
              ? winner.seat.displayName ?? getUserDisplayName(winner.seat.user)
              : "Игрок",
            amountChips: award.amountChips.toString(),
            handRankJson: award.handRankJson
          };
        })
      }))
    };
  }

  async listHandHistories(
    user: UserDto,
    tableId: string,
    query: GetVirtualHandHistoriesQueryDto
  ): Promise<GetVirtualHandHistoriesResponseDto> {
    const table = await this.getTableOrThrow(tableId);
    const membership = table.seats.find((seat) => seat.userId === user.id);

    if (!membership) {
      throw new ApiError(
        VIRTUAL_ERROR_CODES.forbidden,
        "Этот стол вам недоступен",
        HttpStatus.FORBIDDEN
      );
    }

    const hands = await this.prisma.virtualHand.findMany({
      where: {
        tableId: table.id,
        ...(query.cursor ? { handNumber: { lt: Number(query.cursor) } } : {})
      },
      include: {
        players: {
          include: {
            seat: {
              include: {
                user: true
              }
            }
          }
        },
        communityCards: {
          orderBy: {
            position: "asc"
          }
        },
        pots: {
          include: {
            awards: true
          }
        },
        actions: {
          select: {
            id: true
          }
        }
      },
      orderBy: {
        handNumber: "desc"
      },
      take: query.limit + 1
    });

    const hasMore = hands.length > query.limit;
    const pageHands = hasMore ? hands.slice(0, query.limit) : hands;
    const nextCursor = hasMore ? String(pageHands[pageHands.length - 1]?.handNumber ?? "") : null;

    return {
      items: pageHands.map((hand) => ({
        id: hand.id,
        handNumber: hand.handNumber,
        status: hand.status,
        street: hand.currentStreet,
        potTotalChips: hand.potTotalChips.toString(),
        board: hand.communityCards.map((card) => card.card),
        startedAt: hand.startedAt.toISOString(),
        completedAt: hand.completedAt?.toISOString() ?? null,
        actionsCount: hand.actions.length,
        winners: getHandHistoryListWinners(hand)
      })),
      nextCursor
    };
  }

  async getTable(user: UserDto, tableId: string): Promise<GetVirtualTableResponseDto> {
    const table = await this.getTableOrThrow(tableId);
    const membership = table.seats.find((seat) => seat.userId === user.id);

    if (!membership) {
      throw new ApiError(
        VIRTUAL_ERROR_CODES.forbidden,
        "Этот стол вам недоступен",
        HttpStatus.FORBIDDEN
      );
    }

    const hand = table.currentHandId
      ? await this.getHandById(table.currentHandId)
      : null;
    const currentTimer = hand ? await this.findCurrentTurnTimer(table.id, hand) : null;
    const winProbabilityBySeatId = this.getSeatWinProbabilityValues(table, hand, membership.id);
    const settlement =
      table.status === PrismaVirtualTableStatus.FINISHED
        ? this.buildFinishedTableSettlement(table)
        : undefined;
    const reactions = await this.findRecentTableReactions(table.id);
    const responseHand =
      hand && hand.status !== PrismaVirtualHandStatus.CANCELLED
        ? this.toHandDto(table, hand, membership.id, currentTimer)
        : undefined;

    return {
      table: this.toTableDto(table, hand),
      seats: table.seats
        .sort((left, right) => left.seatNumber - right.seatNumber)
        .map((seat: TableRecord["seats"][number]) =>
          this.toSeatDto(seat, hand, winProbabilityBySeatId)
        ),
      reactions: reactions.map((reaction) => this.toTableReactionDto(reaction)),
      ...(responseHand ? { hand: responseHand } : {}),
      ...(settlement ? { settlement } : {})
    };
  }

  async submitReaction(
    user: UserDto,
    tableId: string,
    input: SubmitVirtualReactionRequestDto
  ): Promise<SubmitVirtualReactionResponseDto> {
    const table = await this.getTableOrThrow(tableId);
    const membership = table.seats.find((seat) => seat.userId === user.id);

    if (!membership) {
      throw new ApiError(
        VIRTUAL_ERROR_CODES.forbidden,
        "Этот стол вам недоступен",
        HttpStatus.FORBIDDEN
      );
    }

    if (
      table.status !== PrismaVirtualTableStatus.ACTIVE &&
      table.status !== PrismaVirtualTableStatus.PAUSED
    ) {
      throw new ApiError(
        VIRTUAL_ERROR_CODES.conflict,
        "Реакции доступны только за активным столом",
        HttpStatus.CONFLICT
      );
    }

    if (
      !VIRTUAL_TABLE_REACTION_EMOJIS.includes(
        input.emoji as (typeof VIRTUAL_TABLE_REACTION_EMOJIS)[number]
      )
    ) {
      throw this.invalidInput("Можно отправить только одну из доступных реакций");
    }

    const createdAt = new Date();
    const rateLimitWindowStart = new Date(
      createdAt.getTime() - VIRTUAL_REACTION_RATE_LIMIT_WINDOW_MS
    );
    const recentReactionsCount = await this.prisma.virtualTableReaction.count({
      where: {
        seatId: membership.id,
        createdAt: {
          gte: rateLimitWindowStart
        }
      }
    });

    if (recentReactionsCount >= VIRTUAL_REACTION_RATE_LIMIT_MAX) {
      throw new ApiError(
        VIRTUAL_ERROR_CODES.conflict,
        "Слишком часто. Попробуйте через пару секунд.",
        HttpStatus.TOO_MANY_REQUESTS
      );
    }

    const reaction = await this.prisma.virtualTableReaction.create({
      data: {
        tableId: table.id,
        seatId: membership.id,
        userId: membership.userId,
        emoji: input.emoji,
        createdAt
      },
      include: {
        seat: {
          include: {
            user: true
          }
        }
      }
    });

    return {
      reaction: this.toTableReactionDto(reaction)
    };
  }

  private buildFinishedTableSettlement(table: TableRecord): VirtualTableSettlementDto {
    const players = table.seats
      .slice()
      .sort((left, right) => left.seatNumber - right.seatNumber)
      .map((seat) => {
        const startingStackChips = table.startingStackChips;
        const finalStackChips = seat.stackChips;

        return {
          seatId: seat.id,
          displayName: getSeatDisplayName(seat),
          startingStackChips,
          finalStackChips,
          netChips: finalStackChips - startingStackChips
        };
      });
    const totalStartingStackChips = players.reduce(
      (sum, player) => sum + player.startingStackChips,
      0n
    );
    const totalFinalStackChips = players.reduce((sum, player) => sum + player.finalStackChips, 0n);
    const differenceChips = totalFinalStackChips - totalStartingStackChips;
    const transfers =
      differenceChips === 0n
        ? calculateTransfers(
            players.map((player) => ({
              roomPlayerId: player.seatId,
              netResultChips: player.netChips
            }))
          ).map((transfer) => {
            const fromPlayer = players.find((player) => player.seatId === transfer.fromRoomPlayerId);
            const toPlayer = players.find((player) => player.seatId === transfer.toRoomPlayerId);

            if (!fromPlayer || !toPlayer) {
              throw new ApiError(
                VIRTUAL_ERROR_CODES.invalidInput,
                "Не удалось подготовить расчёт по игрокам",
                HttpStatus.BAD_REQUEST
              );
            }

            return {
              fromSeatId: transfer.fromRoomPlayerId,
              fromName: fromPlayer.displayName,
              toSeatId: transfer.toRoomPlayerId,
              toName: toPlayer.displayName,
              amountChips: transfer.amountChips,
              amountEstimatedMinor: multiplyChipsByMinor(
                transfer.amountChips,
                table.chipValueMinor
              )
            };
          })
        : [];

    return {
      totalStartingStackChips: totalStartingStackChips.toString(),
      totalFinalStackChips: totalFinalStackChips.toString(),
      differenceChips: differenceChips.toString(),
      players: players.map((player) => ({
        seatId: player.seatId,
        displayName: player.displayName,
        startingStackChips: player.startingStackChips.toString(),
        finalStackChips: player.finalStackChips.toString(),
        netChips: player.netChips.toString(),
        netEstimatedMinor: multiplyChipsByMinor(player.netChips, table.chipValueMinor)
      })),
      transfers: transfers.map((transfer) => ({
        fromSeatId: transfer.fromSeatId,
        fromName: transfer.fromName,
        toSeatId: transfer.toSeatId,
        toName: transfer.toName,
        amountChips: transfer.amountChips.toString(),
        amountEstimatedMinor: transfer.amountEstimatedMinor
      }))
    };
  }

  private async rollbackCancelledHandCommittedChips(
    tx: Prisma.TransactionClient,
    hand: HandRecord
  ): Promise<void> {
    await Promise.all(
      hand.players.map(async (player) => {
        const restoredStackChips = player.currentStackChips + player.committedTotalChips;

        await tx.virtualSeat.update({
          where: {
            id: player.seatId
          },
          data: {
            stackChips: restoredStackChips
          }
        });

        await tx.virtualHandPlayer.update({
          where: {
            id: player.id
          },
          data: {
            currentStackChips: restoredStackChips,
            committedTotalChips: 0n,
            committedStreetChips: 0n
          }
        });
      })
    );
  }

  async getLeaderboard(
    user: UserDto,
    query: GetVirtualLeaderboardQueryDto
  ): Promise<GetVirtualLeaderboardResponseDto> {
    const rows =
      query.period === "all-time"
        ? await this.getAllTimeLeaderboardRows(user, query.scope)
        : await this.getDynamicLeaderboardRows(user, query);

    return this.paginateLeaderboardRows(rows, query);
  }

  async getMyStats(user: UserDto): Promise<GetMyVirtualStatsResponseDto> {
    const stats = await this.prisma.onlinePlayerStats.findUnique({
      where: {
        userId: user.id
      }
    });

    return {
      stats: this.toOnlineStatsDto(stats, user)
    };
  }

  async getPlayerProfile(
    viewer: UserDto,
    targetUserId: string,
    period: LeaderboardPeriod
  ): Promise<GetVirtualPlayerProfileResponseDto> {
    const targetUser = await this.prisma.user.findUnique({
      where: {
        id: targetUserId
      }
    });

    if (!targetUser) {
      throw new ApiError(
        VIRTUAL_ERROR_CODES.notFound,
        "Игрок не найден",
        HttpStatus.NOT_FOUND
      );
    }

    if (viewer.id !== targetUserId) {
      const hasSharedCompletedTable = await this.hasSharedCompletedVirtualTable(
        viewer.id,
        targetUserId
      );

      if (!hasSharedCompletedTable) {
        throw new ApiError(
          VIRTUAL_ERROR_CODES.forbidden,
          "Профиль доступен только тем, кто уже играл вместе",
          HttpStatus.FORBIDDEN
        );
      }
    }

    const completedTables = await this.getCompletedProfileTables(targetUserId);
    const selectedTables = selectCompletedTablesForPeriod(completedTables, period);
    const stats =
      period === "all-time"
        ? await this.prisma.onlinePlayerStats.findUnique({
            where: {
              userId: targetUserId
            }
          })
        : buildOnlineStatsSnapshotFromHands(
            getAggregationHandsForUser(selectedTables, targetUserId),
            targetUserId
          );
    const tableResults = toVirtualProfileTableResults(selectedTables, targetUserId);
    const recentResults = toVirtualRecentProfileResults(tableResults);
    const style = calculateVirtualPlayerStyleProfile(
      getAggregationHandsForUser(selectedTables, targetUserId),
      targetUserId
    );

    return {
      user: {
        id: targetUser.id,
        displayName: getUserFacingDisplayName(targetUser),
        username: targetUser.username ?? null
      },
      stats: this.toOnlineStatsDto(stats, targetUser),
      tableStats: toVirtualProfileTableStats(tableResults),
      style,
      recentTables: toVirtualRecentProfileTables(tableResults),
      recentResults,
      trend: toVirtualProfileTrend(recentResults)
    };
  }

  private paginateLeaderboardRows(
    rows: Array<LeaderboardStatsRecord | DynamicLeaderboardRow>,
    query: GetVirtualLeaderboardQueryDto
  ): GetVirtualLeaderboardResponseDto {
    const sortedRows = rows.slice().sort(compareVirtualLeaderboardRows);
    const cursor = query.cursor ? decodeVirtualLeaderboardCursor(query.cursor) : null;
    const startIndex = cursor ? findVirtualLeaderboardStartIndex(sortedRows, cursor) : 0;
    const pageRows = sortedRows.slice(startIndex, startIndex + query.limit + 1);
    const hasMore = pageRows.length > query.limit;
    const itemsRows = pageRows.slice(0, query.limit);

    return {
      items: itemsRows.map((row, index) => ({
        rank: startIndex + index + 1,
        ...this.toOnlineStatsDto(row, row.user)
      })),
      nextCursor: hasMore
        ? encodeVirtualLeaderboardCursor(toVirtualLeaderboardCursor(itemsRows.at(-1)))
        : null
    };
  }

  private async getAllTimeLeaderboardRows(
    viewer: UserDto,
    scope: GetVirtualLeaderboardQueryDto["scope"]
  ): Promise<LeaderboardStatsRecord[]> {
    if (scope === "all") {
      return this.prisma.onlinePlayerStats.findMany({
        include: {
          user: true
        }
      });
    }

    const candidateUserIds = await this.getPlayedWithMeCompletedUserIds(viewer.id);

    if (candidateUserIds.length === 0) {
      return [];
    }

    const rows = await this.prisma.onlinePlayerStats.findMany({
      where: {
        userId: {
          in: candidateUserIds
        }
      },
      include: {
        user: true
      }
    });
    const rowByUserId = new Map(rows.map((row) => [row.userId, row]));

    return candidateUserIds
      .map((userId) => rowByUserId.get(userId))
      .filter((row): row is LeaderboardStatsRecord => row !== undefined);
  }

  private async getDynamicLeaderboardRows(
    viewer: UserDto,
    query: GetVirtualLeaderboardQueryDto
  ): Promise<DynamicLeaderboardRow[]> {
    const periodTables = await this.getCompletedLeaderboardTables(viewer, query);

    if (periodTables.length === 0) {
      return [];
    }

    const candidateUserIds =
      query.scope === "played-with-me"
        ? collectDistinctUserIdsFromCompletedTables(periodTables)
        : undefined;
    const selectedTablesByUserId =
      query.period === "last-10"
        ? buildLastTenTableIdsByUser(periodTables, candidateUserIds)
        : null;
    const handRows = await this.getCompletedAggregationHands(periodTables.map((table) => table.id));

    return buildDynamicLeaderboardRows(handRows, {
      ...(candidateUserIds ? { candidateUserIds } : {}),
      selectedTableIdsByUserId: selectedTablesByUserId
    });
  }

  private async getCompletedLeaderboardTables(
    viewer: UserDto,
    query: GetVirtualLeaderboardQueryDto
  ): Promise<Array<Pick<VirtualTable, "id" | "finishedAt"> & { seats: Array<Pick<VirtualSeat, "userId">> }>> {
    const monthRange = query.period === "month" ? getCurrentMonthRange(new Date()) : null;

    return this.prisma.virtualTable.findMany({
      where: {
        status: PrismaVirtualTableStatus.FINISHED,
        finishedAt: {
          not: null,
          ...(monthRange ? { gte: monthRange.start, lt: monthRange.endExclusive } : {})
        },
        ...(query.scope === "played-with-me"
          ? {
              seats: {
                some: {
                  userId: viewer.id
                }
              }
            }
          : {})
      },
      select: {
        id: true,
        finishedAt: true,
        seats: {
          select: {
            userId: true
          }
        }
      },
      orderBy: [
        {
          finishedAt: "desc"
        },
        {
          id: "desc"
        }
      ]
    });
  }

  private async getCompletedAggregationHands(tableIds: string[]): Promise<AggregationHandRecord[]> {
    if (tableIds.length === 0) {
      return [];
    }

    return this.prisma.virtualHand.findMany({
      where: {
        tableId: {
          in: tableIds
        },
        status: PrismaVirtualHandStatus.COMPLETED
      },
      include: {
        players: {
          include: {
            seat: {
              include: {
                user: true
              }
            }
          }
        },
        table: {
          select: {
            id: true,
            title: true,
            chipValueMinor: true,
            chipValueCurrency: true,
            smallBlindChips: true,
            bigBlindChips: true,
            finishedAt: true,
            seats: {
              select: {
                userId: true
              }
            }
          }
        }
      }
    });
  }

  private async getPlayedWithMeCompletedUserIds(viewerUserId: string): Promise<string[]> {
    const tables = await this.prisma.virtualTable.findMany({
      where: {
        status: PrismaVirtualTableStatus.FINISHED,
        seats: {
          some: {
            userId: viewerUserId
          }
        }
      },
      select: {
        seats: {
          select: {
            userId: true
          }
        }
      }
    });

    return collectDistinctUserIdsFromCompletedTables(tables);
  }

  private async hasSharedCompletedVirtualTable(
    viewerUserId: string,
    targetUserId: string
  ): Promise<boolean> {
    const sharedTable = await this.prisma.virtualTable.findFirst({
      where: {
        status: PrismaVirtualTableStatus.FINISHED,
        seats: {
          some: {
            userId: viewerUserId
          }
        },
        AND: [
          {
            seats: {
              some: {
                userId: targetUserId
              }
            }
          }
        ]
      },
      select: {
        id: true
      }
    });

    return Boolean(sharedTable);
  }

  private async getCompletedProfileTables(userId: string): Promise<CompletedProfileTableRecord[]> {
    return this.prisma.virtualTable.findMany({
      where: {
        status: PrismaVirtualTableStatus.FINISHED,
        finishedAt: {
          not: null
        },
        seats: {
          some: {
            userId
          }
        }
      },
      select: {
        id: true,
        title: true,
        startingStackChips: true,
        smallBlindChips: true,
        bigBlindChips: true,
        chipValueMinor: true,
        finishedAt: true,
        seats: {
          select: {
            userId: true
          }
        },
        hands: {
          where: {
            status: PrismaVirtualHandStatus.COMPLETED
          },
          include: {
            players: {
              include: {
                seat: {
                  include: {
                    user: true
                  }
                }
              }
            },
            actions: {
              orderBy: {
                createdAt: "asc"
              }
            },
            table: {
              select: {
                id: true,
                title: true,
                chipValueMinor: true,
                chipValueCurrency: true,
                smallBlindChips: true,
                bigBlindChips: true,
                finishedAt: true,
                seats: {
                  select: {
                    userId: true
                  }
                }
              }
            },
            pots: {
              include: {
                awards: true
              }
            },
            timers: true
          }
        }
      },
      orderBy: [
        {
          finishedAt: "desc"
        },
        {
          id: "desc"
        }
      ]
    });
  }

  async submitAction(
    user: UserDto,
    tableId: string,
    input: SubmitVirtualActionRequestDto
  ): Promise<SubmitVirtualActionResponseDto> {
    const table = await this.getTableOrThrow(tableId);
    const membership = table.seats.find((seat) => seat.userId === user.id);

    if (!membership) {
      throw new ApiError(
        VIRTUAL_ERROR_CODES.forbidden,
        "Этот стол вам недоступен",
        HttpStatus.FORBIDDEN
      );
    }

    if (table.status !== PrismaVirtualTableStatus.ACTIVE) {
      throw new ApiError(
        VIRTUAL_ERROR_CODES.conflict,
        "Стол сейчас на паузе",
        HttpStatus.CONFLICT
      );
    }

    const existingAction = await this.findPlayerActionByIdempotencyKey(
      table.id,
      membership.id,
      input.idempotencyKey
    );

    if (existingAction) {
      return this.restoreSubmitActionResponse(
        table.id,
        membership.id,
        input.handId,
        existingAction
      );
    }

    if (!table.currentHandId || table.currentHandId !== input.handId) {
      throw new ApiError(
        VIRTUAL_ERROR_CODES.conflict,
        "Эта раздача уже неактуальна",
        HttpStatus.CONFLICT
      );
    }

    const hand = await this.getHandById(input.handId);

    if (hand.tableId !== table.id) {
      throw new ApiError(
        VIRTUAL_ERROR_CODES.conflict,
        "Эта раздача уже неактуальна",
        HttpStatus.CONFLICT
      );
    }

    if (hand.status === PrismaVirtualHandStatus.COMPLETED) {
      throw new ApiError(
        VIRTUAL_ERROR_CODES.conflict,
        "Раздача уже завершена",
        HttpStatus.CONFLICT
      );
    }

    if (hand.currentActorSeatId !== membership.id) {
      throw new ApiError(
        VIRTUAL_ERROR_CODES.actionNotAllowed,
        "Сейчас ход другого игрока",
        HttpStatus.CONFLICT
      );
    }

    const state = this.toEngineHandState(table, hand);
    const legalActions = getLegalActions(state, membership.id);

    if (legalActions.length === 0) {
      throw new ApiError(
        VIRTUAL_ERROR_CODES.actionNotAllowed,
        "Сейчас это действие недоступно",
        HttpStatus.CONFLICT
      );
    }

    const { action, amountChips } = this.toEnginePlayerAction(
      membership.id,
      input,
      legalActions
    );
    const nextState = applyPlayerAction(state, action);
    const progressed = this.progressHand(nextState);
    const actedAt = new Date();
    const notificationJobs: Array<NotificationJob | null> = [];
    let finalProgressed = progressed;

    try {
      finalProgressed = await this.prisma.$transaction(async (tx) => {
        await tx.virtualAction.create({
          data: {
            tableId: table.id,
            handId: hand.id,
            seatId: membership.id,
            idempotencyKey: input.idempotencyKey,
            actorType: PrismaActionActorType.PLAYER,
            actionType: input.actionType,
            amountChips: amountChips === null ? null : BigInt(amountChips),
            metadataJson: {
              idempotencyKey: input.idempotencyKey,
              street: state.street
            },
            createdAt: actedAt
          }
        });
        return this.persistProgressedHandStateWithImmediateAutoActions(
          tx,
          table,
          hand,
          progressed,
          actedAt,
          {
            seatId: membership.id,
            resolutionType: PrismaTurnTimerResolution.PLAYER_ACTION
          }
        );
      });
    } catch (error) {
      if (this.isVirtualActionIdempotencyConstraintError(error)) {
        const duplicateAction = await this.findPlayerActionByIdempotencyKey(
          table.id,
          membership.id,
          input.idempotencyKey
        );

        if (duplicateAction) {
          return this.restoreSubmitActionResponse(
            table.id,
            membership.id,
            input.handId,
            duplicateAction
          );
        }
      }

      throw error;
    }

    await this.dispatchNotificationJobs(notificationJobs);

    return {
      tableId: table.id,
      handId: hand.id,
      actionType: input.actionType,
      amountChips,
      handStatus: finalProgressed.status,
      actedAt: actedAt.toISOString(),
      nextActorSeatId: finalProgressed.state.currentActorSeatId
    };
  }

  async processDueTurnTimers(now: Date = new Date()): Promise<ProcessDueTurnTimersResult> {
    const remindersDue = await this.prisma.turnTimer.findMany({
      where: {
        status: PrismaTurnTimerStatus.ACTIVE,
        reminderDueAt: {
          lte: now
        },
        remindedAt: null
      },
      orderBy: {
        reminderDueAt: "asc"
      }
    });
    const reminders: DueTurnTimerReminder[] = [];
    const notificationJobs: Array<NotificationJob | null> = [];

    for (const timer of remindersDue) {
      const updated = await this.prisma.turnTimer.updateMany({
        where: {
          id: timer.id,
          status: PrismaTurnTimerStatus.ACTIVE,
          remindedAt: null
        },
        data: {
          status: PrismaTurnTimerStatus.REMINDED,
          remindedAt: now
        }
      });

      if (updated.count > 0) {
        reminders.push({
          timerId: timer.id,
          tableId: timer.tableId,
          handId: timer.handId,
          seatId: timer.seatId,
          remindedAt: now
        });

        const table = await this.findTableById(this.prisma, timer.tableId);
        notificationJobs.push(this.createReminderNotificationJob(table, timer.seatId));
      }
    }

    const expiredTimers = await this.prisma.turnTimer.findMany({
      where: {
        status: {
          in: [PrismaTurnTimerStatus.ACTIVE, PrismaTurnTimerStatus.REMINDED]
        },
        expiresAt: {
          lte: now
        }
      },
      orderBy: {
        expiresAt: "asc"
      }
    });
    const timeouts: DueTurnTimerTimeout[] = [];

    for (const expiredTimer of expiredTimers) {
      const timeoutResult = await this.prisma.$transaction(async (tx) => {
        const timer = await tx.turnTimer.findUnique({
          where: {
            id: expiredTimer.id
          }
        });

        if (
          !timer ||
          (timer.status !== PrismaTurnTimerStatus.ACTIVE &&
            timer.status !== PrismaTurnTimerStatus.REMINDED) ||
          timer.expiresAt > now
        ) {
          return null;
        }

        const table = await this.findTableById(tx, timer.tableId);
        const hand = await this.findHandById(tx, timer.handId);

        if (!table || !hand) {
          await this.cancelTurnTimer(tx, timer.id, now);
          return null;
        }

        if (table.status === PrismaVirtualTableStatus.PAUSED) {
          await tx.turnTimer.updateMany({
            where: {
              id: timer.id,
              status: {
                in: [PrismaTurnTimerStatus.ACTIVE, PrismaTurnTimerStatus.REMINDED]
              }
            },
            data: {
              status: PrismaTurnTimerStatus.RESOLVED,
              resolvedAt: now,
              resolutionType: PrismaTurnTimerResolution.TABLE_PAUSED
            }
          });
          return null;
        }

        if (
          hand.status === PrismaVirtualHandStatus.COMPLETED ||
          hand.status === PrismaVirtualHandStatus.CANCELLED ||
          hand.currentActorSeatId === null
        ) {
          await this.resolveOutstandingTurnTimers(
            tx,
            hand.id,
            now,
            PrismaTurnTimerResolution.HAND_COMPLETED
          );
          return null;
        }

        if (table.currentHandId !== hand.id || hand.currentActorSeatId !== timer.seatId) {
          await this.cancelTurnTimer(tx, timer.id, now);
          return null;
        }

        const state = this.toEngineHandState(table, hand);
        const legalActions = getLegalActions(state, timer.seatId);
        const timeoutAction = this.getTimeoutPlayerAction(timer.seatId, legalActions);
        const nextState = applyPlayerAction(state, timeoutAction.action);
        const progressed = this.progressHand(nextState);

        await tx.virtualAction.create({
          data: {
            tableId: table.id,
            handId: hand.id,
            seatId: timer.seatId,
            actorType: PrismaActionActorType.SYSTEM,
            actionType: timeoutAction.actionType,
            metadataJson: {
              turnTimerId: timer.id,
              street: state.street
            },
            createdAt: now
          }
        });

        const timerNotificationJobs: Array<NotificationJob | null> = [
          this.createTimeoutNotificationJob(table, timer.seatId, timeoutAction.actionType)
        ];

        const finalProgressed =
          await this.persistProgressedHandStateWithImmediateAutoActions(
          tx,
          table,
          hand,
          progressed,
          now,
          {
            seatId: timer.seatId,
            resolutionType: timeoutAction.resolutionType
          }
        );

        return {
          timeout: {
            timerId: timer.id,
            tableId: table.id,
            handId: hand.id,
            seatId: timer.seatId,
            actionType: timeoutAction.actionType,
            actedAt: now,
            handStatus: finalProgressed.status,
            nextActorSeatId: finalProgressed.state.currentActorSeatId
          } satisfies DueTurnTimerTimeout,
          notificationJobs: timerNotificationJobs
        };
      });

      if (timeoutResult) {
        timeouts.push(timeoutResult.timeout);
        notificationJobs.push(...timeoutResult.notificationJobs);
      }
    }

    await this.dispatchNotificationJobs(notificationJobs);

    return {
      reminders,
      timeouts
    };
  }

  async processDueCompletedHands(now: Date = new Date()): Promise<void> {
    const activeTables = await this.prisma.virtualTable.findMany({
      where: {
        status: PrismaVirtualTableStatus.ACTIVE,
        currentHandId: {
          not: null
        }
      },
      include: {
        seats: {
          include: {
            user: true
          }
        }
      }
    });

    for (const table of activeTables) {
      if (!table.currentHandId) {
        continue;
      }

      const hand = await this.findHandById(this.prisma, table.currentHandId);

      if (
        !hand ||
        hand.status !== PrismaVirtualHandStatus.COMPLETED ||
        hand.completedAt === null ||
        addSeconds(hand.completedAt, COMPLETED_HAND_REVEAL_SECONDS) > now
      ) {
        continue;
      }

      await this.autoStartNextHandIfPossible(table.id, hand.id);
    }
  }

  private validateCreateTableInput(input: CreateVirtualTableRequestDto): void {
    if (input.title.trim().length === 0) {
      throw this.invalidInput("Как назвать стол?");
    }

    if (input.title.trim().length > VIRTUAL_TABLE_TITLE_MAX_LENGTH) {
      throw this.invalidInput("Название получилось слишком длинным");
    }

    if (input.maxSeats < VIRTUAL_MIN_SEATS || input.maxSeats > VIRTUAL_MAX_SEATS) {
      throw this.invalidInput("Выберите от 2 до 9 мест");
    }

    const startingStackChips = parsePositiveBigInt(
      input.startingStackChips,
      "Стартовый стек должен быть больше нуля"
    );
    const smallBlindChips = parsePositiveBigInt(
      input.smallBlindChips,
      "Малый блайнд должен быть больше нуля"
    );
    const bigBlindChips = parsePositiveBigInt(
      input.bigBlindChips,
      "Большой блайнд должен быть больше нуля"
    );

    if (startingStackChips > VIRTUAL_MAX_CHIPS) {
      throw this.invalidInput("Стартовый стек слишком большой");
    }

    if (smallBlindChips > VIRTUAL_MAX_CHIPS || bigBlindChips > VIRTUAL_MAX_CHIPS) {
      throw this.invalidInput("Блайнды слишком большие");
    }

    if (smallBlindChips >= bigBlindChips) {
      throw this.invalidInput("Малый блайнд должен быть меньше большого");
    }

    if (input.chipValueMinor !== null && input.chipValueMinor !== undefined) {
      const chipValueMinor = parsePositiveBigInt(
        input.chipValueMinor,
        "Стоимость фишки должна быть больше нуля"
      );

      if (chipValueMinor > VIRTUAL_MAX_CHIPS) {
        throw this.invalidInput("Стоимость фишки слишком большая");
      }
    }

    if (input.turnDurationSeconds <= 0 || input.reminderDelaySeconds <= 0) {
      throw this.invalidInput("Время должно быть больше нуля");
    }

    if (input.reminderDelaySeconds >= input.turnDurationSeconds) {
      throw this.invalidInput("Напоминание должно прийти раньше тайм-аута");
    }

    if (input.clubId) {
      parseScheduledStartAt(input.scheduledStartAt, this.invalidInput.bind(this));
    }

    if (input.maxPlayers !== undefined && input.maxPlayers !== null && input.maxPlayers <= 0) {
      throw this.invalidInput("Лимит игроков должен быть больше нуля");
    }
  }

  private async getTableOrThrow(tableId: string): Promise<TableRecord> {
    const table = await this.findTableById(this.prisma, tableId);

    if (!table) {
      throw new ApiError(
        VIRTUAL_ERROR_CODES.notFound,
        "Стол не найден",
        HttpStatus.NOT_FOUND
      );
    }

    return table;
  }

  private async getHandById(handId: string): Promise<HandRecord> {
    const hand = await this.findHandById(this.prisma, handId);

    if (!hand) {
      throw new ApiError(
        VIRTUAL_ERROR_CODES.notFound,
        "Раздача не найдена",
        HttpStatus.NOT_FOUND
      );
    }

    return hand;
  }

  private async findCurrentTurnTimer(
    tableId: string,
    hand: Pick<HandRecord, "id" | "status" | "currentActorSeatId">
  ): Promise<CurrentTurnTimerRecord | null> {
    if (
      hand.currentActorSeatId === null ||
      hand.status === PrismaVirtualHandStatus.COMPLETED ||
      hand.status === PrismaVirtualHandStatus.CANCELLED
    ) {
      return null;
    }

    return this.prisma.turnTimer.findFirst({
      where: {
        tableId,
        handId: hand.id,
        seatId: hand.currentActorSeatId,
        status: {
          in: [PrismaTurnTimerStatus.ACTIVE, PrismaTurnTimerStatus.REMINDED]
        }
      },
      select: {
        id: true,
        seatId: true,
        status: true,
        startedAt: true,
        reminderDueAt: true,
        expiresAt: true,
        remindedAt: true
      },
      orderBy: {
        startedAt: "desc"
      }
    });
  }

  private async getHandHistoryById(handId: string): Promise<HandHistoryRecord> {
    const hand = await this.findHandHistoryById(handId);

    if (!hand) {
      throw new ApiError(
        VIRTUAL_ERROR_CODES.notFound,
        "Раздача не найдена",
        HttpStatus.NOT_FOUND
      );
    }

    return hand;
  }

  private async findPlayerActionByIdempotencyKey(
    tableId: string,
    seatId: string,
    idempotencyKey: string
  ): Promise<PlayerVirtualActionRecord | null> {
    const action = await this.prisma.virtualAction.findFirst({
      where: {
        tableId,
        seatId,
        idempotencyKey,
        actorType: PrismaActionActorType.PLAYER
      },
      orderBy: {
        createdAt: "asc"
      }
    });

    if (!action || !action.handId || !action.seatId || !action.idempotencyKey) {
      return null;
    }

    return action as PlayerVirtualActionRecord;
  }

  private async findRecentTableReactions(tableId: string): Promise<TableReactionRecord[]> {
    return this.prisma.virtualTableReaction.findMany({
      where: {
        tableId,
        createdAt: {
          gte: new Date(Date.now() - VIRTUAL_REACTION_WINDOW_MS)
        }
      },
      include: {
        seat: {
          include: {
            user: true
          }
        }
      },
      orderBy: [
        {
          createdAt: "asc"
        },
        {
          id: "asc"
        }
      ]
    });
  }

  private async restoreSubmitActionResponse(
    tableId: string,
    seatId: string,
    requestedHandId: string,
    action: PlayerVirtualActionRecord
  ): Promise<SubmitVirtualActionResponseDto> {
    if (
      action.tableId !== tableId ||
      action.seatId !== seatId ||
      action.handId !== requestedHandId
    ) {
      throw new ApiError(
        VIRTUAL_ERROR_CODES.conflict,
        "Этот ключ запроса уже использовался для другой раздачи",
        HttpStatus.CONFLICT
      );
    }

    const hand = await this.getHandById(action.handId);

    if (hand.tableId !== tableId) {
      throw new ApiError(
        VIRTUAL_ERROR_CODES.conflict,
        "Не удалось повторно восстановить результат действия",
        HttpStatus.CONFLICT
      );
    }

    return this.buildSubmitActionResponse(action, hand);
  }

  private async createHandForTable(
    table: TableRecord,
    previousDealerSeatId: string | null
  ): Promise<CreatedHandResult> {
    const activeSeats = this.getEligibleNextHandSeats(table);

    if (activeSeats.length < 2) {
      throw new ApiError(
        VIRTUAL_ERROR_CODES.conflict,
        "Для старта нужны хотя бы два игрока",
        HttpStatus.CONFLICT
      );
    }

    const handNumber = (await this.prisma.virtualHand.count({
      where: {
        tableId: table.id
      }
    })) + 1;
    const seed = randomBytes(16).toString("hex");
    const smallBlindChips = table.pendingSmallBlindChips ?? table.smallBlindChips;
    const bigBlindChips = table.pendingBigBlindChips ?? table.bigBlindChips;
    const handStartedAt = new Date();
    const tableStartedAt = table.startedAt ?? handStartedAt;

    const hand = await this.prisma.$transaction(async (tx) => {
      return this.createHandForTableInTransaction(tx, table, {
        handNumber,
        previousDealerSeatId,
        seed,
        handStartedAt,
        tableStartedAt,
        smallBlindChips,
        bigBlindChips
      });
    });

    return {
      hand,
      tableStartedAt
    };
  }

  private async autoStartNextHandIfPossible(
    tableId: string,
    completedHandId: string
  ): Promise<NextHandStartResult | null> {
    return this.prisma.$transaction(async (tx) => {
      const table = await this.findTableById(tx, tableId);
      const completedHand = await this.findHandById(tx, completedHandId);

      if (
        !table ||
        !completedHand ||
        table.status !== PrismaVirtualTableStatus.ACTIVE ||
        table.currentHandId !== completedHandId ||
        completedHand.status !== PrismaVirtualHandStatus.COMPLETED
      ) {
        return null;
      }

      if (this.getEligibleNextHandSeats(table).length < 2) {
        return null;
      }

      const claimedTable = await tx.virtualTable.updateMany({
        where: {
          id: table.id,
          status: PrismaVirtualTableStatus.ACTIVE,
          currentHandId: completedHandId
        },
        data: {
          currentHandId: null
        }
      });

      if (claimedTable.count === 0) {
        return null;
      }

      const handNumber = (await tx.virtualHand.count({
        where: {
          tableId: table.id
        }
      })) + 1;
      const handStartedAt = new Date();
      const tableStartedAt = table.startedAt ?? handStartedAt;
      const hand = await this.createHandForTableInTransaction(tx, table, {
        handNumber,
        previousDealerSeatId: completedHand.dealerSeatId,
        seed: randomBytes(16).toString("hex"),
        handStartedAt,
        tableStartedAt,
        smallBlindChips: table.pendingSmallBlindChips ?? table.smallBlindChips,
        bigBlindChips: table.pendingBigBlindChips ?? table.bigBlindChips
      });

      return {
        hand,
        tableStartedAt,
        autoStarted: true
      };
    });
  }

  private async createHandForTableInTransaction(
    tx: Prisma.TransactionClient,
    table: TableRecord,
    options: {
      handNumber: number;
      previousDealerSeatId: string | null;
      seed: string;
      handStartedAt: Date;
      tableStartedAt: Date;
      smallBlindChips: bigint;
      bigBlindChips: bigint;
    }
  ): Promise<VirtualHand> {
    const activeSeats = this.getEligibleNextHandSeats(table);
    const handState = startHand(
      {
        tableId: table.id,
        dealerSeatId: options.previousDealerSeatId,
        smallBlind: bigintToNumber(options.smallBlindChips, "small blind"),
        bigBlind: bigintToNumber(options.bigBlindChips, "big blind"),
        seats: activeSeats
          .sort((left, right) => left.seatNumber - right.seatNumber)
          .map((seat) => ({
            seatId: seat.id,
            stack: bigintToNumber(seat.stackChips, "seat stack"),
            isOccupied: true
          }))
      },
      options.seed
    );

    const createdHand = await tx.virtualHand.create({
      data: {
        tableId: table.id,
        handNumber: options.handNumber,
        status: PrismaVirtualHandStatus.IN_PROGRESS,
        dealerSeatId: handState.dealerSeatId,
        smallBlindSeatId: handState.smallBlindSeatId,
        bigBlindSeatId: handState.bigBlindSeatId,
        smallBlindChips: BigInt(handState.smallBlind),
        bigBlindChips: BigInt(handState.bigBlind),
        currentStreet: PrismaStreet.PRE_FLOP,
        currentActorSeatId: handState.currentActorSeatId,
        currentBetChips: BigInt(handState.currentBet),
        minRaiseChips: BigInt(handState.minRaise),
        potTotalChips: BigInt(handState.pot),
        // The current schema has only deckSeedHash. For Phase 5 we store the
        // raw seed here so later streets can be reconstructed deterministically.
        deckSeedHash: options.seed,
        startedAt: options.handStartedAt
      }
    });

    await tx.virtualHandPlayer.createMany({
      data: handState.seats.map((seat) => ({
        handId: createdHand.id,
        seatId: seat.seatId,
        status: this.toHandPlayerStatus(seat),
        startingStackChips: BigInt(seat.stackAtHandStart),
        currentStackChips: BigInt(seat.stack),
        committedTotalChips: BigInt(seat.committed),
        committedStreetChips: BigInt(seat.streetCommitment),
        privateCard1: seat.privateCards[0] ?? null,
        privateCard2: seat.privateCards[1] ?? null,
        hasActedThisStreet: seat.hasActedThisStreet,
        isEligibleForShowdown: !seat.hasFolded
      }))
    });

    await tx.virtualAction.createMany({
      data: [
        {
          tableId: table.id,
          handId: createdHand.id,
          actorType: PrismaActionActorType.SYSTEM,
          actionType: PrismaActionType.HAND_STARTED,
          createdAt: options.handStartedAt
        },
        {
          tableId: table.id,
          handId: createdHand.id,
          seatId: handState.smallBlindSeatId,
          actorType: PrismaActionActorType.SYSTEM,
          actionType: PrismaActionType.POST_SMALL_BLIND,
          amountChips: BigInt(
            handState.seats.find((seat) => seat.seatId === handState.smallBlindSeatId)
              ?.streetCommitment ?? 0
          ),
          createdAt: options.handStartedAt
        },
        {
          tableId: table.id,
          handId: createdHand.id,
          seatId: handState.bigBlindSeatId,
          actorType: PrismaActionActorType.SYSTEM,
          actionType: PrismaActionType.POST_BIG_BLIND,
          amountChips: BigInt(
            handState.seats.find((seat) => seat.seatId === handState.bigBlindSeatId)
              ?.streetCommitment ?? 0
          ),
          createdAt: options.handStartedAt
        }
      ]
    });

    await this.persistSeatState(tx, table.seats, handState, false);

    await tx.virtualTable.update({
      where: {
        id: table.id
      },
      data: {
        status: PrismaVirtualTableStatus.ACTIVE,
        startedAt: options.tableStartedAt,
        smallBlindChips: options.smallBlindChips,
        bigBlindChips: options.bigBlindChips,
        pendingSmallBlindChips: null,
        pendingBigBlindChips: null,
        currentHandId: createdHand.id
      }
    });

    await this.persistProgressedHandStateWithImmediateAutoActions(
      tx,
      table,
      createdHand,
      {
        state: handState,
        status: PrismaVirtualHandStatus.IN_PROGRESS,
        pots: []
      },
      options.handStartedAt,
      null
    );

    return createdHand;
  }

  private getEligibleNextHandSeats(table: Pick<TableRecord, "seats">): TableRecord["seats"] {
    return table.seats.filter(
      (seat) =>
        (seat.status === PrismaVirtualSeatStatus.ACTIVE ||
          seat.status === PrismaVirtualSeatStatus.SIT_OUT_REQUESTED ||
          seat.status === PrismaVirtualSeatStatus.RETURN_REQUESTED) &&
        seat.stackChips > 0n
    );
  }

  private async findTableById(
    client: Prisma.TransactionClient | PrismaService,
    tableId: string
  ): Promise<TableRecord | null> {
    return client.virtualTable.findUnique({
      where: {
        id: tableId
      },
      include: {
        seats: {
          include: {
            user: true
          },
          orderBy: {
            seatNumber: "asc"
          }
        }
      }
    });
  }

  private async findHandById(
    client: Prisma.TransactionClient | PrismaService,
    handId: string
  ): Promise<HandRecord | null> {
    return client.virtualHand.findUnique({
      where: {
        id: handId
      },
      include: {
        players: {
          include: {
            seat: {
              include: {
                user: true
              }
            }
          },
          orderBy: {
            seat: {
              seatNumber: "asc"
            }
          }
        },
        communityCards: {
          orderBy: {
            position: "asc"
          }
        },
        pots: {
          include: {
            awards: true
          }
        }
      }
    });
  }

  private async findHandHistoryById(handId: string): Promise<HandHistoryRecord | null> {
    return this.prisma.virtualHand.findUnique({
      where: {
        id: handId
      },
      include: {
        players: {
          include: {
            seat: {
              include: {
                user: true
              }
            }
          },
          orderBy: {
            seat: {
              seatNumber: "asc"
            }
          }
        },
        communityCards: {
          orderBy: {
            position: "asc"
          }
        },
        pots: {
          include: {
            awards: true
          }
        },
        actions: {
          include: {
            seat: {
              include: {
                user: true
              }
            }
          },
          orderBy: {
            createdAt: "asc"
          }
        }
      }
    });
  }

  private toTableDto(table: TableRecord, hand: HandRecord | null) {
    return {
      id: table.id,
      title: table.title,
      status: table.status,
      maxSeats: table.maxSeats,
      inviteCode: table.inviteCode,
      startingStackChips: table.startingStackChips.toString(),
      chipValueMinor: table.chipValueMinor?.toString() ?? null,
      chipValueCurrency: table.chipValueCurrency,
      smallBlindChips: table.smallBlindChips.toString(),
      bigBlindChips: table.bigBlindChips.toString(),
      winProbabilityEnabled: table.winProbabilityEnabled,
      pendingSmallBlindChips: table.pendingSmallBlindChips?.toString() ?? null,
      pendingBigBlindChips: table.pendingBigBlindChips?.toString() ?? null,
      turnDurationSeconds: table.turnDurationSeconds,
      reminderDelaySeconds: table.reminderDelaySeconds,
      timeoutAutoActionRule: table.timeoutAutoActionRule,
      isPrivate: table.isPrivate,
      potTotalChips: hand?.potTotalChips.toString() ?? "0",
      currentHandId: table.currentHandId,
      createdAt: table.createdAt.toISOString(),
      startedAt: table.startedAt?.toISOString() ?? null,
      pausedAt: table.pausedAt?.toISOString() ?? null,
      finishedAt: table.finishedAt?.toISOString() ?? null
    };
  }

  private toSeatDto(
    seat: TableRecord["seats"][number],
    hand: HandRecord | null,
    winProbabilityBySeatId: Map<string, number | null> | null
  ): VirtualSeatDto {
    const handPlayer = hand?.players.find((player) => player.seatId === seat.id);

    return {
      id: seat.id,
      userId: seat.userId,
      displayName: seat.displayName ?? getUserDisplayName(seat.user),
      avatarUrl: seat.user.avatarUrl,
      seatNumber: seat.seatNumber,
      role: seat.role,
      stackChips: seat.stackChips.toString(),
      committedStreetChips: handPlayer?.committedStreetChips.toString() ?? "0",
      committedTotalChips: handPlayer?.committedTotalChips.toString() ?? "0",
      status: seat.status,
      isDealer: hand?.dealerSeatId === seat.id,
      isSmallBlind: hand?.smallBlindSeatId === seat.id,
      isBigBlind: hand?.bigBlindSeatId === seat.id,
      winProbabilityPercent: winProbabilityBySeatId?.get(seat.id) ?? null
    };
  }

  private toTableReactionDto(reaction: TableReactionRecord): VirtualTableReactionDto {
    return {
      id: reaction.id,
      tableId: reaction.tableId,
      seatId: reaction.seatId,
      userId: reaction.userId,
      displayName: reaction.seat.displayName ?? getUserDisplayName(reaction.seat.user),
      emoji: reaction.emoji,
      createdAt: reaction.createdAt.toISOString()
    };
  }

  private getSeatWinProbabilityValues(
    table: Pick<TableRecord, "id" | "winProbabilityEnabled">,
    hand: HandRecord | null,
    viewerSeatId: string
  ): Map<string, number | null> | null {
    if (
      !table.winProbabilityEnabled ||
      hand === null ||
      hand.status === PrismaVirtualHandStatus.COMPLETED ||
      hand.status === PrismaVirtualHandStatus.CANCELLED
    ) {
      return null;
    }

    const fingerprint = this.getWinProbabilityFingerprint(hand, viewerSeatId);
    const cacheKey = `${hand.id}:${viewerSeatId}`;
    const cached = this.winProbabilityCache.get(cacheKey);

    if (cached && cached.fingerprint === fingerprint) {
      return cached.valuesBySeatId;
    }

    const state = this.toEngineHandState({ id: table.id }, hand);
    const calculated = calculateViewerWinProbability({
      state,
      viewerSeatId,
      seed: `${hand.id}:${viewerSeatId}:${fingerprint}`
    });
    const valuesBySeatId = new Map<string, number | null>([
      [
        viewerSeatId,
        calculated.winProbability === null
          ? null
          : roundWinProbabilityPercent(calculated.winProbability * 100)
      ]
    ]);

    this.winProbabilityCache.set(cacheKey, {
      fingerprint,
      valuesBySeatId
    });

    return valuesBySeatId;
  }

  private getWinProbabilityFingerprint(hand: HandRecord, viewerSeatId: string): string {
    const playerFingerprint = hand.players
      .slice()
      .sort((left, right) => left.seat.seatNumber - right.seat.seatNumber)
      .map((player) =>
        [
          player.seatId,
          player.status,
          player.currentStackChips.toString(),
          player.committedTotalChips.toString(),
          player.committedStreetChips.toString(),
          player.hasActedThisStreet ? "1" : "0",
          player.isEligibleForShowdown ? "1" : "0",
          player.seatId === viewerSeatId ? player.privateCard1 ?? "" : "",
          player.seatId === viewerSeatId ? player.privateCard2 ?? "" : ""
        ].join(":")
      )
      .join("|");
    const boardFingerprint = hand.communityCards
      .slice()
      .sort((left, right) => left.position - right.position)
      .map((card) => `${card.position}:${card.card}`)
      .join("|");

    return [
      hand.status,
      hand.currentStreet,
      hand.currentActorSeatId ?? "",
      hand.currentBetChips.toString(),
      hand.minRaiseChips.toString(),
      hand.potTotalChips.toString(),
      boardFingerprint,
      playerFingerprint
    ].join("#");
  }

  private toHandDto(
    table: TableRecord,
    hand: HandRecord,
    viewerSeatId: string,
    currentTimer: CurrentTurnTimerRecord | null
  ): VirtualHandDto {
    const state = this.toEngineHandState(table, hand);
    const viewerPlayer = hand.players.find((player) => player.seatId === viewerSeatId);
    const myLegalActions =
      hand.status === PrismaVirtualHandStatus.COMPLETED
        ? []
        : getLegalActions(state, viewerSeatId).map(toVirtualLegalActionDto);
    const callAmount =
      viewerPlayer === undefined
        ? 0n
        : maxBigInt(0n, hand.currentBetChips - viewerPlayer.committedStreetChips);

    return {
      id: hand.id,
      handNumber: hand.handNumber,
      status: hand.status,
      street: hand.currentStreet,
      board: hand.communityCards
        .slice()
        .sort((left, right) => left.position - right.position)
        .map((card: CommunityCard) => card.card),
      currentActorSeatId: hand.currentActorSeatId,
      currentTimer: this.toTurnTimerDto(currentTimer),
      currentBetChips: hand.currentBetChips.toString(),
      callAmountChips: callAmount.toString(),
      myPrivateCards: getPrivateCards(state, viewerSeatId),
      myLegalActions,
      resultSummary: this.toHandResultSummaryDto(hand)
    };
  }

  private toHandResultSummaryDto(hand: HandRecord): VirtualHandResultSummaryDto | null {
    if (hand.status !== PrismaVirtualHandStatus.COMPLETED || hand.completedAt === null) {
      return null;
    }

    const winnersBySeatId = new Map<
      string,
      {
        seatId: string;
        displayName: string;
        amountChips: bigint;
        handRank: HandRank | null;
        handRankLabel: string | null;
        bestFiveCards: string[];
        seatNumber: number;
      }
    >();
    let wonByFold = false;

    for (const pot of hand.pots) {
      for (const award of pot.awards) {
        const player = hand.players.find((candidate) => candidate.seatId === award.winnerSeatId);
        const displayName = player ? getSeatDisplayName(player.seat) : "Игрок";
        const seatNumber = player?.seat.seatNumber ?? Number.MAX_SAFE_INTEGER;
        const evaluatedHand = parseEvaluatedHand(award.handRankJson);

        if (evaluatedHand === null) {
          wonByFold = true;
        }

        const existingWinner = winnersBySeatId.get(award.winnerSeatId);

        if (existingWinner) {
          existingWinner.amountChips += award.amountChips;
          continue;
        }

        winnersBySeatId.set(award.winnerSeatId, {
          seatId: award.winnerSeatId,
          displayName,
          amountChips: award.amountChips,
          handRank: evaluatedHand?.rank ?? null,
          handRankLabel: evaluatedHand ? getHandRankLabelRu(evaluatedHand.rank) : null,
          bestFiveCards: evaluatedHand?.bestFiveCards ?? [],
          seatNumber
        });
      }
    }

    return {
      revealUntil: addSeconds(hand.completedAt, COMPLETED_HAND_REVEAL_SECONDS).toISOString(),
      wonByFold,
      winners: [...winnersBySeatId.values()]
        .sort((left, right) => left.seatNumber - right.seatNumber)
        .map((winner) => ({
          seatId: winner.seatId,
          displayName: winner.displayName,
          amountChips: winner.amountChips.toString(),
          handRank: winner.handRank,
          handRankLabel: winner.handRankLabel,
          bestFiveCards: winner.bestFiveCards
        }))
    };
  }

  private toTurnTimerDto(timer: CurrentTurnTimerRecord | null): VirtualTurnTimerDto | null {
    if (!timer) {
      return null;
    }

    return {
      id: timer.id,
      seatId: timer.seatId,
      status: timer.status as VirtualTurnTimerDto["status"],
      startedAt: timer.startedAt.toISOString(),
      reminderDueAt: timer.reminderDueAt.toISOString(),
      expiresAt: timer.expiresAt.toISOString(),
      remindedAt: timer.remindedAt?.toISOString() ?? null
    };
  }

  private toOnlineStatsDto(
    stats: Pick<
      OnlinePlayerStats,
      | "userId"
      | "handsPlayed"
      | "handsWon"
      | "netChips"
      | "netEstimatedMinor"
      | "bigBlindsWon"
      | "bbPer100Bps"
      | "winRateBps"
      | "avgChipsPerHand"
      | "onlinePokerScore"
    > | null,
    user: Pick<UserDto, "id" | "username" | "firstName"> | User
  ): VirtualOnlineStatsDto {
    return {
      userId: stats?.userId ?? user.id,
      displayName: getUserFacingDisplayName(user),
      username: user.username ?? null,
      handsPlayed: stats?.handsPlayed ?? 0,
      handsWon: stats?.handsWon ?? 0,
      netChips: stats?.netChips.toString() ?? "0",
      netEstimatedMinor: stats?.netEstimatedMinor.toString() ?? "0",
      bigBlindsWon: stats?.bigBlindsWon.toString() ?? "0",
      bbPer100Bps: stats?.bbPer100Bps ?? 0,
      winRateBps: stats?.winRateBps ?? 0,
      avgChipsPerHand: stats?.avgChipsPerHand.toString() ?? "0",
      onlinePokerScore: stats?.onlinePokerScore ?? 0
    };
  }

  private toEngineHandState(
    table: Pick<TableRecord, "id">,
    hand: HandRecord
  ): HandState {
    const seed = hand.deckSeedHash;

    if (!seed) {
      throw new ApiError(
        VIRTUAL_ERROR_CODES.conflict,
        "Не удалось восстановить состояние раздачи",
        HttpStatus.CONFLICT
      );
    }

    const board: Card[] = hand.communityCards
      .slice()
      .sort((left, right) => left.position - right.position)
      .map((card: CommunityCard) => card.card as Card);
    const usedCards = new Set<string>(board);

    for (const player of hand.players) {
      if (player.privateCard1) {
        usedCards.add(player.privateCard1);
      }

      if (player.privateCard2) {
        usedCards.add(player.privateCard2);
      }
    }

    const deck = shuffleDeck(seed).filter((card) => !usedCards.has(card));

    return {
      tableId: table.id,
      dealerSeatId: hand.dealerSeatId,
      smallBlindSeatId: hand.smallBlindSeatId,
      bigBlindSeatId: hand.bigBlindSeatId,
      currentActorSeatId: hand.currentActorSeatId,
      street: hand.currentStreet,
      smallBlind: bigintToNumber(hand.smallBlindChips, "small blind"),
      bigBlind: bigintToNumber(hand.bigBlindChips, "big blind"),
      board,
      pot: bigintToNumber(hand.potTotalChips, "pot"),
      currentBet: bigintToNumber(hand.currentBetChips, "current bet"),
      minRaise: bigintToNumber(hand.minRaiseChips, "min raise"),
      deck,
      seats: hand.players
        .slice()
        .sort((left, right) => left.seat.seatNumber - right.seat.seatNumber)
        .map((player: HandRecord["players"][number]) => ({
          seatId: player.seatId,
          stack: bigintToNumber(player.currentStackChips, "current stack"),
          stackAtHandStart: bigintToNumber(player.startingStackChips, "starting stack"),
          isInHand: player.status !== PrismaHandPlayerStatus.SITTING_OUT,
          hasFolded: player.status === PrismaHandPlayerStatus.FOLDED,
          isAllIn: player.status === PrismaHandPlayerStatus.ALL_IN,
          committed: bigintToNumber(player.committedTotalChips, "committed total"),
          streetCommitment: bigintToNumber(
            player.committedStreetChips,
            "committed street"
          ),
          hasActedThisStreet: player.hasActedThisStreet,
          privateCards: [player.privateCard1, player.privateCard2].filter(
            (card): card is Card => Boolean(card)
          )
        }))
    };
  }

  private toEnginePlayerAction(
    seatId: string,
    input: SubmitVirtualActionRequestDto,
    legalActions: LegalAction[]
  ): {
    action: PlayerAction;
    amountChips: string | null;
  } {
    const legalAction = legalActions.find((candidate) => candidate.type === input.actionType);

    if (!legalAction) {
      throw new ApiError(
        VIRTUAL_ERROR_CODES.actionNotAllowed,
        "Сейчас это действие недоступно",
        HttpStatus.CONFLICT
      );
    }

    switch (input.actionType) {
      case "FOLD":
        return {
          action: {
            seatId,
            type: "FOLD"
          },
          amountChips: null
        };
      case "CHECK":
        return {
          action: {
            seatId,
            type: "CHECK"
          },
          amountChips: null
        };
      case "CALL":
        return {
          action: {
            seatId,
            type: "CALL"
          },
          amountChips: "amount" in legalAction ? String(legalAction.amount) : null
        };
      case "ALL_IN":
        return {
          action: {
            seatId,
            type: "ALL_IN"
          },
          amountChips: "amount" in legalAction ? String(legalAction.amount) : null
        };
      case "BET":
      case "RAISE": {
        const parsedAmount = parsePositiveBigInt(
          input.amountChips,
          "Укажите сумму действия"
        );
        const numericAmount = bigintToNumber(parsedAmount, "bet amount");

        if (
          !("min" in legalAction) ||
          numericAmount < legalAction.min ||
          numericAmount > legalAction.max
        ) {
          throw new ApiError(
            VIRTUAL_ERROR_CODES.actionNotAllowed,
            "Сейчас эта сумма недоступна",
            HttpStatus.CONFLICT
          );
        }

        return {
          action: {
            seatId,
            type: input.actionType,
            amount: numericAmount
          },
          amountChips: parsedAmount.toString()
        };
      }
      default: {
        const exhaustiveCheck: never = input.actionType;
        throw new ApiError(
          VIRTUAL_ERROR_CODES.actionNotAllowed,
          `Неизвестное действие: ${String(exhaustiveCheck)}`,
          HttpStatus.CONFLICT
        );
      }
    }
  }

  private progressHand(state: HandState): HandProgressResult {
    let nextState = state;

    while (true) {
      const liveSeatIds = nextState.seats.filter(
        (seat: HandState["seats"][number]) => seat.isInHand && !seat.hasFolded
      );

      if (liveSeatIds.length === 1) {
        const winner = liveSeatIds[0];

        if (winner === undefined) {
          break;
        }

        const updatedSeats = nextState.seats.map((seat: HandState["seats"][number]) =>
          seat.seatId === winner.seatId
            ? {
                ...seat,
                stack: seat.stack + nextState.pot
              }
            : seat
        );

        return {
          state: {
            ...nextState,
            seats: updatedSeats,
            pot: 0,
            currentActorSeatId: null,
            street: "SHOWDOWN"
          },
          status: PrismaVirtualHandStatus.COMPLETED,
          pots: [
            {
              potType: PrismaPotType.MAIN,
              amountChips: BigInt(nextState.pot),
              capChips: null,
              eligibleSeatIds: [winner.seatId],
              awards: [
                {
                  winnerSeatId: winner.seatId,
                  amountChips: BigInt(nextState.pot),
                  handRankJson: null
                }
              ]
            }
          ]
        };
      }

      if (!isBettingRoundComplete(nextState)) {
        return {
          state: nextState,
          status: PrismaVirtualHandStatus.IN_PROGRESS,
          pots: []
        };
      }

      if (nextState.street !== "SHOWDOWN") {
        nextState = advanceStreet(nextState);
      }

      if (nextState.street === "SHOWDOWN") {
        const showdown = completeShowdown(nextState);

        return {
          state: showdown.nextState,
          status: PrismaVirtualHandStatus.COMPLETED,
          pots: showdown.pots.map((pot, potIndex) => ({
            potType: pot.type === "MAIN" ? PrismaPotType.MAIN : PrismaPotType.SIDE,
            amountChips: BigInt(pot.amount),
            capChips: BigInt(pot.cap),
            eligibleSeatIds: pot.eligibleSeatIds,
            awards: showdown.awards
              .filter((award) => award.potIndex === potIndex)
              .map((award) => ({
                winnerSeatId: award.seatId,
                amountChips: BigInt(award.amount),
                handRankJson: award.evaluatedHand
              }))
          }))
        };
      }
    }

    return {
      state: nextState,
      status: PrismaVirtualHandStatus.IN_PROGRESS,
      pots: []
    };
  }

  private async persistProgressedHandState(
    tx: Prisma.TransactionClient,
    table: TableRecord,
    hand: Pick<HandRecord, "id">,
    progressed: HandProgressResult,
    actedAt: Date,
    timerResolution:
      | {
          seatId: string;
          resolutionType: PrismaTurnTimerResolution;
        }
      | null
  ): Promise<void> {
    if (timerResolution) {
      await tx.turnTimer.updateMany({
        where: {
          handId: hand.id,
          seatId: timerResolution.seatId,
          status: {
            in: [PrismaTurnTimerStatus.ACTIVE, PrismaTurnTimerStatus.REMINDED]
          }
        },
        data: {
          status: PrismaTurnTimerStatus.RESOLVED,
          resolvedAt: actedAt,
          resolutionType: timerResolution.resolutionType
        }
      });
    }

    await tx.virtualHand.update({
      where: {
        id: hand.id
      },
      data: {
        status: progressed.status,
        currentStreet:
          progressed.status === PrismaVirtualHandStatus.COMPLETED
            ? PrismaStreet.SHOWDOWN
            : this.toPrismaStreet(progressed.state.street),
        currentActorSeatId: progressed.state.currentActorSeatId,
        currentBetChips: BigInt(progressed.state.currentBet),
        minRaiseChips: BigInt(progressed.state.minRaise),
        potTotalChips: BigInt(progressed.state.pot),
        completedAt:
          progressed.status === PrismaVirtualHandStatus.COMPLETED ? actedAt : null
      }
    });

    await Promise.all(
      progressed.state.seats.map((seat: HandState["seats"][number]) =>
        tx.virtualHandPlayer.update({
          where: {
            handId_seatId: {
              handId: hand.id,
              seatId: seat.seatId
            }
          },
          data: {
            status: this.toHandPlayerStatus(seat),
            currentStackChips: BigInt(seat.stack),
            committedTotalChips: BigInt(seat.committed),
            committedStreetChips: BigInt(seat.streetCommitment),
            hasActedThisStreet: seat.hasActedThisStreet,
            isEligibleForShowdown: !seat.hasFolded
          }
        })
      )
    );

    await tx.communityCard.deleteMany({
      where: {
        handId: hand.id
      }
    });

    if (progressed.state.board.length > 0) {
      await tx.communityCard.createMany({
        data: progressed.state.board.map((card: string, index: number) => ({
          handId: hand.id,
          street: getStreetForBoardPosition(index),
          card,
          position: index
        }))
      });
    }

    await tx.virtualPot.deleteMany({
      where: {
        handId: hand.id
      }
    });

    await Promise.all(
      progressed.pots.map((pot) =>
        tx.virtualPot.create({
          data: {
            handId: hand.id,
            potType: pot.potType,
            amountChips: pot.amountChips,
            capChips: pot.capChips,
            eligibleSeatIdsJson: pot.eligibleSeatIds,
            awardedAt:
              progressed.status === PrismaVirtualHandStatus.COMPLETED ? actedAt : null,
            awards: {
              create: pot.awards.map((award) => ({
                winnerSeatId: award.winnerSeatId,
                amountChips: award.amountChips,
                handRankJson: award.handRankJson ?? Prisma.JsonNull
              }))
            }
          }
        })
      )
    );

    const seatStateResult = await this.persistSeatState(
      tx,
      table.seats,
      progressed.state,
      progressed.status === PrismaVirtualHandStatus.COMPLETED
    );

    if (seatStateResult.sittingOutSeatIds.length > 0) {
      await tx.virtualAction.createMany({
        data: seatStateResult.sittingOutSeatIds.map((seatId) => ({
          tableId: table.id,
          handId: hand.id,
          seatId,
          actorType: PrismaActionActorType.SYSTEM,
          actionType: PrismaActionType.SITTING_OUT,
          createdAt: actedAt
        }))
      });
    }

    if (progressed.status === PrismaVirtualHandStatus.COMPLETED) {
      await this.persistCompletedHandOnlinePlayerStats(tx, table, progressed.state);
      await this.resolveOutstandingTurnTimers(
        tx,
        hand.id,
        actedAt,
        PrismaTurnTimerResolution.HAND_COMPLETED
      );
      return;
    }

    if (progressed.state.currentActorSeatId) {
      await this.createTurnTimer(
        tx,
        table,
        hand.id,
        progressed.state.currentActorSeatId,
        actedAt
      );
    }
  }

  private async persistProgressedHandStateWithImmediateAutoActions(
    tx: Prisma.TransactionClient,
    table: TableRecord,
    hand: Pick<HandRecord, "id">,
    initialProgressed: HandProgressResult,
    actedAt: Date,
    timerResolution:
      | {
          seatId: string;
          resolutionType: PrismaTurnTimerResolution;
        }
      | null
  ): Promise<HandProgressResult> {
    let progressed = initialProgressed;
    const maxAutoActions = table.seats.length + 2;

    for (let autoActionCount = 0; autoActionCount < maxAutoActions; autoActionCount += 1) {
      const autoAction = this.getImmediateSitOutAutoAction(table, progressed.state);

      if (!autoAction) {
        await this.persistProgressedHandState(
          tx,
          table,
          hand,
          progressed,
          actedAt,
          timerResolution
        );

        return progressed;
      }

      await tx.virtualAction.create({
        data: {
          tableId: table.id,
          handId: hand.id,
          seatId: autoAction.action.seatId,
          actorType: PrismaActionActorType.SYSTEM,
          actionType: autoAction.actionType,
          metadataJson: autoAction.metadata,
          createdAt: actedAt
        }
      });

      progressed = this.progressHand(applyPlayerAction(progressed.state, autoAction.action));
    }

    throw new ApiError(
      VIRTUAL_ERROR_CODES.conflict,
      "Не удалось завершить автоматические действия для sit-out",
      HttpStatus.CONFLICT
    );
  }

  private createReminderNotificationJob(
    table: Pick<TableRecord, "id" | "title" | "seats"> | null,
    seatId: string
  ): NotificationJob | null {
    if (!table) {
      return null;
    }

    const seat = table.seats.find((candidate) => candidate.id === seatId);

    if (!seat) {
      return null;
    }

    return {
      type: "reminder",
      telegramId: seat.user.telegramId,
      tableId: table.id,
      tableTitle: table.title
    };
  }

  private createTimeoutNotificationJob(
    table: Pick<TableRecord, "id" | "title" | "seats">,
    seatId: string,
    actionType: TimeoutActionType
  ): NotificationJob | null {
    const seat = table.seats.find((candidate) => candidate.id === seatId);

    if (!seat) {
      return null;
    }

    return {
      type: "timeout",
      telegramId: seat.user.telegramId,
      tableId: table.id,
      tableTitle: table.title,
      actionType
    };
  }

  private async dispatchNotificationJobs(
    jobs: Array<NotificationJob | null>
  ): Promise<void> {
    if (!this.virtualNotificationsService) {
      return;
    }

    for (const job of jobs) {
      if (!job) {
        continue;
      }

      try {
        switch (job.type) {
          case "reminder":
            await this.virtualNotificationsService.sendReminderNotification(job);
            break;
          case "timeout":
            await this.virtualNotificationsService.sendTimeoutNotification(job);
            break;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);

        process.stderr.write(
          `[VirtualService] Failed to send ${job.type} notification for table ${job.tableId}: ${message}\n`
        );
      }
    }
  }

  private async createTurnTimer(
    tx: Prisma.TransactionClient,
    table: Pick<VirtualTable, "id" | "reminderDelaySeconds" | "turnDurationSeconds">,
    handId: string,
    seatId: string,
    startedAt: Date
  ): Promise<void> {
    await tx.turnTimer.create({
      data: {
        tableId: table.id,
        handId,
        seatId,
        status: PrismaTurnTimerStatus.ACTIVE,
        startedAt,
        reminderDueAt: addSeconds(startedAt, table.reminderDelaySeconds),
        expiresAt: addSeconds(startedAt, table.turnDurationSeconds)
      }
    });
  }

  private async resolveOutstandingTurnTimers(
    tx: Prisma.TransactionClient,
    handId: string,
    resolvedAt: Date,
    resolutionType: PrismaTurnTimerResolution
  ): Promise<void> {
    await tx.turnTimer.updateMany({
      where: {
        handId,
        status: {
          in: [PrismaTurnTimerStatus.ACTIVE, PrismaTurnTimerStatus.REMINDED]
        }
      },
      data: {
        status: PrismaTurnTimerStatus.RESOLVED,
        resolvedAt,
        resolutionType
      }
    });
  }

  private async cancelTurnTimer(
    tx: Prisma.TransactionClient,
    timerId: string,
    resolvedAt: Date
  ): Promise<void> {
    await tx.turnTimer.update({
      where: {
        id: timerId
      },
      data: {
        status: PrismaTurnTimerStatus.CANCELLED,
        resolvedAt
      }
    });
  }

  private getTimeoutPlayerAction(
    seatId: string,
    legalActions: LegalAction[]
  ): {
    action: PlayerAction;
    actionType: TimeoutActionType;
    resolutionType: TimeoutResolutionType;
  } {
    const canCheck = legalActions.some((action) => action.type === "CHECK");

    if (canCheck) {
      return {
        action: {
          seatId,
          type: "CHECK"
        },
        actionType: PrismaActionType.AUTO_CHECK,
        resolutionType: PrismaTurnTimerResolution.AUTO_CHECK
      };
    }

    return {
      action: {
        seatId,
        type: "FOLD"
      },
      actionType: PrismaActionType.AUTO_FOLD,
      resolutionType: PrismaTurnTimerResolution.AUTO_FOLD
    };
  }

  private getImmediateSitOutAutoAction(
    table: Pick<TableRecord, "seats">,
    state: HandState
  ): ImmediateSitOutAutoAction | null {
    const actorSeatId = state.currentActorSeatId;

    if (!actorSeatId) {
      return null;
    }

    const tableSeat = table.seats.find((seat) => seat.id === actorSeatId);

    if (!tableSeat || tableSeat.status !== PrismaVirtualSeatStatus.SIT_OUT_REQUESTED) {
      return null;
    }

    const handSeat = state.seats.find((seat) => seat.seatId === actorSeatId);

    if (!handSeat) {
      return null;
    }

    const callAmount = Math.max(0, state.currentBet - handSeat.streetCommitment);
    const legalActions = getLegalActions(state, actorSeatId);

    if (
      callAmount === 0 &&
      tableSeat.sitOutAutoCheckEnabled &&
      legalActions.some((action) => action.type === "CHECK")
    ) {
      return {
        action: {
          seatId: actorSeatId,
          type: "CHECK"
        },
        actionType: PrismaActionType.AUTO_CHECK,
        metadata: {
          reason: "SIT_OUT",
          autoCheck: tableSeat.sitOutAutoCheckEnabled,
          autoFold: tableSeat.sitOutAutoFoldEnabled,
          street: state.street
        }
      };
    }

    if (
      callAmount > 0 &&
      tableSeat.sitOutAutoFoldEnabled &&
      legalActions.some((action) => action.type === "FOLD")
    ) {
      return {
        action: {
          seatId: actorSeatId,
          type: "FOLD"
        },
        actionType: PrismaActionType.AUTO_FOLD,
        metadata: {
          reason: "SIT_OUT",
          autoCheck: tableSeat.sitOutAutoCheckEnabled,
          autoFold: tableSeat.sitOutAutoFoldEnabled,
          street: state.street
        }
      };
    }

    return null;
  }

  private async persistSeatState(
    tx: Prisma.TransactionClient,
    tableSeats: TableRecord["seats"],
    state: HandState,
    isHandCompleted: boolean
  ): Promise<PersistSeatStateResult> {
    const seatStateById = new Map<string, HandState["seats"][number]>(
      state.seats.map((seat: HandState["seats"][number]) => [seat.seatId, seat])
    );
    const sittingOutSeatIds: string[] = [];

    await Promise.all(
      tableSeats.map((tableSeat) => {
        const handSeat = seatStateById.get(tableSeat.id);
        const stackChips = handSeat ? BigInt(handSeat.stack) : tableSeat.stackChips;
        const hasPassedSmallBlindSinceSitOutRequest =
          tableSeat.hasPassedSmallBlindSinceSitOutRequest ||
          (tableSeat.status === PrismaVirtualSeatStatus.SIT_OUT_REQUESTED &&
            handSeat !== undefined &&
            state.smallBlindSeatId === tableSeat.id);
        const hasPassedBigBlindSinceSitOutRequest =
          tableSeat.hasPassedBigBlindSinceSitOutRequest ||
          (tableSeat.status === PrismaVirtualSeatStatus.SIT_OUT_REQUESTED &&
            handSeat !== undefined &&
            state.bigBlindSeatId === tableSeat.id);
        const status = this.getSeatStatus(
          tableSeat,
          handSeat,
          state.currentActorSeatId,
          isHandCompleted,
          hasPassedSmallBlindSinceSitOutRequest,
          hasPassedBigBlindSinceSitOutRequest
        );

        if (
          status === PrismaVirtualSeatStatus.SITTING_OUT &&
          tableSeat.status !== PrismaVirtualSeatStatus.SITTING_OUT
        ) {
          sittingOutSeatIds.push(tableSeat.id);
        }

        return tx.virtualSeat.update({
          where: {
            id: tableSeat.id
          },
          data: {
            stackChips,
            status,
            hasPassedSmallBlindSinceSitOutRequest,
            hasPassedBigBlindSinceSitOutRequest,
            returnRequestedAt:
              tableSeat.status === PrismaVirtualSeatStatus.RETURN_REQUESTED && handSeat
                ? null
                : tableSeat.returnRequestedAt,
            sitOutRequestedAt:
              status === PrismaVirtualSeatStatus.SITTING_OUT
                ? null
                : tableSeat.sitOutRequestedAt,
            sitOutAutoCheckEnabled:
              status === PrismaVirtualSeatStatus.SITTING_OUT
                ? false
                : tableSeat.sitOutAutoCheckEnabled,
            sitOutAutoFoldEnabled:
              status === PrismaVirtualSeatStatus.SITTING_OUT
                ? false
                : tableSeat.sitOutAutoFoldEnabled
          }
        });
      })
    );

    return {
      sittingOutSeatIds
    };
  }

  private async persistCompletedHandOnlinePlayerStats(
    tx: Prisma.TransactionClient,
    table: Pick<TableRecord, "bigBlindChips" | "chipValueMinor" | "seats">,
    state: HandState
  ): Promise<void> {
    const players = state.seats
      .map((seat) => {
        const tableSeat = table.seats.find((candidate) => candidate.id === seat.seatId);

        if (!tableSeat) {
          return null;
        }

        return {
          userId: tableSeat.userId,
          startingStackChips: BigInt(seat.stackAtHandStart),
          finalStackChips: BigInt(seat.stack)
        };
      })
      .filter((player): player is NonNullable<typeof player> => player !== null);

    if (players.length === 0) {
      return;
    }

    const existingStats =
      (await tx.onlinePlayerStats.findMany({
        where: {
          userId: {
            in: [...new Set(players.map((player) => player.userId))]
          }
        }
      })) ?? [];
    const existingByUserId = new Map(existingStats.map((stats) => [stats.userId, stats]));
    const nextStats = calculateCompletedVirtualHandStats({
      players,
      bigBlindChips: table.bigBlindChips,
      chipValueMinor: table.chipValueMinor,
      existingByUserId
    });

    await Promise.all(
      nextStats.map((stats) =>
        tx.onlinePlayerStats.upsert({
          where: {
            userId: stats.userId
          },
          create: stats,
          update: toOnlinePlayerStatsUpsertData(stats)
        })
      )
    );
  }

  private getSeatStatus(
    tableSeat: TableRecord["seats"][number],
    handSeat: HandState["seats"][number] | undefined,
    currentActorSeatId: string | null,
    isHandCompleted: boolean,
    hasPassedSmallBlindSinceSitOutRequest: boolean,
    hasPassedBigBlindSinceSitOutRequest: boolean
  ): PrismaVirtualSeatStatus {
    if (!handSeat) {
      if (tableSeat.status === PrismaVirtualSeatStatus.LEFT) {
        return PrismaVirtualSeatStatus.LEFT;
      }

      if (tableSeat.status === PrismaVirtualSeatStatus.SITTING_OUT) {
        return PrismaVirtualSeatStatus.SITTING_OUT;
      }

      if (tableSeat.status === PrismaVirtualSeatStatus.RETURN_REQUESTED) {
        return tableSeat.stackChips > 0n
          ? PrismaVirtualSeatStatus.RETURN_REQUESTED
          : PrismaVirtualSeatStatus.NO_CHIPS;
      }

      if (tableSeat.status === PrismaVirtualSeatStatus.SIT_OUT_REQUESTED) {
        return tableSeat.stackChips > 0n
          ? PrismaVirtualSeatStatus.SIT_OUT_REQUESTED
          : PrismaVirtualSeatStatus.NO_CHIPS;
      }

      return tableSeat.stackChips > 0n
        ? PrismaVirtualSeatStatus.ACTIVE
        : PrismaVirtualSeatStatus.NO_CHIPS;
    }

    if (isHandCompleted) {
      if (handSeat.stack <= 0) {
        return PrismaVirtualSeatStatus.NO_CHIPS;
      }

      if (tableSeat.status === PrismaVirtualSeatStatus.SIT_OUT_REQUESTED) {
        return hasPassedSmallBlindSinceSitOutRequest && hasPassedBigBlindSinceSitOutRequest
          ? PrismaVirtualSeatStatus.SITTING_OUT
          : PrismaVirtualSeatStatus.SIT_OUT_REQUESTED;
      }

      if (tableSeat.status === PrismaVirtualSeatStatus.RETURN_REQUESTED) {
        return PrismaVirtualSeatStatus.ACTIVE;
      }

      return handSeat.stack > 0
        ? PrismaVirtualSeatStatus.ACTIVE
        : PrismaVirtualSeatStatus.NO_CHIPS;
    }

    if (tableSeat.status === PrismaVirtualSeatStatus.SIT_OUT_REQUESTED) {
      return PrismaVirtualSeatStatus.SIT_OUT_REQUESTED;
    }

    if (handSeat.hasFolded) {
      return PrismaVirtualSeatStatus.FOLDED;
    }

    if (handSeat.isAllIn) {
      return PrismaVirtualSeatStatus.ALL_IN;
    }

    if (handSeat.seatId === currentActorSeatId) {
      return PrismaVirtualSeatStatus.ACTING;
    }

    return PrismaVirtualSeatStatus.WAITING_FOR_TURN;
  }

  private toHandPlayerStatus(handSeat: HandState["seats"][number]): PrismaHandPlayerStatus {
    if (handSeat.hasFolded) {
      return PrismaHandPlayerStatus.FOLDED;
    }

    if (handSeat.isAllIn) {
      return PrismaHandPlayerStatus.ALL_IN;
    }

    return PrismaHandPlayerStatus.ACTIVE;
  }

  private toPrismaStreet(street: HandState["street"]): PrismaStreet {
    return street;
  }

  private createInviteCode(): string {
    const random = randomBytes(VIRTUAL_INVITE_CODE_LENGTH);

    return Array.from(
      random,
      (byte) => VIRTUAL_INVITE_CODE_ALPHABET[byte % VIRTUAL_INVITE_CODE_ALPHABET.length]
    )
      .join("")
      .slice(0, VIRTUAL_INVITE_CODE_LENGTH);
  }

  private findLowestFreeSeatNumber(
    occupiedSeatNumbers: number[],
    maxSeats: number
  ): number | null {
    const occupiedSet = new Set(occupiedSeatNumbers);

    for (let seatNumber = 1; seatNumber <= maxSeats; seatNumber += 1) {
      if (!occupiedSet.has(seatNumber)) {
        return seatNumber;
      }
    }

    return null;
  }

  private invalidInput(message: string): ApiError {
    return new ApiError(VIRTUAL_ERROR_CODES.invalidInput, message, HttpStatus.BAD_REQUEST);
  }

  private buildSubmitActionResponse(
    action: Pick<
      PlayerVirtualActionRecord,
      "tableId" | "handId" | "actionType" | "amountChips" | "createdAt"
    >,
    hand: Pick<HandRecord, "status" | "currentActorSeatId">
  ): SubmitVirtualActionResponseDto {
    return {
      tableId: action.tableId,
      handId: action.handId,
      actionType: action.actionType as SubmitVirtualActionResponseDto["actionType"],
      amountChips: action.amountChips === null ? null : action.amountChips.toString(),
      handStatus: hand.status,
      actedAt: action.createdAt.toISOString(),
      nextActorSeatId: hand.currentActorSeatId
    };
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    );
  }

  private isVirtualActionIdempotencyConstraintError(error: unknown): boolean {
    if (!this.isUniqueConstraintError(error)) {
      return false;
    }

    if (
      typeof error !== "object" ||
      error === null ||
      !("meta" in error) ||
      typeof error.meta !== "object" ||
      error.meta === null ||
      !("target" in error.meta)
    ) {
      return true;
    }

    const { target } = error.meta as {
      target?: unknown;
    };

    if (Array.isArray(target)) {
      return ["tableId", "seatId", "idempotencyKey"].every((field) =>
        target.includes(field)
      );
    }

    return (
      typeof target === "string" &&
      target.includes("VirtualAction_tableId_seatId_idempotencyKey_key")
    );
  }
}

function parseScheduledStartAt(
  value: string | null | undefined,
  invalidInput: (message: string) => ApiError
): Date {
  if (!value) {
    throw invalidInput("Укажите дату и время старта");
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    throw invalidInput("Укажите дату и время старта");
  }

  return parsed;
}

function buildVirtualInviteUrl(inviteCode: string): string {
  const webAppUrl = process.env.WEB_APP_URL?.trim() ?? "http://localhost:5173";
  const normalizedWebAppUrl = webAppUrl.endsWith("/")
    ? webAppUrl.slice(0, -1)
    : webAppUrl;

  // Phase 5 keeps a dedicated virtual-poker join route to avoid clashing with classic rooms.
  return appendWebAppCacheBuster(`${normalizedWebAppUrl}${VIRTUAL_INVITE_PATH}/${inviteCode}`);
}

function parsePositiveBigInt(value: string | null | undefined, message: string): bigint {
  if (!value || !/^\d+$/.test(value.trim())) {
    throw new ApiError(VIRTUAL_ERROR_CODES.invalidInput, message, HttpStatus.BAD_REQUEST);
  }

  const parsed = BigInt(value);

  if (parsed <= 0n) {
    throw new ApiError(VIRTUAL_ERROR_CODES.invalidInput, message, HttpStatus.BAD_REQUEST);
  }

  return parsed;
}

function normalizeInviteCode(inviteCode: string): string {
  return inviteCode.trim().toUpperCase();
}

function getDisplayName(user: UserDto): string {
  return user.firstName ?? user.username ?? "Игрок";
}

function getUserDisplayName(user: User): string {
  return user.firstName ?? user.username ?? "Игрок";
}

function getUserFacingDisplayName(
  user: Pick<UserDto, "username" | "firstName"> | Pick<User, "username" | "firstName">
): string {
  return user.firstName ?? user.username ?? "Игрок";
}

function getSeatDisplayName(
  seat: Pick<VirtualSeat, "displayName"> & { user: Pick<User, "username" | "firstName"> }
): string {
  return seat.displayName ?? getUserDisplayName(seat.user as User);
}

function multiplyChipsByMinor(chips: bigint, chipValueMinor: bigint | null): string | null {
  if (chipValueMinor === null) {
    return null;
  }

  return (chips * chipValueMinor).toString();
}

function roundWinProbabilityPercent(value: number): number {
  return Math.round(value * 10) / 10;
}

function getHandHistoryShowdownCards(
  hand: Pick<HandHistoryRecord, "status" | "currentStreet" | "pots">,
  player: Pick<
    VirtualHandPlayer,
    "status" | "privateCard1" | "privateCard2" | "isEligibleForShowdown"
  >
): string[] {
  if (!didHandReachShowdown(hand)) {
    return [];
  }

  if (
    player.status === PrismaHandPlayerStatus.FOLDED ||
    !player.isEligibleForShowdown ||
    !player.privateCard1 ||
    !player.privateCard2
  ) {
    return [];
  }

  return [player.privateCard1, player.privateCard2];
}

function didHandReachShowdown(
  hand: Pick<HandHistoryRecord, "status" | "currentStreet" | "pots">
): boolean {
  if (
    hand.status !== PrismaVirtualHandStatus.COMPLETED ||
    hand.currentStreet !== PrismaStreet.SHOWDOWN
  ) {
    return false;
  }

  return hand.pots.some((pot) => pot.awards.some((award) => award.handRankJson !== null));
}

function getHandHistoryListWinners(
  hand: Pick<HandRecord, "players" | "pots">
): Array<{
  seatId: string;
  displayName: string;
  amountChips: string;
  handRankLabel: string | null;
  bestFiveCards: string[];
}> {
  const winnersBySeatId = new Map<
    string,
    {
      seatId: string;
      displayName: string;
      amountChips: bigint;
      handRankLabel: string | null;
      bestFiveCards: string[];
      seatNumber: number;
    }
  >();

  for (const pot of hand.pots) {
    for (const award of pot.awards) {
      const player = hand.players.find((candidate) => candidate.seatId === award.winnerSeatId);
      const displayName = player ? getSeatDisplayName(player.seat) : "Игрок";
      const seatNumber = player?.seat.seatNumber ?? Number.MAX_SAFE_INTEGER;
      const evaluatedHand = parseEvaluatedHand(award.handRankJson);
      const existingWinner = winnersBySeatId.get(award.winnerSeatId);

      if (existingWinner) {
        existingWinner.amountChips += award.amountChips;
        continue;
      }

      winnersBySeatId.set(award.winnerSeatId, {
        seatId: award.winnerSeatId,
        displayName,
        amountChips: award.amountChips,
        handRankLabel: evaluatedHand ? getHandRankLabelRu(evaluatedHand.rank) : null,
        bestFiveCards: evaluatedHand?.bestFiveCards ?? [],
        seatNumber
      });
    }
  }

  return [...winnersBySeatId.values()]
    .sort((left, right) => left.seatNumber - right.seatNumber)
    .map((winner) => ({
      seatId: winner.seatId,
      displayName: winner.displayName,
      amountChips: winner.amountChips.toString(),
      handRankLabel: winner.handRankLabel,
      bestFiveCards: winner.bestFiveCards
    }));
}

function parseEvaluatedHand(value: Prisma.JsonValue | null): EvaluatedHand | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  const rank = "rank" in value ? value.rank : undefined;
  const bestFiveCards = "bestFiveCards" in value ? value.bestFiveCards : undefined;

  if (!isHandRank(rank) || !isCardArray(bestFiveCards, 5)) {
    return null;
  }

  return {
    rank,
    rankValue:
      "rankValue" in value && typeof value.rankValue === "number" ? value.rankValue : 0,
    bestFiveCards,
    tiebreaker:
      "tiebreaker" in value && Array.isArray(value.tiebreaker)
        ? value.tiebreaker.filter((entry): entry is number => typeof entry === "number")
        : []
  };
}

function isHandRank(value: unknown): value is HandRank {
  return (
    value === "HIGH_CARD" ||
    value === "PAIR" ||
    value === "TWO_PAIR" ||
    value === "THREE_OF_A_KIND" ||
    value === "STRAIGHT" ||
    value === "FLUSH" ||
    value === "FULL_HOUSE" ||
    value === "FOUR_OF_A_KIND" ||
    value === "STRAIGHT_FLUSH"
  );
}

function isCardArray(
  value: unknown,
  expectedLength?: number
): value is [Card, Card, Card, Card, Card] {
  return (
    Array.isArray(value) &&
    (expectedLength === undefined || value.length === expectedLength) &&
    value.every((entry) => typeof entry === "string")
  );
}

function getHandRankLabelRu(rank: HandRank): string {
  switch (rank) {
    case "HIGH_CARD":
      return "Старшая карта";
    case "PAIR":
      return "Пара";
    case "TWO_PAIR":
      return "Две пары";
    case "THREE_OF_A_KIND":
      return "Тройка";
    case "STRAIGHT":
      return "Стрит";
    case "FLUSH":
      return "Флеш";
    case "FULL_HOUSE":
      return "Фулл-хаус";
    case "FOUR_OF_A_KIND":
      return "Каре";
    case "STRAIGHT_FLUSH":
      return "Стрит-флеш";
  }
}

function mapHandPlayerStatusToSeatStatus(
  status: PrismaHandPlayerStatus
): PrismaVirtualSeatStatus {
  switch (status) {
    case PrismaHandPlayerStatus.FOLDED:
      return PrismaVirtualSeatStatus.FOLDED;
    case PrismaHandPlayerStatus.ALL_IN:
      return PrismaVirtualSeatStatus.ALL_IN;
    case PrismaHandPlayerStatus.SITTING_OUT:
      return PrismaVirtualSeatStatus.SITTING_OUT;
    default:
      return PrismaVirtualSeatStatus.ACTIVE;
  }
}

function getActionDisplayName(
  action: Pick<VirtualAction, "actorType"> & {
    seat: (Pick<VirtualSeat, "displayName"> & { user: Pick<User, "username" | "firstName"> }) | null;
  }
): string {
  if (action.seat) {
    return getSeatDisplayName(action.seat);
  }

  switch (action.actorType) {
    case PrismaActionActorType.ADMIN:
      return "Администратор";
    case PrismaActionActorType.SYSTEM:
      return "Система";
    default:
      return "Игрок";
  }
}

function inferActionStreet(
  action: Pick<VirtualAction, "metadataJson"> & { handId: string | null }
): PrismaStreet {
  if (
    action.metadataJson &&
    typeof action.metadataJson === "object" &&
    !Array.isArray(action.metadataJson) &&
    "street" in action.metadataJson
  ) {
    const street = action.metadataJson.street;

    if (street === "PRE_FLOP" || street === "FLOP" || street === "TURN" || street === "RIVER" || street === "SHOWDOWN") {
      return street;
    }
  }

  return PrismaStreet.PRE_FLOP;
}

function jsonToSeatIds(value: Prisma.JsonValue): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

function compareVirtualTablesForList(
  left: Pick<VirtualTable, "status" | "updatedAt">,
  right: Pick<VirtualTable, "status" | "updatedAt">
): number {
  const groupDelta = getVirtualTableListGroup(left.status) - getVirtualTableListGroup(right.status);

  if (groupDelta !== 0) {
    return groupDelta;
  }

  return right.updatedAt.getTime() - left.updatedAt.getTime();
}

function getVirtualTableListGroup(status: PrismaVirtualTableStatus): number {
  switch (status) {
    case PrismaVirtualTableStatus.ACTIVE:
    case PrismaVirtualTableStatus.PAUSED:
    case PrismaVirtualTableStatus.WAITING_FOR_PLAYERS:
      return 0;
    case PrismaVirtualTableStatus.FINISHED:
    case PrismaVirtualTableStatus.CANCELLED:
      return 1;
    default:
      return 2;
  }
}

function compareVirtualLeaderboardRows(
  left: Pick<
    LeaderboardStatsRecord | DynamicLeaderboardRow,
    "onlinePokerScore" | "handsPlayed" | "netChips" | "userId"
  >,
  right: Pick<
    LeaderboardStatsRecord | DynamicLeaderboardRow,
    "onlinePokerScore" | "handsPlayed" | "netChips" | "userId"
  >
): number {
  if (right.onlinePokerScore !== left.onlinePokerScore) {
    return right.onlinePokerScore - left.onlinePokerScore;
  }

  if (right.handsPlayed !== left.handsPlayed) {
    return right.handsPlayed - left.handsPlayed;
  }

  if (right.netChips !== left.netChips) {
    return right.netChips > left.netChips ? 1 : -1;
  }

  return left.userId.localeCompare(right.userId);
}

function findVirtualLeaderboardStartIndex(
  rows: Array<LeaderboardStatsRecord | DynamicLeaderboardRow>,
  cursor: VirtualLeaderboardCursor
): number {
  const index = rows.findIndex((row) => compareVirtualLeaderboardRows(row, cursor) > 0);

  return index === -1 ? rows.length : index;
}

function toVirtualLeaderboardCursor(
  row:
    | Pick<
        LeaderboardStatsRecord | DynamicLeaderboardRow,
        "onlinePokerScore" | "handsPlayed" | "netChips" | "userId"
      >
    | undefined
): VirtualLeaderboardCursor {
  if (!row) {
    throw new Error("Leaderboard cursor row is required");
  }

  return {
    onlinePokerScore: row.onlinePokerScore,
    handsPlayed: row.handsPlayed,
    netChips: row.netChips,
    userId: row.userId
  };
}

function isTableAdmin(role: PrismaVirtualSeatRole): boolean {
  return role === PrismaVirtualSeatRole.OWNER || role === PrismaVirtualSeatRole.ADMIN;
}

function buildOnlineStatsSnapshotFromHands(
  hands: AggregationHandRecord[],
  targetUserId?: string
): OnlinePlayerStatsSnapshot | null {
  const statsByUserId = new Map<string, OnlinePlayerStatsSnapshot>();

  for (const hand of hands) {
    const players = hand.players
      .map((player) => ({
        userId: player.seat.userId,
        startingStackChips: player.startingStackChips,
        finalStackChips: player.currentStackChips
      }))
      .filter((player) => targetUserId === undefined || player.userId === targetUserId);

    if (players.length === 0) {
      continue;
    }

    const existingByUserId = new Map<string, OnlinePlayerStatsSnapshot>();

    for (const player of players) {
      const existing = statsByUserId.get(player.userId);

      if (existing) {
        existingByUserId.set(player.userId, existing);
      }
    }

    const snapshots = calculateCompletedVirtualHandStats({
      players,
      bigBlindChips: hand.bigBlindChips,
      chipValueMinor: hand.table.chipValueMinor,
      existingByUserId
    });

    for (const snapshot of snapshots) {
      statsByUserId.set(snapshot.userId, snapshot);
    }
  }

  if (targetUserId) {
    return statsByUserId.get(targetUserId) ?? null;
  }

  return null;
}

function buildDynamicLeaderboardRows(
  hands: AggregationHandRecord[],
  options: {
    candidateUserIds?: string[];
    selectedTableIdsByUserId?: ReadonlyMap<string, ReadonlySet<string>> | null;
  } = {}
): DynamicLeaderboardRow[] {
  const statsByUserId = new Map<string, OnlinePlayerStatsSnapshot>();
  const userById = new Map<string, User>();

  for (const hand of hands) {
    const participants = hand.players.map((player) => ({
      userId: player.seat.userId,
      startingStackChips: player.startingStackChips,
      finalStackChips: player.currentStackChips,
      user: player.seat.user
    }));

    for (const participant of participants) {
      if (options.candidateUserIds && !options.candidateUserIds.includes(participant.userId)) {
        continue;
      }

      const selectedTableIds = options.selectedTableIdsByUserId?.get(participant.userId);

      if (selectedTableIds && !selectedTableIds.has(hand.tableId)) {
        continue;
      }

      userById.set(participant.userId, participant.user);
      const current = statsByUserId.get(participant.userId);
      const [nextStats] = calculateCompletedVirtualHandStats({
        players: [
          {
            userId: participant.userId,
            startingStackChips: participant.startingStackChips,
            finalStackChips: participant.finalStackChips
          }
        ],
        bigBlindChips: hand.bigBlindChips,
        chipValueMinor: hand.table.chipValueMinor,
        ...(current
          ? {
              existingByUserId: new Map([[participant.userId, current]])
            }
          : {})
      });

      if (nextStats) {
        statsByUserId.set(participant.userId, nextStats);
      }
    }
  }

  return [...statsByUserId.values()]
    .map((stats) => {
      const user = userById.get(stats.userId);

      if (!user) {
        return null;
      }

      return {
        ...stats,
        user
      };
    })
    .filter((row): row is DynamicLeaderboardRow => row !== null);
}

function collectDistinctUserIdsFromCompletedTables(
  tables: Array<{ seats: Array<Pick<VirtualSeat, "userId">> }>
): string[] {
  const userIds = new Set<string>();

  for (const table of tables) {
    for (const seat of table.seats) {
      if (seat.userId.length > 0) {
        userIds.add(seat.userId);
      }
    }
  }

  return [...userIds];
}

function buildLastTenTableIdsByUser(
  tables: Array<Pick<VirtualTable, "id" | "finishedAt"> & { seats: Array<Pick<VirtualSeat, "userId">> }>,
  candidateUserIds?: string[]
): ReadonlyMap<string, ReadonlySet<string>> {
  const candidateSet = candidateUserIds ? new Set(candidateUserIds) : null;
  const tableIdsByUserId = new Map<string, string[]>();

  for (const table of tables) {
    for (const seat of table.seats) {
      if (candidateSet && !candidateSet.has(seat.userId)) {
        continue;
      }

      const existing = tableIdsByUserId.get(seat.userId) ?? [];

      if (existing.length < 10) {
        existing.push(table.id);
        tableIdsByUserId.set(seat.userId, existing);
      }
    }
  }

  return new Map(
    [...tableIdsByUserId.entries()].map(([userId, tableIds]) => [userId, new Set(tableIds)])
  );
}

function selectCompletedTablesForPeriod(
  tables: CompletedProfileTableRecord[],
  period: LeaderboardPeriod
): CompletedProfileTableRecord[] {
  if (period === "all-time") {
    return tables;
  }

  if (period === "last-10") {
    return tables.slice(0, 10);
  }

  const monthRange = getCurrentMonthRange(new Date());

  return tables.filter(
    (table) =>
      table.finishedAt !== null &&
      table.finishedAt >= monthRange.start &&
      table.finishedAt < monthRange.endExclusive
  );
}

function getAggregationHandsForUser(
  tables: CompletedProfileTableRecord[],
  userId: string
): AggregationHandRecord[] {
  return tables.flatMap((table) =>
    table.hands.filter((hand) => hand.players.some((player) => player.seat.userId === userId))
  );
}

function toVirtualProfileTableResults(
  tables: CompletedProfileTableRecord[],
  userId: string
): VirtualProfileTableResult[] {
  return tables
    .flatMap((table) => {
      if (table.finishedAt === null) {
        return [];
      }

      let netChips = 0n;

      for (const hand of table.hands) {
        const player = hand.players.find((candidate) => candidate.seat.userId === userId);

        if (!player) {
          continue;
        }

        netChips += player.currentStackChips - player.startingStackChips;
      }

      return [{
        tableId: table.id,
        title: table.title,
        finishedAt: table.finishedAt,
        playersCount: table.seats.length,
        smallBlindChips: table.smallBlindChips,
        bigBlindChips: table.bigBlindChips,
        netChips,
        netEstimatedMinor:
          table.chipValueMinor === null ? 0n : netChips * table.chipValueMinor,
        buyInEstimatedMinor:
          table.chipValueMinor === null ? 0n : table.startingStackChips * table.chipValueMinor
      }];
    });
}

function toVirtualRecentProfileTables(
  tables: VirtualProfileTableResult[]
): VirtualRecentProfileTableDto[] {
  return tables.slice(0, 10).map((table) => ({
    tableId: table.tableId,
    title: table.title,
    finishedAt: table.finishedAt.toISOString(),
    playersCount: table.playersCount,
    smallBlindChips: table.smallBlindChips.toString(),
    bigBlindChips: table.bigBlindChips.toString()
  }));
}

function toVirtualRecentProfileResults(
  tables: VirtualProfileTableResult[]
): VirtualRecentProfileResultDto[] {
  let cumulativeNetChips = 0n;
  let cumulativeNetEstimatedMinor = 0n;
  const cumulativeByTableId = new Map<string, bigint>();
  const cumulativeEstimatedByTableId = new Map<string, bigint>();

  for (const table of [...tables].reverse()) {
    cumulativeNetChips += table.netChips;
    cumulativeNetEstimatedMinor += table.netEstimatedMinor;
    cumulativeByTableId.set(table.tableId, cumulativeNetChips);
    cumulativeEstimatedByTableId.set(table.tableId, cumulativeNetEstimatedMinor);
  }

  return tables.slice(0, 10).map((table) => ({
    tableId: table.tableId,
    title: table.title,
    finishedAt: table.finishedAt.toISOString(),
    playersCount: table.playersCount,
    netChips: table.netChips.toString(),
    netEstimatedMinor: table.netEstimatedMinor.toString(),
    cumulativeNetChips: (cumulativeByTableId.get(table.tableId) ?? table.netChips).toString(),
    cumulativeNetEstimatedMinor: (
      cumulativeEstimatedByTableId.get(table.tableId) ?? table.netEstimatedMinor
    ).toString()
  }));
}

function toVirtualProfileTableStats(
  tables: VirtualProfileTableResult[]
): GetVirtualPlayerProfileResponseDto["tableStats"] {
  const tablesPlayed = tables.length;
  const tablesWon = tables.filter((table) => table.netChips > 0n).length;
  const totalNetEstimatedMinor = tables.reduce(
    (sum, table) => sum + table.netEstimatedMinor,
    0n
  );
  const totalBuyInEstimatedMinor = tables.reduce(
    (sum, table) => sum + table.buyInEstimatedMinor,
    0n
  );

  return {
    tablesPlayed,
    tablesWon,
    tableWinRateBps: tablesPlayed === 0 ? 0 : Math.round((tablesWon / tablesPlayed) * 10_000),
    totalBuyInEstimatedMinor: totalBuyInEstimatedMinor.toString(),
    roiBps:
      totalBuyInEstimatedMinor === 0n
        ? 0
        : Number((totalNetEstimatedMinor * 10_000n) / totalBuyInEstimatedMinor)
  };
}

function toVirtualProfileTrend(
  results: VirtualRecentProfileResultDto[]
): VirtualProfileTrendPointDto[] {
  return results.map((result) => ({
    tableId: result.tableId,
    finishedAt: result.finishedAt,
    netChips: result.netChips,
    cumulativeNetChips: result.cumulativeNetChips,
    netEstimatedMinor: result.netEstimatedMinor,
    cumulativeNetEstimatedMinor: result.cumulativeNetEstimatedMinor
  }));
}

function getCurrentMonthRange(now: Date): { start: Date; endExclusive: Date } {
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const endExclusive = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  return {
    start,
    endExclusive
  };
}

function bigintToNumber(value: bigint, label: string): number {
  const parsed = Number(value);

  if (!Number.isSafeInteger(parsed)) {
    throw new Error(`Unsafe integer for ${label}`);
  }

  return parsed;
}

function toVirtualLegalActionDto(action: LegalAction): VirtualLegalActionDto {
  switch (action.type) {
    case "FOLD":
      return {
        type: "FOLD"
      };
    case "CHECK":
      return {
        type: "CHECK"
      };
    case "CALL":
      return {
        type: "CALL",
        amountChips: String(action.amount)
      };
    case "BET":
      return {
        type: "BET",
        minAmountChips: String(action.min),
        maxAmountChips: String(action.max)
      };
    case "RAISE":
      return {
        type: "RAISE",
        minAmountChips: String(action.min),
        maxAmountChips: String(action.max)
      };
    case "ALL_IN":
      return {
        type: "ALL_IN",
        amountChips: String(action.amount)
      };
    default: {
      const exhaustiveCheck: never = action;
      throw new Error(`Unsupported legal action: ${String(exhaustiveCheck)}`);
    }
  }
}

function getStreetForBoardPosition(position: number): PrismaStreet {
  if (position <= 2) {
    return PrismaStreet.FLOP;
  }

  if (position === 3) {
    return PrismaStreet.TURN;
  }

  return PrismaStreet.RIVER;
}

function maxBigInt(left: bigint, right: bigint): bigint {
  return left > right ? left : right;
}

function addSeconds(date: Date, seconds: number): Date {
  return new Date(date.getTime() + seconds * 1000);
}

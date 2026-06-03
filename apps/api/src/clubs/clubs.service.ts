import { HttpStatus, Injectable, Optional } from "@nestjs/common";
import {
  ClubEventRsvpStatus as PrismaClubEventRsvpStatus,
  ClubEventStatus as PrismaClubEventStatus,
  ClubEventType as PrismaClubEventType,
  ClubMemberRole as PrismaClubMemberRole,
  ClubMemberStatus as PrismaClubMemberStatus,
  ClubPrivacy as PrismaClubPrivacy,
  Prisma,
  type Club,
  type ClubEvent,
  type ClubEventRsvp,
  type ClubMember,
  type Room,
  type User,
  type VirtualTable
} from "@prisma/client";
import type {
  CancelClubEventResponseDto,
  ClubDashboardDto,
  ClubEventDetailsDto,
  ClubEventListItemDto,
  ClubEventRsvpCountsDto,
  ClubEventRsvpDto,
  ClubEventRsvpGroupsDto,
  ClubEventRsvpMemberDto,
  ClubListItemDto,
  ClubMemberDto,
  CreateClubInviteLinkResponseDto,
  CreateClubRequestDto,
  CreateClubResponseDto,
  GetClubEventResponseDto,
  GetClubEventsQueryDto,
  GetClubEventsResponseDto,
  GetClubJoinPreviewResponseDto,
  GetClubMembersResponseDto,
  GetClubResponseDto,
  GetClubsResponseDto,
  JoinClubRequestDto,
  JoinClubResponseDto,
  SendClubEventReminderResponseDto,
  TelegramClubEventRsvpRequestDto,
  TelegramClubEventRsvpResponseDto,
  UpdateClubEventRsvpRequestDto,
  UpdateClubEventRsvpResponseDto,
  UpdateClubMemberRequestDto,
  UpdateClubMemberResponseDto,
  UpdateClubRequestDto,
  UserDto
} from "@pokertable/shared";
import { buildClubStartParam } from "@pokertable/shared";
import { randomBytes } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import { ApiError } from "../shared/api-error";
import { appendWebAppCacheBuster } from "../shared/web-app-url";
import {
  CLUB_DESCRIPTION_MAX_LENGTH,
  CLUB_ERROR_CODES,
  CLUB_INVITE_CODE_ALPHABET,
  CLUB_INVITE_CODE_LENGTH,
  CLUB_SUPPORTED_CURRENCIES,
  CLUB_TITLE_MAX_LENGTH
} from "./clubs.constants";
import { ClubsNotificationsService } from "./clubs.notifications.service";

type ClubPrismaClient = Prisma.TransactionClient | PrismaService;

type ClubMembershipRecord = ClubMember & {
  user: User;
};

type ClubRecord = Club & {
  members: ClubMembershipRecord[];
  events: Array<
    ClubEvent & {
      rsvps: ClubEventRsvp[];
    }
  >;
};

type ClubEventRecord = ClubEvent & {
  club: Club & {
    members: ClubMembershipRecord[];
  };
  rsvps: Array<
    ClubEventRsvp & {
      user: User;
    }
  >;
  offlineRoom: Pick<Room, "id"> | null;
  virtualTable: Pick<
    VirtualTable,
    "id" | "startingStackChips" | "smallBlindChips" | "bigBlindChips"
  > | null;
};

type ClubAdminMembership = ClubMember & {
  club: Club;
};

type ClubEventCreationInput = {
  clubId: string;
  createdByUserId: string;
  type: PrismaClubEventType;
  title: string;
  scheduledStartAt: Date;
  maxPlayers: number | null;
  location: string | null;
  offlineRoomId?: string;
  virtualTableId?: string;
};

type RsvpUpdateResult = {
  status: PrismaClubEventRsvpStatus;
  respondedAt: Date | null;
};

@Injectable()
export class ClubsService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional()
    private readonly clubsNotificationsService?: ClubsNotificationsService
  ) {}

  async createClub(
    user: UserDto,
    input: CreateClubRequestDto
  ): Promise<CreateClubResponseDto> {
    this.validateClubInput(input);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const inviteCode = this.createInviteCode();

      try {
        const club = await this.prisma.$transaction(async (tx) => {
          const createdClub = await tx.club.create({
            data: {
              ownerUserId: user.id,
              name: input.name.trim(),
              description: normalizeOptionalText(input.description),
              defaultCurrency: normalizeOptionalCurrency(input.defaultCurrency),
              privacy: PrismaClubPrivacy.PRIVATE_INVITE_ONLY,
              inviteCode
            }
          });

          await tx.clubMember.create({
            data: {
              clubId: createdClub.id,
              userId: user.id,
              role: PrismaClubMemberRole.OWNER,
              status: PrismaClubMemberStatus.ACTIVE,
              displayName: getDisplayName(user)
            }
          });

          return createdClub;
        });

        return this.getClub(user, club.id);
      } catch (error) {
        if (this.isUniqueConstraintError(error)) {
          continue;
        }

        throw error;
      }
    }

    throw new ApiError(
      CLUB_ERROR_CODES.conflict,
      "Не удалось создать ссылку приглашения для клуба",
      HttpStatus.INTERNAL_SERVER_ERROR
    );
  }

  async listClubs(user: UserDto): Promise<GetClubsResponseDto> {
    const now = new Date();
    const clubs = await this.prisma.club.findMany({
      where: {
        members: {
          some: {
            userId: user.id,
            status: PrismaClubMemberStatus.ACTIVE
          }
        }
      },
      include: {
        members: {
          where: {
            status: PrismaClubMemberStatus.ACTIVE
          },
          include: {
            user: true
          }
        },
        events: {
          where: {
            status: {
              not: PrismaClubEventStatus.CANCELLED
            },
            scheduledStartAt: {
              gte: now
            }
          },
          include: {
            rsvps: true
          },
          orderBy: {
            scheduledStartAt: "asc"
          },
          take: 1
        }
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    return {
      clubs: clubs.map((club) => this.toClubListItem(club, user.id))
    };
  }

  async getClub(user: UserDto, clubId: string): Promise<GetClubResponseDto> {
    const club = await this.getClubRecordForUser(user.id, clubId);

    return {
      club: this.toClubDashboard(club, user.id)
    };
  }

  async getJoinPreview(
    user: UserDto,
    inviteCode: string
  ): Promise<GetClubJoinPreviewResponseDto> {
    const normalizedInviteCode = normalizeInviteCode(inviteCode);

    const club = await this.prisma.club.findUnique({
      where: {
        inviteCode: normalizedInviteCode
      },
      include: {
        members: {
          where: {
            status: PrismaClubMemberStatus.ACTIVE
          },
          include: {
            user: true
          }
        },
        events: {
          where: {
            status: {
              in: [
                PrismaClubEventStatus.SCHEDULED,
                PrismaClubEventStatus.RSVP_OPEN,
                PrismaClubEventStatus.IN_PROGRESS
              ]
            },
            scheduledStartAt: {
              gte: new Date()
            }
          },
          include: {
            rsvps: true
          },
          orderBy: {
            scheduledStartAt: "asc"
          },
          take: 1
        }
      }
    });

    if (!club) {
      throw new ApiError(CLUB_ERROR_CODES.notFound, "Клуб не найден", HttpStatus.NOT_FOUND);
    }

    const membership = club.members.find((member) => member.userId === user.id);

    return {
      club: this.toClubListItemForPreview(club, membership ?? null),
      alreadyMember: Boolean(membership)
    };
  }

  async updateClub(
    user: UserDto,
    clubId: string,
    input: UpdateClubRequestDto
  ): Promise<GetClubResponseDto> {
    this.validateClubUpdate(input);
    await this.ensureOwnerMembership(user.id, clubId);

    await this.prisma.club.update({
      where: {
        id: clubId
      },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.description !== undefined
          ? { description: normalizeOptionalText(input.description) }
          : {}),
        ...(input.defaultCurrency !== undefined
          ? { defaultCurrency: normalizeOptionalCurrency(input.defaultCurrency) }
          : {})
      }
    });

    return this.getClub(user, clubId);
  }

  async deleteClub(user: UserDto, clubId: string): Promise<void> {
    await this.ensureOwnerMembership(user.id, clubId);

    await this.prisma.$transaction(async (tx) => {
      await tx.room.updateMany({
        where: {
          clubId
        },
        data: {
          clubId: null,
          clubEventId: null,
          scheduledStartAt: null
        }
      });
      await tx.virtualTable.updateMany({
        where: {
          clubId
        },
        data: {
          clubId: null,
          clubEventId: null,
          scheduledStartAt: null
        }
      });
      await tx.clubEventRsvp.deleteMany({
        where: {
          clubId
        }
      });
      await tx.clubEvent.deleteMany({
        where: {
          clubId
        }
      });
      await tx.clubMember.deleteMany({
        where: {
          clubId
        }
      });
      await tx.club.delete({
        where: {
          id: clubId
        }
      });
    });
  }

  async joinClub(
    user: UserDto,
    clubId: string,
    input: JoinClubRequestDto
  ): Promise<JoinClubResponseDto> {
    const club = await this.prisma.club.findUnique({
      where: {
        id: clubId
      }
    });

    if (!club) {
      throw new ApiError(CLUB_ERROR_CODES.notFound, "Клуб не найден", HttpStatus.NOT_FOUND);
    }

    if (input.inviteCode && normalizeInviteCode(input.inviteCode) !== club.inviteCode) {
      throw new ApiError(
        CLUB_ERROR_CODES.forbidden,
        "Ссылка приглашения больше не действует",
        HttpStatus.FORBIDDEN
      );
    }

    const member = await this.prisma.$transaction(async (tx) => {
      const existingMembership = await tx.clubMember.findUnique({
        where: {
          clubId_userId: {
            clubId,
            userId: user.id
          }
        }
      });

      let membership: ClubMember;

      if (existingMembership) {
        membership = await tx.clubMember.update({
          where: {
            id: existingMembership.id
          },
          data: {
            status: PrismaClubMemberStatus.ACTIVE,
            displayName: getDisplayName(user),
            removedAt: null
          }
        });
      } else {
        membership = await tx.clubMember.create({
          data: {
            clubId,
            userId: user.id,
            role: PrismaClubMemberRole.MEMBER,
            status: PrismaClubMemberStatus.ACTIVE,
            displayName: getDisplayName(user)
          }
        });
      }

      const activeEvents = await tx.clubEvent.findMany({
        where: {
          clubId,
          status: {
            in: [
              PrismaClubEventStatus.SCHEDULED,
              PrismaClubEventStatus.RSVP_OPEN,
              PrismaClubEventStatus.IN_PROGRESS
            ]
          }
        },
        select: {
          id: true
        }
      });

      if (activeEvents.length > 0) {
        await tx.clubEventRsvp.createMany({
          data: activeEvents.map((event) => ({
            clubEventId: event.id,
            clubId,
            userId: user.id,
            status: PrismaClubEventRsvpStatus.NO_RESPONSE
          })),
          skipDuplicates: true
        });
      }

      return membership;
    });

    const dashboard = await this.getClub(user, clubId);

    return {
      club: dashboard.club,
      member: this.toClubMemberDto(
        member,
        {
          ...user,
          telegramId: user.telegramId
        } as User
      )
    };
  }

  async listMembers(user: UserDto, clubId: string): Promise<GetClubMembersResponseDto> {
    await this.ensureActiveMembership(user.id, clubId);

    const members = await this.prisma.clubMember.findMany({
      where: {
        clubId
      },
      include: {
        user: true
      },
      orderBy: [{ role: "asc" }, { joinedAt: "asc" }]
    });

    return {
      clubId,
      members: members.map((member) => this.toClubMemberDto(member, member.user))
    };
  }

  async getInviteLink(
    user: UserDto,
    clubId: string
  ): Promise<CreateClubInviteLinkResponseDto> {
    const membership = await this.ensureAdminMembership(user.id, clubId);

    return {
      clubId: membership.clubId,
      inviteCode: membership.club.inviteCode,
      inviteLink: buildClubInviteLink(membership.club.inviteCode)
    };
  }

  async updateMember(
    user: UserDto,
    clubId: string,
    memberId: string,
    input: UpdateClubMemberRequestDto
  ): Promise<UpdateClubMemberResponseDto> {
    const actor = await this.ensureActiveMembership(user.id, clubId);
    const target = await this.prisma.clubMember.findFirst({
      where: {
        id: memberId,
        clubId
      },
      include: {
        user: true
      }
    });

    if (!target) {
      throw new ApiError(
        CLUB_ERROR_CODES.notFound,
        "Участник клуба не найден",
        HttpStatus.NOT_FOUND
      );
    }

    const isSelfLeave =
      target.userId === user.id &&
      input.status === PrismaClubMemberStatus.LEFT &&
      input.role === undefined;

    if (!isSelfLeave && !isAdminRole(actor.role)) {
      throw new ApiError(
        CLUB_ERROR_CODES.forbidden,
        "Вы не можете управлять участниками клуба",
        HttpStatus.FORBIDDEN
      );
    }

    if (target.role === PrismaClubMemberRole.OWNER) {
      throw new ApiError(
        CLUB_ERROR_CODES.conflict,
        "Владельца клуба нельзя понизить или удалить",
        HttpStatus.CONFLICT
      );
    }

    if (isSelfLeave && actor.role === PrismaClubMemberRole.OWNER) {
      throw new ApiError(
        CLUB_ERROR_CODES.conflict,
        "Владелец не может выйти из клуба",
        HttpStatus.CONFLICT
      );
    }

    if (actor.role === PrismaClubMemberRole.ADMIN && input.role === PrismaClubMemberRole.OWNER) {
      throw new ApiError(
        CLUB_ERROR_CODES.forbidden,
        "Только владелец может назначить нового владельца",
        HttpStatus.FORBIDDEN
      );
    }

    const updatedMember = await this.prisma.clubMember.update({
      where: {
        id: target.id
      },
      data: {
        ...(input.role ? { role: input.role } : {}),
        ...(input.status
          ? {
              status: input.status,
              removedAt:
                input.status === PrismaClubMemberStatus.REMOVED ||
                input.status === PrismaClubMemberStatus.LEFT
                  ? new Date()
                  : null
            }
          : {})
      },
      include: {
        user: true
      }
    });

    return {
      member: this.toClubMemberDto(updatedMember, updatedMember.user)
    };
  }

  async listEvents(
    user: UserDto,
    clubId: string,
    query: GetClubEventsQueryDto
  ): Promise<GetClubEventsResponseDto> {
    await this.ensureActiveMembership(user.id, clubId);

    const now = new Date();
    const events = await this.prisma.clubEvent.findMany({
      where: {
        clubId,
        ...(query.type === "offline"
          ? { type: PrismaClubEventType.OFFLINE_POKER }
          : query.type === "online"
            ? { type: PrismaClubEventType.ONLINE_TABLE }
            : {}),
        ...(query.status === "upcoming"
          ? {
              status: {
                in: [
                  PrismaClubEventStatus.SCHEDULED,
                  PrismaClubEventStatus.RSVP_OPEN,
                  PrismaClubEventStatus.IN_PROGRESS
                ]
              },
              scheduledStartAt: {
                gte: now
              }
            }
          : query.status === "completed"
            ? {
                status: PrismaClubEventStatus.COMPLETED
              }
            : query.status === "cancelled"
              ? {
                  status: PrismaClubEventStatus.CANCELLED
                }
              : {})
      },
      include: {
        rsvps: true
      },
      orderBy: {
        scheduledStartAt:
          query.status === "completed" || query.status === "cancelled" ? "desc" : "asc"
      }
    });

    return {
      events: events.map((event) => this.toClubEventListItem(event, user.id))
    };
  }

  async getEvent(
    user: UserDto,
    clubId: string,
    eventId: string
  ): Promise<GetClubEventResponseDto> {
    const membership = await this.ensureActiveMembership(user.id, clubId);
    const event = await this.getEventRecord(clubId, eventId);
    const isManager = isAdminRole(membership.role);
    const rsvpGroups = isManager ? this.groupRsvps(event) : emptyRsvpGroups();
    const myRsvp = event.rsvps.find((rsvp) => rsvp.userId === user.id) ?? null;

    return {
      club: this.toClubListItemForPreview(
        {
          ...event.club,
          events: []
        },
        membership
      ),
      event: this.toClubEventDetailsDto(event, user.id),
      myRsvp: myRsvp ? this.toClubEventRsvpDto(myRsvp) : null,
      rsvpGroups,
      rsvps: isManager ? rsvpGroups : null,
      canManage: isManager,
      canRespond: event.status !== PrismaClubEventStatus.CANCELLED
    };
  }

  async updateEventRsvp(
    user: UserDto,
    clubId: string,
    eventId: string,
    input: UpdateClubEventRsvpRequestDto
  ): Promise<UpdateClubEventRsvpResponseDto> {
    await this.ensureActiveMembership(user.id, clubId);
    const updated = await this.applyRsvpUpdate(this.prisma, {
      clubId,
      eventId,
      userId: user.id,
      status: input.status
    });

    return {
      eventId,
      status: updated.status,
      respondedAt: updated.respondedAt?.toISOString() ?? null
    };
  }

  async remindEvent(
    user: UserDto,
    clubId: string,
    eventId: string
  ): Promise<SendClubEventReminderResponseDto> {
    await this.ensureAdminMembership(user.id, clubId);
    const result = await this.dispatchEventReminder(eventId, clubId);

    return {
      eventId,
      sentCount: result.sentCount,
      skippedCount: result.skippedCount
    };
  }

  async cancelEvent(
    user: UserDto,
    clubId: string,
    eventId: string
  ): Promise<CancelClubEventResponseDto> {
    await this.ensureAdminMembership(user.id, clubId);
    const event = await this.prisma.clubEvent.findFirst({
      where: {
        id: eventId,
        clubId
      }
    });

    if (!event) {
      throw new ApiError(
        CLUB_ERROR_CODES.notFound,
        "Мероприятие не найдено",
        HttpStatus.NOT_FOUND
      );
    }

    const cancelledAt = new Date();
    const updated = await this.prisma.clubEvent.update({
      where: {
        id: event.id
      },
      data: {
        status: PrismaClubEventStatus.CANCELLED,
        cancelledAt
      }
    });

    return {
      eventId: updated.id,
      status: updated.status,
      cancelledAt: cancelledAt.toISOString()
    };
  }

  async updateEventRsvpFromTelegram(
    input: TelegramClubEventRsvpRequestDto
  ): Promise<TelegramClubEventRsvpResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: {
        telegramId: input.telegramId
      }
    });

    if (!user) {
      return {
        eventId: input.eventId,
        status: "non-member",
        message: "Вы не являетесь участником этого клуба."
      };
    }

    const event = await this.prisma.clubEvent.findUnique({
      where: {
        id: input.eventId
      },
      select: {
        clubId: true
      }
    });

    if (!event) {
      return {
        eventId: input.eventId,
        status: "cancelled",
        message: "Мероприятие не найдено."
      };
    }

    try {
      const updated = await this.applyRsvpUpdate(this.prisma, {
        clubId: event.clubId,
        eventId: input.eventId,
        userId: user.id,
        status: input.status
      });

      return {
        eventId: input.eventId,
        status: updated.status === PrismaClubEventRsvpStatus.WAITLIST ? "waitlist" : "success",
        rsvpStatus: updated.status,
        message: getTelegramRsvpMessage(updated.status)
      };
    } catch (error) {
      if (
        error instanceof ApiError &&
        error.code === CLUB_ERROR_CODES.conflict &&
        (error.getResponse() as { error: { message: string } }).error.message ===
          "Мероприятие отменено"
      ) {
        return {
          eventId: input.eventId,
          status: "cancelled",
          message: "Мероприятие отменено."
        };
      }

      if (error instanceof ApiError && error.code === CLUB_ERROR_CODES.forbidden) {
        return {
          eventId: input.eventId,
          status: "non-member",
          message: "Вы не являетесь участником этого клуба."
        };
      }

      throw error;
    }
  }

  async createEventForRoom(
    tx: Prisma.TransactionClient,
    input: ClubEventCreationInput
  ): Promise<string> {
    const membership = await this.ensureAdminMembership(
      input.createdByUserId,
      input.clubId,
      tx
    );
    const event = await tx.clubEvent.create({
      data: {
        clubId: membership.clubId,
        createdByUserId: input.createdByUserId,
        type: PrismaClubEventType.OFFLINE_POKER,
        title: input.title.trim(),
        scheduledStartAt: input.scheduledStartAt,
        status: PrismaClubEventStatus.RSVP_OPEN,
        maxPlayers: input.maxPlayers,
        location: input.location,
        ...(input.offlineRoomId ? { offlineRoomId: input.offlineRoomId } : {})
      }
    });

    await this.seedEventRsvps(tx, membership.clubId, event.id);

    return event.id;
  }

  async createEventForVirtualTable(
    tx: Prisma.TransactionClient,
    input: ClubEventCreationInput
  ): Promise<string> {
    const membership = await this.ensureAdminMembership(
      input.createdByUserId,
      input.clubId,
      tx
    );
    const event = await tx.clubEvent.create({
      data: {
        clubId: membership.clubId,
        createdByUserId: input.createdByUserId,
        type: PrismaClubEventType.ONLINE_TABLE,
        title: input.title.trim(),
        scheduledStartAt: input.scheduledStartAt,
        status: PrismaClubEventStatus.RSVP_OPEN,
        maxPlayers: input.maxPlayers,
        ...(input.virtualTableId ? { virtualTableId: input.virtualTableId } : {})
      }
    });

    await this.seedEventRsvps(tx, membership.clubId, event.id);

    return event.id;
  }

  async sendEventInvites(eventId: string, clubId: string): Promise<void> {
    await this.dispatchEventInvites(eventId, clubId);
  }

  private async dispatchEventInvites(
    eventId: string,
    clubId: string
  ): Promise<SendClubEventReminderResponseDto> {
    const event = await this.getEventRecord(clubId, eventId);

    if (!this.clubsNotificationsService) {
      return {
        eventId,
        sentCount: 0,
        skippedCount: event.rsvps.length
      };
    }

    let sentCount = 0;
    let skippedCount = 0;

    for (const rsvp of event.rsvps) {
      const result = await this.clubsNotificationsService.sendInviteNotification(
        this.toNotificationEvent(event),
        {
          telegramId: rsvp.user.telegramId,
          currentStatus: rsvp.status
        }
      );

      if (result.sent) {
        sentCount += 1;
      } else {
        skippedCount += 1;
      }
    }

    return {
      eventId,
      sentCount,
      skippedCount
    };
  }

  private async dispatchEventReminder(
    eventId: string,
    clubId: string
  ): Promise<SendClubEventReminderResponseDto> {
    const event = await this.getEventRecord(clubId, eventId);

    if (!this.clubsNotificationsService) {
      return {
        eventId,
        sentCount: 0,
        skippedCount: event.rsvps.length
      };
    }

    let sentCount = 0;
    let skippedCount = 0;

    for (const rsvp of event.rsvps) {
      const result = await this.clubsNotificationsService.sendReminderNotification(
        this.toNotificationEvent(event),
        {
          telegramId: rsvp.user.telegramId,
          currentStatus: rsvp.status
        }
      );

      if (result.sent) {
        sentCount += 1;
      } else {
        skippedCount += 1;
      }
    }

    return {
      eventId,
      sentCount,
      skippedCount
    };
  }

  private async seedEventRsvps(
    tx: Prisma.TransactionClient,
    clubId: string,
    eventId: string
  ): Promise<void> {
    const members = await tx.clubMember.findMany({
      where: {
        clubId,
        status: PrismaClubMemberStatus.ACTIVE
      },
      select: {
        userId: true
      }
    });

    if (members.length === 0) {
      return;
    }

    await tx.clubEventRsvp.createMany({
      data: members.map((member) => ({
        clubEventId: eventId,
        clubId,
        userId: member.userId,
        status: PrismaClubEventRsvpStatus.NO_RESPONSE
      })),
      skipDuplicates: true
    });
  }

  private async applyRsvpUpdate(
    prisma: ClubPrismaClient,
    input: {
      clubId: string;
      eventId: string;
      userId: string;
      status: PrismaClubEventRsvpStatus;
    }
  ): Promise<RsvpUpdateResult> {
    return this.prisma.$transaction(async (tx) => {
      const membership = await this.ensureActiveMembership(input.userId, input.clubId, tx);
      const event = await tx.clubEvent.findFirst({
        where: {
          id: input.eventId,
          clubId: input.clubId
        }
      });

      if (!event) {
        throw new ApiError(
          CLUB_ERROR_CODES.notFound,
          "Мероприятие не найдено",
          HttpStatus.NOT_FOUND
        );
      }

      if (event.status === PrismaClubEventStatus.CANCELLED) {
        throw new ApiError(
          CLUB_ERROR_CODES.conflict,
          "Мероприятие отменено",
          HttpStatus.CONFLICT
        );
      }

      if (event.status === PrismaClubEventStatus.COMPLETED) {
        throw new ApiError(
          CLUB_ERROR_CODES.conflict,
          "Нельзя изменить ответ на завершенное мероприятие",
          HttpStatus.CONFLICT
        );
      }

      const existingRsvp = await tx.clubEventRsvp.findUnique({
        where: {
          clubEventId_userId: {
            clubEventId: input.eventId,
            userId: membership.userId
          }
        }
      });

      let nextStatus = input.status;

      if (input.status === PrismaClubEventRsvpStatus.GOING && event.maxPlayers) {
        const goingCount = await tx.clubEventRsvp.count({
          where: {
            clubEventId: input.eventId,
            status: PrismaClubEventRsvpStatus.GOING,
            userId: {
              not: membership.userId
            }
          }
        });

        if (goingCount >= event.maxPlayers) {
          nextStatus = PrismaClubEventRsvpStatus.WAITLIST;
        }
      }

      const respondedAt =
        nextStatus === PrismaClubEventRsvpStatus.NO_RESPONSE ? null : new Date();

      if (existingRsvp) {
        await tx.clubEventRsvp.update({
          where: {
            id: existingRsvp.id
          },
          data: {
            status: nextStatus,
            respondedAt
          }
        });
      } else {
        await tx.clubEventRsvp.create({
          data: {
            clubEventId: input.eventId,
            clubId: input.clubId,
            userId: membership.userId,
            status: nextStatus,
            respondedAt
          }
        });
      }

      return {
        status: nextStatus,
        respondedAt
      };
    });
  }

  private async getClubRecordForUser(userId: string, clubId: string): Promise<ClubRecord> {
    const club = await this.prisma.club.findFirst({
      where: {
        id: clubId,
        members: {
          some: {
            userId,
            status: PrismaClubMemberStatus.ACTIVE
          }
        }
      },
      include: {
        members: {
          where: {
            status: PrismaClubMemberStatus.ACTIVE
          },
          include: {
            user: true
          }
        },
        events: {
          where: {
            status: {
              not: PrismaClubEventStatus.CANCELLED
            },
            scheduledStartAt: {
              gte: new Date()
            }
          },
          include: {
            rsvps: true
          },
          orderBy: {
            scheduledStartAt: "asc"
          },
          take: 1
        }
      }
    });

    if (!club) {
      throw new ApiError(
        CLUB_ERROR_CODES.forbidden,
        "Этот клуб вам недоступен",
        HttpStatus.FORBIDDEN
      );
    }

    return club;
  }

  private async getEventRecord(clubId: string, eventId: string): Promise<ClubEventRecord> {
    const event = await this.prisma.clubEvent.findFirst({
      where: {
        id: eventId,
        clubId
      },
      include: {
        club: {
          include: {
            members: {
              include: {
                user: true
              }
            }
          }
        },
        rsvps: {
          include: {
            user: true
          }
        },
        offlineRoom: {
          select: {
            id: true
          }
        },
        virtualTable: {
          select: {
            id: true,
            startingStackChips: true,
            smallBlindChips: true,
            bigBlindChips: true
          }
        }
      }
    });

    if (!event) {
      throw new ApiError(
        CLUB_ERROR_CODES.notFound,
        "Мероприятие не найдено",
        HttpStatus.NOT_FOUND
      );
    }

    return event;
  }

  private async ensureActiveMembership(
    userId: string,
    clubId: string,
    prisma: ClubPrismaClient = this.prisma
  ): Promise<ClubMember> {
    const membership = await prisma.clubMember.findFirst({
      where: {
        clubId,
        userId,
        status: PrismaClubMemberStatus.ACTIVE
      }
    });

    if (!membership) {
      throw new ApiError(
        CLUB_ERROR_CODES.forbidden,
        "Вы не являетесь участником этого клуба",
        HttpStatus.FORBIDDEN
      );
    }

    return membership;
  }

  private async ensureAdminMembership(
    userId: string,
    clubId: string,
    prisma: ClubPrismaClient = this.prisma
  ): Promise<ClubAdminMembership> {
    const membership = await prisma.clubMember.findFirst({
      where: {
        clubId,
        userId,
        status: PrismaClubMemberStatus.ACTIVE,
        role: {
          in: [PrismaClubMemberRole.OWNER, PrismaClubMemberRole.ADMIN]
        }
      },
      include: {
        club: true
      }
    });

    if (!membership) {
      throw new ApiError(
        CLUB_ERROR_CODES.forbidden,
        "У вас нет прав на управление клубом",
        HttpStatus.FORBIDDEN
      );
    }

    return membership;
  }

  private async ensureOwnerMembership(
    userId: string,
    clubId: string
  ): Promise<ClubMember> {
    const membership = await this.prisma.clubMember.findFirst({
      where: {
        clubId,
        userId,
        status: PrismaClubMemberStatus.ACTIVE,
        role: PrismaClubMemberRole.OWNER
      }
    });

    if (!membership) {
      throw new ApiError(
        CLUB_ERROR_CODES.forbidden,
        "Только владелец может менять настройки клуба",
        HttpStatus.FORBIDDEN
      );
    }

    return membership;
  }

  private toClubListItem(club: ClubRecord, userId: string): ClubListItemDto {
    const membership = club.members.find((member) => member.userId === userId);

    if (!membership) {
      throw new Error(`Membership for user ${userId} is missing in club ${club.id}`);
    }

    const nearestEvent = club.events[0] ?? null;

    return {
      id: club.id,
      name: club.name,
      description: club.description ?? null,
      privacy: club.privacy,
      defaultCurrency: club.defaultCurrency ?? null,
      membersCount: club.members.length,
      myRole: membership.role,
      myStatus: membership.status,
      nearestEvent: nearestEvent
        ? {
            id: nearestEvent.id,
            title: nearestEvent.title,
            type: nearestEvent.type,
            status: nearestEvent.status,
            scheduledStartAt: nearestEvent.scheduledStartAt.toISOString(),
            rsvpCounts: toRsvpCounts(nearestEvent.rsvps),
            linkedRoomId: nearestEvent.offlineRoomId ?? null,
            linkedTableId: nearestEvent.virtualTableId ?? null
          }
        : null,
      createdAt: club.createdAt.toISOString(),
      updatedAt: club.updatedAt.toISOString()
    };
  }

  private toClubListItemForPreview(
    club: Club & {
      members: ClubMembershipRecord[];
      events: Array<
        ClubEvent & {
          rsvps: ClubEventRsvp[];
        }
      >;
    },
    membership: ClubMember | null
  ): ClubListItemDto {
    const nearestEvent = club.events[0] ?? null;

    return {
      id: club.id,
      name: club.name,
      description: club.description ?? null,
      privacy: club.privacy,
      defaultCurrency: club.defaultCurrency ?? null,
      membersCount: club.members.length,
      myRole: membership?.role ?? PrismaClubMemberRole.MEMBER,
      myStatus: membership?.status ?? PrismaClubMemberStatus.INVITED,
      nearestEvent: nearestEvent
        ? {
            id: nearestEvent.id,
            title: nearestEvent.title,
            type: nearestEvent.type,
            status: nearestEvent.status,
            scheduledStartAt: nearestEvent.scheduledStartAt.toISOString(),
            rsvpCounts: toRsvpCounts(nearestEvent.rsvps),
            linkedRoomId: nearestEvent.offlineRoomId ?? null,
            linkedTableId: nearestEvent.virtualTableId ?? null
          }
        : null,
      createdAt: club.createdAt.toISOString(),
      updatedAt: club.updatedAt.toISOString()
    };
  }

  private toClubDashboard(club: ClubRecord, userId: string): ClubDashboardDto {
    return {
      ...this.toClubListItem(club, userId),
      ownerUserId: club.ownerUserId,
      inviteCode: club.inviteCode,
      inviteLink: buildClubInviteLink(club.inviteCode)
    };
  }

  private toClubMemberDto(
    member: Pick<
      ClubMember,
      "id" | "userId" | "role" | "status" | "displayName" | "joinedAt" | "removedAt"
    >,
    user: Pick<User, "username" | "firstName" | "lastName">
  ): ClubMemberDto {
    return {
      id: member.id,
      userId: member.userId,
      displayName: member.displayName ?? getDisplayName(user),
      username: user.username ?? null,
      role: member.role,
      status: member.status,
      joinedAt: member.joinedAt.toISOString(),
      removedAt: member.removedAt?.toISOString() ?? null
    };
  }

  private toClubEventListItem(
    event: ClubEvent & {
      rsvps: ClubEventRsvp[];
    },
    userId: string
  ): ClubEventListItemDto {
    const myRsvp = event.rsvps.find((rsvp) => rsvp.userId === userId);

    return {
      id: event.id,
      clubId: event.clubId,
      type: event.type,
      title: event.title,
      description: event.description ?? null,
      scheduledStartAt: event.scheduledStartAt.toISOString(),
      timezone: event.timezone ?? null,
      status: event.status,
      maxPlayers: event.maxPlayers ?? null,
      location: event.location ?? null,
      linkedRoomId: event.offlineRoomId ?? null,
      linkedTableId: event.virtualTableId ?? null,
      myRsvpStatus: myRsvp?.status ?? null,
      rsvpCounts: toRsvpCounts(event.rsvps),
      createdAt: event.createdAt.toISOString(),
      updatedAt: event.updatedAt.toISOString(),
      cancelledAt: event.cancelledAt?.toISOString() ?? null
    };
  }

  private toClubEventDetailsDto(event: ClubEventRecord, userId: string): ClubEventDetailsDto {
    return {
      ...this.toClubEventListItem(event, userId),
      createdByUserId: event.createdByUserId
    };
  }

  private toClubEventRsvpDto(rsvp: ClubEventRsvp): ClubEventRsvpDto {
    return {
      id: rsvp.id,
      clubEventId: rsvp.clubEventId,
      clubId: rsvp.clubId,
      userId: rsvp.userId,
      status: rsvp.status,
      respondedAt: rsvp.respondedAt?.toISOString() ?? null,
      createdAt: rsvp.createdAt.toISOString(),
      updatedAt: rsvp.updatedAt.toISOString()
    };
  }

  private groupRsvps(event: ClubEventRecord): ClubEventRsvpGroupsDto {
    const memberMap = new Map(event.club.members.map((member) => [member.userId, member]));
    const groups: ClubEventRsvpGroupsDto = {
      going: [],
      maybe: [],
      declined: [],
      noResponse: [],
      waitlist: []
    };

    for (const rsvp of event.rsvps) {
      const member = memberMap.get(rsvp.userId);
      const dto = this.toClubEventRsvpMemberDto(rsvp, member ?? null);

      switch (rsvp.status) {
        case PrismaClubEventRsvpStatus.GOING:
          groups.going.push(dto);
          break;
        case PrismaClubEventRsvpStatus.MAYBE:
          groups.maybe.push(dto);
          break;
        case PrismaClubEventRsvpStatus.DECLINED:
          groups.declined.push(dto);
          break;
        case PrismaClubEventRsvpStatus.WAITLIST:
          groups.waitlist.push(dto);
          break;
        default:
          groups.noResponse.push(dto);
      }
    }

    return groups;
  }

  private toClubEventRsvpMemberDto(
    rsvp: ClubEventRsvp & {
      user: User;
    },
    member: ClubMembershipRecord | null
  ): ClubEventRsvpMemberDto {
    return {
      rsvpId: rsvp.id,
      memberId: member?.id ?? null,
      userId: rsvp.userId,
      displayName: member?.displayName ?? getDisplayName(rsvp.user),
      username: rsvp.user.username ?? null,
      role: member?.role ?? null,
      status: rsvp.status,
      respondedAt: rsvp.respondedAt?.toISOString() ?? null
    };
  }

  private toNotificationEvent(event: ClubEventRecord) {
    return {
      id: event.id,
      clubId: event.clubId,
      clubName: event.club.name,
      type: event.type,
      title: event.title,
      scheduledStartAt: event.scheduledStartAt,
      location: event.location ?? null,
      maxPlayers: event.maxPlayers ?? null,
      offlineRoomId: event.offlineRoom?.id ?? null,
      virtualTableId: event.virtualTable?.id ?? null,
      startingStackChips: event.virtualTable?.startingStackChips.toString() ?? null,
      smallBlindChips: event.virtualTable?.smallBlindChips.toString() ?? null,
      bigBlindChips: event.virtualTable?.bigBlindChips.toString() ?? null
    };
  }

  private validateClubInput(input: CreateClubRequestDto): void {
    this.validateClubName(input.name);
    this.validateClubDescription(input.description);
    this.validateDefaultCurrency(input.defaultCurrency);
  }

  private validateClubUpdate(input: UpdateClubRequestDto): void {
    if (input.name !== undefined) {
      this.validateClubName(input.name);
    }

    if (input.description !== undefined) {
      this.validateClubDescription(input.description);
    }

    if (input.defaultCurrency !== undefined) {
      this.validateDefaultCurrency(input.defaultCurrency);
    }
  }

  private validateClubName(name: string): void {
    if (name.trim().length === 0) {
      throw new ApiError(
        CLUB_ERROR_CODES.invalidInput,
        "Как назвать клуб?",
        HttpStatus.BAD_REQUEST
      );
    }

    if (name.trim().length > CLUB_TITLE_MAX_LENGTH) {
      throw new ApiError(
        CLUB_ERROR_CODES.invalidInput,
        "Название клуба слишком длинное",
        HttpStatus.BAD_REQUEST
      );
    }
  }

  private validateClubDescription(description: string | null | undefined): void {
    if (description && description.trim().length > CLUB_DESCRIPTION_MAX_LENGTH) {
      throw new ApiError(
        CLUB_ERROR_CODES.invalidInput,
        "Описание клуба слишком длинное",
        HttpStatus.BAD_REQUEST
      );
    }
  }

  private validateDefaultCurrency(currency: string | null | undefined): void {
    if (!currency) {
      return;
    }

    if (!CLUB_SUPPORTED_CURRENCIES.includes(currency.trim().toUpperCase() as never)) {
      throw new ApiError(
        CLUB_ERROR_CODES.invalidInput,
        "Выберите рубли, доллары или евро",
        HttpStatus.BAD_REQUEST
      );
    }
  }

  private createInviteCode(): string {
    const bytes = randomBytes(CLUB_INVITE_CODE_LENGTH);
    let inviteCode = "";

    for (const byte of bytes) {
      inviteCode += CLUB_INVITE_CODE_ALPHABET[byte % CLUB_INVITE_CODE_ALPHABET.length];
    }

    return inviteCode;
  }

  private isUniqueConstraintError(error: unknown): boolean {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
      return false;
    }

    return error.code === "P2002";
  }
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  const normalized = value?.trim() ?? "";

  return normalized.length > 0 ? normalized : null;
}

function normalizeOptionalCurrency(value: string | null | undefined): string | null {
  const normalized = value?.trim().toUpperCase() ?? "";

  return normalized.length > 0 ? normalized : null;
}

function normalizeInviteCode(value: string): string {
  return value.trim().toUpperCase();
}

function toRsvpCounts(rsvps: ClubEventRsvp[]): ClubEventRsvpCountsDto {
  return rsvps.reduce<ClubEventRsvpCountsDto>(
    (counts, rsvp) => {
      switch (rsvp.status) {
        case PrismaClubEventRsvpStatus.GOING:
          counts.going += 1;
          break;
        case PrismaClubEventRsvpStatus.MAYBE:
          counts.maybe += 1;
          break;
        case PrismaClubEventRsvpStatus.DECLINED:
          counts.declined += 1;
          break;
        case PrismaClubEventRsvpStatus.WAITLIST:
          counts.waitlist += 1;
          break;
        default:
          counts.noResponse += 1;
      }

      return counts;
    },
    {
      going: 0,
      maybe: 0,
      declined: 0,
      noResponse: 0,
      waitlist: 0
    }
  );
}

function emptyRsvpGroups(): ClubEventRsvpGroupsDto {
  return {
    going: [],
    maybe: [],
    declined: [],
    noResponse: [],
    waitlist: []
  };
}

function buildClubInviteLink(inviteCode: string): string {
  const startParam = buildClubStartParam(inviteCode);
  const botUsername = process.env.TELEGRAM_BOT_USERNAME?.trim();

  if (botUsername) {
    return `https://t.me/${botUsername}/app?startapp=${startParam}`;
  }

  const webAppUrl = process.env.WEB_APP_URL?.trim() ?? "http://localhost:5173";
  const normalizedWebAppUrl = webAppUrl.endsWith("/")
    ? webAppUrl.slice(0, -1)
    : webAppUrl;

  return appendWebAppCacheBuster(`${normalizedWebAppUrl}/clubs/join/${inviteCode}`);
}

function isAdminRole(role: PrismaClubMemberRole): boolean {
  return role === PrismaClubMemberRole.OWNER || role === PrismaClubMemberRole.ADMIN;
}

function getDisplayName(
  user: Pick<UserDto, "username" | "firstName" | "lastName"> | Pick<User, "username" | "firstName" | "lastName">
): string {
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();

  if (fullName.length > 0) {
    return fullName;
  }

  if (user.username && user.username.trim().length > 0) {
    return `@${user.username.trim()}`;
  }

  return "Игрок";
}

function getTelegramRsvpMessage(status: PrismaClubEventRsvpStatus): string {
  switch (status) {
    case PrismaClubEventRsvpStatus.GOING:
      return "Готово. Ваш ответ: Приду.";
    case PrismaClubEventRsvpStatus.MAYBE:
      return "Готово. Ваш ответ: Возможно.";
    case PrismaClubEventRsvpStatus.DECLINED:
      return "Готово. Ваш ответ: Не смогу.";
    case PrismaClubEventRsvpStatus.WAITLIST:
      return "Места закончились. Вы добавлены в лист ожидания.";
    default:
      return "Готово. Ваш ответ обновлен.";
  }
}

import { HttpStatus } from "@nestjs/common";
import {
  ClubEventRsvpStatus,
  ClubEventStatus,
  ClubEventType,
  ClubMemberRole,
  ClubMemberStatus,
  ClubPrivacy,
  type Club,
  type ClubEvent,
  type ClubEventRsvp,
  type ClubMember,
  type User
} from "@prisma/client";
import type { UserDto } from "@pokertable/shared";
import { PrismaService } from "../prisma/prisma.service";
import { ClubsService } from "./clubs.service";

type MockPrisma = {
  club: {
    create: jest.Mock;
    findFirst: jest.Mock;
    findMany: jest.Mock;
    findUnique: jest.Mock;
    update: jest.Mock;
  };
  clubMember: {
    create: jest.Mock;
    createMany?: jest.Mock;
    findFirst: jest.Mock;
    findMany: jest.Mock;
    findUnique: jest.Mock;
    update: jest.Mock;
  };
  clubEvent: {
    create: jest.Mock;
    findFirst: jest.Mock;
    findMany: jest.Mock;
    findUnique: jest.Mock;
    update: jest.Mock;
  };
  clubEventRsvp: {
    count: jest.Mock;
    create: jest.Mock;
    createMany: jest.Mock;
    findUnique: jest.Mock;
    update: jest.Mock;
  };
  user: {
    findUnique: jest.Mock;
  };
  $transaction: jest.Mock;
};

const baseUser: UserDto = {
  id: "user-1",
  telegramId: "100",
  username: "denis",
  firstName: "Денис",
  lastName: null,
  avatarUrl: null
};

describe("ClubsService", () => {
  beforeEach(() => {
    process.env.WEB_APP_URL = "https://miniapp.example";
    delete process.env.TELEGRAM_BOT_USERNAME;
  });

  it("creates a club and owner membership in one transaction", async () => {
    const prisma = createPrismaMock();
    const club = createClubRecord();

    prisma.club.create.mockResolvedValue(club);
    prisma.clubMember.create.mockResolvedValue(
      createClubMemberRecord({ clubId: club.id, role: ClubMemberRole.OWNER })
    );
    prisma.club.findFirst.mockResolvedValue(
      createClubRecord({
        members: [createClubMemberRecord({ role: ClubMemberRole.OWNER, user: createUserRecord() })],
        events: []
      })
    );
    prisma.$transaction.mockImplementation(
      async (
        callback: (
          tx: Pick<MockPrisma, "club" | "clubMember">
        ) => Promise<Club>
      ) => callback({ club: prisma.club, clubMember: prisma.clubMember })
    );

    const service = new ClubsService(prisma as unknown as PrismaService);

    const result = await service.createClub(baseUser, {
      name: "Домашний клуб",
      description: "Играем по пятницам",
      defaultCurrency: "RUB"
    });
    const createClubArgs = getFirstCall<{
      data: {
        ownerUserId: string;
        name: string;
        privacy: ClubPrivacy;
        defaultCurrency: string | null;
      };
    }>(prisma.club.create);
    const createMemberArgs = getFirstCall<{
      data: {
        clubId: string;
        userId: string;
        role: ClubMemberRole;
        status: ClubMemberStatus;
      };
    }>(prisma.clubMember.create);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(createClubArgs?.data.ownerUserId).toBe(baseUser.id);
    expect(createClubArgs?.data.name).toBe("Домашний клуб");
    expect(createClubArgs?.data.privacy).toBe(ClubPrivacy.PRIVATE_INVITE_ONLY);
    expect(createClubArgs?.data.defaultCurrency).toBe("RUB");
    expect(createMemberArgs?.data.clubId).toBe(club.id);
    expect(createMemberArgs?.data.userId).toBe(baseUser.id);
    expect(createMemberArgs?.data.role).toBe(ClubMemberRole.OWNER);
    expect(createMemberArgs?.data.status).toBe(ClubMemberStatus.ACTIVE);
    expect(result.club.myRole).toBe("OWNER");
    expect(result.club.inviteLink).toMatch(/^https:\/\/miniapp\.example\/clubs\/join\//);
  });

  it("reactivates membership on join and seeds NO_RESPONSE RSVP records", async () => {
    const prisma = createPrismaMock();
    const club = createClubRecord();
    const existingMembership = createClubMemberRecord({
      id: "member-2",
      clubId: club.id,
      userId: baseUser.id,
      role: ClubMemberRole.MEMBER,
      status: ClubMemberStatus.LEFT
    });

    prisma.club.findUnique.mockResolvedValue(club);
    prisma.clubMember.findUnique.mockResolvedValue(existingMembership);
    prisma.clubMember.update.mockResolvedValue(
      createClubMemberRecord({
        ...existingMembership,
        status: ClubMemberStatus.ACTIVE,
        user: createUserRecord()
      })
    );
    prisma.clubEvent.findMany.mockResolvedValue([{ id: "event-1" }, { id: "event-2" }]);
    prisma.clubEventRsvp.createMany.mockResolvedValue({ count: 2 });
    prisma.club.findFirst.mockResolvedValue(
      createClubRecord({
        members: [createClubMemberRecord({ role: ClubMemberRole.MEMBER, user: createUserRecord() })],
        events: []
      })
    );
    prisma.$transaction.mockImplementation(
      async (
        callback: (
          tx: Pick<MockPrisma, "clubMember" | "clubEvent" | "clubEventRsvp">
        ) => Promise<ClubMember>
      ) =>
        callback({
          clubMember: prisma.clubMember,
          clubEvent: prisma.clubEvent,
          clubEventRsvp: prisma.clubEventRsvp
        })
    );

    const service = new ClubsService(prisma as unknown as PrismaService);

    const result = await service.joinClub(baseUser, club.id, {
      inviteCode: club.inviteCode
    });
    const updateMemberArgs = getFirstCall<{
      where: {
        id: string;
      };
      data: {
        status: ClubMemberStatus;
        removedAt: null;
      };
    }>(prisma.clubMember.update);

    expect(updateMemberArgs?.where.id).toBe(existingMembership.id);
    expect(updateMemberArgs?.data.status).toBe(ClubMemberStatus.ACTIVE);
    expect(updateMemberArgs?.data.removedAt).toBeNull();
    expect(prisma.clubEventRsvp.createMany).toHaveBeenCalledWith({
      data: [
        {
          clubEventId: "event-1",
          clubId: club.id,
          userId: baseUser.id,
          status: ClubEventRsvpStatus.NO_RESPONSE
        },
        {
          clubEventId: "event-2",
          clubId: club.id,
          userId: baseUser.id,
          status: ClubEventRsvpStatus.NO_RESPONSE
        }
      ],
      skipDuplicates: true
    });
    expect(result.member.status).toBe("ACTIVE");
  });

  it("denies reminder for non-admin members", async () => {
    const prisma = createPrismaMock();
    prisma.clubMember.findFirst.mockResolvedValue(null);
    const service = new ClubsService(prisma as unknown as PrismaService);

    await expect(service.remindEvent(baseUser, "club-1", "event-1")).rejects.toMatchObject({
      status: HttpStatus.FORBIDDEN,
      response: {
        error: {
          code: "CLUB_FORBIDDEN",
          message: "У вас нет прав на управление клубом"
        }
      }
    });
  });

  it("moves RSVP to waitlist when max players are full", async () => {
    const prisma = createPrismaMock();
    prisma.clubMember.findFirst.mockResolvedValue(
      createClubMemberRecord({ clubId: "club-1", userId: baseUser.id })
    );
    prisma.clubEvent.findFirst.mockResolvedValue(
      createClubEventRecord({
        id: "event-1",
        clubId: "club-1",
        maxPlayers: 1,
        status: ClubEventStatus.RSVP_OPEN
      })
    );
    prisma.clubEventRsvp.findUnique.mockResolvedValue(
      createRsvpRecord({
        clubEventId: "event-1",
        clubId: "club-1",
        userId: baseUser.id,
        status: ClubEventRsvpStatus.NO_RESPONSE
      })
    );
    prisma.clubEventRsvp.count.mockResolvedValue(1);
    prisma.clubEventRsvp.update.mockResolvedValue(
      createRsvpRecord({
        status: ClubEventRsvpStatus.WAITLIST
      })
    );
    prisma.$transaction.mockImplementation(
      async (
        callback: (
          tx: Pick<MockPrisma, "clubMember" | "clubEvent" | "clubEventRsvp">
        ) => Promise<unknown>
      ) =>
        callback({
          clubMember: prisma.clubMember,
          clubEvent: prisma.clubEvent,
          clubEventRsvp: prisma.clubEventRsvp
        })
    );

    const service = new ClubsService(prisma as unknown as PrismaService);

    const result = await service.updateEventRsvp(baseUser, "club-1", "event-1", {
      status: "GOING"
    });
    const updateRsvpArgs = getFirstCall<{
      data: {
        status: ClubEventRsvpStatus;
      };
    }>(prisma.clubEventRsvp.update);

    expect(result.status).toBe("WAITLIST");
    expect(updateRsvpArgs?.data.status).toBe(ClubEventRsvpStatus.WAITLIST);
  });

  it("rejects RSVP for cancelled events", async () => {
    const prisma = createPrismaMock();
    prisma.clubMember.findFirst.mockResolvedValue(
      createClubMemberRecord({ clubId: "club-1", userId: baseUser.id })
    );
    prisma.clubEvent.findFirst.mockResolvedValue(
      createClubEventRecord({
        id: "event-1",
        clubId: "club-1",
        status: ClubEventStatus.CANCELLED
      })
    );
    prisma.$transaction.mockImplementation(
      async (
        callback: (
          tx: Pick<MockPrisma, "clubMember" | "clubEvent" | "clubEventRsvp">
        ) => Promise<unknown>
      ) =>
        callback({
          clubMember: prisma.clubMember,
          clubEvent: prisma.clubEvent,
          clubEventRsvp: prisma.clubEventRsvp
        })
    );

    const service = new ClubsService(prisma as unknown as PrismaService);

    await expect(
      service.updateEventRsvp(baseUser, "club-1", "event-1", {
        status: "GOING"
      })
    ).rejects.toMatchObject({
      status: HttpStatus.CONFLICT,
      response: {
        error: {
          code: "CLUB_CONFLICT",
          message: "Мероприятие отменено"
        }
      }
    });
  });

  it("creates offline club event and seeds NO_RESPONSE for active members", async () => {
    const prisma = createPrismaMock();
    prisma.clubMember.findFirst.mockResolvedValue(
      createClubMemberRecord({
        clubId: "club-1",
        userId: baseUser.id,
        role: ClubMemberRole.OWNER,
        user: createUserRecord(),
        club: createClubRecord()
      })
    );
    prisma.clubEvent.create.mockResolvedValue(createClubEventRecord({ id: "event-1" }));
    prisma.clubMember.findMany.mockResolvedValue([
      { userId: "user-1" },
      { userId: "user-2" }
    ]);
    prisma.clubEventRsvp.createMany.mockResolvedValue({ count: 2 });

    const service = new ClubsService(prisma as unknown as PrismaService);

    const eventId = await service.createEventForRoom(prisma as never, {
      clubId: "club-1",
      createdByUserId: baseUser.id,
      type: "OFFLINE_POKER",
      title: "Friday Poker",
      scheduledStartAt: new Date("2026-05-24T18:00:00.000Z"),
      maxPlayers: 9,
      location: "У Дениса",
      offlineRoomId: "room-1"
    });
    const createEventArgs = getFirstCall<{
      data: {
        type: ClubEventType;
        offlineRoomId?: string;
      };
    }>(prisma.clubEvent.create);

    expect(eventId).toBe("event-1");
    expect(createEventArgs?.data.type).toBe(ClubEventType.OFFLINE_POKER);
    expect(createEventArgs?.data.offlineRoomId).toBe("room-1");
    expect(prisma.clubEventRsvp.createMany).toHaveBeenCalledWith({
      data: [
        {
          clubEventId: "event-1",
          clubId: "club-1",
          userId: "user-1",
          status: ClubEventRsvpStatus.NO_RESPONSE
        },
        {
          clubEventId: "event-1",
          clubId: "club-1",
          userId: "user-2",
          status: ClubEventRsvpStatus.NO_RESPONSE
        }
      ],
      skipDuplicates: true
    });
  });

  it("creates virtual club event and seeds NO_RESPONSE for active members", async () => {
    const prisma = createPrismaMock();
    prisma.clubMember.findFirst.mockResolvedValue(
      createClubMemberRecord({
        clubId: "club-1",
        userId: baseUser.id,
        role: ClubMemberRole.ADMIN,
        user: createUserRecord(),
        club: createClubRecord()
      })
    );
    prisma.clubEvent.create.mockResolvedValue(createClubEventRecord({ id: "event-2" }));
    prisma.clubMember.findMany.mockResolvedValue([{ userId: "user-1" }]);
    prisma.clubEventRsvp.createMany.mockResolvedValue({ count: 1 });

    const service = new ClubsService(prisma as unknown as PrismaService);

    const eventId = await service.createEventForVirtualTable(prisma as never, {
      clubId: "club-1",
      createdByUserId: baseUser.id,
      type: "ONLINE_TABLE",
      title: "Sunday Online",
      scheduledStartAt: new Date("2026-05-25T18:00:00.000Z"),
      maxPlayers: 6,
      location: null,
      virtualTableId: "table-1"
    });
    const createEventArgs = getFirstCall<{
      data: {
        type: ClubEventType;
        virtualTableId?: string;
      };
    }>(prisma.clubEvent.create);

    expect(eventId).toBe("event-2");
    expect(createEventArgs?.data.type).toBe(ClubEventType.ONLINE_TABLE);
    expect(createEventArgs?.data.virtualTableId).toBe("table-1");
    expect(prisma.clubEventRsvp.createMany).toHaveBeenCalledWith({
      data: [
        {
          clubEventId: "event-2",
          clubId: "club-1",
          userId: "user-1",
          status: ClubEventRsvpStatus.NO_RESPONSE
        }
      ],
      skipDuplicates: true
    });
  });
});

function createPrismaMock(): MockPrisma {
  return {
    club: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn()
    },
    clubMember: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn()
    },
    clubEvent: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn()
    },
    clubEventRsvp: {
      count: jest.fn(),
      create: jest.fn(),
      createMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn()
    },
    user: {
      findUnique: jest.fn()
    },
    $transaction: jest.fn()
  };
}

function createClubRecord(
  overrides: Partial<
    Club & {
      members: Array<ClubMember & { user: User }>;
      events: Array<ClubEvent & { rsvps: ClubEventRsvp[] }>;
    }
  > = {}
): Club & {
  members: Array<ClubMember & { user: User }>;
  events: Array<ClubEvent & { rsvps: ClubEventRsvp[] }>;
} {
  return {
    id: "club-1",
    ownerUserId: baseUser.id,
    name: "Домашний клуб",
    description: "Пятничный покер",
    privacy: ClubPrivacy.PRIVATE_INVITE_ONLY,
    defaultCurrency: "RUB",
    inviteCode: "ABCD1234",
    createdAt: new Date("2026-05-20T10:00:00.000Z"),
    updatedAt: new Date("2026-05-20T10:00:00.000Z"),
    members: [],
    events: [],
    ...overrides
  };
}

function createClubMemberRecord(
  overrides: Partial<
    ClubMember & {
      user: User;
      club: Club;
    }
  > = {}
): ClubMember & {
  user: User;
  club: Club;
} {
  return {
    id: "member-1",
    clubId: "club-1",
    userId: baseUser.id,
    role: ClubMemberRole.MEMBER,
    status: ClubMemberStatus.ACTIVE,
    displayName: "Денис",
    joinedAt: new Date("2026-05-20T10:00:00.000Z"),
    removedAt: null,
    user: createUserRecord(),
    club: createClubRecord(),
    ...overrides
  };
}

function createClubEventRecord(
  overrides: Partial<ClubEvent> = {}
): ClubEvent {
  return {
    id: "event-1",
    clubId: "club-1",
    createdByUserId: baseUser.id,
    type: ClubEventType.OFFLINE_POKER,
    title: "Friday Poker",
    description: null,
    scheduledStartAt: new Date("2026-05-24T18:00:00.000Z"),
    timezone: null,
    status: ClubEventStatus.SCHEDULED,
    maxPlayers: null,
    offlineRoomId: null,
    virtualTableId: null,
    location: null,
    createdAt: new Date("2026-05-20T10:00:00.000Z"),
    updatedAt: new Date("2026-05-20T10:00:00.000Z"),
    cancelledAt: null,
    ...overrides
  };
}

function createRsvpRecord(overrides: Partial<ClubEventRsvp> = {}): ClubEventRsvp {
  return {
    id: "rsvp-1",
    clubEventId: "event-1",
    clubId: "club-1",
    userId: baseUser.id,
    status: ClubEventRsvpStatus.NO_RESPONSE,
    respondedAt: null,
    createdAt: new Date("2026-05-20T10:00:00.000Z"),
    updatedAt: new Date("2026-05-20T10:00:00.000Z"),
    ...overrides
  };
}

function createUserRecord(overrides: Partial<User> = {}): User {
  return {
    id: baseUser.id,
    telegramId: baseUser.telegramId,
    username: baseUser.username,
    firstName: baseUser.firstName,
    lastName: baseUser.lastName,
    avatarUrl: baseUser.avatarUrl,
    createdAt: new Date("2026-05-20T10:00:00.000Z"),
    updatedAt: new Date("2026-05-20T10:00:00.000Z"),
    ...overrides
  };
}

function getFirstCall<T>(mockFn: { mock: { calls: unknown[][] } }): T | undefined {
  const firstCall = mockFn.mock.calls[0];

  return firstCall?.[0] as T | undefined;
}

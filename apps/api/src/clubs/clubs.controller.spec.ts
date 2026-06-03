import { HttpStatus } from "@nestjs/common";
import type { UserDto } from "@pokertable/shared";
import { ApiError } from "../shared/api-error";
import { ClubsController } from "./clubs.controller";
import { CLUB_ERROR_CODES } from "./clubs.constants";

const baseUser: UserDto = {
  id: "user-1",
  telegramId: "100",
  username: "denis",
  firstName: "Денис",
  lastName: null,
  avatarUrl: null
};

describe("ClubsController", () => {
  const originalToken = process.env.TELEGRAM_BOT_TOKEN;

  beforeEach(() => {
    process.env.TELEGRAM_BOT_TOKEN = "bot-token";
  });

  afterAll(() => {
    if (originalToken === undefined) {
      delete process.env.TELEGRAM_BOT_TOKEN;
    } else {
      process.env.TELEGRAM_BOT_TOKEN = originalToken;
    }
  });

  it("rejects telegram RSVP callback with invalid token", () => {
    const clubsService = createClubsServiceMock();
    const controller = new ClubsController(clubsService as never);

    const error = captureError(() =>
      controller.telegramRsvp("wrong-token", {
        eventId: "event-1",
        telegramId: "100",
        status: "GOING"
      })
    );

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe(CLUB_ERROR_CODES.unauthorized);
    expect((error as ApiError).getStatus()).toBe(HttpStatus.UNAUTHORIZED);
    expect(clubsService.updateEventRsvpFromTelegram).not.toHaveBeenCalled();
  });

  it("passes create club request to service", async () => {
    const clubsService = createClubsServiceMock();
    clubsService.createClub.mockResolvedValue({
      club: {
        id: "club-1",
        name: "Домашний клуб",
        description: null,
        privacy: "PRIVATE_INVITE_ONLY",
        defaultCurrency: "RUB",
        membersCount: 1,
        myRole: "OWNER",
        myStatus: "ACTIVE",
        nearestEvent: null,
        ownerUserId: baseUser.id,
        inviteCode: "ABCD1234",
        inviteLink: "https://t.me/test/app?startapp=club_ABCD1234",
        createdAt: "2026-05-20T10:00:00.000Z",
        updatedAt: "2026-05-20T10:00:00.000Z"
      }
    });
    const controller = new ClubsController(clubsService as never);

    await controller.createClub(baseUser, {
      name: " Домашний клуб ",
      description: " Для своих ",
      defaultCurrency: "rub"
    });

    expect(clubsService.createClub).toHaveBeenCalledWith(baseUser, {
      name: "Домашний клуб",
      description: "Для своих",
      defaultCurrency: "RUB"
    });
  });
});

function createClubsServiceMock() {
  return {
    createClub: jest.fn(),
    listClubs: jest.fn(),
    getClub: jest.fn(),
    updateClub: jest.fn(),
    joinClub: jest.fn(),
    listMembers: jest.fn(),
    getInviteLink: jest.fn(),
    updateMember: jest.fn(),
    listEvents: jest.fn(),
    getEvent: jest.fn(),
    updateEventRsvp: jest.fn(),
    remindEvent: jest.fn(),
    cancelEvent: jest.fn(),
    updateEventRsvpFromTelegram: jest.fn()
  };
}

function captureError(action: () => unknown): unknown {
  try {
    action();
  } catch (error) {
    return error;
  }

  return null;
}

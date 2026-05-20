import type { UserDto } from "@pokertable/shared";
import { ApiError } from "../shared/api-error";
import { VirtualController } from "./virtual.controller";
import { VIRTUAL_ERROR_CODES } from "./virtual.constants";
import { encodeVirtualLeaderboardCursor } from "./virtual-leaderboard-cursor";

const baseUser: UserDto = {
  id: "user-1",
  telegramId: "100",
  username: "denis",
  firstName: "Денис",
  lastName: null,
  avatarUrl: null
};

describe("VirtualController", () => {
  it("returns VIRTUAL_INVALID_INPUT for malformed create table payload", () => {
    const controller = new VirtualController(createVirtualServiceMock() as never);

    const error = captureError(() => controller.createTable(baseUser, {}));

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe(VIRTUAL_ERROR_CODES.invalidInput);
    expect((error as ApiError).getStatus()).toBe(400);
  });

  it("returns VIRTUAL_INVALID_INPUT for malformed join table payload", () => {
    const controller = new VirtualController(createVirtualServiceMock() as never);

    const error = captureError(() => controller.joinTable(baseUser, {}));

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe(VIRTUAL_ERROR_CODES.invalidInput);
    expect((error as ApiError).getStatus()).toBe(400);
  });

  it("returns VIRTUAL_INVALID_INPUT for malformed action payload", () => {
    const controller = new VirtualController(createVirtualServiceMock() as never);

    const error = captureError(() => controller.submitAction(baseUser, "table-1", {}));

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe(VIRTUAL_ERROR_CODES.invalidInput);
    expect((error as ApiError).getStatus()).toBe(400);
  });

  it("returns VIRTUAL_INVALID_INPUT for malformed reaction payload", () => {
    const controller = new VirtualController(createVirtualServiceMock() as never);

    const error = captureError(() => controller.submitReaction(baseUser, "table-1", {}));

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe(VIRTUAL_ERROR_CODES.invalidInput);
    expect((error as ApiError).getStatus()).toBe(400);
  });

  it("returns VIRTUAL_INVALID_INPUT for malformed raise blinds payload", () => {
    const controller = new VirtualController(createVirtualServiceMock() as never);

    const error = captureError(() => controller.raiseBlinds(baseUser, "table-1", {}));

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe(VIRTUAL_ERROR_CODES.invalidInput);
    expect((error as ApiError).getStatus()).toBe(400);
  });

  it("returns VIRTUAL_INVALID_INPUT for malformed sit-out request payload", () => {
    const controller = new VirtualController(createVirtualServiceMock() as never);

    const error = captureError(() => controller.requestSitOut(baseUser, "table-1", {}));

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe(VIRTUAL_ERROR_CODES.invalidInput);
    expect((error as ApiError).getStatus()).toBe(400);
  });

  it("does not call service when create table payload is malformed", () => {
    const virtualService = createVirtualServiceMock();
    const controller = new VirtualController(virtualService as never);

    try {
      void controller.createTable(baseUser, {});
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
    }

    expect(virtualService.createTable).not.toHaveBeenCalled();
  });

  it("does not call service when join table payload is malformed", () => {
    const virtualService = createVirtualServiceMock();
    const controller = new VirtualController(virtualService as never);

    try {
      void controller.joinTable(baseUser, {});
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
    }

    expect(virtualService.joinTable).not.toHaveBeenCalled();
  });

  it("does not call service when action payload is malformed", () => {
    const virtualService = createVirtualServiceMock();
    const controller = new VirtualController(virtualService as never);

    try {
      void controller.submitAction(baseUser, "table-1", {});
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
    }

    expect(virtualService.submitAction).not.toHaveBeenCalled();
  });

  it("does not call service when reaction payload is malformed", () => {
    const virtualService = createVirtualServiceMock();
    const controller = new VirtualController(virtualService as never);

    try {
      void controller.submitReaction(baseUser, "table-1", {});
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
    }

    expect(virtualService.submitReaction).not.toHaveBeenCalled();
  });

  it("does not call service when raise blinds payload is malformed", () => {
    const virtualService = createVirtualServiceMock();
    const controller = new VirtualController(virtualService as never);

    try {
      void controller.raiseBlinds(baseUser, "table-1", {});
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
    }

    expect(virtualService.raiseBlinds).not.toHaveBeenCalled();
  });

  it("does not call service when sit-out request payload is malformed", () => {
    const virtualService = createVirtualServiceMock();
    const controller = new VirtualController(virtualService as never);

    try {
      void controller.requestSitOut(baseUser, "table-1", {});
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
    }

    expect(virtualService.requestSitOut).not.toHaveBeenCalled();
  });

  it("calls service for starting the next hand", async () => {
    const virtualService = createVirtualServiceMock();
    virtualService.startNextHand.mockResolvedValue({
      tableId: "table-1",
      status: "ACTIVE",
      startedAt: "2026-05-13T10:00:00.000Z",
      currentHandId: "hand-2"
    });
    const controller = new VirtualController(virtualService as never);

    const result = await controller.startNextHand(baseUser, "table-1");

    expect(virtualService.startNextHand).toHaveBeenCalledWith(baseUser, "table-1");
    expect(result.currentHandId).toBe("hand-2");
  });

  it("calls service for pause table", async () => {
    const virtualService = createVirtualServiceMock();
    virtualService.pauseTable.mockResolvedValue({
      tableId: "table-1",
      status: "PAUSED",
      pausedAt: "2026-05-13T10:00:00.000Z"
    });
    const controller = new VirtualController(virtualService as never);

    await controller.pauseTable(baseUser, "table-1");

    expect(virtualService.pauseTable).toHaveBeenCalledWith(baseUser, "table-1");
  });

  it("calls service for resume table", async () => {
    const virtualService = createVirtualServiceMock();
    virtualService.resumeTable.mockResolvedValue({
      tableId: "table-1",
      status: "ACTIVE",
      resumedAt: "2026-05-13T10:00:00.000Z"
    });
    const controller = new VirtualController(virtualService as never);

    await controller.resumeTable(baseUser, "table-1");

    expect(virtualService.resumeTable).toHaveBeenCalledWith(baseUser, "table-1");
  });

  it("calls service for finish table", async () => {
    const virtualService = createVirtualServiceMock();
    virtualService.finishTable.mockResolvedValue({
      tableId: "table-1",
      status: "FINISHED",
      finishedAt: "2026-05-13T10:00:00.000Z",
      currentHandId: "hand-1"
    });
    const controller = new VirtualController(virtualService as never);

    await controller.finishTable(baseUser, "table-1");

    expect(virtualService.finishTable).toHaveBeenCalledWith(baseUser, "table-1");
  });

  it("calls service for cancel table", async () => {
    const virtualService = createVirtualServiceMock();
    virtualService.cancelTable.mockResolvedValue({
      tableId: "table-1",
      status: "CANCELLED",
      finishedAt: "2026-05-13T10:00:00.000Z",
      currentHandId: null
    });
    const controller = new VirtualController(virtualService as never);

    await controller.cancelTable(baseUser, "table-1");

    expect(virtualService.cancelTable).toHaveBeenCalledWith(baseUser, "table-1");
  });

  it("normalizes raise blinds body before calling service", async () => {
    const virtualService = createVirtualServiceMock();
    virtualService.raiseBlinds.mockResolvedValue({
      pendingSmallBlindChips: "15",
      pendingBigBlindChips: "30",
      applies: "NEXT_HAND"
    });
    const controller = new VirtualController(virtualService as never);

    await controller.raiseBlinds(baseUser, "table-1", {
      smallBlindChips: 15,
      bigBlindChips: "30"
    });

    expect(virtualService.raiseBlinds).toHaveBeenCalledWith(baseUser, "table-1", {
      smallBlindChips: "15",
      bigBlindChips: "30"
    });
  });

  it("normalizes sit-out request body before calling service", async () => {
    const virtualService = createVirtualServiceMock();
    virtualService.requestSitOut.mockResolvedValue({
      seatStatus: "SIT_OUT_REQUESTED",
      autoCheck: true,
      autoFold: false
    });
    const controller = new VirtualController(virtualService as never);

    await controller.requestSitOut(baseUser, "table-1", {
      autoCheck: true,
      autoFold: false
    });

    expect(virtualService.requestSitOut).toHaveBeenCalledWith(baseUser, "table-1", {
      autoCheck: true,
      autoFold: false
    });
  });

  it("calls service for return to table", async () => {
    const virtualService = createVirtualServiceMock();
    virtualService.returnToTable.mockResolvedValue({
      seatStatus: "RETURN_REQUESTED"
    });
    const controller = new VirtualController(virtualService as never);

    await controller.returnToTable(baseUser, "table-1");

    expect(virtualService.returnToTable).toHaveBeenCalledWith(baseUser, "table-1");
  });

  it("normalizes reaction body before calling service", async () => {
    const virtualService = createVirtualServiceMock();
    virtualService.submitReaction.mockResolvedValue({
      reaction: {
        id: "reaction-1",
        tableId: "table-1",
        seatId: "seat-1",
        userId: baseUser.id,
        displayName: "Денис",
        emoji: "😂",
        createdAt: "2026-05-13T10:00:00.000Z"
      }
    });
    const controller = new VirtualController(virtualService as never);

    await controller.submitReaction(baseUser, "table-1", {
      emoji: " 😂 "
    });

    expect(virtualService.submitReaction).toHaveBeenCalledWith(baseUser, "table-1", {
      emoji: "😂"
    });
  });

  it("calls service for listing current user tables", async () => {
    const virtualService = createVirtualServiceMock();
    virtualService.listTables.mockResolvedValue({
      items: []
    });
    const controller = new VirtualController(virtualService as never);

    await controller.listTables(baseUser);

    expect(virtualService.listTables).toHaveBeenCalledWith(baseUser);
  });

  it("calls service for hand history", async () => {
    const virtualService = createVirtualServiceMock();
    virtualService.getHandHistory.mockResolvedValue({
      table: {
        id: "table-1",
        title: "Домашний кеш",
        status: "ACTIVE",
        inviteCode: "AB12CD34",
        maxSeats: 6,
        smallBlindChips: "5",
        bigBlindChips: "10"
      },
      hand: {
        id: "hand-1",
        handNumber: 1,
        status: "COMPLETED",
        street: "SHOWDOWN",
        potTotalChips: "100",
        startedAt: "2026-05-13T10:00:00.000Z",
        completedAt: "2026-05-13T10:01:00.000Z"
      },
      board: [],
      actions: [],
      pots: []
    });
    const controller = new VirtualController(virtualService as never);

    await controller.getHandHistory(baseUser, "table-1", "hand-1");

    expect(virtualService.getHandHistory).toHaveBeenCalledWith(
      baseUser,
      "table-1",
      "hand-1"
    );
  });

  it("normalizes hand histories query before calling service", async () => {
    const virtualService = createVirtualServiceMock();
    virtualService.listHandHistories.mockResolvedValue({
      items: [],
      nextCursor: null
    });
    const controller = new VirtualController(virtualService as never);

    await controller.listHandHistories(baseUser, "table-1", {
      limit: "10",
      cursor: " 0012 "
    });

    expect(virtualService.listHandHistories).toHaveBeenCalledWith(baseUser, "table-1", {
      limit: 10,
      cursor: "12"
    });
  });

  it("normalizes leaderboard query before calling service", async () => {
    const virtualService = createVirtualServiceMock();
    virtualService.getLeaderboard.mockResolvedValue({
      items: [],
      nextCursor: null
    });
    const controller = new VirtualController(virtualService as never);
    const cursor = encodeVirtualLeaderboardCursor({
      onlinePokerScore: 120,
      handsPlayed: 10,
      netChips: 500n,
      userId: "user-1"
    });

    await controller.getLeaderboard(baseUser, {
      limit: "10",
      scope: "played-with-me",
      period: "month",
      cursor: ` ${cursor} `
    });

    expect(virtualService.getLeaderboard).toHaveBeenCalledWith(baseUser, {
      scope: "played-with-me",
      period: "month",
      limit: 10,
      cursor
    });
  });

  it("normalizes profile period before calling service", async () => {
    const virtualService = createVirtualServiceMock();
    virtualService.getPlayerProfile.mockResolvedValue({
      user: {
        id: "user-2",
        displayName: "Ира",
        username: "ira"
      },
      stats: {
        userId: "user-2",
        displayName: "Ира",
        username: "ira",
        handsPlayed: 0,
        handsWon: 0,
        netChips: "0",
        netEstimatedMinor: "0",
        bigBlindsWon: "0",
        bbPer100Bps: 0,
        winRateBps: 0,
        avgChipsPerHand: "0",
        onlinePokerScore: 0
      },
      tableStats: {
        tablesPlayed: 0,
        tablesWon: 0,
        tableWinRateBps: 0,
        totalBuyInEstimatedMinor: "0",
        roiBps: 0
      },
      style: createEmptyStyleProfile(),
      recentTables: [],
      recentResults: [],
      trend: []
    });
    const controller = new VirtualController(virtualService as never);

    await controller.getPlayerProfile(baseUser, "user-2", {
      period: "last-10"
    });

    expect(virtualService.getPlayerProfile).toHaveBeenCalledWith(baseUser, "user-2", "last-10");
  });

  it("calls service for current user stats", async () => {
    const virtualService = createVirtualServiceMock();
    virtualService.getMyStats.mockResolvedValue({
      stats: {
        userId: baseUser.id,
        displayName: "Денис",
        username: "denis",
        handsPlayed: 0,
        handsWon: 0,
        netChips: "0",
        netEstimatedMinor: "0",
        bigBlindsWon: "0",
        bbPer100Bps: 0,
        winRateBps: 0,
        avgChipsPerHand: "0",
        onlinePokerScore: 0
      }
    });
    const controller = new VirtualController(virtualService as never);

    await controller.getMyStats(baseUser);

    expect(virtualService.getMyStats).toHaveBeenCalledWith(baseUser);
  });
});

function createVirtualServiceMock() {
  return {
    createTable: jest.fn(),
    joinTable: jest.fn(),
    startTable: jest.fn(),
    startNextHand: jest.fn(),
    pauseTable: jest.fn(),
    resumeTable: jest.fn(),
    finishTable: jest.fn(),
    cancelTable: jest.fn(),
    raiseBlinds: jest.fn(),
    requestSitOut: jest.fn(),
    returnToTable: jest.fn(),
    listTables: jest.fn(),
    listHandHistories: jest.fn(),
    getHandHistory: jest.fn(),
    getTable: jest.fn(),
    submitReaction: jest.fn(),
    submitAction: jest.fn(),
    getLeaderboard: jest.fn(),
    getPlayerProfile: jest.fn(),
    getMyStats: jest.fn()
  };
}

function createEmptyStyleProfile() {
  return {
    sample: {
      handsDealt: 0,
      minimumRequired: 50,
      isEnoughData: false
    },
    archetype: {
      code: "LEARNING" as const,
      title: "🔍 Учится",
      description: "Нужно больше сыгранных раздач, чтобы уверенно определить стиль игрока."
    },
    styleStats: {
      vpipBps: 0,
      pfrBps: 0,
      aggressionFactorBps: 0,
      foldToRaiseBps: null,
      showdownRateBps: 0,
      showdownWinRateBps: null,
      allInWinRateBps: null,
      bbPer100Bps: 0,
      averagePotWonChips: "0",
      biggestPotWonChips: "0",
      averageDecisionTimeSeconds: 0,
      remindersReceived: 0,
      autoActionsCount: 0
    }
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

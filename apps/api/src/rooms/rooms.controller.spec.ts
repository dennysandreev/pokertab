import type { UserDto } from "@pokertable/shared";
import { ApiError } from "../shared/api-error";
import { RoomsController } from "./rooms.controller";
import { ROOM_ERROR_CODES } from "./rooms.constants";

const baseUser: UserDto = {
  id: "user-1",
  telegramId: "100",
  username: "denis",
  firstName: "Денис",
  lastName: null,
  avatarUrl: null
};

describe("RoomsController", () => {
  it("returns ROOM_INVALID_INPUT for malformed create room payload", () => {
    const controller = new RoomsController(createRoomsServiceMock() as never);

    const error = captureError(() => controller.createRoom(baseUser, {}));

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe(ROOM_ERROR_CODES.invalidInput);
    expect((error as ApiError).getStatus()).toBe(400);
  });

  it("returns ROOM_INVALID_INPUT for malformed join room payload", () => {
    const controller = new RoomsController(createRoomsServiceMock() as never);

    const error = captureError(() => controller.joinRoom(baseUser, {}));

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe(ROOM_ERROR_CODES.invalidInput);
    expect((error as ApiError).getStatus()).toBe(400);
  });

  it("returns ROOM_INVALID_INPUT for malformed create rebuy payload", () => {
    const controller = new RoomsController(createRoomsServiceMock() as never);

    const error = captureError(() => controller.createRebuy(baseUser, "room-1", {}));

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe(ROOM_ERROR_CODES.invalidInput);
    expect((error as ApiError).getStatus()).toBe(400);
  });

  it("returns ROOM_INVALID_INPUT for malformed cancel rebuy payload", () => {
    const controller = new RoomsController(createRoomsServiceMock() as never);

    const error = captureError(() => controller.cancelRebuy(baseUser, "room-1", "rebuy-1", {}));

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe(ROOM_ERROR_CODES.invalidInput);
    expect((error as ApiError).getStatus()).toBe(400);
  });

  it("returns ROOM_INVALID_INPUT for malformed settlement preview payload", () => {
    const controller = new RoomsController(createRoomsServiceMock() as never);

    const error = captureError(() => controller.previewSettlement(baseUser, "room-1", {}));

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe(ROOM_ERROR_CODES.invalidInput);
    expect((error as ApiError).getStatus()).toBe(400);
  });

  it("returns ROOM_INVALID_INPUT for malformed settlement close payload", () => {
    const controller = new RoomsController(createRoomsServiceMock() as never);

    const error = captureError(() => controller.closeSettlement(baseUser, "room-1", {}));

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe(ROOM_ERROR_CODES.invalidInput);
    expect((error as ApiError).getStatus()).toBe(400);
  });

  it("does not call service when create room payload is malformed", () => {
    const roomsService = createRoomsServiceMock();
    const controller = new RoomsController(roomsService as never);

    try {
      void controller.createRoom(baseUser, {});
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
    }

    expect(roomsService.createRoom).not.toHaveBeenCalled();
  });

  it("does not call service when join room payload is malformed", () => {
    const roomsService = createRoomsServiceMock();
    const controller = new RoomsController(roomsService as never);

    try {
      void controller.joinRoom(baseUser, {});
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
    }

    expect(roomsService.joinRoom).not.toHaveBeenCalled();
  });

  it("does not call service when create rebuy payload is malformed", () => {
    const roomsService = createRoomsServiceMock();
    const controller = new RoomsController(roomsService as never);

    try {
      void controller.createRebuy(baseUser, "room-1", {});
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
    }

    expect(roomsService.createRebuy).not.toHaveBeenCalled();
  });

  it("does not call service when cancel rebuy payload is malformed", () => {
    const roomsService = createRoomsServiceMock();
    const controller = new RoomsController(roomsService as never);

    try {
      void controller.cancelRebuy(baseUser, "room-1", "rebuy-1", {});
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
    }

    expect(roomsService.cancelRebuy).not.toHaveBeenCalled();
  });

  it("does not call service when settlement preview payload is malformed", () => {
    const roomsService = createRoomsServiceMock();
    const controller = new RoomsController(roomsService as never);

    try {
      void controller.previewSettlement(baseUser, "room-1", {});
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
    }

    expect(roomsService.previewSettlement).not.toHaveBeenCalled();
  });

  it("does not call service when settlement close payload is malformed", () => {
    const roomsService = createRoomsServiceMock();
    const controller = new RoomsController(roomsService as never);

    try {
      void controller.closeSettlement(baseUser, "room-1", {});
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
    }

    expect(roomsService.closeSettlement).not.toHaveBeenCalled();
  });
});

function createRoomsServiceMock() {
  return {
    listRooms: jest.fn(),
    createRoom: jest.fn(),
    getRoom: jest.fn(),
    joinRoom: jest.fn(),
    startRoom: jest.fn(),
    createRebuy: jest.fn(),
    cancelRebuy: jest.fn(),
    getRebuyHistory: jest.fn(),
    previewSettlement: jest.fn(),
    closeSettlement: jest.fn()
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

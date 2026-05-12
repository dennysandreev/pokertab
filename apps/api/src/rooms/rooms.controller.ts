import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import type {
  CancelRebuyResponseDto,
  CloseSettlementResponseDto,
  CreateRoomResponseDto,
  CreateRebuyResponseDto,
  GetRebuyHistoryResponseDto,
  GetRoomResponseDto,
  JoinRoomResponseDto,
  RoomsListResponseDto,
  SettlementPreviewResponseDto,
  StartRoomResponseDto,
  UserDto
} from "@pokertable/shared";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import {
  normalizeCancelRebuyRequest,
  normalizeCloseSettlementRequest,
  normalizeCreateRebuyRequest,
  normalizeCreateRoomRequest,
  normalizeJoinRoomRequest,
  normalizeSettlementPreviewRequest
} from "./rooms.request";
import { RoomsService } from "./rooms.service";

@Controller("rooms")
@UseGuards(AuthGuard)
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Get()
  listRooms(@CurrentUser() user: UserDto): Promise<RoomsListResponseDto> {
    return this.roomsService.listRooms(user);
  }

  @Post()
  createRoom(
    @CurrentUser() user: UserDto,
    @Body() body: unknown
  ): Promise<CreateRoomResponseDto> {
    return this.roomsService.createRoom(user, normalizeCreateRoomRequest(body));
  }

  @Get(":roomId")
  getRoom(
    @CurrentUser() user: UserDto,
    @Param("roomId") roomId: string
  ): Promise<GetRoomResponseDto> {
    return this.roomsService.getRoom(user, roomId);
  }

  @Post("join")
  joinRoom(
    @CurrentUser() user: UserDto,
    @Body() body: unknown
  ): Promise<JoinRoomResponseDto> {
    return this.roomsService.joinRoom(user, normalizeJoinRoomRequest(body));
  }

  @Post(":roomId/start")
  startRoom(
    @CurrentUser() user: UserDto,
    @Param("roomId") roomId: string
  ): Promise<StartRoomResponseDto> {
    return this.roomsService.startRoom(user, roomId);
  }

  @Post(":roomId/rebuys")
  createRebuy(
    @CurrentUser() user: UserDto,
    @Param("roomId") roomId: string,
    @Body() body: unknown
  ): Promise<CreateRebuyResponseDto> {
    return this.roomsService.createRebuy(user, roomId, normalizeCreateRebuyRequest(body));
  }

  @Post(":roomId/rebuys/:rebuyId/cancel")
  cancelRebuy(
    @CurrentUser() user: UserDto,
    @Param("roomId") roomId: string,
    @Param("rebuyId") rebuyId: string,
    @Body() body: unknown
  ): Promise<CancelRebuyResponseDto> {
    return this.roomsService.cancelRebuy(user, roomId, rebuyId, normalizeCancelRebuyRequest(body));
  }

  @Get(":roomId/rebuys")
  getRebuyHistory(
    @CurrentUser() user: UserDto,
    @Param("roomId") roomId: string
  ): Promise<GetRebuyHistoryResponseDto> {
    return this.roomsService.getRebuyHistory(user, roomId);
  }

  @Post(":roomId/settlement/preview")
  previewSettlement(
    @CurrentUser() user: UserDto,
    @Param("roomId") roomId: string,
    @Body() body: unknown
  ): Promise<SettlementPreviewResponseDto> {
    return this.roomsService.previewSettlement(
      user,
      roomId,
      normalizeSettlementPreviewRequest(body)
    );
  }

  @Post(":roomId/settlement/close")
  closeSettlement(
    @CurrentUser() user: UserDto,
    @Param("roomId") roomId: string,
    @Body() body: unknown
  ): Promise<CloseSettlementResponseDto> {
    return this.roomsService.closeSettlement(user, roomId, normalizeCloseSettlementRequest(body));
  }
}

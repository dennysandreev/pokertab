import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import type {
  CancelVirtualTableResponseDto,
  CreateVirtualTableResponseDto,
  FinishVirtualTableResponseDto,
  GetVirtualHandHistoriesResponseDto,
  GetMyVirtualStatsResponseDto,
  GetOpenVirtualTablesResponseDto,
  GetVirtualHandHistoryResponseDto,
  GetVirtualLeaderboardResponseDto,
  GetVirtualPlayerProfileResponseDto,
  GetVirtualTableResponseDto,
  GetVirtualTablesResponseDto,
  JoinVirtualTableResponseDto,
  PauseVirtualTableResponseDto,
  RaiseVirtualBlindsResponseDto,
  RequestVirtualSitOutResponseDto,
  ResumeVirtualTableResponseDto,
  ReturnToVirtualTableResponseDto,
  StartNextVirtualHandResponseDto,
  StartVirtualTableResponseDto,
  SubmitVirtualActionResponseDto,
  SubmitVirtualReactionResponseDto,
  UserDto
} from "@pokertable/shared";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import {
  normalizeCreateVirtualTableRequest,
  normalizeGetVirtualHandHistoriesQuery,
  normalizeGetVirtualLeaderboardQuery,
  normalizeVirtualLeaderboardPeriodQuery,
  normalizeJoinVirtualTableRequest,
  normalizeRaiseVirtualBlindsRequest,
  normalizeRequestVirtualSitOutRequest,
  normalizeSubmitVirtualActionRequest,
  normalizeSubmitVirtualReactionRequest
} from "./virtual.request";
import { VirtualService } from "./virtual.service";

@Controller("virtual")
@UseGuards(AuthGuard)
export class VirtualController {
  constructor(private readonly virtualService: VirtualService) {}

  @Post("tables")
  createTable(
    @CurrentUser() user: UserDto,
    @Body() body: unknown
  ): Promise<CreateVirtualTableResponseDto> {
    return this.virtualService.createTable(user, normalizeCreateVirtualTableRequest(body));
  }

  @Post("tables/join")
  joinTable(
    @CurrentUser() user: UserDto,
    @Body() body: unknown
  ): Promise<JoinVirtualTableResponseDto> {
    return this.virtualService.joinTable(user, normalizeJoinVirtualTableRequest(body));
  }

  @Post("tables/:tableId/join-open")
  joinOpenTable(
    @CurrentUser() user: UserDto,
    @Param("tableId") tableId: string
  ): Promise<JoinVirtualTableResponseDto> {
    return this.virtualService.joinOpenTable(user, tableId);
  }

  @Post("tables/:tableId/start")
  startTable(
    @CurrentUser() user: UserDto,
    @Param("tableId") tableId: string
  ): Promise<StartVirtualTableResponseDto> {
    return this.virtualService.startTable(user, tableId);
  }

  @Post("tables/:tableId/hands/next")
  startNextHand(
    @CurrentUser() user: UserDto,
    @Param("tableId") tableId: string
  ): Promise<StartNextVirtualHandResponseDto> {
    return this.virtualService.startNextHand(user, tableId);
  }

  @Post("tables/:tableId/pause")
  pauseTable(
    @CurrentUser() user: UserDto,
    @Param("tableId") tableId: string
  ): Promise<PauseVirtualTableResponseDto> {
    return this.virtualService.pauseTable(user, tableId);
  }

  @Post("tables/:tableId/resume")
  resumeTable(
    @CurrentUser() user: UserDto,
    @Param("tableId") tableId: string
  ): Promise<ResumeVirtualTableResponseDto> {
    return this.virtualService.resumeTable(user, tableId);
  }

  @Post("tables/:tableId/finish")
  finishTable(
    @CurrentUser() user: UserDto,
    @Param("tableId") tableId: string
  ): Promise<FinishVirtualTableResponseDto> {
    return this.virtualService.finishTable(user, tableId);
  }

  @Post("tables/:tableId/cancel")
  cancelTable(
    @CurrentUser() user: UserDto,
    @Param("tableId") tableId: string
  ): Promise<CancelVirtualTableResponseDto> {
    return this.virtualService.cancelTable(user, tableId);
  }

  @Post("tables/:tableId/raise-blinds")
  raiseBlinds(
    @CurrentUser() user: UserDto,
    @Param("tableId") tableId: string,
    @Body() body: unknown
  ): Promise<RaiseVirtualBlindsResponseDto> {
    return this.virtualService.raiseBlinds(
      user,
      tableId,
      normalizeRaiseVirtualBlindsRequest(body)
    );
  }

  @Post("tables/:tableId/sit-out/request")
  requestSitOut(
    @CurrentUser() user: UserDto,
    @Param("tableId") tableId: string,
    @Body() body: unknown
  ): Promise<RequestVirtualSitOutResponseDto> {
    return this.virtualService.requestSitOut(
      user,
      tableId,
      normalizeRequestVirtualSitOutRequest(body)
    );
  }

  @Post("tables/:tableId/return")
  returnToTable(
    @CurrentUser() user: UserDto,
    @Param("tableId") tableId: string
  ): Promise<ReturnToVirtualTableResponseDto> {
    return this.virtualService.returnToTable(user, tableId);
  }

  @Get("tables")
  listTables(@CurrentUser() user: UserDto): Promise<GetVirtualTablesResponseDto> {
    return this.virtualService.listTables(user);
  }

  @Get("tables/open")
  listOpenTables(@CurrentUser() user: UserDto): Promise<GetOpenVirtualTablesResponseDto> {
    return this.virtualService.listOpenTables(user);
  }

  @Get("tables/:tableId/hands")
  listHandHistories(
    @CurrentUser() user: UserDto,
    @Param("tableId") tableId: string,
    @Query() query: unknown
  ): Promise<GetVirtualHandHistoriesResponseDto> {
    return this.virtualService.listHandHistories(
      user,
      tableId,
      normalizeGetVirtualHandHistoriesQuery(query)
    );
  }

  @Get("tables/:tableId/hands/:handId/history")
  getHandHistory(
    @CurrentUser() user: UserDto,
    @Param("tableId") tableId: string,
    @Param("handId") handId: string
  ): Promise<GetVirtualHandHistoryResponseDto> {
    return this.virtualService.getHandHistory(user, tableId, handId);
  }

  @Get("tables/:tableId")
  getTable(
    @CurrentUser() user: UserDto,
    @Param("tableId") tableId: string
  ): Promise<GetVirtualTableResponseDto> {
    return this.virtualService.getTable(user, tableId);
  }

  @Post("tables/:tableId/reactions")
  submitReaction(
    @CurrentUser() user: UserDto,
    @Param("tableId") tableId: string,
    @Body() body: unknown
  ): Promise<SubmitVirtualReactionResponseDto> {
    return this.virtualService.submitReaction(
      user,
      tableId,
      normalizeSubmitVirtualReactionRequest(body)
    );
  }

  @Post("tables/:tableId/actions")
  submitAction(
    @CurrentUser() user: UserDto,
    @Param("tableId") tableId: string,
    @Body() body: unknown
  ): Promise<SubmitVirtualActionResponseDto> {
    return this.virtualService.submitAction(
      user,
      tableId,
      normalizeSubmitVirtualActionRequest(body)
    );
  }

  @Get("leaderboard")
  getLeaderboard(
    @CurrentUser() user: UserDto,
    @Query() query: unknown
  ): Promise<GetVirtualLeaderboardResponseDto> {
    return this.virtualService.getLeaderboard(user, normalizeGetVirtualLeaderboardQuery(query));
  }

  @Get("players/:userId/profile")
  getPlayerProfile(
    @CurrentUser() user: UserDto,
    @Param("userId") userId: string,
    @Query() query: unknown
  ): Promise<GetVirtualPlayerProfileResponseDto> {
    return this.virtualService.getPlayerProfile(
      user,
      userId,
      normalizeVirtualLeaderboardPeriodQuery(query)
    );
  }

  @Get("stats/me")
  getMyStats(@CurrentUser() user: UserDto): Promise<GetMyVirtualStatsResponseDto> {
    return this.virtualService.getMyStats(user);
  }
}

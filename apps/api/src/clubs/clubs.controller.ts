import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards
} from "@nestjs/common";
import type {
  CancelClubEventResponseDto,
  CreateClubInviteLinkResponseDto,
  CreateClubResponseDto,
  GetClubEventResponseDto,
  GetClubEventsResponseDto,
  GetClubJoinPreviewResponseDto,
  GetClubMembersResponseDto,
  GetClubResponseDto,
  GetClubsResponseDto,
  JoinClubResponseDto,
  SendClubEventReminderResponseDto,
  TelegramClubEventRsvpResponseDto,
  UpdateClubEventRsvpResponseDto,
  UpdateClubMemberResponseDto,
  UserDto
} from "@pokertable/shared";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import { ApiError } from "../shared/api-error";
import { CLUB_ERROR_CODES } from "./clubs.constants";
import {
  normalizeCreateClubRequest,
  normalizeGetClubEventsQuery,
  normalizeJoinClubRequest,
  normalizeTelegramClubEventRsvpRequest,
  normalizeUpdateClubEventRsvpRequest,
  normalizeUpdateClubMemberRequest,
  normalizeUpdateClubRequest
} from "./clubs.request";
import { ClubsService } from "./clubs.service";

@Controller("clubs")
export class ClubsController {
  constructor(private readonly clubsService: ClubsService) {}

  @Post()
  @UseGuards(AuthGuard)
  createClub(
    @CurrentUser() user: UserDto,
    @Body() body: unknown
  ): Promise<CreateClubResponseDto> {
    return this.clubsService.createClub(user, normalizeCreateClubRequest(body));
  }

  @Get()
  @UseGuards(AuthGuard)
  listClubs(@CurrentUser() user: UserDto): Promise<GetClubsResponseDto> {
    return this.clubsService.listClubs(user);
  }

  @Get("invites/:inviteCode")
  @UseGuards(AuthGuard)
  getJoinPreview(
    @CurrentUser() user: UserDto,
    @Param("inviteCode") inviteCode: string
  ): Promise<GetClubJoinPreviewResponseDto> {
    return this.clubsService.getJoinPreview(user, inviteCode);
  }

  @Get(":clubId")
  @UseGuards(AuthGuard)
  getClub(
    @CurrentUser() user: UserDto,
    @Param("clubId") clubId: string
  ): Promise<GetClubResponseDto> {
    return this.clubsService.getClub(user, clubId);
  }

  @Patch(":clubId")
  @UseGuards(AuthGuard)
  updateClub(
    @CurrentUser() user: UserDto,
    @Param("clubId") clubId: string,
    @Body() body: unknown
  ): Promise<GetClubResponseDto> {
    return this.clubsService.updateClub(user, clubId, normalizeUpdateClubRequest(body));
  }

  @Delete(":clubId")
  @UseGuards(AuthGuard)
  deleteClub(
    @CurrentUser() user: UserDto,
    @Param("clubId") clubId: string
  ): Promise<void> {
    return this.clubsService.deleteClub(user, clubId);
  }

  @Post(":clubId/join")
  @UseGuards(AuthGuard)
  joinClub(
    @CurrentUser() user: UserDto,
    @Param("clubId") clubId: string,
    @Body() body?: unknown
  ): Promise<JoinClubResponseDto> {
    return this.clubsService.joinClub(user, clubId, normalizeJoinClubRequest(body));
  }

  @Get(":clubId/members")
  @UseGuards(AuthGuard)
  getMembers(
    @CurrentUser() user: UserDto,
    @Param("clubId") clubId: string
  ): Promise<GetClubMembersResponseDto> {
    return this.clubsService.listMembers(user, clubId);
  }

  @Post(":clubId/invite-link")
  @UseGuards(AuthGuard)
  getInviteLink(
    @CurrentUser() user: UserDto,
    @Param("clubId") clubId: string
  ): Promise<CreateClubInviteLinkResponseDto> {
    return this.clubsService.getInviteLink(user, clubId);
  }

  @Patch(":clubId/members/:memberId")
  @UseGuards(AuthGuard)
  updateMember(
    @CurrentUser() user: UserDto,
    @Param("clubId") clubId: string,
    @Param("memberId") memberId: string,
    @Body() body: unknown
  ): Promise<UpdateClubMemberResponseDto> {
    return this.clubsService.updateMember(
      user,
      clubId,
      memberId,
      normalizeUpdateClubMemberRequest(body)
    );
  }

  @Get(":clubId/events")
  @UseGuards(AuthGuard)
  getEvents(
    @CurrentUser() user: UserDto,
    @Param("clubId") clubId: string,
    @Query() query: unknown
  ): Promise<GetClubEventsResponseDto> {
    return this.clubsService.listEvents(user, clubId, normalizeGetClubEventsQuery(query));
  }

  @Get(":clubId/events/:eventId")
  @UseGuards(AuthGuard)
  getEvent(
    @CurrentUser() user: UserDto,
    @Param("clubId") clubId: string,
    @Param("eventId") eventId: string
  ): Promise<GetClubEventResponseDto> {
    return this.clubsService.getEvent(user, clubId, eventId);
  }

  @Patch(":clubId/events/:eventId/rsvp")
  @UseGuards(AuthGuard)
  updateEventRsvp(
    @CurrentUser() user: UserDto,
    @Param("clubId") clubId: string,
    @Param("eventId") eventId: string,
    @Body() body: unknown
  ): Promise<UpdateClubEventRsvpResponseDto> {
    return this.clubsService.updateEventRsvp(
      user,
      clubId,
      eventId,
      normalizeUpdateClubEventRsvpRequest(body)
    );
  }

  @Post(":clubId/events/:eventId/remind")
  @UseGuards(AuthGuard)
  remindEvent(
    @CurrentUser() user: UserDto,
    @Param("clubId") clubId: string,
    @Param("eventId") eventId: string
  ): Promise<SendClubEventReminderResponseDto> {
    return this.clubsService.remindEvent(user, clubId, eventId);
  }

  @Patch(":clubId/events/:eventId/cancel")
  @UseGuards(AuthGuard)
  cancelEvent(
    @CurrentUser() user: UserDto,
    @Param("clubId") clubId: string,
    @Param("eventId") eventId: string
  ): Promise<CancelClubEventResponseDto> {
    return this.clubsService.cancelEvent(user, clubId, eventId);
  }

  @Post("telegram/rsvp")
  telegramRsvp(
    @Headers("x-telegram-bot-token") telegramBotToken: string | undefined,
    @Body() body: unknown
  ): Promise<TelegramClubEventRsvpResponseDto> {
    const expectedToken = process.env.TELEGRAM_BOT_TOKEN?.trim();

    if (!expectedToken || telegramBotToken?.trim() !== expectedToken) {
      throw new ApiError(
        CLUB_ERROR_CODES.unauthorized,
        "Недостаточно прав для этого запроса",
        HttpStatus.UNAUTHORIZED
      );
    }

    return this.clubsService.updateEventRsvpFromTelegram(
      normalizeTelegramClubEventRsvpRequest(body)
    );
  }
}

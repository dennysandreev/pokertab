import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import type {
  ResolveInviteCodeResponseDto,
  UserDto
} from "@pokertable/shared";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import { normalizeResolveInviteCodeRequest } from "./invites.request";
import { InvitesService } from "./invites.service";

@Controller("invites")
@UseGuards(AuthGuard)
export class InvitesController {
  constructor(private readonly invitesService: InvitesService) {}

  @Post("resolve")
  resolveInviteCode(
    @CurrentUser() _user: UserDto,
    @Body() body: unknown
  ): Promise<ResolveInviteCodeResponseDto> {
    return this.invitesService.resolveInviteCode(normalizeResolveInviteCodeRequest(body));
  }
}

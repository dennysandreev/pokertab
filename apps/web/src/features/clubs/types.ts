export type ClubPrivacy = "PRIVATE_INVITE_ONLY";

export type ClubMemberRole = "OWNER" | "ADMIN" | "MEMBER";

export type ClubMemberStatus = "ACTIVE" | "REMOVED" | "LEFT" | "INVITED";

export type ClubEventType = "OFFLINE_POKER" | "ONLINE_TABLE";

export type ClubEventStatus =
  | "SCHEDULED"
  | "RSVP_OPEN"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";

export type ClubEventRsvpStatus =
  | "GOING"
  | "MAYBE"
  | "DECLINED"
  | "NO_RESPONSE"
  | "WAITLIST";

export type ClubDto = {
  id: string;
  ownerUserId: string;
  name: string;
  description?: string | null;
  privacy: ClubPrivacy;
  defaultCurrency?: string | null;
  inviteCode: string;
  createdAt: string;
  updatedAt: string;
};

export type ClubMemberDto = {
  id: string;
  clubId: string;
  userId: string;
  role: ClubMemberRole;
  status: ClubMemberStatus;
  displayName?: string | null;
  joinedAt: string;
  removedAt?: string | null;
};

export type ClubEventResultSummaryDto = {
  winnerName?: string | null;
  winnerNetMinor?: string | null;
  leaderName?: string | null;
  leaderNetChips?: string | null;
  handsCount?: number | null;
  participantsCount?: number | null;
};

export type ClubEventRsvpSummaryDto = {
  goingCount?: number;
  maybeCount?: number;
  declinedCount?: number;
  noResponseCount?: number;
  waitlistCount?: number;
};

export type ClubEventListItemDto = {
  id: string;
  clubId: string;
  createdByUserId: string;
  type: ClubEventType;
  title: string;
  description?: string | null;
  scheduledStartAt: string;
  timezone?: string | null;
  status: ClubEventStatus;
  maxPlayers?: number | null;
  offlineRoomId?: string | null;
  virtualTableId?: string | null;
  location?: string | null;
  myRsvpStatus?: ClubEventRsvpStatus | null;
  createdAt: string;
  updatedAt: string;
  cancelledAt?: string | null;
  rsvpSummary?: ClubEventRsvpSummaryDto | null;
  resultSummary?: ClubEventResultSummaryDto | null;
};

export type ClubSummaryDto = ClubDto & {
  membersCount?: number;
  activeMembersCount?: number;
  myRole?: ClubMemberRole;
  myStatus?: ClubMemberStatus;
  nearestEvent?: ClubEventListItemDto | null;
};

export type GetMyClubsResponseDto = {
  clubs: ClubSummaryDto[];
};

export type CreateClubRequestDto = {
  name: string;
  description?: string | null;
  defaultCurrency?: string | null;
};

export type CreateClubResponseDto = {
  club: ClubSummaryDto;
  member?: ClubMemberDto | null;
};

export type GetClubDashboardResponseDto = {
  club: ClubSummaryDto;
  myMembership?: ClubMemberDto | null;
  membersCount?: number;
  nearestEvent?: ClubEventListItemDto | null;
  canManageClub?: boolean;
  canCreateEvents?: boolean;
  canInviteMembers?: boolean;
  canDeleteClub?: boolean;
};

export type UpdateClubRequestDto = {
  name?: string;
  description?: string | null;
  defaultCurrency?: string | null;
};

export type UpdateClubResponseDto = {
  club: ClubSummaryDto;
};

export type ClubInviteLinkResponseDto = {
  inviteCode: string;
  inviteUrl: string;
  inviteLink?: string;
  shareUrl?: string | null;
};

export type GetClubMembersResponseDto = {
  members: ClubMemberDto[];
};

export type UpdateClubMemberRequestDto = {
  role?: ClubMemberRole;
  status?: Extract<ClubMemberStatus, "ACTIVE" | "REMOVED" | "LEFT">;
};

export type UpdateClubMemberResponseDto = {
  member: ClubMemberDto;
};

export type ClubEventsQueryDto = {
  type?: "all" | "offline" | "online";
  status?: "upcoming" | "completed" | "cancelled";
};

export type GetClubEventsResponseDto = {
  events: ClubEventListItemDto[];
};

export type ClubEventRsvpPersonDto = {
  id: string;
  userId: string;
  displayName?: string | null;
  status: ClubEventRsvpStatus;
  respondedAt?: string | null;
  role?: ClubMemberRole | null;
};

export type ClubEventRsvpGroupsDto = {
  going: ClubEventRsvpPersonDto[];
  maybe: ClubEventRsvpPersonDto[];
  declined: ClubEventRsvpPersonDto[];
  noResponse: ClubEventRsvpPersonDto[];
  waitlist: ClubEventRsvpPersonDto[];
};

export type ClubEventRsvpDto = {
  id: string;
  clubEventId: string;
  clubId: string;
  userId: string;
  status: ClubEventRsvpStatus;
  respondedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type GetClubEventDetailsResponseDto = {
  club: ClubSummaryDto;
  event: ClubEventListItemDto;
  myMembership?: ClubMemberDto | null;
  myRsvp?: ClubEventRsvpDto | null;
  rsvpGroups: ClubEventRsvpGroupsDto;
  canManage?: boolean;
  canRespond?: boolean;
};

export type UpdateClubEventRsvpRequestDto = {
  status: Exclude<ClubEventRsvpStatus, "NO_RESPONSE">;
};

export type UpdateClubEventRsvpResponseDto = {
  rsvp: ClubEventRsvpDto;
  rsvpGroups?: ClubEventRsvpGroupsDto;
};

export type CancelClubEventRequestDto = {
  reason?: string | null;
};

export type CancelClubEventResponseDto = {
  event: ClubEventListItemDto;
};

export type JoinClubByInviteRequestDto = {
  inviteCode: string;
};

export type GetClubJoinPreviewResponseDto = {
  club: ClubSummaryDto;
  alreadyMember?: boolean;
};

export type JoinClubResponseDto = {
  club: ClubSummaryDto;
  member: ClubMemberDto;
  alreadyMember?: boolean;
};

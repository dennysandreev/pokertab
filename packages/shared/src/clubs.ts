export const CLUB_PRIVACIES = ["PRIVATE_INVITE_ONLY"] as const;

export type ClubPrivacy = (typeof CLUB_PRIVACIES)[number];

export const CLUB_MEMBER_ROLES = ["OWNER", "ADMIN", "MEMBER"] as const;

export type ClubMemberRole = (typeof CLUB_MEMBER_ROLES)[number];

export const CLUB_MEMBER_STATUSES = ["ACTIVE", "REMOVED", "LEFT", "INVITED"] as const;

export type ClubMemberStatus = (typeof CLUB_MEMBER_STATUSES)[number];

export const CLUB_EVENT_TYPES = ["OFFLINE_POKER", "ONLINE_TABLE"] as const;

export type ClubEventType = (typeof CLUB_EVENT_TYPES)[number];

export const CLUB_EVENT_STATUSES = [
  "SCHEDULED",
  "RSVP_OPEN",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED"
] as const;

export type ClubEventStatus = (typeof CLUB_EVENT_STATUSES)[number];

export const CLUB_EVENT_RSVP_STATUSES = [
  "GOING",
  "MAYBE",
  "DECLINED",
  "NO_RESPONSE",
  "WAITLIST"
] as const;

export type ClubEventRsvpStatus = (typeof CLUB_EVENT_RSVP_STATUSES)[number];

export type ClubEventRsvpCountsDto = {
  going: number;
  maybe: number;
  declined: number;
  noResponse: number;
  waitlist: number;
};

export type ClubNearestEventDto = {
  id: string;
  title: string;
  type: ClubEventType;
  status: ClubEventStatus;
  scheduledStartAt: string;
  rsvpCounts: ClubEventRsvpCountsDto;
  linkedRoomId: string | null;
  linkedTableId: string | null;
};

export type ClubListItemDto = {
  id: string;
  name: string;
  description: string | null;
  privacy: ClubPrivacy;
  defaultCurrency: string | null;
  membersCount: number;
  myRole: ClubMemberRole;
  myStatus: ClubMemberStatus;
  nearestEvent: ClubNearestEventDto | null;
  createdAt: string;
  updatedAt: string;
};

export type ClubDashboardDto = ClubListItemDto & {
  ownerUserId: string;
  inviteCode: string;
  inviteLink: string;
};

export type ClubMemberDto = {
  id: string;
  userId: string;
  displayName: string;
  username: string | null;
  role: ClubMemberRole;
  status: ClubMemberStatus;
  joinedAt: string;
  removedAt: string | null;
};

export type ClubEventListItemDto = {
  id: string;
  clubId: string;
  type: ClubEventType;
  title: string;
  description: string | null;
  scheduledStartAt: string;
  timezone: string | null;
  status: ClubEventStatus;
  maxPlayers: number | null;
  location: string | null;
  linkedRoomId: string | null;
  linkedTableId: string | null;
  myRsvpStatus: ClubEventRsvpStatus | null;
  rsvpCounts: ClubEventRsvpCountsDto;
  createdAt: string;
  updatedAt: string;
  cancelledAt: string | null;
};

export type ClubEventRsvpMemberDto = {
  rsvpId: string;
  memberId: string | null;
  userId: string;
  displayName: string;
  username: string | null;
  role: ClubMemberRole | null;
  status: ClubEventRsvpStatus;
  respondedAt: string | null;
};

export type ClubEventRsvpDto = {
  id: string;
  clubEventId: string;
  clubId: string;
  userId: string;
  status: ClubEventRsvpStatus;
  respondedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ClubEventRsvpGroupsDto = {
  going: ClubEventRsvpMemberDto[];
  maybe: ClubEventRsvpMemberDto[];
  declined: ClubEventRsvpMemberDto[];
  noResponse: ClubEventRsvpMemberDto[];
  waitlist: ClubEventRsvpMemberDto[];
};

export type ClubEventDetailsDto = ClubEventListItemDto & {
  createdByUserId: string;
};

export type CreateClubRequestDto = {
  name: string;
  description?: string | null;
  defaultCurrency?: string | null;
};

export type UpdateClubRequestDto = {
  name?: string;
  description?: string | null;
  defaultCurrency?: string | null;
};

export type JoinClubRequestDto = {
  inviteCode?: string | null;
};

export type UpdateClubMemberRequestDto = {
  role?: ClubMemberRole;
  status?: ClubMemberStatus;
};

export type GetClubEventsQueryDto = {
  type: "all" | "offline" | "online";
  status: "all" | "upcoming" | "completed" | "cancelled";
};

export type UpdateClubEventRsvpRequestDto = {
  status: ClubEventRsvpStatus;
};

export type TelegramClubEventRsvpRequestDto = {
  eventId: string;
  telegramId: string;
  status: Extract<ClubEventRsvpStatus, "GOING" | "MAYBE" | "DECLINED">;
};

export type CreateClubResponseDto = {
  club: ClubDashboardDto;
};

export type GetClubsResponseDto = {
  clubs: ClubListItemDto[];
};

export type GetClubResponseDto = {
  club: ClubDashboardDto;
};

export type JoinClubResponseDto = {
  club: ClubDashboardDto;
  member: ClubMemberDto;
};

export type GetClubJoinPreviewResponseDto = {
  club: ClubListItemDto;
  alreadyMember: boolean;
};

export type GetClubMembersResponseDto = {
  clubId: string;
  members: ClubMemberDto[];
};

export type CreateClubInviteLinkResponseDto = {
  clubId: string;
  inviteCode: string;
  inviteLink: string;
};

export type UpdateClubMemberResponseDto = {
  member: ClubMemberDto;
};

export type GetClubEventsResponseDto = {
  events: ClubEventListItemDto[];
};

export type GetClubEventResponseDto = {
  club: ClubListItemDto;
  event: ClubEventDetailsDto;
  myRsvp: ClubEventRsvpDto | null;
  rsvpGroups: ClubEventRsvpGroupsDto;
  rsvps: ClubEventRsvpGroupsDto | null;
  canManage: boolean;
  canRespond: boolean;
};

export type UpdateClubEventRsvpResponseDto = {
  eventId: string;
  status: ClubEventRsvpStatus;
  respondedAt: string | null;
};

export type SendClubEventReminderResponseDto = {
  eventId: string;
  sentCount: number;
  skippedCount: number;
};

export type CancelClubEventResponseDto = {
  eventId: string;
  status: ClubEventStatus;
  cancelledAt: string;
};

export type TelegramClubEventRsvpResponseDto = {
  eventId: string;
  status: "success" | "waitlist" | "cancelled" | "non-member";
  rsvpStatus?: ClubEventRsvpStatus;
  message: string;
};

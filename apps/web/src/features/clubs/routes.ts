export function getClubsNewRoute(): string {
  return "/clubs/new";
}

export function getClubJoinRoute(inviteCode: string): string {
  return `/clubs/join/${inviteCode}`;
}

export function getClubDashboardRoute(clubId: string): string {
  return `/clubs/${clubId}`;
}

export function getClubInviteRoute(clubId: string): string {
  return `/clubs/${clubId}/invite`;
}

export function getClubEventRoute(clubId: string, eventId: string): string {
  return `/clubs/${clubId}/events/${eventId}`;
}

export function isClubRoutePath(pathname: string): boolean {
  return pathname === "/club" || pathname === "/clubs" || pathname.startsWith("/clubs/");
}

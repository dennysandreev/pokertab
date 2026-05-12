export function getHomeRoute(): string {
  return "/";
}

export function getLeaderboardRoute(): string {
  return "/leaderboard";
}

export function getPlayerRoute(userId: string): string {
  return `/players/${userId}`;
}

export function getCreateRoomRoute(): string {
  return "/rooms/new";
}

export function getRoomRoute(roomId: string): string {
  return `/rooms/${roomId}`;
}

export function getJoinRoomRoute(inviteCode: string): string {
  return `/join/${inviteCode}`;
}

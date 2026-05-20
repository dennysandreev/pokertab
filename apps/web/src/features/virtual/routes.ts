export function getVirtualLobbyRoute(): string {
  return "/poker";
}

export function getCreateVirtualTableRoute(): string {
  return "/poker/new";
}

export function getJoinVirtualTableRoute(): string {
  return "/poker/join";
}

export function getJoinVirtualTableInviteRoute(inviteCode: string): string {
  return `/poker/join/${inviteCode}`;
}

export function getVirtualTableRoute(tableId: string): string {
  return `/poker/tables/${tableId}`;
}

export function getVirtualTableHistoryRoute(tableId: string): string {
  return `/poker/tables/${tableId}/history`;
}

export function getVirtualHandRoute(tableId: string, handId: string): string {
  return `/poker/tables/${tableId}/hands/${handId}`;
}

export function getVirtualLeaderboardRoute(): string {
  return "/poker/leaderboard";
}

export function getVirtualStatsRoute(): string {
  return "/poker/stats";
}

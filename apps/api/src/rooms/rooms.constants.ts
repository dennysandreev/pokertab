export const ROOM_ERROR_CODES = {
  invalidInput: "ROOM_INVALID_INPUT",
  notFound: "ROOM_NOT_FOUND",
  accessDenied: "ROOM_ACCESS_DENIED",
  closedJoinBlocked: "ROOM_CLOSED_JOIN_BLOCKED",
  removedJoinBlocked: "ROOM_REMOVED_JOIN_BLOCKED",
  startForbidden: "ROOM_START_FORBIDDEN",
  startRequiresPlayers: "ROOM_START_REQUIRES_PLAYERS",
  invalidStatus: "ROOM_INVALID_STATUS",
  rebuyForbidden: "REBUY_FORBIDDEN",
  rebuyNotFound: "REBUY_NOT_FOUND",
  rebuyInvalidStatus: "REBUY_INVALID_STATUS",
  rebuyPlayerUnavailable: "REBUY_PLAYER_UNAVAILABLE",
  rebuyAlreadyCancelled: "REBUY_ALREADY_CANCELLED",
  settlementForbidden: "SETTLEMENT_FORBIDDEN",
  settlementInvalidStatus: "SETTLEMENT_INVALID_STATUS",
  settlementNotBalanced: "SETTLEMENT_NOT_BALANCED",
  duplicateRequest: "DUPLICATE_REQUEST"
} as const;

export const ROOM_START_PARAM_PREFIX = "room_";

export function isRoomStartParam(value: string): boolean {
  return (
    value.startsWith(ROOM_START_PARAM_PREFIX) &&
    value.length > ROOM_START_PARAM_PREFIX.length
  );
}

export function getInviteCodeFromStartParam(
  value: string | null | undefined
): string | null {
  if (!value) {
    return null;
  }

  if (!isRoomStartParam(value)) {
    return null;
  }

  return value.slice(ROOM_START_PARAM_PREFIX.length);
}

export function buildRoomStartParam(inviteCode: string): string {
  return `${ROOM_START_PARAM_PREFIX}${inviteCode}`;
}

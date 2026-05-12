import type { RoomDetailsDto, RoomPlayerDto } from "@pokertable/shared";

export type RoomSurface = "waiting" | "active-player" | "active-admin" | "closed" | "other";

export function getRoomSurface(
  room: Pick<RoomDetailsDto, "status" | "myRole">
): RoomSurface {
  if (room.status === "WAITING") {
    return "waiting";
  }

  if (room.status === "RUNNING") {
    return room.myRole === "OWNER" || room.myRole === "ADMIN"
      ? "active-admin"
      : "active-player";
  }

  if (room.status === "CLOSED") {
    return "closed";
  }

  return "other";
}

export function getActivePlayers(players: RoomPlayerDto[]): RoomPlayerDto[] {
  return players.filter((player) => player.status === "ACTIVE");
}

export function getMyPlayer(
  players: RoomPlayerDto[],
  myPlayerId: string
): RoomPlayerDto | null {
  return players.find((player) => player.id === myPlayerId) ?? null;
}

export function canSelfRebuy(
  room: Pick<RoomDetailsDto, "status" | "myPlayerStatus" | "myRole" | "rebuyPermission">
): boolean {
  if (room.status !== "RUNNING" || room.myPlayerStatus !== "ACTIVE") {
    return false;
  }

  if (room.myRole === "OWNER" || room.myRole === "ADMIN") {
    return true;
  }

  return room.rebuyPermission === "PLAYER_SELF";
}

export function getSelfRebuyHint(
  room: Pick<RoomDetailsDto, "myPlayerStatus" | "myRole" | "rebuyPermission">
): string {
  if (room.myPlayerStatus !== "ACTIVE") {
    return "Ребай доступен только игрокам за столом.";
  }

  if (room.myRole === "OWNER" || room.myRole === "ADMIN") {
    return "Подтвердите ребай, и сумма сразу обновится у всех.";
  }

  switch (room.rebuyPermission) {
    case "ADMIN_ONLY":
      return "Сейчас ребай добавляет только админ.";
    case "ADMIN_APPROVAL":
      return "Попросите админа добавить ребай.";
    default:
      return "Подтвердите ребай, и сумма сразу обновится у всех.";
  }
}

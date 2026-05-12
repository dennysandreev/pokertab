import { describe, expect, it } from "vitest";
import type { RoomDetailsDto, RoomPlayerDto } from "@pokertable/shared";
import {
  canSelfRebuy,
  getActivePlayers,
  getMyPlayer,
  getRoomSurface,
  getSelfRebuyHint
} from "./room-view";

describe("room view helpers", () => {
  it("routes waiting rooms to the waiting surface", () => {
    expect(
      getRoomSurface({
        status: "WAITING",
        myRole: "PLAYER"
      } satisfies Pick<RoomDetailsDto, "status" | "myRole">)
    ).toBe("waiting");
  });

  it("routes running admins and owners to the admin surface", () => {
    expect(
      getRoomSurface({
        status: "RUNNING",
        myRole: "OWNER"
      } satisfies Pick<RoomDetailsDto, "status" | "myRole">)
    ).toBe("active-admin");

    expect(
      getRoomSurface({
        status: "RUNNING",
        myRole: "ADMIN"
      } satisfies Pick<RoomDetailsDto, "status" | "myRole">)
    ).toBe("active-admin");
  });

  it("routes running players to the player surface", () => {
    expect(
      getRoomSurface({
        status: "RUNNING",
        myRole: "PLAYER"
      } satisfies Pick<RoomDetailsDto, "status" | "myRole">)
    ).toBe("active-player");
  });

  it("routes closed rooms to the final results surface", () => {
    expect(
      getRoomSurface({
        status: "CLOSED",
        myRole: "PLAYER"
      } satisfies Pick<RoomDetailsDto, "status" | "myRole">)
    ).toBe("closed");
  });

  it("keeps only active players in active room lists", () => {
    const players = [
      createPlayer({ id: "player-1", status: "ACTIVE" }),
      createPlayer({ id: "player-2", status: "LEFT" }),
      createPlayer({ id: "player-3", status: "REMOVED" })
    ];

    expect(getActivePlayers(players).map((player) => player.id)).toEqual(["player-1"]);
  });

  it("finds current player by membership id", () => {
    const players = [createPlayer({ id: "player-1" }), createPlayer({ id: "player-2" })];

    expect(getMyPlayer(players, "player-2")?.id).toBe("player-2");
    expect(getMyPlayer(players, "missing")).toBeNull();
  });

  it("allows self rebuy only when player is active and permission allows it", () => {
    expect(
      canSelfRebuy({
        status: "RUNNING",
        myPlayerStatus: "ACTIVE",
        myRole: "PLAYER",
        rebuyPermission: "PLAYER_SELF"
      })
    ).toBe(true);

    expect(
      canSelfRebuy({
        status: "RUNNING",
        myPlayerStatus: "ACTIVE",
        myRole: "PLAYER",
        rebuyPermission: "ADMIN_ONLY"
      })
    ).toBe(false);
  });

  it("returns a clear hint when player needs admin rebuy help", () => {
    expect(
      getSelfRebuyHint({
        myPlayerStatus: "ACTIVE",
        myRole: "PLAYER",
        rebuyPermission: "ADMIN_APPROVAL"
      })
    ).toBe("Попросите админа добавить ребай.");
  });
});

function createPlayer(overrides: Partial<RoomPlayerDto> = {}): RoomPlayerDto {
  return {
    id: "player-1",
    userId: "user-1",
    displayName: "Денис",
    role: "PLAYER",
    status: "ACTIVE",
    rebuyCount: 0,
    totalBuyinMinor: "0",
    finalAmountMinor: null,
    netResultMinor: null,
    ...overrides
  };
}

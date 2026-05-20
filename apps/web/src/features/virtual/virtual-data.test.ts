import { describe, expect, it } from "vitest";
import {
  createIdleVirtualTablesState,
  getNextVirtualTablesRefreshState
} from "./virtual-data";

describe("virtual data helpers", () => {
  it("keeps ready data during background refresh", () => {
    const current = {
      status: "ready" as const,
      data: {
        items: [
          {
            id: "table-1",
            title: "Ночной стол",
            status: "ACTIVE" as const,
            inviteCode: "AB12CD34",
            maxSeats: 6,
            currentHandId: "hand-1",
            startingStackChips: "2000",
            chipValueMinor: null,
            chipValueCurrency: null,
            smallBlindChips: "10",
            bigBlindChips: "20",
            turnDurationSeconds: 30,
            reminderDelaySeconds: 15,
            timeoutAutoActionRule: "CHECK_OR_FOLD" as const,
            winProbabilityEnabled: false,
            potTotalChips: "40",
            createdAt: "2026-05-14T10:00:00.000Z",
            startedAt: "2026-05-14T10:05:00.000Z",
            pausedAt: null,
            finishedAt: null,
            seatsCount: 4,
            activeSeatsCount: 4,
            mySeatId: "seat-1",
            mySeatStatus: "ACTIVE" as const,
            currentActorSeatId: "seat-2",
            currentStreet: "PRE_FLOP" as const,
            lastHandNumber: 5
          }
        ]
      },
      errorMessage: null
    };

    expect(getNextVirtualTablesRefreshState(current, true)).toEqual(current);
    expect(getNextVirtualTablesRefreshState(current, false)).toEqual({
      status: "loading",
      data: current.data,
      errorMessage: null
    });
  });

  it("starts from idle state without token data", () => {
    expect(createIdleVirtualTablesState()).toEqual({
      status: "idle",
      data: null,
      errorMessage: null
    });
  });
});

import { describe, expect, it, vi } from "vitest";
import type { GetVirtualTableResponseDto } from "@pokertable/shared";
import { ApiRequestError, getVirtualHandHistories } from "@/lib/api";
import {
  fetchVirtualTableHistoryOverlayPage,
  getVirtualReactionErrorMessage,
  getVirtualTableToastSource,
  mergeTableReaction,
  mergeVirtualHandHistoryPages,
  openVirtualHandHistoryDetail,
  scheduleVirtualTableToastDismiss,
  shouldRenderVirtualTableToastOverlay,
  VIRTUAL_TABLE_HISTORY_OVERLAY_PAGE_SIZE,
  VIRTUAL_TABLE_TOAST_DISMISS_MS
} from "./virtual-containers";
import { virtualScreenClassName } from "./virtual-ui";

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");

  return {
    ...actual,
    getVirtualHandHistories: vi.fn()
  };
});

describe("virtual table toast helpers", () => {
  it("uses overlay toast for non-waiting table states only", () => {
    expect(shouldRenderVirtualTableToastOverlay("ACTIVE")).toBe(true);
    expect(shouldRenderVirtualTableToastOverlay("PAUSED")).toBe(true);
    expect(shouldRenderVirtualTableToastOverlay("FINISHED")).toBe(true);
    expect(shouldRenderVirtualTableToastOverlay("WAITING_FOR_PLAYERS")).toBe(false);
    expect(shouldRenderVirtualTableToastOverlay(null)).toBe(false);
  });

  it("prefers feedback message over background table error for overlay toast", () => {
    expect(
      getVirtualTableToastSource({
        feedbackMessage: "Не получилось сделать ход",
        tableErrorMessage: "Не получилось обновить стол",
        tableStatus: "ACTIVE"
      })
    ).toEqual({
      key: "feedback:Не получилось сделать ход",
      message: "Не получилось сделать ход",
      tone: "error"
    });

    expect(
      getVirtualTableToastSource({
        feedbackMessage: null,
        tableErrorMessage: "Не получилось обновить стол",
        tableStatus: "PAUSED"
      })
    ).toEqual({
      key: "table-error:Не получилось обновить стол",
      message: "Не получилось обновить стол",
      tone: "error"
    });

    expect(
      getVirtualTableToastSource({
        feedbackMessage: "Не показывай inline",
        tableErrorMessage: null,
        tableStatus: "WAITING_FOR_PLAYERS"
      })
    ).toBeNull();
  });

  it("dismisses overlay toast after five seconds and cleanup cancels the timer", () => {
    vi.useFakeTimers();

    const onDismiss = vi.fn();
    const cleanup = scheduleVirtualTableToastDismiss(onDismiss);

    vi.advanceTimersByTime(VIRTUAL_TABLE_TOAST_DISMISS_MS - 1);
    expect(onDismiss).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(onDismiss).toHaveBeenCalledTimes(1);

    const nextDismiss = vi.fn();
    const nextCleanup = scheduleVirtualTableToastDismiss(nextDismiss);
    nextCleanup();
    vi.advanceTimersByTime(VIRTUAL_TABLE_TOAST_DISMISS_MS);
    expect(nextDismiss).not.toHaveBeenCalled();

    cleanup();
    vi.useRealTimers();
  });

  it("keeps virtual screen container without duplicated horizontal padding", () => {
    expect(virtualScreenClassName).not.toContain("px-4");
    expect(virtualScreenClassName).toContain("pt-4");
    expect(virtualScreenClassName).toContain("safe-area-inset-bottom");
  });

  it("loads popup history with the latest 10 hands", async () => {
    vi.mocked(getVirtualHandHistories).mockResolvedValueOnce({
      items: [],
      nextCursor: "cursor-1"
    });

    const result = await fetchVirtualTableHistoryOverlayPage("token", "table-1", "cursor-0");

    expect(getVirtualHandHistories).toHaveBeenCalledWith("token", "table-1", {
      cursor: "cursor-0",
      limit: VIRTUAL_TABLE_HISTORY_OVERLAY_PAGE_SIZE
    });
    expect(result.nextCursor).toBe("cursor-1");
  });

  it("appends popup history pages when loading more", () => {
    expect(
      mergeVirtualHandHistoryPages(
        {
          items: [
            {
              id: "hand-2",
              handNumber: 2,
              status: "COMPLETED",
              street: "RIVER",
              potTotalChips: "400",
              board: [],
              startedAt: "2026-05-14T10:00:00.000Z",
              completedAt: "2026-05-14T10:01:00.000Z",
              actionsCount: 5,
              winners: []
            }
          ],
          nextCursor: "cursor-1"
        },
        {
          items: [
            {
              id: "hand-1",
              handNumber: 1,
              status: "COMPLETED",
              street: "TURN",
              potTotalChips: "250",
              board: [],
              startedAt: "2026-05-14T09:58:00.000Z",
              completedAt: "2026-05-14T09:59:00.000Z",
              actionsCount: 4,
              winners: []
            }
          ],
          nextCursor: null
        },
        "cursor-1"
      )
    ).toEqual({
      items: [
        expect.objectContaining({ id: "hand-2" }),
        expect.objectContaining({ id: "hand-1" })
      ],
      nextCursor: null
    });
  });

  it("opens popup history details with the existing hand route", () => {
    const navigate = vi.fn();

    openVirtualHandHistoryDetail(navigate as never, "table-1", "hand-9");

    expect(navigate).toHaveBeenCalledWith("/poker/tables/table-1/hands/hand-9");
  });

  it("uses rate-limit copy for reaction throttling and keeps API message otherwise", () => {
    expect(
      getVirtualReactionErrorMessage(
        new ApiRequestError("Slow down", 429, "RATE_LIMITED")
      )
    ).toBe("Слишком часто. Попробуйте через пару секунд.");

    expect(
      getVirtualReactionErrorMessage(
        new ApiRequestError("Стол скоро откроется", 409, "TABLE_LOCKED")
      )
    ).toBe("Стол скоро откроется");
  });

  it("merges a freshly posted reaction without duplicating existing ids", () => {
    const table: GetVirtualTableResponseDto = {
      table: {
        id: "table-1",
        title: "Ночной стол",
        status: "ACTIVE",
        maxSeats: 6,
        inviteCode: "AB12CD34",
        startingStackChips: "5000",
        chipValueMinor: "1",
        chipValueCurrency: "RUB",
        smallBlindChips: "50",
        bigBlindChips: "100",
        pendingSmallBlindChips: null,
        pendingBigBlindChips: null,
        turnDurationSeconds: 30,
        reminderDelaySeconds: 10,
        timeoutAutoActionRule: "CHECK_OR_FOLD",
        winProbabilityEnabled: false,
        potTotalChips: "900",
        currentHandId: "hand-1",
        createdAt: "2026-05-14T10:00:00.000Z",
        startedAt: "2026-05-14T10:05:00.000Z",
        pausedAt: null,
        finishedAt: null
      },
      seats: [],
      reactions: [
        {
          id: "reaction-1",
          tableId: "table-1",
          seatId: "seat-1",
          userId: "user-1",
          displayName: "Denis Andreev",
          emoji: "🔥",
          createdAt: "2026-05-19T10:00:00.000Z"
        }
      ]
    };

    expect(
      mergeTableReaction(table, {
        id: "reaction-2",
        tableId: "table-1",
        seatId: "seat-2",
        userId: "user-2",
        displayName: "Alex Blue",
        emoji: "😂",
        createdAt: "2026-05-19T10:00:02.000Z"
      }).reactions
    ).toHaveLength(2);

    expect(
      mergeTableReaction(table, {
        id: "reaction-1",
        tableId: "table-1",
        seatId: "seat-1",
        userId: "user-1",
        displayName: "Denis Andreev",
        emoji: "🔥",
        createdAt: "2026-05-19T10:00:00.000Z"
      }).reactions
    ).toHaveLength(1);
  });
});

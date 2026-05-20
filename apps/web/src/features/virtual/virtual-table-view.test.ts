import { afterEach, describe, expect, it, vi } from "vitest";
import type { VirtualLegalActionDto, VirtualSeatRole } from "@pokertable/shared";
import {
  formatTimerRemaining,
  getNewReactionAnimations,
  getActionControlsModel,
  getStoredVirtualReactionsVisibility,
  setStoredVirtualReactionsVisibility,
  getVisibleAdminActions,
  parseVirtualCard
} from "./virtual-table-view";

describe("virtual table helpers", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("maps legal actions into Russian controls and sizing presets", () => {
    const legalActions: VirtualLegalActionDto[] = [
      { type: "FOLD" },
      { type: "CALL", amountChips: "120" },
      { type: "RAISE", minAmountChips: "240", maxAmountChips: "1200" },
      { type: "ALL_IN", amountChips: "980" }
    ];

    const model = getActionControlsModel(legalActions, "600", "1200");

    expect(model.foldButton).toEqual({
      id: "FOLD",
      actionType: "FOLD",
      label: "Пас",
      tone: "ghost"
    });
    expect(model.primaryButton).toEqual({
      id: "CALL",
      actionType: "CALL",
      label: "Колл",
      amountChips: "120",
      tone: "accent"
    });
    expect(model.raiseButton).toEqual({
      id: "RAISE",
      actionType: "RAISE",
      label: "Повысить",
      amountChips: "240",
      tone: "neutral"
    });
    expect(model.secondaryButton).toEqual({
      id: "ALL_IN",
      actionType: "ALL_IN",
      label: "Ва-банк",
      amountChips: "980",
      tone: "neutral"
    });
    expect(model.sizingControl).toEqual({
      actionType: "RAISE",
      label: "Повысить",
      minAmountChips: "240",
      maxAmountChips: "1200",
      initialAmountChips: "240",
      presets: [
        { label: "Мин", amountChips: "240" },
        { label: "1/4 стека", amountChips: "300" },
        { label: "1/2 стека", amountChips: "600" },
        { label: "Ва-банк", amountChips: "1200" }
      ]
    });
  });

  it("keeps check primary and bet in the raise slot when both are legal", () => {
    const model = getActionControlsModel(
      [
        { type: "FOLD" },
        { type: "CHECK" },
        { type: "BET", minAmountChips: "80", maxAmountChips: "400" }
      ],
      "200",
      "1000"
    );

    expect(model.primaryButton).toEqual({
      id: "CHECK",
      actionType: "CHECK",
      label: "Чек",
      tone: "neutral"
    });
    expect(model.raiseButton).toEqual({
      id: "BET",
      actionType: "BET",
      label: "Поставить",
      amountChips: "80",
      tone: "neutral"
    });
    expect(model.sizingControl?.presets).toEqual([
      { label: "Мин", amountChips: "80" },
      { label: "1/4 стека", amountChips: "250" },
      { label: "1/2 стека", amountChips: "400" },
      { label: "Ва-банк", amountChips: "400" }
    ]);
  });

  it("hides all-in pill when all-in is not a legal action", () => {
    const model = getActionControlsModel(
      [
        { type: "FOLD" },
        { type: "CHECK" },
        { type: "RAISE", minAmountChips: "300", maxAmountChips: "1500" }
      ],
      "600"
    );

    expect(model.secondaryButton).toBeNull();
  });

  it("parses backend card codes into render labels", () => {
    expect(parseVirtualCard("AS")).toMatchObject({
      rank: "A",
      suit: "S",
      suitSymbol: "♠",
      suitLabel: "Пики",
      tone: "dark"
    });
    expect(parseVirtualCard("Td")).toMatchObject({
      rank: "10",
      suit: "D",
      suitSymbol: "♦",
      suitLabel: "Бубны",
      tone: "red"
    });
    expect(parseVirtualCard("bad")).toBeNull();
  });

  it("formats remaining timer with floor at zero", () => {
    const now = Date.parse("2026-05-14T10:00:00.000Z");

    expect(formatTimerRemaining("2026-05-14T10:01:05.000Z", now)).toBe("01:05");
    expect(formatTimerRemaining("2026-05-14T10:00:00.100Z", now)).toBe("00:01");
    expect(formatTimerRemaining("2026-05-14T09:59:58.000Z", now)).toBe("00:00");
  });

  it("shows admin actions only when backend supports them for current state", () => {
    expect(
      getVisibleAdminActions({
        myRole: "PLAYER",
        tableStatus: "ACTIVE",
        currentHandId: "hand-1",
        handStatus: "IN_PROGRESS"
      })
    ).toEqual([]);

    expect(
      getVisibleAdminActions({
        myRole: "OWNER" satisfies VirtualSeatRole,
        tableStatus: "ACTIVE",
        currentHandId: "hand-1",
        handStatus: "COMPLETED"
      })
    ).toEqual(["pause", "raise-blinds", "finish", "next-hand"]);

    expect(
      getVisibleAdminActions({
        myRole: "ADMIN" satisfies VirtualSeatRole,
        tableStatus: "WAITING_FOR_PLAYERS",
        currentHandId: null
      })
    ).toEqual(["finish", "cancel"]);

    expect(
      getVisibleAdminActions({
        myRole: "ADMIN" satisfies VirtualSeatRole,
        tableStatus: "PAUSED",
        currentHandId: "hand-2",
        handStatus: "IN_PROGRESS"
      })
    ).toEqual(["resume", "raise-blinds", "finish"]);
  });

  it("animates only unseen reactions and skips optimistic echo for the sender", () => {
    const firstPass = getNewReactionAnimations({
      reactions: [
        {
          id: "reaction-1",
          seatId: "seat-2",
          userId: "user-2",
          displayName: "Alex Blue",
          emoji: "🔥"
        },
        {
          id: "reaction-2",
          seatId: "seat-1",
          userId: "user-1",
          displayName: "Denis Andreev",
          emoji: "😂"
        }
      ],
      seenReactionIds: [],
      optimisticReactions: [
        {
          seatId: "seat-1",
          userId: "user-1",
          emoji: "😂",
          submittedAt: 1000
        }
      ],
      currentUserId: "user-1",
      now: 1500
    });

    expect(firstPass.animations).toEqual([
      expect.objectContaining({
        reactionId: "reaction-1",
        seatId: "seat-2",
        emoji: "🔥"
      })
    ]);
    expect([...firstPass.nextSeenReactionIds]).toEqual(["reaction-1", "reaction-2"]);
    expect(firstPass.remainingOptimisticReactions).toEqual([]);

    const secondPass = getNewReactionAnimations({
      reactions: [
        {
          id: "reaction-1",
          seatId: "seat-2",
          userId: "user-2",
          displayName: "Alex Blue",
          emoji: "🔥"
        }
      ],
      seenReactionIds: firstPass.nextSeenReactionIds,
      currentUserId: "user-1",
      now: 2000
    });

    expect(secondPass.animations).toEqual([]);
  });

  it("persists reactions visibility in localStorage and defaults to visible", () => {
    const storage = new Map<string, string>();

    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => {
          storage.set(key, value);
        }
      }
    });

    expect(getStoredVirtualReactionsVisibility()).toBe(true);

    setStoredVirtualReactionsVisibility(false);
    expect(getStoredVirtualReactionsVisibility()).toBe(false);

    setStoredVirtualReactionsVisibility(true);
    expect(getStoredVirtualReactionsVisibility()).toBe(true);
  });
});

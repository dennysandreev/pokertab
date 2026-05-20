import { describe, expect, it } from "vitest";
import type { RoomPlayerDto } from "@pokertable/shared";
import {
  buildSettlementPreviewPayload,
  getInitialFinalAmountInput,
  getSettlementDifferenceMessage,
  getSettlementDraftKey,
  getSettlementDraftPlayers,
  getSettlementDraftSummary
} from "./settlement-view";

describe("settlement view helpers", () => {
  it("builds settlement draft from active and left players, excluding removed", () => {
    const players = [
      createPlayer({ id: "player-1", totalBuyinChips: "3000" }),
      createPlayer({ id: "player-2", status: "LEFT", totalBuyinChips: "2000", finalAmountChips: "1400" }),
      createPlayer({ id: "player-3", status: "REMOVED", totalBuyinChips: "1000", finalAmountChips: "1000" })
    ];

    const draftPlayers = getSettlementDraftPlayers(players, {
      "player-1": "4500"
    });

    expect(draftPlayers).toEqual([
      expect.objectContaining({
        roomPlayerId: "player-1",
        status: "ACTIVE",
        finalAmountChips: "4500",
        netResultChips: "1500",
        issue: null
      }),
      expect.objectContaining({
        roomPlayerId: "player-2",
        status: "LEFT",
        finalAmountInput: "1400",
        finalAmountChips: "1400",
        netResultChips: "-600",
        issue: null
      })
    ]);
  });

  it("calculates totals and difference with integer chip values", () => {
    const draftPlayers = getSettlementDraftPlayers(
      [
        createPlayer({ id: "player-1", totalBuyinChips: "3000" }),
        createPlayer({ id: "player-2", totalBuyinChips: "2000" })
      ],
      {
        "player-1": "4500",
        "player-2": "500"
      }
    );

    expect(getSettlementDraftSummary(draftPlayers)).toEqual({
      totalBuyinsChips: "5000",
      totalFinalAmountChips: "5000",
      differenceChips: "0",
      hasMissingValues: false,
      hasInvalidValues: false,
      isBalanced: true
    });
  });

  it("marks missing, invalid, and negative values as incomplete", () => {
    const draftPlayers = getSettlementDraftPlayers(
      [
        createPlayer({ id: "player-1" }),
        createPlayer({ id: "player-2" }),
        createPlayer({ id: "player-3" })
      ],
      {
        "player-1": "",
        "player-2": "10.999",
        "player-3": "-10"
      }
    );

    expect(draftPlayers.map((player) => player.issue)).toEqual(["missing", "invalid", "negative"]);
    expect(buildSettlementPreviewPayload(draftPlayers)).toBeNull();
    expect(getSettlementDraftKey(draftPlayers)).toBeNull();
  });

  it("includes buyins and final amounts in the current preview key", () => {
    const draftPlayers = getSettlementDraftPlayers(
      [
        createPlayer({ id: "player-1", totalBuyinChips: "3000" }),
        createPlayer({ id: "player-2", totalBuyinChips: "2000" })
      ],
      {
        "player-1": "4500",
        "player-2": "500"
      }
    );

    expect(buildSettlementPreviewPayload(draftPlayers)).toEqual({
      finalAmounts: [
        {
          roomPlayerId: "player-1",
          finalAmountChips: "4500"
        },
        {
          roomPlayerId: "player-2",
          finalAmountChips: "500"
        }
      ]
    });
    expect(getSettlementDraftKey(draftPlayers)).toBe("player-1:3000:4500|player-2:2000:500");
  });

  it("formats difference messages and prefilled inputs for chip fields", () => {
    expect(getSettlementDifferenceMessage("1000")).toBe(
      "Финальных фишек получилось больше на 1 000 фишек. Проверьте ввод."
    );
    expect(getSettlementDifferenceMessage("-250")).toBe(
      "Финальных фишек пока меньше на 250 фишек. Проверьте ввод."
    );
    expect(getInitialFinalAmountInput("7500")).toBe("7500");
  });
});

function createPlayer(
  overrides: Partial<RoomPlayerDto & { totalBuyinChips?: string; finalAmountChips?: string | null }> = {}
): RoomPlayerDto {
  return {
    id: "player-1",
    userId: "user-1",
    displayName: "Денис",
    role: "PLAYER",
    status: "ACTIVE",
    rebuyCount: 0,
    totalBuyinChips: "1000",
    finalAmountChips: null,
    netResultChips: null,
    ...overrides
  };
}

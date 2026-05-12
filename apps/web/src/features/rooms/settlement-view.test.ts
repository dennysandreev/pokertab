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
  it("builds settlement draft only from active players", () => {
    const players = [
      createPlayer({ id: "player-1", totalBuyinMinor: "300000" }),
      createPlayer({ id: "player-2", status: "LEFT", totalBuyinMinor: "200000" })
    ];

    const draftPlayers = getSettlementDraftPlayers(players, {
      "player-1": "4500"
    });

    expect(draftPlayers).toEqual([
      expect.objectContaining({
        roomPlayerId: "player-1",
        finalAmountMinor: "450000",
        netResultMinor: "150000",
        issue: null
      })
    ]);
  });

  it("calculates totals and difference with integer minor units", () => {
    const draftPlayers = getSettlementDraftPlayers(
      [
        createPlayer({ id: "player-1", totalBuyinMinor: "300000" }),
        createPlayer({ id: "player-2", totalBuyinMinor: "200000" })
      ],
      {
        "player-1": "4500,50",
        "player-2": "499,50"
      }
    );

    expect(getSettlementDraftSummary(draftPlayers)).toEqual({
      totalBuyinsMinor: "500000",
      totalFinalAmountMinor: "500000",
      differenceMinor: "0",
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
        createPlayer({ id: "player-1", totalBuyinMinor: "300000" }),
        createPlayer({ id: "player-2", totalBuyinMinor: "200000" })
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
          finalAmountMinor: "450000"
        },
        {
          roomPlayerId: "player-2",
          finalAmountMinor: "50000"
        }
      ]
    });
    expect(getSettlementDraftKey(draftPlayers)).toBe("player-1:300000:450000|player-2:200000:50000");
  });

  it("formats difference messages and prefilled inputs for Russian money fields", () => {
    expect(getSettlementDifferenceMessage("1000", "RUB")).toBe(
      "Финальных сумм получилось больше на 10 ₽. Проверьте ввод."
    );
    expect(getSettlementDifferenceMessage("-250", "RUB")).toBe(
      "Финальных сумм пока меньше на 2,50 ₽. Проверьте ввод."
    );
    expect(getInitialFinalAmountInput("750050")).toBe("7500,50");
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
    totalBuyinMinor: "100000",
    finalAmountMinor: null,
    netResultMinor: null,
    ...overrides
  };
}

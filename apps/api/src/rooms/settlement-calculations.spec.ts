import {
  calculatePlayerNetResults,
  calculateTransfers,
  validateSettlementBalance
} from "./settlement-calculations";

describe("settlement calculations", () => {
  it("calculates balanced simple case", () => {
    const players = calculatePlayerNetResults([
      {
        roomPlayerId: "player-a",
        displayName: "A",
        totalBuyinMinor: 1000n,
        finalAmountMinor: 2000n
      },
      {
        roomPlayerId: "player-b",
        displayName: "B",
        totalBuyinMinor: 1000n,
        finalAmountMinor: 0n
      }
    ]);

    expect(players).toEqual([
      expect.objectContaining({
        roomPlayerId: "player-a",
        netResultMinor: 1000n
      }),
      expect.objectContaining({
        roomPlayerId: "player-b",
        netResultMinor: -1000n
      })
    ]);
    expect(validateSettlementBalance(players)).toEqual({
      totalBuyinsMinor: 2000n,
      totalFinalAmountMinor: 2000n,
      differenceMinor: 0n,
      isBalanced: true
    });
    expect(calculateTransfers(players)).toEqual([
      {
        fromRoomPlayerId: "player-b",
        toRoomPlayerId: "player-a",
        amountMinor: 1000n
      }
    ]);
  });

  it("matches multiple debtors and creditors in deterministic order", () => {
    const players = [
      {
        roomPlayerId: "player-a",
        netResultMinor: 2500n
      },
      {
        roomPlayerId: "player-b",
        netResultMinor: 500n
      },
      {
        roomPlayerId: "player-c",
        netResultMinor: -2000n
      },
      {
        roomPlayerId: "player-d",
        netResultMinor: -1000n
      }
    ];

    expect(calculateTransfers(players)).toEqual([
      {
        fromRoomPlayerId: "player-c",
        toRoomPlayerId: "player-a",
        amountMinor: 2000n
      },
      {
        fromRoomPlayerId: "player-d",
        toRoomPlayerId: "player-a",
        amountMinor: 500n
      },
      {
        fromRoomPlayerId: "player-d",
        toRoomPlayerId: "player-b",
        amountMinor: 500n
      }
    ]);
  });

  it("ignores zero-result players in transfers", () => {
    expect(
      calculateTransfers([
        {
          roomPlayerId: "player-a",
          netResultMinor: 1000n
        },
        {
          roomPlayerId: "player-b",
          netResultMinor: -1000n
        },
        {
          roomPlayerId: "player-c",
          netResultMinor: 0n
        }
      ])
    ).toEqual([
      {
        fromRoomPlayerId: "player-b",
        toRoomPlayerId: "player-a",
        amountMinor: 1000n
      }
    ]);
  });

  it("reports unbalanced settlement difference", () => {
    const result = validateSettlementBalance([
      {
        totalBuyinMinor: 1000n,
        finalAmountMinor: 1500n
      },
      {
        totalBuyinMinor: 1000n,
        finalAmountMinor: 400n
      }
    ]);

    expect(result).toEqual({
      totalBuyinsMinor: 2000n,
      totalFinalAmountMinor: 1900n,
      differenceMinor: -100n,
      isBalanced: false
    });
  });

  it("rejects negative final amounts", () => {
    expect(() =>
      calculatePlayerNetResults([
        {
          roomPlayerId: "player-a",
          displayName: "A",
          totalBuyinMinor: 1000n,
          finalAmountMinor: -1n
        }
      ])
    ).toThrow("Финальная сумма не может быть отрицательной");
  });
});

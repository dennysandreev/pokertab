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
        totalBuyinChips: 1000n,
        finalAmountChips: 2000n
      },
      {
        roomPlayerId: "player-b",
        displayName: "B",
        totalBuyinChips: 1000n,
        finalAmountChips: 0n
      }
    ]);

    expect(players).toEqual([
      expect.objectContaining({
        roomPlayerId: "player-a",
        netResultChips: 1000n
      }),
      expect.objectContaining({
        roomPlayerId: "player-b",
        netResultChips: -1000n
      })
    ]);
    expect(validateSettlementBalance(players)).toEqual({
      totalBuyinsChips: 2000n,
      totalFinalAmountChips: 2000n,
      differenceChips: 0n,
      isBalanced: true
    });
    expect(calculateTransfers(players)).toEqual([
      {
        fromRoomPlayerId: "player-b",
        toRoomPlayerId: "player-a",
        amountChips: 1000n
      }
    ]);
  });

  it("matches multiple debtors and creditors in deterministic order", () => {
    const players = [
      {
        roomPlayerId: "player-a",
        netResultChips: 2500n
      },
      {
        roomPlayerId: "player-b",
        netResultChips: 500n
      },
      {
        roomPlayerId: "player-c",
        netResultChips: -2000n
      },
      {
        roomPlayerId: "player-d",
        netResultChips: -1000n
      }
    ];

    expect(calculateTransfers(players)).toEqual([
      {
        fromRoomPlayerId: "player-c",
        toRoomPlayerId: "player-a",
        amountChips: 2000n
      },
      {
        fromRoomPlayerId: "player-d",
        toRoomPlayerId: "player-a",
        amountChips: 500n
      },
      {
        fromRoomPlayerId: "player-d",
        toRoomPlayerId: "player-b",
        amountChips: 500n
      }
    ]);
  });

  it("ignores zero-result players in transfers", () => {
    expect(
      calculateTransfers([
        {
          roomPlayerId: "player-a",
          netResultChips: 1000n
        },
        {
          roomPlayerId: "player-b",
          netResultChips: -1000n
        },
        {
          roomPlayerId: "player-c",
          netResultChips: 0n
        }
      ])
    ).toEqual([
      {
        fromRoomPlayerId: "player-b",
        toRoomPlayerId: "player-a",
        amountChips: 1000n
      }
    ]);
  });

  it("reports unbalanced settlement difference", () => {
    const result = validateSettlementBalance([
      {
        totalBuyinChips: 1000n,
        finalAmountChips: 1500n
      },
      {
        totalBuyinChips: 1000n,
        finalAmountChips: 400n
      }
    ]);

    expect(result).toEqual({
      totalBuyinsChips: 2000n,
      totalFinalAmountChips: 1900n,
      differenceChips: -100n,
      isBalanced: false
    });
  });

  it("rejects negative final amounts", () => {
    expect(() =>
      calculatePlayerNetResults([
        {
          roomPlayerId: "player-a",
          displayName: "A",
          totalBuyinChips: 1000n,
          finalAmountChips: -1n
        }
      ])
    ).toThrow("Финальная сумма не может быть отрицательной");
  });
});

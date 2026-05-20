export type SettlementPlayerInput = {
  roomPlayerId: string;
  displayName: string;
  totalBuyinChips: bigint;
  finalAmountChips: bigint;
};

export type SettlementPlayerNetResult = SettlementPlayerInput & {
  netResultChips: bigint;
};

export type SettlementBalanceValidationResult = {
  totalBuyinsChips: bigint;
  totalFinalAmountChips: bigint;
  differenceChips: bigint;
  isBalanced: boolean;
};

export type SettlementTransferCalculation = {
  fromRoomPlayerId: string;
  toRoomPlayerId: string;
  amountChips: bigint;
};

export function calculatePlayerNetResults(
  players: SettlementPlayerInput[]
): SettlementPlayerNetResult[] {
  return players.map((player) => {
    assertNonNegativeChips(player.totalBuyinChips, "Сумма закупов не может быть отрицательной");
    assertNonNegativeChips(
      player.finalAmountChips,
      "Финальная сумма не может быть отрицательной"
    );

    return {
      ...player,
      netResultChips: player.finalAmountChips - player.totalBuyinChips
    };
  });
}

export function validateSettlementBalance(
  players: Pick<SettlementPlayerNetResult, "totalBuyinChips" | "finalAmountChips">[]
): SettlementBalanceValidationResult {
  let totalBuyinsChips = 0n;
  let totalFinalAmountChips = 0n;

  for (const player of players) {
    totalBuyinsChips += player.totalBuyinChips;
    totalFinalAmountChips += player.finalAmountChips;
  }

  const differenceChips = totalFinalAmountChips - totalBuyinsChips;

  return {
    totalBuyinsChips,
    totalFinalAmountChips,
    differenceChips,
    isBalanced: differenceChips === 0n
  };
}

export function calculateTransfers(
  players: Pick<SettlementPlayerNetResult, "roomPlayerId" | "netResultChips">[]
): SettlementTransferCalculation[] {
  const totalNetChips = players.reduce(
    (sum, player) => sum + player.netResultChips,
    0n
  );

  if (totalNetChips !== 0n) {
    throw new RangeError("Settlement is not balanced");
  }

  const creditors = players
    .filter((player) => player.netResultChips > 0n)
    .map((player) => ({
      roomPlayerId: player.roomPlayerId,
      remainingChips: player.netResultChips
    }))
    .sort(compareRemainingDesc);

  const debtors = players
    .filter((player) => player.netResultChips < 0n)
    .map((player) => ({
      roomPlayerId: player.roomPlayerId,
      remainingChips: player.netResultChips * -1n
    }))
    .sort(compareRemainingDesc);

  const transfers: SettlementTransferCalculation[] = [];
  let debtorIndex = 0;
  let creditorIndex = 0;

  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const debtor = debtors[debtorIndex];
    const creditor = creditors[creditorIndex];

    if (!debtor || !creditor) {
      break;
    }

    const amountChips =
      debtor.remainingChips < creditor.remainingChips
        ? debtor.remainingChips
        : creditor.remainingChips;

    if (amountChips > 0n) {
      transfers.push({
        fromRoomPlayerId: debtor.roomPlayerId,
        toRoomPlayerId: creditor.roomPlayerId,
        amountChips
      });
    }

    debtor.remainingChips -= amountChips;
    creditor.remainingChips -= amountChips;

    if (debtor.remainingChips === 0n) {
      debtorIndex += 1;
    }

    if (creditor.remainingChips === 0n) {
      creditorIndex += 1;
    }
  }

  return transfers;
}

function assertNonNegativeChips(value: bigint, message: string): void {
  if (value < 0n) {
    throw new RangeError(message);
  }
}

function compareRemainingDesc(
  left: { roomPlayerId: string; remainingChips: bigint },
  right: { roomPlayerId: string; remainingChips: bigint }
): number {
  if (left.remainingChips === right.remainingChips) {
    return left.roomPlayerId.localeCompare(right.roomPlayerId);
  }

  return left.remainingChips > right.remainingChips ? -1 : 1;
}

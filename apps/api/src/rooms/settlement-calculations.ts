export type SettlementPlayerInput = {
  roomPlayerId: string;
  displayName: string;
  totalBuyinMinor: bigint;
  finalAmountMinor: bigint;
};

export type SettlementPlayerNetResult = SettlementPlayerInput & {
  netResultMinor: bigint;
};

export type SettlementBalanceValidationResult = {
  totalBuyinsMinor: bigint;
  totalFinalAmountMinor: bigint;
  differenceMinor: bigint;
  isBalanced: boolean;
};

export type SettlementTransferCalculation = {
  fromRoomPlayerId: string;
  toRoomPlayerId: string;
  amountMinor: bigint;
};

export function calculatePlayerNetResults(
  players: SettlementPlayerInput[]
): SettlementPlayerNetResult[] {
  return players.map((player) => {
    assertNonNegativeMoney(player.totalBuyinMinor, "Сумма закупов не может быть отрицательной");
    assertNonNegativeMoney(
      player.finalAmountMinor,
      "Финальная сумма не может быть отрицательной"
    );

    return {
      ...player,
      netResultMinor: player.finalAmountMinor - player.totalBuyinMinor
    };
  });
}

export function validateSettlementBalance(
  players: Pick<SettlementPlayerNetResult, "totalBuyinMinor" | "finalAmountMinor">[]
): SettlementBalanceValidationResult {
  let totalBuyinsMinor = 0n;
  let totalFinalAmountMinor = 0n;

  for (const player of players) {
    totalBuyinsMinor += player.totalBuyinMinor;
    totalFinalAmountMinor += player.finalAmountMinor;
  }

  const differenceMinor = totalFinalAmountMinor - totalBuyinsMinor;

  return {
    totalBuyinsMinor,
    totalFinalAmountMinor,
    differenceMinor,
    isBalanced: differenceMinor === 0n
  };
}

export function calculateTransfers(
  players: Pick<SettlementPlayerNetResult, "roomPlayerId" | "netResultMinor">[]
): SettlementTransferCalculation[] {
  const totalNetMinor = players.reduce(
    (sum, player) => sum + player.netResultMinor,
    0n
  );

  if (totalNetMinor !== 0n) {
    throw new RangeError("Settlement is not balanced");
  }

  const creditors = players
    .filter((player) => player.netResultMinor > 0n)
    .map((player) => ({
      roomPlayerId: player.roomPlayerId,
      remainingMinor: player.netResultMinor
    }))
    .sort(compareRemainingDesc);

  const debtors = players
    .filter((player) => player.netResultMinor < 0n)
    .map((player) => ({
      roomPlayerId: player.roomPlayerId,
      remainingMinor: player.netResultMinor * -1n
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

    const amountMinor =
      debtor.remainingMinor < creditor.remainingMinor
        ? debtor.remainingMinor
        : creditor.remainingMinor;

    if (amountMinor > 0n) {
      transfers.push({
        fromRoomPlayerId: debtor.roomPlayerId,
        toRoomPlayerId: creditor.roomPlayerId,
        amountMinor
      });
    }

    debtor.remainingMinor -= amountMinor;
    creditor.remainingMinor -= amountMinor;

    if (debtor.remainingMinor === 0n) {
      debtorIndex += 1;
    }

    if (creditor.remainingMinor === 0n) {
      creditorIndex += 1;
    }
  }

  return transfers;
}

function assertNonNegativeMoney(value: bigint, message: string): void {
  if (value < 0n) {
    throw new RangeError(message);
  }
}

function compareRemainingDesc(
  left: { roomPlayerId: string; remainingMinor: bigint },
  right: { roomPlayerId: string; remainingMinor: bigint }
): number {
  if (left.remainingMinor === right.remainingMinor) {
    return left.roomPlayerId.localeCompare(right.roomPlayerId);
  }

  return left.remainingMinor > right.remainingMinor ? -1 : 1;
}

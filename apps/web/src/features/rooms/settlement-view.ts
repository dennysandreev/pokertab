import type { RoomPlayerDto } from "@pokertable/shared";
import { getSettlementPlayers } from "./room-view";

export type SettlementInputIssue = "missing" | "invalid" | "negative";

export type SettlementDraftPlayer = {
  roomPlayerId: string;
  displayName: string;
  status: RoomPlayerDto["status"];
  totalBuyinChips: string;
  finalAmountInput: string;
  finalAmountChips: string | null;
  netResultChips: string | null;
  issue: SettlementInputIssue | null;
};

export type SettlementDraftSummary = {
  totalBuyinsChips: string;
  totalFinalAmountChips: string;
  differenceChips: string;
  hasMissingValues: boolean;
  hasInvalidValues: boolean;
  isBalanced: boolean;
};

export type SettlementPreviewPayload = {
  finalAmounts: Array<{
    roomPlayerId: string;
    finalAmountChips: string;
  }>;
};

export function getSettlementDraftPlayers(
  players: RoomPlayerDto[],
  values: Record<string, string>
): SettlementDraftPlayer[] {
  return getSettlementPlayers(players).map((player) => {
    const totalBuyinChips = getPlayerTotalBuyinChips(player);
    const finalAmountInput = values[player.id] ?? getInitialFinalAmountInput(getPlayerFinalAmountChips(player));
    const parsedInput = parseSettlementInput(finalAmountInput);
    const netResultChips =
      parsedInput.finalAmountChips === null
        ? null
        : (BigInt(parsedInput.finalAmountChips) - BigInt(totalBuyinChips)).toString();

    return {
      roomPlayerId: player.id,
      displayName: player.displayName,
      status: player.status,
      totalBuyinChips,
      finalAmountInput,
      finalAmountChips: parsedInput.finalAmountChips,
      netResultChips,
      issue: parsedInput.issue
    };
  });
}

export function getSettlementDraftSummary(
  players: SettlementDraftPlayer[]
): SettlementDraftSummary {
  let totalBuyinsChips = 0n;
  let totalFinalAmountChips = 0n;
  let hasMissingValues = false;
  let hasInvalidValues = false;

  for (const player of players) {
    totalBuyinsChips += BigInt(player.totalBuyinChips);

    if (player.finalAmountChips !== null) {
      totalFinalAmountChips += BigInt(player.finalAmountChips);
    }

    if (player.issue === "missing") {
      hasMissingValues = true;
    }

    if (player.issue === "invalid" || player.issue === "negative") {
      hasInvalidValues = true;
    }
  }

  const differenceChips = (totalFinalAmountChips - totalBuyinsChips).toString();

  return {
    totalBuyinsChips: totalBuyinsChips.toString(),
    totalFinalAmountChips: totalFinalAmountChips.toString(),
    differenceChips,
    hasMissingValues,
    hasInvalidValues,
    isBalanced: differenceChips === "0"
  };
}

export function buildSettlementPreviewPayload(
  players: SettlementDraftPlayer[]
): SettlementPreviewPayload | null {
  if (players.length === 0) {
    return null;
  }

  const finalAmounts: SettlementPreviewPayload["finalAmounts"] = [];

  for (const player of players) {
    if (player.finalAmountChips === null) {
      return null;
    }

    finalAmounts.push({
      roomPlayerId: player.roomPlayerId,
      finalAmountChips: player.finalAmountChips
    });
  }

  return {
    finalAmounts
  };
}

export function getSettlementDraftKey(players: SettlementDraftPlayer[]): string | null {
  const payload = buildSettlementPreviewPayload(players);

  if (!payload) {
    return null;
  }

  return players
    .map((player) => `${player.roomPlayerId}:${player.totalBuyinChips}:${player.finalAmountChips}`)
    .join("|");
}

export function getSettlementDifferenceMessage(
  differenceChips: string
): string | null {
  const difference = BigInt(differenceChips);

  if (difference === 0n) {
    return null;
  }

  const amountText = formatChipAmount(difference < 0n ? difference * -1n : difference);

  if (difference > 0n) {
    return `Финальных фишек получилось больше на ${amountText}. Проверьте ввод.`;
  }

  return `Финальных фишек пока меньше на ${amountText}. Проверьте ввод.`;
}

export function getInitialFinalAmountInput(value: string | null): string {
  return value ?? "";
}

function parseSettlementInput(value: string): {
  finalAmountChips: string | null;
  issue: SettlementInputIssue | null;
} {
  const trimmed = value.trim();

  if (trimmed.length === 0) {
    return {
      finalAmountChips: null,
      issue: "missing"
    };
  }

  if (!/^-?\d+$/.test(trimmed)) {
    return {
      finalAmountChips: null,
      issue: "invalid"
    };
  }

  if (trimmed.startsWith("-")) {
    return {
      finalAmountChips: null,
      issue: "negative"
    };
  }

  return {
    finalAmountChips: trimmed,
    issue: null
  };
}

function getPlayerTotalBuyinChips(player: RoomPlayerDto): string {
  return player.totalBuyinChips;
}

function getPlayerFinalAmountChips(player: RoomPlayerDto): string | null {
  return player.finalAmountChips;
}

function formatChipAmount(value: bigint): string {
  return `${new Intl.NumberFormat("ru-RU").format(Number(value)).replace(/\u00A0/g, " ")} фишек`;
}

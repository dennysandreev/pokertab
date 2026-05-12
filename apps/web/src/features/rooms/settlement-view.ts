import type { RoomPlayerDto, SettlementPreviewRequestDto } from "@pokertable/shared";
import { formatMinorMoney, parseMajorMoneyToMinor } from "@pokertable/shared";
import { getActivePlayers } from "./room-view";

export type SettlementInputIssue = "missing" | "invalid" | "negative";

export type SettlementDraftPlayer = {
  roomPlayerId: string;
  displayName: string;
  totalBuyinMinor: string;
  finalAmountInput: string;
  finalAmountMinor: string | null;
  netResultMinor: string | null;
  issue: SettlementInputIssue | null;
};

export type SettlementDraftSummary = {
  totalBuyinsMinor: string;
  totalFinalAmountMinor: string;
  differenceMinor: string;
  hasMissingValues: boolean;
  hasInvalidValues: boolean;
  isBalanced: boolean;
};

export function getSettlementDraftPlayers(
  players: RoomPlayerDto[],
  values: Record<string, string>
): SettlementDraftPlayer[] {
  return getActivePlayers(players).map((player) => {
    const finalAmountInput = values[player.id] ?? getInitialFinalAmountInput(player.finalAmountMinor);
    const parsedInput = parseSettlementInput(finalAmountInput);
    const netResultMinor =
      parsedInput.finalAmountMinor === null
        ? null
        : (BigInt(parsedInput.finalAmountMinor) - BigInt(player.totalBuyinMinor)).toString();

    return {
      roomPlayerId: player.id,
      displayName: player.displayName,
      totalBuyinMinor: player.totalBuyinMinor,
      finalAmountInput,
      finalAmountMinor: parsedInput.finalAmountMinor,
      netResultMinor,
      issue: parsedInput.issue
    };
  });
}

export function getSettlementDraftSummary(
  players: SettlementDraftPlayer[]
): SettlementDraftSummary {
  let totalBuyinsMinor = 0n;
  let totalFinalAmountMinor = 0n;
  let hasMissingValues = false;
  let hasInvalidValues = false;

  for (const player of players) {
    totalBuyinsMinor += BigInt(player.totalBuyinMinor);

    if (player.finalAmountMinor !== null) {
      totalFinalAmountMinor += BigInt(player.finalAmountMinor);
    }

    if (player.issue === "missing") {
      hasMissingValues = true;
    }

    if (player.issue === "invalid" || player.issue === "negative") {
      hasInvalidValues = true;
    }
  }

  const differenceMinor = (totalFinalAmountMinor - totalBuyinsMinor).toString();

  return {
    totalBuyinsMinor: totalBuyinsMinor.toString(),
    totalFinalAmountMinor: totalFinalAmountMinor.toString(),
    differenceMinor,
    hasMissingValues,
    hasInvalidValues,
    isBalanced: differenceMinor === "0"
  };
}

export function buildSettlementPreviewPayload(
  players: SettlementDraftPlayer[]
): SettlementPreviewRequestDto | null {
  if (players.length === 0) {
    return null;
  }

  const finalAmounts: SettlementPreviewRequestDto["finalAmounts"] = [];

  for (const player of players) {
    if (player.finalAmountMinor === null) {
      return null;
    }

    finalAmounts.push({
      roomPlayerId: player.roomPlayerId,
      finalAmountMinor: player.finalAmountMinor
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
    .map((player) => `${player.roomPlayerId}:${player.totalBuyinMinor}:${player.finalAmountMinor}`)
    .join("|");
}

export function getSettlementDifferenceMessage(
  differenceMinor: string,
  currency: string
): string | null {
  const difference = BigInt(differenceMinor);

  if (difference === 0n) {
    return null;
  }

  const absoluteDifference = (difference < 0n ? difference * -1n : difference).toString();
  const amountText = formatMinorMoney(absoluteDifference, currency);

  if (difference > 0n) {
    return `Финальных сумм получилось больше на ${amountText}. Проверьте ввод.`;
  }

  return `Финальных сумм пока меньше на ${amountText}. Проверьте ввод.`;
}

export function getInitialFinalAmountInput(value: string | null): string {
  if (!value) {
    return "";
  }

  return formatMinorAmountInput(value);
}

function parseSettlementInput(value: string): {
  finalAmountMinor: string | null;
  issue: SettlementInputIssue | null;
} {
  const trimmed = value.trim();

  if (trimmed.length === 0) {
    return {
      finalAmountMinor: null,
      issue: "missing"
    };
  }

  const finalAmountMinor = parseMajorMoneyToMinor(trimmed);

  if (finalAmountMinor === null) {
    return {
      finalAmountMinor: null,
      issue: "invalid"
    };
  }

  if (finalAmountMinor.startsWith("-")) {
    return {
      finalAmountMinor: null,
      issue: "negative"
    };
  }

  return {
    finalAmountMinor,
    issue: null
  };
}

function formatMinorAmountInput(minor: string): string {
  const amount = BigInt(minor);
  const isNegative = amount < 0n;
  const absolute = isNegative ? amount * -1n : amount;
  const units = absolute / 100n;
  const remainder = absolute % 100n;
  const prefix = isNegative ? "-" : "";

  if (remainder === 0n) {
    return `${prefix}${units.toString()}`;
  }

  return `${prefix}${units.toString()},${remainder.toString().padStart(2, "0")}`;
}

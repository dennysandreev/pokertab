import type {
  VirtualPlayerArchetype,
  VirtualPlayerStyleProfileDto
} from "@pokertable/shared";

const MINIMUM_STYLE_SAMPLE_HANDS = 50;
const AGGRESSION_CAP_BPS = 1000;

type StyleActionType = string;

type StyleStreet = "PRE_FLOP" | "FLOP" | "TURN" | "RIVER" | "SHOWDOWN";

export type VirtualStyleStatsHand = {
  id: string;
  bigBlindChips: bigint;
  players: Array<{
    seatId: string;
    status: string;
    startingStackChips: bigint;
    currentStackChips: bigint;
    isEligibleForShowdown: boolean;
    seat: {
      userId: string;
    };
  }>;
  actions?: Array<{
    seatId: string | null;
    actionType: StyleActionType;
    amountChips: bigint | null;
    actorType: string;
    metadataJson: unknown;
    createdAt: Date;
  }>;
  pots?: Array<{
    awards: Array<{
      winnerSeatId: string;
      amountChips: bigint;
      handRankJson: unknown;
    }>;
  }>;
  timers?: Array<{
    seatId: string;
    startedAt: Date;
    expiresAt: Date;
    resolvedAt: Date | null;
    remindedAt: Date | null;
    resolutionType: string | null;
  }>;
};

export function calculateVirtualPlayerStyleProfile(
  hands: VirtualStyleStatsHand[],
  userId: string
): VirtualPlayerStyleProfileDto {
  const counters = createEmptyCounters();

  for (const hand of hands) {
    const player = hand.players.find((candidate) => candidate.seat.userId === userId);

    if (!player || player.status === "SITTING_OUT") {
      continue;
    }

    counters.handsDealt += 1;
    counters.netBigBlindHundredths += divideBigIntToNumber(
      (player.currentStackChips - player.startingStackChips) * 100n,
      hand.bigBlindChips
    );

    const playerSeatId = getPlayerSeatId(hand, userId);

    if (!playerSeatId) {
      continue;
    }

    const handActions = hand.actions ?? [];
    const handPots = hand.pots ?? [];
    const handTimers = hand.timers ?? [];
    const playerActions = handActions.filter((action) => action.seatId === playerSeatId);
    const preflopPlayerActions = playerActions.filter(
      (action) => getActionStreet(action) === "PRE_FLOP"
    );

    if (
      preflopPlayerActions.some((action) =>
        ["CALL", "BET", "RAISE", "ALL_IN"].includes(action.actionType)
      )
    ) {
      counters.vpipHands += 1;
    }

    if (
      preflopPlayerActions.some((action) =>
        ["BET", "RAISE", "ALL_IN"].includes(action.actionType)
      )
    ) {
      counters.pfrHands += 1;
    }

    counters.betsCount += playerActions.filter((action) =>
      ["BET", "ALL_IN"].includes(action.actionType)
    ).length;
    counters.raisesCount += playerActions.filter((action) => action.actionType === "RAISE").length;
    counters.callsCount += playerActions.filter((action) => action.actionType === "CALL").length;
    counters.autoActionsCount += playerActions.filter((action) =>
      ["AUTO_CHECK", "AUTO_FOLD"].includes(action.actionType)
    ).length;

    const foldPressure = getFoldPressureStats(handActions, playerSeatId);
    counters.foldsFacingRaise += foldPressure.foldsFacingRaise;
    counters.opportunitiesFacingRaise += foldPressure.opportunitiesFacingRaise;

    const isShowdownHand = handPots.some((pot) =>
      pot.awards.some((award) => award.handRankJson !== null)
    );
    const awardedToPlayer = handPots.reduce(
      (sum, pot) =>
        sum +
        pot.awards
          .filter((award) => award.winnerSeatId === playerSeatId)
          .reduce((awardSum, award) => awardSum + award.amountChips, 0n),
      0n
    );

    if (isShowdownHand && player.isEligibleForShowdown) {
      counters.showdownsReached += 1;

      if (awardedToPlayer > 0n) {
        counters.showdownsWon += 1;
      }
    }

    const allInHand =
      player.status === "ALL_IN" ||
      playerActions.some((action) => action.actionType === "ALL_IN");

    if (allInHand) {
      counters.allInHandsTotal += 1;

      if (awardedToPlayer > 0n) {
        counters.allInHandsWon += 1;
      }
    }

    if (awardedToPlayer > 0n) {
      counters.handsWon += 1;
      counters.totalPotsWonChips += awardedToPlayer;
      counters.biggestPotWonChips =
        awardedToPlayer > counters.biggestPotWonChips
          ? awardedToPlayer
          : counters.biggestPotWonChips;
    }

    const timers = handTimers.filter((timer) => timer.seatId === playerSeatId);
    counters.remindersReceived += timers.filter((timer) => timer.remindedAt !== null).length;

    for (const timer of timers) {
      counters.turnDurationSecondsTotal += secondsBetween(timer.startedAt, timer.expiresAt);

      if (timer.resolvedAt) {
        counters.decisionTimeSecondsTotal += secondsBetween(timer.startedAt, timer.resolvedAt);
        counters.decisionCount += 1;
      }
    }
  }

  const styleStats = {
    vpipBps: ratioToBps(counters.vpipHands, counters.handsDealt),
    pfrBps: ratioToBps(counters.pfrHands, counters.handsDealt),
    aggressionFactorBps: getAggressionFactorBps(counters),
    foldToRaiseBps:
      counters.opportunitiesFacingRaise === 0
        ? null
        : ratioToBps(counters.foldsFacingRaise, counters.opportunitiesFacingRaise),
    showdownRateBps: ratioToBps(counters.showdownsReached, counters.handsDealt),
    showdownWinRateBps:
      counters.showdownsReached === 0
        ? null
        : ratioToBps(counters.showdownsWon, counters.showdownsReached),
    allInWinRateBps:
      counters.allInHandsTotal === 0
        ? null
        : ratioToBps(counters.allInHandsWon, counters.allInHandsTotal),
    bbPer100Bps:
      counters.handsDealt === 0
        ? 0
        : Math.trunc((counters.netBigBlindHundredths * 100) / counters.handsDealt),
    averagePotWonChips:
      counters.handsWon === 0
        ? "0"
        : (counters.totalPotsWonChips / BigInt(counters.handsWon)).toString(),
    biggestPotWonChips: counters.biggestPotWonChips.toString(),
    averageDecisionTimeSeconds:
      counters.decisionCount === 0
        ? 0
        : Math.round(counters.decisionTimeSecondsTotal / counters.decisionCount),
    remindersReceived: counters.remindersReceived,
    autoActionsCount: counters.autoActionsCount
  };

  const averageTurnDurationSeconds =
    counters.decisionCount === 0
      ? 0
      : counters.turnDurationSecondsTotal / counters.decisionCount;
  const archetype = resolveArchetype({
    handsDealt: counters.handsDealt,
    allInHandsTotal: counters.allInHandsTotal,
    averageTurnDurationSeconds,
    styleStats
  });

  return {
    sample: {
      handsDealt: counters.handsDealt,
      minimumRequired: MINIMUM_STYLE_SAMPLE_HANDS,
      isEnoughData: counters.handsDealt >= MINIMUM_STYLE_SAMPLE_HANDS
    },
    archetype,
    styleStats
  };
}

function createEmptyCounters(): {
  handsDealt: number;
  handsWon: number;
  vpipHands: number;
  pfrHands: number;
  betsCount: number;
  raisesCount: number;
  callsCount: number;
  foldsFacingRaise: number;
  opportunitiesFacingRaise: number;
  showdownsReached: number;
  showdownsWon: number;
  allInHandsTotal: number;
  allInHandsWon: number;
  netBigBlindHundredths: number;
  totalPotsWonChips: bigint;
  biggestPotWonChips: bigint;
  decisionTimeSecondsTotal: number;
  turnDurationSecondsTotal: number;
  decisionCount: number;
  remindersReceived: number;
  autoActionsCount: number;
} {
  return {
    handsDealt: 0,
    handsWon: 0,
    vpipHands: 0,
    pfrHands: 0,
    betsCount: 0,
    raisesCount: 0,
    callsCount: 0,
    foldsFacingRaise: 0,
    opportunitiesFacingRaise: 0,
    showdownsReached: 0,
    showdownsWon: 0,
    allInHandsTotal: 0,
    allInHandsWon: 0,
    netBigBlindHundredths: 0,
    totalPotsWonChips: 0n,
    biggestPotWonChips: 0n,
    decisionTimeSecondsTotal: 0,
    turnDurationSecondsTotal: 0,
    decisionCount: 0,
    remindersReceived: 0,
    autoActionsCount: 0
  };
}

function getPlayerSeatId(hand: VirtualStyleStatsHand, userId: string): string | null {
  return hand.players.find((candidate) => candidate.seat.userId === userId)?.seatId ?? null;
}

function getFoldPressureStats(
  actions: NonNullable<VirtualStyleStatsHand["actions"]>,
  playerSeatId: string
): {
  foldsFacingRaise: number;
  opportunitiesFacingRaise: number;
} {
  let foldsFacingRaise = 0;
  let opportunitiesFacingRaise = 0;
  let street: StyleStreet = "PRE_FLOP";
  let pressureSeatId: string | null = null;

  for (const action of actions.slice().sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())) {
    const actionStreet = getActionStreet(action);

    if (actionStreet !== street) {
      street = actionStreet;
      pressureSeatId = null;
    }

    if (["BET", "RAISE", "ALL_IN"].includes(action.actionType) && action.seatId !== playerSeatId) {
      pressureSeatId = action.seatId;
      continue;
    }

    if (
      action.seatId === playerSeatId &&
      pressureSeatId !== null &&
      ["FOLD", "CALL", "RAISE", "ALL_IN"].includes(action.actionType)
    ) {
      opportunitiesFacingRaise += 1;

      if (action.actionType === "FOLD") {
        foldsFacingRaise += 1;
      }
    }

    if (["BET", "RAISE", "ALL_IN"].includes(action.actionType) && action.seatId === playerSeatId) {
      pressureSeatId = playerSeatId;
    }
  }

  return {
    foldsFacingRaise,
    opportunitiesFacingRaise
  };
}

function getActionStreet(
  action: Pick<NonNullable<VirtualStyleStatsHand["actions"]>[number], "metadataJson">
): StyleStreet {
  if (
    action.metadataJson &&
    typeof action.metadataJson === "object" &&
    !Array.isArray(action.metadataJson) &&
    "street" in action.metadataJson
  ) {
    const street = (action.metadataJson as { street?: unknown }).street;

    if (
      street === "PRE_FLOP" ||
      street === "FLOP" ||
      street === "TURN" ||
      street === "RIVER" ||
      street === "SHOWDOWN"
    ) {
      return street;
    }
  }

  return "PRE_FLOP";
}

function getAggressionFactorBps(counters: ReturnType<typeof createEmptyCounters>): number {
  const aggressiveActions = counters.betsCount + counters.raisesCount;

  if (counters.callsCount === 0) {
    return aggressiveActions > 0 ? AGGRESSION_CAP_BPS : 0;
  }

  return Math.min(AGGRESSION_CAP_BPS, Math.round((aggressiveActions * 100) / counters.callsCount));
}

function resolveArchetype(input: {
  handsDealt: number;
  allInHandsTotal: number;
  averageTurnDurationSeconds: number;
  styleStats: VirtualPlayerStyleProfileDto["styleStats"];
}): VirtualPlayerStyleProfileDto["archetype"] {
  const stats = input.styleStats;

  if (input.handsDealt < MINIMUM_STYLE_SAMPLE_HANDS) {
    return getArchetypeMeta("LEARNING");
  }

  if (
    (input.averageTurnDurationSeconds > 0 &&
      stats.averageDecisionTimeSeconds >= input.averageTurnDurationSeconds * 0.7) ||
    stats.remindersReceived * 4 >= input.handsDealt
  ) {
    return getArchetypeMeta("TANKER");
  }

  if (
    stats.bbPer100Bps > 500 &&
    stats.vpipBps >= 1800 &&
    stats.vpipBps <= 4000 &&
    stats.pfrBps >= 1000 &&
    (stats.showdownWinRateBps ?? 0) >= 5000
  ) {
    return getArchetypeMeta("SHARK");
  }

  if (stats.vpipBps >= 4500 && stats.pfrBps >= 2500 && stats.aggressionFactorBps >= 300) {
    return getArchetypeMeta("MANIAC");
  }

  if (
    stats.bbPer100Bps < -500 &&
    stats.vpipBps >= 3500 &&
    (stats.showdownWinRateBps ?? 0) < 4500
  ) {
    return getArchetypeMeta("FISH");
  }

  if (
    ((stats.allInWinRateBps ?? 0) >= 6500 && input.allInHandsTotal >= 5) ||
    ((stats.showdownWinRateBps ?? 0) >= 6000 && stats.bbPer100Bps > 0 && stats.vpipBps >= 3500)
  ) {
    return getArchetypeMeta("LUCKY");
  }

  if (stats.vpipBps <= 1800 && stats.pfrBps <= 1000 && (stats.foldToRaiseBps ?? 0) >= 5500) {
    return getArchetypeMeta("ROCK");
  }

  if (
    stats.vpipBps >= 5000 &&
    stats.pfrBps >= 1000 &&
    stats.pfrBps <= 2500 &&
    stats.aggressionFactorBps >= 100 &&
    stats.aggressionFactorBps <= 300 &&
    stats.bbPer100Bps >= -1000 &&
    stats.bbPer100Bps <= 1000
  ) {
    return getArchetypeMeta("CHAOS_PLAYER");
  }

  return getArchetypeMeta("BALANCED");
}

function getArchetypeMeta(code: VirtualPlayerArchetype): VirtualPlayerStyleProfileDto["archetype"] {
  switch (code) {
    case "LEARNING":
      return {
        code,
        title: "🔍 Учится",
        description: "Нужно больше сыгранных раздач, чтобы уверенно определить стиль игрока."
      };
    case "SHARK":
      return {
        code,
        title: "🦈 Акула",
        description: "Сильный плюсовой игрок. Выбирает хорошие банки и стабильно забирает фишки на дистанции."
      };
    case "MANIAC":
      return {
        code,
        title: "🔥 Маньяк",
        description: "Играет очень активно, часто рейзит и создает давление за столом."
      };
    case "ROCK":
      return {
        code,
        title: "🧊 Скала",
        description: "Играет осторожно и редко входит в банк без сильной причины."
      };
    case "FISH":
      return {
        code,
        title: "🐟 Любитель",
        description: "Часто входит в банки, но пока теряет фишки на дистанции."
      };
    case "LUCKY":
      return {
        code,
        title: "🍀 Везунчик",
        description: "Часто забирает спорные банки и хорошо проходит all-in ситуации."
      };
    case "TANKER":
      return {
        code,
        title: "😴 Долго думает",
        description: "Часто берет время на решение и регулярно получает напоминания о ходе."
      };
    case "CHAOS_PLAYER":
      return {
        code,
        title: "🤡 Хаос",
        description: "Непредсказуемый стиль: может зайти широко и создать странную раздачу."
      };
    case "BALANCED":
      return {
        code,
        title: "⚖️ Сбалансированный",
        description: "Ровный стиль без явного перекоса в тайтовость, агрессию или хаос."
      };
  }
}

function ratioToBps(value: number, total: number): number {
  return total === 0 ? 0 : Math.round((value * 10_000) / total);
}

function divideBigIntToNumber(dividend: bigint, divisor: bigint): number {
  if (divisor === 0n) {
    return 0;
  }

  return Number(dividend) / Number(divisor);
}

function secondsBetween(start: Date, end: Date): number {
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 1000));
}

import type { Card, Rank } from "./cards.js";

export const HAND_RANKS = [
  "HIGH_CARD",
  "PAIR",
  "TWO_PAIR",
  "THREE_OF_A_KIND",
  "STRAIGHT",
  "FLUSH",
  "FULL_HOUSE",
  "FOUR_OF_A_KIND",
  "STRAIGHT_FLUSH"
] as const;

export type HandRank = (typeof HAND_RANKS)[number];

export type EvaluatedHand = {
  rank: HandRank;
  rankValue: number;
  bestFiveCards: [Card, Card, Card, Card, Card];
  tiebreaker: number[];
};

export type PlayerWithCards = {
  seatId: string;
  privateCards: [Card, Card];
};

export type RankedPlayerHand = {
  seatId: string;
  privateCards: [Card, Card];
  evaluatedHand: EvaluatedHand;
};

export type RankWinnersResult = {
  winners: RankedPlayerHand[];
  evaluations: RankedPlayerHand[];
};

type RankCount = {
  rank: Rank;
  value: number;
  count: number;
};

const RANK_VALUE: Record<Rank, number> = {
  "2": 2,
  "3": 3,
  "4": 4,
  "5": 5,
  "6": 6,
  "7": 7,
  "8": 8,
  "9": 9,
  T: 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 14
};

const HAND_RANK_VALUE: Record<HandRank, number> = {
  HIGH_CARD: 0,
  PAIR: 1,
  TWO_PAIR: 2,
  THREE_OF_A_KIND: 3,
  STRAIGHT: 4,
  FLUSH: 5,
  FULL_HOUSE: 6,
  FOUR_OF_A_KIND: 7,
  STRAIGHT_FLUSH: 8
};

const getCardValue = (card: Card): number => RANK_VALUE[card[0] as Rank];

const compareNumberLists = (left: readonly number[], right: readonly number[]): number => {
  const maxLength = Math.max(left.length, right.length);

  for (let index = 0; index < maxLength; index += 1) {
    const leftValue = left[index] ?? Number.NEGATIVE_INFINITY;
    const rightValue = right[index] ?? Number.NEGATIVE_INFINITY;

    if (leftValue !== rightValue) {
      return leftValue - rightValue;
    }
  }

  return 0;
};

const sortCardsByValueDesc = (cards: readonly Card[]): Card[] =>
  [...cards].sort((left, right) => getCardValue(right) - getCardValue(left));

const getRankCounts = (cards: readonly Card[]): RankCount[] => {
  const counts = new Map<Rank, number>();

  for (const card of cards) {
    const rank = card[0] as Rank;
    counts.set(rank, (counts.get(rank) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([rank, count]) => ({
      rank,
      value: RANK_VALUE[rank],
      count
    }))
    .sort((left, right) => {
      if (left.count !== right.count) {
        return right.count - left.count;
      }

      return right.value - left.value;
    });
};

const getStraightHighValue = (cards: readonly Card[]): number | null => {
  const values = [...new Set(cards.map(getCardValue))].sort((left, right) => right - left);

  if (values.length !== 5) {
    return null;
  }

  const isWheel = values[0] === 14
    && values[1] === 5
    && values[2] === 4
    && values[3] === 3
    && values[4] === 2;

  if (isWheel) {
    return 5;
  }

  for (let index = 1; index < values.length; index += 1) {
    const currentValue = values[index];
    const previousValue = values[index - 1];

    if (currentValue === undefined || previousValue === undefined) {
      return null;
    }

    if (previousValue !== currentValue + 1) {
      return null;
    }
  }

  return values[0] ?? null;
};

const sortStraightCards = (cards: readonly Card[], straightHighValue: number): [Card, Card, Card, Card, Card] => {
  const sorted = [...cards].sort((left, right) => {
    const leftValue = getCardValue(left);
    const rightValue = getCardValue(right);
    const normalizedLeft = straightHighValue === 5 && leftValue === 14 ? 1 : leftValue;
    const normalizedRight = straightHighValue === 5 && rightValue === 14 ? 1 : rightValue;

    return normalizedRight - normalizedLeft;
  });

  return [sorted[0]!, sorted[1]!, sorted[2]!, sorted[3]!, sorted[4]!];
};

const toBestFive = (cards: readonly Card[]): [Card, Card, Card, Card, Card] => [
  cards[0]!,
  cards[1]!,
  cards[2]!,
  cards[3]!,
  cards[4]!
];

const SCORE_BASE = 15;

const packScore = (
  rankValue: number,
  first = 0,
  second = 0,
  third = 0,
  fourth = 0,
  fifth = 0
): number =>
  (((((rankValue * SCORE_BASE + first) * SCORE_BASE + second) * SCORE_BASE + third) * SCORE_BASE + fourth)
    * SCORE_BASE) + fifth;

const evaluateFiveCardScore = (
  values: readonly number[],
  suits: readonly string[],
  rankCounts: Uint8Array,
  touchedRanks: Uint8Array,
  first: number,
  second: number,
  third: number,
  fourth: number,
  fifth: number
): number => {
  const firstValue = values[first]!;
  const secondValue = values[second]!;
  const thirdValue = values[third]!;
  const fourthValue = values[fourth]!;
  const fifthValue = values[fifth]!;

  let touchedCount = 0;
  const addRank = (value: number): void => {
    const currentCount = rankCounts[value] ?? 0;

    if (currentCount === 0) {
      touchedRanks[touchedCount] = value;
      touchedCount += 1;
    }

    rankCounts[value] = currentCount + 1;
  };

  addRank(firstValue);
  addRank(secondValue);
  addRank(thirdValue);
  addRank(fourthValue);
  addRank(fifthValue);

  const isFlush = suits[first] === suits[second]
    && suits[first] === suits[third]
    && suits[first] === suits[fourth]
    && suits[first] === suits[fifth];

  let uniqueCount = 0;
  let quadValue = 0;
  let tripsValue = 0;
  let highPairValue = 0;
  let lowPairValue = 0;
  let firstKicker = 0;
  let secondKicker = 0;
  let thirdKicker = 0;
  let fourthKicker = 0;
  let fifthKicker = 0;

  for (let value = 14; value >= 2; value -= 1) {
    const count = rankCounts[value];

    if (count === 0) {
      continue;
    }

    uniqueCount += 1;

    if (count === 4) {
      quadValue = value;
      continue;
    }

    if (count === 3) {
      tripsValue = value;
      continue;
    }

    if (count === 2) {
      if (highPairValue === 0) {
        highPairValue = value;
      } else {
        lowPairValue = value;
      }

      continue;
    }

    if (firstKicker === 0) {
      firstKicker = value;
      continue;
    }

    if (secondKicker === 0) {
      secondKicker = value;
      continue;
    }

    if (thirdKicker === 0) {
      thirdKicker = value;
      continue;
    }

    if (fourthKicker === 0) {
      fourthKicker = value;
      continue;
    }

    fifthKicker = value;
  }

  let straightHighValue = 0;

  if (uniqueCount === 5) {
    if (
      (rankCounts[14] ?? 0) > 0
      && (rankCounts[5] ?? 0) > 0
      && (rankCounts[4] ?? 0) > 0
      && (rankCounts[3] ?? 0) > 0
      && (rankCounts[2] ?? 0) > 0
    ) {
      straightHighValue = 5;
    } else {
      for (let highValue = 14; highValue >= 5; highValue -= 1) {
        if (
          (rankCounts[highValue] ?? 0) > 0
          && (rankCounts[highValue - 1] ?? 0) > 0
          && (rankCounts[highValue - 2] ?? 0) > 0
          && (rankCounts[highValue - 3] ?? 0) > 0
          && (rankCounts[highValue - 4] ?? 0) > 0
        ) {
          straightHighValue = highValue;
          break;
        }
      }
    }
  }

  let score: number;

  if (isFlush && straightHighValue > 0) {
    score = packScore(HAND_RANK_VALUE.STRAIGHT_FLUSH, straightHighValue);
  } else if (quadValue > 0) {
    score = packScore(HAND_RANK_VALUE.FOUR_OF_A_KIND, quadValue, firstKicker);
  } else if (tripsValue > 0 && highPairValue > 0) {
    score = packScore(HAND_RANK_VALUE.FULL_HOUSE, tripsValue, highPairValue);
  } else if (isFlush) {
    score = packScore(
      HAND_RANK_VALUE.FLUSH,
      firstKicker,
      secondKicker,
      thirdKicker,
      fourthKicker,
      fifthKicker
    );
  } else if (straightHighValue > 0) {
    score = packScore(HAND_RANK_VALUE.STRAIGHT, straightHighValue);
  } else if (tripsValue > 0) {
    score = packScore(HAND_RANK_VALUE.THREE_OF_A_KIND, tripsValue, firstKicker, secondKicker);
  } else if (highPairValue > 0 && lowPairValue > 0) {
    score = packScore(HAND_RANK_VALUE.TWO_PAIR, highPairValue, lowPairValue, firstKicker);
  } else if (highPairValue > 0) {
    score = packScore(
      HAND_RANK_VALUE.PAIR,
      highPairValue,
      firstKicker,
      secondKicker,
      thirdKicker
    );
  } else {
    score = packScore(
      HAND_RANK_VALUE.HIGH_CARD,
      firstKicker,
      secondKicker,
      thirdKicker,
      fourthKicker,
      fifthKicker
    );
  }

  for (let index = 0; index < touchedCount; index += 1) {
    rankCounts[touchedRanks[index]!] = 0;
  }

  return score;
};

const evaluateFiveCards = (cards: readonly Card[]): EvaluatedHand => {
  const sortedCards = sortCardsByValueDesc(cards);
  const rankCounts = getRankCounts(cards);
  const isFlush = cards.every((card) => card[1] === cards[0]?.[1]);
  const straightHighValue = getStraightHighValue(cards);

  if (isFlush && straightHighValue !== null) {
    return {
      rank: "STRAIGHT_FLUSH",
      rankValue: HAND_RANK_VALUE.STRAIGHT_FLUSH,
      bestFiveCards: sortStraightCards(cards, straightHighValue),
      tiebreaker: [straightHighValue]
    };
  }

  if (rankCounts[0]?.count === 4 && rankCounts[1] !== undefined) {
    const quadValue = rankCounts[0].value;
    const kickerValue = rankCounts[1].value;
    const orderedCards = [
      ...cards.filter((card) => getCardValue(card) === quadValue),
      ...cards.filter((card) => getCardValue(card) === kickerValue)
    ];

    return {
      rank: "FOUR_OF_A_KIND",
      rankValue: HAND_RANK_VALUE.FOUR_OF_A_KIND,
      bestFiveCards: toBestFive(orderedCards),
      tiebreaker: [quadValue, kickerValue]
    };
  }

  if (rankCounts[0]?.count === 3 && rankCounts[1]?.count === 2) {
    const tripsValue = rankCounts[0].value;
    const pairValue = rankCounts[1].value;
    const orderedCards = [
      ...cards.filter((card) => getCardValue(card) === tripsValue),
      ...cards.filter((card) => getCardValue(card) === pairValue)
    ];

    return {
      rank: "FULL_HOUSE",
      rankValue: HAND_RANK_VALUE.FULL_HOUSE,
      bestFiveCards: toBestFive(orderedCards),
      tiebreaker: [tripsValue, pairValue]
    };
  }

  if (isFlush) {
    return {
      rank: "FLUSH",
      rankValue: HAND_RANK_VALUE.FLUSH,
      bestFiveCards: toBestFive(sortedCards),
      tiebreaker: sortedCards.map(getCardValue)
    };
  }

  if (straightHighValue !== null) {
    return {
      rank: "STRAIGHT",
      rankValue: HAND_RANK_VALUE.STRAIGHT,
      bestFiveCards: sortStraightCards(cards, straightHighValue),
      tiebreaker: [straightHighValue]
    };
  }

  if (rankCounts[0]?.count === 3) {
    const tripsValue = rankCounts[0].value;
    const kickerValues = rankCounts
      .slice(1)
      .map((entry) => entry.value)
      .sort((left, right) => right - left);
    const orderedCards = [
      ...cards.filter((card) => getCardValue(card) === tripsValue),
      ...sortCardsByValueDesc(cards.filter((card) => getCardValue(card) !== tripsValue))
    ];

    return {
      rank: "THREE_OF_A_KIND",
      rankValue: HAND_RANK_VALUE.THREE_OF_A_KIND,
      bestFiveCards: toBestFive(orderedCards),
      tiebreaker: [tripsValue, ...kickerValues]
    };
  }

  if (rankCounts[0]?.count === 2 && rankCounts[1]?.count === 2 && rankCounts[2] !== undefined) {
    const highPairValue = Math.max(rankCounts[0].value, rankCounts[1].value);
    const lowPairValue = Math.min(rankCounts[0].value, rankCounts[1].value);
    const kickerValue = rankCounts[2].value;
    const orderedCards = [
      ...cards.filter((card) => getCardValue(card) === highPairValue),
      ...cards.filter((card) => getCardValue(card) === lowPairValue),
      ...cards.filter((card) => getCardValue(card) === kickerValue)
    ];

    return {
      rank: "TWO_PAIR",
      rankValue: HAND_RANK_VALUE.TWO_PAIR,
      bestFiveCards: toBestFive(orderedCards),
      tiebreaker: [highPairValue, lowPairValue, kickerValue]
    };
  }

  if (rankCounts[0]?.count === 2) {
    const pairValue = rankCounts[0].value;
    const kickerCards = sortCardsByValueDesc(cards.filter((card) => getCardValue(card) !== pairValue));
    const orderedCards = [
      ...cards.filter((card) => getCardValue(card) === pairValue),
      ...kickerCards
    ];

    return {
      rank: "PAIR",
      rankValue: HAND_RANK_VALUE.PAIR,
      bestFiveCards: toBestFive(orderedCards),
      tiebreaker: [pairValue, ...kickerCards.map(getCardValue)]
    };
  }

  return {
    rank: "HIGH_CARD",
    rankValue: HAND_RANK_VALUE.HIGH_CARD,
    bestFiveCards: toBestFive(sortedCards),
    tiebreaker: sortedCards.map(getCardValue)
  };
};

export const compareHands = (left: EvaluatedHand, right: EvaluatedHand): number => {
  if (left.rankValue !== right.rankValue) {
    return left.rankValue - right.rankValue;
  }

  return compareNumberLists(left.tiebreaker, right.tiebreaker);
};

export const evaluateSevenCards = (cards: Card[]): EvaluatedHand => {
  if (cards.length !== 7) {
    throw new Error("Texas Hold'em evaluation requires exactly 7 cards");
  }

  const values = cards.map(getCardValue);
  const suits = cards.map((card) => card[1]!);
  const rankCounts = new Uint8Array(15);
  const touchedRanks = new Uint8Array(5);
  let bestScore = Number.NEGATIVE_INFINITY;
  let bestFirst = 0;
  let bestSecond = 1;
  let bestThird = 2;
  let bestFourth = 3;
  let bestFifth = 4;

  for (let first = 0; first < cards.length - 4; first += 1) {
    for (let second = first + 1; second < cards.length - 3; second += 1) {
      for (let third = second + 1; third < cards.length - 2; third += 1) {
        for (let fourth = third + 1; fourth < cards.length - 1; fourth += 1) {
          for (let fifth = fourth + 1; fifth < cards.length; fifth += 1) {
            const candidateScore = evaluateFiveCardScore(
              values,
              suits,
              rankCounts,
              touchedRanks,
              first,
              second,
              third,
              fourth,
              fifth
            );

            if (candidateScore > bestScore) {
              bestScore = candidateScore;
              bestFirst = first;
              bestSecond = second;
              bestThird = third;
              bestFourth = fourth;
              bestFifth = fifth;
            }
          }
        }
      }
    }
  }

  return evaluateFiveCards([
    cards[bestFirst]!,
    cards[bestSecond]!,
    cards[bestThird]!,
    cards[bestFourth]!,
    cards[bestFifth]!
  ]);
};

export const rankWinners = (
  playersWithCards: PlayerWithCards[],
  board: Card[]
): RankWinnersResult => {
  if (board.length !== 5) {
    throw new Error("Board must contain exactly 5 cards");
  }

  const evaluations = playersWithCards.map((player) => {
    if (player.privateCards.length !== 2) {
      throw new Error(`Player ${player.seatId} must have exactly 2 private cards`);
    }

    return {
      seatId: player.seatId,
      privateCards: [...player.privateCards] as [Card, Card],
      evaluatedHand: evaluateSevenCards([...player.privateCards, ...board])
    };
  });

  let bestHand: EvaluatedHand | null = null;

  for (const evaluation of evaluations) {
    if (bestHand === null || compareHands(evaluation.evaluatedHand, bestHand) > 0) {
      bestHand = evaluation.evaluatedHand;
    }
  }

  if (bestHand === null) {
    return {
      winners: [],
      evaluations
    };
  }

  return {
    winners: evaluations.filter((evaluation) => compareHands(evaluation.evaluatedHand, bestHand) === 0),
    evaluations
  };
};

import type { Card } from "./cards.js";
import { createDeck } from "./deck.js";
import { compareHands, evaluateSevenCards, type EvaluatedHand } from "./evaluator.js";
import { calculateSidePots, type SidePot } from "./showdown.js";
import type { HandState } from "./state.js";

export type SeatWinProbability = {
  seatId: string;
  winProbability: number | null;
  equity: number | null;
  winRunouts: number;
  tieRunouts: number;
};

export type CalculateWinProbabilitiesResult = {
  totalRunouts: number;
  pots: SidePot[];
  seats: SeatWinProbability[];
};

export type CalculateViewerWinProbabilityOptions = {
  state: HandState;
  viewerSeatId: string;
  seed: string;
  simulations?: number;
};

export type ViewerWinProbabilityResult = {
  seatId: string;
  winProbability: number | null;
  equity: number | null;
  simulations: number;
};

type SeatAccumulator = {
  seatId: string;
  isInHand: boolean;
  hasFolded: boolean;
  equityShareTotal: number;
  winRunouts: number;
  tieRunouts: number;
};

type FullBoard = [Card, Card, Card, Card, Card];

type ActiveSeat = {
  seatId: string;
  accumulator: SeatAccumulator;
  handCards: [Card, Card, Card, Card, Card, Card, Card];
  evaluatedHand: EvaluatedHand | null;
  awardedAmount: number;
};

type PreparedPot = {
  amount: number;
  contenderIndexes: number[];
};

export function calculateWinProbabilities(
  state: HandState
): CalculateWinProbabilitiesResult {
  if (state.board.length > 5) {
    throw new Error("Board cannot contain more than 5 cards");
  }

  const missingBoardCards = 5 - state.board.length;
  const pots = calculateSidePots(
    state.seats.map((seat) => ({
      seatId: seat.seatId,
      committed: seat.committed,
      hasFolded: seat.hasFolded
    }))
  );
  const totalPot = pots.reduce((sum, pot) => sum + pot.amount, 0);
  const seatAccumulators = new Map<string, SeatAccumulator>(
    state.seats.map((seat) => [
      seat.seatId,
      {
        seatId: seat.seatId,
        isInHand: seat.isInHand,
        hasFolded: seat.hasFolded,
        equityShareTotal: 0,
        winRunouts: 0,
        tieRunouts: 0
      }
    ])
  );
  const activeSeats: ActiveSeat[] = [];
  const activeSeatIndexById = new Map<string, number>();
  const board = new Array<Card>(5) as FullBoard;

  for (let index = 0; index < state.board.length; index += 1) {
    board[index] = state.board[index]!;
  }

  for (const seat of state.seats) {
    if (!seat.isInHand || seat.hasFolded) {
      continue;
    }

    if (seat.privateCards.length !== 2) {
      throw new Error(`Seat ${seat.seatId} must have 2 private cards for win probability calculation`);
    }

    const accumulator = seatAccumulators.get(seat.seatId);

    if (!accumulator) {
      throw new Error(`Seat ${seat.seatId} not found in win probability calculation`);
    }

    const [firstPrivateCard, secondPrivateCard] = seat.privateCards;
    const handCards: ActiveSeat["handCards"] = [
      firstPrivateCard!,
      secondPrivateCard!,
      board[0] ?? firstPrivateCard!,
      board[1] ?? firstPrivateCard!,
      board[2] ?? firstPrivateCard!,
      board[3] ?? firstPrivateCard!,
      board[4] ?? firstPrivateCard!
    ];

    activeSeatIndexById.set(seat.seatId, activeSeats.length);
    activeSeats.push({
      seatId: seat.seatId,
      accumulator,
      handCards,
      evaluatedHand: null,
      awardedAmount: 0
    });
  }
  const preparedPots: PreparedPot[] = pots.map((pot) => ({
    amount: pot.amount,
    contenderIndexes: pot.eligibleSeatIds
      .map((seatId) => activeSeatIndexById.get(seatId))
      .filter((seatIndex): seatIndex is number => seatIndex !== undefined)
  }));

  if (missingBoardCards === 0) {
    applyRunoutResult(activeSeats, preparedPots, board, totalPot);
  } else {
    enumerateBoardRunouts(state.deck, missingBoardCards, (runout) => {
      for (let index = 0; index < runout.length; index += 1) {
        board[state.board.length + index] = runout[index]!;
      }

      applyRunoutResult(activeSeats, preparedPots, board, totalPot);
    });
  }

  const totalRunouts = combinationCount(state.deck.length, missingBoardCards);

  return {
    totalRunouts,
    pots,
    seats: state.seats.map((seat) => {
      const accumulator = seatAccumulators.get(seat.seatId);

      if (!accumulator) {
        throw new Error(`Seat ${seat.seatId} not found in win probability calculation`);
      }

      if (!accumulator.isInHand) {
        return {
          seatId: seat.seatId,
          winProbability: null,
          equity: null,
          winRunouts: 0,
          tieRunouts: 0
        };
      }

      if (totalRunouts === 0) {
        return {
          seatId: seat.seatId,
          winProbability: accumulator.hasFolded ? 0 : null,
          equity: accumulator.hasFolded ? 0 : null,
          winRunouts: 0,
          tieRunouts: 0
        };
      }

      return {
        seatId: seat.seatId,
        winProbability: accumulator.hasFolded ? 0 : accumulator.winRunouts / totalRunouts,
        equity: accumulator.hasFolded ? 0 : accumulator.equityShareTotal / totalRunouts,
        winRunouts: accumulator.winRunouts,
        tieRunouts: accumulator.tieRunouts
      };
    })
  };
}

export const calculateHandEquity = calculateWinProbabilities;

const HASH_OFFSET = 0x811c9dc5;
const HASH_PRIME = 0x01000193;

export function calculateViewerWinProbability({
  state,
  viewerSeatId,
  seed,
  simulations = 3000
}: CalculateViewerWinProbabilityOptions): ViewerWinProbabilityResult {
  if (state.board.length > 5) {
    throw new Error("Board cannot contain more than 5 cards");
  }

  const viewerSeat = state.seats.find((seat) => seat.seatId === viewerSeatId);

  if (!viewerSeat || !viewerSeat.isInHand || viewerSeat.privateCards.length !== 2) {
    return {
      seatId: viewerSeatId,
      winProbability: null,
      equity: null,
      simulations: 0
    };
  }

  if (viewerSeat.hasFolded) {
    return {
      seatId: viewerSeatId,
      winProbability: 0,
      equity: 0,
      simulations: 0
    };
  }

  const activeOpponentSeats = state.seats.filter(
    (seat) => seat.seatId !== viewerSeatId && seat.isInHand && !seat.hasFolded
  );

  if (activeOpponentSeats.length === 0) {
    return {
      seatId: viewerSeatId,
      winProbability: 1,
      equity: 1,
      simulations: 1
    };
  }

  const simulationCount = Math.max(1, Math.floor(simulations));
  const missingBoardCards = 5 - state.board.length;
  const knownCards = new Set<Card>([...viewerSeat.privateCards, ...state.board]);
  const unknownPool = createDeck().filter((card) => !knownCards.has(card));
  const requiredUnknownCards = activeOpponentSeats.length * 2 + missingBoardCards;

  if (unknownPool.length < requiredUnknownCards) {
    throw new Error("Not enough unknown cards to simulate viewer win probability");
  }

  const pots = calculateSidePots(
    state.seats.map((seat) => ({
      seatId: seat.seatId,
      committed: seat.committed,
      hasFolded: seat.hasFolded
    }))
  );
  const totalPot = pots.reduce((sum, pot) => sum + pot.amount, 0);
  const activeSeats: ActiveSeat[] = [];
  const activeSeatIndexById = new Map<string, number>();
  const board = new Array<Card>(5) as FullBoard;

  for (let index = 0; index < state.board.length; index += 1) {
    board[index] = state.board[index]!;
  }

  const viewerAccumulator: SeatAccumulator = {
    seatId: viewerSeatId,
    isInHand: true,
    hasFolded: false,
    equityShareTotal: 0,
    winRunouts: 0,
    tieRunouts: 0
  };

  activeSeatIndexById.set(viewerSeatId, 0);
  activeSeats.push({
    seatId: viewerSeatId,
    accumulator: viewerAccumulator,
    handCards: [
      viewerSeat.privateCards[0]!,
      viewerSeat.privateCards[1]!,
      board[0] ?? viewerSeat.privateCards[0]!,
      board[1] ?? viewerSeat.privateCards[0]!,
      board[2] ?? viewerSeat.privateCards[0]!,
      board[3] ?? viewerSeat.privateCards[0]!,
      board[4] ?? viewerSeat.privateCards[0]!
    ],
    evaluatedHand: null,
    awardedAmount: 0
  });

  for (const seat of activeOpponentSeats) {
    const accumulator: SeatAccumulator = {
      seatId: seat.seatId,
      isInHand: true,
      hasFolded: false,
      equityShareTotal: 0,
      winRunouts: 0,
      tieRunouts: 0
    };

    activeSeatIndexById.set(seat.seatId, activeSeats.length);
    activeSeats.push({
      seatId: seat.seatId,
      accumulator,
      handCards: [
        viewerSeat.privateCards[0]!,
        viewerSeat.privateCards[0]!,
        board[0] ?? viewerSeat.privateCards[0]!,
        board[1] ?? viewerSeat.privateCards[0]!,
        board[2] ?? viewerSeat.privateCards[0]!,
        board[3] ?? viewerSeat.privateCards[0]!,
        board[4] ?? viewerSeat.privateCards[0]!
      ],
      evaluatedHand: null,
      awardedAmount: 0
    });
  }

  const preparedPots: PreparedPot[] = pots.map((pot) => ({
    amount: pot.amount,
    contenderIndexes: pot.eligibleSeatIds
      .map((seatId) => activeSeatIndexById.get(seatId))
      .filter((seatIndex): seatIndex is number => seatIndex !== undefined)
  }));
  const random = createSeededRandom(seed);

  for (let simulationIndex = 0; simulationIndex < simulationCount; simulationIndex += 1) {
    const shuffledUnknownPool = shuffleCards(unknownPool, random);
    let drawIndex = 0;

    for (let opponentIndex = 1; opponentIndex < activeSeats.length; opponentIndex += 1) {
      const firstCard = shuffledUnknownPool[drawIndex];
      const secondCard = shuffledUnknownPool[drawIndex + 1];

      if (firstCard === undefined || secondCard === undefined) {
        throw new Error("Unknown pool exhausted while dealing opponent private cards");
      }

      activeSeats[opponentIndex]!.handCards[0] = firstCard;
      activeSeats[opponentIndex]!.handCards[1] = secondCard;
      drawIndex += 2;
    }

    for (let boardIndex = state.board.length; boardIndex < 5; boardIndex += 1) {
      const nextBoardCard = shuffledUnknownPool[drawIndex];

      if (nextBoardCard === undefined) {
        throw new Error("Unknown pool exhausted while completing the board");
      }

      board[boardIndex] = nextBoardCard;
      drawIndex += 1;
    }

    applyRunoutResult(activeSeats, preparedPots, board, totalPot);
  }

  return {
    seatId: viewerSeatId,
    winProbability: viewerAccumulator.winRunouts / simulationCount,
    equity: viewerAccumulator.equityShareTotal / simulationCount,
    simulations: simulationCount
  };
}

function applyRunoutResult(
  activeSeats: ActiveSeat[],
  pots: PreparedPot[],
  board: FullBoard,
  totalPot: number
): void {
  for (const seat of activeSeats) {
    seat.handCards[2] = board[0]!;
    seat.handCards[3] = board[1]!;
    seat.handCards[4] = board[2]!;
    seat.handCards[5] = board[3]!;
    seat.handCards[6] = board[4]!;
    seat.evaluatedHand = evaluateSevenCards(seat.handCards);
    seat.awardedAmount = 0;
  }

  const winnerIndexes = new Array<number>(activeSeats.length);
  let showdownWinnerCount = 0;
  let showdownBestHand: EvaluatedHand | null = null;

  for (let seatIndex = 0; seatIndex < activeSeats.length; seatIndex += 1) {
    const seat = activeSeats[seatIndex]!;
    const seatHand = seat.evaluatedHand;

    if (!seatHand) {
      continue;
    }

    if (showdownBestHand === null) {
      showdownBestHand = seatHand;
      winnerIndexes[0] = seatIndex;
      showdownWinnerCount = 1;
      continue;
    }

    const comparison = compareHands(seatHand, showdownBestHand);

    if (comparison > 0) {
      showdownBestHand = seatHand;
      winnerIndexes[0] = seatIndex;
      showdownWinnerCount = 1;
      continue;
    }

    if (comparison === 0) {
      winnerIndexes[showdownWinnerCount] = seatIndex;
      showdownWinnerCount += 1;
    }
  }

  if (showdownWinnerCount > 0) {
    const winShare = 1 / showdownWinnerCount;

    for (let winnerIndex = 0; winnerIndex < showdownWinnerCount; winnerIndex += 1) {
      activeSeats[winnerIndexes[winnerIndex]!]!.accumulator.winRunouts += winShare;
    }

    if (showdownWinnerCount > 1) {
      for (let winnerIndex = 0; winnerIndex < showdownWinnerCount; winnerIndex += 1) {
        activeSeats[winnerIndexes[winnerIndex]!]!.accumulator.tieRunouts += 1;
      }
    }
  }

  for (const pot of pots) {
    if (pot.amount === 0 || pot.contenderIndexes.length === 0) {
      continue;
    }

    let winnerCount = 0;
    let bestHand: EvaluatedHand | null = null;

    for (const contenderIndex of pot.contenderIndexes) {
      const contender = activeSeats[contenderIndex]!;
      const contenderHand = contender.evaluatedHand;

      if (!contenderHand) {
        continue;
      }

      if (bestHand === null) {
        bestHand = contenderHand;
        winnerIndexes[0] = contenderIndex;
        winnerCount = 1;
        continue;
      }

      const comparison = compareHands(contenderHand, bestHand);

      if (comparison > 0) {
        bestHand = contenderHand;
        winnerIndexes[0] = contenderIndex;
        winnerCount = 1;
        continue;
      }

      if (comparison === 0) {
        winnerIndexes[winnerCount] = contenderIndex;
        winnerCount += 1;
      }
    }

    if (winnerCount === 0) {
      continue;
    }

    const baseShare = Math.floor(pot.amount / winnerCount);
    let remainder = pot.amount % winnerCount;

    for (let winnerIndex = 0; winnerIndex < winnerCount; winnerIndex += 1) {
      const seat = activeSeats[winnerIndexes[winnerIndex]!]!;
      seat.awardedAmount += baseShare + (remainder > 0 ? 1 : 0);
      remainder = Math.max(0, remainder - 1);
    }

  }

  for (const seat of activeSeats) {
    if (totalPot > 0) {
      seat.accumulator.equityShareTotal += seat.awardedAmount / totalPot;
    }
  }
}

function enumerateBoardRunouts(
  deck: readonly Card[],
  boardCardsToDraw: number,
  onRunout: (cards: readonly Card[]) => void
): void {
  if (boardCardsToDraw === 0) {
    onRunout([]);
    return;
  }

  const runout = new Array<Card>(boardCardsToDraw);

  const visit = (startIndex: number, depth: number): void => {
    if (depth === boardCardsToDraw) {
      onRunout(runout);
      return;
    }

    const maxIndex = deck.length - (boardCardsToDraw - depth);

    for (let index = startIndex; index <= maxIndex; index += 1) {
      runout[depth] = deck[index]!;
      visit(index + 1, depth + 1);
    }
  };

  visit(0, 0);
}

function combinationCount(totalCards: number, cardsToChoose: number): number {
  if (cardsToChoose < 0 || cardsToChoose > totalCards) {
    return 0;
  }

  if (cardsToChoose === 0 || cardsToChoose === totalCards) {
    return 1;
  }

  const picks = Math.min(cardsToChoose, totalCards - cardsToChoose);
  let result = 1;

  for (let step = 1; step <= picks; step += 1) {
    result = (result * (totalCards - picks + step)) / step;
  }

  return Math.round(result);
}

function hashSeed(seed: string): number {
  let hash = HASH_OFFSET;

  for (const character of seed) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, HASH_PRIME);
  }

  return hash >>> 0;
}

function createSeededRandom(seed: string): () => number {
  let state = hashSeed(seed) || 0x9e3779b9;

  return () => {
    state += 0x6d2b79f5;

    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);

    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleCards(deck: readonly Card[], random: () => number): Card[] {
  const shuffled = [...deck];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    const currentCard = shuffled[index];
    const targetCard = shuffled[swapIndex];

    if (currentCard === undefined || targetCard === undefined) {
      throw new Error("Shuffle index out of bounds");
    }

    shuffled[index] = targetCard;
    shuffled[swapIndex] = currentCard;
  }

  return shuffled;
}

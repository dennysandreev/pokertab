import type { Card } from "./cards.js";
import { rankWinners, type EvaluatedHand } from "./evaluator.js";
import type { HandState } from "./state.js";

export type SidePotParticipant = {
  seatId: string;
  committed: number;
  hasFolded: boolean;
};

export type SidePot = {
  type: "MAIN" | "SIDE";
  amount: number;
  cap: number;
  eligibleSeatIds: string[];
};

export type ShowdownEligiblePlayer = {
  seatId: string;
  privateCards: [Card, Card];
};

export type PotAward = {
  potIndex: number;
  seatId: string;
  amount: number;
  evaluatedHand: EvaluatedHand;
};

export type ShowdownWinnerSummary = {
  seatId: string;
  amount: number;
  evaluatedHand: EvaluatedHand;
};

export type ShowdownResult = {
  nextState: HandState;
  pots: SidePot[];
  awards: PotAward[];
  winners: ShowdownWinnerSummary[];
};

const compareSeatIds = (left: string, right: string): number => left.localeCompare(right);

export const calculateSidePots = (handPlayers: SidePotParticipant[]): SidePot[] => {
  const positiveParticipants = handPlayers
    .filter((player) => player.committed > 0)
    .sort((left, right) => left.committed - right.committed || compareSeatIds(left.seatId, right.seatId));

  if (positiveParticipants.length === 0) {
    return [];
  }

  const caps = [...new Set(positiveParticipants.map((player) => player.committed))];
  const pots: SidePot[] = [];
  let previousCap = 0;

  for (const cap of caps) {
    const contributors = positiveParticipants.filter((player) => player.committed >= cap);
    const increment = cap - previousCap;
    const amount = increment * contributors.length;

    if (amount > 0) {
      pots.push({
        type: pots.length === 0 ? "MAIN" : "SIDE",
        amount,
        cap,
        eligibleSeatIds: contributors
          .filter((player) => !player.hasFolded)
          .map((player) => player.seatId)
          .sort(compareSeatIds)
      });
    }

    previousCap = cap;
  }

  return pots;
};

export const awardPots = (
  pots: SidePot[],
  eligiblePlayers: ShowdownEligiblePlayer[],
  board: [Card, Card, Card, Card, Card]
): PotAward[] => {
  const playerBySeatId = new Map(eligiblePlayers.map((player) => [player.seatId, player]));
  const awards: PotAward[] = [];

  pots.forEach((pot, potIndex) => {
    const contenders = pot.eligibleSeatIds
      .map((seatId) => playerBySeatId.get(seatId))
      .filter((player): player is ShowdownEligiblePlayer => player !== undefined)
      .sort((left, right) => compareSeatIds(left.seatId, right.seatId));

    if (contenders.length === 0 || pot.amount === 0) {
      return;
    }

    const result = rankWinners(contenders, board);
    const orderedWinners = [...result.winners].sort((left, right) => compareSeatIds(left.seatId, right.seatId));

    if (orderedWinners.length === 0) {
      return;
    }

    const baseShare = Math.floor(pot.amount / orderedWinners.length);
    let remainder = pot.amount % orderedWinners.length;

    for (const winner of orderedWinners) {
      const amount = baseShare + (remainder > 0 ? 1 : 0);
      remainder = Math.max(0, remainder - 1);

      awards.push({
        potIndex,
        seatId: winner.seatId,
        amount,
        evaluatedHand: winner.evaluatedHand
      });
    }
  });

  return awards;
};

const cloneHandState = (state: HandState): HandState => ({
  ...state,
  board: [...state.board],
  deck: [...state.deck],
  seats: state.seats.map((seat) => ({
    ...seat,
    privateCards: [...seat.privateCards]
  }))
});

export const completeShowdown = (state: HandState): ShowdownResult => {
  if (state.board.length !== 5) {
    throw new Error("Showdown requires a complete 5-card board");
  }

  const board = [...state.board] as [Card, Card, Card, Card, Card];
  const pots = calculateSidePots(
    state.seats.map((seat) => ({
      seatId: seat.seatId,
      committed: seat.committed,
      hasFolded: seat.hasFolded
    }))
  );
  const eligiblePlayers: ShowdownEligiblePlayer[] = state.seats
    .filter((seat) => !seat.hasFolded && seat.privateCards.length === 2)
    .map((seat) => ({
      seatId: seat.seatId,
      privateCards: [seat.privateCards[0]!, seat.privateCards[1]!] as [Card, Card]
    }));
  const awards = awardPots(pots, eligiblePlayers, board);
  const nextState = cloneHandState(state);

  for (const award of awards) {
    const seat = nextState.seats.find((candidate) => candidate.seatId === award.seatId);

    if (seat === undefined) {
      throw new Error(`Winning seat ${award.seatId} not found`);
    }

    seat.stack += award.amount;
  }

  nextState.pot = 0;
  nextState.street = "SHOWDOWN";
  nextState.currentActorSeatId = null;

  const winnersBySeatId = new Map<string, ShowdownWinnerSummary>();

  for (const award of awards) {
    const existing = winnersBySeatId.get(award.seatId);

    if (existing === undefined) {
      winnersBySeatId.set(award.seatId, {
        seatId: award.seatId,
        amount: award.amount,
        evaluatedHand: award.evaluatedHand
      });
      continue;
    }

    existing.amount += award.amount;
  }

  const winners = [...winnersBySeatId.values()].sort(
    (left, right) => right.amount - left.amount || compareSeatIds(left.seatId, right.seatId)
  );

  return {
    nextState,
    pots,
    awards,
    winners
  };
};

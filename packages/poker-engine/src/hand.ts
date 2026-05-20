import type { Card } from "./cards.js";
import { shuffleDeck } from "./deck.js";
import type {
  BlindPosting,
  HandSeatState,
  HandState,
  LegalAction,
  PlayerAction,
  PublicHandState,
  TableSeatState,
  TableState
} from "./state.js";

const isSeatActive = (seat: TableSeatState): boolean =>
  seat.isOccupied && !seat.isSittingOut && seat.stack > 0;

const getActiveSeats = (tableState: TableState): TableSeatState[] =>
  tableState.seats.filter(isSeatActive);

const findSeatIndex = <T extends { seatId: string }>(seats: readonly T[], seatId: string): number =>
  seats.findIndex((seat) => seat.seatId === seatId);

const getNextSeat = <T extends { seatId: string }>(
  seats: readonly T[],
  fromSeatId: string | null | undefined
): T => {
  if (seats.length === 0) {
    throw new Error("At least one seat is required");
  }

  if (fromSeatId == null) {
    const firstSeat = seats[0];

    if (firstSeat === undefined) {
      throw new Error("Seat list is empty");
    }

    return firstSeat;
  }

  const currentIndex = findSeatIndex(seats, fromSeatId);
  if (currentIndex === -1) {
    const firstSeat = seats[0];

    if (firstSeat === undefined) {
      throw new Error("Seat list is empty");
    }

    return firstSeat;
  }

  const nextSeat = seats[(currentIndex + 1) % seats.length];
  if (nextSeat === undefined) {
    throw new Error("Next seat lookup failed");
  }

  return nextSeat;
};

const postBlind = (seat: HandSeatState, blindAmount: number, blindType: BlindPosting): number => {
  const posted = Math.min(seat.stack, blindAmount);
  seat.stack -= posted;
  seat.committed += posted;
  seat.streetCommitment += posted;
  seat.postedBlind = blindType;
  seat.isAllIn = seat.stack === 0;

  return posted;
};

const dealPrivateCards = (seats: HandSeatState[], dealerSeatId: string, deck: Card[]): void => {
  const orderedSeats = seats
    .filter((seat) => seat.isInHand)
    .sort((left, right) => findSeatIndex(seats, left.seatId) - findSeatIndex(seats, right.seatId));
  const firstToReceive = getNextSeat(orderedSeats, dealerSeatId);
  const firstIndex = findSeatIndex(orderedSeats, firstToReceive.seatId);
  const dealingOrder = orderedSeats
    .slice(firstIndex)
    .concat(orderedSeats.slice(0, firstIndex));

  let deckIndex = 0;

  for (let round = 0; round < 2; round += 1) {
    for (const seat of dealingOrder) {
      const card = deck[deckIndex];
      if (card === undefined) {
        throw new Error("Not enough cards in deck");
      }

      seat.privateCards.push(card);
      deckIndex += 1;
    }
  }

  deck.splice(0, deckIndex);
};

const isSeatLive = (seat: HandSeatState): boolean => seat.isInHand && !seat.hasFolded;
const canSeatAct = (seat: HandSeatState): boolean => isSeatLive(seat) && !seat.isAllIn && seat.stack > 0;

const countLiveSeats = (seats: readonly HandSeatState[]): number =>
  seats.filter(isSeatLive).length;

const getSeatById = (seats: readonly HandSeatState[], seatId: string): HandSeatState | undefined =>
  seats.find((seat) => seat.seatId === seatId);

const dealBoardCards = (deck: Card[], count: number): Card[] => {
  const cards = deck.slice(0, count);

  if (cards.length !== count) {
    throw new Error("Not enough cards in deck");
  }

  deck.splice(0, count);

  return cards;
};

const cloneState = (state: HandState): HandState => ({
  ...state,
  board: [...state.board],
  deck: [...state.deck],
  seats: state.seats.map((seat) => ({
    ...seat,
    privateCards: [...seat.privateCards]
  }))
});

const getFirstActorForStreet = (state: HandState, street: HandState["street"]): string | null => {
  if (street === "SHOWDOWN") {
    return null;
  }

  const fromSeatId = street === "PRE_FLOP" ? state.bigBlindSeatId : state.dealerSeatId;
  const startingSeat = getNextSeat(state.seats, fromSeatId);
  const startingIndex = findSeatIndex(state.seats, startingSeat.seatId);

  for (let offset = 0; offset < state.seats.length; offset += 1) {
    const seat = state.seats[(startingIndex + offset) % state.seats.length];
    if (seat !== undefined && canSeatAct(seat)) {
      return seat.seatId;
    }
  }

  return null;
};

const getFollowingActorSeatId = (state: HandState, fromSeatId: string): string | null => {
  const startingSeat = getNextSeat(state.seats, fromSeatId);
  const startingIndex = findSeatIndex(state.seats, startingSeat.seatId);

  for (let offset = 0; offset < state.seats.length; offset += 1) {
    const seat = state.seats[(startingIndex + offset) % state.seats.length];
    if (seat !== undefined && canSeatAct(seat)) {
      return seat.seatId;
    }
  }

  return null;
};

const assertCurrentActor = (state: HandState, seatId: string): HandSeatState => {
  if (state.currentActorSeatId !== seatId) {
    throw new Error("Only the current actor can act");
  }

  const seat = getSeatById(state.seats, seatId);
  if (seat === undefined || !canSeatAct(seat)) {
    throw new Error("Seat cannot act");
  }

  return seat;
};

const resetOtherPlayersActedFlag = (seats: HandSeatState[], actorSeatId: string): void => {
  for (const seat of seats) {
    if (seat.seatId !== actorSeatId && canSeatAct(seat)) {
      seat.hasActedThisStreet = false;
    }
  }
};

export const isBettingRoundComplete = (state: HandState): boolean => {
  if (countLiveSeats(state.seats) <= 1) {
    return true;
  }

  const actionableSeats = state.seats.filter(canSeatAct);
  if (actionableSeats.length === 0) {
    return true;
  }

  return actionableSeats.every(
    (seat) => seat.hasActedThisStreet && seat.streetCommitment === state.currentBet
  );
};

export const getNextActor = (state: HandState): string | null => {
  if (state.street === "SHOWDOWN" || isBettingRoundComplete(state)) {
    return null;
  }

  if (state.currentActorSeatId !== null) {
    const currentActor = getSeatById(state.seats, state.currentActorSeatId);
    if (currentActor !== undefined && canSeatAct(currentActor)) {
      return currentActor.seatId;
    }
  }

  return getFirstActorForStreet(state, state.street);
};

export const getLegalActions = (state: HandState, seatId: string): LegalAction[] => {
  if (getNextActor(state) !== seatId) {
    return [];
  }

  const seat = getSeatById(state.seats, seatId);
  if (seat === undefined || !canSeatAct(seat)) {
    return [];
  }

  const actions: LegalAction[] = [{ type: "FOLD" }];
  const callAmount = Math.max(0, state.currentBet - seat.streetCommitment);

  if (callAmount === 0) {
    actions.push({ type: "CHECK" });
  } else {
    actions.push({ type: "CALL", amount: Math.min(callAmount, seat.stack) });
  }

  if (state.currentBet === 0) {
    actions.push({
      type: "BET",
      min: Math.min(state.bigBlind, seat.stack),
      max: seat.stack
    });
  } else {
    const minimumRaiseAmount = callAmount + state.minRaise;
    if (!seat.hasActedThisStreet && seat.stack >= minimumRaiseAmount) {
      actions.push({
        type: "RAISE",
        min: minimumRaiseAmount,
        max: seat.stack
      });
    }
  }

  actions.push({ type: "ALL_IN", amount: seat.stack });

  return actions;
};

export const applyPlayerAction = (state: HandState, action: PlayerAction): HandState => {
  if (getLegalActions(state, action.seatId).length === 0) {
    throw new Error("Seat has no legal actions");
  }

  const nextState = cloneState(state);
  const actor = assertCurrentActor(nextState, action.seatId);
  const previousCurrentBet = nextState.currentBet;
  const callAmount = Math.max(0, previousCurrentBet - actor.streetCommitment);
  let reopenedBetting = false;

  switch (action.type) {
    case "FOLD":
      actor.hasFolded = true;
      actor.hasActedThisStreet = true;
      break;
    case "CHECK":
      if (callAmount !== 0) {
        throw new Error("Check is not legal");
      }
      actor.hasActedThisStreet = true;
      break;
    case "CALL": {
      if (callAmount <= 0) {
        throw new Error("Call is not legal");
      }
      const contribution = Math.min(callAmount, actor.stack);
      actor.stack -= contribution;
      actor.committed += contribution;
      actor.streetCommitment += contribution;
      actor.isAllIn = actor.stack === 0;
      actor.hasActedThisStreet = true;
      nextState.pot += contribution;
      break;
    }
    case "BET":
      if (previousCurrentBet !== 0) {
        throw new Error("Bet is not legal");
      }
      if (action.amount < Math.min(nextState.bigBlind, actor.stack) || action.amount > actor.stack) {
        throw new Error("Bet amount is out of range");
      }
      actor.stack -= action.amount;
      actor.committed += action.amount;
      actor.streetCommitment += action.amount;
      actor.isAllIn = actor.stack === 0;
      actor.hasActedThisStreet = true;
      nextState.pot += action.amount;
      nextState.currentBet = actor.streetCommitment;
      nextState.minRaise = actor.streetCommitment >= nextState.bigBlind
        ? actor.streetCommitment
        : nextState.bigBlind;
      reopenedBetting = true;
      break;
    case "RAISE": {
      if (callAmount <= 0) {
        throw new Error("Raise is not legal");
      }
      const minimumRaiseAmount = callAmount + nextState.minRaise;
      if (action.amount < minimumRaiseAmount || action.amount > actor.stack) {
        throw new Error("Raise amount is out of range");
      }
      actor.stack -= action.amount;
      actor.committed += action.amount;
      actor.streetCommitment += action.amount;
      actor.isAllIn = actor.stack === 0;
      actor.hasActedThisStreet = true;
      nextState.pot += action.amount;
      nextState.currentBet = actor.streetCommitment;
      nextState.minRaise = actor.streetCommitment - previousCurrentBet;
      reopenedBetting = true;
      break;
    }
    case "ALL_IN": {
      const contribution = actor.stack;
      actor.stack = 0;
      actor.committed += contribution;
      actor.streetCommitment += contribution;
      actor.isAllIn = true;
      actor.hasActedThisStreet = true;
      nextState.pot += contribution;

      if (actor.streetCommitment > previousCurrentBet) {
        const raiseSize = actor.streetCommitment - previousCurrentBet;
        nextState.currentBet = actor.streetCommitment;

        if (previousCurrentBet === 0) {
          nextState.minRaise = actor.streetCommitment >= nextState.bigBlind
            ? actor.streetCommitment
            : nextState.bigBlind;
          reopenedBetting = true;
        } else if (raiseSize >= nextState.minRaise) {
          nextState.minRaise = raiseSize;
          reopenedBetting = true;
        }
      }
      break;
    }
    default: {
      const exhaustiveCheck: never = action;
      throw new Error(`Unsupported action: ${String(exhaustiveCheck)}`);
    }
  }

  if (reopenedBetting) {
    resetOtherPlayersActedFlag(nextState.seats, actor.seatId);
  }

  nextState.currentActorSeatId = isBettingRoundComplete(nextState)
    ? null
    : getFollowingActorSeatId(nextState, actor.seatId);

  return nextState;
};

export const advanceStreet = (state: HandState): HandState => {
  const nextState = cloneState(state);

  switch (state.street) {
    case "PRE_FLOP":
      nextState.street = "FLOP";
      nextState.board.push(...dealBoardCards(nextState.deck, 3));
      break;
    case "FLOP":
      nextState.street = "TURN";
      nextState.board.push(...dealBoardCards(nextState.deck, 1));
      break;
    case "TURN":
      nextState.street = "RIVER";
      nextState.board.push(...dealBoardCards(nextState.deck, 1));
      break;
    case "RIVER":
      nextState.street = "SHOWDOWN";
      break;
    case "SHOWDOWN":
      return nextState;
    default: {
      const exhaustiveCheck: never = state.street;
      throw new Error(`Unsupported street: ${String(exhaustiveCheck)}`);
    }
  }

  for (const seat of nextState.seats) {
    seat.streetCommitment = 0;
    seat.hasActedThisStreet = false;
  }

  nextState.currentBet = 0;
  nextState.minRaise = nextState.bigBlind;
  nextState.currentActorSeatId = getFirstActorForStreet(nextState, nextState.street);

  return nextState;
};

export const startHand = (tableState: TableState, seed: string): HandState => {
  const activeSeats = getActiveSeats(tableState);

  if (activeSeats.length < 2) {
    throw new Error("At least two active seats are required to start a hand");
  }

  const dealerSeat = getNextSeat(activeSeats, tableState.dealerSeatId);
  const isHeadsUp = activeSeats.length === 2;
  const smallBlindSeat = isHeadsUp ? dealerSeat : getNextSeat(activeSeats, dealerSeat.seatId);
  const bigBlindSeat = getNextSeat(activeSeats, smallBlindSeat.seatId);

  const seats: HandSeatState[] = activeSeats.map((seat) => ({
    seatId: seat.seatId,
    stack: seat.stack,
    stackAtHandStart: seat.stack,
    isInHand: true,
    hasFolded: false,
    isAllIn: false,
    committed: 0,
    streetCommitment: 0,
    hasActedThisStreet: false,
    privateCards: []
  }));

  const seatById = new Map(seats.map((seat) => [seat.seatId, seat]));
  const smallBlindHandSeat = seatById.get(smallBlindSeat.seatId);
  const bigBlindHandSeat = seatById.get(bigBlindSeat.seatId);

  if (smallBlindHandSeat === undefined || bigBlindHandSeat === undefined) {
    throw new Error("Blind seats were not found in hand state");
  }

  const deck = shuffleDeck(seed);
  dealPrivateCards(seats, dealerSeat.seatId, deck);

  const pot = postBlind(smallBlindHandSeat, tableState.smallBlind, "SMALL_BLIND")
    + postBlind(bigBlindHandSeat, tableState.bigBlind, "BIG_BLIND");

  const initialState: HandState = {
    tableId: tableState.tableId,
    dealerSeatId: dealerSeat.seatId,
    smallBlindSeatId: smallBlindSeat.seatId,
    bigBlindSeatId: bigBlindSeat.seatId,
    currentActorSeatId: null,
    street: "PRE_FLOP",
    smallBlind: tableState.smallBlind,
    bigBlind: tableState.bigBlind,
    board: [],
    pot,
    currentBet: bigBlindHandSeat.streetCommitment,
    minRaise: tableState.bigBlind,
    deck,
    seats
  };

  return {
    ...initialState,
    currentActorSeatId: getFirstActorForStreet(initialState, "PRE_FLOP")
  };
};

export const getPublicHandState = (
  state: HandState,
  viewerSeatId?: string
): PublicHandState => ({
  tableId: state.tableId,
  dealerSeatId: state.dealerSeatId,
  smallBlindSeatId: state.smallBlindSeatId,
  bigBlindSeatId: state.bigBlindSeatId,
  currentActorSeatId: state.currentActorSeatId,
  street: state.street,
  smallBlind: state.smallBlind,
  bigBlind: state.bigBlind,
  board: [...state.board],
  pot: state.pot,
  currentBet: state.currentBet,
  minRaise: state.minRaise,
  seats: state.seats.map((seat) => ({
    ...seat,
    privateCards: seat.seatId === viewerSeatId ? [...seat.privateCards] : []
  }))
});

export const getPrivateCards = (state: HandState, seatId: string): Card[] => {
  const seat = state.seats.find((candidate) => candidate.seatId === seatId);

  return seat ? [...seat.privateCards] : [];
};

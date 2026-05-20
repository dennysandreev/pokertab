import type { Card } from "./cards.js";

export type Street = "PRE_FLOP" | "FLOP" | "TURN" | "RIVER" | "SHOWDOWN";
export type BlindPosting = "SMALL_BLIND" | "BIG_BLIND";
export type ActionType = "FOLD" | "CHECK" | "CALL" | "BET" | "RAISE" | "ALL_IN";

export type TableSeatState = {
  seatId: string;
  stack: number;
  isOccupied: boolean;
  isSittingOut?: boolean;
};

export type TableState = {
  tableId: string;
  dealerSeatId?: string | null;
  smallBlind: number;
  bigBlind: number;
  seats: TableSeatState[];
};

export type HandSeatState = {
  seatId: string;
  stack: number;
  stackAtHandStart: number;
  isInHand: boolean;
  hasFolded: boolean;
  isAllIn: boolean;
  committed: number;
  streetCommitment: number;
  hasActedThisStreet: boolean;
  privateCards: Card[];
  postedBlind?: BlindPosting;
};

export type HandState = {
  tableId: string;
  dealerSeatId: string;
  smallBlindSeatId: string;
  bigBlindSeatId: string;
  currentActorSeatId: string | null;
  street: Street;
  smallBlind: number;
  bigBlind: number;
  board: Card[];
  pot: number;
  currentBet: number;
  minRaise: number;
  deck: Card[];
  seats: HandSeatState[];
};

export type LegalAction =
  | { type: "FOLD" }
  | { type: "CHECK" }
  | { type: "CALL"; amount: number }
  | { type: "BET"; min: number; max: number }
  | { type: "RAISE"; min: number; max: number }
  | { type: "ALL_IN"; amount: number };

export type PlayerAction =
  | { seatId: string; type: "FOLD" }
  | { seatId: string; type: "CHECK" }
  | { seatId: string; type: "CALL" }
  | { seatId: string; type: "BET"; amount: number }
  | { seatId: string; type: "RAISE"; amount: number }
  | { seatId: string; type: "ALL_IN" };

export type PublicHandSeatState = Omit<HandSeatState, "privateCards"> & {
  privateCards: Card[];
};

export type PublicHandState = Omit<HandState, "deck" | "seats"> & {
  seats: PublicHandSeatState[];
};

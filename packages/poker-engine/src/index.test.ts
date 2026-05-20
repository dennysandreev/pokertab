import { describe, expect, it } from "vitest";
import {
  advanceStreet,
  applyPlayerAction,
  awardPots,
  calculateHandEquity,
  calculateViewerWinProbability,
  calculateSidePots,
  compareHands,
  completeShowdown,
  createDeck,
  evaluateSevenCards,
  getLegalActions,
  getNextActor,
  getPrivateCards,
  getPublicHandState,
  isBettingRoundComplete,
  rankWinners,
  shuffleDeck,
  startHand,
  type HandState,
  type TableState
} from "./index.js";

const createTableState = (overrides?: Partial<TableState>): TableState => ({
  tableId: "table-1",
  dealerSeatId: "seat-1",
  smallBlind: 5,
  bigBlind: 10,
  seats: [
    { seatId: "seat-1", stack: 100, isOccupied: true },
    { seatId: "seat-2", stack: 100, isOccupied: true },
    { seatId: "seat-3", stack: 100, isOccupied: true },
    { seatId: "seat-4", stack: 100, isOccupied: false }
  ],
  ...overrides
});

const getSeat = <T extends { seatId: string }>(seats: T[], seatId: string): T => {
  const seat = seats.find((candidate) => candidate.seatId === seatId);

  if (seat === undefined) {
    throw new Error(`Seat ${seatId} not found`);
  }

  return seat;
};

describe("deck", () => {
  it("creates 52 unique cards", () => {
    const deck = createDeck();

    expect(deck).toHaveLength(52);
    expect(new Set(deck)).toHaveProperty("size", 52);
  });

  it("shuffles deterministically by seed and changes card order", () => {
    const originalDeck = createDeck();
    const shuffledA = shuffleDeck("hand-seed");
    const shuffledB = shuffleDeck("hand-seed");
    const shuffledC = shuffleDeck("another-seed");

    expect(shuffledA).toEqual(shuffledB);
    expect(shuffledA).not.toEqual(originalDeck);
    expect(shuffledC).not.toEqual(shuffledA);
  });
});

describe("startHand", () => {
  it("deals two private cards to each active seat", () => {
    const hand = startHand(createTableState(), "deal-seed");

    expect(hand.board).toEqual([]);
    expect(hand.street).toBe("PRE_FLOP");
    expect(hand.seats).toHaveLength(3);
    expect(hand.seats.every((seat) => seat.privateCards.length === 2)).toBe(true);
    expect(hand.deck).toHaveLength(46);
  });

  it("assigns dealer, small blind, big blind, and first actor on a normal table", () => {
    const hand = startHand(createTableState(), "table-seed");

    expect(hand.dealerSeatId).toBe("seat-2");
    expect(hand.smallBlindSeatId).toBe("seat-3");
    expect(hand.bigBlindSeatId).toBe("seat-1");
    expect(hand.currentActorSeatId).toBe("seat-2");
    expect(hand.pot).toBe(15);
  });

  it("heads-up dealer is small blind and preflop actor is small blind", () => {
    const hand = startHand(
      createTableState({
        dealerSeatId: "seat-1",
        seats: [
          { seatId: "seat-1", stack: 100, isOccupied: true },
          { seatId: "seat-2", stack: 100, isOccupied: true }
        ]
      }),
      "heads-up-seed"
    );

    expect(hand.dealerSeatId).toBe("seat-2");
    expect(hand.smallBlindSeatId).toBe("seat-2");
    expect(hand.bigBlindSeatId).toBe("seat-1");
    expect(hand.currentActorSeatId).toBe("seat-2");
  });
});

describe("public state", () => {
  it("hides other players private cards and shows viewer cards", () => {
    const hand = startHand(createTableState(), "visibility-seed");
    const publicState = getPublicHandState(hand, "seat-2");

    expect(getPrivateCards(hand, "seat-2")).toEqual(
      hand.seats.find((seat) => seat.seatId === "seat-2")?.privateCards ?? []
    );
    expect(publicState.seats.find((seat) => seat.seatId === "seat-2")?.privateCards).toHaveLength(2);
    expect(publicState.seats.find((seat) => seat.seatId === "seat-1")?.privateCards).toEqual([]);
    expect(publicState.seats.find((seat) => seat.seatId === "seat-3")?.privateCards).toEqual([]);
  });
});

describe("betting", () => {
  it("keeps preflop and postflop turn order, including heads-up", () => {
    const hand = startHand(createTableState(), "betting-order");

    expect(getNextActor(hand)).toBe("seat-2");

    const afterButtonCall = applyPlayerAction(hand, { seatId: "seat-2", type: "CALL" });
    expect(getNextActor(afterButtonCall)).toBe("seat-3");

    const afterSmallBlindCall = applyPlayerAction(afterButtonCall, { seatId: "seat-3", type: "CALL" });
    expect(getNextActor(afterSmallBlindCall)).toBe("seat-1");

    const preflopClosed = applyPlayerAction(afterSmallBlindCall, { seatId: "seat-1", type: "CHECK" });
    expect(isBettingRoundComplete(preflopClosed)).toBe(true);

    const flop = advanceStreet(preflopClosed);
    expect(flop.street).toBe("FLOP");
    expect(getNextActor(flop)).toBe("seat-3");

    const headsUpHand = startHand(
      createTableState({
        dealerSeatId: "seat-1",
        seats: [
          { seatId: "seat-1", stack: 100, isOccupied: true },
          { seatId: "seat-2", stack: 100, isOccupied: true }
        ]
      }),
      "heads-up-order"
    );

    expect(getNextActor(headsUpHand)).toBe("seat-2");

    const headsUpClosed = applyPlayerAction(
      applyPlayerAction(headsUpHand, { seatId: "seat-2", type: "CALL" }),
      { seatId: "seat-1", type: "CHECK" }
    );

    expect(getNextActor(advanceStreet(headsUpClosed))).toBe("seat-1");
  });

  it("returns legal actions for call, raise, check, bet, and all-in spots", () => {
    const preflopHand = startHand(createTableState(), "legal-actions");

    expect(getLegalActions(preflopHand, "seat-2")).toEqual([
      { type: "FOLD" },
      { type: "CALL", amount: 10 },
      { type: "RAISE", min: 20, max: 100 },
      { type: "ALL_IN", amount: 100 }
    ]);
    expect(getLegalActions(preflopHand, "seat-1")).toEqual([]);

    const flop = advanceStreet(
      applyPlayerAction(
        applyPlayerAction(
          applyPlayerAction(preflopHand, { seatId: "seat-2", type: "CALL" }),
          { seatId: "seat-3", type: "CALL" }
        ),
        { seatId: "seat-1", type: "CHECK" }
      )
    );

    expect(getLegalActions(flop, "seat-3")).toEqual([
      { type: "FOLD" },
      { type: "CHECK" },
      { type: "BET", min: 10, max: 90 },
      { type: "ALL_IN", amount: 90 }
    ]);
  });

  it("updates stack, pot, and commitment on call without mutating the input state", () => {
    const hand = startHand(createTableState(), "call-update");
    const updated = applyPlayerAction(hand, { seatId: "seat-2", type: "CALL" });

    expect(hand.pot).toBe(15);
    expect(getSeat(hand.seats, "seat-2").stack).toBe(100);

    expect(updated.pot).toBe(25);
    expect(updated.currentActorSeatId).toBe("seat-3");
    expect(getSeat(updated.seats, "seat-2")).toMatchObject({
      stack: 90,
      committed: 10,
      streetCommitment: 10,
      hasActedThisStreet: true
    });
  });

  it("updates current bet and min raise on a raise", () => {
    const hand = startHand(createTableState(), "raise-update");
    const raised = applyPlayerAction(hand, { seatId: "seat-2", type: "RAISE", amount: 20 });

    expect(raised.pot).toBe(35);
    expect(raised.currentBet).toBe(20);
    expect(raised.minRaise).toBe(10);
    expect(raised.currentActorSeatId).toBe("seat-3");
    expect(getSeat(raised.seats, "seat-2")).toMatchObject({
      stack: 80,
      committed: 20,
      streetCommitment: 20
    });
  });

  it("keeps the min raise after an under-min all-in", () => {
    const hand = startHand(
      createTableState({
        seats: [
          { seatId: "seat-1", stack: 100, isOccupied: true },
          { seatId: "seat-2", stack: 100, isOccupied: true },
          { seatId: "seat-3", stack: 25, isOccupied: true }
        ]
      }),
      "short-all-in"
    );

    const raised = applyPlayerAction(hand, { seatId: "seat-2", type: "RAISE", amount: 20 });
    const shortAllIn = applyPlayerAction(raised, { seatId: "seat-3", type: "ALL_IN" });

    expect(shortAllIn.currentBet).toBe(25);
    expect(shortAllIn.minRaise).toBe(10);
    expect(shortAllIn.currentActorSeatId).toBe("seat-1");
  });

  it("does not reopen raising after an under-min all-in", () => {
    const hand = startHand(
      createTableState({
        seats: [
          { seatId: "seat-1", stack: 100, isOccupied: true },
          { seatId: "seat-2", stack: 100, isOccupied: true },
          { seatId: "seat-3", stack: 25, isOccupied: true }
        ]
      }),
      "under-min-no-reopen"
    );

    const raised = applyPlayerAction(hand, { seatId: "seat-2", type: "RAISE", amount: 20 });
    const shortAllIn = applyPlayerAction(raised, { seatId: "seat-3", type: "ALL_IN" });
    const afterBigBlindFold = applyPlayerAction(shortAllIn, { seatId: "seat-1", type: "FOLD" });

    expect(afterBigBlindFold.currentActorSeatId).toBe("seat-2");
    expect(getLegalActions(afterBigBlindFold, "seat-2")).toEqual([
      { type: "FOLD" },
      { type: "CALL", amount: 5 },
      { type: "ALL_IN", amount: 80 }
    ]);

    const closedRound = applyPlayerAction(afterBigBlindFold, { seatId: "seat-2", type: "CALL" });

    expect(isBettingRoundComplete(closedRound)).toBe(true);
    expect(closedRound.currentActorSeatId).toBeNull();
  });

  it("closes the betting round when everyone matches and when only one live player remains", () => {
    const hand = startHand(createTableState(), "round-close");
    const matchedRound = applyPlayerAction(
      applyPlayerAction(
        applyPlayerAction(hand, { seatId: "seat-2", type: "CALL" }),
        { seatId: "seat-3", type: "CALL" }
      ),
      { seatId: "seat-1", type: "CHECK" }
    );

    expect(isBettingRoundComplete(matchedRound)).toBe(true);
    expect(matchedRound.currentActorSeatId).toBeNull();

    const foldedToBigBlind = applyPlayerAction(
      applyPlayerAction(hand, { seatId: "seat-2", type: "FOLD" }),
      { seatId: "seat-3", type: "FOLD" }
    );

    expect(isBettingRoundComplete(foldedToBigBlind)).toBe(true);
    expect(foldedToBigBlind.currentActorSeatId).toBeNull();
  });

  it("advances streets, deals the right number of board cards, and resets street state", () => {
    const hand = startHand(createTableState(), "street-advance");
    const flop = advanceStreet(hand);
    const turn = advanceStreet(flop);
    const river = advanceStreet(turn);
    const showdown = advanceStreet(river);

    expect(flop.board).toHaveLength(3);
    expect(flop.currentBet).toBe(0);
    expect(flop.minRaise).toBe(10);
    expect(flop.seats.every((seat) => seat.streetCommitment === 0 && !seat.hasActedThisStreet)).toBe(true);
    expect(turn.board).toHaveLength(4);
    expect(river.board).toHaveLength(5);
    expect(showdown.street).toBe("SHOWDOWN");
    expect(showdown.currentActorSeatId).toBeNull();
  });

  it("skips folded and all-in seats when choosing the next actor", () => {
    const hand = startHand(createTableState(), "skip-seats");
    const afterFold = applyPlayerAction(hand, { seatId: "seat-2", type: "FOLD" });
    const afterCall = applyPlayerAction(afterFold, { seatId: "seat-3", type: "CALL" });

    expect(afterCall.currentActorSeatId).toBe("seat-1");

    const shortStackHand = startHand(
      createTableState({
        seats: [
          { seatId: "seat-1", stack: 100, isOccupied: true },
          { seatId: "seat-2", stack: 15, isOccupied: true },
          { seatId: "seat-3", stack: 100, isOccupied: true }
        ]
      }),
      "skip-all-in"
    );
    const afterAllIn = applyPlayerAction(shortStackHand, { seatId: "seat-2", type: "ALL_IN" });

    expect(afterAllIn.currentActorSeatId).toBe("seat-3");
  });
});

describe("evaluator", () => {
  it("ranks every hand type in the correct order", () => {
    const highCard = evaluateSevenCards(["AS", "KD", "9C", "7H", "4S", "3D", "2C"]);
    const pair = evaluateSevenCards(["AS", "AD", "KC", "QH", "9S", "4D", "2C"]);
    const twoPair = evaluateSevenCards(["AS", "AD", "KC", "KH", "9S", "4D", "2C"]);
    const trips = evaluateSevenCards(["AS", "AD", "AC", "KH", "9S", "4D", "2C"]);
    const straight = evaluateSevenCards(["9S", "8D", "7C", "6H", "5S", "2D", "AC"]);
    const flush = evaluateSevenCards(["AS", "QS", "9S", "6S", "3S", "KD", "2C"]);
    const fullHouse = evaluateSevenCards(["AS", "AD", "AC", "KH", "KC", "4D", "2C"]);
    const quads = evaluateSevenCards(["AS", "AD", "AC", "AH", "KC", "4D", "2C"]);
    const straightFlush = evaluateSevenCards(["9S", "8S", "7S", "6S", "5S", "KD", "2C"]);

    expect(compareHands(pair, highCard)).toBeGreaterThan(0);
    expect(compareHands(twoPair, pair)).toBeGreaterThan(0);
    expect(compareHands(trips, twoPair)).toBeGreaterThan(0);
    expect(compareHands(straight, trips)).toBeGreaterThan(0);
    expect(compareHands(flush, straight)).toBeGreaterThan(0);
    expect(compareHands(fullHouse, flush)).toBeGreaterThan(0);
    expect(compareHands(quads, fullHouse)).toBeGreaterThan(0);
    expect(compareHands(straightFlush, quads)).toBeGreaterThan(0);
  });

  it("treats ace-low straight as lower than six-high straight", () => {
    const wheel = evaluateSevenCards(["AS", "2D", "3C", "4H", "5S", "KD", "QC"]);
    const sixHighStraight = evaluateSevenCards(["2S", "3D", "4C", "5H", "6S", "KD", "QC"]);

    expect(wheel.rank).toBe("STRAIGHT");
    expect(sixHighStraight.rank).toBe("STRAIGHT");
    expect(compareHands(wheel, sixHighStraight)).toBeLessThan(0);
  });

  it("chooses the top five suited cards for a flush", () => {
    const flush = evaluateSevenCards(["AS", "QS", "9S", "7S", "5S", "3S", "KD"]);

    expect(flush.rank).toBe("FLUSH");
    expect(flush.bestFiveCards).toEqual(["AS", "QS", "9S", "7S", "5S"]);
  });

  it("picks the best trips and best pair for a full house", () => {
    const fullHouse = evaluateSevenCards(["AH", "AD", "AC", "KH", "KD", "KS", "2C"]);

    expect(fullHouse.rank).toBe("FULL_HOUSE");
    expect(fullHouse.bestFiveCards).toEqual(["AH", "AD", "AC", "KH", "KD"]);
    expect(fullHouse.tiebreaker).toEqual([14, 13]);
  });

  it("breaks quads ties by kicker", () => {
    const aceKicker = evaluateSevenCards(["9S", "9H", "9D", "9C", "AS", "4D", "2C"]);
    const kingKicker = evaluateSevenCards(["9S", "9H", "9D", "9C", "KS", "4D", "2C"]);

    expect(compareHands(aceKicker, kingKicker)).toBeGreaterThan(0);
  });

  it("returns tie for identical hand strength", () => {
    const left = evaluateSevenCards(["AS", "KD", "QH", "JC", "9S", "4D", "2C"]);
    const right = evaluateSevenCards(["AH", "KC", "QD", "JS", "9D", "4H", "2S"]);

    expect(compareHands(left, right)).toBe(0);
  });

  it("supports split winners", () => {
    const result = rankWinners(
      [
        { seatId: "seat-1", privateCards: ["AH", "KD"] },
        { seatId: "seat-2", privateCards: ["AD", "KC"] },
        { seatId: "seat-3", privateCards: ["QS", "QD"] }
      ],
      ["AS", "KH", "7C", "4D", "2S"]
    );

    expect(result.winners.map((winner) => winner.seatId)).toEqual(["seat-1", "seat-2"]);
    expect(result.evaluations).toHaveLength(3);
  });
});

describe("showdown", () => {
  it("handles a two-player all-in with a single main pot", () => {
    const pots = calculateSidePots([
      { seatId: "seat-1", committed: 100, hasFolded: false },
      { seatId: "seat-2", committed: 100, hasFolded: false }
    ]);
    const awards = awardPots(
      pots,
      [
        { seatId: "seat-1", privateCards: ["AH", "AD"] },
        { seatId: "seat-2", privateCards: ["KC", "KD"] }
      ],
      ["2S", "7H", "9D", "TC", "3C"]
    );

    expect(pots).toEqual([
      {
        type: "MAIN",
        amount: 200,
        cap: 100,
        eligibleSeatIds: ["seat-1", "seat-2"]
      }
    ]);
    expect(awards).toHaveLength(1);
    expect(awards[0]).toMatchObject({
      potIndex: 0,
      seatId: "seat-1",
      amount: 200
    });
    expect(awards[0]?.evaluatedHand.rank).toBe("PAIR");
  });

  it("keeps a short all-in eligible only for the main pot", () => {
    const pots = calculateSidePots([
      { seatId: "seat-1", committed: 50, hasFolded: false },
      { seatId: "seat-2", committed: 100, hasFolded: false },
      { seatId: "seat-3", committed: 100, hasFolded: false }
    ]);
    const awards = awardPots(
      pots,
      [
        { seatId: "seat-1", privateCards: ["AH", "AD"] },
        { seatId: "seat-2", privateCards: ["KS", "KD"] },
        { seatId: "seat-3", privateCards: ["QS", "QD"] }
      ],
      ["2C", "7D", "9H", "TC", "3S"]
    );

    expect(pots).toEqual([
      {
        type: "MAIN",
        amount: 150,
        cap: 50,
        eligibleSeatIds: ["seat-1", "seat-2", "seat-3"]
      },
      {
        type: "SIDE",
        amount: 100,
        cap: 100,
        eligibleSeatIds: ["seat-2", "seat-3"]
      }
    ]);
    expect(awards).toHaveLength(2);
    expect(awards[0]).toMatchObject({
      potIndex: 0,
      seatId: "seat-1",
      amount: 150
    });
    expect(awards[0]?.evaluatedHand.rank).toBe("PAIR");
    expect(awards[1]).toMatchObject({
      potIndex: 1,
      seatId: "seat-2",
      amount: 100
    });
    expect(awards[1]?.evaluatedHand.rank).toBe("PAIR");
  });

  it("builds multiple side pots for cascading all-in caps", () => {
    const pots = calculateSidePots([
      { seatId: "seat-1", committed: 25, hasFolded: false },
      { seatId: "seat-2", committed: 50, hasFolded: false },
      { seatId: "seat-3", committed: 100, hasFolded: false },
      { seatId: "seat-4", committed: 200, hasFolded: false }
    ]);

    expect(pots).toEqual([
      {
        type: "MAIN",
        amount: 100,
        cap: 25,
        eligibleSeatIds: ["seat-1", "seat-2", "seat-3", "seat-4"]
      },
      {
        type: "SIDE",
        amount: 75,
        cap: 50,
        eligibleSeatIds: ["seat-2", "seat-3", "seat-4"]
      },
      {
        type: "SIDE",
        amount: 100,
        cap: 100,
        eligibleSeatIds: ["seat-3", "seat-4"]
      },
      {
        type: "SIDE",
        amount: 100,
        cap: 200,
        eligibleSeatIds: ["seat-4"]
      }
    ]);
    expect(pots.reduce((sum, pot) => sum + pot.amount, 0)).toBe(375);
  });

  it("counts folded chips into pots but never lets folded players win", () => {
    const pots = calculateSidePots([
      { seatId: "seat-1", committed: 100, hasFolded: true },
      { seatId: "seat-2", committed: 100, hasFolded: false },
      { seatId: "seat-3", committed: 100, hasFolded: false }
    ]);
    const awards = awardPots(
      pots,
      [
        { seatId: "seat-2", privateCards: ["AH", "AD"] },
        { seatId: "seat-3", privateCards: ["KS", "KD"] }
      ],
      ["2C", "7D", "9H", "TC", "3S"]
    );

    expect(pots).toEqual([
      {
        type: "MAIN",
        amount: 300,
        cap: 100,
        eligibleSeatIds: ["seat-2", "seat-3"]
      }
    ]);
    expect(awards).toHaveLength(1);
    expect(awards[0]).toMatchObject({
      potIndex: 0,
      seatId: "seat-2",
      amount: 300
    });
    expect(awards[0]?.evaluatedHand.rank).toBe("PAIR");
  });

  it("splits odd chips deterministically and preserves the total amount", () => {
    const pots = [
      {
        type: "MAIN" as const,
        amount: 101,
        cap: 101,
        eligibleSeatIds: ["seat-10", "seat-2"]
      }
    ];
    const awards = awardPots(
      pots,
      [
        { seatId: "seat-10", privateCards: ["AH", "KD"] },
        { seatId: "seat-2", privateCards: ["AD", "KC"] }
      ],
      ["AS", "KH", "7C", "4D", "2S"]
    );

    expect(awards).toHaveLength(2);
    expect(awards[0]).toMatchObject({
      potIndex: 0,
      seatId: "seat-10",
      amount: 51
    });
    expect(awards[0]?.evaluatedHand.rank).toBe("TWO_PAIR");
    expect(awards[1]).toMatchObject({
      potIndex: 0,
      seatId: "seat-2",
      amount: 50
    });
    expect(awards[1]?.evaluatedHand.rank).toBe("TWO_PAIR");
    expect(awards.reduce((sum, award) => sum + award.amount, 0)).toBe(101);
  });

  it("completes showdown without changing total chips", () => {
    const state: HandState = {
      tableId: "table-1",
      dealerSeatId: "seat-1",
      smallBlindSeatId: "seat-2",
      bigBlindSeatId: "seat-3",
      currentActorSeatId: null,
      street: "RIVER",
      smallBlind: 5,
      bigBlind: 10,
      board: ["2C", "7D", "9H", "TC", "3S"],
      pot: 250,
      currentBet: 0,
      minRaise: 10,
      deck: [],
      seats: [
        {
          seatId: "seat-1",
          stack: 0,
          stackAtHandStart: 100,
          isInHand: true,
          hasFolded: false,
          isAllIn: true,
          committed: 50,
          streetCommitment: 50,
          hasActedThisStreet: true,
          privateCards: ["AH", "AD"]
        },
        {
          seatId: "seat-2",
          stack: 0,
          stackAtHandStart: 100,
          isInHand: true,
          hasFolded: false,
          isAllIn: true,
          committed: 100,
          streetCommitment: 100,
          hasActedThisStreet: true,
          privateCards: ["KS", "KD"]
        },
        {
          seatId: "seat-3",
          stack: 0,
          stackAtHandStart: 100,
          isInHand: true,
          hasFolded: false,
          isAllIn: true,
          committed: 100,
          streetCommitment: 100,
          hasActedThisStreet: true,
          privateCards: ["QS", "QD"]
        }
      ]
    };

    const beforeTotal = state.seats.reduce((sum, seat) => sum + seat.stack, 0) + state.pot;
    const result = completeShowdown(state);
    const afterTotal =
      result.nextState.seats.reduce((sum, seat) => sum + seat.stack, 0) + result.nextState.pot;

    expect(result.pots).toEqual([
      {
        type: "MAIN",
        amount: 150,
        cap: 50,
        eligibleSeatIds: ["seat-1", "seat-2", "seat-3"]
      },
      {
        type: "SIDE",
        amount: 100,
        cap: 100,
        eligibleSeatIds: ["seat-2", "seat-3"]
      }
    ]);
    expect(result.awards).toHaveLength(2);
    expect(result.awards[0]).toMatchObject({
      potIndex: 0,
      seatId: "seat-1",
      amount: 150
    });
    expect(result.awards[0]?.evaluatedHand.rank).toBe("PAIR");
    expect(result.awards[1]).toMatchObject({
      potIndex: 1,
      seatId: "seat-2",
      amount: 100
    });
    expect(result.awards[1]?.evaluatedHand.rank).toBe("PAIR");
    expect(result.winners).toHaveLength(2);
    expect(result.winners[0]).toMatchObject({
      seatId: "seat-1",
      amount: 150
    });
    expect(result.winners[0]?.evaluatedHand.rank).toBe("PAIR");
    expect(result.winners[1]).toMatchObject({
      seatId: "seat-2",
      amount: 100
    });
    expect(result.winners[1]?.evaluatedHand.rank).toBe("PAIR");
    expect(result.nextState.street).toBe("SHOWDOWN");
    expect(result.nextState.currentActorSeatId).toBeNull();
    expect(result.nextState.pot).toBe(0);
    expect(beforeTotal).toBe(afterTotal);
  });
});

describe("win probability", () => {
  it("calculates exact preflop equity from full board enumeration", () => {
    const usedCards = [
      "AS",
      "AH",
      "KS",
      "KH",
      "QS",
      "QH",
      "JS",
      "JH",
      "TS",
      "TH",
      "9S",
      "9H",
      "8S",
      "8H",
      "7S",
      "7H",
      "6S",
      "6H"
    ];
    const result = calculateHandEquity({
      tableId: "table-1",
      dealerSeatId: "seat-1",
      smallBlindSeatId: "seat-1",
      bigBlindSeatId: "seat-2",
      currentActorSeatId: "seat-1",
      street: "PRE_FLOP",
      smallBlind: 5,
      bigBlind: 10,
      board: [],
      pot: 135,
      currentBet: 10,
      minRaise: 10,
      deck: createDeck().filter((card) => !usedCards.includes(card)),
      seats: [
        {
          seatId: "seat-1",
          stack: 90,
          stackAtHandStart: 100,
          isInHand: true,
          hasFolded: false,
          isAllIn: false,
          committed: 15,
          streetCommitment: 10,
          hasActedThisStreet: false,
          privateCards: ["AS", "AH"]
        },
        {
          seatId: "seat-2",
          stack: 90,
          stackAtHandStart: 100,
          isInHand: true,
          hasFolded: false,
          isAllIn: false,
          committed: 15,
          streetCommitment: 10,
          hasActedThisStreet: false,
          privateCards: ["KS", "KH"]
        },
        {
          seatId: "seat-3",
          stack: 90,
          stackAtHandStart: 100,
          isInHand: true,
          hasFolded: false,
          isAllIn: false,
          committed: 15,
          streetCommitment: 10,
          hasActedThisStreet: false,
          privateCards: ["QS", "QH"]
        },
        {
          seatId: "seat-4",
          stack: 90,
          stackAtHandStart: 100,
          isInHand: true,
          hasFolded: false,
          isAllIn: false,
          committed: 15,
          streetCommitment: 10,
          hasActedThisStreet: false,
          privateCards: ["JS", "JH"]
        },
        {
          seatId: "seat-5",
          stack: 90,
          stackAtHandStart: 100,
          isInHand: true,
          hasFolded: false,
          isAllIn: false,
          committed: 15,
          streetCommitment: 10,
          hasActedThisStreet: false,
          privateCards: ["TS", "TH"]
        },
        {
          seatId: "seat-6",
          stack: 90,
          stackAtHandStart: 100,
          isInHand: true,
          hasFolded: false,
          isAllIn: false,
          committed: 15,
          streetCommitment: 10,
          hasActedThisStreet: false,
          privateCards: ["9S", "9H"]
        },
        {
          seatId: "seat-7",
          stack: 90,
          stackAtHandStart: 100,
          isInHand: true,
          hasFolded: false,
          isAllIn: false,
          committed: 15,
          streetCommitment: 10,
          hasActedThisStreet: false,
          privateCards: ["8S", "8H"]
        },
        {
          seatId: "seat-8",
          stack: 90,
          stackAtHandStart: 100,
          isInHand: true,
          hasFolded: false,
          isAllIn: false,
          committed: 15,
          streetCommitment: 10,
          hasActedThisStreet: false,
          privateCards: ["7S", "7H"]
        },
        {
          seatId: "seat-9",
          stack: 90,
          stackAtHandStart: 100,
          isInHand: true,
          hasFolded: false,
          isAllIn: false,
          committed: 15,
          streetCommitment: 10,
          hasActedThisStreet: false,
          privateCards: ["6S", "6H"]
        }
      ]
    });

    expect(result.totalRunouts).toBe(278256);
    expect(result.seats[0]?.equity).toBeGreaterThan(result.seats[1]?.equity ?? 0);
    expect(result.seats[1]?.equity).toBeGreaterThan(result.seats[8]?.equity ?? 0);
    expect(result.seats.reduce((sum, seat) => sum + (seat.equity ?? 0), 0)).toBeCloseTo(1, 10);
  }, 70000);

  it("returns certain equity on the flop when the hand is locked", () => {
    const result = calculateHandEquity({
      tableId: "table-1",
      dealerSeatId: "seat-1",
      smallBlindSeatId: "seat-1",
      bigBlindSeatId: "seat-2",
      currentActorSeatId: null,
      street: "FLOP",
      smallBlind: 5,
      bigBlind: 10,
      board: ["AC", "AD", "2S"],
      pot: 100,
      currentBet: 0,
      minRaise: 10,
      deck: createDeck().filter((card) => !["AS", "AH", "KC", "KD", "AC", "AD", "2S"].includes(card)),
      seats: [
        {
          seatId: "seat-1",
          stack: 0,
          stackAtHandStart: 100,
          isInHand: true,
          hasFolded: false,
          isAllIn: true,
          committed: 50,
          streetCommitment: 50,
          hasActedThisStreet: true,
          privateCards: ["AS", "AH"]
        },
        {
          seatId: "seat-2",
          stack: 0,
          stackAtHandStart: 100,
          isInHand: true,
          hasFolded: false,
          isAllIn: true,
          committed: 50,
          streetCommitment: 50,
          hasActedThisStreet: true,
          privateCards: ["KC", "KD"]
        }
      ]
    });

    expect(result.totalRunouts).toBe(990);
    expect(result.seats[0]?.equity).toBe(1);
    expect(result.seats[1]?.equity).toBe(0);
  });

  it("returns river split equity exactly", () => {
    const result = calculateHandEquity({
      tableId: "table-1",
      dealerSeatId: "seat-1",
      smallBlindSeatId: "seat-1",
      bigBlindSeatId: "seat-2",
      currentActorSeatId: null,
      street: "RIVER",
      smallBlind: 5,
      bigBlind: 10,
      board: ["AS", "KH", "7C", "4D", "2S"],
      pot: 40,
      currentBet: 0,
      minRaise: 10,
      deck: createDeck().filter((card) => !["AH", "KD", "AD", "KC", "AS", "KH", "7C", "4D", "2S"].includes(card)),
      seats: [
        {
          seatId: "seat-1",
          stack: 80,
          stackAtHandStart: 100,
          isInHand: true,
          hasFolded: false,
          isAllIn: false,
          committed: 20,
          streetCommitment: 0,
          hasActedThisStreet: true,
          privateCards: ["AH", "KD"]
        },
        {
          seatId: "seat-2",
          stack: 80,
          stackAtHandStart: 100,
          isInHand: true,
          hasFolded: false,
          isAllIn: false,
          committed: 20,
          streetCommitment: 0,
          hasActedThisStreet: true,
          privateCards: ["AD", "KC"]
        }
      ]
    });

    expect(result.totalRunouts).toBe(1);
    expect(result.seats[0]?.equity).toBe(0.5);
    expect(result.seats[1]?.equity).toBe(0.5);
    expect(result.seats[0]?.tieRunouts).toBe(1);
    expect(result.seats[1]?.tieRunouts).toBe(1);
  });

  it("gives folded seats zero and seats outside the hand null", () => {
    const result = calculateHandEquity({
      tableId: "table-1",
      dealerSeatId: "seat-1",
      smallBlindSeatId: "seat-1",
      bigBlindSeatId: "seat-2",
      currentActorSeatId: null,
      street: "TURN",
      smallBlind: 5,
      bigBlind: 10,
      board: ["2S", "7H", "9D", "TC"],
      pot: 250,
      currentBet: 0,
      minRaise: 10,
      deck: createDeck().filter((card) =>
        !["AH", "AD", "KS", "KD", "QS", "QD", "2S", "7H", "9D", "TC"].includes(card)
      ),
      seats: [
        {
          seatId: "seat-1",
          stack: 0,
          stackAtHandStart: 100,
          isInHand: true,
          hasFolded: false,
          isAllIn: true,
          committed: 50,
          streetCommitment: 50,
          hasActedThisStreet: true,
          privateCards: ["AH", "AD"]
        },
        {
          seatId: "seat-2",
          stack: 0,
          stackAtHandStart: 100,
          isInHand: true,
          hasFolded: false,
          isAllIn: true,
          committed: 100,
          streetCommitment: 100,
          hasActedThisStreet: true,
          privateCards: ["KS", "KD"]
        },
        {
          seatId: "seat-3",
          stack: 50,
          stackAtHandStart: 100,
          isInHand: true,
          hasFolded: true,
          isAllIn: false,
          committed: 100,
          streetCommitment: 100,
          hasActedThisStreet: true,
          privateCards: ["QS", "QD"]
        },
        {
          seatId: "seat-4",
          stack: 100,
          stackAtHandStart: 100,
          isInHand: false,
          hasFolded: false,
          isAllIn: false,
          committed: 0,
          streetCommitment: 0,
          hasActedThisStreet: false,
          privateCards: []
        }
      ]
    });

    expect(result.totalRunouts).toBe(42);
    expect(result.seats[2]).toMatchObject({
      seatId: "seat-3",
      winProbability: 0,
      equity: 0
    });
    expect(result.seats[3]).toMatchObject({
      seatId: "seat-4",
      winProbability: null,
      equity: null
    });
    expect((result.seats[0]?.equity ?? 0) + (result.seats[1]?.equity ?? 0)).toBeCloseTo(1, 10);
  });
});

describe("viewer win probability", () => {
  const createViewerState = (overrides?: Partial<HandState>): HandState => ({
    tableId: "table-1",
    dealerSeatId: "seat-1",
    smallBlindSeatId: "seat-1",
    bigBlindSeatId: "seat-2",
    currentActorSeatId: null,
    street: "TURN",
    smallBlind: 5,
    bigBlind: 10,
    board: ["2S", "7H", "9D", "TC"],
    pot: 200,
    currentBet: 0,
    minRaise: 10,
    deck: createDeck().filter((card) =>
      !["AH", "AD", "KS", "KD", "QS", "QD", "2S", "7H", "9D", "TC"].includes(card)
    ),
    seats: [
      {
        seatId: "seat-1",
        stack: 0,
        stackAtHandStart: 100,
        isInHand: true,
        hasFolded: false,
        isAllIn: true,
        committed: 100,
        streetCommitment: 100,
        hasActedThisStreet: true,
        privateCards: ["AH", "AD"]
      },
      {
        seatId: "seat-2",
        stack: 0,
        stackAtHandStart: 100,
        isInHand: true,
        hasFolded: false,
        isAllIn: true,
        committed: 100,
        streetCommitment: 100,
        hasActedThisStreet: true,
        privateCards: ["KS", "KD"]
      },
      {
        seatId: "seat-3",
        stack: 0,
        stackAtHandStart: 100,
        isInHand: true,
        hasFolded: false,
        isAllIn: true,
        committed: 0,
        streetCommitment: 0,
        hasActedThisStreet: true,
        privateCards: ["QS", "QD"]
      }
    ],
    ...overrides
  });

  it("is deterministic for the same state and seed", () => {
    const state = createViewerState();
    const firstResult = calculateViewerWinProbability({
      state,
      viewerSeatId: "seat-1",
      seed: "viewer-seed",
      simulations: 1200
    });
    const secondResult = calculateViewerWinProbability({
      state,
      viewerSeatId: "seat-1",
      seed: "viewer-seed",
      simulations: 1200
    });

    expect(firstResult).toEqual(secondResult);
  });

  it("changes the result when the board changes", () => {
    const firstResult = calculateViewerWinProbability({
      state: createViewerState(),
      viewerSeatId: "seat-1",
      seed: "viewer-seed",
      simulations: 1200
    });
    const secondResult = calculateViewerWinProbability({
      state: createViewerState({
        board: ["2S", "7H", "9D", "JC"],
        street: "TURN",
        deck: createDeck().filter((card) =>
          !["AH", "AD", "KS", "KD", "QS", "QD", "2S", "7H", "9D", "JC"].includes(card)
        )
      }),
      viewerSeatId: "seat-1",
      seed: "viewer-seed",
      simulations: 1200
    });

    expect(secondResult.equity).not.toBe(firstResult.equity);
    expect(secondResult.winProbability).not.toBe(firstResult.winProbability);
  });

  it("ignores opponents actual private cards for the same viewer board and seed", () => {
    const firstResult = calculateViewerWinProbability({
      state: createViewerState(),
      viewerSeatId: "seat-1",
      seed: "viewer-seed",
      simulations: 1200
    });
    const secondResult = calculateViewerWinProbability({
      state: createViewerState({
        deck: createDeck().filter((card) =>
          !["AH", "AD", "4C", "5C", "6C", "7C", "2S", "7H", "9D", "TC"].includes(card)
        ),
        seats: [
          {
            seatId: "seat-1",
            stack: 0,
            stackAtHandStart: 100,
            isInHand: true,
            hasFolded: false,
            isAllIn: true,
            committed: 100,
            streetCommitment: 100,
            hasActedThisStreet: true,
            privateCards: ["AH", "AD"]
          },
          {
            seatId: "seat-2",
            stack: 0,
            stackAtHandStart: 100,
            isInHand: true,
            hasFolded: false,
            isAllIn: true,
            committed: 100,
            streetCommitment: 100,
            hasActedThisStreet: true,
            privateCards: ["4C", "5C"]
          },
          {
            seatId: "seat-3",
            stack: 0,
            stackAtHandStart: 100,
            isInHand: true,
            hasFolded: false,
            isAllIn: true,
            committed: 0,
            streetCommitment: 0,
            hasActedThisStreet: true,
            privateCards: ["6C", "7C"]
          }
        ]
      }),
      viewerSeatId: "seat-1",
      seed: "viewer-seed",
      simulations: 1200
    });

    expect(secondResult).toEqual(firstResult);
  });

  it("excludes folded opponents from the simulation", () => {
    const withFoldedOpponent = calculateViewerWinProbability({
      state: createViewerState({
        seats: [
          {
            seatId: "seat-1",
            stack: 0,
            stackAtHandStart: 100,
            isInHand: true,
            hasFolded: false,
            isAllIn: true,
            committed: 100,
            streetCommitment: 100,
            hasActedThisStreet: true,
            privateCards: ["AH", "AD"]
          },
          {
            seatId: "seat-2",
            stack: 0,
            stackAtHandStart: 100,
            isInHand: true,
            hasFolded: false,
            isAllIn: true,
            committed: 100,
            streetCommitment: 100,
            hasActedThisStreet: true,
            privateCards: ["KS", "KD"]
          },
          {
            seatId: "seat-3",
            stack: 0,
            stackAtHandStart: 100,
            isInHand: true,
            hasFolded: true,
            isAllIn: false,
            committed: 100,
            streetCommitment: 100,
            hasActedThisStreet: true,
            privateCards: ["QS", "QD"]
          }
        ]
      }),
      viewerSeatId: "seat-1",
      seed: "viewer-seed",
      simulations: 1200
    });
    const withoutFoldedOpponent = calculateViewerWinProbability({
      state: createViewerState({
        seats: [
          {
            seatId: "seat-1",
            stack: 0,
            stackAtHandStart: 100,
            isInHand: true,
            hasFolded: false,
            isAllIn: true,
            committed: 100,
            streetCommitment: 100,
            hasActedThisStreet: true,
            privateCards: ["AH", "AD"]
          },
          {
            seatId: "seat-2",
            stack: 0,
            stackAtHandStart: 100,
            isInHand: true,
            hasFolded: false,
            isAllIn: true,
            committed: 100,
            streetCommitment: 100,
            hasActedThisStreet: true,
            privateCards: ["4C", "5C"]
          },
          {
            seatId: "seat-3",
            stack: 0,
            stackAtHandStart: 100,
            isInHand: true,
            hasFolded: false,
            isAllIn: true,
            committed: 100,
            streetCommitment: 100,
            hasActedThisStreet: true,
            privateCards: ["6C", "7C"]
          }
        ]
      }),
      viewerSeatId: "seat-1",
      seed: "viewer-seed",
      simulations: 1200
    });

    expect(withFoldedOpponent.equity).toBeGreaterThan(withoutFoldedOpponent.equity ?? 0);
  });

  it("keeps win probability based on cards instead of unmatched blind equity", () => {
    const state: HandState = {
      tableId: "table-1",
      dealerSeatId: "seat-1",
      smallBlindSeatId: "seat-1",
      bigBlindSeatId: "seat-2",
      currentActorSeatId: "seat-1",
      street: "PRE_FLOP",
      smallBlind: 50,
      bigBlind: 100,
      board: [],
      pot: 150,
      currentBet: 100,
      minRaise: 100,
      deck: [],
      seats: [
        {
          seatId: "seat-1",
          stack: 10300,
          stackAtHandStart: 10350,
          isInHand: true,
          hasFolded: false,
          isAllIn: false,
          committed: 50,
          streetCommitment: 50,
          hasActedThisStreet: false,
          privateCards: ["AC", "AD"]
        },
        {
          seatId: "seat-2",
          stack: 9550,
          stackAtHandStart: 9650,
          isInHand: true,
          hasFolded: false,
          isAllIn: false,
          committed: 100,
          streetCommitment: 100,
          hasActedThisStreet: true,
          privateCards: ["QH", "QS"]
        }
      ]
    };

    const smallBlindResult = calculateViewerWinProbability({
      state,
      viewerSeatId: "seat-1",
      seed: "blind-commitments",
      simulations: 5000
    });
    const bigBlindResult = calculateViewerWinProbability({
      state,
      viewerSeatId: "seat-2",
      seed: "blind-commitments",
      simulations: 5000
    });

    expect(smallBlindResult.winProbability).toBeGreaterThan(0.8);
    expect(smallBlindResult.equity).toBeLessThan(0.7);
    expect(bigBlindResult.winProbability).toBeLessThan(0.85);
    expect(bigBlindResult.equity).toBeGreaterThan(0.8);
  });

  it("returns zero for a folded viewer and null when viewer is outside the hand or has no cards", () => {
    expect(
      calculateViewerWinProbability({
        state: createViewerState({
          seats: [
            {
              seatId: "seat-1",
              stack: 0,
              stackAtHandStart: 100,
              isInHand: true,
              hasFolded: true,
              isAllIn: false,
              committed: 100,
              streetCommitment: 100,
              hasActedThisStreet: true,
              privateCards: ["AH", "AD"]
            },
            ...createViewerState().seats.slice(1)
          ]
        }),
        viewerSeatId: "seat-1",
        seed: "viewer-seed"
      })
    ).toEqual({
      seatId: "seat-1",
      winProbability: 0,
      equity: 0,
      simulations: 0
    });

    expect(
      calculateViewerWinProbability({
        state: createViewerState({
          seats: [
            {
              seatId: "seat-1",
              stack: 100,
              stackAtHandStart: 100,
              isInHand: false,
              hasFolded: false,
              isAllIn: false,
              committed: 0,
              streetCommitment: 0,
              hasActedThisStreet: false,
              privateCards: []
            },
            ...createViewerState().seats.slice(1)
          ]
        }),
        viewerSeatId: "seat-1",
        seed: "viewer-seed"
      })
    ).toEqual({
      seatId: "seat-1",
      winProbability: null,
      equity: null,
      simulations: 0
    });

    expect(
      calculateViewerWinProbability({
        state: createViewerState({
          seats: [
            {
              seatId: "seat-1",
              stack: 100,
              stackAtHandStart: 100,
              isInHand: true,
              hasFolded: false,
              isAllIn: false,
              committed: 0,
              streetCommitment: 0,
              hasActedThisStreet: false,
              privateCards: []
            },
            ...createViewerState().seats.slice(1)
          ]
        }),
        viewerSeatId: "seat-1",
        seed: "viewer-seed"
      })
    ).toEqual({
      seatId: "seat-1",
      winProbability: null,
      equity: null,
      simulations: 0
    });
  });

  it("returns certainty when no active opponents remain", () => {
    const result = calculateViewerWinProbability({
      state: createViewerState({
        seats: [
          {
            seatId: "seat-1",
            stack: 0,
            stackAtHandStart: 100,
            isInHand: true,
            hasFolded: false,
            isAllIn: true,
            committed: 100,
            streetCommitment: 100,
            hasActedThisStreet: true,
            privateCards: ["AH", "AD"]
          },
          {
            seatId: "seat-2",
            stack: 0,
            stackAtHandStart: 100,
            isInHand: true,
            hasFolded: true,
            isAllIn: false,
            committed: 100,
            streetCommitment: 100,
            hasActedThisStreet: true,
            privateCards: ["KS", "KD"]
          }
        ]
      }),
      viewerSeatId: "seat-1",
      seed: "viewer-seed"
    });

    expect(result).toEqual({
      seatId: "seat-1",
      winProbability: 1,
      equity: 1,
      simulations: 1
    });
  });
});

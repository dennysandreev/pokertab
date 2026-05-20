# 07. Poker Engine Architecture

## Goal

Create a pure, testable Texas Hold’em engine. Do not implement core game rules directly in API controllers.

## Package

Suggested:

```text
packages/poker-engine
```

## Modules

```text
cards/
  card.ts
  deck.ts
  shuffle.ts

evaluator/
  evaluate-7-card-hand.ts
  compare-hands.ts

holdem/
  create-hand.ts
  deal.ts
  streets.ts
  showdown.ts

betting/
  legal-actions.ts
  apply-action.ts
  round-completion.ts
  turn-order.ts

side-pots/
  calculate-side-pots.ts
  award-pots.ts

sit-out/
  sit-out-state.ts
  apply-sit-out-transitions.ts

stats/
  calculate-online-stats.ts
  online-poker-score.ts
```

## Engine pattern

Use command → result/event model.

```ts
type GameCommand =
  | { type: 'START_HAND'; tableId: string }
  | { type: 'PLAYER_ACTION'; seatId: string; action: PlayerAction }
  | { type: 'TIMEOUT_ACTION'; seatId: string }
  | { type: 'PAUSE_TABLE'; actorUserId: string }
  | { type: 'RESUME_TABLE'; actorUserId: string }
  | { type: 'REQUEST_SIT_OUT'; seatId: string; autoCheck: boolean; autoFold: boolean };

type EngineResult = {
  nextState: GameState;
  events: GameEvent[];
  notifications: NotificationIntent[];
};
```

## Pure functions

Core functions should be deterministic and easy to test:

```ts
createDeck()
shuffleDeck(seed)
dealHoleCards()
getLegalActions()
applyPlayerAction()
isBettingRoundComplete()
advanceStreet()
calculateSidePots()
evaluateShowdown()
awardPots()
getNextActor()
applySitOutTransitions()
```

## State source of truth

Backend DB is persistent source.

Engine receives normalized state and returns DB updates, events, notification intents and next timer intent.

## Critical rules

1. Only server can run engine.
2. Client sends requested action, not final state.
3. Server validates action against legal actions.
4. Server applies state transition transactionally.
5. Server appends action/event history.
6. Server creates next timer if another player must act.
7. Server sends notification after transaction commits.

## Legal actions

Function:

```ts
getLegalActions(state, seatId): LegalAction[]
```

Must consider current actor, current street, current bet, committed street amount, stack, min raise and all-in possibilities.

## Testing strategy

Start with engine tests before DB/API.

Test files:

```text
cards.test.ts
deck.test.ts
turn-order.test.ts
legal-actions.test.ts
betting-rounds.test.ts
all-in.test.ts
side-pots.test.ts
showdown.test.ts
sit-out.test.ts
```

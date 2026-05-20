# 11. Hand Evaluator

## Goal

Evaluate best Texas Hold’em hand from 7 cards.

Input:
- 2 private cards;
- 5 community cards.

Output:
- hand category;
- rank values for tie-break;
- comparable numeric score or structured rank.

## Hand categories

From strongest to weakest:

```text
ROYAL_FLUSH
STRAIGHT_FLUSH
FOUR_OF_A_KIND
FULL_HOUSE
FLUSH
STRAIGHT
THREE_OF_A_KIND
TWO_PAIR
ONE_PAIR
HIGH_CARD
```

Royal flush can also be represented as straight flush A-high.

## Output format

Suggested:

```ts
type EvaluatedHand = {
  category: HandCategory;
  ranks: number[];
  cards: Card[];
  score: string;
};
```

`ranks` used for tie-break.

## Comparison

```ts
compareHands(a, b): -1 | 0 | 1
```

Return:
- 1 if a wins;
- -1 if b wins;
- 0 if tie.

## Card representation

Use compact strings:

```text
AS = Ace of spades
KH = King of hearts
TD = Ten of diamonds
2C = Two of clubs
```

## Ace-low straight

Must support wheel:

```text
A-2-3-4-5
```

In this case straight high card is 5.

## Required tests

- high card;
- one pair;
- two pair;
- trips;
- straight;
- wheel straight;
- flush;
- full house;
- four of a kind;
- straight flush;
- seven-card best selection;
- tied hands.

## Acceptance criteria

- Evaluator handles all categories.
- Evaluator handles ties.
- Evaluator handles ace-low straight.
- Evaluator chooses best 5 from 7.
- Evaluator is deterministic.
- Showdown uses evaluator only server-side.

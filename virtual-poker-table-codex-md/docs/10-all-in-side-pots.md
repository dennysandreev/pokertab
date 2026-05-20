# 10. All-in & Side Pots

## Why this is critical

All-in and side pots are the highest-risk area of the virtual poker engine.

Do not implement UI/API before pure side-pot tests pass.

## Definitions

### Main pot

Pot that all active players with the smallest all-in commitment can contest.

### Side pot

Additional pot created when one or more players commit more chips than a smaller all-in player.

Only players who contributed to a side pot can win that side pot.

## Input model

```ts
type PotInputPlayer = {
  seatId: string;
  committedTotalChips: bigint;
  folded: boolean;
};
```

Folded players contribute chips to pots but are not eligible to win.

## Basic algorithm

1. Take all players with committedTotalChips > 0.
2. Sort unique commitment levels ascending.
3. For each level:
   - calculate contribution slice from previous level to current level;
   - include every player whose committedTotalChips >= current level;
   - pot amount = slice * number of contributing players;
   - eligible players are non-folded players with committedTotalChips >= current level.
4. First pot is MAIN.
5. Later pots are SIDE.

## Example 1

Players:

```text
A committed 10 000
B committed 5 000
C committed 2 000
```

No folds.

Pots:

```text
Main pot: 2 000 * 3 = 6 000
Eligible: A, B, C

Side pot 1: (5 000 - 2 000) * 2 = 6 000
Eligible: A, B

Side pot 2: (10 000 - 5 000) * 1 = 5 000
Eligible: A
```

## Example 2 with folded player

Players:

```text
A committed 10 000, active
B committed 5 000, active
C committed 5 000, folded
```

Pots:

```text
Main pot: 5 000 * 3 = 15 000
Eligible: A, B

Side pot: (10 000 - 5 000) * 1 = 5 000
Eligible: A
```

C's chips remain in pot but C cannot win.

## Pot award

At showdown:
1. Calculate pots.
2. For each pot, get eligible players.
3. Evaluate hands only for eligible players.
4. Find best hand.
5. Split if tie.
6. Apply chip awards to seat stacks.
7. Write VirtualPot and VirtualPotAward records.
8. Append action events.

## Tie handling

If pot cannot split evenly:

```text
remainder chips go clockwise from dealer among tied winners
```

## Minimum raise edge case

If player goes all-in for less than a full raise, it may not reopen betting for previous players depending on standard no-limit rules.

For v1, implement standard no-limit behavior carefully. If needed, all-ins are accepted and the legal-action engine determines whether betting reopens based on full raise size.

## Required tests

### Test 1. Single all-in short stack

```text
A 1000 all-in
B 3000 call
C 3000 call
```

Expected:

```text
Main: 3000 eligible A,B,C
Side: 4000 eligible B,C
```

### Test 2. Three all-in levels

```text
A 2000
B 5000
C 10000
```

Expected:

```text
Main: 6000 eligible A,B,C
Side1: 6000 eligible B,C
Side2: 5000 eligible C
```

### Test 3. Folded player chips stay

```text
A 5000 active
B 5000 folded
C 5000 active
```

Pot:

```text
15000 eligible A,C
```

## Acceptance criteria

- No chips disappear.
- No chips are created.
- Sum of stacks after hand equals sum of stacks before hand.
- Folded players never win pots.
- All-in players can win only pots they are eligible for.
- Side pots are persisted and visible in history.

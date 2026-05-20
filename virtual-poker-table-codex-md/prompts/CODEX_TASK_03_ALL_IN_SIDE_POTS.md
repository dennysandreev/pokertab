# CODEX TASK 03 — All-in & Side Pots

## Goal

Implement all-in, side pot calculation and pot awards.

## Tasks

1. Add all-in as legal action.
2. Support all-in call, bet, raise and undercall.
3. Implement side pot calculation.
4. Implement pot eligibility.
5. Implement showdown with multiple pots.
6. Implement tie split with deterministic remainder.
7. Ensure chip conservation.
8. Add tests.

## Required tests

- one short all-in with two callers;
- three different all-in levels;
- folded player contributes but cannot win;
- main pot winner differs from side pot winner;
- tie split with odd chip;
- all chips conserved before/after hand.

## Acceptance criteria

- all-in works;
- side pots are correct;
- no chips disappear or get created;
- tests pass before moving to API.

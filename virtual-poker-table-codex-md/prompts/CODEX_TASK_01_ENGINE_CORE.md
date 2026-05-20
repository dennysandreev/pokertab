# CODEX TASK 01 — Poker Engine Core

## Goal

Create the foundation of `packages/poker-engine`.

## Read first

- `docs/02-game-rules-texas-holdem.md`
- `docs/07-poker-engine-architecture.md`
- `docs/11-hand-evaluator.md`
- `docs/16-testing-acceptance.md`

## Tasks

1. Create `packages/poker-engine`.
2. Add TypeScript strict config.
3. Implement card types.
4. Implement 52-card deck.
5. Implement shuffle function.
6. Implement hand evaluator for 7 cards.
7. Implement hand comparison.
8. Add unit tests for all hand categories.
9. Export public API from `index.ts`.

## Required tests

- deck has 52 unique cards;
- shuffle does not lose/duplicate cards;
- high card;
- one pair;
- two pair;
- trips;
- straight;
- ace-low straight;
- flush;
- full house;
- quads;
- straight flush;
- best 5 from 7;
- compare tied hands.

## Acceptance criteria

- all tests pass;
- no game/API/DB code yet;
- engine package can be imported by backend.

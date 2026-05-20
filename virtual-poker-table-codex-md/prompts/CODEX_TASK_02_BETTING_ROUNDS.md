# CODEX TASK 02 — Betting Rounds & Turn Order

## Goal

Implement core Texas Hold’em betting logic.

## Tasks

1. Define engine state types.
2. Implement dealer/SB/BB assignment.
3. Implement pre-flop turn order.
4. Implement post-flop turn order.
5. Implement legal actions: fold, check, call, bet, raise.
6. Implement applying actions.
7. Implement betting round completion.
8. Implement street advancement.
9. Add tests.

## Required tests

- 3+ player SB/BB assignment;
- heads-up blind rules;
- pre-flop first actor;
- post-flop first actor;
- folded players skipped;
- check only when call amount is zero;
- call amount calculated correctly;
- raise updates current bet;
- round completes when all active players matched bet;
- hand ends if only one player remains.

## Acceptance criteria

- deterministic engine behavior;
- no UI/API code;
- all betting tests pass.

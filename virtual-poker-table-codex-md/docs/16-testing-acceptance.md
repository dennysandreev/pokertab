# 16. Testing & Acceptance Criteria

## Testing priority

The poker engine must be tested before UI is considered done.

## Unit tests — engine

Required:

```text
deck uniqueness
shuffle deterministic with seed
deal hole cards
dealer button movement
SB/BB assignment
pre-flop turn order
post-flop turn order
heads-up rules
legal actions
fold
check
call
bet
raise
all-in
betting round completion
street advancement
showdown
hand evaluator
side pots
pot awards
tie split
sit-out request
sit-out auto-check
sit-out auto-fold
return from sit-out
pause/resume timer behavior
timeout auto-check
timeout auto-fold
```

## Integration tests — API

Required flows:
1. Create virtual table.
2. Join players.
3. Start table.
4. Complete simple hand with folds.
5. Complete hand with showdown.
6. Complete hand with all-in.
7. Complete hand with side pot.
8. Pause table.
9. Resume table.
10. Raise blinds for next hand.
11. Request sit-out.
12. Return from sit-out.
13. Finish table from `ACTIVE` and confirm current hand becomes `CANCELLED` if still open.
14. Cancel table from `WAITING_FOR_PLAYERS` before any hand exists.
15. Reject cancel after gameplay has started.
16. Verify `GET /tables/:tableId` hides other players' private cards.
17. Verify `GET /tables/:tableId/hands/:handId/history` reveals `showdownCards` only for completed, non-folded players.
18. Verify hand history pagination with `limit + nextCursor`.
19. Verify leaderboard pagination with opaque cursor.
20. Verify `GET /stats/me` returns zeroed stats for a user without online hands.

## E2E smoke tests

Flow:

```text
Admin creates table → 3 players join → admin starts → player receives turn state → player acts → hand completes → stats update
```

## Acceptance criteria — gameplay

- only current actor can act;
- illegal actions rejected;
- duplicate action submit with same idempotency key restores original response;
- current actor changes correctly;
- pots update correctly;
- hand advances correctly;
- new hand starts after completed hand;
- table waits if fewer than 2 active players.

## Acceptance criteria — all-in/side pots

- all-in accepted;
- side pots calculated;
- folded players cannot win;
- players only win eligible pots;
- no chips lost/created;
- awards persist in history.

## Acceptance criteria — sit-out

- player can request sit-out;
- auto-check/auto-fold checkboxes saved;
- player becomes sitting out only after passing SB and BB after request;
- sitting out player receives no cards;
- sitting out player does not post blinds;
- player can return from next hand.

## Acceptance criteria — timers

- turn notification sent;
- reminder sent;
- timeout action applied;
- no timer action while paused;
- `currentTimer` state is visible in `GET /tables/:tableId` while timer is unresolved;
- `currentTimer.status` changes from `ACTIVE` to `REMINDED` after reminder delivery;
- `currentTimer` disappears after action resolution, finish, cancel, or pause;
- duplicate timer jobs do not double-act.

## Acceptance criteria — stats

- online stats count only online hands;
- offline stats remain unchanged;
- leaderboard endpoint paginates deterministically by score, hands played, net chips, and user id;
- `stats/me` returns the same DTO shape for both populated and zero-state users.

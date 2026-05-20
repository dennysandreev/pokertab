# AGENTS.md — Virtual Poker Table v1

## Project

This project extends the existing Telegram Mini App poker accounting product with a new module: **Virtual Poker Table v1**.

Virtual Poker Table is an asynchronous Texas Hold’em table with virtual chips only.

## Product boundary

This is not a gambling/payment product.

Do not implement:
- deposits;
- withdrawals;
- internal wallet;
- payment processing;
- real-money betting;
- rake;
- house balance;
- betting odds;
- casino bonuses;
- gambling promotions.

Allowed:
- virtual chips;
- admin-defined chip value for reference only;
- Texas Hold’em gameplay;
- Telegram notifications;
- online hand history;
- online statistics;
- leaderboard filters for offline/online.

## Required scope for v1

Implement:
1. Texas Hold’em.
2. Up to 9 players.
3. Virtual chips only.
4. Admin sets starting stack.
5. Admin sets reference chip value.
6. Fixed blind levels.
7. Admin can raise blinds manually.
8. Blind changes apply from the next hand.
9. One active hand per table.
10. Player actions: fold, check, call, bet, raise, all-in.
11. All-in support.
12. Side pots support.
13. Admin can pause/resume table.
14. Sit-out request mode.
15. Sit-out applies after player passes SB and BB positions.
16. Sit-out auto-check and auto-fold settings.
17. Player can return from sit-out from next hand.
18. Turn timer.
19. Telegram bot notification when it is user's turn.
20. Reminder notification after configured delay.
21. Timeout auto-check / auto-fold.
22. Hand action history.
23. Online stats.
24. Leaderboard filters: all/offline/online.
25. Player profile filters: all/offline/online.

## Technical rules

- Keep poker engine as pure TypeScript functions where possible.
- Do not put game rules directly into controllers or React components.
- Use deterministic engine commands/events.
- Keep hidden/private cards server-side only.
- Client must never receive other players' private cards before showdown.
- Store every player action as an immutable event.
- Use integer values for chips and chip reference value.
- Avoid floating point calculations for chip value.
- All mutating game operations must be transactional.
- Timer jobs must be idempotent.
- Bot notification jobs must be retryable.

## Suggested package structure

```text
packages/
  poker-engine/
    src/
      cards/
      deck/
      evaluator/
      holdem/
      betting/
      side-pots/
      turns/
      sit-out/
      stats/
      index.ts
```

## Testing requirements

Critical areas:
- deck uniqueness;
- dealing;
- pre-flop order;
- post-flop order;
- blinds;
- bet/call/check/raise/fold;
- all-in;
- side pots;
- showdown;
- hand evaluator;
- sit-out;
- timer auto-actions;
- pause/resume;
- online statistics.

Before finalizing any task, run typecheck, lint and tests.

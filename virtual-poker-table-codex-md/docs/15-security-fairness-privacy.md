# 15. Security, Fairness & Privacy

## No real money

The app must not store, transfer, or process money.

Reference chip value is display-only.

UI note:

```text
Игра идет только на виртуальные фишки. Приложение не принимает платежи и не хранит деньги.
```

## Private cards

Critical:
- server stores private cards;
- frontend receives only current user's private cards;
- other players' private cards are hidden until showdown;
- folded mucked cards are not shown unless product later supports reveal.

API must filter response by current user.

## Deck integrity

For v1:
- deck generated server-side;
- shuffle server-side;
- never send deck to client;
- append action/history events.

For v2:
- add provably fair commitment.

## Action validation

Client cannot decide game state.

Client sends:

```text
I want to CALL 300
```

Server validates:
- is this user's seat current actor?
- is action legal?
- is amount legal?
- is hand active?
- is table active?
- is timer valid?

## Idempotency

Player actions must include idempotencyKey. Duplicate action request should not double-apply.

## Timer security

Timeout jobs must check timer status, current actor, table status, hand status and whether player already acted.

## History/audit

All meaningful events are appended: cards dealt event, blinds, actions, auto-actions, sit-out request, pause/resume, blind changes, pot awards.

Do not hard-delete actions.

## Privacy

Virtual poker data can be sensitive:
- play history;
- chip results;
- win/loss stats;
- Telegram usernames.

For v1, ensure:
- table state visible only to members;
- private cards protected;
- profile data follows existing app rules.

## Bot token

Never expose bot token to frontend.

## Abuse prevention

Recommended:
- limit table creation rate;
- limit max open tables per user;
- validate max seats <= 9;
- validate blind values > 0;
- validate starting stack > big blind;
- validate turn timer limits.

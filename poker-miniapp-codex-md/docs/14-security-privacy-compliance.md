# 14. Security, Privacy & Compliance

## Product boundary

The app is an accounting utility for private poker sessions.

Do not implement:
- deposits;
- withdrawals;
- payment accounts;
- wallet balances;
- gambling odds;
- casino games;
- real-money betting interface;
- rake or house commission;
- in-app money transfers.

Allowed:
- manual accounting of buy-ins/rebuys;
- final result calculation;
- manual transfer instructions between participants;
- game history;
- player statistics.

UI boundary:
- do not use payment icons or payment CTAs for manual transfers;
- do not name any action `Оплатить`, `Пополнить`, `Вывести`, `Депозит`, or `Кошелек`;
- settlement can say who should manually transfer money to whom, but the app must not imply
  that it processes or initiates the transfer.

## Authentication

Telegram initData must be validated on backend.

Rules:
- do not trust frontend-provided Telegram user object without validation;
- validate hash;
- check auth_date freshness if appropriate;
- issue backend session token after validation.

## Authorization

Every route must check:
- current user exists;
- current user is room member for private room reads;
- current user is admin/owner for mutations;
- room status allows action.

## Data privacy

Potentially sensitive data:
- Telegram id;
- username;
- game participation;
- profit/loss;
- leaderboard stats.

Privacy recommendations:
- allow nickname in rooms;
- later add "hide from global leaderboard";
- do not expose private rooms publicly;
- final result sharing should be explicit.

## Audit

Financially meaningful actions must be auditable:
- rebuy created;
- rebuy cancelled;
- settlement entered;
- room closed;
- correction after close, if implemented later.

Do not hard-delete rebuy events.

## Invite security

Invite codes:
- must be random;
- must be non-sequential;
- should not expose room id directly if avoidable.

Closed rooms:
- cannot be joined;
- invite link should show closed state.

## Abuse prevention

Basic protections:
- rate limit rebuy creation;
- rate limit room creation if necessary;
- reject extremely large amounts beyond configured limit;
- validate all numeric fields;
- limit room title length.

## Money safety

- use integer minor units;
- avoid floating point;
- use BigInt or safe integer strategy;
- validate currency;
- format only at UI layer.

## Error safety

Do not leak:
- database errors;
- bot token;
- internal stack traces;
- private room data to non-members.

## Bot token

- server-side only;
- never in frontend `.env`;
- never in client bundle;
- rotate if leaked.

## Logs

Do not log:
- full Telegram initData;
- bot token;
- auth tokens.

Safe to log:
- request ids;
- user id internal;
- room id internal;
- high-level action;
- error code.

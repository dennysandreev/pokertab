# CODEX TASK 03 — Rebuys & Active Room

## Goal

Implement active room, player rebuy, admin rebuy management, and rebuy history.

## Read first

- `docs/02-user-flows.md`
- `docs/03-screens-ui-spec.md`
- `docs/04-roles-permissions.md`
- `docs/05-domain-model.md`
- `docs/07-api-contracts.md`
- `docs/12-backend-implementation.md`
- `docs/13-testing-acceptance.md`

## Backend tasks

1. Add Prisma model:
   - RebuyEvent
2. Add enums:
   - RebuyEventSource
   - RebuyEventStatus
3. Implement:
   - `POST /rooms/:roomId/rebuys`
   - `POST /rooms/:roomId/rebuys/:rebuyId/cancel`
   - `GET /rooms/:roomId/rebuys`
4. Enforce rules:
   - room must be RUNNING;
   - player can add rebuy only to self;
   - owner/admin can add rebuy to anyone;
   - amount always equals room.rebuyAmountMinor;
   - cancelled rebuys do not count in totals.
5. Add idempotency key support or duplicate-click protection.

## Frontend tasks

1. Build Active Room Player View.
2. Build Active Room Admin View.
3. Build Rebuy Confirmation Modal.
4. Build Rebuy History screen.
5. Add optimistic or refetch-based updates.
6. Disable buttons while mutation is pending.

## Acceptance criteria

- Player can add own rebuy with confirmation.
- Admin can add rebuy for any player.
- Admin can cancel rebuy.
- Player cannot add rebuy for another player.
- Rebuy history shows actions.
- Totals update correctly.
- Duplicate fast clicks do not create unintended duplicate rebuys.

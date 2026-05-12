# CODEX TASK 04 — Settlement & Final Results

## Goal

Implement settlement input, validation, transfer calculation, and final results.

## Read first

- `docs/03-screens-ui-spec.md`
- `docs/07-api-contracts.md`
- `docs/08-calculations-settlement.md`
- `docs/13-testing-acceptance.md`

## Backend tasks

1. Add Prisma models:
   - Settlement
   - SettlementTransfer
2. Add enums:
   - SettlementStatus
   - SettlementTransferStatus
3. Implement pure calculation functions:
   - calculatePlayerNetResults
   - validateSettlementBalance
   - calculateTransfers
4. Add unit tests for calculation functions.
5. Implement:
   - `POST /rooms/:roomId/settlement/preview`
   - `POST /rooms/:roomId/settlement/close`
6. Closing settlement must:
   - validate admin permission;
   - validate room status;
   - validate all active players have final amount;
   - validate total final amount equals total buy-ins;
   - update RoomPlayer finalAmountMinor and netResultMinor;
   - create Settlement;
   - create SettlementTransfer rows;
   - update room status to CLOSED;
   - set closedAt.

## Frontend tasks

1. Build Settlement Input screen.
2. Show total buy-ins.
3. Show total final amount.
4. Show difference.
5. Disable close if not balanced.
6. Build Final Results screen.
7. Show ranking.
8. Show transfer list.
9. Highlight current user's result.

## Acceptance criteria

- Admin can enter final amounts.
- Difference updates as values change.
- Unbalanced settlement cannot be closed.
- Balanced settlement can be closed.
- Final ranking is correct.
- Transfer list is correct.
- Room becomes read-only after close.

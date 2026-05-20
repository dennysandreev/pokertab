# CODEX TASK 04 — Virtual Table API & Persistence

## Goal

Persist virtual tables/hands and expose API endpoints.

## Tasks

1. Add Prisma models/enums for virtual tables.
2. Create migrations.
3. Implement endpoints:
   - POST `/api/virtual/tables`
   - POST `/api/virtual/tables/join`
   - GET `/api/virtual/tables/:tableId`
   - POST `/api/virtual/tables/:tableId/start`
   - POST `/api/virtual/tables/:tableId/actions`
   - POST `/api/virtual/tables/:tableId/pause`
   - POST `/api/virtual/tables/:tableId/resume`
   - POST `/api/virtual/tables/:tableId/raise-blinds`
   - GET `/api/virtual/tables/:tableId/hands/:handId/history`
4. Integrate poker engine.
5. Filter private cards by current user.
6. Add idempotencyKey to action endpoint.
7. Add integration tests.

## Acceptance criteria

- create/join/start works;
- player actions persist;
- private cards are not leaked;
- admin-only actions protected;
- table state endpoint returns legal actions for current user;
- action endpoint rejects illegal actions.

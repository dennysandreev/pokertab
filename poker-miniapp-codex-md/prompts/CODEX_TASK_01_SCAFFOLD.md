# CODEX TASK 01 — Project Scaffold

## Goal

Create the initial monorepo scaffold for Poker Table.

## Required structure

```text
apps/
  web/
  api/
  bot/

packages/
  shared/
  config/

docs/
prompts/
```

## Stack

- pnpm workspaces
- TypeScript
- React + Vite for `apps/web`
- NestJS for `apps/api`
- simple Node/TypeScript bot service for `apps/bot`
- Prisma + PostgreSQL
- shared types in `packages/shared`

## Tasks

1. Initialize pnpm workspace.
2. Create TypeScript configs.
3. Create `apps/web` with Vite React.
4. Create `apps/api` with NestJS.
5. Create `apps/bot` as TypeScript service.
6. Create `packages/shared`.
7. Add Docker Compose for PostgreSQL.
8. Add Prisma setup in API app.
9. Add root scripts:
   - `dev`
   - `build`
   - `typecheck`
   - `lint`
   - `test`
10. Add simple health endpoint:
   - `GET /health`

## Acceptance criteria

- `pnpm install` works.
- `pnpm typecheck` works.
- `pnpm test` works.
- Web app starts.
- API starts.
- `GET /health` returns `{ "ok": true }`.
- No product features are required yet.

## Notes

Do not overbuild. This task is only infrastructure.

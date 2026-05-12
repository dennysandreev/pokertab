# CODEX TASK 02 — Rooms & Invite Flow

## Goal

Implement room creation, joining, and waiting room.

## Read first

- `docs/01-mvp-scope.md`
- `docs/02-user-flows.md`
- `docs/03-screens-ui-spec.md`
- `docs/04-roles-permissions.md`
- `docs/05-domain-model.md`
- `docs/06-database-prisma.md`
- `docs/07-api-contracts.md`

## Backend tasks

1. Add Prisma models:
   - User
   - Room
   - RoomPlayer
2. Add enums:
   - RoomStatus
   - RoomPlayerRole
   - RoomPlayerStatus
   - GameType
   - RebuyPermission
3. Implement auth placeholder or Telegram auth if Task 01 already supports it.
4. Implement:
   - `GET /rooms`
   - `POST /rooms`
   - `GET /rooms/:roomId`
   - `POST /rooms/join`
   - `POST /rooms/:roomId/start`
5. Generate random invite code.
6. Ensure room creator becomes OWNER and first RoomPlayer.

## Frontend tasks

1. Build Home screen.
2. Build Create Room screen.
3. Build Waiting Room screen.
4. Build Join Room screen.
5. Add basic routing.
6. Add forms and validation.
7. Add API client hooks.

## Acceptance criteria

- User can create room.
- Room appears on Home.
- Invite code exists.
- User can join by invite code.
- Waiting room shows all players.
- Owner can start game.
- Non-owner cannot start game.

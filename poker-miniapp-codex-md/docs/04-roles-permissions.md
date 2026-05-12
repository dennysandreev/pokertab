# 04. Roles & Permissions

## Roles

### OWNER

Создатель комнаты.

Permissions:
- edit room before start;
- invite players;
- start game;
- add rebuy for any player;
- cancel rebuy for any player;
- edit player nickname inside room;
- remove player before game start;
- enter settlement values;
- close game;
- reopen closed game for correction, optional later;
- transfer ownership, optional later.

### ADMIN

Optional later. For MVP, OWNER can be the only admin.

Permissions:
- add rebuy for any player;
- cancel rebuy;
- view full history;
- enter settlement;
- close game if owner allowed.

### PLAYER

Regular participant.

Permissions:
- join room;
- view room;
- add rebuy for self if room settings allow;
- view own and public room totals;
- view history;
- view final results.

### VIEWER

Optional later.

Permissions:
- view shared final results only.

## Permission matrix

| Action | Owner | Admin | Player |
|---|---:|---:|---:|
| Create room | yes | yes | yes |
| Edit room before start | yes | no | no |
| Invite players | yes | yes | no |
| Join room | yes | yes | yes |
| Start game | yes | optional | no |
| Add own rebuy | yes | yes | yes |
| Add rebuy for others | yes | yes | no |
| Cancel rebuy | yes | yes | no |
| View rebuy history | yes | yes | yes |
| Enter final amounts | yes | yes | no |
| Close game | yes | optional | no |
| View final results | yes | yes | yes |

## Room status rules

### DRAFT

Room exists but invite may not be active yet.

Allowed:
- edit settings;
- delete room;
- invite players.

### WAITING

Players can join.

Allowed:
- join;
- leave;
- invite;
- start game.

### RUNNING

Game is active.

Allowed:
- add rebuys;
- view totals;
- view history;
- admin corrections.

Not allowed:
- change rebuy amount;
- change currency;
- change starting stack.

### SETTLEMENT

Admin enters final amounts.

Allowed:
- enter final values;
- preview results;
- return to running if needed.

### CLOSED

Game finalized.

Allowed:
- view results;
- view transfers;
- update leaderboard;
- share results.

Not allowed:
- add rebuys;
- join room;
- edit values, unless correction mode is implemented.

### CANCELLED

Room cancelled.

Allowed:
- view limited info;
- no active actions.

## Critical business rules

1. A player can add rebuy only to self.
2. Admin can add rebuy to any player.
3. Admin can cancel rebuy, but rebuy row must stay in history.
4. Financial actions require confirmation.
5. Closed room is read-only.
6. If correction mode exists, it must create audit events.
7. Every room player must have exactly one `room_players` record per room.
8. Rebuy amount is fixed per room.
9. Settlement is valid only when total final amounts equal total active buy-ins.

# 02. User Flows

## Flow 1. First launch

```text
User opens bot
→ taps Open App
→ Mini App loads
→ backend validates Telegram initData
→ user record is created or updated
→ Home screen opens
```

Acceptance:
- повторный запуск не создает дубль пользователя;
- username и имя обновляются, если изменились в Telegram;
- если есть start_param с room invite — пользователь попадает в Join Room flow.

## Flow 2. Create room

```text
Home
→ Create room
→ enter room name
→ choose currency
→ enter rebuy amount
→ enter starting stack
→ choose rebuy permission
→ Create
→ Waiting Room
```

Validation:
- room name required;
- rebuy amount > 0;
- currency required;
- starting stack optional but if set must be > 0.

## Flow 3. Invite players

```text
Waiting Room
→ Invite players
→ copy link or share link
→ other users open link
→ Join Room screen
```

Invite link format should include a room token or slug.

## Flow 4. Join room

```text
Open invite link
→ Mini App loads
→ room is found
→ Join Room screen
→ Join room
→ user becomes room player
→ Waiting Room or Active Room opens
```

Rules:
- if room is closed, joining is not allowed;
- if user already joined, open the room;
- if user was removed, show blocked state.

## Flow 5. Start game

```text
Waiting Room
→ Admin taps Start game
→ confirmation modal
→ room status becomes RUNNING
→ all players see Active Room
```

Rules:
- only admin can start;
- at least 2 players required;
- after start, room settings are mostly locked.

## Flow 6. Player adds rebuy

```text
Active Room
→ player taps + Rebuy
→ confirmation modal
→ Confirm
→ rebuy event is created
→ player's buy-in total updates
→ history updates
```

Rules:
- player can add rebuy only to self;
- every rebuy has amount equal to room.rebuyAmount;
- duplicate fast taps must not create multiple rebuys unintentionally.

## Flow 7. Admin adds rebuy for player

```text
Admin Room
→ chooses player
→ taps +
→ confirmation modal
→ Confirm
→ rebuy event created by admin for selected player
```

Rules:
- history must show admin action;
- player's total updates.

## Flow 8. Admin cancels rebuy

```text
Admin Room or History
→ selects rebuy
→ Cancel rebuy
→ confirmation modal
→ rebuy status becomes CANCELLED
→ totals update
```

Rules:
- do not delete rebuy rows from DB;
- use soft cancellation;
- keep audit trail.

## Flow 9. Settlement

```text
Admin Room
→ Go to settlement
→ enter final amount for each player
→ app calculates difference
→ if difference = 0, allow Calculate results
→ show Final Results preview
→ Close game
```

Rules:
- only admin can enter settlement;
- if total final amount != total buy-ins, show warning;
- closed game becomes read-only.

## Flow 10. Player views final results

```text
Room closed
→ player opens game
→ Final Results screen
→ sees own result highlighted
→ sees transfers
```

Rules:
- all players can see final results;
- non-players cannot access private room result unless a share page is explicitly created later.

## Flow 11. Leaderboard

```text
Bottom nav → Рейтинг
→ вкладка Все игроки
→ вкладка Играли со мной
→ filter by period
→ open player profile
```

Rules:
- `Играли со мной` включает только пользователей, у которых есть хотя бы одна закрытая общая игра с текущим пользователем;
- use minimum games threshold or confidence factor to avoid one-game distortion.

# 03. User Flows — Virtual Table

## Flow 1. Create virtual table

```text
Home → Create table → choose Virtual Table → enter settings → Create → Virtual Waiting Room
```

Fields:
- table name;
- max players up to 9;
- starting stack;
- reference chip value;
- small blind;
- big blind;
- turn duration;
- reminder delay;
- timeout auto-action rule.

## Flow 2. Join virtual table

```text
Open invite link → Mini App opens → Join Virtual Table screen → Join → seat assigned → Waiting Room
```

v1 can auto-assign seats.

## Flow 3. Start table

```text
Admin opens Waiting Room → taps Start table → first hand is created → blinds posted → cards dealt → first actor notified
```

Validation:
- at least 2 active players;
- max 9 players;
- all players have valid starting stack.

## Flow 4. Player turn

```text
Bot notification → Open table → player sees cards/board/pot/call amount → player selects action → confirms action if needed → action is applied → next player is notified
```

## Flow 5. Turn timeout

```text
Turn starts → initial notification sent → reminder delay passes → if no action, reminder sent → turn duration expires → if no action, system performs auto-action → action is logged → next player is notified
```

Rule:
- if check is legal: auto-check;
- otherwise: auto-fold.

## Flow 6. Admin pauses table

```text
Admin panel → Pause table → confirmation → table status PAUSED → timers stop → players receive notification
```

Resume:

```text
Admin panel → Resume table → timer for current turn restarts
```

## Flow 7. Admin raises blinds

```text
Admin panel → Raise blinds → enter new SB/BB → confirm → pending blind level stored → applies from next hand
```

Current hand is not affected.

## Flow 8. Player requests sit-out

```text
Virtual Table → More actions → Sit out after blinds → modal opens → player selects auto-check / auto-fold → confirm → status SIT_OUT_REQUESTED
```

Player remains in game until passing SB and BB positions.

## Flow 9. Sit-out auto-actions

If player's sit-out request has auto-check, system checks automatically when no call is required.

If player's sit-out request has auto-fold, system folds automatically when call is required.

## Flow 10. Player becomes sitting out

At hand boundary, if sit-out requirements are satisfied:
- player status becomes SITTING_OUT;
- player keeps stack;
- player receives no cards;
- player does not post blinds.

## Flow 11. Player returns

```text
Sitting out player opens table → taps Return to table → status RETURN_REQUESTED → returns from next hand
```

For v1, return is effective only from the next hand.

## Flow 12. Hand completes

```text
Betting ends → showdown or single remaining player → pots distributed → hand history saved → stats updated → next hand starts or table waits
```

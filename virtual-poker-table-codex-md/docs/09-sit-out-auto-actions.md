# 09. Sit-out & Auto-actions

## Goal

Allow long-lived tables to continue without forcing every player to stay active all the time.

## Sit-out request

Player can request:

```text
Выйти после круга
```

This does not remove player immediately.

Player must first pass:
- Small Blind;
- Big Blind.

Then system moves player to:

```text
SITTING_OUT
```

## Why wait for blinds

This prevents abuse where player leaves just before posting blinds.

## Sit-out modal

```text
Выйти из-за стола после круга?

Вы продолжите участвовать в игре, пока не пройдете позиции Small Blind и Big Blind.
После этого вы перейдете в sit-out и не будете получать карты.

Настройки до выхода:

[x] Auto-check, если можно
[x] Auto-fold, если нужно отвечать на ставку

[Подтвердить]
[Отмена]
```

## Settings

### sitOutAutoCheckEnabled

If enabled, when player's turn comes and call amount is 0, system immediately performs AUTO_CHECK.

### sitOutAutoFoldEnabled

If enabled, when player's turn comes and call amount > 0, system immediately performs AUTO_FOLD.

## Important

These settings are voluntary. Do not apply sit-out auto-actions unless player explicitly enabled them.

## Difference from timeout auto-action

Sit-out auto-actions:
- happen immediately on turn;
- only while status is SIT_OUT_REQUESTED;
- only if player enabled check/fold options.

Timeout auto-actions:
- happen after timer expires;
- apply to any player according to table rules.

## Sit-out status transition

When player confirms sit-out request:
- status becomes SIT_OUT_REQUESTED;
- sitOutRequestedAt set;
- auto settings saved;
- blind pass flags reset to false.

At each new hand:
- if seat posts SB after request, mark `hasPassedSmallBlindSinceSitOutRequest = true`;
- if seat posts BB after request, mark `hasPassedBigBlindSinceSitOutRequest = true`.

After hand completion:
- if both flags are true:
  - status becomes SITTING_OUT;
  - player does not receive cards next hand;
  - action event SITTING_OUT appended.

## Sitting out behavior

Player:
- keeps stack;
- remains table member;
- does not receive cards;
- does not post blinds;
- cannot win pots;
- can view table/history;
- can request return.

## Return behavior

Player taps:

```text
Вернуться за стол
```

Set status:

```text
RETURN_REQUESTED
```

At next hand start, if player has stack > 0, status becomes ACTIVE.

## Edge cases

### Player requests sit-out while already SB/BB in current hand

Recommended v1 rule:

```text
Only blinds posted after sitOutRequestedAt count.
```

### Table has fewer than 2 active players after sit-out

Table waits for players.

## History examples

```text
Denis requested sit-out after blinds
Denis enabled auto-check and auto-fold
Denis — Auto-check
Denis posted Small Blind 50
Denis posted Big Blind 100
Denis is now sitting out
Denis requested return to table
Denis returned to table
```

## Tests

Required tests:
- request sit-out;
- auto-check enabled;
- auto-fold enabled;
- auto-action disabled if checkbox off;
- SB pass flag;
- BB pass flag;
- transition to SITTING_OUT after both blinds;
- return from next hand;
- sitting out player does not get cards;
- sitting out player does not post blinds.

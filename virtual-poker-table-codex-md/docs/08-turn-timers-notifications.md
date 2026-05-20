# 08. Turn Timers & Notifications

## Purpose

Because Virtual Table is asynchronous, the system must notify players when it is their turn and prevent the table from being blocked by inactive players.

## Turn lifecycle

```text
Turn assigned
→ create TurnTimer
→ send "your turn" notification
→ wait reminder delay
→ if no action: send reminder
→ wait until expiration
→ if no action: apply auto-action
→ resolve timer
→ create next turn timer
```

## Timer settings

Admin sets turn duration and reminder delay.

Example:

```text
Turn duration: 10 minutes
Reminder: 5 minutes
```

## Timeout auto-action

Default rule:

```text
if check is legal → auto-check
else → auto-fold
```

## Difference between timeout auto-action and sit-out auto-action

| Mechanic | Trigger | Controlled by |
|---|---|---|
| Timeout auto-action | Player does not act before timer expires | Table rule |
| Sit-out auto-action | Player requested sit-out and enabled auto-check/auto-fold | Player |

Sit-out auto-action can execute immediately when player's turn starts, without waiting for timeout.

## Timer idempotency

Before sending reminder:
- check timer status is ACTIVE;
- check current actor is still same seat;
- check table is ACTIVE;
- check hand is still in progress;
- check remindedAt is null.

Before timeout:
- check timer status is ACTIVE or REMINDED;
- check current actor is still same seat;
- check no player action resolved the timer;
- check table is not PAUSED;
- check hand is still in progress.

## Pause behavior

When table is paused:
- active timer resolutionType becomes TABLE_PAUSED or timer is suspended;
- no reminders;
- no timeout auto-actions.

For v1 simplest behavior:

```text
When table resumes, create a fresh timer for current actor.
```

## Notification texts

Turn:

```text
♠️ Ваш ход за столом Poker Weekend

Банк: 1 200 фишек
Нужно доставить: 300 фишек

[Открыть стол]
```

Reminder:

```text
⏰ Напоминание

Сейчас ваш ход за столом Poker Weekend.
Сделайте действие, чтобы игра продолжилась.

[Открыть стол]
```

Auto-check:

```text
Ваш ход был пропущен.

Система выполнила auto-check, потому что ставка не требовалась.
```

Auto-fold:

```text
Ваш ход был пропущен.

Система выполнила auto-fold, потому что время на ход истекло.
```

## Notification intent

Engine should not call Telegram directly.

```ts
type NotificationIntent = {
  type: 'TURN' | 'REMINDER' | 'AUTO_ACTION' | 'TABLE_PAUSED' | 'TABLE_RESUMED';
  userId: string;
  tableId: string;
  handId?: string;
  payload: Record<string, unknown>;
};
```

Backend worker sends messages after DB transaction commits.

## Acceptance criteria

- current player receives turn notification;
- reminder is sent after configured delay;
- timeout auto-action is applied if no action;
- no timeout while table paused;
- duplicate jobs do not double-act;
- next player receives notification after action.

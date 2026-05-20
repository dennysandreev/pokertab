# CODEX TASK 05 — Timers & Telegram Bot Notifications

## Goal

Implement asynchronous turn timers and bot notifications.

## Tasks

1. Add TurnTimer persistence.
2. Create timer worker.
3. On turn assignment:
   - create timer;
   - send turn notification.
4. Send reminder after reminderDelaySeconds.
5. Apply timeout auto-action after turnDurationSeconds.
6. Pause/resume timer behavior.
7. Implement bot notification service.
8. Ensure jobs are idempotent.
9. Add tests for timer edge cases.

## Acceptance criteria

- turn notification sent;
- reminder sent;
- timeout auto-check works;
- timeout auto-fold works;
- no auto-action while paused;
- duplicate jobs do not apply duplicate actions;
- game continues if Telegram notification fails.

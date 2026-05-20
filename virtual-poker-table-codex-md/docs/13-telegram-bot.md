# 13. Telegram Bot — Virtual Table

## Responsibilities

Bot handles:
- start command;
- Mini App launch;
- virtual table invite links;
- turn notifications;
- reminders;
- pause/resume notifications;
- auto-action notices.

## Important

Bot must not process payments.

## Start message

```text
👋 Привет! Это Poker Table.

Здесь можно:
— вести учет домашних покерных игр;
— играть в асинхронный Texas Hold’em на виртуальные фишки;
— получать уведомления, когда наступает ваш ход.

Откройте приложение, чтобы создать стол или присоединиться к игре.
```

## Turn notification

```text
♠️ Ваш ход за столом Poker Weekend

Банк: 1 200 фишек
Нужно доставить: 300 фишек

[Открыть стол]
```

## Reminder notification

```text
⏰ Напоминание

Сейчас ваш ход за столом Poker Weekend.
Сделайте действие, чтобы игра продолжилась.

[Открыть стол]
```

## Auto-check notice

```text
Ваш ход был пропущен.

Система выполнила auto-check, потому что ставка не требовалась.
```

## Auto-fold notice

```text
Ваш ход был пропущен.

Система выполнила auto-fold, потому что время на ход истекло.
```

## Sit-out activated

```text
Вы временно вышли из-за стола Poker Weekend.

Ваш стек сохранен. Вы можете вернуться со следующей новой раздачи.
```

## Table paused

```text
⏸ Стол Poker Weekend поставлен на паузу админом.
```

## Table resumed

```text
▶️ Стол Poker Weekend продолжен.

Если сейчас ваш ход, откройте приложение.
```

## Permission to message users

The Mini App should request write access if needed so the bot can notify users.

Backend must handle cases where user did not grant write access:
- show warning inside Mini App;
- still allow play;
- rely on in-app state.

## Deep link format

Suggested:

```text
https://t.me/<bot_username>/<app_name>?startapp=virtual_table_<inviteCode>
```

## Bot service design

Suggested functions:
- sendTurnNotification(userId, payload)
- sendReminderNotification(userId, payload)
- sendAutoActionNotification(userId, payload)
- sendTablePausedNotification(userIds, payload)
- sendTableResumedNotification(userIds, payload)

## Delivery policy

Do not block game progression if Telegram notification fails.

## Security

Never expose bot token, private cards or auth token.

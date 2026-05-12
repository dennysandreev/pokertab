# 10. Telegram Mini App & Bot

## Responsibilities

### Mini App

Handles:
- UI;
- room management;
- rebuy actions;
- settlement;
- leaderboard;
- profile.

### Bot

Handles:
- `/start`;
- opening Mini App;
- invite links;
- game notifications;
- final result message;
- deep links into rooms.

## Bot commands

### /start

Response:

```text
👋 Привет! Это Poker Table.

Здесь удобно вести домашний покер:
— создавать столы;
— фиксировать ребаи;
— считать итоги;
— понимать, кто кому сколько должен.

Открой приложение, чтобы создать игру или присоединиться к столу.
```

Button:
```text
[Открыть Poker Table]
```

### /help

Response:

```text
Poker Table не принимает платежи и не хранит деньги.
Это инструмент для учета ребаев и расчета итогов приватной игры.
```

## Deep links

Use Telegram start parameter to pass room invite.

Example:
```text
https://t.me/<bot_username>/<app_name>?startapp=room_<inviteCode>
```

The Mini App should parse `start_param`.

If start_param begins with `room_`, open Join Room flow.

## Init data validation

Backend must validate Telegram Mini App initData.

Rules:
- never trust client-only Telegram user data;
- validate hash on backend;
- create or update user only after validation;
- issue app session token after successful validation.

## Invite sharing

Waiting Room should provide:
- copy invite link;
- share in Telegram;
- optional bot message.

Example share text:

```text
Присоединяйся к игре: Покер у Дениса
Ребай: 1 000 ₽
```

## Bot notifications

MVP optional, but useful.

Events:
- game started;
- rebuy added;
- game closed;
- final results available.

### Game started

```text
Игра началась: Покер у Дениса
Ребай: 1 000 ₽
```

### Final result

```text
🏆 Покер у Дениса завершен

Денис: +4 500 ₽
Alexey: +2 000 ₽
Ilya: -1 500 ₽

Открой приложение, чтобы посмотреть переводы.
```

## Security

- Bot token must be server-side only.
- Never expose bot token in frontend.
- Validate all room access on backend.
- Do not allow arbitrary inviteCode enumeration.
- Use random high-entropy invite codes.

## UX inside Telegram

- Large touch targets.
- Avoid heavy page transitions.
- Avoid relying on browser-specific UI.
- Handle Telegram back button if used.
- Handle viewport changes.
- Respect safe areas.

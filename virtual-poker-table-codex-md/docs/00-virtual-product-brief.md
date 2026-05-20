# 00. Virtual Product Brief

## Product module

**Virtual Poker Table v1**

## Core idea

Добавить в Telegram Mini App полноценный виртуальный стол для игры в Texas Hold’em на виртуальные фишки.

Игроки могут играть асинхронно: когда до игрока доходит очередь, бот отправляет уведомление в Telegram. Игрок открывает Mini App, делает действие, после чего ход переходит следующему игроку.

Стол может жить долго: несколько часов, дней или недель.

## Difference from Offline Table

| Mode | Purpose |
|---|---|
| Offline Table | Учет реальной домашней игры: ребаи, финалы, кто кому переводит |
| Virtual Table | Сама игра происходит внутри Mini App на виртуальных фишках |

## Product boundary

Virtual Table uses only virtual chips.

Admin can set chip value, but only as a reference field:

```text
1 chip = 0.10 ₽
```

This allows displaying:

```text
+12 500 chips ≈ +1 250 ₽
```

But the app must not process payments, hold balances, allow deposits/withdrawals, transfer money or collect rake.

## Core value

```text
Асинхронный покерный стол в Telegram:
уведомление → открыть стол → сделать ход → следующий игрок
```

## v1 success criteria

The first version is successful if:
- 2–9 players can complete hands of Texas Hold’em;
- turn order is correct;
- all-in and side pots work;
- bot reliably notifies current player;
- inactivity does not block the game because auto-check/auto-fold works;
- sit-out does not break blinds;
- online results appear in leaderboard/profile separately from offline results.

# 04. UI Screens — Virtual Table

## Navigation changes

Home should allow choosing table type:

```text
[Создать оффлайн-стол]
[Создать виртуальный стол]
```

Leaderboard and Profile gain filter:

```text
Все / Оффлайн / Онлайн
```

## Screen 1. Create Virtual Table

Fields:

```text
Название стола
Максимум игроков: 2–9
Стартовый стек
Стоимость одной фишки
Small Blind
Big Blind
Время на ход
Напоминание через
Auto-action при таймауте
```

Default values:

```text
Max players: 9
Starting stack: 10 000
Chip value: 0.10 ₽
SB/BB: 50 / 100
Turn time: 10 min
Reminder: 5 min
Timeout: auto-check if possible, otherwise auto-fold
```

CTA:

```text
[Создать виртуальный стол]
```

Display note:

```text
Игра идет только на виртуальные фишки. Приложение не принимает платежи и не хранит деньги.
```

## Screen 2. Virtual Waiting Room

```text
Poker Weekend
Ожидание игроков

Игроки: 5 / 9
Стартовый стек: 10 000
Блайнды: 50 / 100
Фишка: 0.10 ₽
Время на ход: 10 мин

[Пригласить игроков]
[Начать стол]
```

## Screen 3. Join Virtual Table

```text
Вас пригласили за виртуальный стол

Poker Weekend

Texas Hold’em
Игроков: 5 / 9
Стартовый стек: 10 000
Блайнды: 50 / 100

Игра идет на виртуальные фишки.

[Присоединиться]
```

## Screen 4. Virtual Table Main

Top:

```text
Poker Weekend
Hand #24
Blinds: 50 / 100
Pot: 1 200
```

Board:

```text
A♠ 7♥ 2♣ K♦
```

Seats:

```text
Denis — 10 500 — Button
Alexey — 8 200 — SB
Ilya — 12 300 — BB
Nikita — Sitting out
Sergey — All-in
```

Player area:

```text
Ваши карты:
A♦ K♣

Ваш ход
Нужно доставить: 300
```

Actions:

```text
[Fold]
[Call 300]
[Raise]
[All-in]
```

If check is available:

```text
[Check]
[Bet]
[Fold]
[All-in]
```

Timer:

```text
Осталось: 04:37
```

## Screen 5. Raise Modal

```text
Raise

Текущая ставка: 300
Минимальный рейз: 600
Ваш стек: 9 700

Введите сумму рейза:
[ 800 ]

[Подтвердить]
[Отмена]
```

## Screen 6. All-in Confirmation

```text
Подтвердить all-in?

Вы ставите весь стек:
9 700 фишек

[All-in]
[Отмена]
```

## Screen 7. Admin Panel

```text
Управление столом

Текущие блайнды: 50 / 100
Следующие блайнды: не заданы

[Поставить на паузу]
[Поднять блайнды]
[История раздач]
[Завершить стол]
```

## Screen 8. Raise Blinds Modal

```text
Поднять блайнды

Текущие: 50 / 100
Новые:

Small Blind [100]
Big Blind [200]

Изменение применится со следующей раздачи.

[Подтвердить]
[Отмена]
```

## Screen 9. Sit-out Modal

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

## Screen 10. Sitting Out State

```text
Вы временно вне игры

Ваш стек: 8 450 фишек
Вы не получаете карты и не ставите блайнды.

[Вернуться за стол]
```

## Screen 11. Hand History

```text
Hand #24

Denis — Small Blind 50
Alexey — Big Blind 100
Ilya — Call 100
Nikita — Raise 300
Sergey — Fold

Flop: A♠ 7♥ 2♣

Denis — Check
Alexey — Bet 500
Ilya — Fold
Nikita — Call 500

Showdown:
Alexey — A♦ K♣
Nikita — A♥ Q♥

Alexey wins 6 400 chips
```

## Screen 12. Online Leaderboard

Filter:

```text
Все / Оффлайн / Онлайн
```

Online row:

```text
#1 Denis
Online Poker Score: 82

+12 500 chips
248 hands
BB/100: +8.4
Win rate: 16.5%
```

# 03. Screens UI Spec

## Global UI

### Product language

All user-facing UI copy must be in Russian for MVP.

English text in existing Stitch/HTML prototypes is a visual placeholder only.
Do not ship labels like `Create Room`, `Poker at Denis`, `Recent games`, or `Join Table`.

Use natural product copy:
- `Создать стол`
- `Покер у Дениса`
- `Последние игры`
- `Присоединиться`

Avoid technical field-name style:
- `Наименование комнаты`
- `Поле для ввода суммы`
- `Подтверждение выполнения действия`

Avoid payment or casino semantics in UI:
- no `Депозит`;
- no `Кошелек`;
- no `Оплатить`;
- no casino-style calls to action.

The app may show manual transfer instructions after settlement, but it must not look like
it processes payments.

### Theme

Dark mode.

Suggested palette:
- background: `#0E1117`
- card: `#171B23`
- elevated card: `#1F2430`
- positive: emerald/green
- negative: soft red
- warning: orange
- text primary: white
- text secondary: gray

### Navigation

Bottom tabs:
1. Игры
2. Рейтинг
3. Профиль

Inside an active room, bottom navigation can be hidden or compressed.

## Screen 1. Home / Игры

### Purpose

Показывает активные и последние игры.

### Elements

Header:
```text
Poker Table
Добрый вечер, Денис
```

CTA card:
```text
Создать покерный стол
Задайте ребай, пригласите игроков и начните учет игры.
[Создать стол]
```

Active games card:
```text
Покер у Дениса
Игра идет
6 игроков
Ребай: 1 000 ₽
Твои закупы: 3 000 ₽
[Открыть]
```

Последние игры:
```text
Friday Poker
Завершена вчера
Результат: +4 500 ₽
```

Empty state:
```text
Игр пока нет
Создайте первый стол и пригласите друзей.
[Создать стол]
```

## Screen 2. Создание стола

Fields:
- Название игры
- Валюта
- Сумма ребая
- Стартовый стек
- Формат игры
- Кто может добавлять ребаи

Default:
```text
Игроки могут добавлять ребаи себе
```

CTA:
```text
[Создать стол]
```

Validation messages:
- Укажите название комнаты
- Сумма ребая должна быть больше 0
- Выберите валюту

## Screen 3. Waiting Room

Admin view:
```text
Покер у Дениса
Ожидание игроков

Ребай: 1 000 ₽
Стартовый стек: 10 000 фишек
Игроков: 4

Денис — Админ
Alexey
Ilya
Nikita

[Пригласить игроков]
[Начать игру]
```

Player view:
```text
Вы присоединились к игре
Ожидаем, пока админ начнет игру
```

## Screen 4. Join Room

```text
Вас пригласили в игру

Покер у Дениса

Ребай: 1 000 ₽
Стартовый стек: 10 000 фишек
Уже в игре: 5 игроков

[Присоединиться]
```

If room closed:
```text
Игра уже завершена
Присоединиться нельзя
```

## Screen 5. Active Room — Player View

Top card:
```text
Покер у Дениса
Игра идет

Ребай: 1 000 ₽
Общий банк: 18 000 ₽
Игроков: 6
```

Personal card:
```text
Твои закупы

3 ребая
3 000 ₽ всего

Последний ребай: 22:14
```

Main CTA:
```text
[+ Ребай — 1 000 ₽]
```

Players:
```text
Денис — 3 000 ₽
Alexey — 2 000 ₽
Ilya — 4 000 ₽
Nikita — 1 000 ₽
```

Secondary:
```text
История ребаев
```

## Screen 6. Active Room — Admin View

Top card:
```text
Покер у Дениса
Режим админа

Ребай: 1 000 ₽
Общий банк: 24 000 ₽
Игроков: 7
```

Player cards:
```text
Денис
3 ребая · 3 000 ₽
[-] [+]

Alexey
2 ребая · 2 000 ₽
[-] [+]
```

Admin actions:
```text
[Добавить игрока]
[История]
[Перейти к расчету]
[Закрыть игру]
```

## Screen 7. Rebuy Confirmation Modal

Player:
```text
Подтвердить ребай?

Вы добавляете один ребай:
1 000 ₽

Ваши закупы станут:
4 000 ₽

[Подтвердить]
[Отмена]
```

Admin:
```text
Добавить ребай для Alexey?

Сумма:
1 000 ₽

Закупы игрока станут:
3 000 ₽

[Подтвердить]
[Отмена]
```

## Screen 8. Rebuy History

```text
История ребаев
Покер у Дениса

22:41 — Ilya добавил ребай — 1 000 ₽
22:15 — Denis добавил ребай — 1 000 ₽
21:58 — Админ добавил ребай для Alexey — 1 000 ₽
21:20 — Nikita присоединился
21:05 — Игра началась
```

Cancelled event:
```text
22:41 — Ilya добавил ребай — 1 000 ₽
22:45 — Ребай отменен админом
```

## Screen 9. Settlement Input

Top card:
```text
Расчет игры

Всего закупов:
24 000 ₽

Введено финальных сумм:
21 000 ₽

Расхождение:
-3 000 ₽
```

Warning:
```text
Баланс не сходится. Проверьте финальные суммы перед закрытием игры.
```

Player input card:
```text
Денис
Закупы: 3 000 ₽
Финал: [7 500 ₽]
Результат: +4 500 ₽
```

CTA:
```text
[Рассчитать итоги]
```

CTA disabled if difference is not zero.

## Screen 10. Final Results

Top:
```text
Игра завершена

Покер у Дениса
7 игроков
Общий банк: 24 000 ₽
```

Ranking:
```text
1. Денис
+4 500 ₽
Закупы: 3 000 ₽ · Финал: 7 500 ₽

2. Alexey
+2 000 ₽
Закупы: 2 000 ₽ · Финал: 4 000 ₽

3. Ilya
-1 500 ₽
Закупы: 4 000 ₽ · Финал: 2 500 ₽
```

Transfers:
```text
Переводы

Ilya → Denis
1 500 ₽

Nikita → Denis
3 000 ₽

Sergey → Alexey
2 000 ₽
```

Actions:
```text
[Поделиться итогами]
[Назад к играм]
```

## Screen 11. Leaderboard

Tabs:
```text
Все игроки
Играли со мной
```

Filters:
```text
Все время
Этот месяц
Последние 10 игр
```

Player row:
```text
#1 Денис
+45 500 ₽
23 игры

ROI 18% · Win rate 61% · Avg +1 978 ₽
Poker Score 84
```

## Screen 12. Player Profile

Top:
```text
Денис
@username

Poker Score
84
```

Stats:
```text
Общий результат: +45 500 ₽
Игр сыграно: 23
ROI: 18%
Win rate: 61%
```

Additional:
```text
Лучшая игра: +8 500 ₽
Худшая игра: -4 000 ₽
Средний ребай: 2.7 за игру
Средний результат: +1 978 ₽
```

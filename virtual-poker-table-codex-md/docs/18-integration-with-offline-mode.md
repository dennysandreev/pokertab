# 18. Integration with Existing Offline Mode

## Existing modes

The app now has two core modes:

```text
Offline Table
Virtual Table
```

## Home screen changes

Add table type chooser:

```text
Создать стол

[Оффлайн-стол]
Учет реальной игры, ребаев и финальных переводов.

[Виртуальный стол]
Texas Hold’em внутри приложения на виртуальные фишки.
```

## Database separation

Do not force virtual table into offline room tables.

Recommended:
- keep existing `Room`, `RoomPlayer`, `RebuyEvent`, `Settlement`;
- add new `VirtualTable`, `VirtualSeat`, `VirtualHand`, etc.

## Shared concepts

Can share:
- User;
- Telegram auth;
- bot service;
- leaderboard UI shell;
- profile page shell;
- money/chip formatting utilities;
- access control helpers.

## Leaderboard integration

Add filter:

```text
Все / Оффлайн / Онлайн
```

### Offline

Show:
- Offline Poker Score;
- total profit;
- ROI;
- win rate;
- games played.

### Online

Show:
- Online Poker Score;
- net chips;
- hands played;
- BB/100;
- hand win rate.

### All

Recommended v1: show two separate cards rather than one combined score.

## Profile integration

Add same filter:

```text
Все / Оффлайн / Онлайн
```

All mode shows summary cards for both modes.

## Bot integration

Existing bot can handle both:
- offline invite links;
- virtual table invite links;
- virtual turn notifications.

Use startapp params:

```text
offline_room_<code>
virtual_table_<code>
```

## Product warning

Because virtual table has chip value, UI must make clear:

```text
Стоимость фишки используется только для справочного пересчета. Приложение не принимает платежи и не хранит деньги.
```

## Feature flag

Add:

```text
virtualTablesEnabled
```

# 14. Online Statistics & Leaderboard

## Goal

Add online statistics without breaking existing offline leaderboard.

## Filters

Leaderboard filter:

```text
Все / Оффлайн / Онлайн
```

Player profile filter:

```text
Все / Оффлайн / Онлайн
```

## Offline vs Online

Offline stats are session-based:
- games played;
- total profit;
- ROI;
- win rate;
- stability;
- offline poker score.

Online stats are hand-based:
- hands played;
- hands won;
- net chips;
- BB/100;
- hand win rate;
- online poker score.

Do not use the same formula blindly.

## Online metrics

### Hands played

Count hands where player was dealt private cards.

### Hands won

Count hands where player received any pot award.

### Net chips

For per-hand stats:

```text
handNet = chipsAwarded - chipsCommitted
```

### Estimated result

Using reference chip value:

```text
netEstimatedMinor = netChips * chipValueMinor
```

Only display reference estimate. Do not treat as money balance.

### Win rate

```text
winRate = handsWon / handsPlayed
```

### BB/100

```text
BB/100 = netBigBlinds / handsPlayed * 100
```

Where netBigBlinds uses the hand's big blind at time of hand.

## Online Poker Score

Suggested formula:

```text
Online Poker Score =
40% BB/100 Score
+ 25% Win Rate Score
+ 20% Stability Score
+ 15% Volume Confidence
```

### BB/100 Score

Normalize BB/100 into 0..100:

```text
-50 BB/100 = 0
0 BB/100 = 50
+50 BB/100 = 100
```

Clamp values beyond range.

### Volume Confidence

By hands played:

```text
1–20 hands: 20
21–50 hands: 50
51–100 hands: 75
100+ hands: 100
```

## Overall filter

Recommended v1:

```text
All = display offline and online cards separately.
```

## Leaderboard online row

```text
#1 Denis
Online Poker Score: 82

+12 500 chips
248 hands
BB/100: +8.4
Win rate: 16.5%
```

## Profile online block

```text
Online stats

Hands played: 248
Hands won: 41
Net chips: +12 500
Estimated result: +1 250 ₽
BB/100: +8.4
Average per hand: +50 chips
```

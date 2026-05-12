# 09. Leaderboard & Statistics

## Leaderboard scopes

### Все игроки

Global users who opted into public leaderboard.

MVP can show all app users by default, but add privacy field later.

### Играли со мной

Players who shared at least one closed room with current user.

This is the most important social leaderboard.

Query logic:
- find all closed rooms where current user was active player;
- find all active players in those rooms;
- aggregate stats for those users.

## Period filters

MVP:
- All time
- This month
- Last 10 games

Later:
- Last 30 days
- Current season
- Club-specific period

## Core metrics

### 1. Total profit

```ts
totalProfitMinor = sum(netResultMinor across closed games)
```

UI:
```text
+45 500 ₽
```

### 2. Games played

```ts
gamesCount = count(closed rooms where user was active player)
```

### 3. Total buy-ins

```ts
totalBuyinsMinor = sum(totalBuyinMinor across closed games)
```

### 4. ROI

```ts
roi = totalProfit / totalBuyins
```

Basis points:

```ts
roiBps = totalBuyinsMinor === 0
  ? 0
  : Number((totalProfitMinor * 10000n) / totalBuyinsMinor)
```

UI:
```text
ROI 18%
```

### 5. Win rate

```ts
winRate = positiveGames / gamesCount
```

Positive game means:
```ts
netResultMinor > 0
```

Basis points:
```ts
winRateBps = gamesCount === 0
  ? 0
  : Math.round((positiveGames / gamesCount) * 10000)
```

### 6. Average result

```ts
avgProfitMinor = totalProfitMinor / gamesCount
```

### 7. Stability score

Goal: show how often the player avoids large negative sessions.

MVP formula:

```ts
stableGames = games where netResultMinor >= -room.rebuyAmountMinor
stabilityScore = stableGames / gamesCount
```

Meaning:
- if player loses less than or equal to one rebuy, it is still a stable game;
- if player often loses many rebuys, stability is lower.

Basis points:
```ts
stabilityScoreBps = Math.round((stableGames / gamesCount) * 10000)
```

### 8. Volume confidence

This prevents one lucky game from making a player #1.

```ts
function volumeConfidence(gamesCount: number): number {
  if (gamesCount <= 0) return 0;
  if (gamesCount <= 2) return 20;
  if (gamesCount <= 5) return 50;
  if (gamesCount <= 10) return 75;
  return 100;
}
```

### 9. Poker Score

MVP formula should be understandable, not mathematically overcomplicated.

Suggested normalized metrics:
- ROI score: clamp ROI from -50% to +50% into 0..100
- Win rate score: 0..100
- Stability score: 0..100
- Volume confidence: 0..100

Formula:

```ts
pokerScore =
  roiScore * 0.4 +
  winRateScore * 0.3 +
  stabilityScore * 0.2 +
  volumeConfidence * 0.1
```

Round to integer 0..100.

## ROI score normalization

```ts
function normalizeRoiToScore(roiBps: number): number {
  const min = -5000; // -50%
  const max = 5000;  // +50%
  const clamped = Math.max(min, Math.min(max, roiBps));
  return Math.round(((clamped - min) / (max - min)) * 100);
}
```

Examples:
- -50% ROI = 0
- 0% ROI = 50
- +50% ROI = 100

## Privacy notes

Later add:
- hide from global leaderboard;
- show only nickname;
- show only to people I played with;
- hide exact total profit but show score.

## Leaderboard row UI

```text
#1 Денис
+45 500 ₽
23 игры

ROI 18% · Win rate 61% · Avg +1 978 ₽
Poker Score 84
```

## Ranking rules

Default ranking:
1. Poker Score desc
2. gamesCount desc
3. totalProfit desc

Alternative sorting:
- by total profit;
- by ROI;
- by win rate;
- by avg result.

## Important tests

1. One game winner should not automatically dominate leaderboard because volume confidence is low.
2. Player with high total profit but negative ROI should not rank too high by Poker Score.
3. Player with no games should not appear.
4. `Играли со мной` should not include unrelated users.
5. Cancelled rooms should not affect stats.
6. Only closed rooms should affect stats.

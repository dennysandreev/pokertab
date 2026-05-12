# CODEX TASK 05 — Leaderboard & Player Profile

## Goal

Implement basic player statistics, leaderboard, and profile screens.

## Read first

- `docs/09-leaderboard-statistics.md`
- `docs/03-screens-ui-spec.md`
- `docs/07-api-contracts.md`
- `docs/13-testing-acceptance.md`

## Backend tasks

1. Add or finalize PlayerStats model.
2. Implement stats recalculation after room close.
3. Calculate:
   - gamesCount;
   - totalBuyinsMinor;
   - totalProfitMinor;
   - avgProfitMinor;
   - roiBps;
   - winRateBps;
   - stabilityScoreBps;
   - pokerScore.
4. Implement:
   - `GET /leaderboard`
   - `GET /players/:userId/profile`
5. Support scopes:
   - `all`
   - `played-with-me`
6. Support period filters:
   - `all-time`
   - `month`
   - `last-10`

## Frontend tasks

1. Build Leaderboard screen.
2. Add tabs:
   - Все игроки
   - Играли со мной
3. Add period filters.
4. Build LeaderboardRow.
5. Build Player Profile screen.
6. Show recent games.

## Acceptance criteria

- Closed games update stats.
- Cancelled rooms do not affect stats.
- Unclosed rooms do not affect stats.
- Leaderboard sorts by Poker Score by default.
- Played-with-me scope excludes unrelated players.
- Player profile shows correct aggregate metrics.

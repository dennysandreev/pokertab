# CODEX TASK 07 — Online Stats & Leaderboard Filters

## Goal

Add online statistics and filters for leaderboard/profile.

## Tasks

1. Implement OnlinePlayerStats aggregation.
2. Update stats after completed hands.
3. Calculate handsPlayed, handsWon, netChips, netEstimatedMinor, winRateBps, BB/100, avgChipsPerHand and onlinePokerScore.
4. Add leaderboard filter: All / Offline / Online.
5. Add profile filter: All / Offline / Online.
6. Ensure offline stats remain unchanged.
7. Add tests.

## Acceptance criteria

- online stats count only online hands;
- sitting out hands do not count;
- offline leaderboard still works;
- online leaderboard displays online metrics;
- profile can switch between all/offline/online;
- All mode shows both offline and online summary cards.

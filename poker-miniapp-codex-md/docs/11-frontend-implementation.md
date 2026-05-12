# 11. Frontend Implementation

## Stack

- React
- TypeScript
- Vite
- Tailwind CSS
- shadcn/ui
- TanStack Query
- Zustand or simple React context for session state
- React Router

## App routes

```text
/
  Home

/create-room
  CreateRoom

/join/:inviteCode
  JoinRoom

/rooms/:roomId
  RoomRouter
  - WaitingRoom
  - ActiveRoomPlayer
  - ActiveRoomAdmin
  - SettlementInput
  - FinalResults

/rooms/:roomId/history
  RebuyHistory

/leaderboard
  Leaderboard

/profile
  MyProfile

/players/:userId
  PlayerProfile
```

## App bootstrap

On load:
1. Read Telegram WebApp initData.
2. Send initData to backend.
3. Receive access token and user.
4. Store token in memory or secure app state.
5. If start_param is room invite, navigate to join flow.
6. Otherwise open Home.

## State management

Use TanStack Query for server state:
- rooms;
- room details;
- rebuy history;
- settlement preview;
- leaderboard;
- profile.

Use local state for:
- modals;
- forms;
- draft final amounts;
- selected filters.

## Components

### Layout

- `AppShell`
- `BottomNav`
- `PageHeader`
- `SafeAreaView`

### Rooms

- `RoomCard`
- `CreateRoomForm`
- `WaitingRoom`
- `JoinRoomCard`
- `ActiveRoomHeader`
- `PlayerBuyinCard`
- `PlayerList`
- `AdminPlayerCard`
- `RebuyConfirmModal`
- `RebuyHistoryList`
- `SettlementPlayerInput`
- `SettlementSummary`
- `FinalRanking`
- `TransferList`

### Leaderboard

- `LeaderboardTabs`
- `PeriodFilter`
- `LeaderboardRow`
- `PlayerStatsCard`

### Shared

- `Money`
- `StatPill`
- `ConfirmDialog`
- `EmptyState`
- `LoadingState`
- `ErrorState`

## Money formatting

Create utility:

```ts
formatMoney(amountMinor: bigint | number, currency: string): string
```

Rules:
- RUB: show no decimals by default;
- USD/EUR: show two decimals if needed;
- positive values with `+`;
- negative values with `-`.

Examples:
```text
+4 500 ₽
-1 000 ₽
1 000 ₽
```

## Rebuy UX

When user taps main rebuy button:
1. open confirmation modal;
2. disable confirm button while request is in progress;
3. send idempotency key;
4. on success close modal and refresh room;
5. on error show toast.

## Settlement UX

Use controlled inputs for final amounts.

For each input change:
- update local draft;
- calculate local difference;
- optionally call preview endpoint after debounce;
- disable close if difference is not zero.

## Error handling

Show user-friendly messages:

- Room not found:
  ```text
  Комната не найдена
  ```

- Room closed:
  ```text
  Игра уже завершена
  ```

- Not admin:
  ```text
  Это действие доступно только админу
  ```

- Settlement not balanced:
  ```text
  Баланс не сходится
  ```

## Loading states

Use skeleton cards.

Avoid blank screens.

## Empty states

Home:
```text
Игр пока нет
Создайте первый стол и пригласите друзей.
```

Leaderboard:
```text
Статистики пока нет
Сыграйте первую завершенную игру.
```

## Accessibility

- Buttons at least 44px height.
- Do not rely on color only for positive/negative values.
- Use signs `+` and `-`.
- Use readable font sizes.

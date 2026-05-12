# 13. Testing & Acceptance Criteria

## Testing levels

### Unit tests

Required for:
- money formatting;
- room status transitions;
- rebuy permissions;
- settlement validation;
- transfer algorithm;
- leaderboard formulas;
- poker score normalization.

### Integration tests

Required for:
- create room;
- join room;
- start room;
- add rebuy;
- cancel rebuy;
- close settlement.

### E2E smoke tests

Required for main flow:
1. user creates room;
2. second user joins;
3. admin starts room;
4. both add rebuys;
5. admin enters final amounts;
6. game closes;
7. final results appear.

## Acceptance criteria by feature

### Create room

Given valid form data:
- room is created;
- creator becomes owner;
- creator is added as room player;
- invite code is generated;
- status is WAITING.

Invalid:
- empty title rejected;
- zero/negative rebuy rejected;
- missing currency rejected.

### Join room

Given valid invite:
- user joins room;
- duplicate join returns existing membership;
- closed room cannot be joined.

### Start room

Given owner and at least 2 active players:
- status changes to RUNNING;
- startedAt is set.

Invalid:
- non-admin cannot start;
- room with fewer than 2 players cannot start.

### Add rebuy

Given running room:
- player can add rebuy to self;
- admin can add rebuy to any player;
- rebuy amount equals room rebuy amount;
- history event is created;
- totals update.

Invalid:
- player cannot add rebuy to another player;
- rebuy cannot be added to closed room;
- rebuy cannot be added before start.

### Cancel rebuy

Given admin:
- rebuy status becomes CANCELLED;
- cancelledAt is set;
- cancelledByUserId is set;
- totals exclude cancelled rebuy.

Invalid:
- player cannot cancel rebuy;
- already cancelled rebuy cannot be cancelled again.

### Settlement preview

Given final amounts:
- net result is calculated for every player;
- total final amount is compared with total buy-ins;
- transfers are calculated only if balance is zero.

Invalid:
- missing player final amount rejected;
- negative final amount rejected unless explicitly allowed later;
- unbalanced settlement returns warning/error.

### Close settlement

Given balanced settlement:
- room status becomes CLOSED;
- closedAt is set;
- final amounts stored;
- net results stored;
- settlement created;
- transfers created;
- stats updated.

Invalid:
- unbalanced settlement cannot close;
- non-admin cannot close;
- already closed room cannot close again.

### Leaderboard

Given closed games:
- only closed rooms count;
- cancelled rooms do not count;
- gamesCount correct;
- totalProfit correct;
- ROI correct;
- winRate correct;
- pokerScore in range 0..100.

## Critical test cases

### Transfer algorithm

```text
A +4500
B +2000
C -1500
D -3000
E -2000
```

Expected:
- total transfer amount = 6500;
- A receives 4500;
- B receives 2000;
- C pays 1500;
- D pays 3000;
- E pays 2000.

### Balance validation

```text
Total buy-ins: 24000
Total final: 23500
Difference: -500
```

Expected:
- close button disabled;
- warning visible.

### Duplicate rebuy tap

Given user taps confirm twice quickly:
- at most one rebuy is created for the same idempotency key.

## Manual QA checklist

- App opens inside Telegram.
- Invite link opens correct room.
- Back navigation does not break room state.
- Rebuy button is large and easy to tap.
- Confirmation modal prevents accidental rebuy.
- Admin mode is visually distinct.
- Final results are understandable.
- Positive and negative values are clear.
- Transfer list is easy to read.

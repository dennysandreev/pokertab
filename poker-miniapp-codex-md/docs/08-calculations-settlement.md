# 08. Calculations & Settlement

## Money representation

Use integer minor units.

Examples:
- 1 000 ₽ = 100000 kopecks
- 10.50 USD = 1050 cents

Never use floating point for money calculations.

## Player buy-in calculation

Only active rebuy events count.

```ts
totalBuyinMinor = sum(
  rebuy.amountMinor where rebuy.status === 'ACTIVE'
)
```

## Player net result

```ts
netResultMinor = finalAmountMinor - totalBuyinMinor
```

Examples:

| Player | Buy-ins | Final | Net |
|---|---:|---:|---:|
| Denis | 3 000 ₽ | 7 500 ₽ | +4 500 ₽ |
| Ilya | 4 000 ₽ | 2 500 ₽ | -1 500 ₽ |

## Room balance

```ts
totalBuyinsMinor = sum(players.totalBuyinMinor)
totalFinalAmountMinor = sum(players.finalAmountMinor)
differenceMinor = totalFinalAmountMinor - totalBuyinsMinor
```

Settlement is valid only if:

```ts
differenceMinor === 0
```

If difference is positive:
```text
Финальных сумм введено больше, чем закупов.
```

If difference is negative:
```text
Финальных сумм введено меньше, чем закупов.
```

## Transfer optimization

Goal:

Create minimal list of transfers from losers to winners.

Input:

```ts
[
  { playerId: 'denis', net: 450000 },
  { playerId: 'alexey', net: 200000 },
  { playerId: 'ilya', net: -150000 },
  { playerId: 'nikita', net: -300000 },
  { playerId: 'sergey', net: -200000 }
]
```

Output:

```ts
[
  { from: 'nikita', to: 'denis', amount: 300000 },
  { from: 'sergey', to: 'denis', amount: 150000 },
  { from: 'sergey', to: 'alexey', amount: 50000 },
  { from: 'ilya', to: 'alexey', amount: 150000 }
]
```

## Algorithm

1. Split players:
   - creditors: netResultMinor > 0
   - debtors: netResultMinor < 0
2. Sort creditors by amount descending.
3. Sort debtors by absolute amount descending.
4. Use two pointers.
5. Match debtor to creditor by min(debt, credit).
6. Reduce both amounts.
7. Move pointer when amount reaches zero.

## Pseudocode

```ts
type NetPlayer = {
  roomPlayerId: string;
  displayName: string;
  netResultMinor: bigint;
};

type Transfer = {
  fromRoomPlayerId: string;
  toRoomPlayerId: string;
  amountMinor: bigint;
};

export function calculateTransfers(players: NetPlayer[]): Transfer[] {
  const creditors = players
    .filter(p => p.netResultMinor > 0n)
    .map(p => ({ ...p, remaining: p.netResultMinor }))
    .sort((a, b) => Number(b.remaining - a.remaining));

  const debtors = players
    .filter(p => p.netResultMinor < 0n)
    .map(p => ({ ...p, remaining: -p.netResultMinor }))
    .sort((a, b) => Number(b.remaining - a.remaining));

  const transfers: Transfer[] = [];
  let i = 0;
  let j = 0;

  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i];
    const creditor = creditors[j];
    const amount = debtor.remaining < creditor.remaining
      ? debtor.remaining
      : creditor.remaining;

    if (amount > 0n) {
      transfers.push({
        fromRoomPlayerId: debtor.roomPlayerId,
        toRoomPlayerId: creditor.roomPlayerId,
        amountMinor: amount,
      });
    }

    debtor.remaining -= amount;
    creditor.remaining -= amount;

    if (debtor.remaining === 0n) i++;
    if (creditor.remaining === 0n) j++;
  }

  return transfers;
}
```

## Validation tests

### Test 1. Balanced simple case

Input:
- A +1000
- B -1000

Output:
- B → A: 1000

### Test 2. Multiple debtors

Input:
- A +3000
- B -1000
- C -2000

Output:
- C → A: 2000
- B → A: 1000

### Test 3. Multiple creditors and debtors

Input:
- A +2500
- B +500
- C -2000
- D -1000

Expected total transfers:
- 3000 total
- all creditor amounts satisfied
- all debtor amounts satisfied

### Test 4. Zero players ignored

Input:
- A +1000
- B -1000
- C 0

Output:
- B → A: 1000
- C ignored

### Test 5. Unbalanced settlement rejected

Input:
- A +1000
- B -900

Expected:
- throw validation error before transfers.

## UX rules

If settlement is invalid:
- show difference;
- disable close button;
- allow draft save later, optional.

If valid:
- show preview;
- allow close game;
- after close, write snapshot to DB.

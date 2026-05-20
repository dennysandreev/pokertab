# 01. Virtual Table v1 Scope

## Must-have features

### Game format

```text
Texas Hold’em
Up to 9 players
Virtual chips only
One active hand per table
Asynchronous turn-based gameplay
```

### Table settings

Admin sets:
- table name;
- maximum seats, up to 9;
- starting stack;
- reference chip value;
- small blind;
- big blind;
- turn duration;
- reminder delay;
- timeout auto-action rule.

### Player actions

Support:
- fold;
- check;
- call;
- bet;
- raise;
- all-in.

### Betting logic

Support:
- blinds;
- pre-flop;
- flop;
- turn;
- river;
- showdown;
- all-in;
- side pots;
- pot distribution.

### Admin controls

Admin can:
- pause table;
- resume table;
- raise blinds;
- end table;
- view full history.

### Blind levels

Blinds are fixed after table creation but admin can manually raise them.

Rule:

```text
Blind changes apply only from the next hand.
```

### Sit-out

Player can request sit-out.

Rule:

```text
Player becomes sitting out after passing both Small Blind and Big Blind positions.
```

While sit-out requested, player can enable:
- auto-check;
- auto-fold.

### Timer and auto-actions

Each turn has timer.

If player does not act:
- reminder is sent after configured delay;
- when time expires:
  - auto-check if check is legal;
  - otherwise auto-fold.

### Online statistics

Track:
- hands played;
- hands won;
- net chips;
- estimated result by reference chip value;
- win rate;
- big blinds won;
- BB/100;
- average result per hand;
- online poker score.

## Explicitly out of scope for v1

- real money;
- deposits/withdrawals;
- wallet;
- payments;
- multi-table tournaments;
- scheduled tournaments;
- automatic blind schedule;
- club seasons;
- chat;
- voice;
- video;
- animations-heavy poker table;
- provably fair cryptographic proof.

## Risk areas

High-risk features:
1. All-in.
2. Side pots.
3. Correct betting round closure.
4. Correct turn order with folds/all-ins/sit-outs.
5. Timer jobs idempotency.
6. Hidden card security.
7. Showdown evaluation.

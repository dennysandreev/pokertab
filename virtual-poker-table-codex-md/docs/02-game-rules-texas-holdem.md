# 02. Game Rules — Texas Hold’em

## Seats

Table supports up to 9 seats.

Each seat can be empty, active, sitting out, sit-out requested, no chips or left.

## Starting stack

Admin sets starting stack at table creation.

Example:

```text
Starting stack: 10 000 chips
```

All players start with the same stack in v1.

## Reference chip value

Admin sets reference chip value.

Example:

```text
1 chip = 0.10 ₽
```

This is only for display. It must not create any payment logic.

## Blinds

Admin sets Small Blind and Big Blind.

### Blind posting

At the start of each hand:
- button moves to next eligible active player;
- small blind posts SB;
- big blind posts BB.

### Heads-up rule

For 2 active players:
- dealer/button is small blind;
- other player is big blind;
- button acts first pre-flop;
- big blind acts first post-flop.

For 3+ players:
- first seat after button is SB;
- next eligible seat is BB;
- first pre-flop actor is first eligible seat after BB;
- first post-flop actor is first eligible seat after button.

## Deck

Use standard 52-card deck: ranks 2..A, suits C/D/H/S. No jokers.

## Dealing

Each active non-sitting-out player gets 2 private cards.

Board:
- flop: 3 community cards;
- turn: 1 community card;
- river: 1 community card.

Burn cards are optional in digital implementation.

## Streets

```text
PRE_FLOP
FLOP
TURN
RIVER
SHOWDOWN
COMPLETED
```

## Legal player actions

- Fold — leaves current hand.
- Check — allowed only if call amount is zero.
- Call — matches current bet.
- Bet — first bet on a street.
- Raise — increases current bet.
- All-in — commits all remaining chips.

## Betting round completion

A betting round is complete when:
- all non-folded, non-all-in players have acted;
- all such players have matched the current bet;
- or only one non-folded player remains.

If only one player remains, hand ends immediately and that player wins all eligible pots.

## Showdown

Showdown happens when river betting round completes with 2+ eligible players, or all remaining players are all-in and board cards are dealt to completion.

At showdown:
- evaluate best 5-card hand from 7 cards;
- rank eligible players;
- distribute main pot and side pots.

## Ties

If multiple players tie for a pot, split equally. If odd chip remains, assign remainder by deterministic rule: remainder chip goes to earliest eligible seat clockwise from dealer button.

## New hand

After hand completes:
- update stacks;
- write hand result;
- apply pending blind change;
- apply sit-out transitions;
- move dealer button;
- start next hand if enough active players remain.

Minimum active players: 2.

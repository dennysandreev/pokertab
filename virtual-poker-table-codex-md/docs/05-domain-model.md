# 05. Domain Model — Virtual Table

## Core entities

### VirtualTable

Long-lived virtual poker table.

Fields:
- id
- ownerUserId
- title
- maxSeats
- startingStackChips
- chipValueMinor
- chipValueCurrency
- smallBlindChips
- bigBlindChips
- pendingSmallBlindChips
- pendingBigBlindChips
- turnDurationSeconds
- reminderDelaySeconds
- timeoutAutoActionRule
- status
- inviteCode
- currentHandId
- createdAt
- startedAt
- pausedAt
- finishedAt

### VirtualSeat

Seat at a virtual table.

Fields:
- id
- tableId
- userId
- seatNumber
- displayName
- role
- status
- stackChips
- joinedAt
- leftAt
- sitOutRequestedAt
- sitOutAutoCheckEnabled
- sitOutAutoFoldEnabled
- hasPassedSmallBlindSinceSitOutRequest
- hasPassedBigBlindSinceSitOutRequest
- returnRequestedAt

### VirtualHand

One hand inside a table.

Fields:
- id
- tableId
- handNumber
- status
- dealerSeatId
- smallBlindSeatId
- bigBlindSeatId
- smallBlindChips
- bigBlindChips
- currentStreet
- currentActorSeatId
- currentBetChips
- minRaiseChips
- potTotalChips
- deckSeedHash
- startedAt
- completedAt

### VirtualHandPlayer

Player state inside a hand.

Fields:
- id
- handId
- seatId
- status
- startingStackChips
- currentStackChips
- committedTotalChips
- committedStreetChips
- privateCard1
- privateCard2
- hasActedThisStreet
- isEligibleForShowdown

Private cards must not be returned to other players.

### VirtualAction

Immutable hand/table event.

Fields:
- id
- tableId
- handId
- seatId
- actorType
- actionType
- amountChips
- metadataJson
- createdAt

Examples:
- POST_SMALL_BLIND
- POST_BIG_BLIND
- FOLD
- CHECK
- CALL
- BET
- RAISE
- ALL_IN
- AUTO_CHECK
- AUTO_FOLD
- DEAL_FLOP
- DEAL_TURN
- DEAL_RIVER
- SHOWDOWN
- POT_AWARDED
- SIT_OUT_REQUESTED
- SITTING_OUT
- RETURN_REQUESTED
- TABLE_PAUSED
- TABLE_RESUMED
- BLINDS_RAISED

### VirtualPot

Main pot or side pot.

Fields:
- id
- handId
- potType
- amountChips
- capChips
- eligibleSeatIdsJson
- awardedAt

### TurnTimer

Fields:
- id
- tableId
- handId
- seatId
- status
- startedAt
- reminderDueAt
- expiresAt
- remindedAt
- resolvedAt
- resolutionType

### OnlinePlayerStats

Fields:
- userId
- handsPlayed
- handsWon
- totalChipsWon
- totalChipsLost
- netChips
- netEstimatedMinor
- bigBlindsWon
- bbPer100Bps
- winRateBps
- avgChipsPerHand
- onlinePokerScore
- updatedAt

## Enums

### VirtualTableStatus

```text
WAITING_FOR_PLAYERS
ACTIVE
PAUSED
FINISHED
CANCELLED
```

### VirtualSeatStatus

```text
ACTIVE
WAITING_FOR_TURN
ACTING
FOLDED
ALL_IN
SIT_OUT_REQUESTED
SITTING_OUT
RETURN_REQUESTED
LEFT
NO_CHIPS
```

### VirtualHandStatus

```text
CREATED
DEALING
IN_PROGRESS
SHOWDOWN
COMPLETED
CANCELLED
```

### Street

```text
PRE_FLOP
FLOP
TURN
RIVER
SHOWDOWN
```

### ActionType

```text
POST_SMALL_BLIND
POST_BIG_BLIND
FOLD
CHECK
CALL
BET
RAISE
ALL_IN
AUTO_CHECK
AUTO_FOLD
DEAL_HOLE_CARDS
DEAL_FLOP
DEAL_TURN
DEAL_RIVER
SHOWDOWN
POT_AWARDED
SIT_OUT_REQUESTED
SITTING_OUT
RETURN_REQUESTED
TABLE_PAUSED
TABLE_RESUMED
BLINDS_RAISED
HAND_STARTED
HAND_COMPLETED
```

## Important derived values

### Call amount

```text
callAmount = max(0, currentBetChips - player.committedStreetChips)
```

### Player is all-in

```text
currentStackChips === 0 && status !== FOLDED
```

### Pot total

```text
potTotalChips = sum(all players committedTotalChips)
```

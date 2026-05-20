import { createHmac, randomBytes } from "node:crypto";

const API_URL = normalizeApiUrl(process.env.API_URL ?? "http://localhost:3000");
const BOT_TOKEN =
  process.env.SMOKE_TELEGRAM_BOT_TOKEN ?? process.env.TELEGRAM_BOT_TOKEN ?? null;

async function main() {
  if (!BOT_TOKEN) {
    throw new Error(
      "Set SMOKE_TELEGRAM_BOT_TOKEN or TELEGRAM_BOT_TOKEN before running the virtual smoke script."
    );
  }

  const runId = `${Date.now()}-${randomBytes(3).toString("hex")}`;
  const telegramBase = BigInt(Date.now()) * 1000n + BigInt(randomBytes(2).readUInt16BE(0));
  const userASeed = createSmokeUser("A", telegramBase + 1n);
  const userBSeed = createSmokeUser("B", telegramBase + 2n);

  logStep("Authorizing smoke users");
  const sessionA = await authenticate(userASeed);
  const sessionB = await authenticate(userBSeed);
  assert(sessionA.accessToken.length > 0, "User A did not receive an access token");
  assert(sessionB.accessToken.length > 0, "User B did not receive an access token");
  assert(sessionA.user.id !== sessionB.user.id, "Smoke users should be different accounts");

  logStep("Creating virtual table");
  const tableTitle = `Virtual smoke ${runId}`;
  const baseTableConfig = {
    maxSeats: 2,
    startingStackChips: 1000,
    chipValueMinor: 1,
    chipValueCurrency: "RUB",
    smallBlindChips: 5,
    bigBlindChips: 10,
    turnDurationSeconds: 30,
    reminderDelaySeconds: 15,
    timeoutAutoActionRule: "CHECK_OR_FOLD"
  };
  const createdTable = await apiRequest("/api/virtual/tables", {
    method: "POST",
    accessToken: sessionA.accessToken,
    body: {
      title: tableTitle,
      ...baseTableConfig
    }
  });
  assert(createdTable.table?.id, "Virtual table was not created");
  assert(createdTable.table.title === tableTitle, "Virtual table title mismatch after creation");
  assert(
    createdTable.table.status === "WAITING_FOR_PLAYERS",
    "New virtual table should start in WAITING_FOR_PLAYERS"
  );
  assert(createdTable.table.inviteCode, "Virtual table invite code is missing");

  logStep("Listing tables for user A");
  const listedTables = await apiRequest("/api/virtual/tables", {
    accessToken: sessionA.accessToken
  });
  const listedTable = listedTables.items.find((item) => item.id === createdTable.table.id);
  assert(listedTable, "Created virtual table is missing from the list");
  assert(listedTable.title === tableTitle, "List returned wrong virtual table title");
  assert(!("myPrivateCards" in listedTable), "Table list should not expose private cards");
  assertNoPrivateCardFields(listedTable, ["myPrivateCards", "privateCards"]);

  logStep("Joining table as user B");
  const joinResponse = await apiRequest("/api/virtual/tables/join", {
    method: "POST",
    accessToken: sessionB.accessToken,
    body: {
      inviteCode: createdTable.table.inviteCode
    }
  });
  assert(joinResponse.tableId === createdTable.table.id, "Join response returned a wrong table");
  assert(joinResponse.seatId, "Join response did not return seatId");

  logStep("Starting table");
  const startedTable = await apiRequest(`/api/virtual/tables/${createdTable.table.id}/start`, {
    method: "POST",
    accessToken: sessionA.accessToken
  });
  assert(startedTable.tableId === createdTable.table.id, "Start response returned a wrong table");
  assert(startedTable.status === "ACTIVE", "Virtual table should switch to ACTIVE after start");
  assert(startedTable.currentHandId, "Starting the table should create a hand");

  logStep("Loading table for both users");
  const tableForA = await apiRequest(`/api/virtual/tables/${createdTable.table.id}`, {
    accessToken: sessionA.accessToken
  });
  const tableForB = await apiRequest(`/api/virtual/tables/${createdTable.table.id}`, {
    accessToken: sessionB.accessToken
  });

  assert(tableForA.table.status === "ACTIVE", "User A should see ACTIVE table status");
  assert(tableForB.table.status === "ACTIVE", "User B should see ACTIVE table status");
  assert(tableForA.hand?.id, "User A should see the current hand");
  assert(tableForB.hand?.id, "User B should see the current hand");
  assert(tableForA.hand.id === tableForB.hand.id, "Both users should observe the same hand");
  assert(tableForA.seats.length === 2, "Table should have exactly two seats for smoke flow");
  assert(tableForB.seats.length === 2, "Table should have exactly two seats for smoke flow");
  assertTableReadState(tableForA, "User A initial table view");
  assertTableReadState(tableForB, "User B initial table view");
  assertDistinctPrivateCards(
    tableForA.hand.myPrivateCards,
    tableForB.hand.myPrivateCards,
    "Initial table views should keep hole cards private per viewer"
  );

  const seatAccessByUserId = new Map([
    [sessionA.user.id, sessionA.accessToken],
    [sessionB.user.id, sessionB.accessToken]
  ]);

  logStep("Playing a deterministic action loop");
  const completedHandId = await playUntilHandCompletes({
    tableId: createdTable.table.id,
    startingHandId: startedTable.currentHandId,
    runId,
    seatAccessByUserId
  });

  logStep("Reading completed hand history");
  const handHistory = await apiRequest(
    `/api/virtual/tables/${createdTable.table.id}/hands/${completedHandId}/history`,
    {
      accessToken: sessionA.accessToken
    }
  );
  assert(handHistory.table.id === createdTable.table.id, "Hand history returned a wrong table");
  assert(handHistory.hand.id === completedHandId, "Hand history returned a wrong hand");
  assert(handHistory.actions.length > 0, "Hand history should include actions");
  assertCompletedHandHistoryPlayers(handHistory);
  assertNoPrivateCardFields(handHistory, ["myPrivateCards", "privateCards", "privateCard1", "privateCard2"]);
  if (handHistory.hand.status === "COMPLETED") {
    assert(Array.isArray(handHistory.pots), "Completed hand history should include pots");
    assert(handHistory.pots.length > 0, "Completed hand history should include at least one pot");
  }

  logStep("Reading hand histories list");
  const handHistories = await apiRequest(
    `/api/virtual/tables/${createdTable.table.id}/hands?limit=1`,
    {
      accessToken: sessionA.accessToken
    }
  );
  handHistories.items.forEach((item) =>
    assertNoPrivateCardFields(item, [
      "myPrivateCards",
      "privateCards",
      "privateCard1",
      "privateCard2",
      "showdownCards"
    ])
  );
  let completedHandListItem = handHistories.items.find((item) => item.id === completedHandId);

  if (handHistories.nextCursor) {
    const secondPage = await apiRequest(
      `/api/virtual/tables/${createdTable.table.id}/hands?limit=1&cursor=${encodeURIComponent(handHistories.nextCursor)}`,
      {
        accessToken: sessionA.accessToken
      }
    );
    secondPage.items.forEach((item) =>
      assertNoPrivateCardFields(item, [
        "myPrivateCards",
        "privateCards",
        "privateCard1",
        "privateCard2",
        "showdownCards"
      ])
    );
    completedHandListItem ||= secondPage.items.find((item) => item.id === completedHandId);
  }

  assert(completedHandListItem, "Completed hand should appear in hand histories list");
  assert(
    completedHandListItem.actionsCount > 0,
    "Hand histories list should include action count for completed hand"
  );

  logStep("Checking leaderboard and personal stats");
  const leaderboard = await apiRequest("/api/virtual/leaderboard?limit=1", {
    accessToken: sessionA.accessToken
  });
  assert(leaderboard.items.length > 0, "Virtual leaderboard should not be empty after smoke hand");
  assert(
    leaderboard.items.some(
      (item) => item.userId === sessionA.user.id || item.userId === sessionB.user.id
    ),
    "Virtual leaderboard should include at least one smoke user"
  );
  if (leaderboard.nextCursor) {
    assert(
      /^[A-Za-z0-9_-]+$/.test(leaderboard.nextCursor),
      "Virtual leaderboard nextCursor should be base64url"
    );
    const decodedCursor = JSON.parse(
      Buffer.from(leaderboard.nextCursor, "base64url").toString("utf8")
    );
    assert(
      typeof decodedCursor.onlinePokerScore === "number" &&
        typeof decodedCursor.handsPlayed === "number" &&
        typeof decodedCursor.netChips === "string" &&
        typeof decodedCursor.userId === "string",
      "Virtual leaderboard nextCursor should contain leaderboard sort keys"
    );

    const nextLeaderboard = await apiRequest(
      `/api/virtual/leaderboard?limit=1&cursor=${encodeURIComponent(leaderboard.nextCursor)}`,
      {
        accessToken: sessionA.accessToken
      }
    );
    assert(nextLeaderboard.items.length > 0, "Second virtual leaderboard page should not be empty");
    assert(
      nextLeaderboard.items[0].userId !== leaderboard.items[0].userId,
      "Second virtual leaderboard page should not repeat the first entry"
    );
  }

  const statsA = await apiRequest("/api/virtual/stats/me", {
    accessToken: sessionA.accessToken
  });
  const statsB = await apiRequest("/api/virtual/stats/me", {
    accessToken: sessionB.accessToken
  });
  assert(statsA.stats.handsPlayed >= 1, "User A should have at least one played hand");
  assert(statsB.stats.handsPlayed >= 1, "User B should have at least one played hand");

  await waitForCompletedHandReveal({
    tableId: createdTable.table.id,
    accessToken: sessionA.accessToken,
    completedHandId
  });

  logStep("Starting second hand");
  const nextHand = await apiRequest(`/api/virtual/tables/${createdTable.table.id}/hands/next`, {
    method: "POST",
    accessToken: sessionA.accessToken
  });
  assert(nextHand.tableId === createdTable.table.id, "Next hand response returned a wrong table");
  assert(nextHand.currentHandId, "Next hand response should include a hand id");
  assert(nextHand.currentHandId !== completedHandId, "Second hand id should differ from the first one");

  logStep("Checking hand histories pagination");
  const paginatedHandHistories = await apiRequest(
    `/api/virtual/tables/${createdTable.table.id}/hands?limit=1`,
    {
      accessToken: sessionA.accessToken
    }
  );
  paginatedHandHistories.items.forEach((item) =>
    assertNoPrivateCardFields(item, [
      "myPrivateCards",
      "privateCards",
      "privateCard1",
      "privateCard2",
      "showdownCards"
    ])
  );
  if (paginatedHandHistories.nextCursor) {
    const olderHandHistories = await apiRequest(
      `/api/virtual/tables/${createdTable.table.id}/hands?limit=1&cursor=${encodeURIComponent(paginatedHandHistories.nextCursor)}`,
      {
        accessToken: sessionA.accessToken
      }
    );
    olderHandHistories.items.forEach((item) =>
      assertNoPrivateCardFields(item, [
        "myPrivateCards",
        "privateCards",
        "privateCard1",
        "privateCard2",
        "showdownCards"
      ])
    );
  }

  logStep("Pausing, resuming and updating second hand settings");
  const secondHandTable = await apiRequest(`/api/virtual/tables/${createdTable.table.id}`, {
    accessToken: sessionA.accessToken
  });
  assert(secondHandTable.hand?.id === nextHand.currentHandId, "Table should point to the new hand");
  assert(
    secondHandTable.hand.currentActorSeatId,
    "Second hand should have a current actor before pause test"
  );
  assertTableReadState(secondHandTable, "Second hand table before pause");
  const actorBeforePause = await getActorSnapshot(createdTable.table.id, seatAccessByUserId);
  const pausedAction = selectDeterministicAction(actorBeforePause.tableState.hand.myLegalActions);

  const paused = await apiRequest(`/api/virtual/tables/${createdTable.table.id}/pause`, {
    method: "POST",
    accessToken: sessionA.accessToken
  });
  assert(paused.status === "PAUSED", "Pause response should switch table to PAUSED");
  assert(paused.pausedAt, "Pause response should include pausedAt");

  const pausedTable = await apiRequest(`/api/virtual/tables/${createdTable.table.id}`, {
    accessToken: sessionA.accessToken
  });
  assert(pausedTable.table.status === "PAUSED", "Paused table should stay in PAUSED status");
  assert(pausedTable.table.pausedAt, "Paused table should expose pausedAt");
  assert(
    pausedTable.hand?.currentTimer === null,
    "Paused table should not expose an active currentTimer"
  );

  const pausedActorSeat = secondHandTable.seats.find(
    (seat) => seat.id === secondHandTable.hand.currentActorSeatId
  );
  assert(pausedActorSeat, "Could not map current actor seat during pause test");
  const pausedActorAccessToken = seatAccessByUserId.get(pausedActorSeat.userId);
  assert(pausedActorAccessToken, "Could not map current actor user during pause test");

  await expectApiError(
    () =>
      apiRequest(`/api/virtual/tables/${createdTable.table.id}/actions`, {
        method: "POST",
        accessToken: pausedActorAccessToken,
        body: {
          handId: nextHand.currentHandId,
          actionType: pausedAction.actionType,
          ...(pausedAction.amountChips ? { amountChips: pausedAction.amountChips } : {}),
          idempotencyKey: `smoke-${runId}-paused-action`
        }
      }),
    "Submitting an action while table is paused should fail"
  );

  const resumed = await apiRequest(`/api/virtual/tables/${createdTable.table.id}/resume`, {
    method: "POST",
    accessToken: sessionA.accessToken
  });
  assert(resumed.status === "ACTIVE", "Resume response should switch table back to ACTIVE");
  const resumedTable = await apiRequest(`/api/virtual/tables/${createdTable.table.id}`, {
    accessToken: sessionA.accessToken
  });
  if (resumedTable.hand?.status !== "COMPLETED") {
    assertTableReadState(resumedTable, "Second hand table after resume");
  }

  const pendingBlinds = await apiRequest(
    `/api/virtual/tables/${createdTable.table.id}/raise-blinds`,
    {
      method: "POST",
      accessToken: sessionA.accessToken,
      body: {
        smallBlindChips: 10,
        bigBlindChips: 20
      }
    }
  );
  assert(
    pendingBlinds.pendingSmallBlindChips === "10",
    "Pending small blind should be set for the next hand"
  );
  assert(
    pendingBlinds.pendingBigBlindChips === "20",
    "Pending big blind should be set for the next hand"
  );
  assert(pendingBlinds.applies === "NEXT_HAND", "Blind update should apply on the next hand");

  const sitOutResponse = await apiRequest(
    `/api/virtual/tables/${createdTable.table.id}/sit-out/request`,
    {
      method: "POST",
      accessToken: sessionB.accessToken,
      body: {
        autoCheck: true,
        autoFold: true
      }
    }
  );
  assert(
    sitOutResponse.seatStatus === "SIT_OUT_REQUESTED",
    "Sit-out request should move the seat into SIT_OUT_REQUESTED"
  );
  assert(sitOutResponse.autoCheck === true, "Sit-out request should persist autoCheck");
  assert(sitOutResponse.autoFold === true, "Sit-out request should persist autoFold");

  logStep("Finishing active table");
  const finished = await apiRequest(`/api/virtual/tables/${createdTable.table.id}/finish`, {
    method: "POST",
    accessToken: sessionA.accessToken
  });
  assert(finished.tableId === createdTable.table.id, "Finish response returned a wrong table");
  assert(finished.status === "FINISHED", "Finish response should switch table to FINISHED");
  assert(finished.finishedAt, "Finish response should include finishedAt");
  assert(
    finished.currentHandId === nextHand.currentHandId,
    "Finish response should preserve the current hand id"
  );

  const finishedAgain = await apiRequest(`/api/virtual/tables/${createdTable.table.id}/finish`, {
    method: "POST",
    accessToken: sessionA.accessToken
  });
  assert(
    finishedAgain.tableId === createdTable.table.id,
    "Second finish response returned a wrong table"
  );
  assert(finishedAgain.status === "FINISHED", "Second finish should keep table in FINISHED status");
  assert(
    finishedAgain.finishedAt === finished.finishedAt,
    "Second finish should return the original finishedAt idempotently"
  );
  assert(
    finishedAgain.currentHandId === finished.currentHandId,
    "Second finish should preserve the original current hand id"
  );

  const finishedTable = await apiRequest(`/api/virtual/tables/${createdTable.table.id}`, {
    accessToken: sessionA.accessToken
  });
  assert(finishedTable.table.status === "FINISHED", "Finished table should stay in FINISHED status");
  assert(finishedTable.table.finishedAt, "Finished table should expose finishedAt");

  await expectApiError(
    () =>
      apiRequest(`/api/virtual/tables/${createdTable.table.id}/actions`, {
        method: "POST",
        accessToken: sessionA.accessToken,
        body: {
          handId: nextHand.currentHandId,
          actionType: "CHECK",
          idempotencyKey: `smoke-${runId}-finished-action`
        }
      }),
    "Submitting an action after table finish should fail"
  );

  logStep("Creating and cancelling waiting table");
  const cancelTableTitle = `Virtual cancel smoke ${runId}`;
  const cancelTable = await apiRequest("/api/virtual/tables", {
    method: "POST",
    accessToken: sessionA.accessToken,
    body: {
      title: cancelTableTitle,
      ...baseTableConfig
    }
  });
  assert(cancelTable.table?.id, "Cancel smoke table was not created");
  assert(
    cancelTable.table.status === "WAITING_FOR_PLAYERS",
    "Cancel smoke table should start in WAITING_FOR_PLAYERS"
  );

  const cancelled = await apiRequest(`/api/virtual/tables/${cancelTable.table.id}/cancel`, {
    method: "POST",
    accessToken: sessionA.accessToken
  });
  assert(cancelled.tableId === cancelTable.table.id, "Cancel response returned a wrong table");
  assert(cancelled.status === "CANCELLED", "Cancel response should switch table to CANCELLED");
  assert(cancelled.finishedAt, "Cancel response should include finishedAt");

  const cancelledTable = await apiRequest(`/api/virtual/tables/${cancelTable.table.id}`, {
    accessToken: sessionA.accessToken
  });
  assert(
    cancelledTable.table.status === "CANCELLED",
    "Cancelled table should stay in CANCELLED status"
  );

  const cancelledAgain = await apiRequest(`/api/virtual/tables/${cancelTable.table.id}/cancel`, {
    method: "POST",
    accessToken: sessionA.accessToken
  });
  assert(
    cancelledAgain.tableId === cancelTable.table.id,
    "Second cancel response returned a wrong table"
  );
  assert(
    cancelledAgain.status === "CANCELLED",
    "Second cancel should keep table in CANCELLED status"
  );
  assert(
    cancelledAgain.finishedAt === cancelled.finishedAt,
    "Second cancel should return the original finishedAt idempotently"
  );

  console.log(`Smoke virtual poker flow passed for table ${createdTable.table.id}.`);
}

async function playUntilHandCompletes({
  tableId,
  startingHandId,
  runId,
  seatAccessByUserId
}) {
  let lastObservedHandId = startingHandId;

  for (let actionIndex = 0; actionIndex < 40; actionIndex += 1) {
    const actorSnapshot = await getActorSnapshot(tableId, seatAccessByUserId);
    const { accessToken, seat, tableState } = actorSnapshot;
    const hand = tableState.hand;

    assert(hand?.id, `Table ${tableId} should expose a hand during action loop`);
    lastObservedHandId = hand.id;

    if (hand.status === "COMPLETED") {
      return hand.id;
    }

    const action = selectDeterministicAction(hand.myLegalActions);
    const actionResponse = await apiRequest(`/api/virtual/tables/${tableId}/actions`, {
      method: "POST",
      accessToken,
      body: {
        handId: hand.id,
        actionType: action.actionType,
        ...(action.amountChips ? { amountChips: action.amountChips } : {}),
        idempotencyKey: `smoke-${runId}-action-${actionIndex + 1}-${seat.id}`
      }
    });

    assert(actionResponse.tableId === tableId, "Action response returned a wrong table");
    assert(actionResponse.handId === hand.id, "Action response returned a wrong hand");
    assert(actionResponse.handStatus, "Action response should include hand status");

    if (actionResponse.handStatus === "COMPLETED") {
      return actionResponse.handId;
    }
  }

  throw new Error(
    `Virtual smoke action loop exceeded 40 actions without completing hand ${lastObservedHandId}.`
  );
}

async function waitForCompletedHandReveal({ tableId, accessToken, completedHandId }) {
  const tableState = await apiRequest(`/api/virtual/tables/${tableId}`, {
    accessToken
  });
  assert(
    tableState.hand?.id === completedHandId,
    "Completed hand should remain visible before starting the next hand"
  );
  assert(
    tableState.hand.status === "COMPLETED",
    "Smoke flow should wait only after a completed hand"
  );

  const revealUntil = tableState.hand.resultSummary?.revealUntil;
  if (!revealUntil) {
    return;
  }

  const waitMs = Math.max(0, new Date(revealUntil).getTime() - Date.now()) + 500;
  if (waitMs > 0) {
    logStep(`Waiting ${Math.ceil(waitMs / 1000)}s for completed hand reveal`);
    await sleep(waitMs);
  }
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function getActorSnapshot(tableId, seatAccessByUserId) {
  const fallbackAccessToken = seatAccessByUserId.values().next().value;
  assert(fallbackAccessToken, "Smoke flow requires at least one access token");

  const fallbackView = await apiRequest(`/api/virtual/tables/${tableId}`, {
    accessToken: fallbackAccessToken
  });
  if (fallbackView.hand?.status === "COMPLETED") {
    return {
      accessToken: fallbackAccessToken,
      seat: null,
      tableState: fallbackView
    };
  }

  const currentActorSeatId = fallbackView.hand?.currentActorSeatId;
  assert(currentActorSeatId, `Table ${tableId} should expose currentActorSeatId while hand is active`);

  const actorSeat = fallbackView.seats.find((seat) => seat.id === currentActorSeatId);
  assert(actorSeat, `Could not find actor seat ${currentActorSeatId}`);

  const accessToken = seatAccessByUserId.get(actorSeat.userId);
  assert(accessToken, `Could not map actor user ${actorSeat.userId} to a session`);

  const actorView = await apiRequest(`/api/virtual/tables/${tableId}`, {
    accessToken
  });
  assert(actorView.hand?.id, `Actor view for table ${tableId} should include the current hand`);
  if (actorView.hand.status !== "COMPLETED") {
    assertTableReadState(actorView, `Actor view for table ${tableId}`);
  }

  return {
    accessToken,
    seat: actorSeat,
    tableState: actorView
  };
}

function selectDeterministicAction(legalActions) {
  const checkAction = legalActions.find((action) => action.type === "CHECK");
  if (checkAction) {
    return {
      actionType: "CHECK"
    };
  }

  const callAction = legalActions.find((action) => action.type === "CALL");
  if (callAction) {
    return {
      actionType: "CALL",
      amountChips: callAction.amountChips
    };
  }

  const allInAction = legalActions.find((action) => action.type === "ALL_IN");
  if (allInAction) {
    return {
      actionType: "ALL_IN",
      amountChips: allInAction.amountChips
    };
  }

  return {
    actionType: "FOLD"
  };
}

function assertNoPrivateCardFields(value, forbiddenKeys) {
  if (Array.isArray(value)) {
    for (const item of value) {
      assertNoPrivateCardFields(item, forbiddenKeys);
    }

    return;
  }

  if (!value || typeof value !== "object") {
    return;
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    assert(!forbiddenKeys.includes(key), `Response should not expose ${key}`);
    assertNoPrivateCardFields(nestedValue, forbiddenKeys);
  }
}

function assertTableReadState(tableState, label) {
  assert(tableState.hand, `${label}: expected table response to include hand`);
  assertViewerPrivateCards(tableState, label);

  if (tableState.hand.status === "COMPLETED") {
    return;
  }

  const timer = tableState.hand.currentTimer;
  assert(timer, `${label}: expected hand.currentTimer while hand is active`);
  assert(
    timer.seatId === tableState.hand.currentActorSeatId,
    `${label}: timer seat should match currentActorSeatId`
  );
  assert(typeof timer.expiresAt === "string" && timer.expiresAt.length > 0, `${label}: timer should expose expiresAt`);
  assert(
    timer.status === "ACTIVE" || timer.status === "REMINDED",
    `${label}: timer status should be ACTIVE or REMINDED`
  );
}

function assertViewerPrivateCards(tableState, label) {
  assert(
    Array.isArray(tableState.hand?.myPrivateCards),
    `${label}: expected myPrivateCards for the viewer`
  );
  assert(
    tableState.hand.myPrivateCards.length === 2,
    `${label}: viewer should see exactly two private cards`
  );
  assertNoPrivateCardFields(tableState.seats, ["privateCards", "myPrivateCards"]);
}

function assertDistinctPrivateCards(leftCards, rightCards, message) {
  assert(Array.isArray(leftCards), `${message}: left viewer should receive private cards`);
  assert(Array.isArray(rightCards), `${message}: right viewer should receive private cards`);
  assert(leftCards.length === 2, `${message}: left viewer should receive two private cards`);
  assert(rightCards.length === 2, `${message}: right viewer should receive two private cards`);

  const leftSet = new Set(leftCards);
  const rightSet = new Set(rightCards);
  assert(leftSet.size === 2, `${message}: left viewer should not receive duplicate cards`);
  assert(rightSet.size === 2, `${message}: right viewer should not receive duplicate cards`);

  for (const card of leftSet) {
    assert(!rightSet.has(card), `${message}: viewers should not share the same hole card`);
  }
}

function assertCompletedHandHistoryPlayers(handHistory) {
  assert(Array.isArray(handHistory.players), "Hand history should include players");
  assert(handHistory.players.length > 0, "Hand history should include at least one player");

  const eligibleOrWinnerSeatIds = new Set();
  for (const pot of Array.isArray(handHistory.pots) ? handHistory.pots : []) {
    for (const seatId of Array.isArray(pot.eligibleSeatIds) ? pot.eligibleSeatIds : []) {
      eligibleOrWinnerSeatIds.add(seatId);
    }

    for (const award of Array.isArray(pot.awards) ? pot.awards : []) {
      if (award?.winnerSeatId) {
        eligibleOrWinnerSeatIds.add(award.winnerSeatId);
      }
    }
  }

  for (const player of handHistory.players) {
    assert(
      Array.isArray(player.showdownCards),
      `Hand history player ${player.seatId} should include showdownCards`
    );
    if (player.status === "FOLDED") {
      assert(
        player.showdownCards.length === 0,
        `Folded player ${player.seatId} should not expose showdown cards`
      );
      continue;
    }

    if (player.showdownCards.length > 0) {
      assert(
        player.showdownCards.length === 2,
        `Non-folded player ${player.seatId} should expose exactly two showdown cards`
      );
      if (eligibleOrWinnerSeatIds.size > 0) {
        assert(
          eligibleOrWinnerSeatIds.has(player.seatId),
          `Only eligible or winning players should expose showdown cards in hand history`
        );
      }
    }
  }
}

async function expectApiError(action, message) {
  try {
    await action();
  } catch (error) {
    assert(error instanceof Error, `${message}: expected Error instance`);
    return error;
  }

  throw new Error(message);
}

function createSmokeUser(label, telegramId) {
  return {
    telegramId: telegramId.toString(),
    username: `smoke_virtual_${label.toLowerCase()}_${telegramId}`,
    firstName: `Smoke ${label}`,
    lastName: "Virtual"
  };
}

async function authenticate(userSeed) {
  const initData = createTelegramInitData(userSeed, BOT_TOKEN);
  const response = await apiRequest("/api/auth/telegram", {
    method: "POST",
    body: {
      initData
    }
  });

  assert(
    response.user.telegramId === userSeed.telegramId,
    `Telegram auth mismatch for user ${userSeed.telegramId}`
  );

  return response;
}

function createTelegramInitData(userSeed, botToken) {
  const authDate = Math.floor(Date.now() / 1000).toString();
  const queryId = `smoke-${randomBytes(6).toString("hex")}`;
  const user = JSON.stringify({
    id: userSeed.telegramId,
    username: userSeed.username,
    first_name: userSeed.firstName,
    last_name: userSeed.lastName
  });
  const params = new URLSearchParams();

  params.set("auth_date", authDate);
  params.set("query_id", queryId);
  params.set("user", user);

  const hash = createTelegramHash(params, botToken);
  params.set("hash", hash);

  return params.toString();
}

function createTelegramHash(params, botToken) {
  const dataCheckString = [...params.entries()]
    .filter(([key]) => key !== "hash")
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest();

  return createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
}

async function apiRequest(path, { method = "GET", accessToken, body } = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });

  const rawText = await response.text();
  const payload = rawText.length > 0 ? safeJsonParse(rawText) : null;

  if (!response.ok) {
    const errorMessage =
      payload && typeof payload === "object" && payload.error && typeof payload.error.message === "string"
        ? payload.error.message
        : rawText || `Request failed with status ${response.status}`;

    throw new Error(`${method} ${path}: ${errorMessage}`);
  }

  return payload;
}

function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function normalizeApiUrl(value) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function logStep(message) {
  console.log(`- ${message}`);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

main().catch((error) => {
  console.error(`Smoke virtual poker flow failed: ${error.message}`);
  process.exitCode = 1;
});

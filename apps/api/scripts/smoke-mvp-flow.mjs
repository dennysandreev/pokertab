import { createHmac, randomBytes } from "node:crypto";

const API_URL = normalizeApiUrl(process.env.API_URL ?? "http://localhost:3000");
const BOT_TOKEN =
  process.env.SMOKE_TELEGRAM_BOT_TOKEN ?? process.env.TELEGRAM_BOT_TOKEN ?? null;

async function main() {
  if (!BOT_TOKEN) {
    throw new Error(
      "Set SMOKE_TELEGRAM_BOT_TOKEN or TELEGRAM_BOT_TOKEN before running the MVP smoke script."
    );
  }

  const runId = `${Date.now()}-${randomBytes(3).toString("hex")}`;
  const telegramBase = BigInt(Date.now()) * 1000n + BigInt(randomBytes(2).readUInt16BE(0));
  const userASeed = createSmokeUser("A", telegramBase + 1n);
  const userBSeed = createSmokeUser("B", telegramBase + 2n);

  logStep("Authorizing test users");
  const sessionA = await authenticate(userASeed);
  const sessionB = await authenticate(userBSeed);
  assert(sessionA.accessToken.length > 0, "User A did not receive an access token");
  assert(sessionB.accessToken.length > 0, "User B did not receive an access token");
  assert(sessionA.user.id !== sessionB.user.id, "Smoke users should be different accounts");

  logStep("Creating room");
  const roomTitle = `MVP smoke ${runId}`;
  const createdRoom = await apiRequest("/api/rooms", {
    method: "POST",
    accessToken: sessionA.accessToken,
    body: {
      title: roomTitle,
      currency: "RUB",
      rebuyAmountMinor: "100000",
      startingStack: 10000,
      gameType: "SIMPLE_TRACKING",
      rebuyPermission: "PLAYER_SELF"
    }
  });
  assert(createdRoom.room?.id, "Room was not created");
  assert(createdRoom.room.title === roomTitle, "Room title mismatch after creation");
  assert(createdRoom.room.status === "WAITING", "New room should start in WAITING");
  assert(createdRoom.room.inviteCode, "Room invite code is missing");

  logStep("Joining room as user B");
  const joinResponse = await apiRequest("/api/rooms/join", {
    method: "POST",
    accessToken: sessionB.accessToken,
    body: {
      inviteCode: createdRoom.room.inviteCode
    }
  });
  assert(joinResponse.roomId === createdRoom.room.id, "Join response returned a wrong room");
  assert(joinResponse.playerId, "Join response did not return playerId");

  logStep("Starting room");
  const startedRoom = await apiRequest(`/api/rooms/${createdRoom.room.id}/start`, {
    method: "POST",
    accessToken: sessionA.accessToken
  });
  assert(startedRoom.status === "RUNNING", "Room should switch to RUNNING after start");

  logStep("Loading room details");
  const runningRoom = await apiRequest(`/api/rooms/${createdRoom.room.id}`, {
    accessToken: sessionA.accessToken
  });
  assert(runningRoom.room.status === "RUNNING", "Room details should reflect RUNNING status");
  assert(runningRoom.room.playersCount === 2, "Smoke room should have exactly two active players");

  const playerA = runningRoom.players.find((player) => player.userId === sessionA.user.id);
  const playerB = runningRoom.players.find((player) => player.userId === sessionB.user.id);

  assert(playerA, "Could not find user A in room details");
  assert(playerB, "Could not find user B in room details");

  logStep("Creating self rebuys");
  const rebuyA = await apiRequest(`/api/rooms/${createdRoom.room.id}/rebuys`, {
    method: "POST",
    accessToken: sessionA.accessToken,
    body: {
      roomPlayerId: playerA.id,
      idempotencyKey: `smoke-${runId}-rebuy-a`
    }
  });
  const rebuyB = await apiRequest(`/api/rooms/${createdRoom.room.id}/rebuys`, {
    method: "POST",
    accessToken: sessionB.accessToken,
    body: {
      roomPlayerId: playerB.id,
      idempotencyKey: `smoke-${runId}-rebuy-b`
    }
  });
  assert(rebuyA.rebuy.roomPlayerId === playerA.id, "User A rebuy was attached to the wrong player");
  assert(rebuyB.rebuy.roomPlayerId === playerB.id, "User B rebuy was attached to the wrong player");

  logStep("Checking buy-ins before settlement");
  const roomBeforeSettlement = await apiRequest(`/api/rooms/${createdRoom.room.id}`, {
    accessToken: sessionA.accessToken
  });
  const settledPlayerA = roomBeforeSettlement.players.find((player) => player.userId === sessionA.user.id);
  const settledPlayerB = roomBeforeSettlement.players.find((player) => player.userId === sessionB.user.id);

  assert(settledPlayerA, "Could not reload user A before settlement");
  assert(settledPlayerB, "Could not reload user B before settlement");
  assert(settledPlayerA.totalBuyinMinor === "100000", "User A buy-in total should be 100000");
  assert(settledPlayerB.totalBuyinMinor === "100000", "User B buy-in total should be 100000");
  assert(roomBeforeSettlement.room.totalPotMinor === "200000", "Room total should be 200000");

  logStep("Previewing settlement");
  const settlementPreview = await apiRequest(
    `/api/rooms/${createdRoom.room.id}/settlement/preview`,
    {
      method: "POST",
      accessToken: sessionA.accessToken,
      body: {
        finalAmounts: [
          { roomPlayerId: settledPlayerA.id, finalAmountMinor: "150000" },
          { roomPlayerId: settledPlayerB.id, finalAmountMinor: "50000" }
        ]
      }
    }
  );
  assert(settlementPreview.totalBuyinsMinor === "200000", "Settlement preview buy-ins mismatch");
  assert(settlementPreview.totalFinalAmountMinor === "200000", "Settlement preview final total mismatch");
  assert(settlementPreview.differenceMinor === "0", "Settlement preview should be balanced");
  assert(settlementPreview.transfers.length === 1, "Balanced two-player settlement should have one transfer");

  const transfer = settlementPreview.transfers[0];
  assert(transfer.amountMinor === "50000", "Settlement transfer amount should be 50000");
  assert(transfer.fromRoomPlayerId === settledPlayerB.id, "Settlement should transfer from user B");
  assert(transfer.toRoomPlayerId === settledPlayerA.id, "Settlement should transfer to user A");

  logStep("Closing settlement");
  const closedSettlement = await apiRequest(`/api/rooms/${createdRoom.room.id}/settlement/close`, {
    method: "POST",
    accessToken: sessionA.accessToken,
    body: {
      finalAmounts: [
        { roomPlayerId: settledPlayerA.id, finalAmountMinor: "150000" },
        { roomPlayerId: settledPlayerB.id, finalAmountMinor: "50000" }
      ]
    }
  });
  assert(closedSettlement.roomId === createdRoom.room.id, "Closed settlement returned wrong room");
  assert(closedSettlement.status === "CLOSED", "Room should close after settlement");
  assert(closedSettlement.settlementId, "Closed settlement did not return settlement id");

  logStep("Loading closed room");
  const closedRoom = await apiRequest(`/api/rooms/${createdRoom.room.id}`, {
    accessToken: sessionA.accessToken
  });
  assert(closedRoom.room.status === "CLOSED", "Closed room should return CLOSED status");
  assert(closedRoom.settlement?.id === closedSettlement.settlementId, "Closed room settlement mismatch");
  assert(closedRoom.settlement?.status === "CLOSED", "Closed room settlement should be CLOSED");
  assert(closedRoom.settlement?.differenceMinor === "0", "Closed room settlement should stay balanced");

  const closedPlayerA = closedRoom.players.find((player) => player.userId === sessionA.user.id);
  const closedPlayerB = closedRoom.players.find((player) => player.userId === sessionB.user.id);

  assert(closedPlayerA?.finalAmountMinor === "150000", "User A final amount was not saved");
  assert(closedPlayerA?.netResultMinor === "50000", "User A net result should be 50000");
  assert(closedPlayerB?.finalAmountMinor === "50000", "User B final amount was not saved");
  assert(closedPlayerB?.netResultMinor === "-50000", "User B net result should be -50000");

  logStep("Fetching leaderboard and profile");
  const leaderboardAll = await apiRequest("/api/leaderboard?scope=all&period=all-time&limit=20", {
    accessToken: sessionA.accessToken
  });
  const leaderboardPlayedWithMe = await apiRequest(
    "/api/leaderboard?scope=played-with-me&period=all-time&limit=20",
    {
      accessToken: sessionA.accessToken
    }
  );
  const profileB = await apiRequest(`/api/players/${sessionB.user.id}/profile`, {
    accessToken: sessionA.accessToken
  });

  const allEntryA = leaderboardAll.items.find((item) => item.userId === sessionA.user.id);
  const allEntryB = leaderboardAll.items.find((item) => item.userId === sessionB.user.id);
  const playedWithMeEntryA = leaderboardPlayedWithMe.items.find(
    (item) => item.userId === sessionA.user.id
  );
  const playedWithMeEntryB = leaderboardPlayedWithMe.items.find(
    (item) => item.userId === sessionB.user.id
  );

  assert(allEntryA, "All-time leaderboard should include user A");
  assert(allEntryB, "All-time leaderboard should include user B");
  assert(allEntryA.rank < allEntryB.rank, "User A should rank above user B after the smoke game");
  assert(allEntryA.totalProfitMinor === "50000", "User A leaderboard profit should be 50000");
  assert(allEntryB.totalProfitMinor === "-50000", "User B leaderboard profit should be -50000");
  assert(playedWithMeEntryA, "Played-with-me leaderboard should include user A");
  assert(playedWithMeEntryB, "Played-with-me leaderboard should include user B");
  assert(
    playedWithMeEntryA.rank < playedWithMeEntryB.rank,
    "Played-with-me leaderboard should rank user A above user B"
  );
  assert(profileB.user.id === sessionB.user.id, "Profile response returned the wrong player");
  assert(profileB.stats.gamesCount === 1, "User B profile should show one game");
  assert(profileB.stats.totalBuyinsMinor === "100000", "User B profile buy-ins should be 100000");
  assert(profileB.stats.totalProfitMinor === "-50000", "User B profile profit should be -50000");
  assert(profileB.recentGames.some((game) => game.roomId === createdRoom.room.id), "User B recent games should include the smoke room");

  console.log(`Smoke MVP flow passed for room ${createdRoom.room.id}.`);
}

function createSmokeUser(label, telegramId) {
  return {
    telegramId: telegramId.toString(),
    username: `smoke_${label.toLowerCase()}_${telegramId}`,
    firstName: `Smoke ${label}`,
    lastName: "MVP"
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

  assert(response.user.telegramId === userSeed.telegramId, `Telegram auth mismatch for user ${userSeed.telegramId}`);

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

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const errorMessage =
      payload && typeof payload === "object" && payload.error && typeof payload.error.message === "string"
        ? payload.error.message
        : `Request failed with status ${response.status}`;

    throw new Error(`${method} ${path}: ${errorMessage}`);
  }

  return payload;
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
  console.error(`Smoke MVP flow failed: ${error.message}`);
  process.exitCode = 1;
});

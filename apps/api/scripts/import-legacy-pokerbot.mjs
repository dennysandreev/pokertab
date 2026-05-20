import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import { PrismaClient } from "@prisma/client";

const DEFAULT_SQLITE_PATH = "/home/splitopus/pokerbot/pokerbot.sqlite3";
const SOURCE = "legacy-pokerbot";
const CURRENCY = "RUB";
const EXPECTED_CHIP_RATE_RUB = "0.1";
const EXPECTED_CHIPS_PER_CURRENCY_UNIT = 10n;
const TRANSFER_STATUS_PENDING = "PENDING";

const args = new Set(process.argv.slice(2));
const mode = args.has("--import") ? "import" : args.has("--dry-run") ? "dry-run" : null;

if (!mode) {
  fail("Use --dry-run or --import.");
}

const sqlitePath = process.env.LEGACY_POKERBOT_SQLITE_PATH ?? DEFAULT_SQLITE_PATH;
const jsonPath = process.env.LEGACY_POKERBOT_JSON_PATH;
const prisma = new PrismaClient();

try {
  const legacy = jsonPath ? readLegacyPokerbotJson(jsonPath) : readLegacyPokerbot(sqlitePath);
  const plan = await buildImportPlan(legacy);
  printReport(plan, mode);

  if (mode === "dry-run") {
    process.exitCode = plan.errors.length > 0 ? 1 : 0;
  } else {
    if (plan.errors.length > 0) {
      fail("Import aborted because dry-run validation found errors.");
    }

    createBackup();
    await importPlan(plan);
    console.log("Import completed.");
  }
} finally {
  await prisma.$disconnect();
}

function readLegacyPokerbot(path) {
  const python = String.raw`
import json
import sqlite3
import sys

path = sys.argv[1]
con = sqlite3.connect(path)
con.row_factory = sqlite3.Row

matches = [dict(row) for row in con.execute("""
select *
from matches
where status = 'FINISHED'
order by created_at asc, match_id asc
""")]

players = [dict(row) for row in con.execute("""
select p.*
from players_in_match p
join matches m on m.match_id = p.match_id
where m.status = 'FINISHED' and p.is_left = 0
order by p.match_id asc, p.updated_at asc, p.user_id asc
""")]

calculations = [dict(row) for row in con.execute("""
select c.*
from calculations c
join matches m on m.match_id = c.match_id
where m.status = 'FINISHED'
order by c.match_id asc
""")]

transfers = [dict(row) for row in con.execute("""
select t.*
from transfers t
join calculations c on c.calculation_id = t.calculation_id
join matches m on m.match_id = c.match_id
where m.status = 'FINISHED'
order by t.calculation_id asc, t.transfer_id asc
""")]

print(json.dumps({
    "matches": matches,
    "players": players,
    "calculations": calculations,
    "transfers": transfers,
}, ensure_ascii=False))
`;

  const result = spawnSync("python3", ["-c", python, path], {
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 16
  });

  if (result.status !== 0) {
    fail(`Could not read legacy SQLite database: ${lastLine(result.stderr)}`);
  }

  return JSON.parse(result.stdout);
}

function readLegacyPokerbotJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

async function buildImportPlan(legacy) {
  const errors = [];
  const finishedMatches = legacy.matches;
  const playersByMatch = groupBy(legacy.players, (player) => player.match_id);
  const calculationsByMatch = new Map(legacy.calculations.map((calculation) => [calculation.match_id, calculation]));
  const transfersByCalculation = groupBy(legacy.transfers, (transfer) => transfer.calculation_id);
  const oldUserIds = [...new Set(legacy.players.map((player) => String(player.user_id)))];
  const existingUsers = await prisma.user.findMany({
    where: {
      telegramId: {
        in: oldUserIds
      }
    },
    select: {
      id: true,
      telegramId: true
    }
  });
  const existingUsersByTelegramId = new Map(
    existingUsers.map((user) => [user.telegramId, user])
  );
  const displayNameByUserId = new Map();

  for (const player of legacy.players) {
    if (!displayNameByUserId.has(player.user_id)) {
      displayNameByUserId.set(player.user_id, normalizeDisplayName(player.display_name));
    }
  }

  const existingImportedRooms = await prisma.room.findMany({
    where: {
      id: {
        in: finishedMatches.map((match) => roomIdFor(match.match_id))
      }
    },
    include: {
      players: true,
      settlements: true
    }
  });
  const existingRoomsById = new Map(existingImportedRooms.map((room) => [room.id, room]));
  const inviteCodes = finishedMatches.map((match) => inviteCodeFor(match.match_id));
  const inviteCollisions = await prisma.room.findMany({
    where: {
      inviteCode: {
        in: inviteCodes
      }
    },
    select: {
      id: true,
      inviteCode: true
    }
  });

  for (const room of inviteCollisions) {
    const expectedRoomId = finishedMatches.find(
      (match) => inviteCodeFor(match.match_id) === room.inviteCode
    );

    if (expectedRoomId && room.id !== roomIdFor(expectedRoomId.match_id)) {
      errors.push("A deterministic legacy invite code already belongs to another room.");
    }
  }

  const matches = [];
  let skippedExistingMatches = 0;
  let rebuysCount = 0;
  let transfersCount = 0;
  let unbalancedMatches = 0;

  for (const match of finishedMatches) {
    const validationErrors = validateLegacyMatch(match);
    errors.push(...validationErrors);

    const roomId = roomIdFor(match.match_id);
    const calculation = calculationsByMatch.get(match.match_id);
    const players = playersByMatch.get(match.match_id) ?? [];

    if (!calculation) {
      errors.push("A finished legacy match has no stored calculation.");
      continue;
    }

    if (players.length === 0) {
      errors.push("A finished legacy match has no active players.");
      continue;
    }

    const existingRoom = existingRoomsById.get(roomId);
    const participantPlans = players.map((player) => buildParticipantPlan(match, player));
    const settlement = buildSettlementPlan(match, calculation, participantPlans, transfersByCalculation);
    rebuysCount += participantPlans.reduce((sum, player) => sum + player.rebuysCount, 0);
    transfersCount += settlement.transfers.length;

    if (settlement.differenceChips !== 0n) {
      unbalancedMatches += 1;
    }

    if (existingRoom) {
      const existingRoomErrors = validateExistingImportedRoom(existingRoom, participantPlans);
      errors.push(...existingRoomErrors);
      skippedExistingMatches += 1;
      matches.push({
        oldMatchId: match.match_id,
        roomId,
        action: "skip",
        participants: participantPlans,
        settlement
      });
      continue;
    }

    matches.push({
      oldMatchId: match.match_id,
      roomId,
      action: "create",
      title: match.title,
      ownerOldUserId: String(match.created_by_user_id),
      createdAt: parseDate(match.created_at),
      closedAt: parseDate(match.finished_at),
      buyInChips: BigInt(match.buyin_chips),
      rebuyChips: BigInt(match.rebuy_chips),
      participants: participantPlans,
      settlement,
      inviteCode: inviteCodeFor(match.match_id)
    });
  }

  const usersToCreate = oldUserIds
    .filter((telegramId) => !existingUsersByTelegramId.has(telegramId))
    .map((telegramId) => ({
      id: userIdFor(telegramId),
      telegramId,
      firstName: displayNameByUserId.get(telegramId) ?? "Legacy player"
    }));

  return {
    errors,
    usersToCreate,
    existingUsersByTelegramId,
    matches,
    counts: {
      sourceFinishedMatches: finishedMatches.length,
      sourcePlayers: legacy.players.length,
      sourceUniqueUsers: oldUserIds.length,
      matchedUsers: existingUsers.length,
      usersToCreate: usersToCreate.length,
      matchesToCreate: matches.filter((match) => match.action === "create").length,
      skippedExistingMatches,
      rebuysCount,
      transfersCount,
      unbalancedMatches
    }
  };
}

function buildParticipantPlan(match, player) {
  const rebuysCount = Number(player.rebuys_count ?? 0);
  const buyInChips = BigInt(match.buyin_chips);
  const rebuyChips = BigInt(match.rebuy_chips);
  const finalAmountChips = BigInt(player.final_chips);
  const totalBuyinChips = buyInChips + BigInt(rebuysCount) * rebuyChips;
  const netResultChips = finalAmountChips - totalBuyinChips;

  return {
    oldUserId: String(player.user_id),
    roomPlayerId: roomPlayerIdFor(match.match_id, player.user_id),
    displayName: normalizeDisplayName(player.display_name),
    rebuysCount,
    finalAmountChips,
    totalBuyinChips,
    netResultChips
  };
}

function buildSettlementPlan(match, calculation, participants, transfersByCalculation) {
  const totalBuyinsChips = participants.reduce((sum, player) => sum + player.totalBuyinChips, 0n);
  const totalFinalAmountChips = participants.reduce(
    (sum, player) => sum + player.finalAmountChips,
    0n
  );
  const differenceChips = totalFinalAmountChips - totalBuyinsChips;
  const roomPlayerIdByOldUserId = new Map(
    participants.map((player) => [player.oldUserId, player.roomPlayerId])
  );
  const transfers = (transfersByCalculation.get(calculation.calculation_id) ?? []).map((transfer) => {
    const fromRoomPlayerId = roomPlayerIdByOldUserId.get(String(transfer.debtor_user_id));
    const toRoomPlayerId = roomPlayerIdByOldUserId.get(String(transfer.creditor_user_id));

    if (!fromRoomPlayerId || !toRoomPlayerId) {
      fail("A legacy transfer points to a player outside the finished match.");
    }

    return {
      fromRoomPlayerId,
      toRoomPlayerId,
      amountChips: rubToChips(transfer.amount_rub)
    };
  });

  return {
    settlementId: settlementIdFor(match.match_id),
    totalBuyinsChips,
    totalFinalAmountChips,
    differenceChips,
    transfers
  };
}

function validateLegacyMatch(match) {
  const errors = [];

  if (String(match.chip_rate_rub) !== EXPECTED_CHIP_RATE_RUB) {
    errors.push("A legacy match has an unsupported chip_rate_rub.");
  }

  if (!match.finished_at) {
    errors.push("A finished legacy match has no finished_at.");
  }

  if (BigInt(match.buyin_chips) <= 0n || BigInt(match.rebuy_chips) <= 0n) {
    errors.push("A legacy match has non-positive buy-in or rebuy chips.");
  }

  return errors;
}

function validateExistingImportedRoom(room, participants) {
  const errors = [];

  if (room.status !== "CLOSED" || room.settlements.length === 0) {
    errors.push("A legacy room already exists but looks partially imported.");
  }

  if (room.players.length !== participants.length) {
    errors.push("A legacy room already exists with a different player count.");
  }

  return errors;
}

async function importPlan(plan) {
  const createMatches = plan.matches.filter((match) => match.action === "create");
  const affectedUserIds = new Set();

  await prisma.$transaction(async (tx) => {
    for (const user of plan.usersToCreate) {
      await tx.user.create({
        data: {
          id: user.id,
          telegramId: user.telegramId,
          firstName: user.firstName
        }
      });
      affectedUserIds.add(user.id);
    }

    const users = await tx.user.findMany({
      where: {
        telegramId: {
          in: [
            ...plan.usersToCreate.map((user) => user.telegramId),
            ...plan.existingUsersByTelegramId.keys()
          ]
        }
      },
      select: {
        id: true,
        telegramId: true
      }
    });
    const userIdByTelegramId = new Map(users.map((user) => [user.telegramId, user.id]));

    for (const match of createMatches) {
      const ownerUserId = userIdByTelegramId.get(match.ownerOldUserId);

      if (!ownerUserId) {
        throw new Error("Owner user was not created or matched.");
      }

      await tx.room.create({
        data: {
          id: match.roomId,
          ownerUserId,
          title: match.title,
          currency: CURRENCY,
          buyInChips: match.buyInChips,
          rebuyChips: match.rebuyChips,
          chipsPerCurrencyUnit: Number(EXPECTED_CHIPS_PER_CURRENCY_UNIT),
          rebuyAmountMinor: chipsToMinor(match.rebuyChips),
          startingStack: Number(match.buyInChips),
          gameType: "SIMPLE_TRACKING",
          rebuyPermission: "ADMIN_ONLY",
          status: "CLOSED",
          inviteCode: match.inviteCode,
          createdAt: match.createdAt,
          updatedAt: match.closedAt,
          startedAt: match.createdAt,
          settlementStartedAt: match.closedAt,
          closedAt: match.closedAt
        }
      });

      for (const participant of match.participants) {
        const userId = userIdByTelegramId.get(participant.oldUserId);

        if (!userId) {
          throw new Error("Participant user was not created or matched.");
        }

        affectedUserIds.add(userId);
        await tx.roomPlayer.create({
          data: {
            id: participant.roomPlayerId,
            roomId: match.roomId,
            userId,
            displayName: participant.displayName,
            role: participant.oldUserId === match.ownerOldUserId ? "OWNER" : "PLAYER",
            status: "ACTIVE",
            joinedAt: match.createdAt,
            finalAmountChips: participant.finalAmountChips,
            netResultChips: participant.netResultChips,
            finalAmountMinor: chipsToMinor(participant.finalAmountChips),
            netResultMinor: chipsToMinor(participant.netResultChips)
          }
        });

        for (let index = 0; index < participant.rebuysCount; index += 1) {
          await tx.rebuyEvent.create({
            data: {
              id: rebuyEventIdFor(match.oldMatchId, participant.oldUserId, index),
              roomId: match.roomId,
              roomPlayerId: participant.roomPlayerId,
              amountChips: match.rebuyChips,
              amountMinor: chipsToMinor(match.rebuyChips),
              createdByUserId: ownerUserId,
              source: "SYSTEM_IMPORT",
              status: "ACTIVE",
              createdAt: match.closedAt
            }
          });
        }
      }

      await tx.settlement.create({
        data: {
          id: match.settlement.settlementId,
          roomId: match.roomId,
          status: "CLOSED",
          totalBuyinsChips: match.settlement.totalBuyinsChips,
          totalFinalAmountChips: match.settlement.totalFinalAmountChips,
          differenceChips: match.settlement.differenceChips,
          totalBuyinsMinor: chipsToMinor(match.settlement.totalBuyinsChips),
          totalFinalAmountMinor: chipsToMinor(match.settlement.totalFinalAmountChips),
          differenceMinor: chipsToMinor(match.settlement.differenceChips),
          calculatedAt: match.closedAt,
          closedByUserId: ownerUserId
        }
      });

      if (match.settlement.transfers.length > 0) {
        await tx.settlementTransfer.createMany({
          data: match.settlement.transfers.map((transfer, index) => ({
            id: settlementTransferIdFor(match.oldMatchId, index),
            settlementId: match.settlement.settlementId,
            fromRoomPlayerId: transfer.fromRoomPlayerId,
            toRoomPlayerId: transfer.toRoomPlayerId,
            amountChips: transfer.amountChips,
            amountMinor: chipsToMinor(transfer.amountChips),
            status: TRANSFER_STATUS_PENDING
          }))
        });
      }
    }

    await recalculatePlayerStats(tx, [...affectedUserIds]);
  });
}

async function recalculatePlayerStats(tx, userIds) {
  if (userIds.length === 0) {
    return;
  }

  const rows = await tx.roomPlayer.findMany({
    where: {
      userId: {
        in: userIds
      },
      finalAmountChips: {
        not: null
      },
      netResultChips: {
        not: null
      },
      room: {
        status: "CLOSED",
        closedAt: {
          not: null
        }
      }
    },
    include: {
      room: {
        select: {
          buyInChips: true,
          rebuyChips: true,
          chipsPerCurrencyUnit: true
        }
      },
      rebuyEvents: {
        where: {
          status: "ACTIVE"
        },
        select: {
          amountChips: true
        }
      }
    }
  });
  const rowsByUserId = groupBy(rows, (row) => row.userId);

  for (const userId of userIds) {
    const stats = calculatePlayerStats(rowsByUserId.get(userId) ?? []);

    if (!stats) {
      await tx.playerStats.deleteMany({
        where: {
          userId
        }
      });
      continue;
    }

    await tx.playerStats.upsert({
      where: {
        userId
      },
      create: {
        userId,
        gamesCount: stats.gamesCount,
        totalBuyinsMinor: stats.totalBuyinsMinor,
        totalProfitMinor: stats.totalProfitMinor,
        avgProfitMinor: stats.avgProfitMinor,
        roiBps: stats.roiBps,
        winRateBps: stats.winRateBps,
        stabilityScoreBps: stats.stabilityScoreBps,
        pokerScore: stats.pokerScore
      },
      update: {
        gamesCount: stats.gamesCount,
        totalBuyinsMinor: stats.totalBuyinsMinor,
        totalProfitMinor: stats.totalProfitMinor,
        avgProfitMinor: stats.avgProfitMinor,
        roiBps: stats.roiBps,
        winRateBps: stats.winRateBps,
        stabilityScoreBps: stats.stabilityScoreBps,
        pokerScore: stats.pokerScore
      }
    });
  }
}

function calculatePlayerStats(rows) {
  if (rows.length === 0) {
    return null;
  }

  let totalBuyinsMinor = 0n;
  let totalProfitMinor = 0n;
  let positiveGames = 0;
  let stableGames = 0;

  for (const row of rows) {
    const totalBuyinChips =
      row.room.buyInChips + row.rebuyEvents.reduce((sum, rebuy) => sum + rebuy.amountChips, 0n);
    const totalBuyinMinor = chipsToMinor(totalBuyinChips, row.room.chipsPerCurrencyUnit);
    const netResultMinor = chipsToMinor(row.netResultChips, row.room.chipsPerCurrencyUnit);
    totalBuyinsMinor += totalBuyinMinor;
    totalProfitMinor += netResultMinor;

    if (netResultMinor > 0n) {
      positiveGames += 1;
    }

    if (netResultMinor >= chipsToMinor(row.room.rebuyChips, row.room.chipsPerCurrencyUnit) * -1n) {
      stableGames += 1;
    }
  }

  const gamesCount = rows.length;
  const avgProfitMinor = totalProfitMinor / BigInt(gamesCount);
  const roiBps = totalBuyinsMinor === 0n ? 0 : toSafeNumber((totalProfitMinor * 10000n) / totalBuyinsMinor);
  const winRateBps = Math.round((positiveGames / gamesCount) * 10000);
  const stabilityScoreBps = Math.round((stableGames / gamesCount) * 10000);
  const pokerScore = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        normalizeRoiToScore(roiBps) * 0.4 +
          (winRateBps / 100) * 0.3 +
          (stabilityScoreBps / 100) * 0.2 +
          volumeConfidence(gamesCount) * 0.1
      )
    )
  );

  return {
    gamesCount,
    totalBuyinsMinor,
    totalProfitMinor,
    avgProfitMinor,
    roiBps,
    winRateBps,
    stabilityScoreBps,
    pokerScore
  };
}

function createBackup() {
  if (process.env.LEGACY_POKERBOT_SKIP_BACKUP === "1") {
    console.log("Database backup skipped by LEGACY_POKERBOT_SKIP_BACKUP.");
    return;
  }

  const backupPath =
    process.env.LEGACY_POKERBOT_BACKUP_PATH ??
    `/tmp/pokertab-before-legacy-pokerbot-import-${new Date().toISOString().replaceAll(":", "-")}.dump`;
  mkdirSync(dirname(backupPath), { recursive: true });
  const result = spawnSync(
    "pg_dump",
    ["--no-owner", "--no-privileges", "--format=custom", "--file", backupPath],
    {
      encoding: "utf8",
      env: process.env,
      maxBuffer: 1024 * 1024
    }
  );

  if (result.status !== 0) {
    fail(`Database backup failed: ${lastLine(result.stderr) || "pg_dump returned a non-zero status"}`);
  }

  console.log(`Database backup created: ${backupPath}`);
}

function printReport(plan, selectedMode) {
  console.log(`Legacy pokerbot import ${selectedMode} report`);
  console.log(`source finished matches: ${plan.counts.sourceFinishedMatches}`);
  console.log(`source player rows: ${plan.counts.sourcePlayers}`);
  console.log(`source unique users: ${plan.counts.sourceUniqueUsers}`);
  console.log(`matched current users: ${plan.counts.matchedUsers}`);
  console.log(`users to create: ${plan.counts.usersToCreate}`);
  console.log(`matches to create: ${plan.counts.matchesToCreate}`);
  console.log(`matches already imported: ${plan.counts.skippedExistingMatches}`);
  console.log(`rebuy events to create: ${plan.counts.rebuysCount}`);
  console.log(`settlement transfers to create: ${plan.counts.transfersCount}`);
  console.log(`unbalanced matches: ${plan.counts.unbalancedMatches}`);

  if (plan.errors.length > 0) {
    console.log("validation errors:");
    for (const error of plan.errors) {
      console.log(`- ${error}`);
    }
  }
}

function chipsToMinor(chips, chipsPerCurrencyUnit = EXPECTED_CHIPS_PER_CURRENCY_UNIT) {
  return (BigInt(chips) * 100n) / BigInt(chipsPerCurrencyUnit);
}

function rubToChips(rub) {
  return BigInt(rub) * EXPECTED_CHIPS_PER_CURRENCY_UNIT;
}

function roomIdFor(matchId) {
  return `legacy_pokerbot_room_${shortHash(matchId, 24)}`;
}

function roomPlayerIdFor(matchId, oldUserId) {
  return `legacy_pokerbot_rp_${shortHash(`${matchId}:${oldUserId}`, 24)}`;
}

function settlementIdFor(matchId) {
  return `legacy_pokerbot_settlement_${shortHash(matchId, 24)}`;
}

function settlementTransferIdFor(matchId, index) {
  return `legacy_pokerbot_transfer_${shortHash(`${matchId}:${index}`, 24)}`;
}

function rebuyEventIdFor(matchId, oldUserId, index) {
  return `legacy_pokerbot_rebuy_${shortHash(`${matchId}:${oldUserId}:${index}`, 24)}`;
}

function userIdFor(telegramId) {
  return `legacy_pokerbot_user_${shortHash(telegramId, 24)}`;
}

function inviteCodeFor(matchId) {
  return `LP${shortHash(matchId, 10).toUpperCase()}`;
}

function shortHash(value, length) {
  return createHash("sha256").update(String(value)).digest("hex").slice(0, length);
}

function normalizeDisplayName(value) {
  const name = String(value ?? "").trim();
  return name.length > 0 ? name : "Legacy player";
}

function parseDate(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    fail("A legacy date could not be parsed.");
  }

  return date;
}

function groupBy(items, getKey) {
  const grouped = new Map();

  for (const item of items) {
    const key = getKey(item);
    const current = grouped.get(key) ?? [];
    current.push(item);
    grouped.set(key, current);
  }

  return grouped;
}

function volumeConfidence(gamesCount) {
  if (gamesCount <= 0) {
    return 0;
  }

  if (gamesCount <= 2) {
    return 20;
  }

  if (gamesCount <= 5) {
    return 50;
  }

  if (gamesCount <= 10) {
    return 75;
  }

  return 100;
}

function normalizeRoiToScore(roiBps) {
  const min = -5000;
  const max = 5000;
  const clamped = Math.max(min, Math.min(max, roiBps));

  return Math.round(((clamped - min) / (max - min)) * 100);
}

function toSafeNumber(value) {
  const max = BigInt(Number.MAX_SAFE_INTEGER);
  const min = BigInt(Number.MIN_SAFE_INTEGER);

  if (value > max) {
    return Number.MAX_SAFE_INTEGER;
  }

  if (value < min) {
    return Number.MIN_SAFE_INTEGER;
  }

  return Number(value);
}

function lastLine(value) {
  return String(value ?? "")
    .trim()
    .split("\n")
    .at(-1);
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

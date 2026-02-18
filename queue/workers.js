// queue/workers.js
// BullMQ worker — handles all game phase jobs.
"use strict";

const { Worker } = require("bullmq");
const { connection } = require("./redis");

// Lazy-loaded to avoid circular deps at startup
let _bot = null;

function getModules() {
  const stateService = require("../core/game/state.service");
  const roleDealer = require("../core/game/role.dealer");
  const nightCollector = require("../core/game/night.collector");
  const nightResolver = require("../core/game/night.resolver");
  const voteService = require("../core/game/vote.service");
  const winChecker = require("../core/game/win.checker");
  const { scheduleJob } = require("./queue");
  const t = require("../middleware/language.changer");
  return {
    stateService,
    roleDealer,
    nightCollector,
    nightResolver,
    voteService,
    winChecker,
    scheduleJob,
    t,
  };
}

// ─── Job Handlers ────────────────────────────────────────────────────────────

/**
 * lobby-start: fires 60s after /create.
 * If ≥8 players → assign roles → start night.
 * If <8 players → cancel game, notify group.
 */
async function handleLobbyStart(job) {
  const { gameId, chatId } = job.data;
  const {
    stateService,
    roleDealer,
    nightCollector,
    winChecker,
    scheduleJob,
    t,
  } = getModules();

  const game = await stateService.getGameById(gameId);
  if (!game || game.status !== "LOBBY") {
    console.log(`[lobby-start] Game ${gameId} not in LOBBY, skipping.`);
    return;
  }

  const playerCount = game.players.length;

  if (playerCount < 8) {
    // Not enough players — cancel
    await stateService.finishGame(gameId, null);
    const lang = "eng"; // group lang fallback
    try {
      await _bot.telegram.sendMessage(chatId, t(lang, "game_ended_early"));
    } catch {}
    console.log(
      `[lobby-start] Game ${gameId} cancelled — only ${playerCount} players.`,
    );
    return;
  }

  // Start the game
  const started = await stateService.safeStartGame(gameId);
  if (!started) {
    console.log(`[lobby-start] Game ${gameId} already started, skipping.`);
    return;
  }

  // Assign roles and DM players
  try {
    await roleDealer.assignRoles(gameId, _bot);
  } catch (e) {
    console.error("[lobby-start] assignRoles failed:", e.message);
  }

  // Announce night start in group
  const lang = "eng";
  try {
    await _bot.telegram.sendMessage(
      chatId,
      t(lang, "night_started", { number: 1 }),
    );
  } catch {}

  // Send night action menus
  try {
    await nightCollector.openNightActions(gameId, _bot);
  } catch (e) {
    console.error("[lobby-start] openNightActions failed:", e.message);
  }

  // Schedule night timeout
  await scheduleJob(
    "night-timeout",
    { gameId, chatId, nightNumber: 1 },
    45_000,
    `game:${gameId}:night:1`,
  );

  console.log(
    `[lobby-start] Game ${gameId} started with ${playerCount} players.`,
  );
}

/**
 * night-timeout: fires 45s after night starts.
 * Resolves night actions → check win → start day.
 */
async function handleNightTimeout(job) {
  const { gameId, chatId, nightNumber } = job.data;
  const { stateService, nightResolver, winChecker, scheduleJob, t } =
    getModules();

  // Idempotent: only proceed if still in NIGHT phase
  const transitioned = await stateService.safeTransition(
    gameId,
    "NIGHT",
    "DAY",
    {
      dayNumber: nightNumber, // day N follows night N
    },
  );
  if (!transitioned) {
    console.log(
      `[night-timeout] Game ${gameId} night ${nightNumber} already transitioned.`,
    );
    return;
  }

  // Resolve night actions
  try {
    await nightResolver.resolveNight(gameId, _bot);
  } catch (e) {
    console.error("[night-timeout] resolveNight failed:", e.message);
  }

  // Check win after night deaths
  const winner = await winChecker.checkAndEnd(gameId, _bot);
  if (winner) {
    console.log(`[night-timeout] Game ${gameId} ended. Winner: ${winner}`);
    return;
  }

  // Announce day
  const lang = "eng";
  try {
    await _bot.telegram.sendMessage(
      chatId,
      t(lang, "day_started", { number: nightNumber, seconds: 90 }),
    );
  } catch {}

  // Schedule day timeout
  await scheduleJob(
    "day-timeout",
    { gameId, chatId, dayNumber: nightNumber },
    90_000,
    `game:${gameId}:day:${nightNumber}`,
  );

  console.log(
    `[night-timeout] Game ${gameId} night ${nightNumber} resolved → DAY.`,
  );
}

/**
 * day-timeout: fires 90s after day starts.
 * Opens voting phase.
 */
async function handleDayTimeout(job) {
  const { gameId, chatId, dayNumber } = job.data;
  const { stateService, voteService, scheduleJob, t } = getModules();

  const transitioned = await stateService.safeTransition(
    gameId,
    "DAY",
    "VOTING",
  );
  if (!transitioned) {
    console.log(
      `[day-timeout] Game ${gameId} day ${dayNumber} already transitioned.`,
    );
    return;
  }

  // Open vote
  try {
    await voteService.openVote(gameId, chatId, _bot, false);
  } catch (e) {
    console.error("[day-timeout] openVote failed:", e.message);
  }

  // Schedule vote timeout
  await scheduleJob(
    "vote-timeout",
    { gameId, chatId, dayNumber, isRevote: false },
    45_000,
    `game:${gameId}:vote:${dayNumber}:0`,
  );

  console.log(`[day-timeout] Game ${gameId} day ${dayNumber} → VOTING.`);
}

/**
 * vote-timeout: fires 45s after vote opens.
 * Resolves vote → lynch → check win → next night.
 */
async function handleVoteTimeout(job) {
  const { gameId, chatId, dayNumber, isRevote } = job.data;
  const {
    stateService,
    voteService,
    winChecker,
    nightCollector,
    scheduleJob,
    t,
  } = getModules();

  // Resolve the vote
  let result;
  try {
    result = await voteService.resolveVote(
      gameId,
      chatId,
      _bot,
      dayNumber,
      isRevote,
    );
  } catch (e) {
    console.error("[vote-timeout] resolveVote failed:", e.message);
    result = { lynched: null, noLynch: true, revoting: false };
  }

  // If revoting, schedule another vote-timeout
  if (result.revoting) {
    await scheduleJob(
      "vote-timeout",
      { gameId, chatId, dayNumber, isRevote: true },
      45_000,
      `game:${gameId}:vote:${dayNumber}:1`,
    );
    console.log(
      `[vote-timeout] Game ${gameId} day ${dayNumber} — revote scheduled.`,
    );
    return;
  }

  // Check win after lynch
  const winner = await winChecker.checkAndEnd(gameId, _bot);
  if (winner) {
    console.log(`[vote-timeout] Game ${gameId} ended. Winner: ${winner}`);
    return;
  }

  // Transition to next night
  const nextNight = dayNumber + 1;
  const transitioned = await stateService.safeTransition(
    gameId,
    "VOTING",
    "NIGHT",
    {
      nightNumber: nextNight,
    },
  );
  if (!transitioned) {
    console.log(
      `[vote-timeout] Game ${gameId} already transitioned from VOTING.`,
    );
    return;
  }

  // Reset night flags
  await stateService.resetNightFlags(gameId);

  // Announce night
  const lang = "eng";
  try {
    await _bot.telegram.sendMessage(
      chatId,
      t(lang, "night_started", { number: nextNight }),
    );
  } catch {}

  // Send night action menus
  try {
    await nightCollector.openNightActions(gameId, _bot);
  } catch (e) {
    console.error("[vote-timeout] openNightActions failed:", e.message);
  }

  // Schedule next night timeout
  await scheduleJob(
    "night-timeout",
    { gameId, chatId, nightNumber: nextNight },
    45_000,
    `game:${gameId}:night:${nextNight}`,
  );

  console.log(`[vote-timeout] Game ${gameId} → NIGHT ${nextNight}.`);
}

// ─── Worker Bootstrap ─────────────────────────────────────────────────────────

function startWorkers(bot) {
  _bot = bot;
  console.log("✅ startWorkers called");

  new Worker(
    "game",
    async (job) => {
      console.log(`✅ Job received: ${job.name}`, job.data);

      switch (job.name) {
        case "lobby-start":
          return handleLobbyStart(job);

        case "night-timeout":
          return handleNightTimeout(job);

        case "day-timeout":
          return handleDayTimeout(job);

        case "vote-timeout":
          return handleVoteTimeout(job);

        // Legacy fallback
        case "phase-timeout":
          console.log("[workers] Legacy phase-timeout job received, ignoring.");
          return;

        default:
          console.log(`⚠️ Unknown job: ${job.name}`);
      }
    },
    {
      connection,
      concurrency: 5,
    },
  );

  console.log("✅ Worker created (queue: game)");
}

module.exports = { startWorkers };

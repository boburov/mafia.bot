// core/game/state.service.js
// Pure DB helpers for game state — no Telegraf dependencies here.
"use strict";

const { prisma } = require("../../config/db");

/**
 * Get game by Telegram chat_id, including all players.
 */
async function getGame(chatId) {
  return prisma.game.findUnique({
    where: { chat_id: String(chatId) },
    include: { players: true },
  });
}

/**
 * Get game by its UUID id, including all players.
 */
async function getGameById(gameId) {
  return prisma.game.findUnique({
    where: { id: gameId },
    include: { players: true },
  });
}

/**
 * Return only alive players for a given gameId.
 */
async function getAlivePlayers(gameId) {
  return prisma.gamePlayer.findMany({
    where: { gameId, isAlive: true },
  });
}

/**
 * Update the game phase and set lastTransitionAt to now.
 */
async function updatePhase(gameId, phase) {
  return prisma.game.update({
    where: { id: gameId },
    data: { phase, lastTransitionAt: new Date() },
  });
}

/**
 * Atomically transition phase only if the game is currently in `fromPhase`.
 * Returns the updated game record, or null if the transition was a no-op
 * (already transitioned — idempotent guard).
 *
 * Uses a raw updateMany so we can add a WHERE clause on phase.
 */
async function safeTransition(gameId, fromPhase, toPhase, extraData = {}) {
  const result = await prisma.game.updateMany({
    where: { id: gameId, phase: fromPhase, status: "RUNNING" },
    data: { phase: toPhase, lastTransitionAt: new Date(), ...extraData },
  });

  if (result.count === 0) return null; // already transitioned or wrong phase
  return prisma.game.findUnique({
    where: { id: gameId },
    include: { players: true },
  });
}

/**
 * Safely start the game from LOBBY.
 * Returns updated game or null if already started.
 */
async function safeStartGame(gameId) {
  const result = await prisma.game.updateMany({
    where: { id: gameId, status: "LOBBY" },
    data: {
      status: "RUNNING",
      phase: "NIGHT",
      nightNumber: 1,
      startedAt: new Date(),
      lastTransitionAt: new Date(),
    },
  });

  if (result.count === 0) return null;
  return prisma.game.findUnique({
    where: { id: gameId },
    include: { players: true },
  });
}

/**
 * Mark a game as FINISHED with a winner.
 */
async function finishGame(gameId, winnerTeam) {
  return prisma.game.update({
    where: { id: gameId },
    data: {
      status: "FINISHED",
      winnerTeam,
      endedAt: new Date(),
      lastTransitionAt: new Date(),
    },
  });
}

/**
 * Write a log entry for the game.
 */
async function writeLog(gameId, message, type = "INFO") {
  return prisma.gameLog.create({ data: { gameId, message, type } });
}

/**
 * Reset per-night flags on all players (isProtected, hasVoted).
 */
async function resetNightFlags(gameId) {
  return prisma.gamePlayer.updateMany({
    where: { gameId },
    data: { isProtected: false },
  });
}

/**
 * Reset per-day vote flags on all players.
 */
async function resetVoteFlags(gameId) {
  return prisma.gamePlayer.updateMany({
    where: { gameId },
    data: { hasVoted: false },
  });
}

module.exports = {
  getGame,
  getGameById,
  getAlivePlayers,
  updatePhase,
  safeTransition,
  safeStartGame,
  finishGame,
  writeLog,
  resetNightFlags,
  resetVoteFlags,
};

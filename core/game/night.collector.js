// core/game/night.collector.js
// Sends night-action inline menus to active-role players via PM.
"use strict";

const { Markup } = require("telegraf");
const { prisma } = require("../../config/db");
const t = require("../../middleware/language.changer");

/**
 * Build an inline keyboard of alive players (excluding the actor themselves).
 * Each button data: `{prefix}:{targetPlayerId}`
 */
function buildTargetKeyboard(alivePlayers, actorPlayerId, prefix) {
  const targets = alivePlayers.filter((p) => p.id !== actorPlayerId);
  const rows = targets.map((p) => [
    Markup.button.callback(p.displayName || p.telegramId, `${prefix}:${p.id}`),
  ]);
  return Markup.inlineKeyboard(rows);
}

/**
 * Send night action menus to DON (kill), DOCTOR (heal), COMMISSAR (check).
 * Also stores a pending GameAction row for each active role (targetPlayerId=null until chosen).
 *
 * @param {string} gameId
 * @param {object} bot
 */
async function openNightActions(gameId, bot) {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: { players: true },
  });
  if (!game || game.status !== "RUNNING" || game.phase !== "NIGHT") return;

  const alivePlayers = game.players.filter((p) => p.isAlive);

  // Enrich with display names from Telegram (stored as telegramId; we use first name if available)
  // We store displayName in a transient field for keyboard building
  for (const p of alivePlayers) {
    try {
      const member = await bot.telegram.getChatMember(
        game.chat_id,
        p.telegramId,
      );
      p.displayName =
        member?.user?.first_name ||
        member?.user?.username ||
        `Player ${p.telegramId}`;
    } catch {
      p.displayName = `Player ${p.telegramId}`;
    }
  }

  for (const player of alivePlayers) {
    const user = await prisma.user.findUnique({ where: { id: player.userId } });
    const lang = user?.lang || "eng";

    if (player.role === "DON") {
      const kb = buildTargetKeyboard(alivePlayers, player.id, "night_kill");
      try {
        await bot.telegram.sendMessage(
          player.telegramId,
          t(lang, "choose_kill_target"),
          kb,
        );
      } catch (e) {
        console.error(
          `[night.collector] DON DM failed (${player.telegramId}):`,
          e.message,
        );
      }
    }

    if (player.role === "DOCTOR") {
      const kb = buildTargetKeyboard(alivePlayers, player.id, "night_heal");
      try {
        await bot.telegram.sendMessage(
          player.telegramId,
          t(lang, "choose_heal_target"),
          kb,
        );
      } catch (e) {
        console.error(
          `[night.collector] DOCTOR DM failed (${player.telegramId}):`,
          e.message,
        );
      }
    }

    if (player.role === "COMMISSAR") {
      const kb = buildTargetKeyboard(alivePlayers, player.id, "night_check");
      try {
        await bot.telegram.sendMessage(
          player.telegramId,
          t(lang, "choose_check_target"),
          kb,
        );
      } catch (e) {
        console.error(
          `[night.collector] COMMISSAR DM failed (${player.telegramId}):`,
          e.message,
        );
      }
    }
  }
}

/**
 * Record a night action submitted by a player.
 * Upserts so that a player can change their choice before night resolves.
 * Returns false if action already resolved (night already ended).
 */
async function recordAction(
  gameId,
  actorPlayerId,
  targetPlayerId,
  actionType,
  nightNumber,
) {
  // Check for existing resolved action (idempotency)
  const existing = await prisma.gameAction.findUnique({
    where: {
      gameId_actorPlayerId_nightNumber: { gameId, actorPlayerId, nightNumber },
    },
  });

  if (existing?.resolvedAt) return false; // night already resolved, reject

  await prisma.gameAction.upsert({
    where: {
      gameId_actorPlayerId_nightNumber: { gameId, actorPlayerId, nightNumber },
    },
    update: { targetPlayerId, actionType },
    create: { gameId, actorPlayerId, targetPlayerId, actionType, nightNumber },
  });

  return true;
}

/**
 * Check if all active-role players have submitted their action.
 * Active roles: DON, DOCTOR, COMMISSAR.
 */
async function allActionsSubmitted(gameId, nightNumber) {
  const alivePlayers = await prisma.gamePlayer.findMany({
    where: {
      gameId,
      isAlive: true,
      role: { in: ["DON", "DOCTOR", "COMMISSAR"] },
    },
  });

  const actions = await prisma.gameAction.findMany({
    where: { gameId, nightNumber, resolvedAt: null },
  });

  const submittedActors = new Set(actions.map((a) => a.actorPlayerId));
  return alivePlayers.every((p) => submittedActors.has(p.id));
}

module.exports = { openNightActions, recordAction, allActionsSubmitted };

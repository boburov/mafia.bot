// core/game/night.resolver.js
// Resolves night actions: heal > kill > check. Announces results in group.
"use strict";

const { prisma } = require("../../config/db");
const { ROLES } = require("../../store/roles");
const t = require("../../middleware/language.changer");
const { writeLog } = require("./state.service");

/**
 * Get the group language (use first player's language as group lang fallback).
 */
async function getGroupLang(gameId) {
  const player = await prisma.gamePlayer.findFirst({ where: { gameId } });
  if (!player) return "eng";
  const user = await prisma.user.findUnique({ where: { id: player.userId } });
  return user?.lang || "eng";
}

/**
 * Resolve all night actions for the current night.
 * Priority: HEAL (sets isProtected) → KILL (kills unless protected) → CHECK_ROLE (DM result to commissar)
 *
 * Returns { deaths: GamePlayer[], saved: boolean, checkResult: object|null }
 */
async function resolveNight(gameId, bot) {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: { players: true },
  });
  if (!game) return;

  const nightNumber = game.nightNumber;
  const lang = await getGroupLang(gameId);

  // Fetch all unresolved actions for this night
  const actions = await prisma.gameAction.findMany({
    where: { gameId, nightNumber, resolvedAt: null },
    include: { actor: true, target: true },
  });

  let killedPlayer = null;
  let savedByDoctor = false;
  let checkResult = null;

  // --- Step 1: HEAL (Doctor) ---
  const healAction = actions.find((a) => a.actionType === "HEAL");
  if (healAction && healAction.target) {
    const target = healAction.target;

    // Doctor cannot heal same target 2 nights in a row
    const doctorPlayer = healAction.actor;
    const canHeal =
      doctorPlayer.lastHealedNight !== nightNumber - 1 ||
      doctorPlayer.lastHealedNight === null;

    if (canHeal) {
      await prisma.gamePlayer.update({
        where: { id: target.id },
        data: { isProtected: true },
      });
      // Track last healed night on doctor
      await prisma.gamePlayer.update({
        where: { id: doctorPlayer.id },
        data: { lastHealedNight: nightNumber },
      });
    }
  }

  // --- Step 2: KILL (Don/Mafia) ---
  const killAction = actions.find((a) => a.actionType === "KILL");
  if (killAction && killAction.target) {
    const target = await prisma.gamePlayer.findUnique({
      where: { id: killAction.targetPlayerId },
    });
    if (target && target.isAlive) {
      if (target.isProtected) {
        savedByDoctor = true;
        await writeLog(
          gameId,
          `${target.telegramId} was saved by Doctor`,
          "HEAL",
        );
      } else {
        // Kill the player
        await prisma.gamePlayer.update({
          where: { id: target.id },
          data: { isAlive: false },
        });
        killedPlayer = target;
        await writeLog(
          gameId,
          `${target.telegramId} was killed (role: ${target.role})`,
          "DEATH",
        );
      }
    }
  }

  // --- Step 3: CHECK_ROLE (Commissar) ---
  const checkAction = actions.find((a) => a.actionType === "CHECK_ROLE");
  if (checkAction && checkAction.target) {
    const target = checkAction.target;
    const roleData = ROLES[target.role];
    const isMafia = roleData?.team === "MAFIA";

    // Get commissar's lang
    const commissarUser = await prisma.user.findUnique({
      where: { id: checkAction.actor.userId },
    });
    const commissarLang = commissarUser?.lang || "eng";

    // Get target display name
    let targetName = target.telegramId;
    try {
      const member = await bot.telegram.getChatMember(
        game.chat_id,
        target.telegramId,
      );
      targetName =
        member?.user?.first_name || member?.user?.username || target.telegramId;
    } catch {}

    const checkMsg = isMafia
      ? t(commissarLang, "check_result_mafia", { name: targetName })
      : t(commissarLang, "check_result_not_mafia", { name: targetName });

    try {
      await bot.telegram.sendMessage(checkAction.actor.telegramId, checkMsg);
    } catch (e) {
      console.error("[night.resolver] Commissar DM failed:", e.message);
    }

    checkResult = { targetId: target.id, isMafia };
    await writeLog(
      gameId,
      `Commissar checked ${target.telegramId}: ${isMafia ? "MAFIA" : "NOT MAFIA"}`,
      "CHECK",
    );
  }

  // --- Mark all actions as resolved ---
  await prisma.gameAction.updateMany({
    where: { gameId, nightNumber, resolvedAt: null },
    data: { resolvedAt: new Date() },
  });

  // --- Announce results in group ---
  const lines = [];

  if (killedPlayer) {
    let killedName = killedPlayer.telegramId;
    try {
      const member = await bot.telegram.getChatMember(
        game.chat_id,
        killedPlayer.telegramId,
      );
      killedName =
        member?.user?.first_name ||
        member?.user?.username ||
        killedPlayer.telegramId;
    } catch {}
    lines.push(t(lang, "night_result_death", { name: killedName }));
  } else if (savedByDoctor) {
    lines.push(t(lang, "night_result_saved"));
  } else {
    lines.push(t(lang, "night_result_nobody_died"));
  }

  try {
    await bot.telegram.sendMessage(game.chat_id, lines.join("\n"));
  } catch (e) {
    console.error("[night.resolver] Group announce failed:", e.message);
  }

  return {
    deaths: killedPlayer ? [killedPlayer] : [],
    savedByDoctor,
    checkResult,
  };
}

module.exports = { resolveNight };

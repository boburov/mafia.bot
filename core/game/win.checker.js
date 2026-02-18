// core/game/win.checker.js
// Checks win conditions after each death event and ends the game if won.
"use strict";

const { prisma } = require("../../config/db");
const { ROLES } = require("../../store/roles");
const t = require("../../middleware/language.changer");
const { finishGame, writeLog } = require("./state.service");

/**
 * Get group lang.
 */
async function getGroupLang(gameId) {
  const player = await prisma.gamePlayer.findFirst({ where: { gameId } });
  if (!player) return "eng";
  const user = await prisma.user.findUnique({ where: { id: player.userId } });
  return user?.lang || "eng";
}

/**
 * Check win conditions:
 * - MAFIA wins if mafiaAlive >= townAlive (mafia has majority)
 * - TOWN wins if mafiaAlive === 0
 *
 * Returns "MAFIA" | "CIVIL" | null
 */
async function checkWin(gameId) {
  const alivePlayers = await prisma.gamePlayer.findMany({
    where: { gameId, isAlive: true },
  });

  let mafiaAlive = 0;
  let townAlive = 0;

  for (const p of alivePlayers) {
    const roleData = ROLES[p.role];
    if (!roleData) continue;
    if (roleData.team === "MAFIA") {
      mafiaAlive++;
    } else {
      townAlive++;
    }
  }

  if (mafiaAlive === 0) return "CIVIL";
  if (mafiaAlive >= townAlive) return "MAFIA";
  return null;
}

/**
 * End the game: mark finished, send summary to group.
 */
async function endGame(gameId, winner, bot) {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: { players: true },
  });
  if (!game) return;

  // Guard: already finished
  if (game.status === "FINISHED") return;

  await finishGame(gameId, winner);
  await writeLog(gameId, `Game ended. Winner: ${winner}`, "WIN");

  const lang = await getGroupLang(gameId);

  const winMsg =
    winner === "MAFIA" ? t(lang, "mafia_wins") : t(lang, "town_wins");

  // Build roles list for summary
  const lines = [];
  for (const p of game.players) {
    const roleData = ROLES[p.role];
    const roleName = roleData?.i18n?.name?.eng || p.role || "?";
    const aliveIcon = p.isAlive ? t(lang, "alive_icon") : t(lang, "dead_icon");

    let playerName = p.telegramId;
    try {
      const member = await bot.telegram.getChatMember(
        game.chat_id,
        p.telegramId,
      );
      playerName =
        member?.user?.first_name || member?.user?.username || p.telegramId;
    } catch {}

    lines.push(
      t(lang, "summary_player_row", {
        alive: aliveIcon,
        name: playerName,
        role: `${roleData?.emoji || ""} ${roleName}`,
      }),
    );
  }

  // Calculate duration
  const startedAt = game.startedAt || new Date();
  const durationMs = Date.now() - startedAt.getTime();
  const durationMin = Math.floor(durationMs / 60000);
  const durationSec = Math.floor((durationMs % 60000) / 1000);
  const duration = `${durationMin}m ${durationSec}s`;

  const winnerLabel =
    winner === "MAFIA"
      ? t(lang, "mafia_team_label")
      : t(lang, "town_team_label");

  const summaryMsg = t(lang, "game_summary", {
    winner: winnerLabel,
    duration,
    roles_list: lines.join("\n"),
  });

  try {
    await bot.telegram.sendMessage(game.chat_id, winMsg);
    await bot.telegram.sendMessage(game.chat_id, summaryMsg);
  } catch (e) {
    console.error("[win.checker] endGame announce failed:", e.message);
  }
}

/**
 * Check win and end game if won. Returns winner string or null.
 */
async function checkAndEnd(gameId, bot) {
  const winner = await checkWin(gameId);
  if (winner) {
    await endGame(gameId, winner, bot);
  }
  return winner;
}

module.exports = { checkWin, endGame, checkAndEnd };

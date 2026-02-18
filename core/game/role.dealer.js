// core/game/role.dealer.js
// Assigns MVP roles to players and DMs each player their role card.
"use strict";

const { prisma } = require("../../config/db");
const { ROLES } = require("../../store/roles");
const t = require("../../middleware/language.changer");

/**
 * Build the MVP role list for N players.
 * Formula: mafiaCount = max(2, floor(N/4))
 * Roles: 1 DON + (mafiaCount-1) MAFIA + 1 DOCTOR + 1 COMMISSAR + rest CIVILIAN
 */
function buildRoleList(playerCount) {
  const mafiaCount = Math.max(2, Math.round(playerCount / 4));
  const roles = [];

  roles.push("DON");
  for (let i = 1; i < mafiaCount; i++) roles.push("MAFIA");
  roles.push("DOCTOR");
  roles.push("COMMISSAR");

  const civilianCount = playerCount - roles.length;
  for (let i = 0; i < civilianCount; i++) roles.push("CIVILIAN");

  return roles;
}

/**
 * Fisher-Yates shuffle (in-place, returns array).
 */
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Assign roles to all players in the game and DM each player their role.
 * @param {string} gameId
 * @param {object} bot - Telegraf bot instance
 */
async function assignRoles(gameId, bot) {
  const players = await prisma.gamePlayer.findMany({ where: { gameId } });

  if (players.length < 8) {
    throw new Error(`Not enough players: ${players.length}`);
  }

  const roleList = shuffle(buildRoleList(players.length));

  // Assign roles in DB
  for (let i = 0; i < players.length; i++) {
    await prisma.gamePlayer.update({
      where: { id: players[i].id },
      data: { role: roleList[i], isAlive: true, isProtected: false },
    });
  }

  // DM each player their role
  for (let i = 0; i < players.length; i++) {
    const player = players[i];
    const roleKey = roleList[i];
    const roleData = ROLES[roleKey];
    if (!roleData) continue;

    // Get user lang
    const user = await prisma.user.findUnique({ where: { id: player.userId } });
    const lang = user?.lang || "eng";
    const langKey = lang === "ru" ? "ru" : lang === "uz" ? "uz" : "eng";

    const roleName = roleData.i18n.name[langKey] || roleData.i18n.name.eng;
    const roleDesc =
      roleData.i18n.description[langKey] || roleData.i18n.description.eng;

    const msg = t(lang, "your_role", {
      emoji: roleData.emoji,
      name: roleName,
      description: roleDesc,
    });

    try {
      await bot.telegram.sendMessage(player.telegramId, msg);
    } catch (e) {
      console.error(
        `[role.dealer] Failed to DM player ${player.telegramId}:`,
        e.message,
      );
    }
  }
}

module.exports = { assignRoles, buildRoleList };

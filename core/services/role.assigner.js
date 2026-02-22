// core/services/role.assigner.js
const { prisma } = require("../../config/db");
const { generateRolesForPlayers, RULES } = require("../../constants/role.generator");

function roleText(role) {
  // keep it simple; you can map to localized descriptions later
  return `🎭 Your role: <b>${role}</b>\n\n⚠️ Don’t share it with anyone.`;
}

async function assignRolesAndNotify(bot, gameId) {
  // 1) load game + players
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: { players: true },
  });
  if (!game) return;
  if (game.status !== "RUNNING") return; // only assign after start

  const players = game.players;
  const n = players.length;
  if (n < 2) return;

  // 2) generate roles
  const assigned = generateRolesForPlayers(players, RULES); 
  // assigned = [{...player, role: "DON"}, ...]

  // 3) update DB roles (transaction)
  await prisma.$transaction(
    assigned.map((p) =>
      prisma.gamePlayer.update({
        where: { id: p.id },
        data: { role: p.role },
      })
    )
  );

  // 4) DM each user (best effort)
  // IMPORTANT: telegramId is string in DB; Telegraf accepts number/string.
  for (const p of assigned) {
    try {
      await bot.telegram.sendMessage(p.telegramId, roleText(p.role), {
        parse_mode: "HTML",
      });
    } catch (e) {
      // Most common: user never started bot => 403
      console.log(`[DM FAIL] tg=${p.telegramId} user=${p.firstName}`, e?.response?.description || e.message);
    }
  }
}

module.exports = { assignRolesAndNotify };
const { prisma } = require("../../config/db");
const { generateRolesForPlayers, RULES } = require("../../constants/role.generator");
const { safeSendMessage } = require("../../lib/tg.safe");

function roleText(role) {
  return `🎭 Your role: <b>${role}</b>\n\n⚠️ Don’t share it with anyone.`;
}

async function assignRolesAndNotify(bot, gameId) {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: { players: true },
  });
  if (!game) return;
  if (game.status !== "RUNNING") return;

  const players = game.players;
  if (players.length < 2) return;

  const assigned = generateRolesForPlayers(players, RULES);

  await prisma.$transaction(
    assigned.map((p) =>
      prisma.gamePlayer.update({
        where: { id: p.id },
        data: { role: p.role },
      })
    )
  );

  for (const p of assigned) {
    try {
      await safeSendMessage(
        bot,
        p.telegramId,
        roleText(p.role),
        { parse_mode: "HTML" },
        4
      );
    } catch (e) {
      console.log(
        `[DM FAIL] tg=${p.telegramId} name=${p.firstName}`,
        e?.response?.description || e.code || e.message
      );
    }
  }
}

module.exports = { assignRolesAndNotify };
const { prisma } = require("../../config/db");
const { generateRolesForPlayers, RULES } = require("../../constants/role.generator");

function roleText(role) {
  return `🎭 Your role: <b>${role}</b>\n\n⚠️ Don’t share it with anyone.`;
}

async function sendWithRetry(bot, chatId, text, extra, tries = 3) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      return await bot.telegram.sendMessage(chatId, text, extra);
    } catch (e) {
      lastErr = e;
      await new Promise(r => setTimeout(r, 1000 * (2 ** i))); // 1s,2s,4s
    }
  }
  throw lastErr;
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

  // Update DB first
  await prisma.$transaction(
    assigned.map((p) =>
      prisma.gamePlayer.update({
        where: { id: p.id },
        data: { role: p.role },
      })
    )
  );

  // DM each player safely (one fail doesn't stop others)
  for (const p of assigned) {
    try {
      await bot.telegram.sendMessage(p.telegramId, roleText(p.role), {
        parse_mode: "HTML",
      });
    } catch (e) {
      console.log(
        `[DM FAIL] tg=${p.telegramId} name=${p.firstName}`,
        e?.response?.description || e.code || e.message
      );
      // continue
    }
  }
}

module.exports = { assignRolesAndNotify };
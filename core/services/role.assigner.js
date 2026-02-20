const { prisma } = require("../../config/db"); // adjust path
const { roleText } = require("../../constants/roles"); // adjust path

function mafiaCount(n) {
  return Math.max(1, Math.floor(n / 3));
}

function buildRolePool(n) {
  if (n < 8) throw new Error("Minimum 8 players required");

  const pool = [];
  pool.push("DON", "COMMISSAR", "DOCTOR");

  const mCount = mafiaCount(n);
  for (let i = 0; i < mCount - 1; i++) pool.push("MAFIA");

  if (n >= 9) pool.push("SERGEANT");
  if (n >= 10) pool.push("NURSE");
  if (n >= 11) pool.push("GUARD");
  if (n >= 12) pool.push("JUDGE");
  if (n >= 13) pool.push("SPY");
  if (n >= 14) pool.push("GENTLEMAN");

  while (pool.length < n) pool.push("CIVILIAN");
  return pool.slice(0, n);
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function assignRolesAndNotify(bot, gameId) {
  // players + user lang
  const players = await prisma.gamePlayer.findMany({
    where: { gameId },
    include: { game: true }, // for chat_id if you want
  });

  if (players.length < 8) throw new Error("Not enough players");

  // fetch langs for each player via User table
  const userIds = players.map((p) => p.userId);
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, lang: true },
  });
  const langByUserId = new Map(users.map((u) => [u.id, u.lang]));

  const rolePool = shuffle(buildRolePool(players.length));
  const shuffledPlayers = shuffle(players);

  // write roles to DB in a transaction
  await prisma.$transaction(
    shuffledPlayers.map((p, idx) =>
      prisma.gamePlayer.update({
        where: { id: p.id },
        data: { role: rolePool[idx] },
      })
    )
  );

  // DM each player their role
  const failed = [];
  for (let i = 0; i < shuffledPlayers.length; i++) {
    const p = shuffledPlayers[i];
    const roleKey = rolePool[i];
    const lang = langByUserId.get(p.userId) || "eng";

    try {
      await bot.telegram.sendMessage(p.telegramId, roleText(roleKey, lang));
    } catch (e) {
      // user may not have started bot => DM fails
      failed.push(p.telegramId);
    }
  }

  // optional: notify group if some DMs failed
  if (failed.length) {
    const chatId = players[0]?.game?.chat_id;
    if (chatId) {
      await bot.telegram.sendMessage(
        chatId,
        `⚠️ Some players couldn't receive DM (they must start the bot in private first).\nFailed: ${failed.length}`
      );
    }
  }

  return { count: players.length, roles: rolePool };
}

module.exports = { assignRolesAndNotify };
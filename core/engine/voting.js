const { prisma } = require("../../config/db");
const { Markup } = require("telegraf");

// callback format: v|<gameId>|<day>|<targetTelegramId or 0>
function voteCb(gameId, day, targetTgId) {
  return `v|${gameId}|${day}|${targetTgId}`;
}

function mention(tgId, name) {
  const safe = (name || "User").replace(/[<&>]/g, "");
  return `<a href="tg://user?id=${tgId}">${safe}</a>`;
}

function buildVoteKeyboard(gameId, day, alivePlayers) {
  const rows = alivePlayers.map(p => ([
    Markup.button.callback(
      `${p.firstName}${p.username ? " @" + p.username : ""}`,
      voteCb(gameId, day, p.telegramId)
    )
  ]));

  // skip vote
  rows.push([Markup.button.callback("⏭ Skip / No lynch", voteCb(gameId, day, "0"))]);

  return Markup.inlineKeyboard(rows);
}

async function startVoting(bot, gameId, chatId) {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: { players: true },
  });
  if (!game || game.status !== "RUNNING") return;

  const day = game.dayNumber || 1;
  const alive = game.players.filter(p => p.isAlive);

  // set phase
  await prisma.game.update({
    where: { id: gameId },
    data: { phase: "VOTING", lastTransitionAt: new Date() },
  });

  // clear previous votes for this day (safe)
  await prisma.vote.deleteMany({ where: { gameId, day } });

  const lines = alive.map((p, i) => `${i + 1}. ${mention(p.telegramId, p.firstName)}`).join("\n");

  await bot.telegram.sendMessage(
    chatId,
    `🌅 <b>Morning</b>\n\n🗳 <b>Voting started</b>\nPick your suspect below.\n\n👥 <b>Alive (${alive.length})</b>\n${lines}\n\n⏳ Voting ends soon...`,
    { parse_mode: "HTML", ...buildVoteKeyboard(gameId, day, alive) }
  );
}

async function finishVoting(bot, gameId, chatId) {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: { players: true },
  });
  if (!game || game.status !== "RUNNING") return;

  const day = game.dayNumber || 1;

  const aliveById = new Map(game.players.filter(p => p.isAlive).map(p => [p.id, p]));
  const aliveByTg = new Map(game.players.filter(p => p.isAlive).map(p => [p.telegramId, p]));

  const votes = await prisma.vote.findMany({
    where: { gameId, day },
    include: { target: true, voter: true },
  });

  // tally weights by targetId (null = skip)
  const tally = new Map(); // key: targetId|null, value: weight
  for (const v of votes) {
    const key = v.targetId || null;
    tally.set(key, (tally.get(key) || 0) + (v.weight || 1));
  }

  // if nobody voted
  if (tally.size === 0) {
    await bot.telegram.sendMessage(chatId, "🟨 No votes. Nobody is lynched.");
    return { lynched: false };
  }

  // find max
  let max = -1;
  for (const w of tally.values()) max = Math.max(max, w);

  const top = [...tally.entries()].filter(([_, w]) => w === max);

  // tie => nobody lynched
  if (top.length >= 2) {
    await bot.telegram.sendMessage(chatId, `🟨 Tie (${top.length} suspects). Nobody is lynched.`);
    return { lynched: false };
  }

  const [winnerTargetId] = top[0];

  // skip won
  if (!winnerTargetId) {
    await bot.telegram.sendMessage(chatId, "🟩 Majority voted to skip. Nobody is lynched.");
    return { lynched: false };
  }

  const target = aliveById.get(winnerTargetId);
  if (!target) {
    await bot.telegram.sendMessage(chatId, "🟨 Target is not alive anymore. Nobody is lynched.");
    return { lynched: false };
  }

  // ✅ Anti-lynch “device”: use User.defense if exists (telegramId stored in User.user_id)
  // if defense > 0 => consume 1 defense and save them
  const user = await prisma.user.findUnique({ where: { user_id: target.telegramId } }).catch(() => null);

  if (user && user.defense > 0) {
    await prisma.user.update({
      where: { user_id: target.telegramId },
      data: { defense: { decrement: 1 } },
    });

    await bot.telegram.sendMessage(
      chatId,
      `🛡 ${mention(target.telegramId, target.firstName)} was protected and survives the lynch!`,
      { parse_mode: "HTML" }
    );
    return { lynched: false };
  }

  // lynch
  await prisma.gamePlayer.update({
    where: { id: target.id },
    data: { isAlive: false },
  });

  await bot.telegram.sendMessage(
    chatId,
    `⚰️ ${mention(target.telegramId, target.firstName)} was lynched.`,
    { parse_mode: "HTML" }
  );

  return { lynched: true, targetTelegramId: target.telegramId };
}

module.exports = { startVoting, finishVoting };
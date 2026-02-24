const { prisma } = require("../../config/db");
const { Markup } = require("telegraf");
const t = require("../../middleware/language.changer");

// callback format: v|<gameId>|<day>|<targetTelegramId or 0>
function voteCb(gameId, day, targetTgId) {
  return `v|${gameId}|${day}|${targetTgId}`;
}

function mention(tgId, name) {
  const safe = (name || "User").replace(/[<&>]/g, "");
  return `<a href="tg://user?id=${tgId}">${safe}</a>`;
}

function buildVoteKeyboard(gameId, day, alivePlayers, lang) {
  const rows = alivePlayers.map(p => ([
    Markup.button.callback(
      `${p.firstName}${p.username ? " @" + p.username : ""}`,
      voteCb(gameId, day, p.telegramId)
    )
  ]));

  // skip vote
  rows.push([Markup.button.callback(t(lang, "voting.skip_button"), voteCb(gameId, day, "0"))]);

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
  const lang = game.creatorLang || "eng";

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
    t(lang, "voting.started", { count: alive.length, list: lines }),
    { parse_mode: "HTML", ...buildVoteKeyboard(gameId, day, alive, lang) }
  );
}

async function finishVoting(bot, gameId, chatId) {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: { players: true },
  });
  if (!game || game.status !== "RUNNING") return;

  const day = game.dayNumber || 1;
  const lang = game.creatorLang || "eng";

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
    await bot.telegram.sendMessage(chatId, t(lang, "voting.no_votes"));
    return { lynched: false };
  }

  // find max
  let max = -1;
  for (const w of tally.values()) max = Math.max(max, w);

  const top = [...tally.entries()].filter(([_, w]) => w === max);

  // tie => nobody lynched
  if (top.length >= 2) {
    await bot.telegram.sendMessage(chatId, t(lang, "voting.tie", { count: top.length }));
    return { lynched: false };
  }

  const [winnerTargetId] = top[0];

  // skip won
  if (!winnerTargetId) {
    await bot.telegram.sendMessage(chatId, t(lang, "voting.skipped"));
    return { lynched: false };
  }

  const target = aliveById.get(winnerTargetId);
  if (!target) {
    await bot.telegram.sendMessage(chatId, t(lang, "voting.target_not_alive"));
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
      t(lang, "voting.protected", { name: mention(target.telegramId, target.firstName) }),
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
    t(lang, "voting.lynched", { name: mention(target.telegramId, target.firstName) }),
    { parse_mode: "HTML" }
  );

  return { lynched: true, targetTelegramId: target.telegramId };
}

module.exports = { startVoting, finishVoting };
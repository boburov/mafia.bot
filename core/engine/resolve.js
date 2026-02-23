const { prisma } = require("../../config/db");

function mention(tgId, name) {
  const safe = (name || "User").replace(/[<&>]/g, "");
  return `<a href="tg://user?id=${tgId}">${safe}</a>`;
}

async function resolveNight(bot, gameId, chatId) {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: { players: true },
  });
  if (!game) return;
  if (game.phase !== "NIGHT") return;

  const nightNumber = game.nightNumber || 0;
  const alive = game.players.filter((p) => p.isAlive);

  const actions = await prisma.nightAction.findMany({
    where: { gameId, night: nightNumber },
    orderBy: { createdAt: "asc" },
  });

  // 1) BLOCK -> blocked targets cannot act
  const blocked = new Set(
    actions
      .filter((a) => a.actionType === "BLOCK" && a.targetTelegramId)
      .map((a) => a.targetTelegramId)
  );

  // helper: ignore blocked actors
  const usable = actions.filter((a) => !blocked.has(a.actorTelegramId));

  // 2) HEAL set
  const healed = new Set(
    usable
      .filter((a) => a.actionType === "HEAL" && a.targetTelegramId)
      .map((a) => a.targetTelegramId)
  );

  // 3) CHECK_ROLE (DM results)
  const checks = usable.filter((a) => a.actionType === "CHECK_ROLE" && a.targetTelegramId);

  // 4) KILL (MVP: if DON exists use DON target; else first kill)
  const kills = usable.filter((a) => a.actionType === "KILL" && a.targetTelegramId);
  const donPlayer = alive.find((p) => p.role === "DON");
  let finalKillTarget = null;

  if (donPlayer) {
    const donKill = kills.find((k) => k.actorTelegramId === donPlayer.telegramId);
    finalKillTarget = donKill?.targetTelegramId || null;
  }
  if (!finalKillTarget && kills.length) {
    finalKillTarget = kills[0].targetTelegramId;
  }

  // 5) Apply kill vs heal
  let diedPlayer = null;
  if (finalKillTarget) {
    const target = alive.find((p) => p.telegramId === finalKillTarget);
    if (target) {
      if (!healed.has(target.telegramId)) {
        diedPlayer = target;
        await prisma.gamePlayer.update({
          where: { id: target.id },
          data: { isAlive: false },
        });
      }
    }
  }

  // 6) Send CHECK_ROLE results (simple: show team + role)
  for (const c of checks) {
    const actor = alive.find((p) => p.telegramId === c.actorTelegramId);
    const target = game.players.find((p) => p.telegramId === c.targetTelegramId);
    if (!actor || !target) continue;

    const msg =
      `🕵️ Result:\n` +
      `Target: <b>${target.firstName}</b>\n` +
      `Role: <b>${target.role || "UNKNOWN"}</b>`;

    try {
      await bot.telegram.sendMessage(actor.telegramId, msg, { parse_mode: "HTML" });
    } catch (e) {
      console.log(`[DM FAIL check] tg=${actor.telegramId}`, e?.response?.description || e.message);
    }
  }

  // 7) Move to DAY (for now) + announce
  await prisma.game.update({
    where: { id: gameId },
    data: {
      phase: "DAY",
      lastTransitionAt: new Date(),
      dayNumber: (game.dayNumber || 0) + 1,
    },
  });

  if (diedPlayer) {
    await bot.telegram.sendMessage(
      chatId,
      `🌅 Morning!\n💀 Died: ${mention(diedPlayer.telegramId, diedPlayer.firstName)}`,
      { parse_mode: "HTML" }
    );
  } else {
    await bot.telegram.sendMessage(chatId, `🌅 Morning! Nobody died tonight 😶`);
  }
}

module.exports = { resolveNight };
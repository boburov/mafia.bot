const { prisma } = require("../../config/db");

function mention(tgId, name) {
  const safe = (name || "User").replace(/[<&>]/g, "");
  return `<a href="tg://user?id=${tgId}">${safe}</a>`;
}

function isMafiaRole(role) {
  return ["DON", "MAFIA", "SPY", "JOURNALIST", "LAWYER", "BINDER"].includes(role);
}
function isKillerRole(role) {
  return role === "KILLER";
}

async function checkWinAndFinish(bot, gameId, chatId) {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: { players: true },
  });
  if (!game) return { finished: true };

  const alive = game.players.filter(p => p.isAlive);

  // ✅ user request: if 1 alive -> winner no matter what
  if (alive.length <= 1) {
    await prisma.game.update({
      where: { id: gameId },
      data: { status: "FINISHED", phase: "DAY" },
    });

    if (alive.length === 1) {
      await bot.telegram.sendMessage(
        chatId,
        `🏆 Winner: ${mention(alive[0].telegramId, alive[0].firstName)}`,
        { parse_mode: "HTML" }
      );
    } else {
      await bot.telegram.sendMessage(chatId, `🏁 Game ended. No survivors.`);
    }
    return { finished: true };
  }

  return { finished: false };
}

async function resolveNight(bot, gameId, chatId) {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: { players: true },
  });
  if (!game || game.status !== "RUNNING") return;

  const nightNumber = game.nightNumber || 0;
  const alive = game.players.filter(p => p.isAlive);

  // load actions
  const actions = await prisma.nightAction.findMany({
    where: { gameId, nightNumber },
    orderBy: { createdAt: "asc" },
  });

  // maps
  const byTg = new Map(game.players.map(p => [p.telegramId, p]));
  const aliveTg = new Set(alive.map(p => p.telegramId));

  // 1) BLOCK: blocked actors cannot act
  const blockedActors = new Set(
    actions
      .filter(a => a.actionType === "BLOCK" && a.targetTelegramId)
      .map(a => String(a.targetTelegramId))
  );

  // 2) HEAL targets (protection)
  const protectedTargets = new Set(
    actions
      .filter(a => a.actionType === "HEAL" && a.targetTelegramId && !blockedActors.has(a.actorTelegramId))
      .map(a => String(a.targetTelegramId))
  );

  // 3) KILL actions (mafia and killer)
  const killActions = actions.filter(a =>
    a.actionType === "KILL" &&
    a.targetTelegramId &&
    !blockedActors.has(a.actorTelegramId)
  );

  const deaths = []; // { tgId, by: "MAFIA" | "KILLER" | "UNKNOWN" }

  for (const k of killActions) {
    const targetTg = String(k.targetTelegramId);
    if (!aliveTg.has(targetTg)) continue;

    // saved by doctor/guard
    if (protectedTargets.has(targetTg)) continue;

    const actor = byTg.get(String(k.actorTelegramId));
    const by =
      actor?.role && isMafiaRole(actor.role) ? "MAFIA" :
        actor?.role && isKillerRole(actor.role) ? "KILLER" :
          "UNKNOWN";

    deaths.push({ tgId: targetTg, by });
    aliveTg.delete(targetTg); // prevent double killing
  }

  // apply deaths in DB
  if (deaths.length > 0) {
    await prisma.gamePlayer.updateMany({
      where: { gameId, telegramId: { in: deaths.map(d => d.tgId) } },
      data: { isAlive: false },
    });
  }

  // morning summary
  await prisma.game.update({
    where: { id: gameId },
    data: { phase: "DAY", dayNumber: game.dayNumber + 1, lastTransitionAt: new Date() },
  });

  if (deaths.length === 0) {
    await bot.telegram.sendMessage(chatId, `🌅 Morning: nobody died tonight.`);
  } else {
    const lines = deaths.map(d => {
      const p = byTg.get(d.tgId);
      const killerText = d.by === "MAFIA" ? "🤵 Mafia" : d.by === "KILLER" ? "🔪 Killer" : "❓ Unknown";
      return `⚰️ ${mention(d.tgId, p?.firstName)} — killed by ${killerText}`;
    }).join("\n");

    await bot.telegram.sendMessage(chatId, `🌅 <b>Morning</b>\n\n${lines}`, { parse_mode: "HTML" });
  }

  // win check
  const win = await checkWinAndFinish(bot, gameId, chatId);
  if (win.finished) return;

  return;
}

module.exports = { resolveNight, checkWinAndFinish };
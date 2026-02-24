const { initGameWorker } = require("./queue/game.worker");
const all_roles = require("./core/commands/all_roles");
const change_lang = require("./core/commands/change.lang");
const help = require("./core/commands/help");
const start = require("./core/commands/start");
const create_game = require("./core/main/main");
const profileCommand = require("./core/main/profile");
const { prisma } = require("./config/db");

function bot_runner(bot) {

  // IDK whact action this is
  bot.action(/^v\|/, async (ctx) => {
    try {
      await ctx.answerCbQuery();

      const [_, gameId, dayStr, targetTg] = String(ctx.callbackQuery.data).split("|");
      const day = Number(dayStr);
      const voterTg = String(ctx.from.id);

      const game = await prisma.game.findUnique({
        where: { id: gameId },
        include: { players: true },
      });

      if (!game || game.phase !== "VOTING" || game.dayNumber !== day) return;

      const voter = game.players.find(p => p.telegramId === voterTg);
      if (!voter || !voter.isAlive) return;

      const weight = (voter.role === "GENTLEMAN") ? 2 : 1;

      const target = (targetTg === "0")
        ? null
        : game.players.find(p => p.telegramId === targetTg && p.isAlive);

      const targetId = target ? target.id : null;

      await prisma.vote.upsert({
        where: { gameId_day_voterId: { gameId, day, voterId: voter.id } },
        update: { targetId, weight },
        create: { gameId, day, voterId: voter.id, targetId, weight },
      });

      await ctx.answerCbQuery("✅ Vote saved!");
    } catch (e) {
      console.log("vote handler error:", e);
      try { await ctx.answerCbQuery("❌ Vote not saved"); } catch { }
    }
  });

  // /start — registration + main menu
  start(bot);

  // /lang — language selection
  change_lang(bot);

  // /help
  help(bot);

  // /create, join_game callback
  create_game(bot);

  // /profile
  profileCommand(bot);

  // game createing section
  initGameWorker(bot)

  // all_roles info
  all_roles(bot);

}

module.exports = bot_runner;

const { initGameWorker } = require("./queue/game.worker");
const t = require("./middleware/language.changer");
const all_roles = require("./core/commands/all_roles");
const change_lang = require("./core/commands/change.lang");
const help = require("./core/commands/help");
const start = require("./core/commands/start");
const create_game = require("./core/main/main");
const profileCommand = require("./core/main/profile");
const { prisma } = require("./config/db");

function bot_runner(bot) {

  // Voting action handler
  bot.action(/^v\|/, async (ctx) => {
    try {
      const lang = ctx.state?.lang || "eng";
      const [_, gameId, dayStr, targetTg] = String(ctx.callbackQuery.data).split("|");
      const day = Number(dayStr);
      const voterTg = String(ctx.from.id);

      const game = await prisma.game.findUnique({
        where: { id: gameId },
        include: { players: true },
      });

      if (!game || game.phase !== "VOTING" || game.dayNumber !== day) {
        return ctx.answerCbQuery(t(lang, "errors.game_not_found"));
      }

      const voter = game.players.find(p => p.telegramId === voterTg);
      if (!voter || !voter.isAlive) return ctx.answerCbQuery();

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

      await ctx.answerCbQuery(t(lang, "voting.vote_saved"));
    } catch (e) {
      console.log("vote handler error:", e);
      try { 
        const lang = ctx.state?.lang || "eng";
        await ctx.answerCbQuery(t(lang, "voting.vote_not_saved")); 
      } catch { }
    }
  });

  // Night action handler
  bot.action(/^na\|/, async (ctx) => {
    try {
      const lang = ctx.state?.lang || "eng";
      const [_, gameId, nightStr, actionType, targetTg] = String(ctx.callbackQuery.data).split("|");
      const nightNumber = Number(nightStr);
      const actorTgId = String(ctx.from.id);

      const game = await prisma.game.findUnique({
        where: { id: gameId },
        include: { players: true },
      });

      if (!game || game.phase !== "NIGHT" || game.nightNumber !== nightNumber) {
        return ctx.answerCbQuery(t(lang, "errors.game_not_found"));
      }

      if (actionType === "CANCEL") {
        await prisma.nightAction.deleteMany({
          where: { gameId, nightNumber, actorTelegramId: actorTgId }
        });
        return ctx.answerCbQuery(t(lang, "night.action_cancelled"));
      }

      await prisma.nightAction.upsert({
        where: { 
          gameId_nightNumber_actorTelegramId: { 
            gameId, nightNumber, actorTelegramId: actorTgId 
          } 
        },
        update: { targetTelegramId: targetTg, actionType },
        create: { gameId, nightNumber, actorTelegramId: actorTgId, targetTelegramId: targetTg, actionType },
      });

      await ctx.answerCbQuery(t(lang, "night.action_saved"));
    } catch (e) {
      console.log("night action error:", e);
      try {
        const lang = ctx.state?.lang || "eng";
        await ctx.answerCbQuery(t(lang, "night.action_not_saved"));
      } catch { }
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

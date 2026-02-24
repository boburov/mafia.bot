const { prisma } = require("../../config/db");
const t = require("../../middleware/language.changer");
const { gameQueue } = require("../../queue/queue");
const { renderLobby, lobbyKeyboard } = require("../../lib/lobby.render")

module.exports = function create_game(bot) {

  bot.command("create", async (ctx) => {
    try {
      const chatId = String(ctx.chat.id);
      if (!chatId.startsWith("-100")) return ctx.reply(t(ctx, "errors.group_only"));


      const userId = String(ctx.from.id);

      // 1️⃣ check if user started bot
      const userExists = await prisma.user.findUnique({
        where: { user_id: userId }
      });

      if (!userExists) {
        return ctx.reply(
          "⚠️ O‘yinda qatnashish uchun botni ochib /start bosing.\n\nSo‘ng qaytib kelib Join ni bosing.",
          { show_alert: true }
        );
      }

      let game = await prisma.game.findUnique({ where: { chat_id: chatId } });

      if (!game) {
        game = await prisma.game.create({
          data: {
            chat_id: chatId,
            status: "LOBBY",
            creatorLang: userExists.lang || "eng", // ✅ works after migration
          },
        });
      }


      const players = await prisma.gamePlayer.findMany({
        where: { gameId: game.id },
        orderBy: { firstName: "asc" },
      });

      const msg = await ctx.reply(renderLobby(game, players), {
        parse_mode: "HTML",
        ...lobbyKeyboard(chatId),
      });

      try {
        await ctx.telegram.pinChatMessage(ctx.chat.id, msg.message_id, { disable_notification: true });
      } catch (e) {
        console.log("Pin fail:", e?.response?.description || e.message);
      }

      await gameQueue.add(
        "START_GAME",
        { gameId: game.id, chatId: game.chat_id },
        {
          delay: 60_000,
          jobId: `START_GAME-${game.id}`,
          removeOnComplete: true,
          removeOnFail: 100,
          attempts: 3,
          backoff: { type: "exponential", delay: 2000 },
        }
      );

      await prisma.game.update({
        where: { id: game.id },
        data: { lobby_msg: msg.message_id },
      });

    } catch (err) {
      console.log(err);
      ctx.reply(t(ctx, "common.error"));
    }
  });

  bot.action("join_game", async (ctx) => {
    try {
      await ctx.answerCbQuery(); // very important

      const chatId = String(ctx.chat.id);
      const tgId = String(ctx.from.id);

      const game = await prisma.game.findUnique({ where: { chat_id: chatId } });
      if (!game || game.status !== "LOBBY") return;

      const userId = String(ctx.from.id);

      // 1️⃣ check if user started bot
      const userExists = await prisma.user.findUnique({
        where: { user_id: userId }
      });

      if (!userExists) {
        return ctx.reply(
          "⚠️ O‘yinda qatnashish uchun botni ochib /start bosing.\n\nSo‘ng qaytib kelib Join ni bosing.",
          { show_alert: true }
        );
      }

      await prisma.gamePlayer.upsert({
        where: {
          gameId_telegramId: {
            gameId: game.id,
            telegramId: tgId,
          },
        },
        update: {
          firstName: ctx.from.first_name ?? "User",
          username: ctx.from.username ?? null,
        },
        create: {
          gameId: game.id,
          telegramId: tgId,
          firstName: ctx.from.first_name ?? "User",
          username: ctx.from.username ?? null,
        },
      });

      const players = await prisma.gamePlayer.findMany({
        where: { gameId: game.id },
        orderBy: { firstName: "asc" },
      });

      if (game.lobby_msg) {
        await ctx.telegram.editMessageText(
          chatId,
          game.lobby_msg,
          undefined,                 // ✅ must be undefined
          renderLobby(game, players),
          { parse_mode: "HTML", ...lobbyKeyboard(chatId) }
        );
      }
    } catch (err) {
      console.log(err);
      ctx.reply("Lobby yangilanmadi...")
    }
  });

  bot.command("stop", async (ctx) => {
    const chatId = String(ctx.chat.id);
    if (!chatId.startsWith("-100")) return ctx.reply("Only groups.");

    const game = await prisma.game.findUnique({ where: { chat_id: chatId } });
    if (!game || game.status !== "RUNNING") return ctx.reply("No running game.");

    const lang = game.creatorLang || "eng";

    await prisma.game.update({
      where: { id: game.id },
      data: { status: "FINISHED", phase: "DAY", lastTransitionAt: new Date() },
    });

    await cancelGameJobs(game.id);

    await prisma.$transaction([
      prisma.nightAction.deleteMany({ where: { gameId: game.id } }),
      prisma.vote.deleteMany({ where: { gameId: game.id } }),
      prisma.gamePlayer.deleteMany({ where: { gameId: game.id } }),
      prisma.game.delete({ where: { id: game.id } }),
    ]);

    return ctx.reply(t(lang, "game.stopped"));
  });
};

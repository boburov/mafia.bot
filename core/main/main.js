const { Markup } = require("telegraf");
const { prisma } = require("../../config/db");
const t = require("../../middleware/language.changer");
const { scheduleJob } = require("../../queue/queue");

module.exports = function create_game(bot) {

  bot.command("create", async (ctx) => {
    try {
      const chatId = await String(ctx.chat.id)

      if (!chatId.startsWith("-100")) {
        ctx.reply("Ushbu Buyruq Faqat Kanalda Yoki Guruhda Ishlaydi")
      } else {
        const game = await prisma.game.findUnique({ where: { chat_id: chatId } })

        if (game) {
          if (game.status === "RUNNING") {
            return ctx.reply("bu guruhda oyin allaqachon boshlangan")
          } else if (game.status === "LOBBY") {
            return ctx.reply("Qoshil", Markup.inlineKeyboard([
              Markup.button.callback("➕ Qoshilish", `join_game:${ctx.from.id}`)
            ]))
          }
        } else {
          return ctx.reply("O'yin Hoz Yaratamiz")
        }
      }
    } catch (error) {
      ctx.reply("Xatolik Yuz Berdi");
      console.log(error);

    }
  });

  bot.action(/^join_game:(.+)$/, async (ctx) => {
    const user_id = ctx.match[1]
    console.log(user_id);

    ctx.reply("oioi")
  });
};

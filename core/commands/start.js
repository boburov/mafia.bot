const { Markup } = require("telegraf");
const { prisma } = require("../../config/db");
const t = require("../../middleware/language.changer");

function start(bot, def_lang) {
    const mainKeyboard = Markup.inlineKeyboard([
        [
            Markup.button.callback(t(def_lang, "shop"), "shop"),
            Markup.button.callback(t(def_lang, "profile"), "profile"),
        ],
        [Markup.button.callback(t(def_lang, "change_lang"), "change_lang")],
    ]);

    bot.start(async (ctx) => {
        const userId = String(ctx.from.id);

        await prisma.user.upsert({
            where: { user_id: userId },
            update: {},
            create: { user_id: userId },
        });

        return ctx.reply(t(def_lang, "welcome"), mainKeyboard);
    });
}

module.exports = start;

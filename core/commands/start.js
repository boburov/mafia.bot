const { Markup } = require("telegraf");
const { ensureUser } = require("../../constants/user.data");
const t = require("../../middleware/language.changer");

const buildMainKeyboard = (lang) =>
    Markup.inlineKeyboard([
        [
            Markup.button.callback(t(lang, "shop"), "shop"),
            Markup.button.callback(t(lang, "profile"), "profile"),
        ],
        [Markup.button.callback(t(lang, "change_lang"), "change_lang")],
    ]);

function start(bot) {
    bot.start(async (ctx) => {
        const userId = String(ctx?.from?.id ?? "");
        if (!userId) return;

        await ensureUser(userId);

        // ✅ take language from ctx (set by middleware)
        const lang = (ctx.state?.lang || "eng").trim();

        return ctx.reply(t(lang, "welcome"), buildMainKeyboard(lang));
    });
}

module.exports = start;

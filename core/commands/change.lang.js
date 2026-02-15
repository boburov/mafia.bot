const { Markup } = require("telegraf");
const t = require("../../middleware/language.changer");
const changeLanguage = require("../../constants/change.user.language");
// if you use cache middleware, import setCachedLang:
// const { setCachedLang } = require("../middleware/lang.middleware");

const languages = [
    { code: "uz", display: "🇺🇿 O‘zbekcha" },
    { code: "eng", display: "🇺🇸 English" },
    { code: "ru", display: "🇷🇺 Русский" },
];

const buildLangKeyboard = () =>
    Markup.inlineKeyboard(
        languages.map((l) => [Markup.button.callback(l.display, `set_lang:${l.code}`)])
    );

function change_lang(bot) {
    bot.command("lang", async (ctx) => {
        const lang = ctx.state?.lang || "eng";
        return ctx.reply(t(lang, "choose_lang"), buildLangKeyboard());
    });

    bot.action("change_lang", async (ctx) => {
        const lang = ctx.state?.lang || "eng";
        await ctx.answerCbQuery();
        return ctx.reply(t(lang, "choose_lang"), buildLangKeyboard());
    });

    bot.action(/^set_lang:(uz|eng|ru)$/, async (ctx) => {
        const newLang = ctx.match[1];
        const userId = String(ctx.from.id);

        await changeLanguage(userId, newLang);   // ✅ await!
        // setCachedLang?.(userId, newLang);     // ✅ if you have cache

        await ctx.answerCbQuery("✅ Updated");
        return ctx.reply(t(newLang, "welcome"));
    });
}

module.exports = change_lang;

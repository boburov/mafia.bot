const { Markup } = require("telegraf")
const t = require("../../middleware/language.changer")

const languages = {
    uz: {
        lang: "default_uz",
        display: "🇺🇿 O‘zbekcha",
        flag: "🇺🇿"
    },
    eng: {
        lang: "default_eng",
        display: "🇺🇸 English",
        flag: "🇺🇸"
    },
    ru: {
        lang: "default_ru",
        display: "🇷🇺 Русский",
        flag: "🇷🇺"
    }
};

function change_lang(bot, def_lang) {
    bot.command("lang", async ctx => {
        ctx.reply(t(def_lang, "choose_lang"), Markup.inlineKeyboard([
            [Markup.button.callback(languages.uz.display, languages.uz.lang)],
            [Markup.button.callback(languages.eng.display, languages.eng.lang)],
            [Markup.button.callback(languages.ru.display, languages.ru.lang)],
        ])
        )
    })

    bot.action("change_lang", async ctx => {
        await ctx.reply(t(def_lang, "choose_lang"), Markup.inlineKeyboard([
            [Markup.button.callback(languages.uz.display, languages.uz.lang)],
            [Markup.button.callback(languages.eng.display, languages.eng.lang)],
            [Markup.button.callback(languages.ru.display, languages.ru.lang)],
        ]))
    })

    bot.action(/^default_(.+)$/, async (ctx) => {
        const lang = ctx.match[1];

        console.log("Selected lang:", lang);

        await ctx.answerCbQuery();
        await ctx.reply(`Language changed to: ${lang}`);
    });

}

module.exports = change_lang
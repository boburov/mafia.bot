const t = require("../../middleware/language.changer")

module.exports = function help(bot) {
    bot.command("help", async ctx => {
        const lang = (ctx.state?.lang || "eng").trim();
        ctx.reply(t(lang, "help"))

    })
}
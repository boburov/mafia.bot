const { Markup } = require("telegraf");
const prisma = require("../../config/db")
const t = require("../../middleware/language.changer")

module.exports = function create_game(bot) {
    bot.action(/^join_the_game_(\d+)$/, async (ctx) => {
        const id = ctx.match[1];
        const user = await prisma.prisma.user.findFirst({ where: { user_id: String(id) } })

        if (user) {
            ctx.reply("SIz oyinga qoshildingiz")
        } else {
            ctx.reply("SIz oyinga qoshilmadingiz")
        }
    });


}

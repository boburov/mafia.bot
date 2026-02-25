const { Markup } = require("telegraf")
const { prisma } = require("../../config/db")

function profile(bot) {
    bot.action("profile", async ctx => {
        const user = await prisma.user.findUnique({ where: { user_id: String(ctx.from.id) } })

        ctx.reply(`Isim: ${ctx.from.first_name}\n\n💵 Pul:${user.money}\n💎 Olmos: ${user.diamond}\n-------------------------\n🎭Maxsus Rol:${user.role}`, Markup.inlineKeyboard([[
            Markup.button.callback("🛒 Do'kon", "shop"),
            Markup.button.callback("🇺🇿 Til", "lang")
        ],
        [
            Markup.button.url("🎲 Chatga Qo'shilish", "https://t.me/AuthenticMafiaChat"),
        ],]))
    })
}


module.exports = profile
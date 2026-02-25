const isAdmin = require("../../lib/admin.verifcation")
const { prisma } = require("../../config/db")
const { Markup } = require("telegraf")

function create(bot) {
    bot.command("create", async ctx => {
        if (await isAdmin(ctx)) {

            const game = await prisma.game.findFirst({ where: { chatId: String(ctx.chat.id) } })

            if (!game || game.status === "FINISHED") {
                await prisma.game.create({
                    data: {
                        chatId: String(ctx.chat.id),
                        status: "LOBBY",
                        phase: "DAY"
                    }
                })
                await ctx.reply("O'yin Yaratildi", Markup.inlineKeyboard([
                    Markup.button.callback("➕ Qo'shilish", `join_game_${ctx.from.id}`)
                ]));
            } else {
                if (game.status === "LOBBY") {
                    await ctx.reply("O'yin Yaratilingan\nQo'shilishingiz Mumkun", Markup.inlineKeyboard([
                        Markup.button.callback("➕ Qo'shilish", `join_game_${ctx.from.id}`)
                    ]));
                } else {
                    await ctx.reply("O'yin Boshlangan\nSemechka Chaqib keling", Markup.inlineKeyboard([
                        Markup.button.url("🤖 Botga O'tish", "https://t.me/AuthenticMafiaBot?start=true"),
                    ]));
                }
            }

        } else {
            ctx.reply("sorry son you're not admin")
        }
    })
}

module.exports = create
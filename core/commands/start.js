const { Markup } = require("telegraf");
const isAdmin = require("../../lib/admin.verifcation");
const { prisma } = require("../../config/db")

module.exports = function start(bot) {

    bot.command("start", async ctx => {
        if
            (!String(ctx.chat.id).
                startsWith("-100")) {

            await
                prisma.
                    user.
                    upsert({
                        where: {
                            user_id: String(ctx.from.id),
                        },
                        update: {
                            user_id: String(ctx.from.id),
                        },
                        create: {
                            user_id: String(ctx.from.id),
                        },
                    })

            await ctx.
                reply("🤵🏻 Mafia Botga Hush Kelibsiz",
                    Markup.inlineKeyboard
                        (
                            [
                                [
                                    Markup.button.callback("🛒 Do'kon", "shop"),
                                    Markup.button.callback("👤 Profil", "profile")
                                ],
                                [
                                    Markup.button.url("🎲 Chatga Qo'shilish", "https://t.me/AuthenticMafiaChat"),
                                ],
                                [
                                    Markup.button.url("➕ Guruhga Qo'shish", "https://t.me/AuthenticMafiaBot?startgroup=true")
                                ]
                            ]
                        )
                )

        } else {
            if (await isAdmin(ctx)) {
                // this must be for 3 diff lanuage ppl
                await ctx.reply("O'yin Boshlandi");
                // ---- main game logic puts here -----

            } else {
                await ctx.reply("Faqat Admin O'yinga Start Bera Oladi");
            }
        }
    })

}       
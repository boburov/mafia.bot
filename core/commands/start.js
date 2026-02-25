const { Markup } = require("telegraf");
const isAdmin = require("../../lib/admin.verifcation");
const { prisma } = require("../../config/db");
const isExist = require("../../lib/user.verfication");

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
                // ---- main game logic puts here -----
                const game = await prisma.game.findUnique({ where: { chatId: String(ctx.chat.id) } })

                if (!game) {
                    await ctx.reply("O'yin Mavjud Emas\n/create Buyrug`ini Yuboring",
                        Markup.inlineKeyboard([
                            Markup.button.url("🤖 Botga O'tish", "https://t.me/AuthenticMafiaBot?start=true"),
                        ])
                    );
                } else {
                    if (await isExist(ctx)) {
                        await ctx.reply("O'yin Boshlandi", Markup.inlineKeyboard([
                            Markup.button.callback("➕ Qo'shilish", `join_${ctx.from.id}`)
                        ]));
                    } else {

                        const mention = `<a href="tg://user?id=${ctx.from.id}">${ctx.from.first_name}</a>`;

                        const chatId = ctx.chat.id

                        await ctx.telegram.sendMessage(
                            chatId,
                            `Hali Botga Start \nBermagansiz ${mention}`,
                            {
                                parse_mode: "HTML",
                                ...Markup.inlineKeyboard([
                                    [Markup.button.url("🤖 Botga O'tish", "https://t.me/AuthenticMafiaBot?start=true")]
                                ])
                            }
                        );
                    }
                }

            } else {
                await ctx.reply("Faqat Admin O'yinga Start Bera Oladi");
            }
        }
    })

}       
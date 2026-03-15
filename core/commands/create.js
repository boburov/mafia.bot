const isAdmin = require("../../lib/admin.verifcation");
const { prisma } = require("../../config/db");
const { Markup } = require("telegraf");

function create(bot) {
    bot.command("create", async (ctx) => {
        const chatId = String(ctx.chat.id);
        // !(await isAdmin(ctx))
        if (!chatId.startsWith("-100")) {
            return ctx.reply("Faqat Kanalda Oynash Mumkun");
        }


        // Find latest non-finished game (active game)
        const game = await prisma.game.findFirst({
            where: {
                chatId,
                NOT: { status: "FINISHED" },
            },
            orderBy: { id: "desc" }, // optional
        });

        // If there is an active game:
        if (game) {
            if (game.status === "LOBBY") {
                return ctx.reply(
                    "O'yin allaqachon yaratilgan ✅\nQo'shilishingiz mumkin:",
                    Markup.inlineKeyboard([
                        [Markup.button.callback("➕ Qo'shilish", `join_game_${game.id}`)],
                    ])
                );
            }

            // game started (or other status)
            return ctx.reply(
                "O'yin boshlangan ❌\nEndi qo'shilib bo'lmaydi.",
                Markup.inlineKeyboard([
                    [Markup.button.url("🤖 Botga O'tish", "https://t.me/AuthenticMafiaBot?start=true")],
                ])
            );
        }

        // No active game -> create a new one
        const newGame = await prisma.game.create({
            data: {
                chatId,
                status: "LOBBY",
                phase: "DAY",
            },
        });

        return ctx.reply(
            "O'yin yaratildi ✅",
            Markup.inlineKeyboard([
                [Markup.button.callback("➕ Qo'shilish", `join_game_${newGame.id}`)],
            ])
        );
    });

    bot.action(/join_game_(.+)/, async (ctx) => {
        const gameId = ctx.match[1];
        const userTgId = String(ctx.from.id);

        const ok = await isExist(ctx);
        if (!ok) {
            await ctx.answerCbQuery("Avval botga start bering ❗", { show_alert: true });
            return;
        }

        const game = await prisma.game.findUnique({ where: { id: gameId } });

        if (!game)
            return ctx.answerCbQuery("O'yin topilmadi ❌", { show_alert: true });

        if (game.status !== "LOBBY")
            return ctx.answerCbQuery("O'yin boshlangan ❌", { show_alert: true });

        try {
            await prisma.player.create({
                data: { userTgId, gameId },
            });

            await ctx.answerCbQuery("Qo'shildingiz ✅");
            await ctx.reply(`✅ ${ctx.from.first_name} o'yinga qo'shildi!`);
        } catch (e) {
            await ctx.answerCbQuery("Siz allaqachon qo'shilgansiz 🙂", { show_alert: true });
        }
    });
}

module.exports = create;
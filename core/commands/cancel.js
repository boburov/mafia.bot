const { Markup } = require("telegraf");
const isAdmin = require("../../lib/admin.verifcation");
const { prisma } = require("../../config/db");

module.exports = function cancel(bot) {
    bot.command("cancel", async (ctx) => {
        const chatId = String(ctx.chat.id);

        // Only works in groups (optional)
        if (!chatId.startsWith("-100")) {
            return ctx.reply("Bu buyruq faqat guruhda ishlaydi.");
        }

        if (!(await isAdmin(ctx))) {
            return ctx.reply("Faqat admin o'yinni bekor qila oladi ❌");
        }

        // Find active game (not finished)
        const game = await prisma.game.findFirst({
            where: { chatId, NOT: { status: "FINISHED" } },
            orderBy: { id: "desc" },
            include: { _count: { select: { players: true } } },
        });

        if (!game) {
            return ctx.reply("Bekor qilinadigan o'yin topilmadi.");
        }

        // If you DON'T want to allow cancel after start:
        if (game.status !== "LOBBY") {
            return ctx.reply("O'yin boshlangan. Bekor qilib bo'lmaydi ❌");
        }

        // Cancel: mark finished + delete players (recommended cleanup)
        await prisma.player.deleteMany({ where: { gameId: game.id } });

        await prisma.game.update({
            where: { id: game.id },
            data: { status: "FINISHED" },
        });

        return ctx.reply(`🛑 O'yin bekor qilindi. (${game._count.players} ta o'yinchi o'chirildi)`);
    });
};
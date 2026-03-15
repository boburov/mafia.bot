const { Markup } = require("telegraf");
const isAdmin = require("../../lib/admin.verifcation");
const { prisma } = require("../../config/db");
const isExist = require("../../lib/user.verfication");
const { gameQueue } = require("../../handlers/queue");
const MIN_PLAYERS_TO_START = 4;

module.exports = function start(bot) {
    bot.command("start", async (ctx) => {
        const chatId = String(ctx.chat.id);

        if (!chatId.startsWith("-100")) {
            await prisma.user.upsert({
                where: { user_id: String(ctx.from.id) },
                update: {},
                create: { user_id: String(ctx.from.id) },
            });

            return ctx.reply(
                "🤵🏻 Mafia Botga Hush Kelibsiz",
                Markup.inlineKeyboard([
                    [Markup.button.callback("🛒 Do'kon", "shop"), Markup.button.callback("👤 Profil", "profile")],
                    [Markup.button.url("🎲 Chatga Qo'shilish", "https://t.me/AuthenticMafiaChat")],
                    [Markup.button.url("➕ Guruhga Qo'shish", "https://t.me/AuthenticMafiaBot?startgroup=true")],
                ])
            );
        }

        // ✅ GROUP: get active game
        const game = await prisma.game.findFirst({
            where: { chatId, NOT: { status: "FINISHED" } },
            orderBy: { id: "desc" },
            include: { _count: { select: { players: true } } }, // 👈 player count
        });

        if (!game) {
            return ctx.reply(
                "🛑 O'yin mavjud emas.\n/create buyrug'ini yuboring",
                Markup.inlineKeyboard([
                    [Markup.button.url("🤖 Botga O'tish", "https://t.me/AuthenticMafiaBot?start=true")],
                ])
            );
        }

        const admin = await isAdmin(ctx);

        // ✅ If admin pressed /start: auto-start when enough players
        if (admin) {
            if (game.status === "LOBBY") {
                // workerga job qo'yish
                await gameQueue.add("startDay", {
                    gameId: game.id,
                    chatId: ctx.chat.id
                }, { delay: 300 });

                return ctx.reply(
                    "O'yin tayyor ✅\nQo'shilish uchun bosing:",
                    Markup.inlineKeyboard([
                        [Markup.button.callback("➕ Qo'shilish", `join_game_${game.id}`)],
                    ])
                );
            }

            // already running
            return ctx.reply("O'yin allaqachon boshlangan ✅");
        }

        // ✅ If normal user pressed /start:
        if (game.status === "LOBBY") {
            await gameQueue.add("startNight", {
                gameId: game.id,
                chatId: ctx.chat.id
            }, { delay: 300 });
            return ctx.reply(
                "O'yin tayyor ✅\nQo'shilish uchun bosing:",
                Markup.inlineKeyboard([
                    [Markup.button.callback("➕ Qo'shilish", `join_game_${game.id}`)],
                ])
            );
        }

        // running/started
        return ctx.reply("O'yin boshlangan ❌\nEndi qo'shib bo'lmaydi.");
    });

    // ✅ join handler (same as before)
    bot.action(/join_game_(.+)/, async (ctx) => {
        const gameId = ctx.match[1];
        const userTgId = String(ctx.from.id);

        const ok = await isExist(ctx);
        if (!ok) {
            await ctx.answerCbQuery("Avval botga start bering ❗", { show_alert: true });
            return;
        }

        const game = await prisma.game.findUnique({
            where: { id: gameId },
            include: { _count: { select: { players: true } } },
        });

        if (!game) return ctx.answerCbQuery("O'yin topilmadi ❌", { show_alert: true });
        if (game.status !== "LOBBY") return ctx.answerCbQuery("O'yin boshlangan ❌", { show_alert: true });

        try {
            await prisma.player.create({ data: { userTgId, gameId } });

            await ctx.answerCbQuery("Qo'shildingiz ✅");
            await ctx.reply(`✅ ${ctx.from.first_name} o'yinga qo'shildi! (${game._count.players + 1})`);
        } catch (e) {
            await ctx.answerCbQuery("Siz allaqachon qo'shilgansiz 🙂", { show_alert: true });
        }
    });
};
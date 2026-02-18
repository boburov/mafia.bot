const { Markup } = require("telegraf");
const prisma = require("../../config/db");
const t = require("../../middleware/language.changer");
const { gameQueue } = require("../../queue/queue")


module.exports = function create_game(bot) {

    bot.command("create", async (ctx) => {
        try {
            const chatId = String(ctx.chat.id);
            const lang = String(ctx.state?.lang || "eng").trim();

            const isGroup =
                ctx.chat?.type === "group" ||
                ctx.chat?.type === "supergroup" ||
                chatId.startsWith("-100");

            if (!isGroup) {
                return ctx.reply(
                    "This game can only be played in a group chat.",
                    Markup.inlineKeyboard([
                        [Markup.button.url(t(lang, "add_to_chanel"), "https://t.me/AuthenticMafiaBot?startgroup=mafia")]
                    ])
                );
            }

            // 1) check existing game for this group
            let game = await prisma.prisma.game.findUnique({
                where: { chat_id: chatId }
            });

            // 2) if no game or previous finished, create a new one
            if (!game || game.status === "FINISHED") {
                game = await prisma.prisma.game.upsert({
                    where: { chat_id: chatId },
                    update: { status: "LOBBY", phase: "DAY" },
                    create: { chat_id: chatId, status: "LOBBY", phase: "DAY" }
                });
            } else {
                // game already exists and active
                return ctx.reply("⚠️ A game is already created in this group. Players can join now.");
            }

            await gameQueue.add(
                "phase-timeout",
                { chatId: ctx.chat.id },
                { delay: 60000 } // wait 60 seconds
            );

            // 3) join button must contain gameId (NOT user id)
            return ctx.reply(
                t(lang, "game_will_start"),
                Markup.inlineKeyboard([
                    [Markup.button.callback(t(lang, "join"), `join_game:${game.id}`)]
                ])
            );

        } catch (error) {
            console.error(error);
            return ctx.reply("Please /start the bot first.");
        }
    });

    bot.action(/^join_game:(.+)$/, async (ctx) => {
        const lang = String(ctx.state?.lang || "eng").trim();

        try {
            await ctx.answerCbQuery();

            const gameId = ctx.match[1];
            const telegramUserId = String(ctx.from.id);
            const chatId = String(ctx.chat.id);

            // 1) ensure user is registered
            const user = await prisma.prisma.user.findUnique({
                where: { user_id: telegramUserId }
            });

            if (!user) {
                return ctx.reply(
                    "You are not registered yet.\nPlease open the bot and press /start first.",
                    Markup.inlineKeyboard([[Markup.button.url("Open bot", "https://t.me/AuthenticMafiaBot")]])
                );
            }

            // 2) ensure game belongs to this chat (security)
            const game = await prisma.prisma.game.findUnique({ where: { id: gameId } });
            if (!game || game.chat_id !== chatId) {
                return ctx.reply("❌ This game is not valid for this group.");
            }

            // 3) add player (no duplicates because of @@unique)
            await prisma.prisma.gamePlayer.create({
                data: { gameId: gameId, userId: user.id, role: "" }
            });

            return ctx.reply(`✅ Joined! @${ctx.from.username || ctx.from.first_name}`);

        } catch (error) {
            // if already joined, prisma throws unique constraint error
            if (String(error?.code) === "P2002") {
                return ctx.reply("⚠️ You already joined this game.");
            }

            console.error(error);
            return ctx.reply(
                t(lang, "error_register") || "You couldn't join. Please open the bot and press /start first.",
                Markup.inlineKeyboard([[Markup.button.url("Open bot", "https://t.me/AuthenticMafiaBot")]])
            );
        }
    });

};

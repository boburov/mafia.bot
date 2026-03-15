/**
 * core/commands/create.js
 *
 * Fully translated — all messages use t() based on group's default lang.
 */

const { Markup } = require("telegraf");
const isAdmin = require("../../lib/admin.verifcation");
const isExist = require("../../lib/user.verfication");
const { prisma } = require("../../config/db");
const { gameQueue } = require("../../handlers/queue");
const { t, getLang, getGroupDefaultLang } = require("../i18n");

const { MIN_PLAYERS, IS_TEST } = require("../../config/test.config");
const LOBBY_TIMEOUT_MS = IS_TEST ? 10_000 : 3 * 60 * 1000; // 10s in test mode
const MAX_PLAYERS = 50;

// chatId → { messageId, gameId }
const lobbyMessages = new Map();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function progressBar(current, max) {
    const filled = Math.round((current / max) * 10);
    return "🟩".repeat(filled) + "⬜".repeat(10 - filled);
}

async function buildLobbyText(game, lang) {
    if (!lang) lang = game.lang ?? await getGroupDefaultLang(game.chatId);

    const players = await prisma.player.findMany({
        where: { gameId: game.id },
        orderBy: { id: "asc" },
    });

    const list = players.length > 0
        ? players.map((p, i) => `${i + 1}. ${p.name || p.userTgId}`).join("\n")
        : {
            uz: "_Hali hech kim qo'shilmagan..._",
            ru: "_Пока никто не присоединился..._",
            eng: "_No one has joined yet..._",
        }[lang] ?? "_No one has joined yet..._";

    const timeoutLine = {
        uz: "⏳ Lobby 3 daqiqadan keyin yopiladi.",
        ru: "⏳ Лобби закроется через 3 минуты.",
        eng: "⏳ Lobby closes in 3 minutes.",
    }[lang] ?? "⏳ Lobby closes in 3 minutes.";

    const startLine = {
        uz: "▶️ Admin /start bosib tezroq boshlashi mumkin.",
        ru: "▶️ Администратор может начать раньше — /start.",
        eng: "▶️ Admin can use /start to begin early.",
    }[lang] ?? "▶️ Admin can use /start to begin early.";

    const header = {
        uz: "🎲 *MAFIA O'YINI — LOBBY*",
        ru: "🎲 *МАФИЯ — ЛОББИ*",
        eng: "🎲 *MAFIA GAME — LOBBY*",
    }[lang] ?? "🎲 *MAFIA GAME — LOBBY*";

    return (
        `${header}\n\n` +
        `${t(lang, "players_count", { count: `*${players.length}/${MAX_PLAYERS}*` })}\n` +
        `${progressBar(players.length, MAX_PLAYERS)}\n\n` +
        `${list}\n\n` +
        `${timeoutLine}\n` +
        `${startLine}`
    );
}

async function refreshLobby(bot, chatId, game) {
    const entry = lobbyMessages.get(String(chatId));
    if (!entry || entry.gameId !== game.id) return;

    try {
        const lang = game.lang ?? await getGroupDefaultLang(chatId);
        const text = await buildLobbyText(game, lang);

        await bot.telegram.editMessageText(
            chatId, entry.messageId, null, text,
            {
                parse_mode: "Markdown",
                ...Markup.inlineKeyboard([
                    [Markup.button.callback(t(lang, "join"), `join_${game.id}`)],
                    [Markup.button.callback(t(lang, "leave"), `leave_${game.id}`)],
                ]),
            }
        );
    } catch { /* message too old or unchanged */ }
}

// ─── Command ──────────────────────────────────────────────────────────────────

function create(bot) {

    // /create
    bot.command("create", async (ctx) => {
        const chatId = String(ctx.chat.id);
        const lang = await getLang(ctx);

        if (!chatId.startsWith("-100"))
            return ctx.reply(t(lang, "error"));

        if (!(await isAdmin(ctx)))
            return ctx.reply(t(lang, "creator_only"));

        const existing = await prisma.game.findFirst({
            where: { chatId, NOT: { status: "FINISHED" } },
            orderBy: { id: "desc" },
        });

        if (existing) {
            if (existing.status === "LOBBY") {
                const eLang = existing.lang ?? lang;
                return ctx.replyWithMarkdown(
                    await buildLobbyText(existing, eLang),
                    Markup.inlineKeyboard([
                        [Markup.button.callback(t(eLang, "join"), `join_${existing.id}`)],
                        [Markup.button.callback(t(eLang, "leave"), `leave_${existing.id}`)],
                    ])
                );
            }
            return ctx.reply(t(lang, "already_started"));
        }

        // New game — inherit group default lang
        const defaultLang = await getGroupDefaultLang(chatId);
        let game;

        try {
            game = await prisma.game.create({
                data: {
                    chatId,
                    status: "LOBBY",
                    phase: "DAY",
                    lang: defaultLang,
                },
            });
        } catch (err) {
            if (err.code === "P2002") {
                game = await prisma.game.findFirst({
                    where: {
                        chatId,
                        NOT: { status: "FINISHED" },
                    },
                    orderBy: { createdAt: "desc" },
                });
            } else {
                throw err;
            }
        }
        const text = await buildLobbyText(game, defaultLang);
        const msg = await ctx.replyWithMarkdown(
            text,
            Markup.inlineKeyboard([
                [Markup.button.callback(t(defaultLang, "join"), `join_${game.id}`)],
                [Markup.button.callback(t(defaultLang, "leave"), `leave_${game.id}`)],
            ])
        );

        lobbyMessages.set(chatId, { messageId: msg.message_id, gameId: game.id });

        await gameQueue.add("closeLobby", { gameId: game.id, chatId }, { delay: LOBBY_TIMEOUT_MS });
    });

    // ── join_ callback ────────────────────────────────────────────────────────
    bot.action(/^join_(.+)$/, async (ctx) => {
        const gameId = ctx.match[1];
        const userTgId = String(ctx.from.id);
        const chatId = String(ctx.callbackQuery.message.chat.id);
        const userLang = await getLang(ctx); // player's personal lang for private feedback

        if (!(await isExist(ctx)))
            return ctx.answerCbQuery(t(userLang, "error_register"), { show_alert: true });

        const game = await prisma.game.findUnique({
            where: { id: gameId },
            include: { _count: { select: { players: true } } },
        });

        if (!game)
            return ctx.answerCbQuery(t(userLang, "game_not_found"), { show_alert: true });
        if (game.status !== "LOBBY")
            return ctx.answerCbQuery(t(userLang, "already_started"), { show_alert: true });
        if (game._count.players >= MAX_PLAYERS)
            return ctx.answerCbQuery(
                t(userLang, "not_enough_players", { min: MAX_PLAYERS, count: game._count.players }),
                { show_alert: true }
            );

        const name = [ctx.from.first_name, ctx.from.last_name]
            .filter(Boolean).join(" ").slice(0, 64);

        try {
            await prisma.player.create({ data: { userTgId, gameId, name } });
            await ctx.answerCbQuery(
                t(userLang, "player_joined", { name, count: game._count.players + 1 })
            );
        } catch {
            return ctx.answerCbQuery(t(userLang, "already_in_game"), { show_alert: true });
        }

        await refreshLobby(bot, chatId, game);
    });

    // ── leave_ callback ───────────────────────────────────────────────────────
    bot.action(/^leave_(.+)$/, async (ctx) => {
        const gameId = ctx.match[1];
        const userTgId = String(ctx.from.id);
        const chatId = String(ctx.callbackQuery.message.chat.id);
        const userLang = await getLang(ctx);

        const game = await prisma.game.findUnique({ where: { id: gameId } });
        if (!game || game.status !== "LOBBY")
            return ctx.answerCbQuery(t(userLang, "cannot_leave_running"), { show_alert: true });

        const del = await prisma.player.deleteMany({ where: { gameId, userTgId } });
        if (del.count === 0)
            return ctx.answerCbQuery(t(userLang, "already_in_game"), { show_alert: true });

        await ctx.answerCbQuery(t(userLang, "player_left", { name: ctx.from.first_name }));
        await refreshLobby(bot, chatId, game);
    });
}

module.exports = create;
module.exports.refreshLobby = refreshLobby;
module.exports.lobbyMessages = lobbyMessages;
module.exports.buildLobbyText = buildLobbyText;
module.exports.MIN_PLAYERS = MIN_PLAYERS;
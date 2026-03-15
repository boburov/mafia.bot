/**
 * handlers/callbacks.js
 *
 * All bot.action() inline keyboard callbacks — registered ONCE in main process.
 * night_ , vote_ , sudya_cancel_ , mafia message relay
 */

const { prisma }  = require("../config/db");
const { registerAction, allActionsIn, resolveNight } = require("./night.actions");
const { registerVote } = require("./voting");
const { transitionToDay, checkWinCondition, endGame } = require("../core/game/engine");
const { relayMafiaMessage, isMafiaRelayActive } = require("./mafia.chat");
const { stopMafiaRelay } = require("./mafia.chat");
const ROLES = require("../core/game/roles/roles");
const { t, getLangByUserId, getLangByGameId } = require("../core/i18n");

function registerCallbacks(bot) {

    // ── Night action: night_{gameId}_{round}_{actorId}_{targetId}_{actionType}
    bot.action(/^night_([^_]+)_(\d+)_([^_]+)_([^_]+)_([^_]+)$/, async (ctx) => {
        const [, gameId, roundStr, actorId, targetId, actionType] = ctx.match;
        const round    = parseInt(roundStr);
        const userLang = await getLangByUserId(String(ctx.from.id));

        const { ok, reason } = await registerAction(gameId, round, actorId, targetId, actionType);
        if (!ok) return ctx.answerCbQuery(`⚠️ ${reason}`, { show_alert: true });

        await ctx.answerCbQuery(t(userLang, "action_recorded"));
        await ctx.editMessageText(`✅ ${t(userLang, "action_recorded")}`).catch(() => {});

        // Early resolution if all night actors submitted
        const game = await prisma.game.findUnique({
            where:  { id: gameId },
            select: { chatId: true },
        });

        if (game && await allActionsIn(gameId, round)) {
            stopMafiaRelay(gameId);
            await resolveNight(gameId, round, bot.telegram, game.chatId);

            const winner = await checkWinCondition(gameId);
            if (winner) {
                const { players } = await endGame(gameId, winner);
                const lang = await getLangByGameId(gameId);
                const winMsg = { MAFIA: t(lang, "mafia_wins"), CIVIL: t(lang, "town_wins") }[winner] ?? "🏁";
                await bot.telegram.sendMessage(game.chatId, winMsg);
                const rows = players.map(p =>
                    `${p.isAlive ? "✅" : "💀"} *${p.name || p.userTgId}* — ${ROLES[p.role]?.name ?? p.role}`
                ).join("\n");
                await bot.telegram.sendMessage(game.chatId, `📊\n\n${rows}`, { parse_mode: "Markdown" });
            } else {
                await transitionToDay(gameId, game.chatId, round);
            }
        }
    });

    // ── Vote: vote_{gameId}_{round}_{targetPlayerId}
    bot.action(/^vote_([^_]+)_(\d+)_([^_]+)$/, async (ctx) => {
        const [, gameId, roundStr, targetId] = ctx.match;
        const round     = parseInt(roundStr);
        const voterTgId = String(ctx.from.id);
        const userLang  = await getLangByUserId(voterTgId);

        const { ok, reason } = await registerVote(gameId, round, voterTgId, targetId);
        if (!ok) return ctx.answerCbQuery(`⚠️ ${reason}`, { show_alert: true });

        await ctx.answerCbQuery(t(userLang, "action_recorded"));
    });

    // ── SUDYA cancel lynch: sudya_cancel_{gameId}_{round}
    bot.action(/^sudya_cancel_([^_]+)_(\d+)$/, async (ctx) => {
        const [, gameId, roundStr] = ctx.match;
        const round    = parseInt(roundStr);
        const userTgId = String(ctx.from.id);
        const userLang = await getLangByUserId(userTgId);

        // Verify this is the SUDYA player
        const sudya = await prisma.player.findFirst({
            where: { gameId, userTgId, role: "SUDYA", isAlive: true },
        });
        if (!sudya) return ctx.answerCbQuery("❌ Siz Sudya emassiz.", { show_alert: true });

        // Check already used
        const used = await prisma.nightAction.count({
            where: { gameId, actorId: sudya.id, action: "CANCEL_LYNCH" },
        });
        if (used > 0) {
            return ctx.answerCbQuery(t(userLang, "action_already_done"), { show_alert: true });
        }

        // Record usage
        const crypto = require("crypto");
        await prisma.nightAction.create({
            data: {
                id:       crypto.randomUUID(),
                gameId,
                round,
                actorId:  sudya.id,
                targetId: sudya.id,
                action:   "CANCEL_LYNCH",
                resolved: true,
            },
        }).catch(() => {});

        await ctx.answerCbQuery("⚖️ Lynch bekor qilindi!", { show_alert: true });
        await ctx.editMessageText("⚖️ *Sudya lynchni bekor qildi!*", { parse_mode: "Markdown" }).catch(() => {});

        // Announce in group
        const game = await prisma.game.findUnique({
            where:  { id: gameId },
            select: { chatId: true },
        });
        if (game) {
            const lang = await getLangByGameId(gameId);
            await bot.telegram.sendMessage(
                game.chatId,
                `⚖️ *Sudya* — ${t(lang, "no_lynch")}`,
                { parse_mode: "Markdown" }
            );
        }
    });

    // ── Mafia relay: forward DM messages from mafia members to teammates
    bot.on("message", async (ctx) => {
        // Only handle private messages
        if (ctx.chat.type !== "private") return;

        const userTgId = String(ctx.from.id);
        const text     = ctx.message?.text;
        if (!text || text.startsWith("/")) return;

        const { active } = isMafiaRelayActive(userTgId);
        if (!active) return;

        const relayed = await relayMafiaMessage(userTgId, text, bot.telegram);
        if (relayed) {
            const lang = await getLangByUserId(userTgId);
            const ack  = { uz: "📨 Xabar jamoangizga yuborildi.", ru: "📨 Сообщение передано команде.", eng: "📨 Message relayed to your team." }[lang];
            await ctx.reply(ack);
        }
    });
}

module.exports = registerCallbacks;
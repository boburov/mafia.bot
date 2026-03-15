/**
 * handlers/callbacks.js
 *
 * All bot.action() inline keyboard callbacks.
 * Registered ONCE in the main process (bot.js) — never in workers.
 *
 * Covers:
 *  - night_  : night action target selection
 *  - vote_   : voting during day phase
 */

const { prisma } = require("../config/db");
const {
    registerAction,
    allActionsIn,
    resolveNight,
} = require("./night.actions");

const {
    registerVote,
} = require("./voting");

const {
    transitionToDay,
    transitionToNight,
    checkWinCondition,
    endGame,
} = require("../core/game/engine");

const ROLES = require("../core/game/roles/roles");

// ─── Register all callbacks ───────────────────────────────────────────────────

function registerCallbacks(bot) {

    // ── Night action: night_{gameId}_{round}_{actorId}_{targetId}_{actionType}
    bot.action(/^night_([^_]+)_(\d+)_([^_]+)_([^_]+)_([^_]+)$/, async (ctx) => {
        const [, gameId, roundStr, actorId, targetId, actionType] = ctx.match;
        const round = parseInt(roundStr);

        const { ok, reason } = await registerAction(gameId, round, actorId, targetId, actionType);

        if (!ok) return ctx.answerCbQuery(`⚠️ ${reason}`, { show_alert: true });

        await ctx.answerCbQuery("✅ Harakat qabul qilindi!");
        await ctx.editMessageText("🌙 Tanlovingiz qabul qilindi. Natijani ertalab bilib olasiz...")
            .catch(() => {});

        // Early resolution if all night actors submitted
        const game = await prisma.game.findUnique({
            where:  { id: gameId },
            select: { chatId: true },
        });

        if (game && await allActionsIn(gameId, round)) {
            await resolveNight(gameId, round, bot, game.chatId);

            // Check win before going to day
            const winner = await checkWinCondition(gameId);
            if (winner) {
                const { players } = await endGame(gameId, winner);
                const label = { MAFIA: "🔴 MAFIA G'ALABA QILDI!", CIVIL: "🟢 SHAHAR G'ALABA QILDI!", KILLER: "🔪 QOTIL G'ALABA QILDI!" };
                await bot.telegram.sendMessage(game.chatId, label[winner] ?? "🏁 O'YIN TUGADI!");
                const summary = players.map(p =>
                    `${p.isAlive ? "✅" : "💀"} ${p.name || p.userTgId} — ${ROLES[p.role]?.name ?? p.role}`
                ).join("\n");
                await bot.telegram.sendMessage(game.chatId, `📊 Yakuniy natija:\n\n${summary}`);
            } else {
                await transitionToDay(gameId, game.chatId, round);
            }
        }
    });

    // ── Vote: vote_{gameId}_{round}_{targetPlayerId}
    bot.action(/^vote_([^_]+)_(\d+)_([^_]+)$/, async (ctx) => {
        const [, gameId, roundStr, targetId] = ctx.match;
        const round    = parseInt(roundStr);
        const voterTgId = String(ctx.from.id);

        const { ok, reason } = await registerVote(gameId, round, voterTgId, targetId);

        if (!ok) return ctx.answerCbQuery(`⚠️ ${reason}`, { show_alert: true });

        await ctx.answerCbQuery("✅ Ovozingiz qabul qilindi!");
    });
}

module.exports = registerCallbacks;
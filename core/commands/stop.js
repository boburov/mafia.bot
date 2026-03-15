/**
 * core/commands/stop.js
 *
 * Admin-only: force-end a running or lobby game.
 * Reveals all roles and cleans up BullMQ jobs.
 */

const { Markup } = require("telegraf");
const isAdmin = require("../../lib/admin.verifcation");
const { prisma } = require("../../config/db");
const { cancelGameJobs } = require("../../handlers/queue");
const ROLES = require("../game/roles/roles");
const { t, getLang } = require("../i18n");

module.exports = function stop(bot) {
    bot.command("stop", async (ctx) => {
        const chatId = String(ctx.chat.id);

        const lang = await getLang(ctx);
        if (!chatId.startsWith("-100"))
            return ctx.reply(t(lang, "error"));

        if (!(await isAdmin(ctx)))
            return ctx.reply(t(lang, "creator_only"));

        const game = await prisma.game.findFirst({
            where:   { chatId, NOT: { status: "FINISHED" } },
            orderBy: { id: "desc" },
            include: { players: true },
        });

        if (!game)
            return ctx.reply(t(lang, "game_not_found"));

        // Cancel all pending BullMQ jobs for this game
        await cancelGameJobs(game.id);

        // Mark finished
        await prisma.game.update({
            where: { id: game.id },
            data:  { status: "FINISHED", finishedAt: new Date(), winner: "CANCELLED" },
        });

        // Update user stats — deaths for alive players (game cancelled, no wins)
        const aliveTgIds = game.players
            .filter(p => p.isAlive && p.userTgId)
            .map(p => p.userTgId);

        if (aliveTgIds.length > 0) {
            await prisma.user.updateMany({
                where: { user_id: { in: aliveTgIds } },
                data:  { gamesPlayed: { increment: 1 } },
            });
        }

        // Build role reveal
        const alive = game.players.filter(p => p.isAlive);
        const dead  = game.players.filter(p => !p.isAlive);

        const formatPlayer = (p) => {
            const roleDef = ROLES[p.role];
            const display = p.skinName || roleDef?.name || p.role || "❓";
            return `• ${p.name || p.userTgId} — ${display}`;
        };

        let reveal = `🛑 *${t(lang, "game_cancelled")}*\n\n`;

        if (alive.length > 0) {
            reveal += `${t(lang, "alive_icon")} *${t(lang, "town_team_label")}:*\n${alive.map(formatPlayer).join("\n")}\n\n`;
        }
        if (dead.length > 0) {
            reveal += `${t(lang, "dead_icon")} *${t(lang, "dead_icon")}:*\n${dead.map(formatPlayer).join("\n")}`;
        }

        await ctx.replyWithMarkdown(reveal);
    });
};
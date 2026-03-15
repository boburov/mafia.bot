/**
 * handlers/spectator.js
 *
 * Spectator mode for dead players.
 *
 * When a player dies:
 *  - They get a DM: "You are now a spectator 👻"
 *  - They are added to spectators set for this game
 *  - Each phase change (night/day/vote results) is forwarded to all spectators
 *  - Spectators can NOT interact with any action buttons
 *  - At game end, spectators get the full role reveal
 */

const { prisma } = require("../config/db");
const { getLangByUserId } = require("../core/i18n");

// gameId → Set of userTgIds (dead spectators)
const spectators = new Map();

// ─── Add spectator ────────────────────────────────────────────────────────────

/**
 * addSpectator(gameId, player, telegram)
 * Called when a player dies. DMs them spectator notice.
 */
async function addSpectator(gameId, player, telegram) {
    if (!spectators.has(gameId)) spectators.set(gameId, new Set());
    spectators.get(gameId).add(player.userTgId);

    const lang = await getLangByUserId(player.userTgId);

    const msg = {
        uz:  `👻 *Siz o'ldirildingiz.*\n\nEndi tomoshabin sifatida o'yinni kuzatasiz.\nNatijalar sizga yuboriladi.`,
        ru:  `👻 *Вы погибли.*\n\nТеперь вы наблюдатель.\nРезультаты будут приходить вам.`,
        eng: `👻 *You have been eliminated.*\n\nYou are now a spectator.\nGame updates will be sent to you.`,
    }[lang] ?? `👻 You are now a spectator.`;

    try {
        await telegram.sendMessage(player.userTgId, msg, { parse_mode: "Markdown" });
    } catch {}
}

/**
 * broadcastToSpectators(gameId, text, telegram, extra?)
 * Sends a message to all spectators of a game.
 */
async function broadcastToSpectators(gameId, text, telegram, extra = {}) {
    const gameSpectators = spectators.get(gameId);
    if (!gameSpectators || gameSpectators.size === 0) return;

    for (const userTgId of gameSpectators) {
        try {
            await telegram.sendMessage(userTgId, `👻 ${text}`, {
                parse_mode: "Markdown",
                ...extra,
            });
        } catch {}
    }
}

/**
 * revealToSpectators(gameId, players, telegram)
 * At game end — sends full role list to all spectators.
 */
async function revealToSpectators(gameId, players, winner, telegram) {
    const gameSpectators = spectators.get(gameId);
    if (!gameSpectators || gameSpectators.size === 0) return;

    const ROLES = require("../core/game/roles/roles");
    const rows  = players.map(p =>
        `${p.isAlive ? "✅" : "💀"} ${p.name || p.userTgId} — ${ROLES[p.role]?.name ?? p.role}`
    ).join("\n");

    const text = `🏁 *O'yin tugadi — ${winner}*\n\n${rows}`;

    for (const userTgId of gameSpectators) {
        try {
            await telegram.sendMessage(userTgId, text, { parse_mode: "Markdown" });
        } catch {}
    }

    spectators.delete(gameId);
}

/**
 * cleanupSpectators(gameId)
 */
function cleanupSpectators(gameId) {
    spectators.delete(gameId);
}

module.exports = {
    addSpectator,
    broadcastToSpectators,
    revealToSpectators,
    cleanupSpectators,
    spectators,
};
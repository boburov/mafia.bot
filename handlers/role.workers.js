/**
 * handlers/role.workers.js
 *
 * Handles passive role triggers that fire OUTSIDE of normal night resolution:
 *  - KAMIKAZE  : kills attacker when killed (already partially in night.actions, extended here)
 *  - PARAZIT   : transforms into killer's role on death
 *  - KOZGU     : reflects kill back to attacker
 *  - QONLI_VASIYAT : on death, player chooses one person to die with them
 *  - SERJANT   : inherits KOMISSAR check if KOMISSAR is dead
 *  - KLON/NUSXACHI : copy another player's role
 *  - QONXOR    : kill with cooldown — enforced here
 *
 * These are called from resolveNight() and resolveVoting() as needed.
 */

const { prisma } = require("../config/db");
const ROLES = require("../core/game/roles/roles");
const ACTIONS = require("../core/game/roles/actions");
const { Markup } = require("telegraf");

// ─── KOZGU (Mirror) ───────────────────────────────────────────────────────────

/**
 * applyKozgu(actions, killed, saved)
 * If KOZGU is targeted for a kill, redirect kill to attacker.
 * Mutates killed Set.
 */
async function applyKozgu(gameId, actions, killed, saved) {
    const kozguPlayers = await prisma.player.findMany({
        where: { gameId, role: "KOZGU", isAlive: true },
    });

    for (const kozgu of kozguPlayers) {
        const incomingKill = actions.find(
            a => a.targetId === kozgu.id &&
                (a.action === ACTIONS.KILL || a.action === ACTIONS.REVENGE_KILL)
        );
        if (!incomingKill) continue;

        // Redirect: kozgu survives, attacker dies (unless saved)
        killed.delete(kozgu.id);
        if (!saved.has(incomingKill.actorId)) {
            killed.add(incomingKill.actorId);
        }
    }
}

// ─── QONLI_VASIYAT (Bloody Will) ──────────────────────────────────────────────

/**
 * triggerQonliVasiyat(gameId, deadPlayerId, bot)
 * When this player dies, prompt them via DM to choose one person to take with them.
 * Returns promise — resolved when player picks or times out (30s).
 */
async function triggerQonliVasiyat(gameId, deadPlayer, bot, chatId) {
    const alivePlayers = await prisma.player.findMany({
        where: { gameId, isAlive: true },
    });

    if (alivePlayers.length === 0) return;

    const buttons = alivePlayers.map(p =>
        Markup.button.callback(
            `💀 ${p.name || p.userTgId}`,
            `vasiyat_${gameId}_${deadPlayer.id}_${p.id}`
        )
    );

    try {
        await bot.telegram.sendMessage(
            deadPlayer.userTgId,
            `☠️ *Qonli Vasiyat*\nSiz o'ldirildingiz. Kimni o'zingiz bilan olib ketmoqchisiz?`,
            { parse_mode: "Markdown", ...Markup.inlineKeyboard(chunkArray(buttons, 2)) }
        );
    } catch { /* player hasn't DM'd bot */ }
}

/**
 * Register vasiyat callback on bot instance.
 * Call once from bot.js setup.
 */
function registerVasiyatCallback(bot) {
    bot.action(/^vasiyat_(.+)_(.+)_(.+)$/, async (ctx) => {
        const [, gameId, deadPlayerId, targetId] = ctx.match;

        const target = await prisma.player.findUnique({ where: { id: targetId } });
        if (!target || !target.isAlive) {
            return ctx.answerCbQuery("Bu o'yinchi allaqachon o'lgan.", { show_alert: true });
        }

        await prisma.player.update({
            where: { id: targetId },
            data:  { isAlive: false },
        });

        await ctx.answerCbQuery("✅ Vasiyat bajarildi.");
        await ctx.editMessageText("☠️ Vasiyatingiz bajarildi.");

        // Announce in group
        const game = await prisma.game.findUnique({ where: { id: gameId } });
        if (game) {
            await bot.telegram.sendMessage(
                game.chatId,
                `☠️ *Qonli vasiyat!* Birov o'zi bilan kimnidir olib ketdi...`,
                { parse_mode: "Markdown" }
            );
        }
    });
}

// ─── SERJANT (inherits KOMISSAR) ─────────────────────────────────────────────

/**
 * isSerjantActive(gameId)
 * Returns the SERJANT player if KOMISSAR is dead — so SERJANT can do checks.
 */
async function isSerjantActive(gameId) {
    const komissar = await prisma.player.findFirst({
        where: { gameId, role: "KOMISSAR" },
    });

    // If komissar alive, serjant is passive
    if (komissar?.isAlive) return null;

    return prisma.player.findFirst({
        where: { gameId, role: "SERJANT", isAlive: true },
    });
}

// ─── KLON / NUSXACHI (copy role) ─────────────────────────────────────────────

/**
 * applyRoleCopy(actorId, targetId)
 * Sets actor's role to match target's role.
 * Used when KLON or NUSXACHI night action resolves.
 */
async function applyRoleCopy(actorId, targetId, bot) {
    const target = await prisma.player.findUnique({ where: { id: targetId } });
    if (!target) return;

    const actor = await prisma.player.update({
        where: { id: actorId },
        data:  { role: target.role },
    });

    const newRoleDef = ROLES[target.role];

    try {
        await bot.telegram.sendMessage(
            actor.userTgId,
            `🧬 Siz *${newRoleDef?.name ?? target.role}* roliga o'tdingiz!`,
            { parse_mode: "Markdown" }
        );
    } catch {}
}

// ─── QONXOR cooldown check ────────────────────────────────────────────────────

/**
 * canQonxorKill(actorId, currentRound)
 * QONXOR has cooldown: 2 — can only kill every other round.
 */
async function canQonxorKill(actorId, currentRound) {
    if (currentRound <= 1) return true;

    const lastKill = await prisma.nightAction.findFirst({
        where:   { actorId, action: ACTIONS.KILL, resolved: true },
        orderBy: { round: "desc" },
    });

    if (!lastKill) return true;
    return (currentRound - lastKill.round) >= 2; // cooldown of 2
}

// ─── SAYOHATCHI (take role one night) ────────────────────────────────────────

/**
 * applySayohatchi(actorId, targetId, round, bot)
 * Temporarily gives actor the target's role abilities for this night only.
 * Reverts at start of next day.
 */
async function applySayohatchi(actorId, targetId, bot) {
    const [actor, target] = await Promise.all([
        prisma.player.findUnique({ where: { id: actorId } }),
        prisma.player.findUnique({ where: { id: targetId } }),
    ]);
    if (!actor || !target) return;

    const originalRole = actor.role;
    const newRoleDef   = ROLES[target.role];

    // Swap role temporarily
    await prisma.player.update({
        where: { id: actorId },
        data:  { role: target.role },
    });

    // Revert at dawn (caller must schedule revert after night resolves)
    try {
        await bot.telegram.sendMessage(
            actor.userTgId,
            `🏃 Bu tun siz *${newRoleDef?.name ?? target.role}* sifatida harakat qilasiz!`,
            { parse_mode: "Markdown" }
        );
    } catch {}

    return originalRole; // caller reverts this after night
}

// ─── TASODIFCHI (random role) ─────────────────────────────────────────────────

/**
 * applyTasodifchi(actorId, bot)
 * Assigns a random ROLES key to the target (called from night resolution).
 */
async function applyTasodifchi(targetId, bot) {
    const allRoleKeys = Object.keys(ROLES);
    const randomRole  = allRoleKeys[Math.floor(Math.random() * allRoleKeys.length)];

    const target = await prisma.player.update({
        where: { id: targetId },
        data:  { role: randomRole },
    });

    const newRoleDef = ROLES[randomRole];

    try {
        await bot.telegram.sendMessage(
            target.userTgId,
            `🎲 Sizning rolingiz o'zgardi! Yangi rol: *${newRoleDef?.name ?? randomRole}*`,
            { parse_mode: "Markdown" }
        );
    } catch {}
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function chunkArray(arr, size) {
    const out = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
    applyKozgu,
    triggerQonliVasiyat,
    registerVasiyatCallback,
    isSerjantActive,
    applyRoleCopy,
    canQonxorKill,
    applySayohatchi,
    applyTasodifchi,
};
/**
 * handlers/mafia.chat.js
 *
 * Mafia team night coordination.
 *
 * How it works:
 *  - When night starts, all alive MAFIA team players get a DM
 *  - Each mafia member can send a message that gets forwarded to all other mafia members
 *  - DON sees who other mafia members are
 *  - Messages are relayed anonymously as "🤵 Mafia:" or with role name
 *  - At dawn (day starts), relay is disabled
 *
 * Implementation:
 *  - We store active mafia relays in memory: gameId → Set of userTgIds
 *  - When any mafia member DMs the bot during night, we relay to others
 *  - Uses a bot.on("message") handler registered in callbacks.js
 */

const { prisma } = require("../config/db");
const ROLES      = require("../core/game/roles/roles");
const { TEAMS }  = require("../core/game/roles/teams");
const { t, getLangByUserId } = require("../core/i18n");

// Active mafia relays: gameId → { members: [{userTgId, playerId, role}], active: bool }
const mafiaRelays = new Map();

// ─── Start mafia relay for a game ─────────────────────────────────────────────

/**
 * startMafiaRelay(gameId, telegram)
 * Called at start of each night.
 * DMs all alive mafia members a "night briefing" + who their teammates are.
 */
async function startMafiaRelay(gameId, telegram) {
    const mafiaPlayers = await prisma.player.findMany({
        where: {
            gameId,
            isAlive: true,
            role:    { in: ["DON", "MAFIA", "AYGOQCHI", "ADVOKAT", "BOGLOVCHI"] },
        },
    });

    if (mafiaPlayers.length === 0) return;

    // Store relay
    mafiaRelays.set(gameId, {
        members: mafiaPlayers.map(p => ({
            userTgId: p.userTgId,
            playerId: p.id,
            role:     p.role,
            name:     p.name || p.userTgId,
        })),
        active: true,
    });

    // DM each mafia member: who their team is
    for (const member of mafiaPlayers) {
        const lang = await getLangByUserId(member.userTgId);

        const teammates = mafiaPlayers
            .filter(p => p.userTgId !== member.userTgId)
            .map(p => {
                const roleDef = ROLES[p.role];
                return `  • ${p.name || p.userTgId} — ${roleDef?.name ?? p.role}`;
            })
            .join("\n") || "  —";

        const header = {
            uz:  "🔴 *Mafia kengashi*",
            ru:  "🔴 *Совет мафии*",
            eng: "🔴 *Mafia Council*",
        }[lang];

        const teamLabel = {
            uz:  "👥 *Jamoadoshlar:*",
            ru:  "👥 *Сообщники:*",
            eng: "👥 *Teammates:*",
        }[lang];

        const hint = {
            uz:  "💬 _Botga yuboring xabarlaringiz jamoangizga uzatiladi._",
            ru:  "💬 _Пишите боту — сообщения передаются команде._",
            eng: "💬 _Message the bot — it relays to your team._",
        }[lang];

        try {
            await telegram.sendMessage(
                member.userTgId,
                `${header}\n\n${teamLabel}\n${teammates}\n\n${hint}`,
                { parse_mode: "Markdown" }
            );
        } catch {
            console.warn(`⚠️ Could not DM mafia member ${member.userTgId}`);
        }
    }
}

/**
 * stopMafiaRelay(gameId)
 * Called at dawn — disables relay so day messages aren't forwarded.
 */
function stopMafiaRelay(gameId) {
    const relay = mafiaRelays.get(gameId);
    if (relay) relay.active = false;
}

/**
 * cleanupMafiaRelay(gameId)
 * Called when game ends.
 */
function cleanupMafiaRelay(gameId) {
    mafiaRelays.delete(gameId);
}

/**
 * isMafiaRelayActive(userTgId)
 * Returns { active, gameId, relay } if this user is in an active mafia relay.
 */
function isMafiaRelayActive(userTgId) {
    for (const [gameId, relay] of mafiaRelays.entries()) {
        if (!relay.active) continue;
        const member = relay.members.find(m => m.userTgId === userTgId);
        if (member) return { active: true, gameId, relay, member };
    }
    return { active: false };
}

/**
 * relayMafiaMessage(userTgId, text, telegram)
 * Forwards a mafia member's message to all other active mafia members.
 * Returns true if relayed, false if not in active relay.
 */
async function relayMafiaMessage(userTgId, text, telegram) {
    const { active, relay, member } = isMafiaRelayActive(userTgId);
    if (!active) return false;

    const roleDef  = ROLES[member.role];
    const roleName = roleDef?.name ?? member.role;
    const prefix   = `${roleName} (${member.name}):\n`;

    for (const teammate of relay.members) {
        if (teammate.userTgId === userTgId) continue; // don't echo back
        try {
            await telegram.sendMessage(
                teammate.userTgId,
                `🔴 ${prefix}${text}`,
                { parse_mode: "Markdown" }
            );
        } catch {}
    }

    return true;
}

module.exports = {
    startMafiaRelay,
    stopMafiaRelay,
    cleanupMafiaRelay,
    isMafiaRelayActive,
    relayMafiaMessage,
    mafiaRelays,
};
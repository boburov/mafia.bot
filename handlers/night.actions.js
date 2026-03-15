/**
 * handlers/night.actions.js  — FULLY WIRED
 *
 * Every special role ability is now triggered during resolution:
 *  BLOCK, SAVE, KILL, REVENGE_KILL, CHECK_ROLE, REFLECT,
 *  PROTECT_FROM_CHECK, CHECK_KILLER, COPY_ROLE, TAKE_ROLE_ONE_NIGHT,
 *  LINK_PLAYERS, RANDOM_ROLE, TRANSFORM_ON_DEATH (PARAZIT),
 *  REVENGE_KILL passive (KAMIKAZE, QONLI_VASIYAT),
 *  KOZGU reflect, QONXOR cooldown, SERJANT inheritance
 */

const { Markup } = require("telegraf");
const { prisma }  = require("../config/db");
const ROLES       = require("../core/game/roles/roles");
const ACTIONS     = require("../core/game/roles/actions");
const { PHASES, TEAMS }  = require("../core/game/roles/teams");
const crypto      = require("crypto");
const { t, getLangByGameId, getLangByUserId } = require("../core/i18n");

// Accept both sender.js { sendMessage } and Telegraf bot { telegram.sendMessage }
function getSend(telegramOrBot) {
    if (typeof telegramOrBot?.sendMessage === "function") return telegramOrBot;
    if (typeof telegramOrBot?.telegram?.sendMessage === "function") return telegramOrBot.telegram;
    throw new Error("Invalid telegram/bot object passed");
}

// ─── Resolution priority ──────────────────────────────────────────────────────

const ACTION_PRIORITY = {
    [ACTIONS.BLOCK]:              1,
    [ACTIONS.SAVE]:               2,
    [ACTIONS.REFLECT]:            2, // KOZGU passive — must know before kills land
    PROTECT_FROM_CHECK:           2,
    [ACTIONS.KILL]:               3,
    [ACTIONS.REVENGE_KILL]:       3,
    [ACTIONS.LINK_PLAYERS]:       3,
    [ACTIONS.RANDOM_ROLE]:        3,
    [ACTIONS.CHECK_ROLE]:         4,
    CHECK_KILLER:                 4,
    [ACTIONS.COPY_ROLE]:          4,
    [ACTIONS.TAKE_ROLE_ONE_NIGHT]:4,
};

// ─── 1. Send Night DMs ────────────────────────────────────────────────────────

async function sendNightDMs(gameId, round, telegramOrBot) {
    const tg = getSend(telegramOrBot);
    const alivePlayers = await prisma.player.findMany({
        where: { gameId, isAlive: true },
    });

    // Check if SERJANT should inherit KOMISSAR abilities
    const komissar = alivePlayers.find(p => p.role === "KOMISSAR");
    const serjant  = alivePlayers.find(p => p.role === "SERJANT");

    for (const actor of alivePlayers) {
        let roleDef  = ROLES[actor.role];
        if (!roleDef) continue;

        // SERJANT activates only when KOMISSAR is dead
        if (actor.role === "SERJANT") {
            if (komissar) continue; // komissar alive → serjant stays passive
            // Inherit komissar abilities
            roleDef = { ...ROLES["KOMISSAR"], name: ROLES["SERJANT"].name };
        }

        if (roleDef.phase !== PHASES.NIGHT) continue;

        const abilities = roleDef.abilities ?? [];
        if (abilities.length === 0) continue;

        // QONXOR: check cooldown
        if (actor.role === "QONXOR") {
            const canKill = await checkQonxorCooldown(actor.id, round);
            if (!canKill) {
                try {
                    const actorLang = await getLangByUserId(actor.userTgId);
                    await tg.sendMessage(
                        actor.userTgId,
                        `🧛 *${roleDef.name}*\n\n⏳ ${t(actorLang, "action_already_done")}`,
                        { parse_mode: "Markdown" }
                    );
                } catch {}
                continue;
            }
        }

        // KOZGU & passive-only roles — no target needed, just inform
        if (actor.role === "KOZGU") {
            try {
                const kozguLang = await getLangByUserId(actor.userTgId);
                await tg.sendMessage(
                    actor.userTgId,
                    `🪞 *${roleDef.name}*\n\n${t(kozguLang, "your_role", { emoji: "🪞", name: roleDef.name, description: "Passiv himoya — hujum qaytariladi." })}`,
                    { parse_mode: "Markdown" }
                );
            } catch {}
            continue;
        }

        for (const ability of abilities) {
            // Build target list
            let targets = alivePlayers.filter(p => {
                if (ability.type === ACTIONS.SAVE)            return true;  // can save self too
                if (ability.type === ACTIONS.COPY_ROLE)       return p.id !== actor.id;
                if (ability.type === ACTIONS.TAKE_ROLE_ONE_NIGHT) return p.id !== actor.id;
                if (ability.onlyAgainst) {
                    const tRole = ROLES[p.role];
                    return ability.onlyAgainst.includes(tRole?.team) && p.id !== actor.id;
                }
                return p.id !== actor.id;
            });

            if (targets.length === 0) continue;

            const label   = getActionLabel(ability.type); // overridden per-actor below
            const buttons = targets.map(t =>
                Markup.button.callback(
                    `👤 ${t.name || t.userTgId}`,
                    `night_${gameId}_${round}_${actor.id}_${t.id}_${ability.type}`
                )
            );

            try {
                const actorUiLang = await getLangByUserId(actor.userTgId);
                const localLabel  = getActionLabel(ability.type, actorUiLang);
                await tg.sendMessage(
                    actor.userTgId,
                    `🌙 *${t(actorUiLang, "night_started", { number: round })}*\n${roleDef.name}\n\n${localLabel}`,
                    { parse_mode: "Markdown", ...Markup.inlineKeyboard(chunkArray(buttons, 2)) }
                );
            } catch {
                console.warn(`⚠️ Could not DM ${actor.userTgId}`);
            }
        }
    }
}

// ─── 2. Register Action ───────────────────────────────────────────────────────

async function registerAction(gameId, round, actorId, targetId, actionType) {
    const game = await prisma.game.findUnique({ where: { id: gameId } });
    if (!game || game.status !== "RUNNING" || game.phase !== "NIGHT")
        return { ok: false, reason: "Tun bosqichida emassiz." };

    // QONXOR double-check cooldown at registration time
    if (actionType === ACTIONS.KILL) {
        const actor = await prisma.player.findUnique({ where: { id: actorId } });
        if (actor?.role === "QONXOR") {
            const canKill = await checkQonxorCooldown(actorId, round);
            if (!canKill) return { ok: false, reason: "Qonxo'r kuchi hali qaytmadi ⏳" };
        }
    }

    await prisma.nightAction.upsert({
        where:  { actorId_round: { actorId, round } },
        update: { targetId, action: actionType },
        create: { id: crypto.randomUUID(), gameId, round, actorId, targetId, action: actionType },
    });

    return { ok: true };
}

// ─── 3. All actions in? ───────────────────────────────────────────────────────

async function allActionsIn(gameId, round) {
    const alivePlayers = await prisma.player.findMany({
        where: { gameId, isAlive: true },
    });

    const komissar = alivePlayers.find(p => p.role === "KOMISSAR");

    const nightActors = alivePlayers.filter(p => {
        if (p.role === "KOZGU")    return false; // passive — no action needed
        if (p.role === "QONXOR")   return false; // cooldown handled separately
        if (p.role === "SERJANT")  return !komissar; // only active if komissar dead
        const roleDef = ROLES[p.role];
        return roleDef?.phase === PHASES.NIGHT && (roleDef?.abilities?.length ?? 0) > 0;
    });

    const submitted = await prisma.nightAction.count({
        where: { gameId, round, resolved: false },
    });

    return submitted >= nightActors.length;
}

// ─── 4. Resolve Night — FULLY WIRED ──────────────────────────────────────────

async function resolveNight(gameId, round, telegramOrBot, chatId) {
    const tg = getSend(telegramOrBot);
    const actions = await prisma.nightAction.findMany({
        where:   { gameId, round, resolved: false },
        include: { actor: true, target: true },
    });

    actions.sort((a, b) =>
        (ACTION_PRIORITY[a.action] ?? 99) - (ACTION_PRIORITY[b.action] ?? 99)
    );

    const blocked  = new Set();  // actorIds who are blocked this night
    const saved    = new Set();  // playerIds who are saved
    const killed   = new Set();  // playerIds who will die
    const results  = [];         // group chat messages
    const dmQueue  = [];         // { userTgId, text } — DMs to send after resolution

    // ── Linked players map (BOGLOVCHI) ────────────────────────────────────────
    // If a linked player dies, so does the other
    const links = new Map(); // playerId → linkedPlayerId

    // ── Pass 1: BLOCK, SAVE, REFLECT, PROTECT ─────────────────────────────────
    for (const act of actions) {
        if (blocked.has(act.actorId)) continue;

        switch (act.action) {
            case ACTIONS.BLOCK:
                blocked.add(act.targetId);
                break;

            case ACTIONS.SAVE:
                saved.add(act.targetId);
                break;

            case ACTIONS.REFLECT:
            case "REFLECT": {
                // KOZGU: passive — mark actor as mirror, handled during kill pass
                // (no explicit action submitted, handled inline below)
                break;
            }

            case "PROTECT_FROM_CHECK":
                // Stored — checked during CHECK_ROLE pass
                break;

            case ACTIONS.LINK_PLAYERS: {
                // BOGLOVCHI: link actor's target to another player
                // For simplicity: linked player is the target — if target dies, actor also dies
                links.set(act.targetId, act.actorId);
                links.set(act.actorId,  act.targetId);
                break;
            }
        }
    }

    // ── Apply KOZGU reflect passively ─────────────────────────────────────────
    const kozguPlayers = await prisma.player.findMany({
        where: { gameId, role: "KOZGU", isAlive: true },
    });
    for (const kozgu of kozguPlayers) {
        const incomingKill = actions.find(
            a => a.targetId === kozgu.id &&
                (a.action === ACTIONS.KILL || a.action === ACTIONS.REVENGE_KILL) &&
                !blocked.has(a.actorId)
        );
        if (incomingKill) {
            // Redirect kill to attacker
            if (!saved.has(incomingKill.actorId)) {
                killed.add(incomingKill.actorId);
                results.push(`🪞 Ko'zgu hujumni qaytardi!`);
            }
            // Kozgu survives
            saved.add(kozgu.id);
        }
    }

    // ── Pass 2: KILL, RANDOM_ROLE ─────────────────────────────────────────────
    for (const act of actions) {
        if (blocked.has(act.actorId)) continue;

        switch (act.action) {

            case ACTIONS.KILL:
            case ACTIONS.REVENGE_KILL: {
                if (saved.has(act.targetId)) {
                    results.push(`🛡 Kimdir tunda qutqarildi!`);
                } else {
                    killed.add(act.targetId);
                    // Track kill for stats — update killer's kill count
                    await prisma.user.updateMany({
                        where: { user_id: act.actor.userTgId },
                        data:  { kills: { increment: 1 } },
                    }).catch(() => {});
                }
                break;
            }

            case ACTIONS.RANDOM_ROLE: {
                // TASODIFCHI: assign random role to target
                if (!saved.has(act.targetId) && !blocked.has(act.actorId)) {
                    const allKeys    = Object.keys(ROLES);
                    const randomRole = allKeys[Math.floor(Math.random() * allKeys.length)];
                    await prisma.player.update({
                        where: { id: act.targetId },
                        data:  { role: randomRole },
                    });
                    const newRoleDef = ROLES[randomRole];
                    dmQueue.push({
                        userTgId: act.target.userTgId,
                        text: `🎲 *Tasodifchi* sizning rolingizni o'zgartirdi!\nYangi rol: *${newRoleDef?.name ?? randomRole}*`,
                    });
                }
                break;
            }
        }
    }

    // ── BOGLOVCHI: propagate linked deaths ────────────────────────────────────
    for (const deadId of [...killed]) {
        const linkedId = links.get(deadId);
        if (linkedId && !saved.has(linkedId) && !killed.has(linkedId)) {
            killed.add(linkedId);
            results.push(`🧷 Bog'liq o'yinchi ham halok bo'ldi!`);
        }
    }

    // ── Pass 3: CHECK_ROLE, CHECK_KILLER, COPY_ROLE, TAKE_ROLE ───────────────
    for (const act of actions) {
        if (blocked.has(act.actorId)) continue;

        switch (act.action) {

            case ACTIONS.CHECK_ROLE: {
                const isProtected = actions.some(
                    a => a.targetId === act.targetId && a.action === "PROTECT_FROM_CHECK" && !blocked.has(a.actorId)
                );
                const targetRoleDef = ROLES[act.target.role];
                let msg;
                if (isProtected) {
                    msg = `🟡 *${act.target.name || act.target.userTgId}* — Tinch aholi (himoyalangan).`;
                } else {
                    const isMafia = targetRoleDef?.team === TEAMS.MAFIA;
                    msg = isMafia
                        ? `🔴 *${act.target.name || act.target.userTgId}* — MAFIA!`
                        : `🟢 *${act.target.name || act.target.userTgId}* — Tinch aholi.`;
                }
                dmQueue.push({ userTgId: act.actor.userTgId, text: msg, useActorLang: true });
                break;
            }

            case "CHECK_KILLER": {
                // RUHONIY: reveals if target has KILL ability
                const targetRoleDef = ROLES[act.target.role];
                const hasKill = targetRoleDef?.abilities?.some(a => a.type === ACTIONS.KILL);
                const msg = hasKill
                    ? `⚠️ *${act.target.name || act.target.userTgId}* — Qotil instinkti bor!`
                    : `✅ *${act.target.name || act.target.userTgId}* — Xavfsiz.`;
                dmQueue.push({ userTgId: act.actor.userTgId, text: msg });
                break;
            }

            case ACTIONS.COPY_ROLE: {
                // KLON / NUSXACHI: copy target's role
                const targetRole    = act.target.role;
                const newRoleDef    = ROLES[targetRole];
                await prisma.player.update({
                    where: { id: act.actorId },
                    data:  { role: targetRole },
                });
                dmQueue.push({
                    userTgId: act.actor.userTgId,
                    text: `🧬 Siz *${newRoleDef?.name ?? targetRole}* roliga o'tdingiz!`,
                });
                break;
            }

            case ACTIONS.TAKE_ROLE_ONE_NIGHT: {
                // SAYOHATCHI: borrow target's role abilities for this night only
                // Store original role in a temp map; revert at start of day
                const originalRole = act.actor.role;
                const borrowedRole = act.target.role;
                await prisma.player.update({
                    where: { id: act.actorId },
                    data:  { role: borrowedRole },
                });
                dmQueue.push({
                    userTgId: act.actor.userTgId,
                    text: `🏃 Bu tun siz *${ROLES[borrowedRole]?.name ?? borrowedRole}* sifatida harakat qildingiz!`,
                });
                // Schedule revert — store in a separate DB record or handle at dawn
                // Simple: queue a revert job 1s after night resolves
                await prisma.nightAction.create({
                    data: {
                        id:       crypto.randomUUID(),
                        gameId,
                        round,
                        actorId:  act.actorId,
                        targetId: act.actorId, // self
                        action:   `__REVERT__${originalRole}`,
                        resolved: false,
                    },
                }).catch(() => {}); // ignore unique constraint if exists
                break;
            }
        }
    }

    // ── Revert SAYOHATCHI at dawn ─────────────────────────────────────────────
    const reverts = actions.filter(a => a.action?.startsWith("__REVERT__"));
    for (const rev of reverts) {
        const originalRole = rev.action.replace("__REVERT__", "");
        await prisma.player.update({
            where: { id: rev.actorId },
            data:  { role: originalRole },
        }).catch(() => {});
    }

    // ── Apply kills + passives ────────────────────────────────────────────────
    for (const targetId of [...killed]) {
        let player = await prisma.player.findUnique({ where: { id: targetId } });
        if (!player || !player.isAlive) continue;

        // PARAZIT: transform into killer's role instead of dying
        if (player.role === "PARAZIT") {
            const killer = actions.find(
                a => a.targetId === targetId &&
                    (a.action === ACTIONS.KILL || a.action === ACTIONS.REVENGE_KILL)
            );
            if (killer) {
                const killerPlayer = await prisma.player.findUnique({ where: { id: killer.actorId } });
                if (killerPlayer) {
                    await prisma.player.update({
                        where: { id: targetId },
                        data:  { role: killerPlayer.role }, // stays alive
                    });
                    results.push(`🧥 Parazit qayta tug'ildi — yangi rol bilan!`);
                    killed.delete(targetId);
                    dmQueue.push({
                        userTgId: player.userTgId,
                        text: `🧥 Siz *${ROLES[killerPlayer.role]?.name ?? killerPlayer.role}* ga aylandingiz!`,
                    });
                    continue;
                }
            }
        }

        // Mark dead
        player = await prisma.player.update({
            where: { id: targetId },
            data:  { isAlive: false },
        });

        // Update death stat
        await prisma.user.updateMany({
            where: { user_id: player.userTgId },
            data:  { deaths: { increment: 1 } },
        }).catch(() => {});

        results.push(`💀 Tunda bir kishi hayotdan ko'z yumdi.`);

        // KAMIKAZE: kills their attacker on death
        if (player.role === "KAMIKAZE") {
            const killer = actions.find(
                a => a.targetId === targetId &&
                    (a.action === ACTIONS.KILL || a.action === ACTIONS.REVENGE_KILL)
            );
            if (killer && !killed.has(killer.actorId) && !saved.has(killer.actorId)) {
                killed.add(killer.actorId);
                results.push(`💣 Kamikaze o'lim bilan qasos oldi!`);
            }
        }

        // QONLI_VASIYAT: trigger death choice DM
        if (player.role === "QONLI_VASIYAT") {
            const { triggerQonliVasiyat } = require("./role.workers");
            await triggerQonliVasiyat(gameId, player, bot, chatId).catch(() => {});
        }
    }

    // ── Send all DMs ──────────────────────────────────────────────────────────
    for (const { userTgId, text } of dmQueue) {
        try {
            await tg.sendMessage(userTgId, text, { parse_mode: "Markdown" });
        } catch {}
    }

    // ── Mark all actions resolved ─────────────────────────────────────────────
    await prisma.nightAction.updateMany({
        where: { gameId, round },
        data:  { resolved: true },
    });

    // ── Group summary ─────────────────────────────────────────────────────────
    const summary = results.length > 0
        ? results.join("\n")
        : "😴 Tunda hech narsa sodir bo'lmadi.";

    const groupLang = await getLangByGameId(gameId);
    const nobodyDied = results.length === 0;
    const summaryText = nobodyDied ? t(groupLang, "night_result_nobody_died") : results.join("\n");
    await tg.sendMessage(chatId, `🌅 *${t(groupLang, "day_started", { number: "", seconds: "" }).split(".")[0]}*\n\n${summaryText}`, { parse_mode: "Markdown" });

    return { killed: [...killed], saved: [...saved] };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function checkQonxorCooldown(actorId, currentRound) {
    if (currentRound <= 1) return true;
    const lastKill = await prisma.nightAction.findFirst({
        where:   { actorId, action: ACTIONS.KILL, resolved: true },
        orderBy: { round: "desc" },
    });
    if (!lastKill) return true;
    return (currentRound - lastKill.round) >= 2;
}

function getActionLabel(actionType, lang = "uz") {
    const labels = {
        [ACTIONS.KILL]:                t(lang, "choose_kill_target"),
        [ACTIONS.SAVE]:                t(lang, "choose_heal_target"),
        [ACTIONS.CHECK_ROLE]:          t(lang, "choose_check_target"),
        [ACTIONS.BLOCK]:               "🚫 " + t(lang, "choose_check_target").replace("🔍", "").trim(),
        [ACTIONS.REVENGE_KILL]:        "⚔️ " + t(lang, "choose_kill_target").replace("🔫", "").trim(),
        [ACTIONS.COPY_ROLE]:           "🧬 " + t(lang, "choose_check_target").replace("🔍", "").trim(),
        [ACTIONS.TAKE_ROLE_ONE_NIGHT]: "🏃 " + t(lang, "choose_check_target").replace("🔍", "").trim(),
        [ACTIONS.LINK_PLAYERS]:        "🧷 " + t(lang, "choose_check_target").replace("🔍", "").trim(),
        [ACTIONS.RANDOM_ROLE]:         "🎲 " + t(lang, "choose_check_target").replace("🔍", "").trim(),
        "PROTECT_FROM_CHECK":          "🛡 " + t(lang, "choose_check_target").replace("🔍", "").trim(),
        "CHECK_KILLER":                "📿 " + t(lang, "choose_check_target").replace("🔍", "").trim(),
    };
    return labels[actionType] ?? "🎯 " + t(lang, "join");
}

function chunkArray(arr, size) {
    const out = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
}

module.exports = { sendNightDMs, registerAction, allActionsIn, resolveNight };
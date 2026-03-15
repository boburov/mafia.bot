/**
 * handlers/voting.js
 */

const { Markup }   = require("telegraf");
const { prisma }   = require("../config/db");
const ROLES        = require("../core/game/roles/roles");
const { TEAMS }    = require("../core/game/roles/teams");
const { t, getLangByGameId } = require("../core/i18n");
const crypto       = require("crypto");

// Accept sender.js { sendMessage } or Telegraf bot { telegram.sendMessage }
function getSend(x) {
    if (typeof x?.sendMessage === "function")          return x;
    if (typeof x?.telegram?.sendMessage === "function") return x.telegram;
    throw new Error("Invalid telegram/bot object passed to voting");
}

function chunkArray(arr, size) {
    const out = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
}

// ─── 1. Send Voting Keyboard ──────────────────────────────────────────────────

async function sendVotingKeyboard(gameId, round, telegramOrBot, chatId, candidateIds = null) {
    const tg = getSend(telegramOrBot);

    const alivePlayers = await prisma.player.findMany({
        where: { gameId, isAlive: true },
    });

    const candidates = candidateIds
        ? alivePlayers.filter(p => candidateIds.includes(p.id))
        : alivePlayers;

    if (candidates.length === 0) return null;

    const buttons  = candidates.map(p =>
        Markup.button.callback(`👤 ${p.name || p.userTgId}`, `vote_${gameId}_${round}_${p.id}`)
    );
    const keyboard = Markup.inlineKeyboard(chunkArray(buttons, 2));
    const lang     = await getLangByGameId(gameId);

    const msg = await tg.sendMessage(
        chatId,
        `*${t(lang, "vote_started")}* (${candidates.length} 👤)`,
        { parse_mode: "Markdown", ...keyboard }
    );

    return msg?.message_id;
}

// ─── 2. Register Vote ─────────────────────────────────────────────────────────

async function registerVote(gameId, round, voterTgId, targetPlayerId) {
    const game = await prisma.game.findUnique({ where: { id: gameId } });
    if (!game || game.phase !== "VOTING")
        return { ok: false, reason: "Ovoz berish vaqti emas." };

    const voter = await prisma.player.findFirst({
        where: { gameId, userTgId: voterTgId, isAlive: true },
    });
    if (!voter) return { ok: false, reason: "Siz o'yinda emassiz." };

    const target = await prisma.player.findFirst({
        where: { id: targetPlayerId, gameId, isAlive: true },
    });
    if (!target) return { ok: false, reason: "Nishon topilmadi." };

    await prisma.vote.upsert({
        where:  { voterId_round: { voterId: voter.id, round } },
        update: { targetId: targetPlayerId },
        create: {
            id:       crypto.randomUUID(),
            gameId,
            round,
            voterId:  voter.id,
            targetId: targetPlayerId,
        },
    });

    return { ok: true };
}

// ─── 3. Tally Votes ───────────────────────────────────────────────────────────

async function tallyVotes(gameId, round, telegramOrBot, chatId) {
    const tg   = getSend(telegramOrBot);
    const lang = await getLangByGameId(gameId);

    const votes = await prisma.vote.findMany({
        where:   { gameId, round },
        include: { voter: true },
    });

    if (votes.length === 0) {
        await tg.sendMessage(chatId, t(lang, "no_lynch"));
        return { result: "SKIP" };
    }

    // Count — JANOB gets weight 2
    const tally = {};
    for (const v of votes) {
        const weight = v.voter.role === "JANOB" ? 2 : 1;
        tally[v.targetId] = (tally[v.targetId] ?? 0) + weight;
    }

    const sorted   = Object.entries(tally).sort((a, b) => b[1] - a[1]);
    const topScore = sorted[0][1];
    const topGroup = sorted.filter(([, s]) => s === topScore);

    // Tie
    if (topGroup.length > 1) {
        const tiedIds = topGroup.map(([id]) => id);
        await tg.sendMessage(
            chatId,
            `*${t(lang, "vote_revote")}* (${topGroup.length} 👤)`,
            { parse_mode: "Markdown" }
        );
        return { result: "TIE", tiedIds };
    }

    const [lynchTargetId, lynchScore] = sorted[0];

    // SUDYA cancel check (stub — returns false until wired)
    const sudyaCancelled = await checkSudyaCancel(gameId, round);
    if (sudyaCancelled) {
        await tg.sendMessage(chatId, `⚖️ *Sudya* — ${t(lang, "no_lynch")}`, { parse_mode: "Markdown" });
        return { result: "SKIP" };
    }

    const lynched = await prisma.player.update({
        where: { id: lynchTargetId },
        data:  { isAlive: false },
    });

    // Update death stat
    await prisma.user.updateMany({
        where: { user_id: lynched.userTgId },
        data:  { deaths: { increment: 1 } },
    }).catch(() => {});

    const roleDef  = ROLES[lynched.role];
    const roleName = lynched.skinName || roleDef?.name || lynched.role;

    // SUID wins by being lynched
    if (lynched.role === "SUID") {
        await prisma.game.update({ where: { id: gameId }, data: { status: "FINISHED" } });
        await tg.sendMessage(
            chatId,
            `⚖️ *${lynched.name || lynched.userTgId}* — ${roleName}\n\n🤦 *SUID G'ALABA QILDI!*`,
            { parse_mode: "Markdown" }
        );
        return { result: "SUID_WIN", lynched };
    }

    await tg.sendMessage(
        chatId,
        t(lang, "lynched", { name: `*${lynched.name || lynched.userTgId}*`, role: roleName }) + ` (${lynchScore} 🗳)`,
        { parse_mode: "Markdown" }
    );

    return { result: "LYNCHED", lynched };
}

// ─── 4. Re-vote ───────────────────────────────────────────────────────────────

async function handleRevote(gameId, round, tiedIds, telegramOrBot, chatId) {
    const newRound = round + 1;
    await sendVotingKeyboard(gameId, newRound, telegramOrBot, chatId, tiedIds);
    return newRound;
}

// ─── 5. AFERIST ───────────────────────────────────────────────────────────────

async function applyAferist(gameId, round) {
    const aferists = await prisma.player.findMany({
        where: { gameId, role: "AFERIST", isAlive: true },
    });
    for (const aferist of aferists) {
        const aVote = await prisma.vote.findFirst({
            where: { gameId, round, voterId: aferist.id },
        });
        if (!aVote) continue;
        await prisma.vote.updateMany({
            where: { gameId, round, targetId: aferist.id },
            data:  { targetId: aVote.targetId },
        });
    }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function checkSudyaCancel(gameId, round) {
    return false; // stub — wire SUDYA button later
}

module.exports = {
    sendVotingKeyboard,
    registerVote,
    tallyVotes,
    handleRevote,
    applyAferist,
};
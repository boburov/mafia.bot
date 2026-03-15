/**
 * workers/game.workers.js
 *
 * BullMQ worker — processes game phase jobs.
 *
 * ✅ NO new Telegraf()
 * ✅ NO bot.launch()
 * ✅ NO polling
 *
 * Uses handlers/sender.js — raw HTTP calls to Telegram API.
 * Callbacks (night_, vote_) are handled in main process (handlers/callbacks.js).
 */

require("dotenv").config();
const { Worker }   = require("bullmq");
const { connection } = require("../handlers/redis");
const path = require("path");

// ✅ Pure HTTP sender — never causes 409
const { telegram } = require("../handlers/sender");

const {
    startGame,
    transitionToDay,
    transitionToNight,
    transitionToVoting,
    checkWinCondition,
    endGame,
} = require("../core/game/engine");

const { sendNightDMs, resolveNight } = require("../handlers/night.actions");
const { sendVotingKeyboard, tallyVotes, handleRevote, applyAferist } = require("../handlers/voting");
const { sendRoleDMs } = require("../core/commands/start");
const ROLES  = require("../core/game/roles/roles");
const { t, getLangByGameId } = require("../core/i18n");
const { prisma } = require("../config/db");

// Assets
const nightImg  = path.join(__dirname, "../assets/night.jpg");
const dayImg    = path.join(__dirname, "../assets/day.jpg");
const votingImg = path.join(__dirname, "../assets/voting.jpg");

// ─── Win check ────────────────────────────────────────────────────────────────

async function handleWinCheck(gameId, chatId) {
    const winner = await checkWinCondition(gameId);
    if (!winner) return false;

    const { players } = await endGame(gameId, winner);
    const lang = await getLangByGameId(gameId);

    const winMsg = {
        MAFIA:  t(lang, "mafia_wins"),
        CIVIL:  t(lang, "town_wins"),
        KILLER: `🔪 ${t(lang, "town_wins")}`,
        SUID:   `🤦 SUID G'ALABA QILDI!`,
    }[winner] ?? `🏁 ${t(lang, "game_cancelled")}`;

    await telegram.sendMessage(chatId, winMsg);

    const alive = t(lang, "alive_icon");
    const dead  = t(lang, "dead_icon");
    const rows  = players
        .map(p => `${p.isAlive ? alive : dead} ${p.name || p.userTgId} — ${ROLES[p.role]?.name ?? p.role}`)
        .join("\n");

    await telegram.sendMessage(
        chatId,
        `📊 *${t(lang, "game_summary").split("\n")[0]}*\n\n${rows}`,
        { parse_mode: "Markdown" }
    );

    return true;
}

// ─── Worker ───────────────────────────────────────────────────────────────────

const worker = new Worker("game", async (job) => {
    console.log("🧠 JOB:", job.name, job.data);
    const { gameId, chatId, round = 1 } = job.data;
    const lang = await getLangByGameId(gameId).catch(() => "uz");

    // ── closeLobby ────────────────────────────────────────────────────────────
    if (job.name === "closeLobby") {
        const game = await prisma.game.findUnique({
            where:   { id: gameId },
            include: { _count: { select: { players: true } } },
        });
        if (!game || game.status !== "LOBBY") return;

        if (game._count.players < 4) {
            await prisma.game.update({ where: { id: gameId }, data: { status: "FINISHED" } });
            await telegram.sendMessage(chatId, t(lang, "game_ended_early"));
        }
        return;
    }

    // ── startGame ─────────────────────────────────────────────────────────────
    if (job.name === "startGame") {
        try {
            const assignments = await startGame(gameId, chatId);

            // Group announcement
            const startedLine = {
                uz:  "Rollar shaxsiy xabarda yuborildi. Tekshiring! 📩",
                ru:  "Роли отправлены в личные сообщения. Проверьте! 📩",
                eng: "Roles sent via private message. Check your DMs! 📩",
            }[lang] ?? "Roles sent via DM 📩";

            await telegram.sendMessage(
                chatId,
                `✅ *${t(lang, "game_started")}* (${assignments.length} 👥)\n\n🎭 ${startedLine}`,
                { parse_mode: "Markdown" }
            );

            // DM each player their role card in their own language
            await sendRoleDMs(assignments, telegram);

        } catch (err) {
            await telegram.sendMessage(chatId, `❌ ${err.message}`);
        }
        return;
    }

    // ── startNight ────────────────────────────────────────────────────────────
    if (job.name === "startNight") {
        // Group photo
        await telegram.sendPhoto(
            chatId, nightImg,
            `🌙 *${t(lang, "night_started", { number: round })}*`,
            { parse_mode: "Markdown" }
        );

        // DM action keyboards to all night-role players
        await sendNightDMs(gameId, round, telegram);

        // 40s fallback timer
        const { gameQueue } = require("../handlers/queue");
        await gameQueue.add("resolveNight", { gameId, chatId, round }, { delay: 40_000 });
        return;
    }

    // ── resolveNight ──────────────────────────────────────────────────────────
    if (job.name === "resolveNight") {
        const pending = await prisma.nightAction.count({ where: { gameId, round, resolved: false } });
        const total   = await prisma.nightAction.count({ where: { gameId, round } });

        if (total > 0 && pending === 0) {
            // Already resolved by early-path in callbacks.js
            const over = await handleWinCheck(gameId, chatId);
            if (!over) await transitionToDay(gameId, chatId, round);
            return;
        }

        await resolveNight(gameId, round, telegram, chatId);
        const over = await handleWinCheck(gameId, chatId);
        if (!over) await transitionToDay(gameId, chatId, round);
        return;
    }

    // ── startDay ──────────────────────────────────────────────────────────────
    if (job.name === "startDay") {
        const over = await handleWinCheck(gameId, chatId);
        if (over) return;

        await telegram.sendPhoto(
            chatId, dayImg,
            `☀️ *${t(lang, "day_started", { number: round, seconds: 60 })}*`,
            { parse_mode: "Markdown" }
        );

        await transitionToVoting(gameId, chatId, round);
        return;
    }

    // ── startVoting ───────────────────────────────────────────────────────────
    if (job.name === "startVoting") {
        await telegram.sendPhoto(
            chatId, votingImg,
            `🗳 *${t(lang, "vote_started")}*`,
            { parse_mode: "Markdown" }
        );

        await sendVotingKeyboard(gameId, round, telegram, chatId);
        return;
    }

    // ── resolveVoting ─────────────────────────────────────────────────────────
    if (job.name === "resolveVoting") {
        await applyAferist(gameId, round);

        const { result, tiedIds } = await tallyVotes(gameId, round, telegram, chatId);

        if (result === "SUID_WIN") return;

        if (result === "TIE") {
            const newRound = await handleRevote(gameId, round, tiedIds, telegram, chatId);
            const { gameQueue } = require("../handlers/queue");
            await gameQueue.add("resolveVoting", { gameId, chatId, round: newRound }, { delay: 20_000 });
            return;
        }

        const over = await handleWinCheck(gameId, chatId);
        if (!over) await transitionToNight(gameId, chatId, round);
        return;
    }

}, { connection });

worker.on("completed", (job) => console.log("✅ done:", job.name));
worker.on("failed",    (job, err) => console.error("❌ failed:", job?.name, err.message));

console.log("🎯 Game worker running...");
// ✅ No bot.launch() — this file never touches Telegram polling
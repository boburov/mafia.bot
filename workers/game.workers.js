/**
 * workers/game.workers.js
 *
 * ✅ NO new Telegraf() — NO bot.launch() — NO polling
 * Uses handlers/sender.js for all Telegram API calls.
 */

require("dotenv").config();
const { Worker }     = require("bullmq");
const { connection } = require("../handlers/redis");
const path           = require("path");

const { telegram }   = require("../handlers/sender");

const {
    startGame, transitionToDay, transitionToNight,
    transitionToVoting, checkWinCondition, endGame,
} = require("../core/game/engine");

const { sendNightDMs, resolveNight }                          = require("../handlers/night.actions");
const { sendVotingKeyboard, tallyVotes, handleRevote,
        applyAferist }                                        = require("../handlers/voting");
const { sendRoleDMs }                                         = require("../core/commands/start");
const { startMafiaRelay, stopMafiaRelay, cleanupMafiaRelay }  = require("../handlers/mafia.chat");
const { broadcastToSpectators, revealToSpectators,
        cleanupSpectators }                                   = require("../handlers/spectator");

const ROLES  = require("../core/game/roles/roles");
const { t, getLangByGameId } = require("../core/i18n");
const { prisma } = require("../config/db");

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
        .map(p => `${p.isAlive ? alive : dead} *${p.name || p.userTgId}* — ${ROLES[p.role]?.name ?? p.role}`)
        .join("\n");

    const summary = `📊 *${t(lang, "game_summary").split("\n")[0]}*\n\n${rows}`;
    await telegram.sendMessage(chatId, summary, { parse_mode: "Markdown" });

    // Reveal to spectators
    await revealToSpectators(gameId, players, winMsg, telegram);

    // Cleanup
    cleanupMafiaRelay(gameId);
    cleanupSpectators(gameId);

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

            const startedLine = {
                uz:  "Rollar shaxsiy xabarda yuborildi 📩",
                ru:  "Роли отправлены в личные сообщения 📩",
                eng: "Roles sent via private message 📩",
            }[lang];

            await telegram.sendMessage(
                chatId,
                `✅ *${t(lang, "game_started")}* (${assignments.length} 👥)\n\n🎭 ${startedLine}`,
                { parse_mode: "Markdown" }
            );

            // DM each player their role card in their personal language
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

        // Broadcast to spectators too
        await broadcastToSpectators(
            gameId,
            t(lang, "night_started", { number: round }),
            telegram
        );

        // Start mafia team relay
        await startMafiaRelay(gameId, telegram);

        // DM night action keyboards
        await sendNightDMs(gameId, round, telegram);

        // 40s fallback
        const { gameQueue } = require("../handlers/queue");
        await gameQueue.add("resolveNight", { gameId, chatId, round }, { delay: 40_000 });
        return;
    }

    // ── resolveNight ──────────────────────────────────────────────────────────
    if (job.name === "resolveNight") {
        const pending = await prisma.nightAction.count({ where: { gameId, round, resolved: false } });
        const total   = await prisma.nightAction.count({ where: { gameId, round } });

        if (total > 0 && pending === 0) {
            // Already resolved by early-path
            stopMafiaRelay(gameId);
            const over = await handleWinCheck(gameId, chatId);
            if (!over) await transitionToDay(gameId, chatId, round);
            return;
        }

        stopMafiaRelay(gameId);
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

        await broadcastToSpectators(
            gameId,
            t(lang, "day_started", { number: round, seconds: 60 }),
            telegram
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

        // SUDYA button — only if SUDYA is alive and hasn't used ability
        await sendSudyaButton(gameId, round, telegram, chatId, lang);
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

// ─── SUDYA button ─────────────────────────────────────────────────────────────

async function sendSudyaButton(gameId, round, telegram, chatId, lang) {
    const sudya = await prisma.player.findFirst({
        where: { gameId, role: "SUDYA", isAlive: true },
    });
    if (!sudya) return;

    // Check if already used (maxUses: 1)
    const used = await prisma.nightAction.count({
        where: { gameId, actorId: sudya.id, action: "CANCEL_LYNCH" },
    });
    if (used > 0) return;

    const label = {
        uz:  "⚖️ Lynchni bekor qilish (1 marta)",
        ru:  "⚖️ Отменить линч (1 раз)",
        eng: "⚖️ Cancel lynch (1 time)",
    }[lang] ?? "⚖️ Cancel lynch";

    const { Markup } = require("telegraf");
    try {
        await telegram.sendMessage(
            sudya.userTgId,
            `⚖️ *Sudya* — ${label}\n\n` +
            (lang === "uz" ? "Hozirgi ovoz berishni bekor qilishingiz mumkin." :
             lang === "ru" ? "Вы можете отменить текущее голосование." :
             "You can cancel the current vote."),
            {
                parse_mode:   "Markdown",
                reply_markup: {
                    inline_keyboard: [[
                        { text: label, callback_data: `sudya_cancel_${gameId}_${round}` }
                    ]]
                }
            }
        );
    } catch {}
}

worker.on("completed", (job) => console.log("✅ done:", job.name));
worker.on("failed",    (job, err) => console.error("❌ failed:", job?.name, err.message));
console.log("🎯 Game worker running...");
// ✅ No bot.launch() here
const { Markup } = require("telegraf");
const { prisma } = require("../../config/db");

// Faqat MVP role->action map (keyin kengaytirasan)
function roleToNightAction(role) {
    switch (role) {
        case "DON":
        case "KILLER":
            return { type: "KILL", label: "🔪 Kill" };
        case "DOCTOR":
        case "GUARD":
            return { type: "HEAL", label: "🧑🏻‍⚕ Heal" };
        case "COMMISSAR":
        case "SPY":
            return { type: "CHECK_ROLE", label: "🕵️ Check" };
        case "LOVER":
            return { type: "BLOCK", label: "💊 Block" };
        default:
            return null;
    }
}

function chunk(arr, size) {
    const out = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
}

function buildTargetsKeyboard(gameId, nightNumber, actionType, alivePlayers, excludeTelegramId) {
    const targets = alivePlayers
        .filter((p) => p.telegramId !== excludeTelegramId)
        .map((p) => ({
            text: p.firstName || "User",
            data: `na|${gameId}|${nightNumber}|${actionType}|${p.telegramId}`,
        }));

    const rows = chunk(targets, 2).map((row) =>
        row.map((b) => Markup.button.callback(b.text, b.data))
    );

    rows.push([Markup.button.callback("❌ Cancel", `na|${gameId}|${nightNumber}|CANCEL|0`)]);
    return Markup.inlineKeyboard(rows);
}

async function startNight(bot, gameId, chatId) {
    const game = await prisma.game.findUnique({
        where: { id: gameId },
        include: { players: true },
    });
    if (!game) return;

    // phase NIGHT + nightNumber++
    const nextNight = (game.nightNumber || 0) + 1;

    await prisma.game.update({
        where: { id: gameId },
        data: {
            phase: "NIGHT",
            nightNumber: nextNight,
            lastTransitionAt: new Date(),
        },
    });

    // alive list
    const alive = game.players.filter((p) => p.isAlive);

    // group announce
    await bot.telegram.sendMessage(chatId, `🌙 Night #${nextNight} started! Check your DM to act.`);

    // DM actions
    for (const p of alive) {
        const act = roleToNightAction(p.role);
        if (!act) continue;

        const kb = buildTargetsKeyboard(gameId, nextNight, act.type, alive, p.telegramId);

        const text =
            `🌙 <b>Night #${nextNight}</b>\n` +
            `Your role: <b>${p.role}</b>\n` +
            `Choose target for: <b>${act.label}</b>`;

        try {
            await bot.telegram.sendMessage(p.telegramId, text, {
                parse_mode: "HTML",
                ...kb,
            });
        } catch (e) {
            // user botni start qilmagan bo‘lishi mumkin
            console.log(`[DM FAIL night] tg=${p.telegramId}`, e?.response?.description || e.message);
        }
    }
}

module.exports = { startNight };
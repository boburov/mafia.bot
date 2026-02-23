const { prisma } = require("../../config/db");

function mention(tgId, name) {
    const safe = (name || "User").replace(/[<&>]/g, "");
    return `<a href="tg://user?id=${tgId}">${safe}</a>`;
}

async function checkWinAndFinish(bot, gameId, chatId) {
    const game = await prisma.game.findUnique({
        where: { id: gameId },
        include: { players: true },
    });
    if (!game || game.status !== "RUNNING") return { finished: false };

    const alive = game.players.filter(p => p.isAlive);

    // ✅ your rule
    if (alive.length <= 1) {
        const winner = alive[0] || null;

        await prisma.game.update({
            where: { id: gameId },
            data: { status: "FINISHED", phase: "DAY", lastTransitionAt: new Date() },
        });

        if (winner) {
            await bot.telegram.sendMessage(
                chatId,
                `🏁 <b>Game Over</b>\n🏆 Winner: ${mention(winner.telegramId, winner.firstName)}\n\n(Only one player left alive)`,
                { parse_mode: "HTML" }
            );
        } else {
            await bot.telegram.sendMessage(
                chatId,
                `🏁 <b>Game Over</b>\nNobody survived 😵`,
                { parse_mode: "HTML" }
            );
        }

        return { finished: true, winnerTelegramId: winner?.telegramId || null };
    }

    return { finished: false };
}

module.exports = { checkWinAndFinish };
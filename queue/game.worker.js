const { Worker } = require("bullmq");
const { connection } = require("./redis");
const { prisma } = require("../config/db");
const { assignRolesAndNotify } = require("../core/services/role.assigner");

function initGameWorker(bot) {
  const worker = new Worker(
    "game",
    async (job) => {
      if (job.name !== "START_GAME") return;

      const { gameId, chatId } = job.data;

      const game = await prisma.game.findUnique({
        where: { id: gameId },
        include: { players: true },
      });

      if (!game) return;

      if (game.status !== "LOBBY") return;

      const playerCount = game.players.length;

      if (playerCount < 2) {
        await bot.telegram.sendMessage(
          chatId,
          `❌ Game cancelled: not enough players (${playerCount}/8).`
        );

        // cleanup
        await prisma.$transaction([
          prisma.gamePlayer.deleteMany({ where: { gameId } }),
          prisma.gameAction.deleteMany({ where: { gameId } }),
          prisma.gameVote.deleteMany({ where: { gameId } }),
          prisma.gameLog.deleteMany({ where: { gameId } }),
          prisma.game.delete({ where: { id: gameId } }),
        ]);

        return;
      }

      // Enough players -> start game
      await prisma.game.update({
        where: { id: gameId },
        data: {
          status: "RUNNING",
          startedAt: new Date(),
          phase: "DAY",
          dayNumber: 1,
          lastTransitionAt: new Date(),
        },
      });

      await assignRolesAndNotify(bot, gameId);
      await bot.telegram.sendMessage(chatId, "📩 Roles have been sent in DM!");
    },
    { connection }
  );

  worker.on("failed", (job, err) => {
    console.error("[game worker] job failed:", job?.id, err);
  });

  console.log("[game worker] started");
  return worker;
}

module.exports = { initGameWorker };
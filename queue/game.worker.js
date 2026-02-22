const { Worker } = require("bullmq");
const { connection } = require("./redis");
const { prisma } = require("../config/db");
const { assignRolesAndNotify } = require("../core/services/role.assigner");
const { gameQueue } = require("./queue");

function initGameWorker(bot) {
  const worker = new Worker(
    "game",
    async (job) => {
      switch (job.name) {
        case "START_GAME": {
          const { gameId, chatId } = job.data;

          const game = await prisma.game.findUnique({
            where: { id: gameId },
            include: { players: true },
          });
          if (!game) return;

          const MIN_PLAYERS = 2;
          const playerCount = game.players.length;

          if (playerCount < MIN_PLAYERS) {
            await bot.telegram.sendMessage(
              chatId,
              `❌ Game cancelled: not enough players (${playerCount}/${MIN_PLAYERS}).`
            );

            await prisma.$transaction([
              prisma.gamePlayer.deleteMany({ where: { gameId } }),
              prisma.game.delete({ where: { id: gameId } }),
            ]);

            return;
          }

          const now = new Date();

          const started = await prisma.game.updateMany({
            where: { id: gameId, status: "LOBBY" },
            data: {
              status: "RUNNING",
              startedAt: now,
              phase: "DAY",
              dayNumber: 1,
              lastTransitionAt: now,
            },
          });

          if (started.count === 0) return;

          await gameQueue.add(
            "NIGHT_PHASE",
            { gameId, chatId },
            { delay: 30_000, jobId: `NIGHT_PHASE-${gameId}`, removeOnComplete: true }
          );

          await assignRolesAndNotify(bot, gameId);
          await bot.telegram.sendMessage(chatId, "📩 Roles have been sent in DM!");
          return;
        } case "NIGHT_PHASE": {
          const { gameId, chatId } = job.data;

          const game = await prisma.game.findUnique({ where: { id: gameId } });
          if (!game) {
            console.log("Game not found");
            return;
          }

          await prisma.game.update({
            where: { id: gameId },
            data: { phase: "NIGHT", lastTransitionAt: new Date() },
          });

          await bot.telegram.sendMessage(chatId, "🌙 Night phase started!");
          return;
        }

        default:
          return;
      }
    },
    {
      connection,
      concurrency: 5,
    }
  );

  worker.on("failed", (job, err) => {
    console.error("[game worker] job failed:", job?.id, err);
  });

  console.log("[game worker] started");
  return worker;
}

module.exports = { initGameWorker };
const { Worker } = require("bullmq");
const { gameQueue } = require("./queue");
const { connection } = require("./redis");
const { prisma } = require("../config/db");
const { safeSendMessage } = require("../lib/tg.safe");
const { startNight } = require("../core/engine/night");
const { resolveNight } = require("../core/engine/resolve");
const { checkWinAndFinish } = require("../core/engine/win");
const { startVoting, finishVoting } = require("../core/engine/voting");
const { assignRolesAndNotify } = require("../core/services/role.assigner");

function initGameWorker(bot) {
  const worker = new Worker(
    "game",
    async (job) => {
      switch (job.name) {
        case "START_GAME": {
          try {
            const { gameId, chatId } = job.data;

            const game = await prisma.game.findUnique({
              where: { id: gameId },
              include: { players: true },
            });
            if (!game) return;

            const MIN_PLAYERS = 8;
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
            try {
              await safeSendMessage(bot, chatId, "📩 Roles have been sent in DM!");
            } catch (e) {
              console.log("[GROUP SEND FAIL]", e?.code || e?.message);
              // DO NOT throw
            }
            return;
          } catch (e) {
            console.error("[START_GAME fatal]", e);
            return;
          }
        } case "NIGHT_PHASE": {
          const { gameId, chatId } = job.data;
          await startNight(bot, gameId, chatId);

          await gameQueue.add(
            "NIGHT_RESOLVE",
            { gameId, chatId },
            { delay: 45_000, jobId: `NIGHT_RESOLVE-${gameId}-${Date.now()}`, removeOnComplete: true }
          );
          return;
        }
        case "NIGHT_RESOLVE": {
          const { gameId, chatId } = job.data;

          await resolveNight(bot, gameId, chatId);

          const game = await prisma.game.findUnique({ where: { id: gameId } });
          if (!game || game.status !== "RUNNING") return;

          // start voting
          await gameQueue.add(
            "VOTING_START",
            { gameId, chatId },
            { delay: 3_000, jobId: `VOTING_START-${gameId}-${Date.now()}`, removeOnComplete: true }
          );

          return;
        } case "VOTING_START": {
          const { gameId, chatId } = job.data;

          const game = await prisma.game.findUnique({ where: { id: gameId } });
          if (!game || game.status !== "RUNNING") return;

          await startVoting(bot, gameId, chatId);

          // voting lasts 45s (change if you want)
          await gameQueue.add(
            "VOTING_END",
            { gameId, chatId },
            { delay: 45_000, jobId: `VOTING_END-${gameId}-${Date.now()}`, removeOnComplete: true }
          );
          return;
        }

        case "VOTING_END": {
          const { gameId, chatId } = job.data;

          const game = await prisma.game.findUnique({ where: { id: gameId } });
          if (!game || game.status !== "RUNNING") return;

          await finishVoting(bot, gameId, chatId);

          const win = await checkWinAndFinish(bot, gameId, chatId);
          if (win.finished) return; // ✅ stop the loop if game ended

          await gameQueue.add("NIGHT_PHASE", { gameId, chatId }, { delay: 3000, jobId: `NIGHT_PHASE-${gameId}-${Date.now()}`, removeOnComplete: true });
          return;
        }
        case "NIGHT_RESOLVE": {
          const { gameId, chatId } = job.data;

          const game = await prisma.game.findUnique({ where: { id: gameId } });
          if (!game || game.status !== "RUNNING") return;

          await resolveNight(bot, gameId, chatId);

          const win = await checkWinAndFinish(bot, gameId, chatId);
          if (win.finished) return;

          await gameQueue.add("VOTING_START", { gameId, chatId }, { delay: 1000, jobId: `VOTING_START-${gameId}-${Date.now()}`, removeOnComplete: true });
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
const { Worker } = require("bullmq");
const { connection } = require("./redis");

function startWorkers(bot) {
  console.log("✅ startWorkers called");

  new Worker(
    "game",
    async (job) => {
      console.log("✅ Job received:", job.name, job.data);

      switch (job.name) {
        case "phase-timeout": {
          const { chatId } = job.data;

          await bot.telegram.sendMessage(chatId, "⏰ 60 seconds passed! Starting the game...");
          return;
        }

        default:
          console.log("⚠️ Unknown job:", job.name);
          return;
      }
    },
    { connection }
  );

  console.log("✅ Worker created (queue: game)");
}

module.exports = { startWorkers };

const { Worker } = require("bullmq");
const { connection } = require("./redis");

function startWorkers(bot) {
  console.log("✅ startWorkers called");

  new Worker(
    "game",
    async (job) => {
      switch (job.name) {
        case "phase-timeout ":
          return "salom"
        case "collect-users":
          return "salom"
        case "vote-timeout":
          return "salom"

      }

    },
    { connection }
  );

  console.log("✅ Worker created (queue: game)");
}

module.exports = { startWorkers };

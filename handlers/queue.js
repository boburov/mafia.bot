// queue/queue.js
const { Queue } = require("bullmq");
const { connection } = require("./redis");

const gameQueue = new Queue("game", { connection });

async function cancelGameJobs(gameId) {
  const states = ["delayed", "wait", "paused", "prioritized"];
  for (const state of states) {
    const jobs = await gameQueue.getJobs([state], 0, 2000, true);
    for (const job of jobs) {
      if (job?.data?.gameId === gameId) {
        try { await job.remove(); } catch {}
      }
    }
  }
}

module.exports = { gameQueue, cancelGameJobs };
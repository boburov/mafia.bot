const { Queue } = require("bullmq");
const { connection } = require("./redis");

const gameQueue = new Queue("game", { connection });

async function scheduleJob(name, data, delayMs, dedupKey) {
  await gameQueue.add(name, data, {
    delay: delayMs,
    jobId: dedupKey,
    attempts: 3,
    backoff: { type: "fixed", delay: 2000 },
  });
}

async function cancelJob(dedupKey) {
  try {
    const job = await gameQueue.getJob(dedupKey);
    if (job) await job.remove();
  } catch (e) {
    console.error("[queue] cancelJob error:", e.message);
  }
}

module.exports = { gameQueue, scheduleJob, cancelJob };

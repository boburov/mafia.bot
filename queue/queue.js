// queue/queue.js
// BullMQ queue instance + scheduleJob helper with dedup via jobId.
"use strict";

const { Queue } = require("bullmq");
const { connection } = require("./redis");

const gameQueue = new Queue("game", { connection });

/**
 * Schedule a job with deduplication via jobId.
 * If a job with the same jobId already exists in the queue, it won't be added again.
 *
 * @param {string} name - Job name (e.g. "lobby-start")
 * @param {object} data - Job payload
 * @param {number} delayMs - Delay in milliseconds
 * @param {string} dedupKey - Unique key for deduplication (used as jobId)
 */
async function scheduleJob(name, data, delayMs, dedupKey) {
  await gameQueue.add(name, data, {
    delay: delayMs,
    jobId: dedupKey, // BullMQ deduplicates by jobId
    attempts: 3,
    backoff: { type: "fixed", delay: 2000 },
  });
}

/**
 * Remove a scheduled job by its dedup key (jobId).
 * Safe to call even if job doesn't exist.
 */
async function cancelJob(dedupKey) {
  try {
    const job = await gameQueue.getJob(dedupKey);
    if (job) await job.remove();
  } catch (e) {
    console.error("[queue] cancelJob error:", e.message);
  }
}

module.exports = { gameQueue, scheduleJob, cancelJob };

// workers/game.worker.js
const { Worker } = require("bullmq");
const { connection } = require("../handlers/redis");
const path = require("path");
const bot = require("../bot"); // bot singleton fayl

// assets path
const night = path.join(__dirname, "../assets/night.jpg");
const day = path.join(__dirname, "../assets/day.jpg");
const voting = path.join(__dirname, "../assets/voting.jpg");

const worker = new Worker(
  "game",
  async (job) => {
    console.log("🧠 JOB RECEIVED:", job.name, job.data);
    const { chatId } = job.data;

    if (job.name === "startNight") {
      await bot.telegram.sendPhoto(chatId, { source: night }, { caption: "🌙 TUN BOSHLANDI" });
    }

    if (job.name === "startDay") {
      await bot.telegram.sendPhoto(chatId, { source: day }, { caption: "☀ KUN BOSHLANDI" });
    }

    if (job.name === "startVoting") {
      await bot.telegram.sendPhoto(chatId, { source: voting }, { caption: "🗳 OVOZ BERISH BOSHLANDI" });
    }
  },
  { connection }
);

worker.on("completed", (job) => console.log("✅ job done:", job.name));
worker.on("failed", (job, err) => console.log("❌ job failed:", err));

console.log("🎯 Game worker running...");
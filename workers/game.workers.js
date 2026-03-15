require("dotenv").config();
const { Worker } = require("bullmq");
const { connection } = require("../handlers/redis");
const { Telegraf } = require("telegraf");
const path = require("path");

// ✅ Botni bu yerda mustaqil yaratamiz — circular dependency yo'q
const bot = new Telegraf(process.env.BOT_TOKEN);

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
            await bot.telegram.sendPhoto(chatId, { source: day }, { caption: "☀️ KUN BOSHLANDI" });
        }

        if (job.name === "startVoting") {
            await bot.telegram.sendPhoto(chatId, { source: voting }, { caption: "🗳 OVOZ BERISH BOSHLANDI" });
        }
    },
    { connection }
);

worker.on("completed", (job) => console.log("✅ job done:", job.name));
worker.on("failed", (job, err) => console.error("❌ job failed:", job?.name, err.message));

console.log("🎯 Game worker running...");
require("dotenv").config();
const { Telegraf } = require("telegraf");
const bot = new Telegraf(process.env.BOT_TOKEN);
require("./workers/game.workers")
// ⚠️ DO NOT require game.workers here — it runs as a SEPARATE process
// Start worker with: node workers/game.workers.js
// Or use PM2:        pm2 start workers/game.workers.js --name mafia-worker

const bot_runner = require("./bot");
const { connectDB } = require("./config/db");

async function setupCommands() {
    await bot.telegram.setMyCommands([
        { command: "start", description: "Botni ishga tushirish" },
        { command: "lang", description: "Tilni o'zgartirish" },
        { command: "create", description: "O'yin yaratish" },
        { command: "profile", description: "Profilim" },
        { command: "cancel", description: "O'yinni bekor qilish" },
        { command: "stop", description: "O'yinni to'xtatish" },
    ]);
}

async function boot() {
    try {
        await bot_runner(bot);
        await connectDB();
        await setupCommands();
        await bot.launch({ dropPendingUpdates: true }, () => {
            console.log("🎯 Bot running...");
        });
    } catch (e) {
        console.error("Boot error:", e);
        process.exit(1);
    }
}

boot();
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
module.exports = bot;
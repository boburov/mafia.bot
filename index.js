require("dotenv").config();
const { Telegraf } = require("telegraf");
const bot = new Telegraf(process.env.BOT_TOKEN);

const bot_runner = require("./bot");
const { connectDB, prisma, } = require("./config/db");
const ROLES = require("./core/game/roles/roles");

// ---------- Commands ----------
async function setupCommands() {
  await bot.telegram.setMyCommands([
    { command: "start", description: "Start Bot" },
    { command: "lang", description: "Change Language" },
    { command: "create", description: "Create Game" },
    { command: "profile", description: "Profile" },
    { command: "cancel", description: "Cancel Game" },
    { command: "stop", description: "Stop Game" },
  ]);
}

// ---------- Boot ----------
async function boot() {
  try {
    await bot_runner(bot);
    await connectDB();
    await setupCommands();

    // const roles = Object.keys(ROLES)

    // console.log(roles)

    // ✅ MUHIM: bot qayta yoqilganda eski update’larni tashlab yuboradi
    await bot.launch({ dropPendingUpdates: true }, () => {
      console.log("🎯 Bot running...");
    });

  } catch (e) {
    console.error("Boot error:", e);
    process.exit(1);
  }
}

boot();

// Graceful stop (nodemon/pm2 uchun foydali)
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));

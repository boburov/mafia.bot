require("dotenv").config();
const { Telegraf } = require("telegraf");

const bot = new Telegraf(process.env.BOT_TOKEN);

const bot_runner = require("./bot");
const { connectDB, prisma } = require("./config/db");
const botMiddlewar = require("./middleware/getLanguage");
const start = require("./core/commands/start");
const { startWorkers } = require("./queue/workers");

// ---------- Commands ----------
async function setupCommands() {
  await bot.telegram.setMyCommands([
    { command: "start", description: "Start Bot" },
    { command: "lang", description: "Change Language" },
    { command: "create", description: "Create Game" },
    { command: "profile", description: "Profile" },
  ]);
}

// Callback: enter_chat
bot.action("enter_chat", async (ctx) => {
  try {
    // spinner o‘chirish (har doim birinchi)
    await ctx.answerCbQuery();

    // keyin reply
    await ctx.reply("Send /create in group chat 🙂");
  } catch (e) {
    console.error("enter_chat error:", e);
  }
});

// ---------- Boot ----------
async function boot() {
  try {
    await botMiddlewar(bot);
    await bot_runner(bot);

    await connectDB();
    await setupCommands();
    await start(bot);
    await startWorkers(bot);

    // ✅ MUHIM: bot qayta yoqilganda eski update’larni tashlab yuboradi
    await bot.launch({ dropPendingUpdates: true });

    console.log("Bot running...");
  } catch (e) {
    console.error("Boot error:", e);
    process.exit(1);
  }
}

boot();

// Graceful stop (nodemon/pm2 uchun foydali)
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));

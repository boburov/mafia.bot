const { Telegraf, Markup } = require("telegraf");
require("dotenv").config();

const bot_runner = require("./bot");
const { connectDB } = require("./config/db");
const botMiddlewar = require("./middleware/getLanguage");
const start = require("./core/commands/start");
const { startWorkers } = require("./queue/workers");

const bot = new Telegraf(process.env.BOT_TOKEN);

// ---------- Commands ----------
async function setupCommands() {
  await bot.telegram.setMyCommands([
    { command: "start", description: "Start Bot" },
    { command: "lang", description: "Change Language" },
    { command: "create", description: "Create Game" },
    { command: "profile", description: "Profile" },
  ]);
}

bot.action("enter_chat", async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply("Send /groups or create a game here 🙂");
});
// ---------- Boot ----------
(async () => {
  await botMiddlewar(bot)
  await bot_runner(bot);
  await connectDB();
  await setupCommands();
  await start(bot)
  await startWorkers(bot)
  await bot.launch();
  console.log("Bot running...");
})();

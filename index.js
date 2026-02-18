const telegraf = require("telegraf");
const Telegraf = telegraf.Telegraf || telegraf.default?.Telegraf || telegraf.default || telegraf;
const Markup = telegraf.Markup || telegraf.default?.Markup;

require("dotenv").config();
const bot = new Telegraf(process.env.BOT_TOKEN);

const bot_runner = require("./bot");
const { connectDB } = require("./config/db");
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

bot.action("enter_chat", async (ctx) => {
  // 1) darhol spinner o‘chadi
  await ctx.answerCbQuery();

  // 2) keyin boshqa ishlar
  await ctx.reply("Send /create in group chat 🙂");
});


console.log("typeof bot.on:", typeof bot.on);
console.log("bot is Telegraf?", bot instanceof Telegraf);


bot.on("text", async (ctx) => {
  await ctx.reply(String(ctx.chat.id));
})

// ---------- Boot ----------
async function boot() {
  await botMiddlewar(bot);
  await bot_runner(bot);
  await connectDB();
  await setupCommands();
  await start(bot);
  await startWorkers(bot);
  await bot.launch();
  console.log("Bot running...");
}
boot();


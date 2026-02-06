const { Telegraf } = require("telegraf");
require("dotenv").config();
const bot = new Telegraf(process.env.BOT_TOKEN);


bot.command("start", (ctx) => ctx.reply("Welcome!"));

async function main() {
  await bot.launch();
  console.log("Bot Ishga Tushdi");
}

main();
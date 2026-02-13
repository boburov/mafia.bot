const { Telegraf } = require("telegraf");
const t = require("./middleware/language.changer");
require("dotenv").config();

const bot = new Telegraf(process.env.BOT_TOKEN);

bot.command("start", (ctx) => {
  // for now hardcode uz
  ctx.reply(t("uz", "welcome"));
});

async function main() {
  await bot.launch(() => {
    console.log("Bot Ishga Tushdi");
  });
}

main();

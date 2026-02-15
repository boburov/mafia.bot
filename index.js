const { Telegraf, Markup } = require("telegraf");
require("dotenv").config();

const bot_runner = require("./bot");
const { connectDB, prisma } = require("./config/db");
const t = require("./middleware/language.changer");

const bot = new Telegraf(process.env.BOT_TOKEN);

// ---------- Helpers ----------
const getUserId = (ctx) => String(ctx?.from?.id ?? "");
const normalizeLang = (lang) => (lang && lang.trim() ? lang : "eng");

const buildMainKeyboard = (lang) =>
  Markup.inlineKeyboard([
    [
      Markup.button.callback(t(lang, "shop"), "shop"),
      Markup.button.callback(t(lang, "profile"), "profile"),
    ],
    [Markup.button.callback(t(lang, "change_lang"), "change_lang")],
  ]);


async function getUserLang(ctx) {
  const userId = getUserId(ctx);
  if (!userId) return "eng";

  const user = await prisma.user.findUnique({ where: { user_id: userId } });
  return normalizeLang(user?.lang);
}

// ---------- Commands ----------
async function setupCommands() {
  await bot.telegram.setMyCommands([
    { command: "start", description: "Botni qayta ishga tushurish" },
    { command: "lang", description: "Tilni o'zgartirish" },
    { command: "help", description: "Botdan foydalanish" },
  ]);
}

// Optional: reply to any text (but don’t spam welcome each time)
bot.on("text", async (ctx) => {
  try {
    const lang = await getUserLang(ctx);
    // Example: just show keyboard (or remove this if you don't want it)
    return ctx.reply(t(lang, "welcome"), buildMainKeyboard(lang));
  } catch (err) {
    console.error("TEXT_ERROR:", err);
  }
});

// ---------- Your other bot logic ----------
bot_runner(bot); // IMPORTANT: do not pass mutable lang here

// ---------- Boot ----------
(async () => {
  await connectDB();
  await setupCommands();
  await bot.launch();
  console.log("Bot running...");
})();

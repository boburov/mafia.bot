const { Markup } = require("telegraf");
const { ensureUser } = require("../../constants/user.data");
const t = require("../../middleware/language.changer");

const buildMainKeyboard = (lang) =>
  Markup.inlineKeyboard([
    [
      Markup.button.callback(t(lang, "shop"), "shop"),
      Markup.button.callback(t(lang, "profile"), "profile"),
    ],
    [Markup.button.url(
      "👥 Add the game to your chat",
      `https://t.me/AuthenticMafiaBot?startgroup=mafia`
    ),],
    [Markup.button.callback(t(lang, "change_lang"), "change_lang")],
    [Markup.button.callback("🎲 Enter the chat", "enter_chat")],
  ]);

function start(bot) {
  bot.start(async (ctx) => {
    const userId = String(ctx?.from?.id ?? "");

    const lang = (ctx.state?.lang || "eng").trim();

    if (!userId) return;


    await ensureUser(userId);

    return ctx.reply(t(lang, "welcome"), buildMainKeyboard(lang));
  });
}

module.exports = start;

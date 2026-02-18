const { Markup } = require("telegraf");
const { ensureUser } = require("../../constants/user.data");
const t = require("../../middleware/language.changer");

const buildMainKeyboard = (lang) =>
  Markup.inlineKeyboard([
    [
      Markup.button.url(
        t(lang, "add_to_chanel"),
        `https://t.me/AuthenticMafiaBot?startgroup=mafia`
      ),
    ],

    [
      Markup.button.callback(t(lang, "change_lang"), "change_lang"),
    ],

    [
      Markup.button.callback(t(lang, "roles"), "all_roles"),
      Markup.button.callback(t(lang, "enter_the_chat"), "enter_chat"),
    ],

    [
      Markup.button.callback(t(lang, "shop"), "shop"),
      Markup.button.callback(t(lang, "profile"), "profile"),
    ],
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

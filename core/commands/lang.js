/**
 * core/commands/lang.js
 *
 * /lang command — language selection for users and group creators.
 *
 * Private chat:
 *   Changes the user's personal language.
 *   Affects all DMs: role cards, night prompts, error messages.
 *
 * Group chat (creator only):
 *   1. Saves as GROUP DEFAULT — persists across ALL future games in this chat.
 *   2. Also applies to the CURRENT active game immediately (if one exists).
 *
 * Language priority at runtime:
 *   Active game lang → Group default → uz (fallback)
 */

const { Markup } = require("telegraf");
const isAdmin = require("../../lib/admin.verifcation");
const {
    t,
    getLang,
    setUserLang,
    setGameLang,
    setGroupDefaultLang,
    getGroupDefaultLang,
} = require("../i18n");
const { prisma } = require("../../config/db");

const LANG_OPTIONS = [
    { code: "uz", flag: "🇺🇿", label: "O'zbek" },
    { code: "ru", flag: "🇷🇺", label: "Русский" },
    { code: "eng", flag: "🇬🇧", label: "English" },
];

module.exports = function lang(bot) {

    // ── /lang command ─────────────────────────────────────────────────────────
    bot.command("lang", async (ctx) => {
        const chatId = String(ctx.chat.id);
        const isGroup = chatId.startsWith("-100");
        const uiLang = await getLang(ctx);

        // Build lang buttons
        const buttons = LANG_OPTIONS.map(l =>
            Markup.button.callback(`${l.flag} ${l.label}`, `setlang_${l.code}`)
        );

        if (isGroup) {
            // Show current default + buttons
            const currentDefault = await getGroupDefaultLang(chatId);
            const currentOption = LANG_OPTIONS.find(l => l.code === currentDefault);

            const isCreator = await isAdmin(ctx);
            if (!isCreator) {
                return ctx.reply(t(uiLang, "creator_only"));
            }

            await ctx.replyWithMarkdown(
                `*${t(uiLang, "change_lang")}*\n\n` +
                `Hozirgi til / Current / Текущий: *${currentOption?.flag} ${currentOption?.label}*\n\n` +
                `_Bu guruh uchun standart til o'rnatiladi._\n` +
                `_Sets the default language for this group._\n` +
                `_Устанавливает язык по умолчанию для группы._`,
                Markup.inlineKeyboard([buttons])
            );
        } else {
            await ctx.replyWithMarkdown(
                t(uiLang, "lang_select_prompt"),
                Markup.inlineKeyboard([buttons])
            );
        }
    });

    // ── setlang_ callback ─────────────────────────────────────────────────────
    bot.action(/^setlang_(uz|ru|eng)$/, async (ctx) => {
        const newLang = ctx.match[1];
        const chatId = String(ctx.callbackQuery.message.chat.id);
        const userTgId = String(ctx.from.id);
        const isGroup = chatId.startsWith("-100");
        const option = LANG_OPTIONS.find(l => l.code === newLang);

        if (isGroup) {
            // ── Group: creator only ───────────────────────────────────────────
            const isCreator = await isAdmin(ctx);
            if (!isCreator) {
                return ctx.answerCbQuery(
                    "🚫 Faqat guruh egasi tilni o'zgartira oladi.",
                    { show_alert: true }
                );
            }

            // 1. Save as group permanent default
            await setGroupDefaultLang(chatId, newLang);

            // 2. Apply to current active game if exists
            const activeGame = await prisma.game.findFirst({
                where: { chatId, NOT: { status: "FINISHED" } },
                orderBy: { id: "desc" },
            });
            if (activeGame) {
                await setGameLang(activeGame.id, newLang);
            }

            // 3. Also update creator's own personal lang
            await setUserLang(userTgId, newLang);

            await ctx.answerCbQuery(
                `${option?.flag} ${t(newLang, "lang_changed")}`,
                { show_alert: true }
            );

            await ctx.editMessageText(
                `${option?.flag} *${option?.label}*\n\n` +
                `✅ ${t(newLang, "lang_changed")}\n\n` +
                `_Barcha keyingi o'yinlar ushbu tilda bo'ladi._\n` +
                `_All future games will use this language._\n` +
                `_Все будущие игры будут на этом языке._`,
                { parse_mode: "Markdown" }
            ).catch(() => { });

        } else {
            // ── Private: update user's own lang ───────────────────────────────
            await setUserLang(userTgId, newLang);

            await ctx.answerCbQuery(
                `${option?.flag} ${t(newLang, "lang_changed")}`
            );

            await ctx.editMessageText(
                `${option?.flag} *${option?.label}*\n\n` +
                `${t(newLang, "lang_changed")}\n\n` +
                `${t(newLang, "welcome")}`,
                {
                    parse_mode: "Markdown",
                    ...Markup.inlineKeyboard([
                        [Markup.button.callback(t(newLang, "shop"), "shop"),
                        Markup.button.callback(t(newLang, "profile"), "profile")],
                    ]),
                }
            ).catch(() => { });
        }
    });
};
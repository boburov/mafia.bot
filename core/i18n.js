/**
 * core/i18n.js
 *
 * Translation engine.
 *
 * Usage:
 *   const { t, getLang, setLang } = require("./i18n");
 *
 *   // In a command handler:
 *   const lang = await getLang(ctx);
 *   await ctx.reply(t(lang, "welcome"));
 *
 *   // With interpolation:
 *   t(lang, "player_joined", { name: "Sardor", count: 5 })
 *   // → "✅ Sardor joined! Players: 5"
 *
 * Language is stored:
 *   - Per USER  in User.lang  (private chat)
 *   - Per GAME  in Game.lang  (group chat — set when game is created)
 */

const { prisma } = require("../config/db");

// ─── Load all lang files once at startup ──────────────────────────────────────

const STRINGS = {
    uz:  require("../lang/uz.json"),
    ru:  require("../lang/rus.json"),
    eng: require("../lang/eng.json"),
};

const SUPPORTED_LANGS = ["uz", "ru", "eng"];
const DEFAULT_LANG    = "uz";

// ─── Core translate function ──────────────────────────────────────────────────

/**
 * t(lang, key, vars?)
 * Returns the translated string for the given language.
 * Falls back to uz → eng if key is missing.
 * Interpolates {placeholder} variables.
 */
function t(lang, key, vars = {}) {
    const safe    = SUPPORTED_LANGS.includes(lang) ? lang : DEFAULT_LANG;
    const strings = STRINGS[safe] ?? STRINGS[DEFAULT_LANG];

    let str = strings[key]
        ?? STRINGS[DEFAULT_LANG][key]   // fallback to uz
        ?? STRINGS["eng"][key]          // fallback to eng
        ?? key;                         // last resort: return the key itself

    // Interpolate {variable} placeholders
    for (const [k, v] of Object.entries(vars)) {
        str = str.replaceAll(`{${k}}`, String(v));
    }

    return str;
}

// ─── Get language for context ─────────────────────────────────────────────────

/**
 * getLang(ctx)
 * For group chats: reads Game.lang
 * For private chats: reads User.lang
 * Falls back to DEFAULT_LANG if not set.
 */
async function getLang(ctx) {
    try {
        const chatId = String(ctx.chat?.id ?? "");

        if (chatId.startsWith("-100")) {
            // Group — priority: active game lang → group default → fallback
            const game = await prisma.game.findFirst({
                where:   { chatId, NOT: { status: "FINISHED" } },
                orderBy: { id: "desc" },
                select:  { lang: true },
            });
            if (game?.lang) return game.lang;

            // Fall back to group default setting
            const groupSetting = await prisma.groupSettings.findUnique({
                where:  { chatId },
                select: { defaultLang: true },
            });
            return groupSetting?.defaultLang ?? DEFAULT_LANG;
        } else {
            // Private — use user's lang
            const user = await prisma.user.findUnique({
                where:  { user_id: String(ctx.from.id) },
                select: { lang: true },
            });
            return user?.lang ?? DEFAULT_LANG;
        }
    } catch {
        return DEFAULT_LANG;
    }
}

/**
 * getLangByUserId(userTgId)
 * For use outside of ctx (e.g. inside workers when sending DMs).
 */
async function getLangByUserId(userTgId) {
    try {
        const user = await prisma.user.findUnique({
            where:  { user_id: String(userTgId) },
            select: { lang: true },
        });
        return user?.lang ?? DEFAULT_LANG;
    } catch {
        return DEFAULT_LANG;
    }
}

/**
 * getLangByGameId(gameId)
 * For use inside workers when sending group messages.
 */
async function getLangByGameId(gameId) {
    try {
        const game = await prisma.game.findUnique({
            where:  { id: gameId },
            select: { lang: true },
        });
        return game?.lang ?? DEFAULT_LANG;
    } catch {
        return DEFAULT_LANG;
    }
}

// ─── Set language ─────────────────────────────────────────────────────────────

/**
 * setUserLang(userTgId, lang)
 * Saves user's preferred language.
 */
async function setUserLang(userTgId, lang) {
    if (!SUPPORTED_LANGS.includes(lang)) return;
    await prisma.user.updateMany({
        where: { user_id: String(userTgId) },
        data:  { lang },
    });
}

/**
 * setGameLang(gameId, lang)
 * Saves a game's language (affects all group messages for that game).
 */
async function setGameLang(gameId, lang) {
    if (!SUPPORTED_LANGS.includes(lang)) return;
    await prisma.game.update({
        where: { id: gameId },
        data:  { lang },
    });
}

/**
 * setGroupDefaultLang(chatId, lang)
 * Saves a group's default language — persists across all future games.
 * Called when creator uses /lang in the group.
 */
async function setGroupDefaultLang(chatId, lang) {
    if (!SUPPORTED_LANGS.includes(lang)) return;
    await prisma.groupSettings.upsert({
        where:  { chatId: String(chatId) },
        update: { defaultLang: lang },
        create: { chatId: String(chatId), defaultLang: lang },
    });
}

/**
 * getGroupDefaultLang(chatId)
 * Returns the group's saved default language.
 */
async function getGroupDefaultLang(chatId) {
    try {
        const setting = await prisma.groupSettings.findUnique({
            where:  { chatId: String(chatId) },
            select: { defaultLang: true },
        });
        return setting?.defaultLang ?? DEFAULT_LANG;
    } catch {
        return DEFAULT_LANG;
    }
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
    t,
    getLang,
    getLangByUserId,
    getLangByGameId,
    setUserLang,
    setGameLang,
    setGroupDefaultLang,
    getGroupDefaultLang,
    SUPPORTED_LANGS,
    DEFAULT_LANG,
};
const uz = require("../lang/uz.json");
const eng = require("../lang/eng.json");
const rus = require("../lang/rus.json");

const translations = { uz, eng, ru: rus };

/**
 * Returns translated string.
 * @param {object|string} ctxOrLang - Telegraf context OR language code ('uz', 'eng', 'ru')
 * @param {string} key - Nested key like "game.night.started"
 * @param {object} params - Replacement params like {name: 'John'}
 */
function t(ctxOrLang, key, params = {}) {
    let lang = "eng";

    if (typeof ctxOrLang === "string") {
        lang = ctxOrLang;
    } else if (ctxOrLang && ctxOrLang.state) {
        // If it's a context, check state
        lang = ctxOrLang.state.gameCreatorLang || ctxOrLang.state.lang || "eng";
    }

    // Map 'ru' to 'rus' if needed (as per files)
    if (lang === "ru") lang = "rus";
    if (lang === "en") lang = "eng";

    const dict = translations[lang] || translations.eng;
    const fallbackDict = translations.eng;

    let text = getNestedValue(dict, key) || getNestedValue(fallbackDict, key) || key;

    for (const [p, val] of Object.entries(params)) {
        text = text.replaceAll(`{${p}}`, String(val));
    }

    return text;
}

function getNestedValue(obj, key) {
    return key.split('.').reduce((o, i) => (o ? o[i] : undefined), obj);
}

module.exports = t;

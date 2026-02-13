const translations = {
    uz: require("../lang/uz.json"),
    en: require("../lang/eng.json"),
    ru: require("../lang/rus.json"),
};

function t(userLang, key, params = {}) {
    const dict = translations[userLang] || translations.en; // fallback lang
    let text = dict[key] ?? translations.en[key] ?? key;    // fallback key

    for (const p of Object.keys(params)) {
        text = text.replaceAll(`{${p}}`, String(params[p]));
    }

    return text;
}

module.exports = t;

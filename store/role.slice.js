const { Markup } = require("telegraf");
const { ROLES } = require("./roles");

function rolesKeyboard2Cols(lang = "eng") {
    const keys = Object.keys(ROLES);

    const rows = [];
    for (let i = 0; i < keys.length; i += 2) {
        const k1 = keys[i];
        const k2 = keys[i + 1];

        const b1 = Markup.button.callback(`${ROLES[k1].emoji} ${ROLES[k1].i18n.name[lang]}`, `role:${k1}`);

        const row = [b1];

        if (k2) {
            const b2 = Markup.button.callback(`${ROLES[k2].emoji} ${ROLES[k2].i18n.name[lang]}`, `role:${k2}`);
            row.push(b2);
        }

        rows.push(row);
    }

    return Markup.inlineKeyboard(rows);
}

module.exports = rolesKeyboard2Cols
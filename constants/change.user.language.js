// constants/change.user.language.js
const { prisma } = require("../config/db");

module.exports = function changeLanguage(userId, lang) {
    return prisma.user.update({
        where: { user_id: userId },
        data: { lang },
    });
};

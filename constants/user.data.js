// constants/user.data.js
const { prisma } = require("../config/db");

async function ensureUser(userId, defaultLang = "eng") {
    if (userId === undefined || userId === null) {
        throw new Error("ensureUser(userId) called with missing userId");
    }

    const id = String(userId); // normalize to string

    return prisma.user.upsert({
        where: { user_id: id },
        update: {}, // or update last_seen, etc.
        create: { user_id: id, lang: defaultLang },
    });
}

// export the FUNCTION (reusable)
module.exports = { ensureUser };

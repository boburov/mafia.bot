async function ensureUser(userId) {
    return prisma.user.upsert({
        where: { user_id: userId },
        update: {},
        create: { user_id: userId, lang: "eng" },
    });
}

module.exports = ensureUser
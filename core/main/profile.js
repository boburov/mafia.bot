const { Markup } = require("telegraf");
const prisma = require("../../config/db"); // <-- your prisma instance
const t = require("../../middleware/language.changer"); // your translate function

function safeText(text, fallback = "…") {
    if (typeof text !== "string") return fallback;
    const v = text.trim();
    return v.length ? v : fallback;
}

function countByName(equipments, name) {
    return equipments.filter(e => e.name === name).length;
}

function getActiveRole(equipments) {
    // Example: store active role as "active_role:don"
    const found = equipments.find(e => e.name.startsWith("active_role:"));
    if (!found) return 0; // screenshot shows 0
    const role = found.name.split(":")[1] || "";
    return role || 0;
}

module.exports = function profileCommand(bot) {
    bot.command("profile", async (ctx) => {
        try {
            const tgId = String(ctx.from.id);

            // Ensure user exists
            let user = await prisma.prisma.user.findUnique({
                where: { user_id: tgId },
                include: { user_equipment: true },
            });

            if (!user) {
                user = await prisma.user.create({
                    data: { user_id: tgId, lang: defaultLang },
                    include: { user_equipment: true },
                });
            }

            const lang = user.lang;

            const money = user.money ?? 0;
            const ruby = user.ruby ?? 0;

            // From User_equipment
            const defense = countByName(user.user_equipment, "defense");
            const documents = countByName(user.user_equipment, "document");
            const activeRole = getActiveRole(user.user_equipment) || 0;

            // Header name like screenshot (optional)
            const fullName = [ctx.from.first_name, ctx.from.last_name].filter(Boolean).join(" ");

            const text =
                `${fullName}\n\n` +
                `💰 Pullar: ${money}\n` +
                `💎 Toshlar: ${ruby}\n\n` +
                `🛡 Ximoya: ${defense}\n` +
                `📄 Hujjatlar: ${documents}\n` +
                `🕴 Faol rol: ${activeRole}`;

            const keyboard = Markup.inlineKeyboard([
                [Markup.button.callback(`${safeText(t(lang, "shop"), "Do'kon")}`, "OPEN_SHOP")],
                [
                    Markup.button.callback("Sotib olish 💰", "BUY_MONEY"),
                    Markup.button.callback("Sotib olish 💎", "BUY_RUBY"),
                ],
            ]);

            await ctx.reply(safeText(text, "👤 Profile"), keyboard);
        } catch (err) {
            console.error("PROFILE_ERROR:", err);
            await ctx.reply("❌ Xatolik yuz berdi");
        }
    });

    bot.action("profile", async (ctx) => {
        try {
            const tgId = String(ctx.from.id);

            // Ensure user exists
            let user = await prisma.prisma.user.findUnique({
                where: { user_id: tgId },
                include: { user_equipment: true },
            });

            if (!user) {
                user = await prisma.user.create({
                    data: { user_id: tgId, lang: defaultLang },
                    include: { user_equipment: true },
                });
            }

            const lang = user.lang;

            const money = user.money ?? 0;
            const ruby = user.ruby ?? 0;

            // From User_equipment
            const defense = countByName(user.user_equipment, "defense");
            const documents = countByName(user.user_equipment, "document");
            const activeRole = getActiveRole(user.user_equipment) || 0;

            // Header name like screenshot (optional)
            const fullName = [ctx.from.first_name, ctx.from.last_name].filter(Boolean).join(" ");

            const text =
                `${fullName}\n\n` +
                `💰 Pullar: ${money}\n` +
                `💎 Toshlar: ${ruby}\n\n` +
                `🛡 Ximoya: ${defense}\n` +
                `📄 Hujjatlar: ${documents}\n` +
                `🕴 Faol rol: ${activeRole}`;

            const keyboard = Markup.inlineKeyboard([
                [Markup.button.callback(`${safeText(t(lang, "shop"), "Do'kon")}`, "OPEN_SHOP")],
                [
                    Markup.button.callback("Sotib olish 💰", "BUY_MONEY"),
                    Markup.button.callback("Sotib olish 💎", "BUY_RUBY"),
                ],
            ]);

            await ctx.reply(safeText(text, "👤 Profile"), keyboard);
        } catch (err) {
            console.error("PROFILE_ERROR:", err);
            await ctx.reply("❌ Xatolik yuz berdi");
        }
    });
};

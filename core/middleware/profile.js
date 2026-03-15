/**
 * core/middleware/profile.js
 *
 * Handles:
 *  /profile  — show stats, balance, owned skins
 *  shop      — browse & buy role skins with coins or diamonds
 *  equip     — toggle a skin on/off for a role
 */

const { Markup } = require("telegraf");
const { prisma } = require("../../config/db");
const ROLES = require("../game/roles/roles");
const { claimDailyBonus, getDailyBonusStatus, REWARDS } = require("../../handlers/economy");
const { getDailyStatus, buildStreakBar } = require("../../handlers/economy");

// ─── Shop catalog (seed this into DB or keep hardcoded) ───────────────────────

const SHOP_CATALOG = [
    { roleKey: "DON",      skinName: "👑 El Don",        skinEmoji: "👑", price: 500,  diamondPrice: 0,  description: "Klassik Don ko'rinishi" },
    { roleKey: "DON",      skinName: "🕶 Jinoiy Don",     skinEmoji: "🕶", price: 1000, diamondPrice: 0,  description: "Sirli Don" },
    { roleKey: "KOMISSAR", skinName: "🦅 Bosh Agent",     skinEmoji: "🦅", price: 500,  diamondPrice: 0,  description: "FBI agenti uslubi" },
    { roleKey: "KILLER",   skinName: "⚔️ Assassin",       skinEmoji: "⚔️", price: 800,  diamondPrice: 0,  description: "Sovuq qotil" },
    { roleKey: "DOKTOR",   skinName: "🏥 Bosh Shifokor",  skinEmoji: "🏥", price: 400,  diamondPrice: 0,  description: "Tajribali doktor" },
    { roleKey: "MAFIA",    skinName: "🤵 Mafiya Janob",   skinEmoji: "🤵", price: 600,  diamondPrice: 0,  description: "Zo'r Mafiya a'zosi" },
    { roleKey: "ELF",      skinName: "🧝 Qorong'i Elf",   skinEmoji: "🧝", price: 700,  diamondPrice: 5,  description: "Maxsus Elf teri" },
    { roleKey: "QONXOR",   skinName: "🧛 Qadimiy Vampir", skinEmoji: "🧛", price: 0,    diamondPrice: 10, description: "Eksklyuziv diamond teri" },
];

// ─── Profile ──────────────────────────────────────────────────────────────────

function profile(bot) {

    // /profile command or "👤 Profil" button
    bot.command("profile", showProfile);
    bot.action("profile",  showProfile);

    async function showProfile(ctx) {
        const userTgId = String(ctx.from.id);

        let user = await prisma.user.findUnique({
            where:   { user_id: userTgId },
            include: { equipment: true },
        });

        if (!user) {
            // Auto-create
            user = await prisma.user.create({
                data:    { user_id: userTgId, name: ctx.from.first_name ?? "" },
                include: { equipment: true },
            });
        }

        const winRate = user.gamesPlayed > 0
            ? Math.round((user.gamesWon / user.gamesPlayed) * 100)
            : 0;

        const equippedSkins = user.equipment
            .filter(e => e.equipped)
            .map(e => `• ${ROLES[e.roleKey]?.name ?? e.roleKey} → ${e.skinEmoji} ${e.skinName}`)
            .join("\n") || "_Hech qanday skin kiyilmagan_";

        const text =
            `👤 *Profil*\n` +
            `━━━━━━━━━━━━━━━━\n` +
            `🏷 Ism: *${ctx.from.first_name}*\n` +
            `💰 Tangalar: *${user.money}*\n` +
            `💎 Diamondlar: *${user.diamond}*` +
            bonusLine + `\n\n` +
            `📊 *Statistika*\n` +
            `🎮 O'yinlar: *${user.gamesPlayed}*\n` +
            `🏆 G'alabalar: *${user.gamesWon}*\n` +
            `📈 Win rate: *${winRate}%*\n` +
            `🔪 O'ldirganlar: *${user.kills}*\n` +
            `💀 O'limlar: *${user.deaths}*\n\n` +
            `🎭 *Kiyilgan skinlar*\n${equippedSkins}`;

        // Show daily bonus status
        const bonusStatus = await getDailyStatus(userTgId);
        const bonusLine   = bonusStatus?.canClaim
            ? `\n🎁 *Kunlik bonus tayyor!* — ${bonusStatus.nextCoins} 💰`
            : `\n⏳ Bonus: ${bonusStatus?.timeLeft ?? "?"} dan keyin`;

        const keyboard = Markup.inlineKeyboard([
            [Markup.button.callback("🎁 Kunlik Bonus", "claim_bonus")],
            [Markup.button.callback("🛒 Do'kon",       "shop_main"),
             Markup.button.callback("🎭 Skinlarim",    "my_skins")],
        ]);

        if (ctx.callbackQuery) {
            await ctx.editMessageText(text, { parse_mode: "Markdown", ...keyboard }).catch(() => {});
            await ctx.answerCbQuery();
        } else {
            await ctx.replyWithMarkdown(text, keyboard);
        }
    }

    // ── Daily bonus ───────────────────────────────────────────────────────────

    bot.action("daily_bonus", async (ctx) => {
        const userTgId = String(ctx.from.id);
        await ctx.answerCbQuery();

        const result = await claimDailyBonus(userTgId);

        if (!result.ok) {
            return ctx.editMessageText(
                `🎁 *Kunlik bonus*

` +
                `⏳ Siz allaqachon bugun bonus oldingiz.
` +
                `🕐 Keyingi bonus: *${result.nextClaimIn} soatdan keyin*`,
                {
                    parse_mode: "Markdown",
                    ...Markup.inlineKeyboard([
                        [Markup.button.callback("⬅️ Orqaga", "profile")],
                    ]),
                }
            ).catch(() => {});
            return;
        }

        await ctx.editMessageText(
            `🎁 *Kunlik bonus olindi!*

` +
            `💰 +${result.coins} tanga
` +
            `  └ Asosiy: +${result.base}
` +
            `  └ Streak bonus: +${result.streakBonus}

` +
            `🔥 Streak: *${result.streak} kun*

` +
            `_Ertaga ham keling!_`,
            {
                parse_mode: "Markdown",
                ...Markup.inlineKeyboard([
                    [Markup.button.callback("⬅️ Orqaga", "profile")],
                ]),
            }
        ).catch(() => {});
    });

    // ── Shop main menu ────────────────────────────────────────────────────────

    bot.action("shop_main", async (ctx) => {
        await ctx.answerCbQuery();

        // Group items by role
        const roles = [...new Set(SHOP_CATALOG.map(i => i.roleKey))];

        const buttons = roles.map(roleKey =>
            Markup.button.callback(
                ROLES[roleKey]?.name ?? roleKey,
                `shop_role_${roleKey}`
            )
        );

        await ctx.editMessageText(
            `🛒 *Do'kon*\nRol tanlang:`,
            {
                parse_mode: "Markdown",
                ...Markup.inlineKeyboard([
                    ...chunkArray(buttons, 2),
                    [Markup.button.callback("⬅️ Orqaga", "profile")],
                ]),
            }
        ).catch(() => {});
    });

    // ── Shop: items for a specific role ──────────────────────────────────────

    bot.action(/^shop_role_(.+)$/, async (ctx) => {
        const roleKey  = ctx.match[1];
        const userTgId = String(ctx.from.id);
        await ctx.answerCbQuery();

        const user = await prisma.user.findUnique({
            where:   { user_id: userTgId },
            include: { equipment: { where: { roleKey } } },
        });

        const items = SHOP_CATALOG.filter(i => i.roleKey === roleKey);
        const ownedNames = new Set(user?.equipment.map(e => e.skinName) ?? []);

        const buttons = items.map(item => {
            const owned   = ownedNames.has(item.skinName);
            const priceStr = item.diamondPrice > 0
                ? `💎${item.diamondPrice}`
                : `💰${item.price}`;
            const label = owned
                ? `✅ ${item.skinEmoji} ${item.skinName}`
                : `${item.skinEmoji} ${item.skinName} (${priceStr})`;
            return Markup.button.callback(label, `buy_${roleKey}_${item.skinName}`);
        });

        const roleDef = ROLES[roleKey];
        await ctx.editMessageText(
            `🛒 *${roleDef?.name ?? roleKey}* uchun skinlar:`,
            {
                parse_mode: "Markdown",
                ...Markup.inlineKeyboard([
                    ...buttons.map(b => [b]),
                    [Markup.button.callback("⬅️ Orqaga", "shop_main")],
                ]),
            }
        ).catch(() => {});
    });

    // ── Buy ───────────────────────────────────────────────────────────────────

    bot.action(/^buy_(.+?)_(.+)$/, async (ctx) => {
        const roleKey  = ctx.match[1];
        const skinName = ctx.match[2];
        const userTgId = String(ctx.from.id);

        const item = SHOP_CATALOG.find(
            i => i.roleKey === roleKey && i.skinName === skinName
        );
        if (!item) return ctx.answerCbQuery("Mahsulot topilmadi ❌", { show_alert: true });

        const user = await prisma.user.findUnique({ where: { user_id: userTgId } });
        if (!user) return ctx.answerCbQuery("Avval /start yuboring ❗", { show_alert: true });

        // Check already owned
        const alreadyOwned = await prisma.equipment.findFirst({
            where: { userId: user.id, roleKey, skinName },
        });
        if (alreadyOwned) return ctx.answerCbQuery("Bu skin allaqachon sizda bor ✅", { show_alert: true });

        // Check balance
        if (item.diamondPrice > 0) {
            if (user.diamond < item.diamondPrice)
                return ctx.answerCbQuery(`Yetarli diamond yo'q 💎 (Kerak: ${item.diamondPrice})`, { show_alert: true });
        } else {
            if (user.money < item.price)
                return ctx.answerCbQuery(`Yetarli tangalar yo'q 💰 (Kerak: ${item.price})`, { show_alert: true });
        }

        // Deduct & grant
        await prisma.$transaction([
            prisma.user.update({
                where: { id: user.id },
                data:  item.diamondPrice > 0
                    ? { diamond: { decrement: item.diamondPrice } }
                    : { money:   { decrement: item.price } },
            }),
            prisma.equipment.create({
                data: {
                    userId:    user.id,
                    roleKey,
                    skinName,
                    skinEmoji: item.skinEmoji,
                    equipped:  false,
                },
            }),
        ]);

        await ctx.answerCbQuery(`✅ ${item.skinEmoji} ${skinName} sotib olindi!`, { show_alert: true });
        // Refresh shop view
        await ctx.editMessageText(
            `✅ *${item.skinEmoji} ${skinName}* muvaffaqiyatli sotib olindi!\n\n` +
            `Uni kiyish uchun "🎭 Skinlarim" bo'limiga o'ting.`,
            {
                parse_mode: "Markdown",
                ...Markup.inlineKeyboard([
                    [Markup.button.callback("🎭 Skinlarim", "my_skins")],
                    [Markup.button.callback("🛒 Do'konga qaytish", "shop_main")],
                ]),
            }
        ).catch(() => {});
    });

    // ── My skins ──────────────────────────────────────────────────────────────

    bot.action("my_skins", async (ctx) => {
        const userTgId = String(ctx.from.id);
        await ctx.answerCbQuery();

        const user = await prisma.user.findUnique({
            where:   { user_id: userTgId },
            include: { equipment: true },
        });

        if (!user?.equipment.length) {
            return ctx.editMessageText(
                "🎭 Sizda hali skinlar yo'q.\nDo'kondan sotib oling!",
                {
                    ...Markup.inlineKeyboard([
                        [Markup.button.callback("🛒 Do'kon", "shop_main")],
                        [Markup.button.callback("⬅️ Orqaga", "profile")],
                    ]),
                }
            ).catch(() => {});
        }

        const buttons = user.equipment.map(e =>
            Markup.button.callback(
                `${e.equipped ? "✅" : "⬜"} ${e.skinEmoji} ${e.skinName}`,
                `equip_${e.id}`
            )
        );

        await ctx.editMessageText(
            `🎭 *Skinlarim*\n✅ = kiyilgan | ⬜ = kiyilmagan\n\nBosib kiyish/echish mumkin:`,
            {
                parse_mode: "Markdown",
                ...Markup.inlineKeyboard([
                    ...buttons.map(b => [b]),
                    [Markup.button.callback("⬅️ Orqaga", "profile")],
                ]),
            }
        ).catch(() => {});
    });

    // ── Equip/unequip toggle ──────────────────────────────────────────────────

    bot.action(/^equip_(.+)$/, async (ctx) => {
        const equipId  = ctx.match[1];
        const userTgId = String(ctx.from.id);

        const user = await prisma.user.findUnique({ where: { user_id: userTgId } });
        if (!user) return ctx.answerCbQuery("Xatolik ❌", { show_alert: true });

        const item = await prisma.equipment.findUnique({ where: { id: equipId } });
        if (!item || item.userId !== user.id)
            return ctx.answerCbQuery("Bu skin sizniki emas ❌", { show_alert: true });

        if (item.equipped) {
            // Unequip
            await prisma.equipment.update({ where: { id: equipId }, data: { equipped: false } });
            await ctx.answerCbQuery("⬜ Echib olindi.");
        } else {
            // Equip — unequip any other skin for same role first
            await prisma.$transaction([
                prisma.equipment.updateMany({
                    where: { userId: user.id, roleKey: item.roleKey, equipped: true },
                    data:  { equipped: false },
                }),
                prisma.equipment.update({
                    where: { id: equipId },
                    data:  { equipped: true },
                }),
            ]);
            await ctx.answerCbQuery(`✅ ${item.skinEmoji} ${item.skinName} kiyildi!`);
        }

        // Refresh skins list
        await ctx.callbackQuery && bot.handleUpdate({
            ...ctx.update,
            callback_query: { ...ctx.callbackQuery, data: "my_skins" },
        }).catch(() => {});
    });

    // ── shop shortcut from main menu ──────────────────────────────────────────
    bot.action("shop", async (ctx) => {
        ctx.callbackQuery.data = "shop_main";
        await ctx.answerCbQuery();
        // Re-trigger shop_main handler
        const user = await prisma.user.findUnique({
            where: { user_id: String(ctx.from.id) },
        });
        const balance = user ? `💰 ${user.money} | 💎 ${user.diamond}` : "";
        await ctx.editMessageText(
            `🛒 *Do'kon*\n${balance}\n\nRol tanlang:`,
            {
                parse_mode: "Markdown",
                ...Markup.inlineKeyboard([
                    ...chunkArray(
                        [...new Set(SHOP_CATALOG.map(i => i.roleKey))].map(roleKey =>
                            Markup.button.callback(ROLES[roleKey]?.name ?? roleKey, `shop_role_${roleKey}`)
                        ),
                        2
                    ),
                    [Markup.button.callback("⬅️ Orqaga", "profile")],
                ]),
            }
        ).catch(() => ctx.replyWithMarkdown(
            `🛒 *Do'kon*\n${balance}\n\nRol tanlang:`,
            Markup.inlineKeyboard([
                ...chunkArray(
                    [...new Set(SHOP_CATALOG.map(i => i.roleKey))].map(roleKey =>
                        Markup.button.callback(ROLES[roleKey]?.name ?? roleKey, `shop_role_${roleKey}`)
                    ),
                    2
                ),
            ])
        ));
    });
}

// ─── Apply skin at role assignment time ───────────────────────────────────────

/**
 * applySkinToPlayer(player, userId)
 * If the user owns an equipped skin for this role, update player.skinName.
 * Call this right after assignRoles() assigns each player their role.
 */
async function applySkinToPlayer(player, userTgId) {
    const user = await prisma.user.findUnique({ where: { user_id: userTgId } });
    if (!user) return;

    const skin = await prisma.equipment.findFirst({
        where: { userId: user.id, roleKey: player.role, equipped: true },
    });

    if (skin) {
        await prisma.player.update({
            where: { id: player.id },
            data:  { skinName: `${skin.skinEmoji} ${skin.skinName}` },
        });
    }
}

// ─── Update user stats after game ends ───────────────────────────────────────

/**
 * updateStatsAfterGame(gameId, winner)
 * Call from endGame() in engine.js.
 */
async function updateStatsAfterGame(gameId, winner) {
    const players = await prisma.player.findMany({ where: { gameId } });
    const ROLES_DATA = require("../game/roles/roles");
    const { TEAMS } = require("../game/roles/teams");

    for (const p of players) {
        const user = await prisma.user.findUnique({ where: { user_id: p.userTgId } });
        if (!user) continue;

        const roleDef = ROLES_DATA[p.role];
        const isWinner =
            (winner === "MAFIA"  && roleDef?.team === TEAMS.MAFIA)  ||
            (winner === "CIVIL"  && roleDef?.team === TEAMS.CIVIL)  ||
            (winner === "KILLER" && p.role === "KILLER")            ||
            (winner === "SUID"   && p.role === "SUID");

        await prisma.user.update({
            where: { id: user.id },
            data: {
                gamesPlayed: { increment: 1 },
                gamesWon:    { increment: isWinner ? 1 : 0 },
                deaths:      { increment: p.isAlive ? 0 : 1 },
            },
        });
    }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function chunkArray(arr, size) {
    const out = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
}

module.exports = profile;
module.exports.applySkinToPlayer    = applySkinToPlayer;
module.exports.updateStatsAfterGame = updateStatsAfterGame;
/**
 * core/commands/start.js
 *
 * Language rules:
 *  - Private chat messages → user's personal lang (User.lang)
 *  - Group chat messages   → game/group lang (Game.lang / GroupSettings.defaultLang)
 *  - Role card DMs         → each player's personal lang (User.lang)
 */

const { Markup } = require("telegraf");
const isAdmin    = require("../../lib/admin.verifcation");
const isExist    = require("../../lib/user.verfication");
const { prisma } = require("../../config/db");
const { gameQueue } = require("../../handlers/queue");
const ROLES      = require("../game/roles/roles");
const { TEAMS }  = require("../game/roles/teams");
const { t, getLang, getLangByUserId, getLangByGameId } = require("../i18n");

const { MIN_PLAYERS, IS_TEST } = require("../../config/test.config");

// ─── Role card builder (fully translated) ─────────────────────────────────────

function buildRoleCard(roleKey, roleDef, lang = "uz") {
    if (!roleDef) return `❓ ${t(lang, "error")}`;

    const teamLabel = {
        [TEAMS.MAFIA]:   t(lang, "mafia_team_label"),
        [TEAMS.CIVIL]:   t(lang, "town_team_label"),
        [TEAMS.SOLO]:    { uz: "🟡 Solo", ru: "🟡 Соло", eng: "🟡 Solo" }[lang] ?? "🟡 Solo",
        [TEAMS.NEUTRAL]: { uz: "⚪ Neytral", ru: "⚪ Нейтральный", eng: "⚪ Neutral" }[lang] ?? "⚪ Neutral",
    }[roleDef.team] ?? roleDef.team;

    const abilities = (roleDef.abilities ?? [])
        .map(a => `  • ${getAbilityDescription(a.type, a, lang)}`)
        .join("\n") || `  • ${getPassiveLabel(lang)}`;

    const winCond = getWinCondition(roleKey, roleDef, lang);

    const labels = {
        uz: {
            title:   "🎭 *Sizning rolingiz:*",
            team:    "👥 *Jamoa:*",
            ability: "⚡ *Qobiliyatlar:*",
            win:     "🏆 *G'alaba sharti:*",
            hint:    "_Harakatlaringizni faqat shaxsiy xabarda yuboring._",
        },
        ru: {
            title:   "🎭 *Ваша роль:*",
            team:    "👥 *Команда:*",
            ability: "⚡ *Способности:*",
            win:     "🏆 *Условие победы:*",
            hint:    "_Отправляйте действия только в личные сообщения._",
        },
        eng: {
            title:   "🎭 *Your role:*",
            team:    "👥 *Team:*",
            ability: "⚡ *Abilities:*",
            win:     "🏆 *Win condition:*",
            hint:    "_Send your actions only via private message._",
        },
    }[lang] ?? {
        title: "🎭 *Your role:*", team: "👥 *Team:*",
        ability: "⚡ *Abilities:*", win: "🏆 *Win condition:*",
        hint: "_Send your actions only via private message._",
    };

    return (
        `${labels.title}\n` +
        `━━━━━━━━━━━━━━━━\n` +
        `${roleDef.name}\n\n` +
        `${labels.team} ${teamLabel}\n\n` +
        `${labels.ability}\n${abilities}\n\n` +
        `${labels.win}\n  ${winCond}\n\n` +
        `━━━━━━━━━━━━━━━━\n` +
        `${labels.hint}`
    );
}

function getPassiveLabel(lang) {
    return {
        uz:  "Passiv rol (maxsus qoidalar)",
        ru:  "Пассивная роль (особые правила)",
        eng: "Passive role (special rules)",
    }[lang] ?? "Passive role";
}

function getAbilityDescription(type, ability, lang = "uz") {
    const base = {
        uz: {
            KILL:               "Har tunda bir o'yinchini o'ldirish",
            SAVE:               "Har tunda bir o'yinchini davolash",
            CHECK_ROLE:         "Har tunda bir o'yinchining rolini tekshirish",
            BLOCK:              "Har tunda bir o'yinchini bloklash",
            STEAL_VOTE:         "Ovoz berish paytida ovozlarni o'g'irlash",
            DOUBLE_VOTE:        "Ovoz berish paytida ikki ovoz berish",
            CANCEL_LYNCH:       "Bir marta lynchni bekor qilish",
            COPY_ROLE:          "Boshqa o'yinchining rolini nusxalash",
            TAKE_ROLE_ONE_NIGHT:"Bir tunlik boshqa rolni olish",
            LINK_PLAYERS:       "Ikki o'yinchini bog'lash — biri o'lsa ikkinchisi ham",
            REFLECT:            "Hujumni hujumchiga qaytarish (passiv)",
            REVENGE_KILL:       "O'limda bir o'yinchini tanlash",
            RANDOM_ROLE:        "Nishonga tasodifiy rol berish",
            TRANSFORM_ON_DEATH: "O'limda boshqa rolga aylanish (passiv)",
            PROTECT_FROM_CHECK: "Tekshiruvdan himoya qilish",
            CHECK_KILLER:       "O'ldirish qobiliyati borligini tekshirish",
        },
        ru: {
            KILL:               "Убить одного игрока каждую ночь",
            SAVE:               "Вылечить одного игрока каждую ночь",
            CHECK_ROLE:         "Проверить роль игрока каждую ночь",
            BLOCK:              "Заблокировать игрока каждую ночь",
            STEAL_VOTE:         "Украсть голоса во время голосования",
            DOUBLE_VOTE:        "Два голоса во время голосования",
            CANCEL_LYNCH:       "Отменить линч один раз",
            COPY_ROLE:          "Скопировать роль другого игрока",
            TAKE_ROLE_ONE_NIGHT:"Взять роль другого игрока на одну ночь",
            LINK_PLAYERS:       "Связать двух игроков — если один умрёт, второй тоже",
            REFLECT:            "Отразить атаку обратно (пассивно)",
            REVENGE_KILL:       "Выбрать кого забрать с собой при смерти",
            RANDOM_ROLE:        "Дать случайную роль цели",
            TRANSFORM_ON_DEATH: "Превратиться в другую роль при смерти (пассивно)",
            PROTECT_FROM_CHECK: "Защитить от проверки",
            CHECK_KILLER:       "Проверить наличие способности убивать",
        },
        eng: {
            KILL:               "Kill one player each night",
            SAVE:               "Heal one player each night",
            CHECK_ROLE:         "Check a player's role each night",
            BLOCK:              "Block a player each night",
            STEAL_VOTE:         "Steal votes during voting phase",
            DOUBLE_VOTE:        "Cast two votes during voting phase",
            CANCEL_LYNCH:       "Cancel a lynch once",
            COPY_ROLE:          "Copy another player's role",
            TAKE_ROLE_ONE_NIGHT:"Borrow another player's role for one night",
            LINK_PLAYERS:       "Link two players — if one dies, so does the other",
            REFLECT:            "Reflect attacks back to attacker (passive)",
            REVENGE_KILL:       "Choose someone to take with you on death",
            RANDOM_ROLE:        "Assign a random role to target",
            TRANSFORM_ON_DEATH: "Transform into another role on death (passive)",
            PROTECT_FROM_CHECK: "Protect from investigation",
            CHECK_KILLER:       "Check if a player has kill ability",
        },
    }[lang] ?? {};

    const desc = base[type] ?? type;

    const extras = [];
    if (ability?.cooldown) {
        const cooldownLabel = { uz: `Har ${ability.cooldown} turda bir marta`, ru: `Раз в ${ability.cooldown} хода`, eng: `Once every ${ability.cooldown} rounds` }[lang];
        extras.push(`⏳ ${cooldownLabel}`);
    }
    if (ability?.maxUses) {
        const maxLabel = { uz: `Maksimal ${ability.maxUses} marta`, ru: `Максимум ${ability.maxUses} раз`, eng: `Max ${ability.maxUses} time(s)` }[lang];
        extras.push(`🔢 ${maxLabel}`);
    }
    if (ability?.onlyAgainst) {
        const againstLabel = { uz: "Faqat", ru: "Только", eng: "Only vs" }[lang];
        extras.push(`🎯 ${againstLabel}: ${ability.onlyAgainst.join(", ")}`);
    }

    return extras.length > 0 ? `${desc} (${extras.join(", ")})` : desc;
}

function getWinCondition(roleKey, roleDef, lang = "uz") {
    const solo = { uz: "Yolg'iz g'olib bo'lib qolish", ru: "Остаться единственным победителем", eng: "Be the last one standing" };
    const wins = {
        SUID:       { uz: "Lynchga tushib o'lish 🤦", ru: "Быть линчеванным 🤦", eng: "Get lynched 🤦" },
        KILLER:     { ...solo, uz: solo.uz + " 🔪", ru: solo.ru + " 🔪", eng: solo.eng + " 🔪" },
        QONXOR:     { ...solo, uz: solo.uz + " 🧛", ru: solo.ru + " 🧛", eng: solo.eng + " 🧛" },
        KOZGU:      { ...solo, uz: solo.uz + " 🪞", ru: solo.ru + " 🪞", eng: solo.eng + " 🪞" },
        PARAZIT:    { ...solo, uz: solo.uz + " 🧥", ru: solo.ru + " 🧥", eng: solo.eng + " 🧥" },
        SAYOHATCHI: { ...solo, uz: solo.uz + " 🏃", ru: solo.ru + " 🏃", eng: solo.eng + " 🏃" },
        KLON:       { uz: "Ko'chirilgan rol g'alaba shartiga ega", ru: "Условие победы скопированной роли", eng: "Depends on copied role" },
        TASODIFCHI: { uz: "Berilgan rolga qarab o'zgaradi", ru: "Зависит от случайной роли", eng: "Depends on random role" },
    };

    if (wins[roleKey]) return wins[roleKey][lang] ?? wins[roleKey].eng;

    if (roleDef.team === TEAMS.MAFIA)
        return { uz: "Mafia fuqarolardan ko'p yoki teng bo'lsin 🔴", ru: "Мафия должна сравняться с городом 🔴", eng: "Mafia equals or outnumbers town 🔴" }[lang];
    if (roleDef.team === TEAMS.CIVIL)
        return { uz: "Barcha mafia a'zolarini chiqarish 🟢", ru: "Устранить всю мафию 🟢", eng: "Eliminate all mafia members 🟢" }[lang];
    if (roleDef.team === TEAMS.NEUTRAL)
        return { uz: "Jamoang g'alaba qilsin ⚪", ru: "Победа вашей команды ⚪", eng: "Your team wins ⚪" }[lang];

    return { uz: "Noma'lum", ru: "Неизвестно", eng: "Unknown" }[lang];
}

// ─── Command ──────────────────────────────────────────────────────────────────

module.exports = function start(bot) {

    bot.command("start", async (ctx) => {
        const chatId = String(ctx.chat.id);

        // ── Private chat ──────────────────────────────────────────────────────
        if (!chatId.startsWith("-100")) {
            await prisma.user.upsert({
                where:  { user_id: String(ctx.from.id) },
                update: { name: ctx.from.first_name ?? "" },
                create: { user_id: String(ctx.from.id), name: ctx.from.first_name ?? "" },
            });

            const lang = await getLang(ctx); // user's personal lang
            return ctx.replyWithMarkdown(
                `👋 ${t(lang, "welcome")}`,
                Markup.inlineKeyboard([
                    [Markup.button.callback(t(lang, "shop"),    "shop"),
                     Markup.button.callback(t(lang, "profile"), "profile")],
                    [Markup.button.url(t(lang, "enter_the_chat"), "https://t.me/AuthenticMafiaChat")],
                    [Markup.button.url(t(lang, "add_to_chanel"),  "https://t.me/AuthenticMafiaBot?startgroup=true")],
                ])
            );
        }

        // ── Group chat ────────────────────────────────────────────────────────
        const gameLang = await getLang(ctx); // group/game lang

        const game = await prisma.game.findFirst({
            where:   { chatId, NOT: { status: "FINISHED" } },
            orderBy: { id: "desc" },
            include: { players: true },
        });

        if (!game) {
            return ctx.reply(
                `🛑 ${t(gameLang, "game_not_found")}\n/create`,
                Markup.inlineKeyboard([
                    [Markup.button.url("🤖 Bot", "https://t.me/AuthenticMafiaBot?start=true")],
                ])
            );
        }

        if (game.status !== "LOBBY")
            return ctx.reply(t(gameLang, "already_started"));

        // Creator only
        if (!(await isAdmin(ctx)))
            return ctx.reply(t(gameLang, "creator_only"));

        // Min players check
        const playerCount = game.players.length;
        if (playerCount < MIN_PLAYERS)
            return ctx.reply(
                t(gameLang, "not_enough_players", { min: MIN_PLAYERS, count: playerCount }),
                { parse_mode: "Markdown" }
            );

        // Pre-start summary in group lang
        const playerList = game.players
            .map((p, i) => `${i + 1}. ${p.name || p.userTgId}`)
            .join("\n");

        const startingMsg = {
            uz:  `✅ *O'yin boshlanmoqda!*\n\n👥 O'yinchilar (${playerCount}):\n${playerList}\n\n🎭 Rollar taqsimlanmoqda...`,
            ru:  `✅ *Игра начинается!*\n\n👥 Игроки (${playerCount}):\n${playerList}\n\n🎭 Раздаём роли...`,
            eng: `✅ *Game is starting!*\n\n👥 Players (${playerCount}):\n${playerList}\n\n🎭 Assigning roles...`,
        }[gameLang] ?? `✅ *Game is starting!*\n\n${playerList}`;

        await ctx.replyWithMarkdown(startingMsg);

        await gameQueue.add(
            "startGame",
            { gameId: game.id, chatId: ctx.chat.id },
            { delay: 2_000 }
        );
    });

    // ── join_ callback ────────────────────────────────────────────────────────
    bot.action(/^join_(.+)$/, async (ctx) => {
        const gameId   = ctx.match[1];
        const userTgId = String(ctx.from.id);
        const chatId   = String(ctx.callbackQuery.message.chat.id);
        const userLang = await getLangByUserId(userTgId); // player's personal lang

        if (!(await isExist(ctx)))
            return ctx.answerCbQuery(t(userLang, "error_register"), { show_alert: true });

        const game = await prisma.game.findUnique({
            where:   { id: gameId },
            include: { _count: { select: { players: true } } },
        });

        if (!game)
            return ctx.answerCbQuery(t(userLang, "game_not_found"), { show_alert: true });
        if (game.status !== "LOBBY")
            return ctx.answerCbQuery(t(userLang, "already_started"), { show_alert: true });
        if (game._count.players >= 50)
            return ctx.answerCbQuery(t(userLang, "not_enough_players", { min: 50, count: 50 }), { show_alert: true });

        const name = [ctx.from.first_name, ctx.from.last_name]
            .filter(Boolean).join(" ").slice(0, 64);

        try {
            await prisma.player.create({ data: { userTgId, gameId, name } });
            await ctx.answerCbQuery(t(userLang, "player_joined", { name, count: game._count.players + 1 }));
        } catch {
            return ctx.answerCbQuery(t(userLang, "already_in_game"), { show_alert: true });
        }

        try {
            const { refreshLobby } = require("./create");
            await refreshLobby(bot, chatId, game);
        } catch {}
    });
};

// ─── Role DM sender ───────────────────────────────────────────────────────────

/**
 * sendRoleDMs(assignments, bot)
 * Each player gets their role card in THEIR OWN personal language.
 */
async function sendRoleDMs(assignments, telegramOrBot) {
    // Accepts either a sender object { sendMessage } or a Telegraf bot { telegram: { sendMessage } }
    const send = telegramOrBot?.sendMessage
        ? telegramOrBot.sendMessage.bind(telegramOrBot)
        : telegramOrBot?.telegram?.sendMessage.bind(telegramOrBot.telegram);

    for (const { userTgId, role, roleDef } of assignments) {
        try {
            const playerLang = await getLangByUserId(userTgId);
            const card = buildRoleCard(role, roleDef, playerLang);
            await send(userTgId, card, { parse_mode: "Markdown" });
        } catch {
            console.warn(`⚠️ Could not send role card to ${userTgId}`);
        }
    }
}

module.exports.sendRoleDMs   = sendRoleDMs;
module.exports.buildRoleCard = buildRoleCard;
/**
 * core/commands/rules.js
 *
 * /rules — shows game rules and role list.
 * Language follows user's personal lang.
 */

const { Markup } = require("telegraf");
const { getLang, t } = require("../i18n");

const ROLE_PAGES = {
    uz: [
        {
            label: "🔴 Mafia jamoasi",
            roles: [
                "🤵🏻 *Don* — Har tunda kimnidir o'ldiradi. Mafia yetakchisi.",
                "🤵🏼 *Mafia* — Donning yordamchisi. Birga o'ldiradi.",
                "🦇 *Ayg'oqchi* — Har tunda rol tekshiradi (Mafia uchun).",
                "👨🏻‍💼 *Advokat* — Mafia a'zosini tekshiruvdan himoya qiladi.",
                "🧷 *Bog'lovchi* — Ikki o'yinchini bog'laydi — biri o'lsa ikkinchisi ham.",
            ],
        },
        {
            label: "🟢 Shahar jamoasi",
            roles: [
                "🕵🏻‍♂ *Komissar* — Har tunda rol tekshiradi.",
                "👮🏻 *Serjant* — Komissar o'lsa uning o'rnini egallaydi.",
                "🧑🏻‍⚕ *Doktor* — Har tunda birovni davolaydi.",
                "🛡 *Qo'riqchi* — Doktor kabi davolaydi.",
                "💣 *Kamikaze* — O'ldirilganda, o'ldiruvchisini o'zi bilan oladi.",
                "🧑🏻‍⚖ *Sudya* — Bir marta lynchni bekor qiladi.",
                "🎖 *Janob* — Ovoz berishda ikki ovoz beradi.",
                "🧝🏻‍♂ *Elf* — Faqat Mafia yoki Solo o'yinchilarni o'ldira oladi.",
                "📿 *Ruhoniy* — Kimda o'ldirish qobiliyati borligini tekshiradi.",
                "🧑🏻 *Tinch aholi* — Maxsus qobiliyat yo'q.",
            ],
        },
        {
            label: "🟡 Solo o'yinchilar",
            roles: [
                "🔪 *Qotil* — Yolg'iz g'alaba qozinadi.",
                "🤦🏻 *Suid* — Lynchga tushib g'alaba qozinadi.",
                "🧛 *Qonxo'r* — Har 2 turda bir marta o'ldiradi.",
                "🧥 *Parazit* — O'ldirilsa, o'ldiruvchining roliga aylanadi.",
                "🪞 *Ko'zgu* — Hujum unga qaytadi.",
                "🧬 *Klon* — Boshqa rolni nusxalaydi.",
                "🏃🏻 *Sayohatchi* — Bir tunlik boshqa rolni oladi.",
                "🎲 *Tasodifchi* — Nishonga tasodifiy rol beradi.",
            ],
        },
        {
            label: "⚪ Neytral",
            roles: [
                "💃🏻 *Ma'shuqa* — Birovni bloklaydi.",
                "🤹🏻 *Aferist* — O'ziga keladigan ovozlarni boshqaga yo'naltiradi.",
                "☠️ *Qonli vasiyat* — O'limda birovni tanlaydi.",
                "🗂 *Nusxachi* — Bir marta rol nusxalaydi.",
            ],
        },
    ],
    ru: [
        {
            label: "🔴 Команда Мафии",
            roles: [
                "🤵🏻 *Дон* — Убивает каждую ночь. Лидер мафии.",
                "🤵🏼 *Мафия* — Помощник Дона. Убивает вместе.",
                "🦇 *Шпион* — Проверяет роль каждую ночь (для мафии).",
                "👨🏻‍💼 *Адвокат* — Защищает члена мафии от проверки.",
                "🧷 *Связной* — Связывает двух игроков — умрёт один, умрёт другой.",
            ],
        },
        {
            label: "🟢 Команда Города",
            roles: [
                "🕵🏻‍♂ *Комиссар* — Проверяет роль каждую ночь.",
                "👮🏻 *Сержант* — Заменяет Комиссара после его смерти.",
                "🧑🏻‍⚕ *Доктор* — Лечит одного игрока каждую ночь.",
                "🛡 *Охранник* — Лечит как Доктор.",
                "💣 *Камикадзе* — Убивает своего убийцу при смерти.",
                "🧑🏻‍⚖ *Судья* — Один раз отменяет линч.",
                "🎖 *Господин* — Два голоса во время голосования.",
                "🧝🏻‍♂ *Эльф* — Убивает только Мафию или Соло.",
                "📿 *Священник* — Проверяет наличие способности убивать.",
                "🧑🏻 *Мирный житель* — Нет особых способностей.",
            ],
        },
        {
            label: "🟡 Соло игроки",
            roles: [
                "🔪 *Убийца* — Побеждает в одиночку.",
                "🤦🏻 *Суид* — Побеждает будучи линчеванным.",
                "🧛 *Вампир* — Убивает раз в 2 хода.",
                "🧥 *Паразит* — При смерти становится ролью убийцы.",
                "🪞 *Зеркало* — Отражает атаку обратно.",
                "🧬 *Клон* — Копирует роль другого.",
                "🏃🏻 *Путешественник* — Берёт роль другого на одну ночь.",
                "🎲 *Случайщик* — Даёт случайную роль цели.",
            ],
        },
        {
            label: "⚪ Нейтральные",
            roles: [
                "💃🏻 *Куртизанка* — Блокирует игрока.",
                "🤹🏻 *Аферист* — Перенаправляет голоса на себя.",
                "☠️ *Завещание* — Выбирает кого забрать с собой.",
                "🗂 *Копировщик* — Один раз копирует роль.",
            ],
        },
    ],
    eng: [
        {
            label: "🔴 Mafia Team",
            roles: [
                "🤵🏻 *Don* — Kills each night. Mafia leader.",
                "🤵🏼 *Mafia* — Don's assistant. Kills together.",
                "🦇 *Spy* — Checks role each night (for mafia).",
                "👨🏻‍💼 *Lawyer* — Protects mafia member from investigation.",
                "🧷 *Linker* — Links two players — one dies, so does the other.",
            ],
        },
        {
            label: "🟢 Town Team",
            roles: [
                "🕵🏻‍♂ *Komissar* — Checks a player's role each night.",
                "👮🏻 *Sergeant* — Replaces Komissar after his death.",
                "🧑🏻‍⚕ *Doctor* — Heals one player each night.",
                "🛡 *Guard* — Heals like Doctor.",
                "💣 *Kamikaze* — Kills their killer on death.",
                "🧑🏻‍⚖ *Judge* — Cancels a lynch once.",
                "🎖 *Mayor* — Two votes during voting.",
                "🧝🏻‍♂ *Elf* — Can only kill Mafia or Solo players.",
                "📿 *Priest* — Checks if player has kill ability.",
                "🧑🏻 *Civilian* — No special ability.",
            ],
        },
        {
            label: "🟡 Solo Players",
            roles: [
                "🔪 *Killer* — Wins alone.",
                "🤦🏻 *Jester* — Wins by getting lynched.",
                "🧛 *Vampire* — Kills every 2 rounds.",
                "🧥 *Parasite* — Transforms into killer's role on death.",
                "🪞 *Mirror* — Reflects attacks back.",
                "🧬 *Clone* — Copies another player's role.",
                "🏃🏻 *Traveler* — Borrows a role for one night.",
                "🎲 *Randomizer* — Gives target a random role.",
            ],
        },
        {
            label: "⚪ Neutral",
            roles: [
                "💃🏻 *Courtesan* — Blocks a player.",
                "🤹🏻 *Swindler* — Redirects votes cast against them.",
                "☠️ *Last Will* — Chooses someone to take on death.",
                "🗂 *Copier* — Copies a role once.",
            ],
        },
    ],
};

module.exports = function rules(bot) {

    bot.command("rules", async (ctx) => {
        const lang  = await getLang(ctx);
        const pages = ROLE_PAGES[lang] ?? ROLE_PAGES.eng;

        // Send intro
        const intro = {
            uz:  "📖 *Mafia O'yini — Qoidalar*\n\nHar kecha mafia jamoasi o'ldiradi.\nHar kundi shahar ovoz berib lynchga yuboradi.\nG'alaba: Mafia shaharni kamaytirganda yoki shahar barcha mafiyani chiqarganda.",
            ru:  "📖 *Мафия — Правила*\n\nКаждую ночь мафия убивает.\nКаждый день город голосует за линч.\nПобеда: Мафия сравнивается с городом — или город устраняет всю мафию.",
            eng: "📖 *Mafia — Rules*\n\nEvery night mafia kills.\nEvery day town votes to lynch.\nWin: Mafia equals town — or town eliminates all mafia.",
        }[lang];

        await ctx.replyWithMarkdown(intro);

        // Send each team as a separate message
        for (const page of pages) {
            const text = `*${page.label}*\n\n${page.roles.join("\n")}`;
            await ctx.replyWithMarkdown(text);
        }
    });
};
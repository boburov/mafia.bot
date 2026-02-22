const { Markup } = require("telegraf");

function mention(userTgId, firstName) {
    const safeName = (firstName || "User").replace(/[<&>]/g, "");
    return `<a href="tg://user?id=${userTgId}">${safeName}</a>`;
}

function renderLobby(game, players) {
    const lines = players.length
        ? players.map((p, i) => `${i + 1}. ${mention(p.telegramId, p.firstName)}`) : ["Hali hech kim qo‘shilmadi 😴"];

    return `🎮 <b>Mafia Lobby</b>\nO'yin 60sekundan keyin boshlanadi\n\n👥 <b>Players (${players.length})</b>\n${lines.join("\n")}\n\n⬇️ Join tugmasini bosing:`;
}

function lobbyKeyboard(chatId) {
    return Markup.inlineKeyboard([
        [Markup.button.callback("➕ Qo‘shilish", `join_game`)],
        [Markup.button.url("🤖 Botni ochish", `https://t.me/Intela_bot`)],
    ]);
}

module.exports = { mention, renderLobby, lobbyKeyboard }
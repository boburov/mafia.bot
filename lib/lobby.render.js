const { Markup } = require("telegraf");
const t = require("../middleware/language.changer");

function mention(userTgId, firstName) {
    const safeName = (firstName || "User").replace(/[<&>]/g, "");
    return `<a href="tg://user?id=${userTgId}">${safeName}</a>`;
}

function renderLobby(game, players) {
    const lang = game.creatorLang || "eng";
    const lines = players.length
        ? players.map((p, i) => `${i + 1}. ${mention(p.telegramId, p.firstName)}`) 
        : [t(lang, "game.lobby.no_players")];

    return `🎮 <b>Mafia Lobby</b>\n${t(lang, "game.lobby.will_start")}\n\n${t(lang, "game.lobby.players_count", { count: players.length })}\n${lines.join("\n")}`;
}

function lobbyKeyboard(chatId, lang = "eng") {
    return Markup.inlineKeyboard([
        [Markup.button.callback(t(lang, "game.lobby.join"), `join_game`)],
        [Markup.button.url(t(lang, "common.open_bot"), `https://t.me/Intela_bot`)],
    ]);
}

module.exports = { mention, renderLobby, lobbyKeyboard }
const change_lang = require("./core/commands/change.lang");
const start = require("./core/commands/start");

function bot_runner(bot) {

    // command start 
    start(bot)

    // language
    change_lang(bot)
}

module.exports = bot_runner
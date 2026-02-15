const change_lang = require("./core/commands/change.lang");
const help = require("./core/commands/help");
const start = require("./core/commands/start");

function bot_runner(bot) {

    // command start 
    start(bot)

    // language
    change_lang(bot)

    // help
    help(bot)
}

module.exports = bot_runner
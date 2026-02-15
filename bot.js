const change_lang = require("./core/commands/change.lang");
const start = require("./core/commands/start");

function bot_runner(bot, def_lang) {
    // command start 
    start(bot, def_lang)


    // language
    change_lang(bot, def_lang)
}

module.exports = bot_runner
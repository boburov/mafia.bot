const change_lang = require("./core/commands/change.lang");
const help = require("./core/commands/help");
const start = require("./core/commands/start");
const create_game = require("./core/main/main")
const profileCommand = require("./core/main/profile")

function bot_runner(bot) {

    // command start 
    start(bot)

    // language
    change_lang(bot)

    // help
    help(bot)

    // create game
    create_game(bot)

    // user profile
    profileCommand(bot)
}

module.exports = bot_runner
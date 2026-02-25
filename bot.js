const start = require("./core/commands/start");
const profile = require("./core/middleware/profile");

function bot_runner(bot) {

  // -------start command----------//
  start(bot)

  // user's profile section
  profile(bot)

}

module.exports = bot_runner;

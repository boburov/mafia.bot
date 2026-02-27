const cancel = require("./core/commands/cancel");
const create = require("./core/commands/create");
const start = require("./core/commands/start");
const profile = require("./core/middleware/profile");

function bot_runner(bot) {

  // -------start command----------//
  start(bot)

  // user's profile section
  profile(bot)

  //------ create game -------
  create(bot)

  // ----- cancel game -------
  cancel(bot)
}

module.exports = bot_runner;

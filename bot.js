// bot.js — registers all command and callback handlers
"use strict";

const all_roles = require("./core/commands/all_roles");
const change_lang = require("./core/commands/change.lang");
const help = require("./core/commands/help");
const start = require("./core/commands/start");
const create_game = require("./core/main/main");
const profileCommand = require("./core/main/profile");

function bot_runner(bot) {
  // /start — registration + main menu
  start(bot);

  // /lang — language selection
  change_lang(bot);

  // /help
  help(bot);

  // /create, join_game callback
  create_game(bot);

  // /profile
  profileCommand(bot);

  // all_roles info
  all_roles(bot);

}

module.exports = bot_runner;

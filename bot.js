const cancel            = require("./core/commands/cancel");
const create            = require("./core/commands/create");
const start             = require("./core/commands/start");
const stop              = require("./core/commands/stop");
const lang              = require("./core/commands/lang");
const profile           = require("./core/middleware/profile");
const registerCallbacks = require("./handlers/callback");
const { registerVasiyatCallback } = require("./handlers/role.workers");

function bot_runner(bot) {
    start(bot)                    // /start + join_ lobby callbacks
    lang(bot)                     // /lang + setlang_ callbacks
    profile(bot)                  // /profile, shop, equip
    create(bot)                   // /create + join_ + leave_ lobby
    cancel(bot)                   // /cancel
    stop(bot)                     // /stop
    registerCallbacks(bot)        // night_ and vote_ inline handlers
    registerVasiyatCallback(bot)  // vasiyat_ passive death handler
}

module.exports = bot_runner;
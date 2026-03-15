const cancel            = require("./core/commands/cancel");
const create            = require("./core/commands/create");
const start             = require("./core/commands/start");
const stop              = require("./core/commands/stop");
const lang              = require("./core/commands/lang");
const rules             = require("./core/commands/rules");
const profile           = require("./core/middleware/profile");
const registerCallbacks = require("./handlers/callbacks");
const { registerVasiyatCallback } = require("./handlers/role.workers");

function bot_runner(bot) {
    start(bot)
    lang(bot)
    rules(bot)
    profile(bot)
    create(bot)
    cancel(bot)
    stop(bot)
    registerCallbacks(bot)       // night_, vote_, sudya_cancel_, mafia relay
    registerVasiyatCallback(bot) // vasiyat_ passive
}

module.exports = bot_runner;
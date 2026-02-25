module.exports = function start(bot) {
    bot.command("start", async ctx => {
        ctx.reply("hi")
    })
}
const rolesKeyboard2Cols = require("../../store/role.slice")
const t = require("../../middleware/language.changer");
const { ROLES } = require("../../store/roles");

module.exports = function all_roles(bot) {
    bot.action("all_roles", async ctx => {
        const lang = String(ctx.state?.lang || "eng").trim();

        ctx.reply(t(lang, "roles"), rolesKeyboard2Cols(lang))
    })

    bot.action(/^role:(.+)$/, async (ctx) => {
        const lang = String(ctx.state?.lang || "eng").trim();
        const roleKey = ctx.match[1];

        const role = ROLES[roleKey];
        if (!role) return ctx.answerCbQuery("Role not found");

        await ctx.answerCbQuery();
        await ctx.reply(`${role.emoji} ${role.i18n.name[lang]}\n\n${role.i18n.description[lang]}`);
    });

}
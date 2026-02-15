const { prisma } = require("../config/db");

function botMiddlewar(bot) {
    bot.use(async (ctx, next) => {
        const userId = String(ctx?.from?.id ?? "");
        if (!userId) return next();

        const user = await prisma.user.findUnique({
            where: { user_id: userId },
        });

        ctx.state.lang = user?.lang || "eng";

        return next();
    });
}

module.exports = botMiddlewar
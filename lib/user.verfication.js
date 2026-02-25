const { prisma } = require("../config/db");

const isExist = async (ctx) => {
    try {
        const user = await prisma.user.findFirst({
            where: {
                user_id: String(ctx.from
                    .id)
            }
        })

        return user ? true : false
    } catch (error) {
        console.error('Error checking admin status:', error);
        return false;
    }
};

module.exports = isExist
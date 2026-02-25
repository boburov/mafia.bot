const isAdmin = async (ctx) => {
    try {
        const member = await ctx.telegram.getChatMember(ctx.chat.id, ctx.from.id);

        return member.status === 'administrator' || member.status === 'creator';
    } catch (error) {
        console.error('Error checking admin status:', error);
        return false;
    }
};

module.exports = isAdmin
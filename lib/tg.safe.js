function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

function isRetryableTelegramError(err) {
    const code = err?.code;
    const desc = err?.response?.description || err?.message || "";

    // network / fetch
    if (code === "ETIMEDOUT" || code === "ECONNRESET" || code === "EAI_AGAIN") return true;

    // Telegram side temporary (sometimes)
    if (desc.includes("Too Many Requests")) return true;
    if (desc.includes("Internal Server Error")) return true;

    return false;
}

/**
 * safeSend(bot.telegram.sendMessage, ...) with retry/backoff
 */
async function safeSendMessage(bot, chatId, text, extra = {}, tries = 4) {
    let lastErr;

    for (let i = 0; i < tries; i++) {
        try {
            return await bot.telegram.sendMessage(chatId, text, extra);
        } catch (err) {
            lastErr = err;

            // non-retryable like 403: bot blocked / user never started bot
            const desc = err?.response?.description || "";
            if (desc.includes("bot was blocked by the user")) break;
            if (desc.includes("user is deactivated")) break;
            if (desc.includes("chat not found")) break;

            if (!isRetryableTelegramError(err)) break;

            // exponential backoff: 1s, 2s, 4s, 8s
            await sleep(1000 * (2 ** i));
        }
    }

    throw lastErr;
}

module.exports = { safeSendMessage };
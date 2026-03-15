/**
 * handlers/sender.js
 *
 * Thin wrapper around the raw Telegram Bot API.
 * Used by workers to send messages WITHOUT creating a Telegraf instance.
 * No polling, no webhooks — pure HTTP POST calls only.
 *
 * This eliminates the 409 conflict completely because we never
 * create a second Telegraf instance anywhere.
 */

require("dotenv").config();
const https = require("https");

const TOKEN = process.env.BOT_TOKEN;
const BASE  = `https://api.telegram.org/bot${TOKEN}`;

// ─── Core HTTP helper ─────────────────────────────────────────────────────────

function apiCall(method, body) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify(body);
        const req  = https.request(
            `${BASE}/${method}`,
            {
                method:  "POST",
                headers: {
                    "Content-Type":   "application/json",
                    "Content-Length": Buffer.byteLength(data),
                },
            },
            (res) => {
                let raw = "";
                res.on("data", chunk => raw += chunk);
                res.on("end", () => {
                    try {
                        const parsed = JSON.parse(raw);
                        if (parsed.ok) resolve(parsed.result);
                        else reject(new Error(`TG API error: ${parsed.description}`));
                    } catch (e) {
                        reject(e);
                    }
                });
            }
        );
        req.on("error", reject);
        req.write(data);
        req.end();
    });
}

// ─── Send helpers ─────────────────────────────────────────────────────────────

/**
 * sendMessage(chatId, text, extra?)
 * extra: { parse_mode, reply_markup, ... }
 */
function sendMessage(chatId, text, extra = {}) {
    return apiCall("sendMessage", { chat_id: chatId, text, ...extra });
}

/**
 * sendPhoto(chatId, photoPath, caption, extra?)
 * Sends a local file using multipart form — uses node's built-in http + FormData polyfill
 */
async function sendPhoto(chatId, photoPath, caption, extra = {}) {
    // Use form-data package if available, otherwise fall back to sendMessage
    try {
        const FormData = require("form-data");
        const fs       = require("fs");
        const form     = new FormData();

        form.append("chat_id",    String(chatId));
        form.append("caption",    caption ?? "");
        form.append("parse_mode", extra.parse_mode ?? "Markdown");
        form.append("photo",      fs.createReadStream(photoPath));

        if (extra.reply_markup) {
            form.append("reply_markup", JSON.stringify(extra.reply_markup));
        }

        return await new Promise((resolve, reject) => {
            form.submit(`${BASE}/sendPhoto`, (err, res) => {
                if (err) return reject(err);
                let raw = "";
                res.on("data", c => raw += c);
                res.on("end",  () => {
                    const p = JSON.parse(raw);
                    p.ok ? resolve(p.result) : reject(new Error(p.description));
                });
            });
        });
    } catch {
        // form-data not installed — fall back to text only
        return sendMessage(chatId, caption ?? "", { parse_mode: "Markdown", ...extra });
    }
}

/**
 * editMessageText(chatId, messageId, text, extra?)
 */
function editMessageText(chatId, messageId, text, extra = {}) {
    return apiCall("editMessageText", {
        chat_id:    chatId,
        message_id: messageId,
        text,
        ...extra,
    }).catch(() => {}); // ignore "message not modified" errors
}

/**
 * answerCallbackQuery(callbackQueryId, text, showAlert?)
 */
function answerCallbackQuery(callbackQueryId, text = "", showAlert = false) {
    return apiCall("answerCallbackQuery", {
        callback_query_id: callbackQueryId,
        text,
        show_alert: showAlert,
    }).catch(() => {});
}

// ─── Export as telegram-like interface ───────────────────────────────────────
// This matches the bot.telegram.* interface so callers need minimal changes

const telegram = {
    sendMessage,
    sendPhoto,
    editMessageText,
    answerCallbackQuery,
};

module.exports = { telegram, sendMessage, sendPhoto, editMessageText };
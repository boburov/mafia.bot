// core/main/main.js
// /create command, join_game callback, and /leave (delegated to handlers.js).
"use strict";

const { Markup } = require("telegraf");
const { prisma } = require("../../config/db");
const t = require("../../middleware/language.changer");
const { scheduleJob } = require("../../queue/queue");

module.exports = function create_game(bot) {
  // ── /create ──────────────────────────────────────────────────────────────
  bot.command("create", async (ctx) => {

  });

  // ── join_game callback ────────────────────────────────────────────────────
  bot.action(/^join_game:(.+)$/, async (ctx) => {

  });
};

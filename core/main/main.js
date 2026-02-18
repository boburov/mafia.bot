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
    try {
      const chatId = String(ctx.chat.id);
      const telegramId = String(ctx.from.id);
      const lang = String(ctx.state?.lang || "eng").trim();

      const isGroup =
        ctx.chat?.type === "group" ||
        ctx.chat?.type === "supergroup" ||
        chatId.startsWith("-100");

      if (!isGroup) {
        return ctx.reply(
          "This game can only be played in a group chat.",
          Markup.inlineKeyboard([
            [
              Markup.button.url(
                t(lang, "add_to_chanel"),
                "https://t.me/AuthenticMafiaBot?startgroup=mafia",
              ),
            ],
          ]),
        );
      }

      // Check for existing active game
      let game = await prisma.game.findUnique({ where: { chat_id: chatId } });

      if (game && (game.status === "LOBBY" || game.status === "RUNNING")) {
        return ctx.reply(t(lang, "already_started"));
      }

      // Create or reset game
      game = await prisma.game.upsert({
        where: { chat_id: chatId },
        update: {
          status: "LOBBY",
          phase: "DAY",
          dayNumber: 0,
          nightNumber: 0,
          startedAt: null,
          endedAt: null,
          lastTransitionAt: null,
          winnerTeam: null,
          creatorTelegramId: telegramId,
        },
        create: {
          chat_id: chatId,
          status: "LOBBY",
          phase: "DAY",
          creatorTelegramId: telegramId,
        },
      });

      // Delete old players from previous game in this chat
      await prisma.gamePlayer.deleteMany({ where: { gameId: game.id } });

      // Schedule lobby-start job (60s) — deduped so restart won't double-schedule
      await scheduleJob(
        "lobby-start",
        { gameId: game.id, chatId },
        60_000,
        `game:${game.id}:lobby`,
      );

      return ctx.reply(
        t(lang, "game_will_start"),
        Markup.inlineKeyboard([
          [Markup.button.callback(t(lang, "join"), `join_game:${game.id}`)],
          [
            Markup.button.callback(
              t(lang, "start_now"),
              `start_now:${game.id}`,
            ),
          ],
        ]),
      );
    } catch (error) {
      console.error("[create] error:", error);
      return ctx.reply("Please /start the bot first.");
    }
  });

  // ── join_game callback ────────────────────────────────────────────────────
  bot.action(/^join_game:(.+)$/, async (ctx) => {
    // Answer immediately — avoid Telegram callback timeout
    await ctx.answerCbQuery().catch(() => {});

    const lang = String(ctx.state?.lang || "eng").trim();

    try {
      const gameId = ctx.match[1];
      const telegramId = String(ctx.from.id);
      const chatId = String(ctx.chat.id);

      // Ensure user is registered
      const user = await prisma.user.findUnique({
        where: { user_id: telegramId },
      });
      if (!user) {
        return ctx.reply(
          t(lang, "error_register"),
          Markup.inlineKeyboard([
            [Markup.button.url("Open bot", "https://t.me/AuthenticMafiaBot")],
          ]),
        );
      }

      // Validate game belongs to this chat and is still in LOBBY
      const game = await prisma.game.findUnique({ where: { id: gameId } });
      if (!game || game.chat_id !== chatId) {
        return ctx.reply(t(lang, "game_not_found"));
      }
      if (game.status !== "LOBBY") {
        return ctx.reply(t(lang, "already_started"));
      }

      // Add player (@@unique prevents duplicates)
      await prisma.gamePlayer.create({
        data: {
          gameId,
          userId: user.id,
          telegramId,
          role: null,
          isAlive: true,
        },
      });

      const count = await prisma.gamePlayer.count({ where: { gameId } });
      const name = ctx.from.first_name || ctx.from.username || telegramId;

      return ctx.reply(t(lang, "player_joined", { name, count }));
    } catch (error) {
      if (String(error?.code) === "P2002") {
        return ctx.reply(t(lang, "already_in_game"));
      }
      console.error("[join_game] error:", error);
      return ctx.reply(
        t(lang, "error_register"),
        Markup.inlineKeyboard([
          [Markup.button.url("Open bot", "https://t.me/AuthenticMafiaBot")],
        ]),
      );
    }
  });
};

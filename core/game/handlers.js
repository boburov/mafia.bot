// core/game/handlers.js
// All Telegraf callback_query handlers for game actions (night actions + voting).
// Register this in bot.js.
"use strict";

const { prisma } = require("../../config/db");
const t = require("../../middleware/language.changer");
const { recordAction, allActionsSubmitted } = require("./night.collector");
const { resolveNight } = require("./night.resolver");
const { castVote, resolveVote } = require("./vote.service");
const { checkAndEnd } = require("./win.checker");
const { safeTransition, resetNightFlags } = require("./state.service");
const { scheduleJob, cancelJob } = require("../../queue/queue");

/**
 * Get user lang from DB.
 */
async function getUserLang(telegramId) {
  const user = await prisma.user.findUnique({
    where: { user_id: String(telegramId) },
  });
  return user?.lang || "eng";
}

/**
 * Get GamePlayer by telegramId within a game.
 */
async function getPlayerByTelegramId(gameId, telegramId) {
  return prisma.gamePlayer.findFirst({
    where: { gameId, telegramId: String(telegramId) },
  });
}

/**
 * Register all game-related callback handlers on the bot.
 * @param {import('telegraf').Telegraf} bot
 */
function registerGameHandlers(bot) {
  // ── Night: Kill (Don selects kill target) ──────────────────────────────────
  bot.action(/^night_kill:(.+)$/, async (ctx) => {
    // Answer immediately to avoid Telegram timeout
    await ctx.answerCbQuery().catch(() => {});

    const targetPlayerId = ctx.match[1];
    const telegramId = String(ctx.from.id);
    const lang = await getUserLang(telegramId);

    try {
      // Find the game this player is in (via PM — no chat_id context)
      const actorPlayer = await prisma.gamePlayer.findFirst({
        where: { telegramId, role: "DON", isAlive: true },
        include: { game: true },
      });

      if (
        !actorPlayer ||
        actorPlayer.game.status !== "RUNNING" ||
        actorPlayer.game.phase !== "NIGHT"
      ) {
        return ctx.reply(t(lang, "error")).catch(() => {});
      }

      const ok = await recordAction(
        actorPlayer.gameId,
        actorPlayer.id,
        targetPlayerId,
        "KILL",
        actorPlayer.game.nightNumber,
      );

      if (ok === false) {
        return ctx.reply(t(lang, "action_already_done")).catch(() => {});
      }

      await ctx.reply(t(lang, "action_recorded")).catch(() => {});

      // Check if all actions submitted → early resolve
      await maybeEarlyResolveNight(
        actorPlayer.gameId,
        actorPlayer.game.chat_id,
        actorPlayer.game.nightNumber,
        bot,
      );
    } catch (e) {
      console.error("[handlers] night_kill error:", e.message);
    }
  });

  // ── Night: Heal (Doctor selects heal target) ───────────────────────────────
  bot.action(/^night_heal:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});

    const targetPlayerId = ctx.match[1];
    const telegramId = String(ctx.from.id);
    const lang = await getUserLang(telegramId);

    try {
      const actorPlayer = await prisma.gamePlayer.findFirst({
        where: { telegramId, role: "DOCTOR", isAlive: true },
        include: { game: true },
      });

      if (
        !actorPlayer ||
        actorPlayer.game.status !== "RUNNING" ||
        actorPlayer.game.phase !== "NIGHT"
      ) {
        return ctx.reply(t(lang, "error")).catch(() => {});
      }

      const ok = await recordAction(
        actorPlayer.gameId,
        actorPlayer.id,
        targetPlayerId,
        "HEAL",
        actorPlayer.game.nightNumber,
      );

      if (ok === false) {
        return ctx.reply(t(lang, "action_already_done")).catch(() => {});
      }

      await ctx.reply(t(lang, "action_recorded")).catch(() => {});
      await maybeEarlyResolveNight(
        actorPlayer.gameId,
        actorPlayer.game.chat_id,
        actorPlayer.game.nightNumber,
        bot,
      );
    } catch (e) {
      console.error("[handlers] night_heal error:", e.message);
    }
  });

  // ── Night: Check (Commissar investigates a player) ─────────────────────────
  bot.action(/^night_check:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});

    const targetPlayerId = ctx.match[1];
    const telegramId = String(ctx.from.id);
    const lang = await getUserLang(telegramId);

    try {
      const actorPlayer = await prisma.gamePlayer.findFirst({
        where: { telegramId, role: "COMMISSAR", isAlive: true },
        include: { game: true },
      });

      if (
        !actorPlayer ||
        actorPlayer.game.status !== "RUNNING" ||
        actorPlayer.game.phase !== "NIGHT"
      ) {
        return ctx.reply(t(lang, "error")).catch(() => {});
      }

      const ok = await recordAction(
        actorPlayer.gameId,
        actorPlayer.id,
        targetPlayerId,
        "CHECK_ROLE",
        actorPlayer.game.nightNumber,
      );

      if (ok === false) {
        return ctx.reply(t(lang, "action_already_done")).catch(() => {});
      }

      await ctx.reply(t(lang, "action_recorded")).catch(() => {});
      await maybeEarlyResolveNight(
        actorPlayer.gameId,
        actorPlayer.game.chat_id,
        actorPlayer.game.nightNumber,
        bot,
      );
    } catch (e) {
      console.error("[handlers] night_check error:", e.message);
    }
  });

  // ── Vote: Player casts a vote ──────────────────────────────────────────────
  // Callback data: vote:{targetPlayerId}:{isRevote 0|1}
  bot.action(/^vote:([^:]+):([01])$/, async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});

    const targetPlayerId = ctx.match[1];
    const isRevote = ctx.match[2] === "1";
    const telegramId = String(ctx.from.id);
    const lang = await getUserLang(telegramId);

    try {
      // Find voter's GamePlayer (must be in a RUNNING VOTING game)
      const voterPlayer = await prisma.gamePlayer.findFirst({
        where: { telegramId, isAlive: true },
        include: { game: true },
      });

      if (
        !voterPlayer ||
        voterPlayer.game.status !== "RUNNING" ||
        voterPlayer.game.phase !== "VOTING"
      ) {
        return ctx
          .answerCbQuery(t(lang, "error"), { show_alert: true })
          .catch(() => {});
      }

      const result = await castVote(
        voterPlayer.gameId,
        voterPlayer.id,
        targetPlayerId,
        voterPlayer.game.dayNumber,
        isRevote,
      );

      if (result === "already_voted") {
        return ctx
          .answerCbQuery(t(lang, "action_already_done"), { show_alert: true })
          .catch(() => {});
      }

      if (result === "invalid_target") {
        return ctx
          .answerCbQuery(t(lang, "invalid_target"), { show_alert: true })
          .catch(() => {});
      }

      // Announce vote in group
      let voterName = telegramId;
      let targetName = targetPlayerId;
      try {
        const voterMember = await bot.telegram.getChatMember(
          voterPlayer.game.chat_id,
          telegramId,
        );
        voterName =
          voterMember?.user?.first_name ||
          voterMember?.user?.username ||
          telegramId;

        const targetPlayer = await prisma.gamePlayer.findUnique({
          where: { id: targetPlayerId },
        });
        if (targetPlayer) {
          const targetMember = await bot.telegram.getChatMember(
            voterPlayer.game.chat_id,
            targetPlayer.telegramId,
          );
          targetName =
            targetMember?.user?.first_name ||
            targetMember?.user?.username ||
            targetPlayer.telegramId;
        }
      } catch {}

      try {
        await bot.telegram.sendMessage(
          voterPlayer.game.chat_id,
          t(lang, "vote_cast", { voter: voterName, target: targetName }),
        );
      } catch {}

      // Check if all alive players have voted → early resolve
      await maybeEarlyResolveVote(
        voterPlayer.gameId,
        voterPlayer.game.chat_id,
        voterPlayer.game.dayNumber,
        isRevote,
        bot,
      );
    } catch (e) {
      console.error("[handlers] vote error:", e.message);
    }
  });

  // ── Start Now: Creator starts game early ───────────────────────────────────
  // Callback data: start_now:{gameId}
  bot.action(/^start_now:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});

    const gameId = ctx.match[1];
    const telegramId = String(ctx.from.id);
    const lang = await getUserLang(telegramId);

    try {
      const game = await prisma.game.findUnique({
        where: { id: gameId },
        include: { players: true },
      });

      if (!game) return ctx.reply(t(lang, "game_not_found")).catch(() => {});
      if (game.status !== "LOBBY")
        return ctx.reply(t(lang, "already_started")).catch(() => {});
      if (game.creatorTelegramId !== telegramId) return; // only creator

      if (game.players.length < 8) {
        return ctx
          .reply(t(lang, "not_enough_players", { count: game.players.length }))
          .catch(() => {});
      }

      // Cancel the pending lobby-start job and fire immediately
      await cancelJob(`game:${gameId}:lobby`);

      // Trigger lobby-start logic directly via queue (0 delay)
      const { scheduleJob } = require("../../queue/queue");
      await scheduleJob(
        "lobby-start",
        { gameId, chatId: game.chat_id },
        0,
        `game:${gameId}:lobby:now:${Date.now()}`,
      );
    } catch (e) {
      console.error("[handlers] start_now error:", e.message);
    }
  });

  // ── Leave Game (lobby only) ────────────────────────────────────────────────
  bot.command("leave", async (ctx) => {
    const telegramId = String(ctx.from.id);
    const chatId = String(ctx.chat.id);
    const lang = await getUserLang(telegramId);

    try {
      const game = await prisma.game.findUnique({ where: { chat_id: chatId } });
      if (!game) return;

      if (game.status === "RUNNING") {
        return ctx.reply(t(lang, "cannot_leave_running"));
      }

      if (game.status !== "LOBBY") return;

      const user = await prisma.user.findUnique({
        where: { user_id: telegramId },
      });
      if (!user) return;

      await prisma.gamePlayer.deleteMany({
        where: { gameId: game.id, userId: user.id },
      });

      const remaining = await prisma.gamePlayer.count({
        where: { gameId: game.id },
      });
      const name = ctx.from.first_name || ctx.from.username || telegramId;

      await ctx.reply(t(lang, "player_left", { name }));
      await ctx.reply(t(lang, "players_count", { count: remaining }));
    } catch (e) {
      console.error("[handlers] leave error:", e.message);
    }
  });
}

// ─── Internal Helpers ─────────────────────────────────────────────────────────

/**
 * If all active-role players have submitted their night action, resolve night early.
 */
async function maybeEarlyResolveNight(gameId, chatId, nightNumber, bot) {
  try {
    const { allActionsSubmitted } = require("./night.collector");
    const allDone = await allActionsSubmitted(gameId, nightNumber);
    if (!allDone) return;

    const { safeTransition, resetNightFlags } = require("./state.service");
    const { resolveNight } = require("./night.resolver");
    const { checkAndEnd } = require("./win.checker");
    const { openNightActions } = require("./night.collector");
    const { scheduleJob, cancelJob } = require("../../queue/queue");
    const t = require("../../middleware/language.changer");

    // Cancel the pending night-timeout job
    await cancelJob(`game:${gameId}:night:${nightNumber}`);

    const transitioned = await safeTransition(gameId, "NIGHT", "DAY", {
      dayNumber: nightNumber,
    });
    if (!transitioned) return;

    await resolveNight(gameId, bot);

    const winner = await checkAndEnd(gameId, bot);
    if (winner) return;

    const lang = "eng";
    await bot.telegram
      .sendMessage(
        chatId,
        t(lang, "day_started", { number: nightNumber, seconds: 90 }),
      )
      .catch(() => {});

    await scheduleJob(
      "day-timeout",
      { gameId, chatId, dayNumber: nightNumber },
      90_000,
      `game:${gameId}:day:${nightNumber}`,
    );
  } catch (e) {
    console.error("[handlers] maybeEarlyResolveNight error:", e.message);
  }
}

/**
 * If all alive players have voted, resolve vote early.
 */
async function maybeEarlyResolveVote(gameId, chatId, dayNumber, isRevote, bot) {
  try {
    const alivePlayers = await prisma.gamePlayer.findMany({
      where: { gameId, isAlive: true },
    });
    const allVoted = alivePlayers.every((p) => p.hasVoted);
    if (!allVoted) return;

    const { cancelJob, scheduleJob } = require("../../queue/queue");
    const { resolveVote } = require("./vote.service");
    const { checkAndEnd } = require("./win.checker");
    const { safeTransition, resetNightFlags } = require("./state.service");
    const { openNightActions } = require("./night.collector");
    const t = require("../../middleware/language.changer");

    const revoteFlag = isRevote ? "1" : "0";
    await cancelJob(`game:${gameId}:vote:${dayNumber}:${revoteFlag}`);

    const result = await resolveVote(gameId, chatId, bot, dayNumber, isRevote);

    if (result.revoting) {
      await scheduleJob(
        "vote-timeout",
        { gameId, chatId, dayNumber, isRevote: true },
        45_000,
        `game:${gameId}:vote:${dayNumber}:1`,
      );
      return;
    }

    const winner = await checkAndEnd(gameId, bot);
    if (winner) return;

    const nextNight = dayNumber + 1;
    const transitioned = await safeTransition(gameId, "VOTING", "NIGHT", {
      nightNumber: nextNight,
    });
    if (!transitioned) return;

    await resetNightFlags(gameId);

    const lang = "eng";
    await bot.telegram
      .sendMessage(chatId, t(lang, "night_started", { number: nextNight }))
      .catch(() => {});
    await openNightActions(gameId, bot);
    await scheduleJob(
      "night-timeout",
      { gameId, chatId, nightNumber: nextNight },
      45_000,
      `game:${gameId}:night:${nextNight}`,
    );
  } catch (e) {
    console.error("[handlers] maybeEarlyResolveVote error:", e.message);
  }
}

module.exports = { registerGameHandlers };

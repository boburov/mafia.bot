// core/game/vote.service.js
// Opens group vote, collects votes, resolves lynch with tie/revote logic.
"use strict";

const { Markup } = require("telegraf");
const { prisma } = require("../../config/db");
const t = require("../../middleware/language.changer");
const { writeLog, resetVoteFlags } = require("./state.service");

/**
 * Get group lang (first player's lang).
 */
async function getGroupLang(gameId) {
  const player = await prisma.gamePlayer.findFirst({ where: { gameId } });
  if (!player) return "eng";
  const user = await prisma.user.findUnique({ where: { id: player.userId } });
  return user?.lang || "eng";
}

/**
 * Get display name for a player from Telegram.
 */
async function getDisplayName(bot, chatId, telegramId) {
  try {
    const member = await bot.telegram.getChatMember(chatId, telegramId);
    return (
      member?.user?.first_name || member?.user?.username || String(telegramId)
    );
  } catch {
    return String(telegramId);
  }
}

/**
 * Open a vote in the group chat.
 * Sends an inline keyboard with all alive players as vote targets.
 * Button data: `vote:{targetPlayerId}:{isRevote}`
 */
async function openVote(gameId, chatId, bot, isRevote = false) {
  const lang = await getGroupLang(gameId);

  const alivePlayers = await prisma.gamePlayer.findMany({
    where: { gameId, isAlive: true },
  });

  if (alivePlayers.length === 0) return;

  // Build buttons: one per alive player
  const rows = [];
  for (const p of alivePlayers) {
    const name = await getDisplayName(bot, chatId, p.telegramId);
    const revoteFlag = isRevote ? "1" : "0";
    rows.push([Markup.button.callback(name, `vote:${p.id}:${revoteFlag}`)]);
  }

  const msgKey = isRevote ? "vote_revote" : "vote_started";
  try {
    await bot.telegram.sendMessage(
      chatId,
      t(lang, msgKey),
      Markup.inlineKeyboard(rows),
    );
  } catch (e) {
    console.error("[vote.service] openVote failed:", e.message);
  }

  // Reset vote flags
  await resetVoteFlags(gameId);
}

/**
 * Record a vote from a player.
 * Returns "ok" | "already_voted" | "invalid_target"
 */
async function castVote(
  gameId,
  voterPlayerId,
  targetPlayerId,
  dayNumber,
  isRevote = false,
) {
  // Check voter is alive
  const voter = await prisma.gamePlayer.findUnique({
    where: { id: voterPlayerId },
  });
  if (!voter || !voter.isAlive) return "invalid_target";

  // Check target is alive
  const target = await prisma.gamePlayer.findUnique({
    where: { id: targetPlayerId },
  });
  if (!target || !target.isAlive) return "invalid_target";

  // Check already voted this round
  const existing = await prisma.gameVote.findUnique({
    where: {
      gameId_voterPlayerId_dayNumber_isRevote: {
        gameId,
        voterPlayerId,
        dayNumber,
        isRevote,
      },
    },
  });
  if (existing) return "already_voted";

  await prisma.gameVote.create({
    data: { gameId, voterPlayerId, targetPlayerId, dayNumber, isRevote },
  });

  // Mark voter as having voted
  await prisma.gamePlayer.update({
    where: { id: voterPlayerId },
    data: { hasVoted: true },
  });

  return "ok";
}

/**
 * Tally votes for the current day.
 * Returns { winner: GamePlayer|null, isTie: boolean, topCount: number }
 */
async function tallyVotes(gameId, dayNumber, isRevote = false) {
  const votes = await prisma.gameVote.findMany({
    where: { gameId, dayNumber, isRevote },
  });

  const counts = {};
  for (const v of votes) {
    counts[v.targetPlayerId] = (counts[v.targetPlayerId] || 0) + 1;
  }

  if (Object.keys(counts).length === 0) {
    return { winner: null, isTie: false, topCount: 0 };
  }

  const maxCount = Math.max(...Object.values(counts));
  const topTargets = Object.keys(counts).filter(
    (id) => counts[id] === maxCount,
  );

  if (topTargets.length > 1) {
    return { winner: null, isTie: true, topCount: maxCount };
  }

  const winner = await prisma.gamePlayer.findUnique({
    where: { id: topTargets[0] },
  });
  return { winner, isTie: false, topCount: maxCount };
}

/**
 * Resolve the vote phase:
 * - Tally votes
 * - If tie and not revote → open revote
 * - If tie and revote → no lynch
 * - If winner → lynch
 *
 * Returns { lynched: GamePlayer|null, noLynch: boolean }
 */
async function resolveVote(gameId, chatId, bot, dayNumber, isRevote = false) {
  const lang = await getGroupLang(gameId);
  const { winner, isTie } = await tallyVotes(gameId, dayNumber, isRevote);

  if (isTie && !isRevote) {
    // First tie → open revote
    await openVote(gameId, chatId, bot, true);
    return { lynched: null, noLynch: false, revoting: true };
  }

  if (!winner || isTie) {
    // No majority or second tie → no lynch
    try {
      await bot.telegram.sendMessage(chatId, t(lang, "no_lynch"));
    } catch {}
    await writeLog(gameId, "No lynch — tie or no votes", "LYNCH");
    return { lynched: null, noLynch: true, revoting: false };
  }

  // Lynch the winner
  await prisma.gamePlayer.update({
    where: { id: winner.id },
    data: { isAlive: false },
  });

  const { ROLES } = require("../../store/roles");
  const roleData = ROLES[winner.role];
  const roleName = roleData?.i18n?.name?.eng || winner.role;

  let lynchedName = winner.telegramId;
  try {
    const member = await bot.telegram.getChatMember(chatId, winner.telegramId);
    lynchedName =
      member?.user?.first_name || member?.user?.username || winner.telegramId;
  } catch {}

  try {
    await bot.telegram.sendMessage(
      chatId,
      t(lang, "lynched", { name: lynchedName, role: roleName }),
    );
  } catch {}

  await writeLog(
    gameId,
    `${winner.telegramId} was lynched (role: ${winner.role})`,
    "LYNCH",
  );

  return { lynched: winner, noLynch: false, revoting: false };
}

module.exports = { openVote, castVote, tallyVotes, resolveVote };

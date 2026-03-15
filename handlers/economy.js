/**
 * handlers/economy.js
 *
 * Coin & diamond earning system.
 *
 * Post-game rewards:
 *  - Participation : +10 coins  (everyone)
 *  - Survival      : +15 coins  (alive at end)
 *  - Win           : +30 coins  (winning team)
 *  - Per kill      : +10 coins  each kill this game
 *  - Perfect win   : +20 coins  (winner AND alive)
 *
 * Daily bonus:
 *  - Base          : +50 coins
 *  - Streak bonus  : +10 per consecutive day (max +100)
 */

const { prisma } = require("../config/db");

const REWARDS = {
    PARTICIPATION: 10,
    SURVIVAL:      15,
    WIN:           30,
    PER_KILL:      10,
    PERFECT_WIN:   20,
    DAILY_BASE:    50,
    STREAK_BONUS:  10,
    STREAK_MAX:    100,
};

// ─── Post-game rewards ────────────────────────────────────────────────────────

async function rewardAfterGame(gameId, winner) {
    const players = await prisma.player.findMany({ where: { gameId } });

    const ROLES       = require("../core/game/roles/roles");
    const { TEAMS }   = require("../core/game/roles/teams");

    // Count kills per player this game
    const killCounts = await prisma.nightAction.groupBy({
        by:     ["actorId"],
        where:  { gameId, action: "KILL", resolved: true },
        _count: { actorId: true },
    });
    const killMap = Object.fromEntries(
        killCounts.map(k => [k.actorId, k._count.actorId])
    );

    for (const player of players) {
        const roleDef = ROLES[player.role];
        const kills   = killMap[player.id] ?? 0;

        const isWinner =
            (winner === "MAFIA"  && roleDef?.team === TEAMS.MAFIA)  ||
            (winner === "CIVIL"  && roleDef?.team === TEAMS.CIVIL)  ||
            (winner === "KILLER" && player.role === "KILLER")       ||
            (winner === "SUID"   && player.role === "SUID");

        let coins = REWARDS.PARTICIPATION;
        if (player.isAlive) coins += REWARDS.SURVIVAL;
        if (isWinner)       coins += REWARDS.WIN;
        if (kills > 0)      coins += kills * REWARDS.PER_KILL;
        if (isWinner && player.isAlive) coins += REWARDS.PERFECT_WIN;

        await prisma.user.updateMany({
            where: { user_id: player.userTgId },
            data:  { money: { increment: coins } },
        }).catch(() => {});
    }
}

// ─── Daily bonus ──────────────────────────────────────────────────────────────

async function claimDailyBonus(userTgId) {
    const user = await prisma.user.findUnique({
        where: { user_id: String(userTgId) },
    });
    if (!user) return { ok: false, reason: "not_found" };

    const now       = new Date();
    const lastClaim = user.lastDailyBonus ? new Date(user.lastDailyBonus) : null;

    if (lastClaim) {
        const hoursSince = (now - lastClaim) / 1000 / 3600;
        if (hoursSince < 24) {
            return {
                ok:           false,
                alreadyClaimed: true,
                nextClaimIn:  Math.ceil(24 - hoursSince),
            };
        }
    }

    // Calculate streak
    let streak = user.dailyStreak ?? 0;
    if (lastClaim) {
        const hours = (now - lastClaim) / 1000 / 3600;
        streak = hours <= 48 ? streak + 1 : 1;
    } else {
        streak = 1;
    }

    const streakBonus = Math.min(streak * REWARDS.STREAK_BONUS, REWARDS.STREAK_MAX);
    const totalCoins  = REWARDS.DAILY_BASE + streakBonus;

    await prisma.user.update({
        where: { user_id: String(userTgId) },
        data: {
            money:          { increment: totalCoins },
            lastDailyBonus: now,
            dailyStreak:    streak,
        },
    });

    return { ok: true, coins: totalCoins, streak, base: REWARDS.DAILY_BASE, streakBonus };
}

async function getDailyBonusStatus(userTgId) {
    const user = await prisma.user.findUnique({
        where: { user_id: String(userTgId) },
    });
    if (!user) return { available: false, nextClaimIn: 0, streak: 0 };

    const now       = new Date();
    const lastClaim = user.lastDailyBonus ? new Date(user.lastDailyBonus) : null;

    if (!lastClaim) return { available: true, nextClaimIn: 0, streak: 0 };

    const hours = (now - lastClaim) / 1000 / 3600;
    if (hours >= 24) return { available: true, nextClaimIn: 0, streak: user.dailyStreak ?? 0 };

    return {
        available:   false,
        nextClaimIn: Math.ceil(24 - hours),
        streak:      user.dailyStreak ?? 0,
    };
}

module.exports = { rewardAfterGame, claimDailyBonus, getDailyBonusStatus, REWARDS };
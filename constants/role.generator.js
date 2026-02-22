const crypto = require("crypto")

const RULES = {
    // Mafia
    DON: { team: "MAFIA", minPlayers: 5, maxPerGame: 1, priority: 100 },
    MAFIA: { team: "MAFIA", minPlayers: 5, maxPerGame: 99, priority: 10 },
    SPY: { team: "MAFIA", minPlayers: 8, maxPerGame: 1, priority: 60 },
    LAWYER: { team: "MAFIA", minPlayers: 10, maxPerGame: 1, priority: 55 },
    BINDER: { team: "MAFIA", minPlayers: 14, maxPerGame: 1, priority: 40 },
    JOURNALIST: { team: "MAFIA", minPlayers: 16, maxPerGame: 1, priority: 35 },

    // Town
    COMMISSAR: { team: "CIVIL", minPlayers: 5, maxPerGame: 1, priority: 100 },
    SERGEANT: { team: "CIVIL", minPlayers: 8, maxPerGame: 1, priority: 70, requires: ["COMMISSAR"] },
    DOCTOR: { team: "CIVIL", minPlayers: 6, maxPerGame: 1, priority: 80 },
    NURSE: { team: "CIVIL", minPlayers: 10, maxPerGame: 1, priority: 45, requires: ["DOCTOR"] },
    GUARD: { team: "CIVIL", minPlayers: 12, maxPerGame: 1, priority: 40 },
    JUDGE: { team: "CIVIL", minPlayers: 12, maxPerGame: 1, priority: 35 },
    GENTLEMAN: { team: "CIVIL", minPlayers: 14, maxPerGame: 1, priority: 30 },
    PRIEST: { team: "CIVIL", minPlayers: 14, maxPerGame: 1, priority: 25 },

    // Solo
    KILLER: { team: "SOLO", minPlayers: 14, maxPerGame: 1, priority: 60 },
    VAMPIRE: { team: "SOLO", minPlayers: 16, maxPerGame: 1, priority: 40 },
    CLONE: { team: "SOLO", minPlayers: 16, maxPerGame: 1, priority: 35 },
    TRAVELER: { team: "SOLO", minPlayers: 16, maxPerGame: 1, priority: 30 },

    // Neutral
    MIRROR: { team: "NEUTRAL", minPlayers: 14, maxPerGame: 1, priority: 45 },
    LOVER: { team: "NEUTRAL", minPlayers: 10, maxPerGame: 1, priority: 35 },
    FRAUDSTER: { team: "NEUTRAL", minPlayers: 12, maxPerGame: 1, priority: 30 },
    KAMIKAZE: { team: "NEUTRAL", minPlayers: 14, maxPerGame: 1, priority: 25 },
    BLOODY_WILL: { team: "NEUTRAL", minPlayers: 14, maxPerGame: 1, priority: 20 },
    RANDOMIZER: { team: "NEUTRAL", minPlayers: 16, maxPerGame: 1, priority: 15 },
    COPIER: { team: "NEUTRAL", minPlayers: 16, maxPerGame: 1, priority: 10 },

    // Filler
    CIVILIAN: { team: "CIVIL", minPlayers: 5, maxPerGame: 99, priority: 0 },
};

function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = crypto.randomInt(0, i + 1);
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function clamp(x, min, max) {
    return Math.max(min, Math.min(max, x));
}

function countByTeam(roleKeys, RULES, team) {
    return roleKeys.reduce((acc, k) => acc + (RULES[k]?.team === team ? 1 : 0), 0);
}

function canAddRole(pool, roleKey, RULES, n, teamLimit) {
    const r = RULES[roleKey];
    if (!r) return false;
    if (r.minPlayers && n < r.minPlayers) return false;

    const already = pool.filter((x) => x === roleKey).length;
    if (r.maxPerGame != null && already >= r.maxPerGame) return false;

    const teamCount = countByTeam(pool, RULES, r.team);
    if (teamCount >= teamLimit) return false;

    return true;
}

function addWithDependencies(pool, roleKey, RULES, n, teamLimits) {
    // add role
    pool.push(roleKey);

    // add requires (dependencies) if missing
    const req = RULES[roleKey]?.requires ?? [];
    for (const dep of req) {
        if (!pool.includes(dep)) {
            // dependency is usually same team (town->town), but just in case:
            const depTeam = RULES[dep]?.team;
            const limit = teamLimits[depTeam] ?? n;
            if (canAddRole(pool, dep, RULES, n, limit)) {
                pool.push(dep);
            }
        }
    }
}

function buildRolePool(n, RULES) {
    // 1) Decide team sizes (simple but solid curve)
    const mafiaLimit = clamp(Math.round(n * 0.3), 2, Math.floor(n / 2) - 1);

    // Neutral/Solo caps: keep small so game doesn’t become a physics experiment
    const soloLimit = n >= 18 ? 2 : n >= 14 ? 1 : 0;
    const neutralLimit = n >= 18 ? 2 : n >= 14 ? 1 : 0;

    let townLimit = n - mafiaLimit - soloLimit - neutralLimit;
    if (townLimit < 2) townLimit = 2; // safety

    const teamLimits = {
        MAFIA: mafiaLimit,
        CIVIL: townLimit,
        SOLO: soloLimit,
        NEUTRAL: neutralLimit,
    };

    const pool = [];

    // 2) Core roles (always try to include)
    if (canAddRole(pool, "DON", RULES, n, teamLimits.MAFIA)) addWithDependencies(pool, "DON", RULES, n, teamLimits);
    if (canAddRole(pool, "COMMISSAR", RULES, n, teamLimits.CIVIL)) addWithDependencies(pool, "COMMISSAR", RULES, n, teamLimits);
    if (canAddRole(pool, "DOCTOR", RULES, n, teamLimits.CIVIL)) addWithDependencies(pool, "DOCTOR", RULES, n, teamLimits);

    // 3) Candidate lists by team (sorted by priority)
    const keys = Object.keys(RULES);

    const mafiaSpecials = keys
        .filter((k) => RULES[k].team === "MAFIA" && k !== "DON" && k !== "MAFIA")
        .sort((a, b) => (RULES[b].priority ?? 0) - (RULES[a].priority ?? 0));

    const townSpecials = keys
        .filter((k) => RULES[k].team === "CIVIL" && k !== "CIVILIAN" && k !== "COMMISSAR" && k !== "DOCTOR")
        .sort((a, b) => (RULES[b].priority ?? 0) - (RULES[a].priority ?? 0));

    const soloSpecials = keys
        .filter((k) => RULES[k].team === "SOLO")
        .sort((a, b) => (RULES[b].priority ?? 0) - (RULES[a].priority ?? 0));

    const neutralSpecials = keys
        .filter((k) => RULES[k].team === "NEUTRAL")
        .sort((a, b) => (RULES[b].priority ?? 0) - (RULES[a].priority ?? 0));

    // 4) Fill MAFIA: add specials then fill with MAFIA
    for (const k of mafiaSpecials) {
        if (canAddRole(pool, k, RULES, n, teamLimits.MAFIA)) addWithDependencies(pool, k, RULES, n, teamLimits);
    }
    while (countByTeam(pool, RULES, "MAFIA") < teamLimits.MAFIA) {
        if (!canAddRole(pool, "MAFIA", RULES, n, teamLimits.MAFIA)) break;
        pool.push("MAFIA");
    }

    // 5) Fill CIVIL specials
    for (const k of townSpecials) {
        if (canAddRole(pool, k, RULES, n, teamLimits.CIVIL)) addWithDependencies(pool, k, RULES, n, teamLimits);
    }

    // 6) Pick SOLO/NEUTRAL (random among top candidates)
    function pickRandomFrom(list, limitTeam) {
        const eligible = list.filter((k) => canAddRole(pool, k, RULES, n, limitTeam));
        if (!eligible.length) return null;
        const pick = eligible[crypto.randomInt(0, eligible.length)];
        addWithDependencies(pool, pick, RULES, n, teamLimits);
        return pick;
    }

    while (countByTeam(pool, RULES, "SOLO") < teamLimits.SOLO) {
        if (!pickRandomFrom(soloSpecials, teamLimits.SOLO)) break;
    }

    while (countByTeam(pool, RULES, "NEUTRAL") < teamLimits.NEUTRAL) {
        if (!pickRandomFrom(neutralSpecials, teamLimits.NEUTRAL)) break;
    }

    // 7) Trim if dependencies made pool too big (remove lowest priority non-core)
    const CORE = new Set(["DON", "COMMISSAR"]); // never remove
    while (pool.length > n) {
        let idx = -1;
        let worst = Infinity;

        for (let i = 0; i < pool.length; i++) {
            const k = pool[i];
            if (CORE.has(k)) continue;
            const pr = RULES[k]?.priority ?? 0;
            if (pr < worst) {
                worst = pr;
                idx = i;
            }
        }
        if (idx === -1) break;
        pool.splice(idx, 1);
    }

    // 8) Fill remaining with CIVILIAN
    while (pool.length < n) pool.push("CIVILIAN");

    return pool;
}

function generateRolesForPlayers(players, RULES) {
    const n = players.length;

    // build balanced role pool
    const pool = buildRolePool(n, RULES);

    // shuffle and assign
    const mixed = shuffle(pool);

    // return updated players (mutating or not — choose one)
    return players.map((p, i) => ({
        ...p,
        role: mixed[i],
    }));
}
module.exports = { generateRolesForPlayers, RULES }
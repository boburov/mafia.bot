const { prisma } = require("../../config/db");
const { gameQueue } = require("../../handlers/queue");
const ROLES = require("./roles/roles");
const { TEAMS, PHASES } = require("./roles/teams");

// ─── Constants ────────────────────────────────────────────────────────────────

const { MIN_PLAYERS, IS_TEST, TEST_ROLE } = require("../../config/test.config");

// Balanced role pools for 4-50 players.
// Mafia ≈ 25% | Specials scale up | Solo roles from 10+ | TINCH fills remainder
// Format: { roleKey: count }
const ROLE_POOLS = {
    4:  { DON: 1, KOMISSAR: 1, DOKTOR: 1, TINCH: 1 },
    5:  { DON: 1, KOMISSAR: 1, DOKTOR: 1, TINCH: 2 },
    6:  { DON: 1, KOMISSAR: 1, DOKTOR: 1, TINCH: 3 },
    7:  { DON: 1, KOMISSAR: 1, DOKTOR: 1, MASHUQA: 1, TINCH: 3 },
    8:  { DON: 1, MAFIA: 1, KOMISSAR: 1, DOKTOR: 1, MASHUQA: 1, AFERIST: 1, TINCH: 2 },
    9:  { DON: 1, MAFIA: 1, KOMISSAR: 1, DOKTOR: 1, MASHUQA: 1, KAMIKAZE: 1, AFERIST: 1, TINCH: 2 },
    10: { DON: 1, MAFIA: 1, KOMISSAR: 1, DOKTOR: 1, MASHUQA: 1, KAMIKAZE: 1, AFERIST: 1, KILLER: 1, TINCH: 2 },
    11: { DON: 1, MAFIA: 1, KOMISSAR: 1, DOKTOR: 1, MASHUQA: 1, KAMIKAZE: 1, AFERIST: 1, KILLER: 1, TINCH: 3 },
    12: { DON: 1, MAFIA: 2, KOMISSAR: 1, DOKTOR: 1, MASHUQA: 1, KAMIKAZE: 1, SERJANT: 1, AFERIST: 1, KILLER: 1, TINCH: 2 },
    13: { DON: 1, MAFIA: 2, KOMISSAR: 1, DOKTOR: 1, MASHUQA: 1, KAMIKAZE: 1, SERJANT: 1, AFERIST: 1, KILLER: 1, SUID: 1, TINCH: 2 },
    14: { DON: 1, MAFIA: 2, KOMISSAR: 1, DOKTOR: 1, MASHUQA: 1, KAMIKAZE: 1, SERJANT: 1, QORIQCHI: 1, AFERIST: 1, KILLER: 1, SUID: 1, TINCH: 2 },
    15: { DON: 1, MAFIA: 2, KOMISSAR: 1, DOKTOR: 1, MASHUQA: 1, KAMIKAZE: 1, SERJANT: 1, QORIQCHI: 1, AFERIST: 1, KILLER: 1, SUID: 1, TINCH: 3 },
    16: { DON: 1, MAFIA: 2, AYGOQCHI: 1, KOMISSAR: 1, DOKTOR: 1, MASHUQA: 1, KAMIKAZE: 1, SERJANT: 1, QORIQCHI: 1, SUDYA: 1, AFERIST: 1, KILLER: 1, SUID: 1, TINCH: 2 },
    17: { DON: 1, MAFIA: 2, AYGOQCHI: 1, KOMISSAR: 1, DOKTOR: 1, MASHUQA: 1, KAMIKAZE: 1, SERJANT: 1, QORIQCHI: 1, SUDYA: 1, AFERIST: 1, KILLER: 1, SUID: 1, QONXOR: 1, TINCH: 2 },
    18: { DON: 1, MAFIA: 2, AYGOQCHI: 1, KOMISSAR: 1, DOKTOR: 1, MASHUQA: 1, KAMIKAZE: 1, SERJANT: 1, QORIQCHI: 1, SUDYA: 1, JANOB: 1, AFERIST: 1, KILLER: 1, SUID: 1, QONXOR: 1, TINCH: 2 },
    19: { DON: 1, MAFIA: 2, AYGOQCHI: 1, KOMISSAR: 1, DOKTOR: 1, MASHUQA: 1, KAMIKAZE: 1, SERJANT: 1, QORIQCHI: 1, SUDYA: 1, JANOB: 1, AFERIST: 1, KILLER: 1, SUID: 1, QONXOR: 1, TINCH: 3 },
    20: { DON: 1, MAFIA: 2, AYGOQCHI: 1, ADVOKAT: 1, KOMISSAR: 1, DOKTOR: 1, MASHUQA: 1, KAMIKAZE: 1, SERJANT: 1, QORIQCHI: 1, SUDYA: 1, JANOB: 1, AFERIST: 1, QONLI_VASIYAT: 1, KILLER: 1, SUID: 1, QONXOR: 1, TINCH: 2 },
    21: { DON: 1, MAFIA: 2, AYGOQCHI: 1, ADVOKAT: 1, KOMISSAR: 1, DOKTOR: 1, MASHUQA: 1, KAMIKAZE: 1, SERJANT: 1, QORIQCHI: 1, SUDYA: 1, JANOB: 1, AFERIST: 1, QONLI_VASIYAT: 1, KILLER: 1, SUID: 1, QONXOR: 1, PARAZIT: 1, TINCH: 2 },
    22: { DON: 1, MAFIA: 2, AYGOQCHI: 1, ADVOKAT: 1, KOMISSAR: 1, DOKTOR: 1, MASHUQA: 1, KAMIKAZE: 1, SERJANT: 1, QORIQCHI: 1, SUDYA: 1, JANOB: 1, ELF: 1, AFERIST: 1, QONLI_VASIYAT: 1, KILLER: 1, SUID: 1, QONXOR: 1, PARAZIT: 1, TINCH: 2 },
    23: { DON: 1, MAFIA: 2, AYGOQCHI: 1, ADVOKAT: 1, KOMISSAR: 1, DOKTOR: 1, MASHUQA: 1, KAMIKAZE: 1, SERJANT: 1, QORIQCHI: 1, SUDYA: 1, JANOB: 1, ELF: 1, AFERIST: 1, QONLI_VASIYAT: 1, KILLER: 1, SUID: 1, QONXOR: 1, PARAZIT: 1, TINCH: 3 },
    24: { DON: 1, MAFIA: 3, AYGOQCHI: 1, ADVOKAT: 1, KOMISSAR: 1, DOKTOR: 1, MASHUQA: 1, KAMIKAZE: 1, SERJANT: 1, QORIQCHI: 1, SUDYA: 1, JANOB: 1, ELF: 1, AFERIST: 1, QONLI_VASIYAT: 1, KILLER: 1, SUID: 1, QONXOR: 1, PARAZIT: 1, TINCH: 3 },
    25: { DON: 1, MAFIA: 3, AYGOQCHI: 1, ADVOKAT: 1, KOMISSAR: 1, DOKTOR: 1, MASHUQA: 1, KAMIKAZE: 1, SERJANT: 1, QORIQCHI: 1, SUDYA: 1, JANOB: 1, ELF: 1, AFERIST: 1, QONLI_VASIYAT: 1, KILLER: 1, SUID: 1, QONXOR: 1, PARAZIT: 1, KOZGU: 1, TINCH: 3 },
    26: { DON: 1, MAFIA: 3, AYGOQCHI: 1, ADVOKAT: 1, KOMISSAR: 1, DOKTOR: 1, MASHUQA: 1, KAMIKAZE: 1, SERJANT: 1, QORIQCHI: 1, SUDYA: 1, JANOB: 1, ELF: 1, RUHONIY: 1, AFERIST: 1, QONLI_VASIYAT: 1, KILLER: 1, SUID: 1, QONXOR: 1, PARAZIT: 1, KOZGU: 1, TINCH: 3 },
    27: { DON: 1, MAFIA: 3, AYGOQCHI: 1, ADVOKAT: 1, KOMISSAR: 1, DOKTOR: 1, MASHUQA: 1, KAMIKAZE: 1, SERJANT: 1, QORIQCHI: 1, SUDYA: 1, JANOB: 1, ELF: 1, RUHONIY: 1, AFERIST: 1, QONLI_VASIYAT: 1, KILLER: 1, SUID: 1, QONXOR: 1, PARAZIT: 1, KOZGU: 1, TINCH: 4 },
    28: { DON: 1, MAFIA: 4, AYGOQCHI: 1, ADVOKAT: 1, KOMISSAR: 1, DOKTOR: 1, MASHUQA: 1, KAMIKAZE: 1, SERJANT: 1, QORIQCHI: 1, SUDYA: 1, JANOB: 1, ELF: 1, RUHONIY: 1, AFERIST: 1, QONLI_VASIYAT: 1, KILLER: 1, SUID: 1, QONXOR: 1, PARAZIT: 1, KOZGU: 1, KLON: 1, TINCH: 3 },
    29: { DON: 1, MAFIA: 4, AYGOQCHI: 1, ADVOKAT: 1, KOMISSAR: 1, DOKTOR: 1, MASHUQA: 1, KAMIKAZE: 1, SERJANT: 1, QORIQCHI: 1, SUDYA: 1, JANOB: 1, ELF: 1, RUHONIY: 1, AFERIST: 1, QONLI_VASIYAT: 1, KILLER: 1, SUID: 1, QONXOR: 1, PARAZIT: 1, KOZGU: 1, KLON: 1, TINCH: 4 },
    30: { DON: 1, MAFIA: 4, AYGOQCHI: 1, ADVOKAT: 1, KOMISSAR: 1, DOKTOR: 1, MASHUQA: 1, KAMIKAZE: 1, SERJANT: 1, QORIQCHI: 1, SUDYA: 1, JANOB: 1, ELF: 1, RUHONIY: 1, AFERIST: 1, QONLI_VASIYAT: 1, NUSXACHI: 1, KILLER: 1, SUID: 1, QONXOR: 1, PARAZIT: 1, KOZGU: 1, KLON: 1, TINCH: 4 },
    31: { DON: 1, MAFIA: 4, AYGOQCHI: 1, ADVOKAT: 1, KOMISSAR: 1, DOKTOR: 1, MASHUQA: 1, KAMIKAZE: 1, SERJANT: 1, QORIQCHI: 1, SUDYA: 1, JANOB: 1, ELF: 1, RUHONIY: 1, AFERIST: 1, QONLI_VASIYAT: 1, NUSXACHI: 1, KILLER: 1, SUID: 1, QONXOR: 1, PARAZIT: 1, KOZGU: 1, KLON: 1, TINCH: 5 },
    32: { DON: 1, MAFIA: 4, AYGOQCHI: 1, ADVOKAT: 1, BOGLOVCHI: 1, KOMISSAR: 1, DOKTOR: 1, MASHUQA: 1, KAMIKAZE: 1, SERJANT: 1, QORIQCHI: 1, SUDYA: 1, JANOB: 1, ELF: 1, RUHONIY: 1, AFERIST: 1, QONLI_VASIYAT: 1, NUSXACHI: 1, KILLER: 1, SUID: 1, QONXOR: 1, PARAZIT: 1, KOZGU: 1, KLON: 1, TASODIFCHI: 1, TINCH: 4 },
    33: { DON: 1, MAFIA: 4, AYGOQCHI: 1, ADVOKAT: 1, BOGLOVCHI: 1, KOMISSAR: 1, DOKTOR: 1, MASHUQA: 1, KAMIKAZE: 1, SERJANT: 1, QORIQCHI: 1, SUDYA: 1, JANOB: 1, ELF: 1, RUHONIY: 1, AFERIST: 1, QONLI_VASIYAT: 1, NUSXACHI: 1, KILLER: 1, SUID: 1, QONXOR: 1, PARAZIT: 1, KOZGU: 1, KLON: 1, TASODIFCHI: 1, TINCH: 5 },
    34: { DON: 1, MAFIA: 4, AYGOQCHI: 1, ADVOKAT: 1, BOGLOVCHI: 1, KOMISSAR: 1, DOKTOR: 1, MASHUQA: 1, KAMIKAZE: 1, SERJANT: 1, QORIQCHI: 1, SUDYA: 1, JANOB: 1, ELF: 1, RUHONIY: 1, AFERIST: 1, QONLI_VASIYAT: 1, NUSXACHI: 1, KILLER: 1, SUID: 1, QONXOR: 1, PARAZIT: 1, KOZGU: 1, KLON: 1, TASODIFCHI: 1, TINCH: 6 },
    35: { DON: 1, MAFIA: 4, AYGOQCHI: 1, ADVOKAT: 1, BOGLOVCHI: 1, KOMISSAR: 1, DOKTOR: 2, MASHUQA: 1, KAMIKAZE: 1, SERJANT: 1, QORIQCHI: 1, SUDYA: 1, JANOB: 1, ELF: 1, RUHONIY: 1, AFERIST: 1, QONLI_VASIYAT: 1, NUSXACHI: 1, KILLER: 1, SUID: 1, QONXOR: 1, PARAZIT: 1, KOZGU: 1, KLON: 1, TASODIFCHI: 1, TINCH: 6 },
    36: { DON: 1, MAFIA: 5, AYGOQCHI: 1, ADVOKAT: 1, BOGLOVCHI: 1, KOMISSAR: 1, DOKTOR: 2, MASHUQA: 1, KAMIKAZE: 1, SERJANT: 1, QORIQCHI: 1, SUDYA: 1, JANOB: 1, ELF: 1, RUHONIY: 1, AFERIST: 1, QONLI_VASIYAT: 1, NUSXACHI: 1, KILLER: 1, SUID: 1, QONXOR: 1, PARAZIT: 1, KOZGU: 1, KLON: 1, TASODIFCHI: 1, TINCH: 6 },
    37: { DON: 1, MAFIA: 5, AYGOQCHI: 1, ADVOKAT: 1, BOGLOVCHI: 1, KOMISSAR: 1, DOKTOR: 2, MASHUQA: 1, KAMIKAZE: 1, SERJANT: 1, QORIQCHI: 1, SUDYA: 1, JANOB: 1, ELF: 1, RUHONIY: 1, AFERIST: 1, QONLI_VASIYAT: 1, NUSXACHI: 1, KILLER: 1, SUID: 1, QONXOR: 1, PARAZIT: 1, KOZGU: 1, KLON: 1, TASODIFCHI: 1, TINCH: 7 },
    38: { DON: 1, MAFIA: 5, AYGOQCHI: 1, ADVOKAT: 1, BOGLOVCHI: 1, KOMISSAR: 1, DOKTOR: 2, MASHUQA: 1, KAMIKAZE: 1, SERJANT: 1, QORIQCHI: 1, SUDYA: 1, JANOB: 1, ELF: 1, RUHONIY: 1, AFERIST: 1, QONLI_VASIYAT: 1, NUSXACHI: 1, KILLER: 1, SUID: 1, QONXOR: 1, PARAZIT: 1, KOZGU: 1, KLON: 1, TASODIFCHI: 1, SAYOHATCHI: 1, TINCH: 7 },
    39: { DON: 1, MAFIA: 5, AYGOQCHI: 1, ADVOKAT: 1, BOGLOVCHI: 1, KOMISSAR: 1, DOKTOR: 2, MASHUQA: 1, KAMIKAZE: 1, SERJANT: 1, QORIQCHI: 1, SUDYA: 1, JANOB: 1, ELF: 1, RUHONIY: 1, AFERIST: 1, QONLI_VASIYAT: 1, NUSXACHI: 1, KILLER: 1, SUID: 1, QONXOR: 1, PARAZIT: 1, KOZGU: 1, KLON: 1, TASODIFCHI: 1, SAYOHATCHI: 1, TINCH: 8 },
    40: { DON: 1, MAFIA: 6, AYGOQCHI: 1, ADVOKAT: 1, BOGLOVCHI: 1, KOMISSAR: 2, DOKTOR: 2, MASHUQA: 1, KAMIKAZE: 1, SERJANT: 1, QORIQCHI: 1, SUDYA: 1, JANOB: 1, ELF: 1, RUHONIY: 1, AFERIST: 1, QONLI_VASIYAT: 1, NUSXACHI: 1, KILLER: 1, SUID: 1, QONXOR: 1, PARAZIT: 1, KOZGU: 1, KLON: 1, TASODIFCHI: 1, SAYOHATCHI: 1, TINCH: 7 },
    41: { DON: 1, MAFIA: 6, AYGOQCHI: 1, ADVOKAT: 1, BOGLOVCHI: 1, KOMISSAR: 2, DOKTOR: 2, MASHUQA: 1, KAMIKAZE: 1, SERJANT: 1, QORIQCHI: 1, SUDYA: 1, JANOB: 1, ELF: 1, RUHONIY: 1, AFERIST: 1, QONLI_VASIYAT: 1, NUSXACHI: 1, KILLER: 1, SUID: 1, QONXOR: 1, PARAZIT: 1, KOZGU: 1, KLON: 1, TASODIFCHI: 1, SAYOHATCHI: 1, TINCH: 8 },
    42: { DON: 1, MAFIA: 6, AYGOQCHI: 1, ADVOKAT: 1, BOGLOVCHI: 1, KOMISSAR: 2, DOKTOR: 2, MASHUQA: 1, KAMIKAZE: 1, SERJANT: 1, QORIQCHI: 1, SUDYA: 1, JANOB: 1, ELF: 1, RUHONIY: 1, AFERIST: 1, QONLI_VASIYAT: 1, NUSXACHI: 1, KILLER: 1, SUID: 1, QONXOR: 1, PARAZIT: 1, KOZGU: 1, KLON: 1, TASODIFCHI: 1, SAYOHATCHI: 1, TINCH: 9 },
    43: { DON: 1, MAFIA: 6, AYGOQCHI: 1, ADVOKAT: 1, BOGLOVCHI: 1, KOMISSAR: 2, DOKTOR: 2, MASHUQA: 1, KAMIKAZE: 1, SERJANT: 1, QORIQCHI: 1, SUDYA: 1, JANOB: 1, ELF: 1, RUHONIY: 1, AFERIST: 1, QONLI_VASIYAT: 1, NUSXACHI: 1, KILLER: 1, SUID: 1, QONXOR: 1, PARAZIT: 1, KOZGU: 1, KLON: 1, TASODIFCHI: 1, SAYOHATCHI: 1, TINCH: 10 },
    44: { DON: 1, MAFIA: 7, AYGOQCHI: 1, ADVOKAT: 1, BOGLOVCHI: 1, KOMISSAR: 2, DOKTOR: 2, MASHUQA: 1, KAMIKAZE: 1, SERJANT: 1, QORIQCHI: 1, SUDYA: 1, JANOB: 1, ELF: 1, RUHONIY: 1, AFERIST: 1, QONLI_VASIYAT: 1, NUSXACHI: 1, KILLER: 1, SUID: 1, QONXOR: 1, PARAZIT: 1, KOZGU: 1, KLON: 1, TASODIFCHI: 1, SAYOHATCHI: 1, TINCH: 10 },
    45: { DON: 1, MAFIA: 7, AYGOQCHI: 1, ADVOKAT: 1, BOGLOVCHI: 1, KOMISSAR: 2, DOKTOR: 2, MASHUQA: 1, KAMIKAZE: 1, SERJANT: 1, QORIQCHI: 1, SUDYA: 1, JANOB: 1, ELF: 1, RUHONIY: 1, AFERIST: 1, QONLI_VASIYAT: 1, NUSXACHI: 1, KILLER: 1, SUID: 1, QONXOR: 2, PARAZIT: 1, KOZGU: 1, KLON: 1, TASODIFCHI: 1, SAYOHATCHI: 1, TINCH: 10 },
    46: { DON: 1, MAFIA: 7, AYGOQCHI: 1, ADVOKAT: 1, BOGLOVCHI: 1, KOMISSAR: 2, DOKTOR: 2, MASHUQA: 1, KAMIKAZE: 1, SERJANT: 1, QORIQCHI: 1, SUDYA: 1, JANOB: 1, ELF: 1, RUHONIY: 1, AFERIST: 1, QONLI_VASIYAT: 1, NUSXACHI: 1, KILLER: 1, SUID: 1, QONXOR: 2, PARAZIT: 1, KOZGU: 1, KLON: 1, TASODIFCHI: 1, SAYOHATCHI: 1, TINCH: 11 },
    47: { DON: 1, MAFIA: 7, AYGOQCHI: 1, ADVOKAT: 1, BOGLOVCHI: 1, KOMISSAR: 2, DOKTOR: 2, MASHUQA: 1, KAMIKAZE: 1, SERJANT: 1, QORIQCHI: 1, SUDYA: 1, JANOB: 1, ELF: 1, RUHONIY: 1, AFERIST: 1, QONLI_VASIYAT: 1, NUSXACHI: 1, KILLER: 1, SUID: 1, QONXOR: 2, PARAZIT: 1, KOZGU: 1, KLON: 1, TASODIFCHI: 1, SAYOHATCHI: 1, TINCH: 12 },
    48: { DON: 1, MAFIA: 8, AYGOQCHI: 1, ADVOKAT: 1, BOGLOVCHI: 1, KOMISSAR: 2, DOKTOR: 2, MASHUQA: 1, KAMIKAZE: 1, SERJANT: 1, QORIQCHI: 1, SUDYA: 1, JANOB: 1, ELF: 1, RUHONIY: 1, AFERIST: 1, QONLI_VASIYAT: 1, NUSXACHI: 1, KILLER: 1, SUID: 1, QONXOR: 2, PARAZIT: 1, KOZGU: 1, KLON: 1, TASODIFCHI: 1, SAYOHATCHI: 1, TINCH: 12 },
    49: { DON: 1, MAFIA: 8, AYGOQCHI: 1, ADVOKAT: 1, BOGLOVCHI: 1, KOMISSAR: 2, DOKTOR: 2, MASHUQA: 1, KAMIKAZE: 1, SERJANT: 1, QORIQCHI: 1, SUDYA: 1, JANOB: 1, ELF: 1, RUHONIY: 1, AFERIST: 1, QONLI_VASIYAT: 1, NUSXACHI: 1, KILLER: 1, SUID: 1, QONXOR: 2, PARAZIT: 1, KOZGU: 1, KLON: 1, TASODIFCHI: 1, SAYOHATCHI: 1, TINCH: 13 },
    50: { DON: 1, MAFIA: 8, AYGOQCHI: 1, ADVOKAT: 1, BOGLOVCHI: 1, KOMISSAR: 2, DOKTOR: 2, MASHUQA: 1, KAMIKAZE: 1, SERJANT: 1, QORIQCHI: 1, SUDYA: 1, JANOB: 1, ELF: 1, RUHONIY: 1, AFERIST: 1, QONLI_VASIYAT: 1, NUSXACHI: 1, KILLER: 1, SUID: 1, QONXOR: 2, PARAZIT: 1, KOZGU: 1, KLON: 1, TASODIFCHI: 1, SAYOHATCHI: 1, TINCH: 14 },
};

// Phase durations in milliseconds
const PHASE_DURATION = {
    DAY:    60_000,   // 60 seconds discussion
    VOTING: 45_000,   // 45 seconds voting
    NIGHT:  40_000,   // 40 seconds for night actions
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Fisher-Yates shuffle — returns a NEW shuffled array
 */
function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

/**
 * Build a flat role list from a pool definition.
 * e.g. { DON: 1, TINCH: 3 } → ["DON", "TINCH", "TINCH", "TINCH"]
 */
function buildRoleList(pool) {
    const list = [];
    for (const [role, count] of Object.entries(pool)) {
        for (let i = 0; i < count; i++) list.push(role);
    }
    return list;
}

/**
 * Pick the closest role pool for the given player count.
 * Falls back to the largest defined pool if count exceeds all keys.
 */
function pickPool(playerCount) {
    const sizes = Object.keys(ROLE_POOLS).map(Number).sort((a, b) => a - b);
    // exact match
    if (ROLE_POOLS[playerCount]) return ROLE_POOLS[playerCount];
    // closest pool that fits (round down)
    let chosen = sizes[0];
    for (const size of sizes) {
        if (size <= playerCount) chosen = size;
    }
    return ROLE_POOLS[chosen];
}

// ─── Core Engine Functions ────────────────────────────────────────────────────

/**
 * assignRoles(gameId)
 * Shuffles and writes a role to every Player row in DB.
 * Returns array of { userTgId, role } for notification purposes.
 */
async function assignRoles(gameId) {
    const players = await prisma.player.findMany({ where: { gameId } });

    if (players.length < MIN_PLAYERS) {
        throw new Error(`Not enough players: ${players.length}/${MIN_PLAYERS}`);
    }

    const pool    = pickPool(players.length);
    let roleList  = buildRoleList(pool);

    // If pool has fewer roles than players, pad with TINCH
    while (roleList.length < players.length) roleList.push("TINCH");
    // Trim if somehow more roles than players
    roleList = roleList.slice(0, players.length);

    let shuffledRoles   = shuffle(roleList);
    const shuffledPlayers = shuffle(players);

    // TEST_MODE: force first player into TEST_ROLE
    if (IS_TEST && TEST_ROLE && shuffledRoles.includes(TEST_ROLE)) {
        const idx = shuffledRoles.indexOf(TEST_ROLE);
        [shuffledRoles[0], shuffledRoles[idx]] = [shuffledRoles[idx], shuffledRoles[0]];
    }

    const assignments = shuffledPlayers.map((player, i) => ({
        id:   player.id,
        role: shuffledRoles[i],
    }));

    // Bulk update in a transaction
    await prisma.$transaction(
        assignments.map(({ id, role }) =>
            prisma.player.update({ where: { id }, data: { role } })
        )
    );

    // Apply equipped skins per player
    const { applySkinToPlayer } = require("../../core/middleware/profile");
    for (const { id, role } of assignments) {
        const player = shuffledPlayers.find(p => p.id === id);
        if (player) await applySkinToPlayer({ id, role }, player.userTgId);
    }

    return assignments.map(({ id, role }, i) => ({
        userTgId: shuffledPlayers[i].userTgId,
        role,
        roleDef:  ROLES[role],
    }));
}

/**
 * getAlivePlayers(gameId)
 * Returns all players where isAlive = true.
 * NOTE: Add `isAlive Boolean @default(true)` to your Prisma Player model.
 */
async function getAlivePlayers(gameId) {
    return prisma.player.findMany({
        where: { gameId, isAlive: true },
    });
}

/**
 * checkWinCondition(gameId)
 * Returns "MAFIA" | "CIVIL" | "KILLER" | "SUID" | null (game continues)
 */
async function checkWinCondition(gameId) {
    const alive = await getAlivePlayers(gameId);

    const mafia  = alive.filter(p => ROLES[p.role]?.team === TEAMS.MAFIA);
    const civil  = alive.filter(p => ROLES[p.role]?.team === TEAMS.CIVIL);
    const solo   = alive.filter(p => ROLES[p.role]?.team === TEAMS.SOLO);

    // Mafia wins when they equal or outnumber all non-mafia
    if (mafia.length >= civil.length + solo.length) return "MAFIA";

    // Civil wins when all mafia are dead and no solo threats remain
    if (mafia.length === 0 && solo.length === 0) return "CIVIL";

    // Solo win: KILLER — last one standing alone
    const killer = solo.find(p => p.role === "KILLER");
    if (killer && alive.length === 1) return "KILLER";

    // SUID wins by being lynched (handled in voting phase)

    return null; // game continues
}

/**
 * endGame(gameId, winner)
 * Marks game FINISHED and returns final player list for summary.
 */
async function endGame(gameId, winner) {
    await prisma.game.update({
        where: { id: gameId },
        data:  { status: "FINISHED", finishedAt: new Date(), winner },
    });

    // Update user stats
    const { updateStatsAfterGame } = require("../../core/middleware/profile");
    await updateStatsAfterGame(gameId, winner);

    // Reward coins to all players
    const { rewardAfterGame } = require("../../handlers/economy");
    await rewardAfterGame(gameId, winner).catch(console.error);

    const players = await prisma.player.findMany({ where: { gameId } });
    return { winner, players };
}

// ─── Phase Transition Schedulers ─────────────────────────────────────────────

/**
 * startGame(gameId, chatId)
 * Entry point called from the worker after lobby closes.
 * 1. Assigns roles
 * 2. Schedules the first NIGHT phase
 * Returns role assignments so the worker can DM each player their role.
 */
async function startGame(gameId, chatId) {
    // Mark game as RUNNING
    await prisma.game.update({
        where: { id: gameId },
        data:  { status: "RUNNING", phase: "NIGHT" },
    });

    // Assign roles
    const assignments = await assignRoles(gameId);

    // Schedule first night immediately (worker sends the night photo)
    await gameQueue.add(
        "startNight",
        { gameId, chatId, round: 1 },
        { delay: 2_000 } // small delay so role DMs can be sent first
    );

    return assignments; // worker uses this to DM roles
}

/**
 * transitionToDay(gameId, chatId, round)
 * Called by worker after night actions resolve.
 * Schedules: DAY → then VOTING
 */
async function transitionToDay(gameId, chatId, round) {
    await prisma.game.update({
        where: { id: gameId },
        data:  { phase: "DAY" },
    });

    // After DAY duration, start voting
    await gameQueue.add(
        "startVoting",
        { gameId, chatId, round },
        { delay: PHASE_DURATION.DAY }
    );
}

/**
 * transitionToNight(gameId, chatId, round)
 * Called by worker after voting resolves.
 * Schedules: NIGHT → then next DAY
 */
async function transitionToNight(gameId, chatId, round) {
    await prisma.game.update({
        where: { id: gameId },
        data:  { phase: "NIGHT" },
    });

    await gameQueue.add(
        "startNight",
        { gameId, chatId, round: round + 1 },
        { delay: PHASE_DURATION.NIGHT }
    );
}

/**
 * transitionToVoting(gameId, chatId, round)
 * Called by worker when DAY timer expires.
 * After VOTING duration, resolves votes → night.
 */
async function transitionToVoting(gameId, chatId, round) {
    await prisma.game.update({
        where: { id: gameId },
        data:  { phase: "VOTING" },
    });

    await gameQueue.add(
        "resolveVoting",
        { gameId, chatId, round },
        { delay: PHASE_DURATION.VOTING }
    );
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
    assignRoles,
    startGame,
    getAlivePlayers,
    checkWinCondition,
    endGame,
    transitionToDay,
    transitionToNight,
    transitionToVoting,
    PHASE_DURATION,
    MIN_PLAYERS,
};
const ACTIONS = require("./actions");
const { TEAMS, PHASES } = require("./teams");

const ROLES = {
    DON: {
        name: "🤵🏻 Don",
        team: TEAMS.MAFIA,
        phase: PHASES.NIGHT,
        minPlayer: 4,
        abilities: [{ type: ACTIONS.KILL }],
        leader: true,
    },

    MAFIA: {
        name: "🤵🏼 Mafia",
        team: TEAMS.MAFIA,
        phase: PHASES.NIGHT,
        minPlayer: 4,
        abilities: [{ type: ACTIONS.KILL }],
        inherits: "DON",
    },

    KILLER: {
        name: "🔪 Qotil",
        team: TEAMS.SOLO,
        phase: PHASES.NIGHT,
        minPlayer: 8,
        abilities: [{ type: ACTIONS.KILL }],
    },

    KOMISSAR: {
        name: "🕵🏻‍♂ Komissar",
        team: TEAMS.CIVIL,
        phase: PHASES.NIGHT,
        minPlayer: 8,
        abilities: [{ type: ACTIONS.CHECK_ROLE }],
    },

    SERJANT: {
        name: "👮🏻 Serjant",
        team: TEAMS.CIVIL,
        phase: PHASES.PASSIVE,
        minPlayer: 4,
        inherits: "KOMISSAR",
    },

    DOKTOR: {
        name: "🧑🏻‍⚕ Doktor",
        team: TEAMS.CIVIL,
        phase: PHASES.NIGHT,
        minPlayer: 4,
        abilities: [{ type: ACTIONS.SAVE }],
    },

    TINCH: {
        name: "🧑🏻 Tinch aholi",
        team: TEAMS.CIVIL,
        phase: PHASES.DAY,
        minPlayer: 4,
    },

    MASHUQA: {
        name: "💃🏻 Ma'shuqa",
        team: TEAMS.NEUTRAL,
        phase: PHASES.NIGHT,
        minPlayer: 4,
        abilities: [{ type: ACTIONS.BLOCK }],
    },

    AFERIST: {
        name: "🤹🏻 Aferist",
        team: TEAMS.NEUTRAL,
        phase: PHASES.DAY,
        minPlayer: 4,
        abilities: [{ type: ACTIONS.STEAL_VOTE }],
    },

    AYGOQCHI: {
        name: "🦇 Ayg'oqchi",
        team: TEAMS.MAFIA,
        phase: PHASES.NIGHT,
        minPlayer: 4,
        abilities: [{ type: ACTIONS.CHECK_ROLE }],
    },

    SUID: {
        name: "🤦🏻 Suid",
        team: TEAMS.SOLO,
        winCondition: "LYNCHED",
    },

    ADVOKAT: {
        name: "👨🏻‍💼 Advokat",
        team: TEAMS.MAFIA,
        phase: PHASES.NIGHT,
        minPlayer: 4,
        abilities: [{ type: "PROTECT_FROM_CHECK" }],
    },

    KAMIKAZE: {
        name: "💣 Kamikaze",
        team: TEAMS.CIVIL,
        phase: PHASES.PASSIVE,
        minPlayer: 4,
        abilities: [{ type: ACTIONS.REVENGE_KILL }],
    },

    PARAZIT: {
        name: "🧥 Parazit",
        team: TEAMS.SOLO,
        phase: PHASES.PASSIVE,
        minPlayer: 4,
        abilities: [{ type: ACTIONS.TRANSFORM_ON_DEATH }],
    },

    QONXOR: {
        name: "🧛 Qonxo'r",
        team: TEAMS.SOLO,
        phase: PHASES.NIGHT,
        minPlayer: 4,
        abilities: [{ type: ACTIONS.KILL, cooldown: 2 }],
    },

    KOZGU: {
        name: "🪞 Ko'zgu",
        team: TEAMS.SOLO,
        phase: PHASES.PASSIVE,
        minPlayer: 4,
        abilities: [{ type: ACTIONS.REFLECT }],
    },

    QONLI_VASIYAT: {
        name: "☠️ Qonli vasiyat",
        team: TEAMS.NEUTRAL,
        phase: PHASES.PASSIVE,
        minPlayer: 4,
        abilities: [{ type: ACTIONS.REVENGE_KILL }],
    },

    TASODIFCHI: {
        name: "🎲 Tasodifchi",
        team: TEAMS.SOLO,
        phase: PHASES.NIGHT,
        minPlayer: 4,
        abilities: [{ type: ACTIONS.RANDOM_ROLE }],
    },

    QORIQCHI: {
        name: "🛡 Qo'riqchi",
        team: TEAMS.CIVIL,
        phase: PHASES.NIGHT,
        minPlayer: 4,
        abilities: [{ type: ACTIONS.SAVE }],
    },

    SUDYA: {
        name: "🧑🏻‍⚖ Sudya",
        team: TEAMS.CIVIL,
        phase: PHASES.DAY,
        minPlayer: 4,
        abilities: [{ type: ACTIONS.CANCEL_LYNCH, maxUses: 1 }],
    },

    ELF: {
        name: "🧝🏻‍♂ Elf",
        team: TEAMS.CIVIL,
        phase: PHASES.NIGHT,
        minPlayer: 4,
        abilities: [{ type: ACTIONS.KILL, onlyAgainst: ["MAFIA", "SOLO"] }],
    },

    KLON: {
        name: "🧬 Klon",
        team: TEAMS.SOLO,
        phase: PHASES.NIGHT,
        minPlayer: 4,
        abilities: [{ type: ACTIONS.COPY_ROLE }],
    },

    BOGLOVCHI: {
        name: "🧷 Bog'lovchi",
        team: TEAMS.MAFIA,
        phase: PHASES.NIGHT,
        minPlayer: 4,
        abilities: [{ type: ACTIONS.LINK_PLAYERS }],
    },

    NUSXACHI: {
        name: "🗂 Nusxachi",
        team: TEAMS.NEUTRAL,
        phase: PHASES.NIGHT,
        minPlayer: 4,
        abilities: [{ type: ACTIONS.COPY_ROLE, maxUses: 1 }],
    },

    SAYOHATCHI: {
        name: "🏃🏻 Sayohatchi",
        team: TEAMS.SOLO,
        phase: PHASES.NIGHT,
        minPlayer: 4,
        abilities: [{ type: ACTIONS.TAKE_ROLE_ONE_NIGHT }],
    },

    JANOB: {
        name: "🎖 Janob",
        team: TEAMS.CIVIL,
        phase: PHASES.DAY,
        minPlayer: 4,
        abilities: [{ type: ACTIONS.DOUBLE_VOTE }],
    },

    RUHONIY: {
        name: "📿 Ruhoniy",
        team: TEAMS.CIVIL,
        phase: PHASES.NIGHT,
        minPlayer: 4,
        abilities: [{ type: "CHECK_KILLER", cooldown: 2 }],
    },
};

module.exports = ROLES
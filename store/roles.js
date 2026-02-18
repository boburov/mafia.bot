// Teams: CIVIL (town), MAFIA, SOLO (independent), NEUTRAL (special win conditions)
const TEAMS = Object.freeze({
    CIVIL: "CIVIL",
    MAFIA: "MAFIA",
    SOLO: "SOLO",
    NEUTRAL: "NEUTRAL",
});

// Action types your engine can support
const ACTIONS = Object.freeze({
    KILL: "KILL",
    HEAL: "HEAL",
    CHECK_ROLE: "CHECK_ROLE",
    BLOCK: "BLOCK",
    STEAL_VOTE: "STEAL_VOTE",
    DISGUISE: "DISGUISE",
    INTERVIEW: "INTERVIEW",
    BIND: "BIND",
    COPY_ROLE: "COPY_ROLE",
    TAKE_ROLE_ONE_NIGHT: "TAKE_ROLE_ONE_NIGHT",
    CANCEL_LYNCH: "CANCEL_LYNCH",
    DOUBLE_VOTE: "DOUBLE_VOTE",
    WITNESS: "WITNESS",
    KNOW_KILLER_TEAM: "KNOW_KILLER_TEAM",
    RANDOM_ROLE_NIGHTLY: "RANDOM_ROLE_NIGHTLY",
    REFLECT: "REFLECT",
    CURSE_AFTER_DEATH: "CURSE_AFTER_DEATH",
    VAMPIRIC_SHIELD: "VAMPIRIC_SHIELD",
    REVIVE_AS_KILLER_ROLE: "REVIVE_AS_KILLER_ROLE",
    CLONE_IF_TARGET_DIES: "CLONE_IF_TARGET_DIES",
    EXECUTE_ONLY_MAFIA_SOLO: "EXECUTE_ONLY_MAFIA_SOLO",
    TAKE_DOWN_WITH_ME_ON_LYNCH: "TAKE_DOWN_WITH_ME_ON_LYNCH",
});

// Helper: keep language keys consistent
const LANGS = Object.freeze({ uz: "uz", eng: "eng", ru: "ru" });

const ROLES = Object.freeze({
    // --- Core Mafia ---
    DON: {
        key: "DON",
        emoji: "🤵🏻",
        team: TEAMS.MAFIA,
        i18n: {
            name: { uz: "Don", eng: "Don", ru: "Дон" },
            description: {
                uz: "Mafialar boshlig‘isiz. Tunda kim o‘lishini hal qilasiz.",
                eng: "You are the Mafia leader. At night you decide who will die.",
                ru: "Вы глава мафии. Ночью вы решаете, кто умрёт.",
            },
        },
        defaults: { isAlive: true },
        abilities: {
            canKillAtNight: true,
            actions: [{ type: ACTIONS.KILL, phase: "NIGHT", target: "PLAYER", limit: 1 }],
        },
        hierarchy: {
            commandRoleKeys: ["MAFIA", "SPY", "JOURNALIST", "LAWYER", "BINDER"],
            succession: ["MAFIA"],
        },
    },

    MAFIA: {
        key: "MAFIA",
        emoji: "🤵🏼",
        team: TEAMS.MAFIA,
        i18n: {
            name: { uz: "Mafiya", eng: "Mafia", ru: "Мафия" },
            description: {
                uz: "Donga bo‘ysunasiz. Don o‘lsa, uning o‘rnini egallashingiz mumkin.",
                eng: "You follow the Don. If the Don dies, you may become the new Don.",
                ru: "Вы подчиняетесь Дону. Если Дон умрёт, вы можете занять его место.",
            },
        },
        defaults: { isAlive: true },
        abilities: {
            canKillAtNight: true,
            actions: [], // keep empty if only Don chooses
        },
    },

    SPY: {
        key: "SPY",
        emoji: "🦇",
        team: TEAMS.MAFIA,
        i18n: {
            name: { uz: "Ayg‘oqchi", eng: "Spy", ru: "Шпион" },
            description: {
                uz: "Mafiya tarafidasiz. Tunda bir o‘yinchining rolini bilib, mafiyaga yetkazasiz.",
                eng: "You are on the Mafia side. At night you can learn a player’s role and share it with the Mafia.",
                ru: "Вы на стороне мафии. Ночью вы можете узнать роль игрока и сообщить мафии.",
            },
        },
        defaults: { isAlive: true },
        abilities: {
            actions: [{ type: ACTIONS.CHECK_ROLE, phase: "NIGHT", target: "PLAYER", limit: 1 }],
            sharesInfoWith: "MAFIA_TEAM",
        },
    },

    JOURNALIST: {
        key: "JOURNALIST",
        emoji: "👩🏻‍💻",
        team: TEAMS.MAFIA,
        i18n: {
            name: { uz: "Jurnalist", eng: "Journalist", ru: "Журналист" },
            description: {
                uz: "Mafiya agentisiz. Tunda bir o‘yinchiga borib, o‘sha kecha kimdir kelgan bo‘lsa rolni ko‘rib qolishingiz mumkin va mafiyaga xabar berasiz.",
                eng: "You are a Mafia agent. At night you visit a player; you may notice who visited them and report to the Mafia.",
                ru: "Вы агент мафии. Ночью вы навещаете игрока; можете заметить, кто приходил, и сообщить мафии.",
            },
        },
        defaults: { isAlive: true },
        abilities: {
            actions: [{ type: ACTIONS.INTERVIEW, phase: "NIGHT", target: "PLAYER", limit: 1 }],
            sharesInfoWith: "MAFIA_TEAM",
        },
    },

    LAWYER: {
        key: "LAWYER",
        emoji: "👨🏻‍💼",
        team: TEAMS.MAFIA,
        i18n: {
            name: { uz: "Advokat", eng: "Lawyer", ru: "Адвокат" },
            description: {
                uz: "Mafiya tarafdorisiz. Tunda bir o‘yinchini himoya qilasiz: Komissar tekshirsa, u tinch aholi bo‘lib ko‘rinadi.",
                eng: "You are on the Mafia side. At night you protect a player: if checked by the Commissar, they appear as a Civilian.",
                ru: "Вы на стороне мафии. Ночью вы защищаете игрока: при проверке комиссаром он выглядит как мирный.",
            },
        },
        defaults: { isAlive: true },
        abilities: {
            actions: [{ type: ACTIONS.DISGUISE, phase: "NIGHT", target: "PLAYER", limit: 1 }],
            effects: [{ type: "APPEAR_AS_CIVIL_TO_CHECKS", duration: "NEXT_DAY" }],
        },
    },

    BINDER: {
        key: "BINDER",
        emoji: "🧷",
        team: TEAMS.MAFIA,
        i18n: {
            name: { uz: "Bog‘lovchi", eng: "Binder", ru: "Связующий" },
            description: {
                uz: "Mafiya tarafidasiz. Tunda 2 kishini bog‘laysiz: bittasi o‘lsa, ikkinchisi ham o‘ladi.",
                eng: "You are on the Mafia side. At night you bind two players: if one dies, the other dies too.",
                ru: "Вы на стороне мафии. Ночью связываете двух игроков: если один умрёт, второй умрёт тоже.",
            },
        },
        defaults: { isAlive: true },
        abilities: {
            actions: [{ type: ACTIONS.BIND, phase: "NIGHT", target: "TWO_PLAYERS", limit: 1 }],
            effects: [{ type: "LINK_LIFE", duration: "UNTIL_UNBOUND_OR_DEATH" }],
        },
    },

    // --- Town / Civil ---
    COMMISSAR: {
        key: "COMMISSAR",
        emoji: "🕵🏻‍♂",
        team: TEAMS.CIVIL,
        i18n: {
            name: { uz: "Komissar", eng: "Commissar", ru: "Комиссар" },
            description: {
                uz: "Aholi himoyachisisiz. Tunda bir o‘yinchini tekshirib, mafiyani aniqlaysiz.",
                eng: "You defend the town. At night you investigate a player to find the Mafia.",
                ru: "Вы защищаете город. Ночью проверяете игрока, чтобы найти мафию.",
            },
        },
        defaults: { isAlive: true },
        abilities: {
            actions: [{ type: ACTIONS.CHECK_ROLE, phase: "NIGHT", target: "PLAYER", limit: 1 }],
        },
        hierarchy: { successor: "SERGEANT" },
    },

    SERGEANT: {
        key: "SERGEANT",
        emoji: "👮🏻",
        team: TEAMS.CIVIL,
        i18n: {
            name: { uz: "Serjant", eng: "Sergeant", ru: "Сержант" },
            description: {
                uz: "Komissarning yordamchisiz. Komissar o‘lsa, uning o‘rnini egallaysiz.",
                eng: "You are the Commissar’s assistant. If the Commissar dies, you become the new Commissar.",
                ru: "Вы помощник комиссара. Если комиссар погибнет, вы займёте его место.",
            },
        },
        defaults: { isAlive: true },
        abilities: {
            actions: [],
            effects: [{ type: "BECOME_COMMISSAR_IF_COMMISSAR_DIES" }],
        },
    },

    DOCTOR: {
        key: "DOCTOR",
        emoji: "🧑🏻‍⚕",
        team: TEAMS.CIVIL,
        i18n: {
            name: { uz: "Doktor", eng: "Doctor", ru: "Доктор" },
            description: {
                uz: "Tunda bir o‘yinchini o‘limdan saqlab qolishingiz mumkin.",
                eng: "At night you can save one player from death.",
                ru: "Ночью вы можете спасти одного игрока от смерти.",
            },
        },
        defaults: { isAlive: true },
        abilities: {
            actions: [{ type: ACTIONS.HEAL, phase: "NIGHT", target: "PLAYER", limit: 1 }],
        },
    },

    NURSE: {
        key: "NURSE",
        emoji: "👩🏻‍⚕",
        team: TEAMS.CIVIL,
        i18n: {
            name: { uz: "Hamshira", eng: "Nurse", ru: "Медсестра" },
            description: {
                uz: "Doktordan o‘rganasiz. Doktor o‘lsa, uning o‘rnini egallaysiz.",
                eng: "You learn from the Doctor. If the Doctor dies, you take their role.",
                ru: "Вы учитесь у доктора. Если доктор погибнет, вы займёте его роль.",
            },
        },
        defaults: { isAlive: true },
        abilities: {
            actions: [],
            effects: [{ type: "BECOME_DOCTOR_IF_DOCTOR_DIES" }],
        },
    },

    GUARD: {
        key: "GUARD",
        emoji: "🛡",
        team: TEAMS.CIVIL,
        i18n: {
            name: { uz: "Qo‘riqchi", eng: "Guardian", ru: "Охранник" },
            description: {
                uz: "Aholi tarafidasiz. Tunda tanlagan o‘yinchi o‘sha kecha o‘lmaydi.",
                eng: "You are on the town side. At night the chosen player cannot die that night.",
                ru: "Вы на стороне города. Ночью выбранный игрок не умрёт этой ночью.",
            },
        },
        defaults: { isAlive: true },
        abilities: {
            actions: [{ type: ACTIONS.HEAL, phase: "NIGHT", target: "PLAYER", limit: 1 }],
        },
    },

    JUDGE: {
        key: "JUDGE",
        emoji: "🧑🏻‍⚖",
        team: TEAMS.CIVIL,
        i18n: {
            name: { uz: "Sudya", eng: "Judge", ru: "Судья" },
            description: {
                uz: "1 marta osishni bekor qilishingiz mumkin.",
                eng: "You can cancel one lynching.",
                ru: "Вы можете отменить одну казнь.",
            },
        },
        defaults: { isAlive: true },
        abilities: {
            actions: [{ type: ACTIONS.CANCEL_LYNCH, phase: "VOTING", target: "NONE", limit: 1 }],
        },
    },

    ELF: {
        key: "ELF",
        emoji: "🧝🏻‍♂",
        team: TEAMS.CIVIL,
        i18n: {
            name: { uz: "Elf", eng: "Elf", ru: "Эльф" },
            description: {
                uz: "Aholi tarafidasiz. Faqat mafiya va yakka rollarni o‘ldira olasiz.",
                eng: "You are on the town side. You can kill only Mafia and Solo roles.",
                ru: "Вы на стороне города. Вы можете убивать только мафию и одиночные роли.",
            },
        },
        defaults: { isAlive: true },
        abilities: {
            actions: [{ type: ACTIONS.EXECUTE_ONLY_MAFIA_SOLO, phase: "NIGHT", target: "PLAYER", limit: 1 }],
            restrictions: [{ type: "CANNOT_KILL_CIVIL" }],
        },
    },

    GENTLEMAN: {
        key: "GENTLEMAN",
        emoji: "🎖",
        team: TEAMS.CIVIL,
        i18n: {
            name: { uz: "Janob", eng: "Gentleman", ru: "Джентльмен" },
            description: {
                uz: "Kunduzgi ovoz berishda ovozingiz 2 taga teng bo‘ladi va shaxsingiz oshkor qilinmaydi.",
                eng: "During day voting your vote counts as 2, and your identity is not revealed.",
                ru: "Днём ваш голос считается за 2, и ваша личность не раскрывается.",
            },
        },
        defaults: { isAlive: true },
        abilities: {
            actions: [{ type: ACTIONS.DOUBLE_VOTE, phase: "VOTING", target: "NONE", limit: "ALWAYS" }],
            effects: [{ type: "IDENTITY_HIDDEN_DURING_VOTING" }],
        },
    },

    PRIEST: {
        key: "PRIEST",
        emoji: "📿",
        team: TEAMS.CIVIL,
        i18n: {
            name: { uz: "Ruhoniy", eng: "Priest", ru: "Священник" },
            description: {
                uz: "Har 2 kechada 1 marta ma’lumot olasiz: kim o‘lganini/kim o‘ldirganini bilib olishingiz mumkin (qoidaga qarab).",
                eng: "Once every 2 nights you gain information about deaths/killer (depending on your game rules).",
                ru: "Раз в 2 ночи вы получаете информацию о смерти/убийце (в зависимости от правил).",
            },
        },
        defaults: { isAlive: true },
        abilities: {
            actions: [{ type: ACTIONS.KNOW_KILLER_TEAM, phase: "NIGHT", target: "NONE", limit: "EVERY_2_NIGHTS" }],
        },
    },

    CIVILIAN: {
        key: "CIVILIAN",
        emoji: "🧑🏻",
        team: TEAMS.CIVIL,
        i18n: {
            name: { uz: "Tinch aholi", eng: "Civilian", ru: "Мирный житель" },
            description: {
                uz: "Kunduz kuni muhokama va ovoz berishda mafiyani topishga harakat qilasiz.",
                eng: "By day you discuss and vote to find the Mafia.",
                ru: "Днём вы обсуждаете и голосуете, чтобы найти мафию.",
            },
        },
        defaults: { isAlive: true },
        abilities: { actions: [] },
    },

    // --- Solo / Neutral / Special ---
    KILLER: {
        key: "KILLER",
        emoji: "🔪",
        team: TEAMS.SOLO,
        i18n: {
            name: { uz: "Qotil", eng: "Killer", ru: "Убийца" },
            description: {
                uz: "Yakka rolsiz. Tunda o‘ldirasiz. Maqsad: oxirgi tirik qolish.",
                eng: "You are a solo role. You kill at night. Goal: be the last one alive.",
                ru: "Вы одиночная роль. Убиваете ночью. Цель: остаться последним живым.",
            },
        },
        defaults: { isAlive: true },
        abilities: {
            canKillAtNight: true,
            actions: [{ type: ACTIONS.KILL, phase: "NIGHT", target: "PLAYER", limit: 1 }],
            winCondition: "LAST_ALIVE",
        },
    },

    LOVER: {
        key: "LOVER",
        emoji: "💃🏻",
        team: TEAMS.NEUTRAL,
        i18n: {
            name: { uz: "Ma’shuqa", eng: "Lover", ru: "Любовница" },
            description: {
                uz: "Tunda bir o‘yinchini uxlatib qo‘yasiz — u 1 sikl harakat qila olmaydi.",
                eng: "At night you can put one player to sleep — they can’t act for 1 cycle.",
                ru: "Ночью вы усыпляете игрока — он не может действовать 1 цикл.",
            },
        },
        defaults: { isAlive: true },
        abilities: {
            actions: [{ type: ACTIONS.BLOCK, phase: "NIGHT", target: "PLAYER", limit: 1 }],
            effects: [{ type: "TARGET_CANNOT_ACT_NEXT_DAY_OR_NIGHT", duration: "1_CYCLE" }],
            winCondition: "SURVIVE",
        },
    },

    RAGER: {
        key: "RAGER",
        emoji: "🧟",
        team: TEAMS.SOLO,
        i18n: {
            name: { uz: "G‘azabkor", eng: "Rager", ru: "Яростный" },
            description: {
                uz: "Tunda o‘yinchi tanlaysiz. Qoidalari murakkab: g‘azab holati va o‘zini tanlash penalti engine’da belgilanadi.",
                eng: "At night you select a player. Complex rules (rage state/self-pick penalty) are defined by the engine.",
                ru: "Ночью вы выбираете игрока. Сложные правила (ярость/штраф за выбор себя) задаются движком.",
            },
        },
        defaults: { isAlive: true },
        abilities: {
            actions: [{ type: "RAGER_SELECT", phase: "NIGHT", target: "PLAYER", limit: 1 }],
            rules: [
                { type: "RAGE_ACTIVATES_AFTER_3_TOTAL_SELECTIONS" },
                { type: "SELF_SELECT_HAS_SPECIAL_PENALTY" },
            ],
            winCondition: "ENGINE_DEFINED",
        },
    },

    FRAUDSTER: {
        key: "FRAUDSTER",
        emoji: "🤹🏻",
        team: TEAMS.NEUTRAL,
        i18n: {
            name: { uz: "Aferist", eng: "Fraudster", ru: "Аферист" },
            description: {
                uz: "Kunduz kuni bir o‘yinchining ovozini aldab o‘g‘irlashingiz mumkin.",
                eng: "During the day you can steal a player’s vote (according to your rules).",
                ru: "Днём вы можете украсть голос игрока (по правилам игры).",
            },
        },
        defaults: { isAlive: true },
        abilities: {
            actions: [{ type: ACTIONS.STEAL_VOTE, phase: "DAY", target: "PLAYER", limit: 1 }],
        },
    },

    SUICIDE: {
        key: "SUICIDE",
        emoji: "🤦🏻",
        team: TEAMS.NEUTRAL,
        i18n: {
            name: { uz: "Suids", eng: "Suicide", ru: "Самоубийца" },
            description: {
                uz: "Agar sizni osishsa — yutasiz.",
                eng: "If you get lynched — you win.",
                ru: "Если вас казнят — вы побеждаете.",
            },
        },
        defaults: { isAlive: true },
        abilities: {
            actions: [],
            winCondition: "WIN_IF_LYNCHED",
        },
    },

    KAMIKAZE: {
        key: "KAMIKAZE",
        emoji: "💣",
        team: TEAMS.NEUTRAL,
        i18n: {
            name: { uz: "Kamikaze", eng: "Kamikaze", ru: "Камикадзе" },
            description: {
                uz: "Agar sizni osishsa, bir o‘yinchini o‘zingiz bilan olib ketasiz.",
                eng: "If you get lynched, you can take one player down with you.",
                ru: "Если вас казнят, вы можете забрать одного игрока с собой.",
            },
        },
        defaults: { isAlive: true },
        abilities: {
            actions: [{ type: ACTIONS.TAKE_DOWN_WITH_ME_ON_LYNCH, phase: "VOTING", target: "PLAYER", limit: 1 }],
            winCondition: "ENGINE_DEFINED",
        },
    },

    PARASITE: {
        key: "PARASITE",
        emoji: "🧥",
        team: TEAMS.NEUTRAL,
        i18n: {
            name: { uz: "Parazit", eng: "Parasite", ru: "Паразит" },
            description: {
                uz: "O‘lsangiz, sizni o‘ldirgan rolni egallaysiz (1 marta).",
                eng: "When you die, you take the role of whoever killed you (once).",
                ru: "Когда вы умираете, вы получаете роль того, кто вас убил (один раз).",
            },
        },
        defaults: { isAlive: true },
        abilities: {
            actions: [],
            effects: [{ type: ACTIONS.REVIVE_AS_KILLER_ROLE, trigger: "ON_DEATH", limit: 1 }],
        },
    },

    VAMPIRE: {
        key: "VAMPIRE",
        emoji: "🧛",
        team: TEAMS.SOLO,
        i18n: {
            name: { uz: "Qonxo‘r", eng: "Vampire", ru: "Вампир" },
            description: {
                uz: "Har 2 kechada 1 marta qon so‘rib, o‘sha kecha o‘lmay qolasiz.",
                eng: "Once every 2 nights you can ‘feed’ and become immune to death that night.",
                ru: "Раз в 2 ночи вы можете ‘выпить кровь’ и не умереть этой ночью.",
            },
        },
        defaults: { isAlive: true },
        abilities: {
            actions: [{ type: ACTIONS.VAMPIRIC_SHIELD, phase: "NIGHT", target: "SELF", limit: "EVERY_2_NIGHTS" }],
            winCondition: "ENGINE_DEFINED",
        },
    },

    MIRROR: {
        key: "MIRROR",
        emoji: "🪞",
        team: TEAMS.NEUTRAL,
        i18n: {
            name: { uz: "Ko‘zgu", eng: "Mirror", ru: "Зеркало" },
            description: {
                uz: "Sizga qilingan har qanday amal egasiga qaytadi. Siz faqat osishda o‘lasiz.",
                eng: "Any action targeting you is reflected back to its owner. You can only die by lynching.",
                ru: "Любое действие против вас отражается обратно. Вы можете умереть только от казни.",
            },
        },
        defaults: { isAlive: true },
        abilities: {
            actions: [],
            effects: [{ type: ACTIONS.REFLECT, trigger: "ON_TARGETED", duration: "ALWAYS" }],
            restrictions: [{ type: "CAN_ONLY_DIE_BY_LYNCH" }],
        },
    },

    BLOODY_WILL: {
        key: "BLOODY_WILL",
        emoji: "☠️",
        team: TEAMS.NEUTRAL,
        i18n: {
            name: { uz: "Qonli vasiyat", eng: "Bloody Will", ru: "Кровавое завещание" },
            description: {
                uz: "O‘lganda bir odamni tanlaysiz — u keyingi tongda o‘ladi.",
                eng: "When you die, you choose one person who will die the next morning.",
                ru: "Когда вы умираете, вы выбираете одного человека — он умрёт следующим утром.",
            },
        },
        defaults: { isAlive: true },
        abilities: {
            actions: [{ type: ACTIONS.CURSE_AFTER_DEATH, trigger: "ON_DEATH", target: "PLAYER", limit: 1 }],
        },
    },

    RANDOMIZER: {
        key: "RANDOMIZER",
        emoji: "🎲",
        team: TEAMS.NEUTRAL,
        i18n: {
            name: { uz: "Tasodifchi", eng: "Randomizer", ru: "Случайный" },
            description: {
                uz: "Har kecha tasodifiy rol (qobiliyat) olasiz.",
                eng: "Each night you receive a random role/ability.",
                ru: "Каждую ночь вы получаете случайную роль/способность.",
            },
        },
        defaults: { isAlive: true },
        abilities: {
            actions: [{ type: ACTIONS.RANDOM_ROLE_NIGHTLY, phase: "NIGHT", target: "SELF", limit: "ALWAYS" }],
        },
    },

    CLONE: {
        key: "CLONE",
        emoji: "🧬",
        team: TEAMS.SOLO,
        i18n: {
            name: { uz: "Klon", eng: "Clone", ru: "Клон" },
            description: {
                uz: "Har tunda bir o‘yinchini tanlaysiz. Agar u o‘lsa, uning rolini egallaysiz.",
                eng: "Each night you choose a player. If they die, you take their role.",
                ru: "Каждую ночь выбираете игрока. Если он умрёт — вы получите его роль.",
            },
        },
        defaults: { isAlive: true },
        abilities: {
            actions: [{ type: ACTIONS.CLONE_IF_TARGET_DIES, phase: "NIGHT", target: "PLAYER", limit: 1 }],
            winCondition: "SOLO_STYLE",
        },
    },

    COPIER: {
        key: "COPIER",
        emoji: "🗂",
        team: TEAMS.NEUTRAL,
        i18n: {
            name: { uz: "Nusxachi", eng: "Copier", ru: "Копировщик" },
            description: {
                uz: "1 marta boshqa rolni to‘liq ko‘chirib olib, o‘sha rol sifatida davom etasiz.",
                eng: "Once per game you can copy another role completely and continue as that role.",
                ru: "Один раз за игру вы можете полностью скопировать роль и продолжить как она.",
            },
        },
        defaults: { isAlive: true },
        abilities: {
            actions: [{ type: ACTIONS.COPY_ROLE, phase: "NIGHT", target: "PLAYER", limit: 1 }],
            effects: [{ type: "BECOME_TARGET_ROLE" }],
        },
    },

    TRAVELER: {
        key: "TRAVELER",
        emoji: "🏃🏻",
        team: TEAMS.SOLO,
        i18n: {
            name: { uz: "Sayohatchi", eng: "Traveler", ru: "Путешественник" },
            description: {
                uz: "Tunda bir o‘yinchining rolini 1 kechaga olib qo‘yasiz: u harakat qilolmaydi, siz esa uning rolida o‘ynaysiz.",
                eng: "At night you steal a player’s role for one night: they can’t act, and you act as their role.",
                ru: "Ночью вы забираете роль игрока на одну ночь: он не действует, а вы действуете как его роль.",
            },
        },
        defaults: { isAlive: true },
        abilities: {
            actions: [{ type: ACTIONS.TAKE_ROLE_ONE_NIGHT, phase: "NIGHT", target: "PLAYER", limit: 1 }],
            effects: [{ type: "TARGET_CANNOT_ACT_TONIGHT" }],
            winCondition: "SOLO_STYLE",
        },
    },

    WANDERER: {
        key: "WANDERER",
        emoji: "🧙🏻‍♂",
        team: TEAMS.NEUTRAL,
        i18n: {
            name: { uz: "Daydi", eng: "Wanderer", ru: "Бродяга" },
            description: {
                uz: "Tunda bir o‘yinchining uyiga borasiz va ba’zi hodisalarga guvoh bo‘lishingiz mumkin (engine qoidasi).",
                eng: "At night you visit a player and may witness events (defined by your engine rules).",
                ru: "Ночью вы навещаете игрока и можете стать свидетелем событий (по правилам движка).",
            },
        },
        defaults: { isAlive: true },
        abilities: {
            actions: [{ type: ACTIONS.WITNESS, phase: "NIGHT", target: "PLAYER", limit: 1 }],
        },
    },
});

// Helpers for easy usage in bot messages
function roleText(roleKey, lang = "eng") {
    const role = ROLES[roleKey];
    if (!role) return "Unknown role";
    const l = (lang === "uz" || lang === "ru" || lang === "eng") ? lang : "eng";
    return `Siz - ${role.emoji} ${role.i18n.name[l]}!\n\n${role.i18n.description[l]}`;
}

function allRoles(){
    
}

module.exports = { ROLES, TEAMS, ACTIONS, LANGS, roleText };
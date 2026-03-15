const ROLE_LANG = {

    DON: {
        uz: {
            name: "🤵🏻 Don",
            description: "Bu tunda kimdir o'lishini hal qilasiz. Siz mafialar boshlig'isiz.",
            ability: "Har kecha bitta o'yinchini o'ldirishni buyurasiz."
        },
        en: {
            name: "🤵🏻 Don",
            description: "You decide who dies at night. You are the leader of the mafia.",
            ability: "Each night you order the mafia to kill a player."
        },
        ru: {
            name: "🤵🏻 Дон",
            description: "Вы решаете кто умрёт ночью. Вы лидер мафии.",
            ability: "Каждую ночь выбираете игрока для убийства."
        }
    },

    MAFIA: {
        uz: {
            name: "🤵🏼 Mafiya",
            description: "Siz donning yordamchisisiz. Don o'lsa uning o'rnini egallaysiz.",
            ability: "Don bilan birga o'yinchilarni o'ldirasiz."
        },
        en: {
            name: "🤵🏼 Mafia",
            description: "You obey the Don. If the Don dies, you become the new Don.",
            ability: "You help kill players at night."
        },
        ru: {
            name: "🤵🏼 Мафиози",
            description: "Вы подчиняетесь Дону. Если Дон умирает — вы занимаете его место.",
            ability: "Помогаете мафии убивать игроков ночью."
        }
    },

    KILLER: {
        uz: {
            name: "🔪 Qotil",
            description: "Siz yakka rolsiz.",
            ability: "O'yinda sizdan boshqa hamma o'lishi kerak."
        },
        en: {
            name: "🔪 Killer",
            description: "You are a solo role.",
            ability: "Your goal is for everyone else to die."
        },
        ru: {
            name: "🔪 Убийца",
            description: "Вы одиночная роль.",
            ability: "Ваша цель — чтобы все остальные умерли."
        }
    },

    KOMISSAR: {
        uz: {
            name: "🕵🏻‍♂ Komissar",
            description: "Siz tinch aholining himoyachisisiz.",
            ability: "Har kecha bir o'yinchining rolini tekshirasiz."
        },
        en: {
            name: "🕵🏻‍♂ Commissar",
            description: "You protect the citizens.",
            ability: "Each night you check a player's role."
        },
        ru: {
            name: "🕵🏻‍♂ Комиссар",
            description: "Вы защитник мирных жителей.",
            ability: "Каждую ночь проверяете роль игрока."
        }
    },

    DOKTOR: {
        uz: {
            name: "🧑🏻‍⚕ Doktor",
            description: "Siz aholi tarafdasiz.",
            ability: "Har kecha bir o'yinchining jonini saqlab qolishingiz mumkin."
        },
        en: {
            name: "🧑🏻‍⚕ Doctor",
            description: "You are on the citizen team.",
            ability: "Each night you can save a player from death."
        },
        ru: {
            name: "🧑🏻‍⚕ Доктор",
            description: "Вы на стороне мирных жителей.",
            ability: "Каждую ночь можете спасти игрока."
        }
    },

    TINCH: {
        uz: {
            name: "🧑🏻 Tinch aholi",
            description: "Siz oddiy aholining birisiz.",
            ability: "Kunduzi ovoz berib mafiyani topishingiz kerak."
        },
        en: {
            name: "🧑🏻 Citizen",
            description: "You are a normal citizen.",
            ability: "Your goal is to vote out the mafia."
        },
        ru: {
            name: "🧑🏻 Мирный житель",
            description: "Вы обычный житель.",
            ability: "Ваша задача — голосованием найти мафию."
        }
    }

};

module.exports = ROLE_LANG;
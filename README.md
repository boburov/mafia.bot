# 🎭 Mafia Bot

A fully-featured **Telegram Mafia game bot** built with Node.js, [Telegraf](https://telegraf.js.org/), [Prisma](https://www.prisma.io/), PostgreSQL, and [BullMQ](https://docs.bullmq.io/). Supports multi-language gameplay, role-based night actions, day voting, and automatic phase timers — all resilient to bot restarts.

---

## ✨ Features

- 🎮 **Full Mafia game loop** — Lobby → Night → Day → Voting → repeat until win
- 🔐 **Role-based actions** — Don kills, Doctor heals, Commissar investigates
- 🗳️ **Day voting & revoting** — Tie → revote; second tie → no lynch
- ⏱️ **Phase timers via BullMQ** — Lobby 60s, Night 45s, Day 90s, Vote 45s
- ⚡ **Early resolution** — Night/vote resolves instantly when all players act
- 🌍 **Multi-language** — English, Russian, Uzbek (`/lang` command)
- 💾 **Restart-resilient** — All game state persisted in PostgreSQL via Prisma
- 🏦 **Economy system** — In-game money, rubies, defense, documents, equipment

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js (CommonJS) |
| Bot Framework | Telegraf v4 |
| Database | PostgreSQL + Prisma ORM |
| Job Queue | BullMQ |
| Cache / Queue Broker | Redis (ioredis) |
| Language | JavaScript (ES2020) |

---

## 📁 Project Structure

```
mafia.bot/
├── index.js                  # Entry point — boots bot, DB, workers
├── bot.js                    # Telegraf middleware & handler registration
├── prisma/
│   └── schema.prisma         # DB schema (User, Game, GamePlayer, etc.)
├── config/
│   └── db.js                 # Prisma client + DB connection
├── core/
│   ├── commands/             # Bot commands (/start, /lang, /create, /leave)
│   └── game/
│       ├── handlers.js       # Callback handlers (night actions, voting)
│       ├── role.dealer.js    # Role assignment + DM role cards
│       ├── night.collector.js# Collect & track night actions
│       ├── night.resolver.js # Resolve kills, heals, checks
│       ├── vote.service.js   # Voting logic, lynch, revote
│       ├── win.checker.js    # Win condition evaluation
│       └── state.service.js  # Atomic phase transitions
├── queue/
│   ├── queue.js              # BullMQ queue + scheduleJob / cancelJob
│   ├── workers.js            # BullMQ worker — all phase job handlers
│   └── redis.js              # ioredis connection config
├── middleware/
│   ├── getLanguage.js        # Per-user language middleware
│   └── language.changer.js  # t(lang, key, vars) translation helper
├── lang/
│   ├── eng.json              # English strings
│   ├── rus.json              # Russian strings
│   └── uz.json               # Uzbek strings
├── store/
│   └── roles.js              # Role definitions (emoji, i18n name/description)
└── constants/                # Shared constants
```

---

## 🎲 Roles

| Role | Team | Night Action |
|---|---|---|
| 🎩 **Don** | Mafia | Chooses a player to kill |
| 🔫 **Mafia** | Mafia | Passive — supports the Don |
| 🩺 **Doctor** | Civil | Heals one player (can't heal same target twice in a row) |
| 🕵️ **Commissar** | Civil | Investigates one player's role |
| 👤 **Civilian** | Civil | No night action — votes during the day |

**Role distribution formula:**
- `mafiaCount = max(2, round(N / 4))`
- 1 Don + (mafiaCount − 1) Mafia + 1 Doctor + 1 Commissar + rest Civilians
- Minimum **8 players** required to start

---

## 🔄 Game Flow

```
/create in group chat
        │
        ▼
   LOBBY (60s)
   Players join via inline button
        │
        ▼ (≥8 players)
   Roles assigned + DM'd to each player
        │
        ▼
   NIGHT (45s)
   Don → kill, Doctor → heal, Commissar → check
        │
        ▼
   DAY (90s)
   Night results announced, discussion
        │
        ▼
   VOTING (45s)
   Players vote to lynch; tie → revote (45s); second tie → no lynch
        │
        ▼
   Check win condition
   ├── Mafia ≥ Civil alive → Mafia wins 🎩
   ├── Mafia count = 0 → Civil wins 🏛️
   └── Continue → next NIGHT
```

---

## ⚙️ Setup & Installation

### Prerequisites

- Node.js ≥ 18
- PostgreSQL database
- Redis server

### 1. Clone & Install

```bash
git clone https://github.com/boburov/mafia.bot.git
cd mafia.bot
npm install
```

### 2. Configure Environment

Create a `.env` file in the project root:

```env
BOT_TOKEN=your_telegram_bot_token_here
DATABASE_URL=postgresql://user:password@localhost:5432/mafia_bot
REDIS_URL=redis://localhost:6379
```

> **Get a bot token** from [@BotFather](https://t.me/BotFather) on Telegram.

### 3. Run Database Migrations

```bash
npx prisma migrate deploy
```

Or for development (creates and applies migrations):

```bash
npx prisma migrate dev
```

### 4. Generate Prisma Client

```bash
npx prisma generate
```

### 5. Start the Bot

```bash
# Development (auto-restart on file changes)
npm run dev

# Production
npm start
```

---

## 🤖 Bot Commands

| Command | Context | Description |
|---|---|---|
| `/start` | Private | Start the bot, get welcome message |
| `/lang` | Private | Change your language (English / Русский / O'zbek) |
| `/create` | Group | Create a new Mafia game in this chat |
| `/leave` | Group | Leave the lobby before the game starts |

### In-Game Inline Actions

| Action | Who | When |
|---|---|---|
| **Join Game** | Any user | During lobby phase |
| **Start Now** | Game creator | During lobby (requires ≥8 players) |
| **Kill** (DM) | Don | During night phase |
| **Heal** (DM) | Doctor | During night phase |
| **Check** (DM) | Commissar | During night phase |
| **Vote** | All alive players | During voting phase |

---

## 🗄️ Database Schema

Key models in `prisma/schema.prisma`:

| Model | Purpose |
|---|---|
| `User` | Telegram user profile + economy (money, ruby, defense) |
| `User_equipment` | Items owned by a user |
| `Game` | Game session per chat (status, phase, day/night counters) |
| `GamePlayer` | Player in a game (role, alive status, protection) |
| `GameAction` | Night actions (KILL / HEAL / CHECK_ROLE) |
| `GameVote` | Day votes per player per round |
| `GameLog` | Audit log of game events (DEATH, HEAL, LYNCH, WIN, etc.) |

---

## 🔧 BullMQ Jobs

All phase transitions are driven by jobs in the `game` queue:

| Job | Delay | Trigger |
|---|---|---|
| `lobby-start` | 60 s | After `/create` |
| `night-timeout` | 45 s | After night opens |
| `day-timeout` | 90 s | After day starts |
| `vote-timeout` | 45 s | After voting opens |

Jobs are **idempotent** — each uses a unique job ID so duplicate triggers are safely ignored. Jobs are **cancelled early** when all players act before the timer expires.

---

## 🌍 Localization

Translations live in `lang/`:

| File | Language |
|---|---|
| `eng.json` | English |
| `rus.json` | Russian |
| `uz.json` | Uzbek (O'zbek) |

Use the `/lang` command to switch your personal language. The translation helper `t(lang, key, vars)` supports variable interpolation (e.g., `{{ name }}`, `{{ count }}`).

---

## 🚀 Deployment Tips

- Use **PM2** for process management in production:
  ```bash
  pm2 start index.js --name mafia-bot
  pm2 save
  ```
- Ensure Redis and PostgreSQL are running before starting the bot.
- The bot launches with `dropPendingUpdates: true` to avoid processing stale messages after a restart.
- Graceful shutdown is handled via `SIGINT` / `SIGTERM` signals.

---

## 📄 License

ISC © [Boburov](https://github.com/boburov)

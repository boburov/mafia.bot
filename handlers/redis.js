require("dotenv").config();
const IORedis = require("ioredis");

const connection = new IORedis(process.env.REDIS_URL || "redis://127.0.0.1:6379", {
  maxRetriesPerRequest: null,
});

connection.on("connect", () => console.log("✅ Redis connected"));
connection.on("error", (e) => console.log("❌ Redis error:", e?.message || e));

module.exports = { connection };

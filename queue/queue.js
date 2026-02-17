const { Queue } = require("bullmq");
const { connection } = require("./redis");

const gameQueue = new Queue("game", { connection });

module.exports = { gameQueue };

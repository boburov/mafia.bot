/**
 * config/test.config.js
 *
 * Set TEST_MODE=true in your .env to allow solo testing.
 * NEVER deploy with TEST_MODE=true.
 */

const IS_TEST = process.env.TEST_MODE === "true";

module.exports = {
    IS_TEST,
    MIN_PLAYERS: IS_TEST ? 1 : 4,
    TEST_ROLE: process.env.TEST_ROLE ?? null, // force a specific role e.g. "DON"
};
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
require("dotenv").config();
const { PrismaClient } = require("../src/generated/prisma");

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function connectDB() {
    try {
        await pool.query('SELECT 1');
        console.log('🐘 PostgreSQL connected via Adapter');
    } catch (err) {
        console.error('❌ Database connection error:', err);
        process.exit(1);
    }
}

async function disconnectDB() {
    await prisma.$disconnect();
    await pool.end();
    console.log('🔌 Database disconnected');
}

module.exports = { prisma, connectDB, disconnectDB };

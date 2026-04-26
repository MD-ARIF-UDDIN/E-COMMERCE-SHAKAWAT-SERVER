const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

// Initialize the PostgreSQL pool
const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL 
});

// Create the Prisma adapter
const adapter = new PrismaPg(pool);

// Initialize the Prisma Client with the adapter
const prisma = new PrismaClient({ adapter });

module.exports = prisma;

/**
 * Database Configuration
 *
 * Centralized Prisma client singleton to ensure a single database connection
 * is reused across the application, preventing connection pool exhaustion.
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

module.exports = prisma;

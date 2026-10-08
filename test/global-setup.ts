import { PrismaClient } from '@prisma/client';
import { execSync } from 'node:child_process';
import { getDatabaseName, getTestDatabaseUrl } from './test-database.js';

export default async function setup() {
  const testUrl = getTestDatabaseUrl();
  const name = getDatabaseName(testUrl);

  const adminUrl = new URL(testUrl);
  adminUrl.pathname = '/postgres';

  const admin = new PrismaClient({
    datasources: { db: { url: adminUrl.toString() } },
  });

  try {
    await admin.$executeRawUnsafe(
      `DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`,
    );
    await admin.$executeRawUnsafe(`CREATE DATABASE "${name}"`);
  } finally {
    await admin.$disconnect();
  }

  execSync('npx prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: testUrl },
    stdio: 'pipe',
  });
}

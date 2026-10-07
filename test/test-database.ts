import { existsSync } from 'node:fs';

const TEST_DATABASE_NAME = /^[a-z0-9_]+_test$/;

export function getTestDatabaseUrl(): string {
  if (existsSync('.env')) {
    process.loadEnvFile('.env');
  }

  const url = process.env.TEST_DATABASE_URL;

  if (!url) {
    throw new Error('TEST_DATABASE_URL is not set, see .env.example');
  }

  const name = getDatabaseName(url);

  if (!TEST_DATABASE_NAME.test(name)) {
    throw new Error(
      `Refusing to recreate "${name}": the test database name must end with "_test"`,
    );
  }

  return url;
}

export function getDatabaseName(url: string): string {
  return new URL(url).pathname.slice(1);
}

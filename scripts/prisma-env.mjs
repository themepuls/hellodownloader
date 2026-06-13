#!/usr/bin/env node
/**
 * Pick PostgreSQL (production) or SQLite (local file: DATABASE_URL) schema.
 * Usage: node scripts/prisma-env.mjs generate|push|studio|migrate
 */
import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const envPath = path.join(root, '.env');

function loadDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  if (!existsSync(envPath)) return '';
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    if (trimmed.startsWith('DATABASE_URL=')) {
      return trimmed.slice('DATABASE_URL='.length).trim().replace(/^["']|["']$/g, '');
    }
  }
  return '';
}

const cmd = process.argv[2];
if (!cmd) {
  console.error('Usage: node scripts/prisma-env.mjs <generate|push|studio|migrate|migrate-deploy>');
  process.exit(1);
}

const databaseUrl = loadDatabaseUrl();
const useSqlite =
  databaseUrl.startsWith('file:') || databaseUrl.endsWith('.db') || databaseUrl.includes('dev.db');
const schemaFile = useSqlite ? 'prisma/schema.sqlite.prisma' : 'prisma/schema.prisma';
const dbPkg = path.join(root, 'packages/database');

function resolveDatabaseUrl(url) {
  if (!url.startsWith('file:')) return url;
  const filePath = url.slice('file:'.length).replace(/^\.\//, '');
  if (path.isAbsolute(filePath)) return url;
  // file:./dev.db is relative to packages/database/prisma/schema.sqlite.prisma
  if (filePath === 'dev.db' || filePath === './dev.db') {
    return `file:${path.join(dbPkg, 'prisma/dev.db')}`;
  }
  // Monorepo-relative paths (legacy)
  return `file:${path.resolve(root, filePath)}`;
}

const resolvedDatabaseUrl = resolveDatabaseUrl(databaseUrl || process.env.DATABASE_URL || '');

console.log(`[prisma] ${cmd} via ${schemaFile} (${useSqlite ? 'SQLite' : 'PostgreSQL'})`);

const prismaCmd =
  cmd === 'migrate-deploy'
    ? 'migrate deploy'
    : cmd === 'migrate'
      ? 'migrate dev'
      : cmd === 'push'
        ? 'db push'
        : cmd;

const pushFlags =
  cmd === 'push' && process.env.PRISMA_ACCEPT_DATA_LOSS === '1' ? ' --accept-data-loss' : '';

execSync(`pnpm exec prisma ${prismaCmd} --schema=${schemaFile}${pushFlags}`, {
  cwd: dbPkg,
  stdio: 'inherit',
  env: { ...process.env, DATABASE_URL: resolvedDatabaseUrl },
});

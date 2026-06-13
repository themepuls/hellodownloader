const path = require('path');
const fs = require('fs');

const root = path.join(__dirname, '..');
const envPath = path.join(root, '.env');

function loadEnv() {
  if (!fs.existsSync(envPath)) return {};
  const out = {};
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const i = trimmed.indexOf('=');
    if (i === -1) continue;
    const key = trimmed.slice(0, i).trim();
    let val = trimmed.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

const env = { NODE_ENV: 'production', ...loadEnv() };
const useWorkers = env.USE_BULLMQ_DOWNLOADS === 'true' || env.USE_BULLMQ_THUMBNAILS === 'true';

const apps = [
  {
    name: 'hd-api',
    cwd: path.join(root, 'apps/api'),
    script: 'dist/main.js',
    env,
    max_memory_restart: '1500M',
    kill_timeout: 30000,
  },
  {
    name: 'hd-web',
    cwd: path.join(root, 'apps/web'),
    script: 'node_modules/next/dist/bin/next',
    args: 'start -p 3000',
    env,
    max_memory_restart: '800M',
  },
];

if (useWorkers && env.USE_BULLMQ_DOWNLOADS === 'true') {
  apps.push({
    name: 'hd-worker-download',
    cwd: path.join(root, 'apps/worker-download'),
    script: 'dist/index.js',
    env,
    max_memory_restart: '1500M',
    kill_timeout: 600000,
  });
}

if (useWorkers && env.USE_BULLMQ_THUMBNAILS === 'true') {
  apps.push({
    name: 'hd-worker-thumbnail',
    cwd: path.join(root, 'apps/worker-thumbnail'),
    script: 'dist/index.js',
    env,
    max_memory_restart: '1200M',
    kill_timeout: 600000,
  });
}

module.exports = { apps };

#!/usr/bin/env node
/**
 * Lance le backend (port 3000) et le frontend (port 3001) en local.
 * Usage: npm run dev   ou   node scripts/start.js
 */
const { spawn } = require('child_process');
const path = require('path');
const root = path.resolve(__dirname, '..');

const isWindows = process.platform === 'win32';

function run(cmd, args, cwd, env = {}) {
  const fullEnv = { ...process.env, ...env };
  const child = spawn(cmd, args, {
    cwd: path.join(root, cwd),
    env: fullEnv,
    shell: isWindows,
    stdio: 'inherit',
  });
  child.on('error', (err) => {
    console.error(`Erreur ${cwd}:`, err.message);
  });
  child.on('exit', (code) => {
    if (code !== 0 && code !== null) process.exit(code);
  });
  return child;
}

console.log('Démarrage Captivia en local...');
console.log('  Frontend: http://localhost:3000');
console.log('  Backend:  http://localhost:3001');
console.log('');

run('npm', ['run', 'start:dev'], 'backend', { PORT: '3001' });
setTimeout(() => {
  run('npm', ['run', 'dev'], 'frontend', {
    NEXT_PUBLIC_API_URL: 'http://localhost:3001',
    PORT: '3000',
  });
}, 2000);

#!/usr/bin/env node
import { exec } from 'child_process';
import { watch } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

let child: ReturnType<typeof exec> | null = null;

function startWorker() {
  if (child) {
    child.kill();
  }
  console.log('Starting email worker...');
  child = exec('node dist/email-worker.js', { cwd: rootDir });
  child.stdout?.pipe(process.stdout);
  child.stderr?.pipe(process.stderr);
}

console.log('Watching src/email-worker.ts and src/email/...');
startWorker();

watch(join(rootDir, 'src/email-worker.ts'), () => {
  console.log('email-worker.ts changed, rebuilding...');
  exec('npx tsc -p tsconfig.build.json', { cwd: rootDir }, () => {
    startWorker();
  });
});

watch(join(rootDir, 'src/email'), { recursive: true }, () => {
  console.log('src/email/ changed, rebuilding...');
  exec('npx tsc -p tsconfig.build.json', { cwd: rootDir }, () => {
    startWorker();
  });
});

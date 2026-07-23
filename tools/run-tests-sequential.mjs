import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const testsDir = resolve(process.cwd(), 'tests');
const files = readdirSync(testsDir)
  .filter(name => name.endsWith('.test.mjs'))
  .sort();

if (!files.length) {
  console.error('No regression test files found.');
  process.exit(1);
}

for (const file of files) {
  const path = resolve(testsDir, file);
  console.log(`\n===== ${file} =====`);
  const result = spawnSync(
    process.execPath,
    ['--test', '--test-force-exit', path],
    { stdio: 'inherit', env: process.env }
  );

  if (result.error) {
    console.error(`Failed to start ${file}:`, result.error);
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error(`Regression failed: ${file}`);
    process.exit(result.status || 1);
  }
}

console.log(`\nAll ${files.length} Amy FX regression files passed.`);

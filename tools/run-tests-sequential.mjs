import { readdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const testsDir = resolve(process.cwd(), 'tests');
const failureReportPath = resolve(process.cwd(), 'preview-regression-failure.txt');
const files = readdirSync(testsDir)
  .filter(name => name.endsWith('.test.mjs'))
  .sort();

if (!files.length) {
  console.error('No regression test files found.');
  process.exit(1);
}

const excerpt = (text, maxLines = 220) => String(text || '')
  .split(/\r?\n/)
  .slice(-maxLines)
  .join('\n')
  .trim();

for (const file of files) {
  const path = resolve(testsDir, file);
  const result = spawnSync(
    process.execPath,
    ['--test', '--test-force-exit', path],
    {
      encoding: 'utf8',
      env: process.env,
      maxBuffer: 32 * 1024 * 1024
    }
  );

  if (result.error) {
    const report = [
      `Regression failed to start: ${file}`,
      result.error.stack || result.error.message || String(result.error)
    ].join('\n');
    writeFileSync(failureReportPath, `${report}\n`, 'utf8');
    console.error(report);
    process.exit(1);
  }

  if (result.status !== 0) {
    const combined = [result.stdout, result.stderr].filter(Boolean).join('\n');
    const report = [
      `Regression failed: ${file}`,
      `Exit status: ${result.status ?? 'unknown'}`,
      '',
      excerpt(combined) || 'Test process returned no output.'
    ].join('\n');
    writeFileSync(failureReportPath, `${report}\n`, 'utf8');
    console.error(report);
    process.exit(result.status || 1);
  }

  console.log(`PASS ${file}`);
}

console.log(`All ${files.length} Amy FX regression files passed.`);

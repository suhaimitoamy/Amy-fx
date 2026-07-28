import { readdirSync, writeFileSync } from 'node:fs';
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

function persistPrivateDiagnostic(file, result) {
  if (process.env.GITHUB_ACTIONS !== 'true' || process.env.GITHUB_REF_NAME !== 'personal/amyfx-private') return;
  const outputPath = resolve(process.cwd(), 'tools/amyfx-honesty-audit/regression-diagnostic.log');
  const report = [
    `commit=${process.env.GITHUB_SHA || ''}`,
    `failed_test=${file}`,
    `exit_code=${result.status ?? 1}`,
    `captured_at=${new Date().toISOString()}`,
    '',
    result.stdout || '',
    result.stderr || ''
  ].join('\n');
  writeFileSync(outputPath, report, 'utf8');

  const commands = [
    ['config', 'user.name', 'amyfx-audit-bot'],
    ['config', 'user.email', 'actions@users.noreply.github.com'],
    ['add', 'tools/amyfx-honesty-audit/regression-diagnostic.log'],
    ['commit', '-m', 'ci: record failing regression [skip ci]'],
    ['push', 'origin', 'HEAD:personal/amyfx-private']
  ];
  for (const args of commands) {
    const git = spawnSync('git', args, { encoding: 'utf8' });
    if (git.stdout) process.stdout.write(git.stdout);
    if (git.stderr) process.stderr.write(git.stderr);
    if (git.status !== 0) break;
  }
}

for (const file of files) {
  const path = resolve(testsDir, file);
  console.log(`\n===== ${file} =====`);
  const result = spawnSync(
    process.execPath,
    ['--test', '--test-force-exit', path],
    { encoding: 'utf8', env: process.env }
  );

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error) {
    console.error(`Failed to start ${file}:`, result.error);
    persistPrivateDiagnostic(file, result);
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error(`Regression failed: ${file}`);
    persistPrivateDiagnostic(file, result);
    process.exit(result.status || 1);
  }
}

console.log(`\nAll ${files.length} Amy FX regression files passed.`);

#!/usr/bin/env node

import { spawnSync } from 'node:child_process';

const BASELINE_MIGRATION = process.env.PRISMA_BASELINE_MIGRATION ?? '20260422120000_init';

// Resolve the prisma binary directly so we don't depend on `npx` (not available
// on local-dev systems that only ship `pnpm`). Render production has `npx`.
const PRISMA_BIN = process.env.PRISMA_BIN ?? (process.platform === 'win32'
  ? 'node_modules/.bin/prisma.cmd'
  : 'node_modules/.bin/prisma');

function runPrisma(args) {
  const result = spawnSync(PRISMA_BIN, args, {
    stdio: 'pipe',
    encoding: 'utf8',
    env: process.env,
  });

  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  if (output.trim().length > 0) {
    process.stdout.write(output);
  }
  return { exitCode: result.status ?? 1, output };
}

const firstDeploy = runPrisma(['migrate', 'deploy']);
if (firstDeploy.exitCode === 0) {
  process.exit(0);
}

if (!firstDeploy.output.includes('P3005')) {
  process.exit(firstDeploy.exitCode);
}

console.log(
  `Detected Prisma P3005 (non-empty schema). Baseline migration "${BASELINE_MIGRATION}" will be marked as applied.`,
);

const baseline = runPrisma(['migrate', 'resolve', '--applied', BASELINE_MIGRATION]);
if (baseline.exitCode !== 0) {
  process.exit(baseline.exitCode);
}

const secondDeploy = runPrisma(['migrate', 'deploy']);
process.exit(secondDeploy.exitCode);

#!/usr/bin/env node
// Qualification for a trusted checkout. The test sandbox is not an adversarial boundary.
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { chmodSync, copyFileSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { acquireGateLane, GATE_LANE_PORT } from './gate-lane-lock.mjs';
import { fileURLToPath } from 'node:url';
import { checkDependencyRoot } from './gate-lane-hermeticity.mjs';

export function candidate(root) {
  const git = (...args) => {
    const r = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
    if (r.status !== 0) throw new Error(r.stderr || `git ${args.join(' ')} failed`);
    return r.stdout.trim();
  };
  return { head: git('rev-parse', 'HEAD'), tree: git('rev-parse', 'HEAD^{tree}'), dirty: git('status', '--porcelain', '--untracked-files=all') };
}

export function requireCandidate(actual, expected) {
  if (actual.dirty) throw new Error(`Candidate has tracked or untracked changes:\n${actual.dirty}`);
  if (actual.head !== expected.head || actual.tree !== expected.tree) throw new Error('Candidate HEAD/tree changed during local CI');
}

// Injectable execution keeps orchestration tests tiny without providing a CLI skip mode.
export function qualify({ root, stages, inspect = candidate, execute = spawnSync, validate = () => {}, finalCheck = () => {} }) {
  const initial = inspect(root);
  const out = join(root, 'dist', 'local-ci', initial.head);
  mkdirSync(out, { recursive: true });
  const receipt = { version: 1, status: 'FAIL', candidate: { head: initial.head, tree: initial.tree },
    platform: process.platform, node: process.version, startedAt: new Date().toISOString(),
    requiredStages: [], stages: [] };
  const save = () => writeFileSync(join(out, 'receipt.json'), `${JSON.stringify(receipt, null, 2)}\n`);
  save(); // Immediately invalidate a previous PASS, including on preflight refusal.
  try {
    requireCandidate(initial, initial);
    validate();
    const stageList = typeof stages === 'function' ? stages() : stages;
    receipt.requiredStages = stageList.map(stage => ({ name: stage.name, argv: stage.argv }));
    save();
    if (!stageList.length) throw new Error('No qualification stages');
    for (const [index, stage] of stageList.entries()) {
      const logPath = join(out, `${String(index + 1).padStart(2, '0')}-${stage.name}.log`);
      const entry = { name: stage.name, argv: stage.argv, status: 'RUNNING', startedAt: new Date().toISOString(), log: logPath };
      receipt.stages.push(entry);
      save();
      console.log(`[local-ci] ${stage.name}: ${stage.argv.join(' ')}`);
      const result = execute(stage.argv[0], stage.argv.slice(1), { cwd: root, env: stage.env, encoding: 'utf8', maxBuffer: 128 * 1024 * 1024 });
      writeFileSync(logPath, `${result.stdout ?? ''}${result.stderr ?? ''}${result.error ? `\n${result.error.stack ?? result.error}` : ''}`);
      Object.assign(entry, { endedAt: new Date().toISOString(), exitCode: result.status, signal: result.signal ?? null, status: result.status === 0 && !result.error && !result.signal ? 'PASS' : 'FAIL' });
      save();
      if (entry.status !== 'PASS') throw new Error(`${stage.name} failed (exit ${result.status}, signal ${result.signal ?? 'none'}); see ${logPath}`);
      try { stage.after?.(); } catch (error) { entry.status = 'FAIL'; entry.error = error.stack ?? String(error); save(); throw error; }
    }
    finalCheck();
    requireCandidate(inspect(root), initial);
    if (receipt.stages.length !== stageList.length || receipt.stages.some(stage => stage.status !== 'PASS')) throw new Error('Incomplete qualification');
    receipt.status = 'PASS';
  } catch (error) {
    receipt.error = error.stack ?? String(error);
  } finally {
    receipt.endedAt = new Date().toISOString();
    save();
  }
  return receipt;
}

export function prepareLocalPs(suite, { copy = copyFileSync, execute = spawnSync } = {}) {
  const target = join(suite, 'bin', 'ps');
  const original = readFileSync('/bin/ps');
  copy('/bin/ps', target);
  if (!readFileSync(target).equals(original)) throw new Error('Local ps copy differs from /bin/ps before signing');
  chmodSync(target, 0o755);
  const command = ['/usr/bin/codesign', '--force', '--sign', '-', '--timestamp=none', target];
  const codesign = args => {
    const result = execute('/usr/bin/codesign', args, { encoding: 'utf8', env: { PATH: '/usr/bin:/bin' } });
    if (result.status !== 0 || result.error || result.signal) throw new Error(`Local ps codesign failed: ${JSON.stringify(args)}: ${result.error?.message ?? result.stderr ?? result.signal ?? result.status}`);
    return result;
  };
  codesign(command.slice(1));
  codesign(['--verify', '--strict', target]);
  const description = codesign(['-d', '--verbose=4', target]);
  if (!/^Signature=adhoc$/m.test(description.stderr ?? '')) throw new Error('Local ps copy must have an ad-hoc signature');
  const entitlements = codesign(['-d', '--entitlements', '-', target]);
  if ((entitlements.stdout ?? '') !== '') throw new Error('Local ps copy must have no entitlements');
  const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
  const originalSha256 = sha256(original);
  const provenance = { sha256: sha256(readFileSync(target)), originalSha256, preSignSha256: originalSha256, command, signature: 'adhoc' };
  console.log('LOCAL_CI_PS_PROVENANCE ' + JSON.stringify(provenance));
  return provenance;
}

export function localStages(root, scratch, dockerHost, preparePs = prepareLocalPs) {
  const path = [dirname(process.execPath), '/opt/homebrew/bin', '/usr/local/bin', '/usr/bin', '/bin', '/usr/sbin', '/sbin'].join(':');
  const buildHome = join(scratch, 'build-home');
  const suite = join(scratch, 'suite');
  for (const directory of [buildHome, join(suite, 'home'), join(suite, 'bin')]) mkdirSync(directory, { recursive: true });
  const ps = preparePs(suite);
  const env = { HOME: buildHome, PATH: path, TMPDIR: scratch, CI: 'true', TERM: 'xterm-256color' };
  const suiteEnv = { HOME: join(suite, 'home'), PATH: path, TMPDIR: suite, TMUX_TMPDIR: suite, OPENRIG_CI_PS_COPY_SHA256: ps.sha256, OPENRIG_CI_PS_PROVENANCE: JSON.stringify(ps), CI: 'true', TERM: 'xterm-256color' };
  const profile = '(version 1)(allow default)(deny network-outbound)(allow network-outbound (remote ip "localhost:*"))(allow network-outbound (subpath (param "IPC_ROOT")))';
  const command = (name, argv, extra = {}) => ({ name, argv, env, ...extra });
  const test = (name, args) => command(name, ['/usr/bin/sandbox-exec', '-D', `IPC_ROOT=${suite}`, '-p', profile, '/bin/bash', '-c',
    'set -euo pipefail; node scripts/ci-macos-process-probe.mjs; export PATH="$TMPDIR/bin:$PATH"; exec "$@"', 'local-ci', 'npm', ...args], { env: suiteEnv });
  return [
    command('install', ['npm', 'ci'], { after: () => checkDependencyRoot(root) }),
    command('build', ['npm', 'run', 'build']),
    command('lint', ['npm', 'run', 'lint']),
    command('repo-tests', ['npm', 'run', 'test:repo']),
    ...['daemon', 'cli', 'tui', 'ui'].map(pkg => test(`test-${pkg}`, ['run', 'test', '-w', `packages/${pkg}`])),
    ...['cli', 'daemon', 'tui'].map(pkg => command(`pack-${pkg}`, ['npm', 'pack', '--dry-run', '--ignore-scripts', '--json', '-w', `packages/${pkg}`])),
    command('installed-scenarios', ['bash', 'scripts/run-pr-scenarios.sh', '--local'], { env: { ...env, DOCKER_HOST: dockerHost } }),
  ];
}

export function checkExistingDependencies(root) {
  try { lstatSync(join(root, 'node_modules')); }
  catch (error) { if (error.code === 'ENOENT') return; throw error; }
  checkDependencyRoot(root);
}

export async function withLocalCiLane(action, { port = GATE_LANE_PORT, holderInfoPath = join(tmpdir(), 'openrig-gate', 'gate-lane.holder.json') } = {}) {
  const lane = await acquireGateLane({ port, holderInfoPath });
  if (!lane.ok) throw new Error(`Local CI gate lane refused on port ${port}: ${lane.reason}${lane.message ? ': ' + lane.message : ''}`);
  try { return await action(); } finally { await lane.release(); }
}

async function main() {
  const root = realpathSync(resolve(dirname(fileURLToPath(import.meta.url)), '..'));
  await withLocalCiLane(() => {
    // Use /private/tmp on macOS so sandbox socket paths have no /tmp symlink alias.
    const scratch = realpathSync(mkdtempSync('/private/tmp/openrig-local-ci-'));
    try {
      const receipt = qualify({ root, stages: () => localStages(root, scratch, process.env.DOCKER_HOST), validate: () => {
        checkExistingDependencies(root);
        if (process.argv.length !== 2) throw new Error('ci:local accepts no skip or smoke options');
        if (process.platform !== 'darwin' || ![22, 24].includes(Number(process.versions.node.split('.')[0]))) throw new Error('ci:local requires macOS with Node 22 or 24');
        if (process.env.DOCKER_CONTEXT || !/^unix:\/\/\//.test(process.env.DOCKER_HOST ?? '')) throw new Error('Select a running local Docker engine with explicit DOCKER_HOST=unix:///... and unset DOCKER_CONTEXT');
      }, finalCheck: () => checkDependencyRoot(root) });
      console.log(`[local-ci] ${receipt.status}: ${join(root, 'dist', 'local-ci', receipt.candidate.head, 'receipt.json')}`);
      if (receipt.error) console.error(receipt.error);
      process.exitCode = receipt.status === 'PASS' ? 0 : 1;
    } finally { rmSync(scratch, { recursive: true, force: true }); }
  });
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => { console.error(error.message); process.exitCode = 1; });

import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { localStages, qualify, requireCandidate } from './local-ci.mjs';

const clean = { head: 'abc123', tree: 'tree123', dirty: '' };
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'local-ci-test-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return { root, inspect: () => clean };
}
const step = (name, code = 0) => ({ name, argv: [process.execPath, '-e', `console.log('stage output'); process.exit(${code})`], env: {} });
const stored = root => JSON.parse(readFileSync(join(root, 'dist/local-ci/abc123/receipt.json'), 'utf8'));

test('a real failing subprocess stops the run and records actual failure and output', t => {
  const options = fixture(t);
  const receipt = qualify({ ...options, stages: [step('first'), step('broken', 7), step('unrun')] });
  assert.equal(receipt.status, 'FAIL');
  assert.deepEqual(receipt.stages.map(s => [s.name, s.status, s.exitCode]), [['first', 'PASS', 0], ['broken', 'FAIL', 7]]);
  assert.match(receipt.error, /broken failed/);
  assert.match(readFileSync(receipt.stages[1].log, 'utf8'), /stage output/);
  assert.equal(stored(options.root).status, 'FAIL');
});

test('no stages and a skipped/null-status subprocess cannot pass', t => {
  const options = fixture(t);
  assert.equal(qualify({ ...options, stages: [] }).status, 'FAIL');
  const receipt = qualify({ ...options, stages: [step('skipped')], execute: () => ({ status: null }) });
  assert.equal(receipt.status, 'FAIL');
});

test('changed HEAD or tree invalidates an otherwise successful run', t => {
  for (const changed of [{ ...clean, head: 'other' }, { ...clean, tree: 'other' }, { ...clean, dirty: '?? unexpected' }]) {
    const options = fixture(t);
    let calls = 0;
    const receipt = qualify({ ...options, stages: [step('pass')], inspect: () => calls++ ? changed : clean });
    assert.equal(receipt.status, 'FAIL');
  }
});

test('dirty refusal replaces a stale PASS before executing any command', t => {
  const options = fixture(t);
  assert.equal(qualify({ ...options, stages: [step('pass')] }).status, 'PASS');
  let executed = false;
  const receipt = qualify({ ...options, stages: [step('never')], inspect: () => ({ ...clean, dirty: ' M package.json' }), execute: () => { executed = true; } });
  assert.equal(executed, false);
  assert.equal(receipt.status, 'FAIL');
  assert.match(receipt.error, /Candidate has tracked or untracked changes/);
  assert.equal(stored(options.root).status, 'FAIL');
});

test('spawn errors fail even when an executor reports exit zero', t => {
  const options = fixture(t);
  const receipt = qualify({ ...options, stages: [step('spawn-error')], execute: () => ({ status: 0, error: new Error('spawn broke') }) });
  assert.equal(receipt.status, 'FAIL');
  assert.match(readFileSync(receipt.stages[0].log, 'utf8'), /spawn broke/);
  assert.throws(() => requireCandidate({ ...clean, head: 'different' }, clean), /changed/);
});

test('production plan contains every suite, package inventory and full scenario with minimal environments', t => {
  const { root } = fixture(t);
  const stages = localStages(root, root, 'unix:///selected/docker.sock');
  assert.deepEqual(stages.map(stage => stage.name), [
    'install', 'build', 'lint', 'repo-tests', 'test-daemon', 'test-cli', 'test-tui', 'test-ui',
    'pack-cli', 'pack-daemon', 'pack-tui', 'installed-scenarios',
  ]);
  for (const stage of stages) {
    assert.deepEqual(Object.keys(stage.env).sort(), (stage.name.startsWith('test-') || stage.name === 'repo-tests'
      ? ['HOME', 'PATH', 'TMPDIR', 'TMUX_TMPDIR', 'CI', 'TERM']
      : stage.name === 'installed-scenarios' ? ['HOME', 'PATH', 'TMPDIR', 'CI', 'TERM', 'DOCKER_HOST']
      : ['HOME', 'PATH', 'TMPDIR', 'CI', 'TERM']).sort());
  }
  const suite = stages.find(stage => stage.name === 'test-ui');
  assert.equal(suite.argv[0], '/usr/bin/sandbox-exec');
  assert.match(suite.argv[7], /process-probe.*export PATH/s);
  assert.deepEqual(stages.at(-1).argv, ['bash', 'scripts/run-pr-scenarios.sh', '--local']);
});

test('post-install ownership rejection marks stage failed and stops execution', t => {
  const options = fixture(t);
  const receipt = qualify({ ...options, stages: [
    { ...step('install'), after: () => { throw new Error('dependencies escaped worktree'); } }, step('never'),
  ] });
  assert.equal(receipt.status, 'FAIL');
  assert.equal(receipt.stages.length, 1);
  assert.equal(receipt.stages[0].status, 'FAIL');
  assert.match(receipt.stages[0].error, /dependencies escaped/);
});

test('final ownership rejection replaces stale PASS despite passing subprocesses', t => {
  const options = fixture(t);
  const stages = [step('successful')];
  assert.equal(qualify({ ...options, stages }).status, 'PASS');
  const receipt = qualify({ ...options, stages, finalCheck: () => { throw new Error('final dependency ownership mismatch'); } });
  assert.equal(receipt.status, 'FAIL');
  assert.match(receipt.error, /final dependency ownership mismatch/);
  assert.equal(stored(options.root).status, 'FAIL');
});

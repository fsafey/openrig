import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import net from 'node:net';
import { localStages, prepareLocalPs, qualify, requireCandidate, withLocalCiLane } from './local-ci.mjs';

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
  const stages = localStages(root, root, 'unix:///selected/docker.sock', () => ({ sha256: 'signed-copy-hash' }));
  assert.deepEqual(stages.map(stage => stage.name), [
    'install', 'build', 'lint', 'repo-tests', 'test-daemon', 'test-cli', 'test-tui', 'test-ui',
    'pack-cli', 'pack-daemon', 'pack-tui', 'installed-scenarios',
  ]);
  for (const stage of stages) {
    assert.deepEqual(Object.keys(stage.env).sort(), (stage.name.startsWith('test-')
      ? ['HOME', 'PATH', 'TMPDIR', 'TMUX_TMPDIR', 'OPENRIG_CI_PS_COPY_SHA256', 'OPENRIG_CI_PS_PROVENANCE', 'CI', 'TERM']
      : stage.name === 'installed-scenarios' ? ['HOME', 'PATH', 'TMPDIR', 'CI', 'TERM', 'DOCKER_HOST']
      : ['HOME', 'PATH', 'TMPDIR', 'CI', 'TERM']).sort());
  }
  const repo = stages.find(stage => stage.name === 'repo-tests');
  assert.deepEqual(repo.argv, ['npm', 'run', 'test:repo']);
  assert.match(repo.env.HOME, /build-home$/);
  const suite = stages.find(stage => stage.name === 'test-ui');
  assert.equal(suite.env.OPENRIG_CI_PS_COPY_SHA256, 'signed-copy-hash');
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

test('contending invocation cannot enter qualification or alter existing evidence and dependencies', async t => {
  const { root } = fixture(t);
  const probe = net.createServer();
  await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
  const port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  const options = { port, holderInfoPath: join(root, 'holder.json') };
  const evidence = join(root, 'receipt.json');
  const dependencies = join(root, 'dependencies');
  await withLocalCiLane(async () => {
    writeFileSync(evidence, 'first evidence');
    writeFileSync(dependencies, 'first dependencies');
    await assert.rejects(withLocalCiLane(() => {
      writeFileSync(evidence, 'overwritten');
      writeFileSync(dependencies, 'overwritten');
      assert.fail('contender entered qualification');
    }, options), /gate lane refused/);
    assert.equal(readFileSync(evidence, 'utf8'), 'first evidence');
    assert.equal(readFileSync(dependencies, 'utf8'), 'first dependencies');
  }, options);
  await withLocalCiLane(() => {}, options); // finally released the shared lane.
});

test('ps preparation refuses byte mismatch before signing and propagates sign/verify failures', t => {
  const { root } = fixture(t);
  mkdirSync(join(root, 'bin'));
  let executed = false;
  assert.throws(() => prepareLocalPs(root, {
    copy: (_source, target) => writeFileSync(target, 'wrong bytes'),
    execute: () => { executed = true; },
  }), /differs from.*before signing/);
  assert.equal(executed, false);
  for (const failAt of [0, 1]) {
    let calls = 0;
    assert.throws(() => prepareLocalPs(root, {
      execute: (command, args) => {
        assert.equal(command, '/usr/bin/codesign');
        assert.equal(args.at(-1), join(root, 'bin', 'ps'));
        return { status: calls++ === failAt ? 1 : 0, stderr: 'signature failure' };
      },
    }), /codesign failed.*signature failure/);
    assert.equal(calls, failAt + 1);
  }
});

test('ps preparation rejects signatures with privileged entitlements', t => {
  const { root } = fixture(t);
  mkdirSync(join(root, 'bin'));
  assert.throws(() => prepareLocalPs(root, {
    execute: (_command, args) => ({ status: 0, stderr: 'Signature=adhoc', stdout: args.includes('--entitlements') ? '<plist>privileged</plist>' : '' }),
  }), /must have no entitlements/);
});

test('stage preparation failure invalidates stale PASS before preparation starts', t => {
  const options = fixture(t);
  assert.equal(qualify({ ...options, stages: [step('successful')] }).status, 'PASS');
  const receipt = qualify({ ...options, stages: () => {
    assert.equal(stored(options.root).status, 'FAIL');
    throw new Error('ps preparation failed');
  } });
  assert.equal(receipt.status, 'FAIL');
  assert.match(receipt.error, /ps preparation failed/);
  assert.equal(stored(options.root).status, 'FAIL');
});

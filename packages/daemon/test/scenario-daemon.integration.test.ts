import { describe, it, expect, afterEach } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { existsSync } from "node:fs";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { prepareHermeticEnv, type HermeticScaffold } from "./helpers/hermetic-env.js";
import {
  spawnScenarioDaemon,
  runRig,
  findFreePort,
  type ScenarioDaemon,
} from "./helpers/scenario-daemon.js";

// Slice 51-02 — the forced-local daemon SPAWN (the last hermetic-helper unit).
// Integration: the helper spawns a REAL scenario-local daemon (the built `rig`
// bin) under the scrubbed scratch env, the shipped `rig ps --json` read works
// against it, and stop() tears it down. This is the foundation of proof item 2
// (live round-trip) proven at a real process boundary — the whole point of the
// fail-closed helper (a direct method call would not be a transport proof).
//
// Contention note: spawns a real daemon (seconds); a free port avoids collisions.
// Under heavy fleet load the start/healthz wait can be slow — bounded by timeout.

const HERE = dirname(fileURLToPath(import.meta.url));
const RIG_BIN = resolve(HERE, "../../cli/dist/bin-wrapper.js");

function realBaseEnv() {
  return { HOME: process.env.HOME, PATH: process.env.PATH, TERM: "xterm" };
}

describe("scenario-daemon forced-local spawn (integration)", () => {
  let scaffold: HermeticScaffold | undefined;
  let daemon: ScenarioDaemon | undefined;

  afterEach(async () => {
    if (daemon) await daemon.stop().catch(() => {});
    else if (scaffold) scaffold.cleanup();
    daemon = undefined;
    scaffold = undefined;
  });

  it("findFreePort returns a usable ephemeral port", async () => {
    const p = await findFreePort();
    expect(p).toBeGreaterThan(0);
    expect(p).toBeLessThan(65536);
  });

  it("names the missing CLI build instead of a Node module error when the rig bin is absent", async () => {
    scaffold = prepareHermeticEnv({ baseEnv: realBaseEnv() });
    const missing = resolve(HERE, "../../cli/dist/no-such-bin-wrapper.js");
    await expect(spawnScenarioDaemon(scaffold, { rigBin: missing })).rejects.toThrow(
      /the rig CLI is not built at .*no-such-bin-wrapper\.js\. Run `npm run build`/,
    );
  });

  it("spawns a real forced-local daemon, serves the ps read, and tears it down", async () => {
    scaffold = prepareHermeticEnv({ baseEnv: realBaseEnv() });
    daemon = await spawnScenarioDaemon(scaffold, { rigBin: RIG_BIN });

    // /healthz is up on the helper's OWN daemon
    const health = await fetch(`${daemon.baseUrl}/healthz`);
    expect(health.ok).toBe(true);

    // the shipped read works against the scenario-local daemon (bare array = empty rig set)
    const ps = await runRig(["ps", "--json"], daemon.readEnv, RIG_BIN);
    expect(ps.code).toBe(0);
    const parsed = JSON.parse(ps.stdout);
    expect(Array.isArray(parsed)).toBe(true);

    // teardown: the daemon is gone (connection refused), scaffold removed
    const baseUrl = daemon.baseUrl;
    await daemon.stop();
    daemon = undefined;
    await expect(fetch(`${baseUrl}/healthz`)).rejects.toThrow();
  }, 60_000);

  it("readEnv points at the helper's own daemon, never a foreign target", async () => {
    scaffold = prepareHermeticEnv({ baseEnv: realBaseEnv() });
    daemon = await spawnScenarioDaemon(scaffold, { rigBin: RIG_BIN });
    expect(daemon.readEnv.OPENRIG_URL).toBe(daemon.baseUrl);
    expect(daemon.baseUrl).toContain("127.0.0.1");
  }, 60_000);

  // Proof item 8 (the daemon-lifecycle A1 verb): sigterm kills the scenario-local
  // daemon; restart re-spawns it through the SAME guarantees (same port/scratch).
  it("daemon sigterm kills the scenario-local daemon (healthz refused)", async () => {
    scaffold = prepareHermeticEnv({ baseEnv: realBaseEnv() });
    daemon = await spawnScenarioDaemon(scaffold, { rigBin: RIG_BIN });
    expect((await fetch(`${daemon.baseUrl}/healthz`)).ok).toBe(true);
    await daemon.sigterm();
    await expect(fetch(`${daemon.baseUrl}/healthz`)).rejects.toThrow();
  }, 60_000);

  // #3631: once the first stop removed daemon.json, a repeated stop (sigterm then afterEach stop) ran with the scrubbed
  // scaffold env and checked the CLI's configured default daemon, 127.0.0.1:7433, the machine's own. A decoy stands in for
  // that default (OPENRIG_PORT) and must receive nothing: every stop addresses only this daemon's own URL.
  it("a repeated stop never reaches the CLI's default daemon port", async () => {
    scaffold = prepareHermeticEnv({ baseEnv: realBaseEnv() });
    daemon = await spawnScenarioDaemon(scaffold, { rigBin: RIG_BIN });
    await daemon.sigterm();
    await expect(fetch(`${daemon.baseUrl}/healthz`)).rejects.toThrow();
    expect(existsSync(join(scaffold.openrigHome, "daemon.json"))).toBe(false);

    const hits: string[] = [];
    const decoy = createServer((req, res) => {
      hits.push(`${req.method} ${req.url}`);
      res.writeHead(503).end();
    });
    await new Promise<void>((done) => decoy.listen(0, "127.0.0.1", done));
    // Set only after the spawn: the helper refuses a scaffold env that carries a daemon target.
    scaffold.env.OPENRIG_PORT = String((decoy.address() as AddressInfo).port);
    try {
      await daemon.sigterm();
      await daemon.stop();
    } finally {
      daemon = undefined;
      scaffold = undefined;
      await new Promise<void>((done) => decoy.close(() => done()));
    }
    expect(hits).toEqual([]);
  }, 60_000);

  it("daemon restart re-spawns the scenario-local daemon on the same port/scratch", async () => {
    scaffold = prepareHermeticEnv({ baseEnv: realBaseEnv() });
    daemon = await spawnScenarioDaemon(scaffold, { rigBin: RIG_BIN });
    const beforePort = daemon.port;
    await daemon.restart();
    // back up on the SAME port (re-spawn through the same env guarantees)
    expect(daemon.port).toBe(beforePort);
    const health = await fetch(`${daemon.baseUrl}/healthz`);
    expect(health.ok).toBe(true);
    // the shipped read still works against the re-spawned daemon
    const ps = await runRig(["ps", "--json"], daemon.readEnv, RIG_BIN);
    expect(ps.code).toBe(0);
    expect(Array.isArray(JSON.parse(ps.stdout))).toBe(true);
  }, 60_000);
});

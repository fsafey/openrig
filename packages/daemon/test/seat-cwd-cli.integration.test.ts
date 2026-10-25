import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { stringify } from "yaml";
import { prepareHermeticEnv, type HermeticScaffold } from "./helpers/hermetic-env.js";
import { runRig, spawnScenarioDaemon, type ScenarioDaemon } from "./helpers/scenario-daemon.js";

// A real private CLI/daemon/SQLite/tmux journey with two stub occupants. This
// proves stored settings, live process separation and later managed launch. A
// stub has no provider conversation; native history resume is a separate test.
describe("cwd cutover through the real CLI", () => {
  const rigBin = resolve(import.meta.dirname, "../../cli/dist/bin-wrapper.js");
  let scaffold: HermeticScaffold | undefined, daemon: ScenarioDaemon | undefined;
  let spec: string, from: string, to: string;
  const seat = "design-aid@cwd-scenario", peer = "design-peer@cwd-scenario";
  let declaration: Record<string, unknown>;
  async function cli(args: string[]) {
    const r = await runRig(args, { ...daemon!.readEnv, OPENRIG_SESSION_NAME: "lead@cwd-scenario" }, rigBin, 120_000);
    expect(r.code, JSON.stringify({ args, ...r })).toBe(0);
    return JSON.parse(r.stdout);
  }
  function pane(session: string) {
    return execFileSync("tmux", ["-S", scaffold!.tmuxSocketPath, "display-message", "-p", "-t", `=${session}:`, "#{pane_id} #{pane_pid} #{pane_current_path}"],
      { env: scaffold!.env, encoding: "utf8" }).trim();
  }
  beforeAll(async () => {
    scaffold = prepareHermeticEnv({ baseEnv: { PATH: process.env.PATH, TERM: "xterm-256color" } });
    from = join(scaffold.root, "operations"); to = join(scaffold.root, "product");
    const agent = join(scaffold.root, "agent");
    for (const dir of [from, to, agent]) mkdirSync(dir);
    writeFileSync(join(agent, "agent.yaml"), 'name: worker\nversion: "1.0.0"\nprofiles:\n  default:\n    uses:\n      skills: []\n');
    declaration = { version: "0.2", name: "cwd-scenario", pods: [{ id: "design", label: "Design", members: ["aid", "peer"].map(id => ({
      id, agent_ref: `path:${agent}`, profile: "default", runtime: "stub", cwd: from,
    })), edges: [] }], edges: [] };
    spec = join(scaffold.root, "rig.yaml"); writeFileSync(spec, stringify(declaration));
    daemon = await spawnScenarioDaemon(scaffold, { rigBin });
    await cli(["up", spec, "--json", "--yes"]);
  }, 120_000);
  afterAll(async () => {
    if (!daemon) { scaffold?.cleanup(); return; }
    try { await cli(["down", "cwd-scenario", "--force", "--json"]); }
    finally { await daemon.stop(); }
  }, 60_000);

  it("keeps both incumbents and queued work intact, then starts only the selected seat in the saved target", async () => {
    const before = await cli(["ps", "--nodes", "--rig", "cwd-scenario", "--full", "--json"]);
    const aid = before.find((n: { canonicalSessionName: string }) => n.canonicalSessionName === seat);
    const incumbent = pane(seat), peerBefore = pane(peer);
    const queue = await cli(["queue", "create", "--destination", seat, "--body", "retained cwd cutover custody", "--no-nudge", "--json"]);
    const pods = declaration.pods as { members: { id: string; cwd: string }[] }[];
    pods[0]!.members.find(m => m.id === "aid")!.cwd = to;
    writeFileSync(spec, stringify(declaration));
    const changed = await cli(["seat", "set-cwd", seat, "--cwd", to, "--expected-cwd", from, "--expected-node-id", aid.nodeId,
      "--spec", spec, "--reason", "assigned product checkout", "--json"]);
    expect(changed).toMatchObject({ changed: true, to, liveProcess: "unchanged", context: "prepared_not_consumed" });
    expect(pane(seat)).toBe(incumbent);
    expect(pane(peer)).toBe(peerBefore);
    expect(await cli(["queue", "show", queue.qitemId, "--full", "--json"])).toMatchObject({ destinationSession: seat, body: "retained cwd cutover custody" });
    await cli(["seat", "stop", seat, "--reason", "test controlled cutover", "--json"]);
    await cli(["seat", "launch", seat, "--fresh", "--reason", "test saved cwd", "--json"]);
    const after = await cli(["ps", "--nodes", "--rig", "cwd-scenario", "--full", "--json"]);
    expect(after.find((n: { nodeId: string }) => n.nodeId === aid.nodeId)).toMatchObject({ cwd: to, canonicalSessionName: seat, sessionStatus: "running" });
    expect(pane(seat)).toContain(to);
    expect(pane(peer)).toBe(peerBefore);
  }, 120_000);
});

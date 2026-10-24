// OPR.0.4.1.10 FR-A — config-layer Codex activity-hook projection.
// ensureCodexActivityHooks() writes inline [hooks] for the four lifecycle events into
// ~/.codex/config.toml so an OpenRig-launched Codex seat is hook-PRIMARY from clean
// shipped config. Verified-firsthand on Codex 0.139 (VM de-risk 2026-06-30): this TOML
// shape is discovered + trusted (via the "2 Trust all and continue" launch gate) and
// the turn-scope hooks (incl. the PermissionRequest keystone) FIRE.
import { describe, it, expect, vi } from "vitest";
import { CodexRuntimeAdapter, computeCodexHookTrust, type CodexAdapterFsOps } from "../src/adapters/codex-runtime-adapter.js";
import type { TmuxAdapter } from "../src/adapters/tmux.js";
import { parse as parseToml } from "smol-toml";

const RELAY = "/daemon/assets/plugins/openrig-core/hooks/scripts/activity-relay.cjs";
const CONFIG = "/home/test/.codex/config.toml";
const HOOKS = "/home/test/.codex/hooks.json";
const EVENTS = ["SessionStart", "UserPromptSubmit", "Stop", "PermissionRequest"] as const;

function mockCodexFs(files?: Record<string, string>): CodexAdapterFsOps & { _store: Record<string, string> } {
  const store: Record<string, string> = { ...files };
  return {
    readFile: (p: string) => { if (p in store) return store[p]!; throw new Error(`Not found: ${p}`); },
    writeFile: (p: string, c: string) => { store[p] = c; },
    exists: (p: string) => p in store,
    mkdirp: () => {},
    listFiles: (dir: string) => Object.keys(store).filter((k) => k.startsWith(dir + "/")).map((k) => k.slice(dir.length + 1)),
    homedir: "/home/test",
    _store: store,
  } as CodexAdapterFsOps & { _store: Record<string, string> };
}

function mockTmux(): TmuxAdapter {
  return { sendText: vi.fn(async () => ({ ok: true as const })) } as unknown as TmuxAdapter;
}

function makeAdapter(fs: CodexAdapterFsOps, relay: string | undefined = RELAY): CodexRuntimeAdapter {
  return new CodexRuntimeAdapter({ tmux: mockTmux(), fsOps: fs, activityRelayPath: relay });
}

const managedGroup = (command = `node "${RELAY}"`) => ({
  hooks: [{ type: "command", command, timeout: 5, statusMessage: "OpenRig activity" }],
});

describe("Codex existing JSON hook format", () => {
  it("preserves an explicit activity-hook disable across runtime off/on with a later user group", () => {
    const fs = mockCodexFs({ [RELAY]: "// relay", [HOOKS]: '{"hooks":{}}' });
    const adapter = makeAdapter(fs);
    adapter.ensureCodexActivityHooks();
    const ownKey = `${HOOKS}:stop:0:0`;
    fs._store[CONFIG] = fs._store[CONFIG]!.replace(`[hooks.state.${JSON.stringify(ownKey)}]`, `[hooks.state.${JSON.stringify(ownKey)}]\nenabled = false`);
    const userGroup = { hooks: [{ type: "command", command: "/user/later" }] };
    const document = JSON.parse(fs._store[HOOKS]!);
    document.hooks.Stop.push(userGroup);
    fs._store[HOOKS] = JSON.stringify(document);
    fs._store[CONFIG] += `\n[hooks.state.${JSON.stringify(`${HOOKS}:stop:1:0`)}]\nenabled = false\ntrusted_hash = "sha256:user"\n`;

    adapter.removeCodexActivityHooks();
    expect(JSON.parse(fs._store[HOOKS]!).hooks.Stop).toEqual([userGroup]);
    expect((parseToml(fs._store[CONFIG]!).hooks as any).state[`${HOOKS}:stop:0:0`]).toEqual({ enabled: false, trusted_hash: "sha256:user" });
    adapter.ensureCodexActivityHooks();
    expect(JSON.parse(fs._store[HOOKS]!).hooks.Stop).toEqual([userGroup, managedGroup()]);
    const state = (parseToml(fs._store[CONFIG]!).hooks as any).state;
    expect(state[`${HOOKS}:stop:0:0`]).toEqual({ enabled: false, trusted_hash: "sha256:user" });
    const expected = computeCodexHookTrust("Stop", { keySource: HOOKS, command: `node "${RELAY}"`, timeoutSec: 5, statusMessage: "OpenRig activity", groupIndex: 1 });
    expect(state[expected.key]).toEqual({ enabled: false, trusted_hash: expected.hash });
  });

  it.each(["{broken", "[]", '{"hooks":null}', '{"hooks":{"Stop":{}}}'])("warns and preserves invalid JSON and TOML: %s", (json) => {
    const fs = mockCodexFs({ [RELAY]: "// relay", [HOOKS]: json, [CONFIG]: 'model = "custom"\n' });
    const before = { ...fs._store };
    const warn = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      makeAdapter(fs).ensureCodexActivityHooks();
      expect(fs._store).toEqual(before);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining(HOOKS));
    } finally { warn.mockRestore(); }
  });

  it("accepts a hooks document with no groups yet", () => {
    const fs = mockCodexFs({ [RELAY]: "// relay", [HOOKS]: '{"description":"My hooks"}' });
    makeAdapter(fs).ensureCodexActivityHooks();
    expect(JSON.parse(fs._store[HOOKS]!).hooks.Stop).toEqual([managedGroup()]);
  });

  it("is idempotent and upgrades only strictly marked groups", () => {
    const nextRelay = "/new/assets/activity-relay.cjs";
    const userGroups = [
      { ...managedGroup(), matcher: "Bash" },
      { hooks: [{ ...managedGroup().hooks[0], statusMessage: "My activity" }] },
      { hooks: [{ ...managedGroup().hooks[0], command: `node "/user/activity-relay.cjs"`, userField: true }] },
    ];
    const fs = mockCodexFs({ [RELAY]: "// relay", [nextRelay]: "// next", [HOOKS]: JSON.stringify({ hooks: { Stop: userGroups } }) });
    const adapter = makeAdapter(fs);
    adapter.ensureCodexActivityHooks();
    const first = { ...fs._store };
    adapter.ensureCodexActivityHooks();
    expect(fs._store).toEqual(first);
    makeAdapter(fs, nextRelay).ensureCodexActivityHooks();
    const json = JSON.parse(fs._store[HOOKS]!);
    expect(json.hooks.Stop).toEqual([...userGroups, managedGroup(`node "${nextRelay}"`)]);
    for (const event of EVENTS) expect(json.hooks[event].filter((g: unknown) => JSON.stringify(g) === JSON.stringify(managedGroup(`node "${nextRelay}"`)))).toHaveLength(1);
    const trust = computeCodexHookTrust("Stop", { keySource: HOOKS, command: `node "${nextRelay}"`, timeoutSec: 5, statusMessage: "OpenRig activity", groupIndex: 3 });
    expect((parseToml(fs._store[CONFIG]!).hooks as any).state[trust.key].trusted_hash).toBe(trust.hash);
  });

  it("migrates legacy TOML hooks and carries an operator disable into the JSON identity", () => {
    const fs = mockCodexFs({ [RELAY]: "// relay" });
    const adapter = makeAdapter(fs);
    adapter.ensureCodexActivityHooks();
    const legacyKey = `${CONFIG}:stop:0:0`;
    fs._store[CONFIG] = fs._store[CONFIG]!.replace(`[hooks.state.${JSON.stringify(legacyKey)}]`, `[hooks.state.${JSON.stringify(legacyKey)}]\nenabled = false`);
    const userGroup = { hooks: [{ type: "command", command: "/user/guard" }] };
    fs._store[HOOKS] = JSON.stringify({ description: "Keep me", hooks: { Stop: [userGroup] } });
    adapter.ensureCodexActivityHooks();
    const config = fs._store[CONFIG]!;
    expect(config).not.toContain("# BEGIN OPENRIG MANAGED ACTIVITY HOOKS");
    const parsed = parseToml(config).hooks as any;
    expect(parsed.Stop).toBeUndefined();
    const expected = computeCodexHookTrust("Stop", { keySource: HOOKS, command: `node "${RELAY}"`, timeoutSec: 5, groupIndex: 1, statusMessage: "OpenRig activity" });
    expect(parsed.state[expected.key]).toEqual({ enabled: false, trusted_hash: expected.hash });
    expect(JSON.parse(fs._store[HOOKS]!).hooks.Stop).toEqual([userGroup, managedGroup()]);
    const once = { ...fs._store };
    adapter.ensureCodexActivityHooks();
    expect(fs._store).toEqual(once);
  });

  it("preserves user inline hooks while warning that their mixed format remains", () => {
    const userInline = '[[hooks.Stop]]\n[[hooks.Stop.hooks]]\ntype = "command"\ncommand = "/user/inline"\n';
    const fs = mockCodexFs({ [RELAY]: "// relay", [CONFIG]: userInline, [HOOKS]: '{"hooks":{}}' });
    const warn = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      makeAdapter(fs).ensureCodexActivityHooks();
      expect(fs._store[CONFIG]).toContain(userInline);
      expect(fs._store[CONFIG]).not.toContain("# BEGIN OPENRIG MANAGED ACTIVITY HOOKS");
      expect(JSON.parse(fs._store[HOOKS]!).hooks.Stop).toEqual([managedGroup()]);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining("user-authored inline Codex hooks remain"));
    } finally { warn.mockRestore(); }
  });

  it("disables both representations in the selected home and preserves all native state", () => {
    const selected = "/selected-codex";
    const selectedConfig = `${selected}/config.toml`;
    const selectedHooks = `${selected}/hooks.json`;
    const fs = mockCodexFs({ [RELAY]: "// relay", [HOOKS]: '{"hooks":{}}' });
    const adapter = new CodexRuntimeAdapter({ tmux: mockTmux(), fsOps: fs, activityRelayPath: RELAY, codexHome: selected });
    adapter.ensureCodexActivityHooks();
    const legacy = fs._store[selectedConfig]!;
    fs._store[selectedHooks] = JSON.stringify({ hooks: { Stop: [managedGroup(), { ...managedGroup(), matcher: "Bash" }] } });
    const state = '[hooks.state."user-key"]\nenabled = false\ntrusted_hash = "sha256:user"\n';
    fs._store[selectedConfig] = `${legacy}\n${state}`;
    adapter.removeCodexActivityHooks();
    expect(fs._store[selectedConfig]).not.toContain("# BEGIN OPENRIG MANAGED ACTIVITY HOOKS");
    expect(fs._store[selectedConfig]).toContain(state);
    expect(JSON.parse(fs._store[selectedHooks]!).hooks.Stop).toEqual([{ ...managedGroup(), matcher: "Bash" }]);
    expect(fs._store[HOOKS]).toBe('{"hooks":{}}');
    const once = { ...fs._store };
    adapter.removeCodexActivityHooks();
    expect(fs._store).toEqual(once);
  });

  it("uses the real inline group index when user groups precede the managed block", () => {
    const fs = mockCodexFs({ [RELAY]: "// relay", [CONFIG]: '[[hooks.Stop]]\n[[hooks.Stop.hooks]]\ntype = "command"\ncommand = "/user/guard"\n' });
    makeAdapter(fs).ensureCodexActivityHooks();
    const state = (parseToml(fs._store[CONFIG]!).hooks as any).state;
    expect(state[`${CONFIG}:stop:1:0`]).toBeDefined();
    expect(state[`${CONFIG}:stop:0:0`]).toBeUndefined();
  });
});

describe("OPR.0.4.1.10 FR-A — Codex config-layer activity hooks", () => {
  it("keeps an existing hooks.json active instead of adding competing inline hooks", () => {
    const userGroup = { matcher: "Bash", hooks: [{ type: "command", command: "/user/guard" }] };
    const userJson = { description: "User safety hooks", hooks: { PreToolUse: [userGroup], Stop: [userGroup] } };
    const fs = mockCodexFs({ [RELAY]: "// relay", [HOOKS]: JSON.stringify(userJson) });
    makeAdapter(fs).ensureCodexActivityHooks();

    const json = JSON.parse(fs._store[HOOKS]!);
    expect(json.description).toBe("User safety hooks");
    expect(json.hooks.PreToolUse).toEqual([userGroup]);
    expect(json.hooks.Stop[0]).toEqual(userGroup);
    expect(json.hooks.Stop[1].hooks).toEqual([{ type: "command", command: `node "${RELAY}"`, timeout: 5, statusMessage: "OpenRig activity" }]);
    const config = parseToml(fs._store[CONFIG]!) as any;
    expect(config.hooks.Stop).toBeUndefined();
    expect(config.hooks.state[`${HOOKS}:stop:1:0`].trusted_hash).toMatch(/^sha256:/);
    expect(config.hooks.state[`${HOOKS}:stop:0:0`]).toBeUndefined();
  });

  it("writes inline [hooks] for all four events with the absolute relay command + timeout", () => {
    const fs = mockCodexFs({ [RELAY]: "// relay" });
    makeAdapter(fs).ensureCodexActivityHooks();
    const cfg = fs._store[CONFIG];
    expect(cfg).toBeDefined();
    for (const ev of EVENTS) {
      expect(cfg).toContain(`[[hooks.${ev}]]`);
      expect(cfg).toContain(`[[hooks.${ev}.hooks]]`);
    }
    expect(cfg).toContain(`command = 'node "${RELAY}"'`);
    expect(cfg).toContain("timeout = 5");
  });

  it("GAP-7 adds hook trust and removes hooks through the injected Codex home", () => {
    const customConfig = "/custom-codex/config.toml";
    const fs = mockCodexFs({ [RELAY]: "// relay" });
    const adapter = new CodexRuntimeAdapter({
      tmux: mockTmux(), fsOps: fs, activityRelayPath: RELAY, codexHome: "/custom-codex",
    });

    adapter.ensureCodexActivityHooks();
    expect(fs._store[customConfig]).toContain("# BEGIN OPENRIG MANAGED ACTIVITY HOOKS");
    expect(fs._store[customConfig]).toContain("[hooks.state.");
    expect(fs._store[CONFIG]).toBeUndefined();

    adapter.removeCodexActivityHooks();
    expect(fs._store[customConfig]).not.toContain("# BEGIN OPENRIG MANAGED ACTIVITY HOOKS");
    expect(fs._store[CONFIG]).toBeUndefined();
  });

  it("pins [features].hooks = true using the canonical key (not the deprecated codex_hooks alias)", () => {
    const fs = mockCodexFs({ [RELAY]: "// relay" });
    makeAdapter(fs).ensureCodexActivityHooks();
    const cfg = fs._store[CONFIG]!;
    expect(cfg).toContain("[features]");
    expect(cfg).toMatch(/^\s*hooks = true\s*$/m);
    expect(cfg).not.toContain("codex_hooks");
  });

  it("is idempotent — re-running produces identical content with no duplicated stanzas", () => {
    const fs = mockCodexFs({ [RELAY]: "// relay" });
    const adapter = makeAdapter(fs);
    adapter.ensureCodexActivityHooks();
    const first = fs._store[CONFIG]!;
    adapter.ensureCodexActivityHooks();
    const second = fs._store[CONFIG]!;
    expect(second).toBe(first);
    expect(second.match(/\[\[hooks\.PermissionRequest\]\]/g)?.length).toBe(1);
  });

  it("preserves existing config content (workspace trust survives the upsert)", () => {
    const fs = mockCodexFs({
      [RELAY]: "// relay",
      [CONFIG]: '[projects."/some/project"]\ntrust_level = "trusted"\n',
    });
    makeAdapter(fs).ensureCodexActivityHooks();
    const cfg = fs._store[CONFIG]!;
    expect(cfg).toContain('[projects."/some/project"]');
    expect(cfg).toContain('trust_level = "trusted"');
    expect(cfg).toContain("[[hooks.PermissionRequest]]");
  });

  it("replaces the managed block (not duplicate) when the relay path changes", () => {
    const fs = mockCodexFs({ [RELAY]: "// relay", "/new/relay.cjs": "// relay2" });
    makeAdapter(fs, RELAY).ensureCodexActivityHooks();
    makeAdapter(fs, "/new/relay.cjs").ensureCodexActivityHooks();
    const cfg = fs._store[CONFIG]!;
    expect(cfg).toContain(`command = 'node "/new/relay.cjs"'`);
    expect(cfg).not.toContain(`command = 'node "${RELAY}"'`);
    expect(cfg.match(/# BEGIN OPENRIG MANAGED ACTIVITY HOOKS/g)?.length).toBe(1);
  });

  it("keeps $ sequences in the relay path literal when the block is rewritten", () => {
    const dollarRelay = "/opt/rig$&$$/`x`/activity-relay.cjs";
    const fs = mockCodexFs({
      [dollarRelay]: "// relay",
      [CONFIG]: '[projects."/some/project"]\ntrust_level = "trusted"\n',
    });
    const adapter = makeAdapter(fs, dollarRelay);
    adapter.ensureCodexActivityHooks();
    const first = fs._store[CONFIG]!;
    adapter.ensureCodexActivityHooks();
    const second = fs._store[CONFIG]!;
    expect(second).toBe(first);
    expect(second.split(`command = 'node "${dollarRelay}"'`).length - 1).toBe(EVENTS.length);
    expect(second.match(/# BEGIN OPENRIG MANAGED ACTIVITY HOOKS/g)?.length).toBe(1);
    expect(second.startsWith('[projects."/some/project"]\ntrust_level = "trusted"\n')).toBe(true);
  });

  it("fail-safe: skips writing + warns when the relay asset is missing", () => {
    const fs = mockCodexFs({}); // RELAY not present in the store
    const warn = vi.spyOn(console, "error").mockImplementation(() => {});
    makeAdapter(fs, RELAY).ensureCodexActivityHooks();
    expect(fs._store[CONFIG]).toBeUndefined();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("no-ops silently when no activityRelayPath is configured", () => {
    const fs = mockCodexFs({});
    const warn = vi.spyOn(console, "error").mockImplementation(() => {});
    // construct WITHOUT activityRelayPath (not via the default-param helper)
    new CodexRuntimeAdapter({ tmux: mockTmux(), fsOps: fs }).ensureCodexActivityHooks();
    expect(fs._store[CONFIG]).toBeUndefined();
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});

// B2 (rev1-r2) — a NON-CANONICAL real [features] header (trailing comment / spacing) must not
// be missed by the exact-match -> duplicate [features] table -> Codex 0.139 rejects the file.
// A fully-commented "# [features]" line is NOT a section and must not be treated as one.
const realFeaturesHeaders = (cfg: string) =>
  cfg.split("\n").filter((l) => /^\[features\]\s*(#.*)?$/.test(l.trim()));

describe("OPR.0.4.1.10 B2 — comment-tolerant [features] header match", () => {
  it("does NOT duplicate a real [features] header that carries a trailing comment", () => {
    const fs = mockCodexFs({
      [RELAY]: "// relay",
      [CONFIG]: '[features] # user comment\nmodel_reasoning_summary = true\n\n[projects."/x"]\ntrust_level = "trusted"\n',
    });
    makeAdapter(fs).ensureCodexActivityHooks();
    const cfg = fs._store[CONFIG]!;
    expect(realFeaturesHeaders(cfg).length).toBe(1); // no duplicate table -> strict-config valid
    expect(cfg).toContain("[features] # user comment"); // original header preserved
    expect(cfg).toContain("model_reasoning_summary = true");
    expect(cfg).toMatch(/^\s*hooks = true\s*$/m);
  });

  it("treats a fully-commented '# [features]' line as NOT a section (appends one real [features])", () => {
    const fs = mockCodexFs({
      [RELAY]: "// relay",
      [CONFIG]: '# [features]\n# operator notes\n\n[projects."/x"]\ntrust_level = "trusted"\n',
    });
    makeAdapter(fs).ensureCodexActivityHooks();
    const cfg = fs._store[CONFIG]!;
    expect(realFeaturesHeaders(cfg).length).toBe(1); // a real [features] was appended
    expect(cfg).toContain("# [features]"); // the commented line left untouched
    expect(cfg).toMatch(/^\s*hooks = true\s*$/m);
  });
});

// B2 (rev1-r2 delta #2) — the [features] header must be matched in ANY valid TOML spelling
// (TOML v1.0.0: whitespace around the bracketed key is ignored; the key may be bare or quoted),
// else a missed header appends a duplicate table that Codex 0.139 --strict-config rejects.
// normalize-and-compare counter, mirroring the production matcher.
const normFeaturesHeaders = (cfg: string) =>
  cfg.split("\n").filter((l) => {
    const t = l.trim();
    if (t.startsWith("#")) return false;
    const m = /^\[([^[\]]*)\]\s*(#.*)?$/.exec(t);
    if (!m) return false;
    let k = m[1]!.trim();
    if (k.length >= 2 && ((k.startsWith('"') && k.endsWith('"')) || (k.startsWith("'") && k.endsWith("'")))) k = k.slice(1, -1);
    return k === "features";
  }).length;

describe("OPR.0.4.1.10 B2 — robust [features] header across all valid TOML spellings", () => {
  for (const header of ["[features]", "[ features ]", "[  features  ]", "[features] # c", "[ features ] # c", '["features"]', "['features']"]) {
    it(`does not duplicate the features table for spelling: ${header}`, () => {
      const fs = mockCodexFs({ [RELAY]: "// relay", [CONFIG]: `${header}\nhooks = false\n\n[projects."/x"]\ntrust_level = "trusted"\n` });
      makeAdapter(fs).ensureCodexActivityHooks();
      const cfg = fs._store[CONFIG]!;
      expect(normFeaturesHeaders(cfg)).toBe(1); // exactly one features table -> strict-config valid
      expect(cfg).toContain(header); // original header spelling preserved
    });
  }

  it("a fully-commented '# [features]' is NOT a section (one real features appended)", () => {
    const fs = mockCodexFs({ [RELAY]: "// relay", [CONFIG]: '# [features]\n\n[projects."/x"]\ntrust_level = "trusted"\n' });
    makeAdapter(fs).ensureCodexActivityHooks();
    const cfg = fs._store[CONFIG]!;
    expect(normFeaturesHeaders(cfg)).toBe(1);
    expect(cfg).toContain("# [features]");
  });
});

describe("OPR.0.4.1.10 B3 — durable disable via removeCodexActivityHooks", () => {
  it("strips the managed sentinel block on disable, preserving user-owned hooks + [features]", () => {
    const fs = mockCodexFs({
      [RELAY]: "// relay",
      [CONFIG]: '[features]\nhooks = true\n\n[[hooks.PreToolUse]]\n[[hooks.PreToolUse.hooks]]\ntype = "command"\ncommand = "/usr/bin/true"\n',
    });
    const adapter = makeAdapter(fs);
    adapter.ensureCodexActivityHooks();
    expect(fs._store[CONFIG]!).toContain("# BEGIN OPENRIG MANAGED ACTIVITY HOOKS");
    adapter.removeCodexActivityHooks();
    const cfg = fs._store[CONFIG]!;
    expect(cfg).not.toContain("# BEGIN OPENRIG MANAGED ACTIVITY HOOKS");
    expect(cfg).not.toContain("# END OPENRIG MANAGED ACTIVITY HOOKS");
    expect(cfg).not.toContain(`command = 'node "${RELAY}"'`); // managed hooks removed
    expect(cfg).toContain("[[hooks.PreToolUse]]"); // user-owned hook preserved
    expect(cfg).toContain('command = "/usr/bin/true"');
    expect(cfg).toContain("[features]"); // left intact (0.139 default)
  });

  it("removeCodexActivityHooks is a no-op when there is no config / no managed block", () => {
    const fs = mockCodexFs({ [RELAY]: "// relay" });
    makeAdapter(fs).removeCodexActivityHooks();
    expect(fs._store[CONFIG]).toBeUndefined();
    const fs2 = mockCodexFs({ [RELAY]: "// relay", [CONFIG]: '[features]\nhooks = true\n' });
    makeAdapter(fs2).removeCodexActivityHooks();
    expect(fs2._store[CONFIG]).toBe('[features]\nhooks = true\n'); // untouched
  });

  // Regression: the strip must excise ONLY the managed block (plus the blank-line separator it was
  // appended with). A global \n{3,} collapse on the whole document silently mutated user content.
  const MANAGED_BLOCK =
    "# BEGIN OPENRIG MANAGED ACTIVITY HOOKS\n" +
    "[[hooks.Stop]]\n" +
    `command = 'node "${RELAY}"'\n` +
    "# END OPENRIG MANAGED ACTIVITY HOOKS\n";

  it("preserves runs of 3+ newlines between unrelated user sections when stripping the block", () => {
    const userContent = '[features]\nhooks = true\n\n\n\n[projects."/x"]\ntrust_level = "trusted"\n';
    const fs = mockCodexFs({ [RELAY]: "// relay", [CONFIG]: `${userContent}\n${MANAGED_BLOCK}` });
    makeAdapter(fs).removeCodexActivityHooks();
    expect(fs._store[CONFIG]).toBe(userContent); // the 3-blank-line gap survives byte-for-byte
  });

  it("preserves blank lines inside TOML multiline strings when stripping the block", () => {
    const userContent = 'instructions = """line1\n\n\nline2"""\n';
    const fs = mockCodexFs({ [RELAY]: "// relay", [CONFIG]: `${userContent}\n${MANAGED_BLOCK}` });
    makeAdapter(fs).removeCodexActivityHooks();
    expect(fs._store[CONFIG]).toBe(userContent); // the parsed value of `instructions` is unchanged
  });
});

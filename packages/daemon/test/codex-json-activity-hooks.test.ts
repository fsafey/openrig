import { afterEach, describe, expect, it, vi } from "vitest";
import { parse as parseToml } from "smol-toml";
import { CodexRuntimeAdapter, type CodexAdapterFsOps } from "../src/adapters/codex-runtime-adapter.js";
import type { TmuxAdapter } from "../src/adapters/tmux.js";

const CONFIG = "/home/test/.codex/config.toml";
const HOOKS = "/home/test/.codex/hooks.json";
const RELAY = "/daemon/assets/plugins/openrig-core/hooks/scripts/activity-relay.cjs";
const USER_GROUP = { matcher: "Bash", hooks: [{ type: "command", command: "/user/guard", timeout: 13 }] };

function fixture(files: Record<string, string> = {}) {
  const store: Record<string, string> = { [RELAY]: "// relay", ...files };
  const fs: CodexAdapterFsOps = {
    homedir: "/home/test",
    exists: path => path in store,
    readFile: path => {
      if (!(path in store)) throw new Error(`Missing ${path}`);
      return store[path]!;
    },
    writeFile: (path, content) => { store[path] = content; },
    mkdirp: () => {},
  };
  const adapter = new CodexRuntimeAdapter({ fsOps: fs, tmux: {} as TmuxAdapter, activityRelayPath: RELAY });
  return { store, adapter };
}

function state(store: Record<string, string>) {
  return (parseToml(store[CONFIG]!) as any).hooks.state;
}

function hooks(store: Record<string, string>) {
  return JSON.parse(store[HOOKS]!).hooks;
}

function nativeState(key: string, fields: string) {
  return `\n[hooks.state.${JSON.stringify(key)}]\n${fields}\n`;
}

afterEach(() => vi.restoreAllMocks());

describe("Codex JSON hook state preservation regressions", () => {
  it("retains late user disable and trust when removal shifts indices, then safely enables a new managed slot", () => {
    const f = fixture({ [HOOKS]: '{"hooks":{}}' });
    f.adapter.ensureCodexActivityHooks();
    const originalManagedState = { ...state(f.store)[`${HOOKS}:stop:0:0`] };
    const document = JSON.parse(f.store[HOOKS]!);
    const secondUser = { hooks: [{ type: "command", command: "/user/second" }] };
    document.hooks.Stop.push(USER_GROUP, secondUser);
    f.store[HOOKS] = JSON.stringify(document);
    f.store[CONFIG] += nativeState(`${HOOKS}:stop:1:0`, 'enabled = false\ntrusted_hash = "sha256:first-user"');
    f.store[CONFIG] += nativeState(`${HOOKS}:stop:2:0`, 'enabled = true\ntrusted_hash = "sha256:second-user"');

    f.adapter.removeCodexActivityHooks();
    expect(hooks(f.store).Stop).toEqual([USER_GROUP, secondUser]);
    expect(state(f.store)[`${HOOKS}:stop:0:0`]).toEqual({ enabled: false, trusted_hash: "sha256:first-user" });
    expect(state(f.store)[`${HOOKS}:stop:1:0`]).toEqual({ enabled: true, trusted_hash: "sha256:second-user" });
    expect(state(f.store)[`${HOOKS}:stop:2:0`]).toEqual(originalManagedState);

    f.adapter.ensureCodexActivityHooks();
    expect(hooks(f.store).Stop.slice(0, 2)).toEqual([USER_GROUP, secondUser]);
    expect(hooks(f.store).Stop[2].hooks[0].command).toBe(`node "${RELAY}"`);
    expect(state(f.store)[`${HOOKS}:stop:0:0`]).toEqual({ enabled: false, trusted_hash: "sha256:first-user" });
    expect(state(f.store)[`${HOOKS}:stop:1:0`]).toEqual({ enabled: true, trusted_hash: "sha256:second-user" });
    expect(state(f.store)[`${HOOKS}:stop:2:0`].enabled).not.toBe(false);
    expect(state(f.store)[`${HOOKS}:stop:2:0`].trusted_hash).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(state(f.store)[`${HOOKS}:stop:2:0`].trusted_hash).not.toBe("sha256:second-user");
  });

  it("preserves disable with a single-quoted state header or safely declines the whole migration", () => {
    const f = fixture();
    f.adapter.ensureCodexActivityHooks();
    const key = `${CONFIG}:stop:0:0`;
    expect(f.store[CONFIG]).toContain(`[hooks.state.${JSON.stringify(key)}]\n`);
    f.store[CONFIG] = f.store[CONFIG]!.replace(
      `[hooks.state.${JSON.stringify(key)}]\n`, `[hooks.state.'${key}'] # native spelling\nenabled = false\n`,
    );
    expect(state(f.store)[key].enabled).toBe(false);
    f.store[HOOKS] = '{"hooks":{}}';
    const before = { ...f.store };
    const warn = vi.spyOn(console, "error").mockImplementation(() => {});
    f.adapter.ensureCodexActivityHooks();
    if (f.store[HOOKS] === before[HOOKS]) {
      expect(f.store).toEqual(before);
      expect(warn).toHaveBeenCalled();
    } else {
      expect(state(f.store)[`${HOOKS}:stop:0:0`].enabled).toBe(false);
      expect((parseToml(f.store[CONFIG]!) as any).hooks.Stop).toBeUndefined();
    }
  });

  it("leaves sentinel text inside a TOML multiline string unchanged and warns", () => {
    const text = 'notes = """\n# BEGIN OPENRIG MANAGED ACTIVITY HOOKS\n[[hooks.Stop]]\n[[hooks.Stop.hooks]]\ntype = "command"\ncommand = \'node "/old/activity-relay.cjs"\'\ntimeout = 5\n# END OPENRIG MANAGED ACTIVITY HOOKS\n"""\n';
    expect(parseToml(text).notes).toContain("[[hooks.Stop]]");
    const f = fixture({ [CONFIG]: text, [HOOKS]: '{"hooks":{}}' });
    const before = { ...f.store };
    const warn = vi.spyOn(console, "error").mockImplementation(() => {});
    f.adapter.ensureCodexActivityHooks();
    expect(f.store).toEqual(before);
    expect(warn).toHaveBeenCalled();
    warn.mockClear();
    f.adapter.removeCodexActivityHooks();
    expect(f.store).toEqual(before);
    expect(warn).toHaveBeenCalled();
  });

  it("leaves a native state header inside developer instructions unchanged during removal", () => {
    const f = fixture({ [HOOKS]: '{"hooks":{}}' });
    f.adapter.ensureCodexActivityHooks();
    const document = JSON.parse(f.store[HOOKS]!);
    document.hooks.Stop.push(USER_GROUP);
    f.store[HOOKS] = JSON.stringify(document);
    const instructions = `[hooks.state."${HOOKS}:stop:0:0"]\nenabled=false\n[ordinary text]\n`;
    f.store[CONFIG] = `developer_instructions = """\n${instructions}"""\n\n${f.store[CONFIG]}`;
    expect(parseToml(f.store[CONFIG]!).developer_instructions).toBe(instructions);
    const before = { ...f.store };
    const warn = vi.spyOn(console, "error").mockImplementation(() => {});
    f.adapter.removeCodexActivityHooks();
    expect(f.store).toEqual(before);
    expect(warn).toHaveBeenCalled();
  });
});

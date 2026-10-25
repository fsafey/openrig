import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { stringify } from "yaml";
import { createFullTestDb, createTestApp } from "./helpers/test-app.js";
import { RestoreOrchestrator } from "../src/domain/restore-orchestrator.js";
import type { CodexResumeAdapter } from "../src/adapters/codex-resume.js";
import type { ClaudeResumeAdapter } from "../src/adapters/claude-resume.js";
import { QueueRepository } from "../src/domain/queue-repository.js";

describe("existing-seat cwd change", () => {
  let dir: string;
  let setup: ReturnType<typeof createTestApp>;
  let from: string, to: string, specPath: string, nodeId: string;
  const sessionName = "design-aid@cwd-rig";
  beforeEach(async () => {
    dir = mkdtempSync(path.join(tmpdir(), "seat-cwd-"));
    from = path.join(dir, "operations"); to = path.join(dir, "product");
    mkdirSync(from); mkdirSync(to);
    mkdirSync(path.join(dir, "agent"));
    writeFileSync(path.join(dir, "agent/agent.yaml"), `name: design-aid\nversion: "1.0.0"\nstartup:\n  files:\n    - path: role.md\n      delivery_hint: send_text\n      required: true\nprofiles:\n  default:\n    uses:\n      skills: []\n`);
    writeFileSync(path.join(dir, "agent/role.md"), "Retain the operational learning; work in the assigned product context.");
    writeFileSync(path.join(to, "AGENTS.md"), "Product-specific instructions.\n");
    setup = createTestApp(createFullTestDb(), { podInstantiatorFsOps: {
      readFile: p => readFileSync(p, "utf8"), exists: existsSync,
    } });
    const rig = setup.rigRepo.createRig("cwd-rig");
    const node = setup.rigRepo.addNode(rig.id, "design.aid", {
      runtime: "codex", cwd: from, model: "retained-model", agentRef: `path:${dir}/agent`, profile: "default",
      permissionPolicy: "builtin:yolo", role: "designer",
    });
    nodeId = node.id;
    const s = setup.sessionRegistry.registerSession(node.id, sessionName);
    setup.sessionRegistry.updateStatus(s.id, "running");
    setup.sessionRegistry.updateResumeToken(s.id, "codex_id", "retained-native-history", "hook");
    setup.sessionRegistry.updateBinding(node.id, { attachmentType: "tmux", tmuxSession: sessionName, tmuxPane: "%1" });
    setup.rigRepo.addNode(rig.id, "design.peer", { runtime: "codex", cwd: from, model: "peer-model" });
    specPath = path.join(dir, "rig.yaml");
    writeFileSync(specPath, stringify({ version: "0.2", name: "cwd-rig", pods: [{ id: "design", label: "Design", members: [{
      id: "aid", agent_ref: `path:${dir}/agent`, profile: "default", runtime: "codex", cwd: to,
      model: "different-authored-model", permission_policy: "builtin:yolo",
    }], edges: [] }], edges: [] }));
    await new QueueRepository(setup.db, setup.eventBus).create({ sourceSession: "lead@cwd-rig", destinationSession: sessionName, body: "Preserve this seat's work custody." });
  });
  afterEach(() => { vi.restoreAllMocks(); setup.db.close(); rmSync(dir, { recursive: true, force: true }); });

  const post = (setup: ReturnType<typeof createTestApp>, body: Record<string, unknown>) => setup.app.request(`/api/seat/set-cwd/${encodeURIComponent(sessionName)}`, {
    method: "POST", headers: { "Content-Type": "application/json", "X-OpenRig-Session": "lead@cwd-rig" }, body: JSON.stringify(body),
  });
  function body() { return { cwd: to, expectedCwd: from, expectedNodeId: nodeId, spec: specPath, reason: "assigned product worktree" }; }
  function rows(table: string) { return setup.db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all(); }

  it("updates only the stored cwd and startup selection, preserving live history, identity and peer configuration", async () => {
    const before = { nodes: rows("nodes"), sessions: rows("sessions"), bindings: rows("bindings"), tenures: rows("occupant_tenures"), queue: rows("queue_items"), agents: readFileSync(path.join(to, "AGENTS.md"), "utf8") };
    const res = await post(setup, body());
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, changed: true, from, to, liveProcess: "unchanged", context: "prepared_not_consumed" });
    expect(rows("sessions")).toEqual(before.sessions);
    expect(rows("bindings")).toEqual(before.bindings);
    expect(rows("occupant_tenures")).toEqual(before.tenures);
    expect(rows("queue_items")).toEqual(before.queue);
    expect(rows("nodes")).toEqual(before.nodes.map(n => (n as { id: string }).id === nodeId ? { ...n as object, cwd: to } : n));
    expect(readFileSync(path.join(to, "AGENTS.md"), "utf8")).toBe(before.agents);
    const context = setup.db.prepare("SELECT * FROM node_startup_context WHERE node_id = ?").get(nodeId) as { resolved_files_json: string };
    expect(JSON.parse(context.resolved_files_json)).toContainEqual(expect.objectContaining({ absolutePath: path.join(dir, "agent/role.md") }));
    const events = setup.db.prepare("SELECT payload FROM events WHERE type = 'node.cwd_changed'").all() as { payload: string }[];
    expect(events).toHaveLength(1);
    expect(JSON.parse(events[0]!.payload)).toMatchObject({ nodeId, from, to, operator: "lead@cwd-rig", reason: "assigned product worktree" });
    expect(setup.tmuxAdapter.createSession).not.toHaveBeenCalled();
    expect(setup.tmuxAdapter.killSession).not.toHaveBeenCalled();
  });

  it("is idempotent after saving the same cwd and startup selection", async () => {
    expect((await post(setup, body())).status).toBe(200);
    const before = rows("events");
    const res = await post(setup, { ...body(), expectedCwd: to });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ changed: false });
    expect(rows("events")).toEqual(before);
  });

  it.each(["stale-cwd", "wrong-node", "relative", "missing-directory", "file", "wrong-spec-seat", "missing-role"])("refuses %s before changing any saved state", async failure => {
    const request = body();
    if (failure === "stale-cwd") request.expectedCwd = to;
    if (failure === "wrong-node") request.expectedNodeId = "recreated-node";
    if (failure === "relative") request.cwd = "product";
    if (failure === "missing-directory") request.cwd = path.join(dir, "absent");
    if (failure === "file") request.cwd = specPath;
    if (failure === "wrong-spec-seat") writeFileSync(specPath, readFileSync(specPath, "utf8").replace("profile: default", "profile: other"));
    if (failure === "missing-role") rmSync(path.join(dir, "agent/role.md"));
    const before = [rows("nodes"), rows("sessions"), rows("bindings"), rows("node_startup_context"), rows("events")];
    const res = await post(setup, request);
    expect(res.status).toBe(["stale-cwd", "wrong-node", "wrong-spec-seat", "missing-role"].includes(failure) ? 409 : 400);
    expect(await res.json()).toMatchObject({ ok: false, code: ["stale-cwd", "wrong-node"].includes(failure)
      ? "cwd_baseline_changed" : ["wrong-spec-seat", "missing-role"].includes(failure) ? "cwd_context_unavailable" : "invalid_cwd" });
    expect([rows("nodes"), rows("sessions"), rows("bindings"), rows("node_startup_context"), rows("events")]).toEqual(before);
  });

  it("rolls back cwd and startup replacement when the audit cannot commit", async () => {
    setup.db.exec("CREATE TRIGGER reject_cwd_audit BEFORE INSERT ON events WHEN NEW.type = 'node.cwd_changed' BEGIN SELECT RAISE(ABORT, 'audit unavailable'); END");
    const before = [rows("nodes"), rows("node_startup_context")];
    expect((await post(setup, body())).status).toBe(500);
    expect([rows("nodes"), rows("node_startup_context")]).toEqual(before);
  });

  it("resumes retained native history in the new checkout even from a pre-change snapshot", async () => {
    const rig = setup.rigRepo.findRigsByName("cwd-rig")[0]!;
    const snap = setup.snapshotCapture.captureSnapshot(rig.id, "manual");
    expect((await post(setup, body())).status).toBe(200);
    const resume = vi.fn(async () => ({ ok: true as const }));
    const orch = new RestoreOrchestrator({ db: setup.db, rigRepo: setup.rigRepo, sessionRegistry: setup.sessionRegistry,
      eventBus: setup.eventBus, snapshotRepo: setup.snapshotRepo, snapshotCapture: setup.snapshotCapture,
      checkpointStore: setup.checkpointStore, nodeLauncher: setup.nodeLauncher, tmuxAdapter: setup.tmuxAdapter,
      codexResume: { canResume: (type: string) => type === "codex_id", resume } as unknown as CodexResumeAdapter,
      claudeResume: { canResume: () => false } as unknown as ClaudeResumeAdapter,
    });
    await orch.launchSingleNode(rig.id, "design.aid", { snapshotId: snap.id });
    const call = resume.mock.calls.find(c => (c as unknown[])[2] === "retained-native-history") as unknown[] | undefined;
    expect(call, "managed continuation must attempt the retained conversation").toBeDefined();
    expect(call![3]).toBe(to);
    expect(setup.tmuxAdapter.createSession).toHaveBeenCalledWith(sessionName, to, expect.any(Object));
  });
});

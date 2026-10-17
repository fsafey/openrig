# Working in this fork

Personal fork: `fsafey/openrig` (`origin`). Upstream: `mvschwarz/openrig` (`upstream`).
Keep changes focused; prefer existing commands, configuration and skills before core changes.

## Start here

- [Foundation working document](docs/reference/foundation/WORKING.md): verified baseline, decisions and open questions. Stages 1-3 are complete; Atlas and connector implementation need a separate user decision.
- [Development skill](.agents/skills/developing-openrig/SKILL.md) and [CONTRIBUTING.md](CONTRIBUTING.md): package ownership, known problems, test layers and contribution rules.
- [Operations](docs/reference/foundation/operations.md): exact start, stop, resume, status and interface commands. Verify live state before acting.

## Runtime and machine

- Use Node 22 on this Apple Silicon Mac: `export PATH="/opt/homebrew/opt/node@22/bin:$PATH"`. Install dependencies with `npm ci` in each worktree that needs them; never share `node_modules` by symlink.
- The checkout is not the installed runtime. The foundation uses `~/.local/bin/rig-foundation`; inspect it with `rig-foundation --version` and `rig-foundation daemon status`. Do not restart a daemon hosting this session or unrelated work.
- Keep versioned source/configuration here, team artifacts in `~/Project/openrig-foundation-workspace`, and private state in `~/.openrig-foundation`. Never commit credentials, databases or raw provider logs. Keep installations independent of disposable worktrees.
- Before setup or launch, read [machine changes](README.md#what-openrig-changes-on-your-machine), inspect the dry run and back up affected configuration. `OPENRIG_HOME` does not isolate provider settings. Reuse existing authenticated accounts; do not add API-key billing, copy authentication or enable blanket permission bypasses.

## Work and delivery

- Use a sibling worktree under `~/Project` on a `codex/` branch. Preserve the primary checkout and others' edits. Use conventional commits; no version bumps or `CHANGELOG.md` edits.
- When using a team, assign explicit ownership and one installation/daemon operator. Keep owned work and handoffs in OpenRig's durable queue; distinguish message delivery, ownership, completion and reviewer acceptance.
- Run the smallest checks that exercise the change. Documentation-only edits need placement, link and diff checks, not a full test rerun. Separate source/stub evidence from real-provider evidence.
- The fork uses [local CI](docs/reference/local-ci.md), with Actions disabled and required `local-ci` status. `npm run ci:local` is the full gate. After failure, retain applicable passes, repair and rerun affected tests, then continue remaining stages; record original/final revisions and evidence honestly.
- Open a ready PR against the personal fork. Publish the exact candidate's scoped qualification result; use auto-merge where supported, otherwise normal protected merge. Never use an admin bypass or force-push main.
- Preserve needed ignored evidence outside worktrees. Leave merged worktrees to the established cleanup process; never delete them with `rm -rf` or edit Git's worktree metadata by hand.

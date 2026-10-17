# Foundation operations

This run uses published OpenRig **0.6.10**, build
`3001cc436656c435e54425443e708e3e2d8c7d68`, built 2026-10-11T22:36:45Z.
The development checkout began at `68fafba04e9838f2c5c79b9cbd2583d221475298`.
They are different revisions. Commands below were checked against the installed
release. Native provider clients were Claude Code 2.1.302 and Codex 0.162.1.

## Installation and separation

| Location | Responsibility |
| --- | --- |
| Personal fork and sibling development worktree | Versioned documentation and reusable `team/` configuration |
| `$HOME/.local/share/openrig/0.6.10` | Durable npm installation prefix, independent of Git worktree cleanup |
| `$HOME/Project/openrig-foundation-workspace` | Team working directory, configuration copy, authored artifacts |
| `$HOME/.openrig-foundation` | Instance database, topology, context, snapshots, transcripts, logs and private state |
| `$HOME/.local/state/openrig-foundation-evidence-20261017` | Private backups and raw experiment evidence, never committed |
| `$HOME/.local/state/openrig-foundation-worker-20261017` | Private external Opus worker receipts; worker stopped after assessment |
| Existing native provider homes | Shared subscription authentication, hooks, trust and native conversations |

The npm tarball integrity is
`sha512-hOkVP9ZtHeztUMa63CwTJspKfk71rccQDOUqCh02L/MxdB8y/qlGhy4GU5V5ZoBXlGsmyJgUnM2YKRrPhuqYeA==`.
This pins the published package. Transitive dependency ranges can resolve
differently on a later fresh install; retain the installed dependency inventory
with the private evidence if exact dependency reproduction matters.

Installation used Node **22.23.1**, arm64. The observed daemon executable was
`/opt/homebrew/Cellar/node@22/22.23.1/bin/node`; the wrapper selects
`/opt/homebrew/opt/node@22/bin/node`. That pins Node's major version, while
Homebrew may later change its patch version. Verify the process after upgrades.

```sh
PATH=/opt/homebrew/opt/node@22/bin:$PATH npm install --global \
  --prefix "$HOME/.local/share/openrig/0.6.10" @openrig/cli@0.6.10
```

The installed CLI entry is `lib/node_modules/@openrig/cli/dist/bin-wrapper.js`
under the prefix. The daemon entry is the same package's `daemon/dist/index.js`.
The SQLite binding loaded the packaged darwin-arm64 prebuild. The observed
daemon executable, CLI entry, SQLite binding and managed seat-bin symlink resolve
to the installed package. No development-worktree dependency was observed. The
daemon initially inherited the primary checkout as its working directory. After
the team stopped, the instance was restarted from the durable foundation workspace
and that working directory was verified. No source dependencies were installed
or shared between the checkouts for these documentation/configuration changes.

The local operator command is `$HOME/.local/bin/rig-foundation`, with these bytes
(the actual installed copy uses expanded absolute paths):

```sh
#!/bin/sh
export PATH="/opt/homebrew/opt/node@22/bin:$HOME/.local/share/openrig/0.6.10/bin:$PATH"
export OPENRIG_HOME="$HOME/.openrig-foundation"
export OPENRIG_PORT=18764
export OPENRIG_WORKSPACE_ROOT="$HOME/Project/openrig-foundation-workspace"
export OPENRIG_SHARED_DOCS_ROOT="$OPENRIG_HOME/shared-docs"
unset OPENAI_API_KEY ANTHROPIC_API_KEY OPENRIG_YOLO
exec /opt/homebrew/opt/node@22/bin/node \
  "$HOME/.local/share/openrig/0.6.10/lib/node_modules/@openrig/cli/dist/bin-wrapper.js" "$@"
```

Use the existing real HOME and provider homes. Do not copy authentication or
make an alternate CODEX_HOME. This experiment used Claude subscription and
ChatGPT login, with real completed provider turns and no API-key setup.

## First setup and launch

Before setup, back up `.tmux.conf`, `.claude.json`, `.claude/settings.json`,
`.codex/config.toml`, `.codex/hooks.json`, and the `openrig-skills`, `refocusing`,
and `rigs` directories under both `.claude/skills` and `.agents/skills`.
Preserve absent-path records, symlinks, file modes and original contents.
The run's private `before-setup/manifest.json` records these paths.

Inspect the dry run before applying:

```sh
rig-foundation setup --dry-run --providers both --no-herdr --no-ghostty --json
rig-foundation setup --providers both --no-herdr --no-ghostty --json
rig-foundation config set daemon.host 127.0.0.1
rig-foundation config set daemon.port 18764
rig-foundation config set workspace.root "$HOME/Project/openrig-foundation-workspace"
rig-foundation config set ui.timezone America/Guayaquil
rig-foundation config set runtime.readiness_timeout_seconds 90
cd "$HOME/Project/openrig-foundation-workspace"
rig-foundation daemon start --no-kernel --host 127.0.0.1 --port 18764
rig-foundation up "$PWD/team/rig.yaml" --cwd "$PWD" --plan --json
rig-foundation up "$PWD/team/rig.yaml" --cwd "$PWD" --json
```

Copy this directory's `team/` into the working directory before its first launch.
Give that directory a short README identifying intent, artifact directory,
installed package, and queue authority. Leave the exact answer artifact out of
normal orientation. Preserve any existing workspace files when repeating setup.
Use the spec only for first launch; restore an existing team by its name.

The two seats use the ordinary team defaults: Codex workspace-write with
on-request approval, Claude acceptEdits. Runtime evidence confirmed those launch
selections and the Codex native configuration. No full-bypass policy, YOLO,
non-interruptive mode, optional workstation tools, or unpinned kernel agents
were selected. Bounded Claude commands required operator approval. The coordinator
approved inspected read/hash commands, session-only reads of installed source
directories, and a project-scoped read-only allowance for the installed daemon
source. No blanket command permission was added. Arbitrary future work can still
require native permission decisions.

## Daily commands

```sh
# Installation and instance identity
rig-foundation --version
rig-foundation daemon status
rig-foundation ps --nodes --rig foundation --json
rig-foundation queue list -a -A --json

# Start the stopped instance; no extra kernel seats
cd "$HOME/Project/openrig-foundation-workspace"
rig-foundation daemon start --no-kernel --host 127.0.0.1 --port 18764

# Restore the whole team after it has been stopped
rig-foundation up foundation --existing --json

# Open live conversations in a desktop Terminal window
rig-foundation terminal open foundation --window --json
# Dashboard in a terminal
rig-foundation tui

# Inspect evidence and communicate; sending does not create owned work
rig-foundation seat status study-writer@foundation --json
rig-foundation queue show foundation-pilot-20261017 --full --json
rig-foundation queue transitions foundation-pilot-20261017 --json
rig-foundation send study-writer@foundation 'Operator: report your current owned work.' --verify --json

# Graceful stop, retaining state and native conversation references
rig-foundation down foundation --snapshot --json
rig-foundation daemon stop
```

The terminal-open call reported a new Terminal window with both conversations
and no absent or degraded tiles. Desktop inspection was unavailable in this
session, so visible rendering and human interaction remain unverified.

## Recover one seat without stopping its colleague

This run's stable rig ID is `01M55ZB72N2FY8BNAGSWQ1YYF6`.
For another installation, read the current rig ID from `ps`.

```sh
rig-foundation snapshot 01M55ZB72N2FY8BNAGSWQ1YYF6
# Record the snapshot ID returned while the target seat is active.
# This run verified snapshot 01M560YRXKFDES2XHVR7GG9JAD. For later work,
# set the variable to the newly captured ID, not this historical snapshot.
foundation_snapshot=01M560YRXKFDES2XHVR7GG9JAD
rig-foundation seat stop study-writer@foundation \
  --reason 'Operator-requested interruption of this seat' --json
rig-foundation launch 01M55ZB72N2FY8BNAGSWQ1YYF6 study.writer \
  --snapshot-id "$foundation_snapshot" --plan --json
rig-foundation launch 01M55ZB72N2FY8BNAGSWQ1YYF6 study.writer \
  --snapshot-id "$foundation_snapshot" --json
```

Inspect the snapshot selection, target, non-target effects, result, native
conversation ID, and queue ownership. `launch` requires the rig ID in this
release; the name `foundation` was refused. `up foundation --existing` was also
refused while the reviewer remained live. Neither refusal changed the team.
There is no installed `seat restart --keep-conversation` command.

Do not assume that automatic snapshot selection preserves the conversation.
The cold-handoff launch selected a snapshot captured after the writer had stopped.
It recorded an absent active occupant, so restore started a fresh conversation
despite historical session tokens remaining in the database. Automatic selection
also changed between the earlier plan and execution when a newer snapshot appeared.
Use an explicit pre-stop snapshot when intending native resume, then verify the
actual native ID and a provider turn. Queue ownership must be read live either way.
This explicit-snapshot procedure was subsequently exercised: the writer resumed
native conversation `01a14c0c-f515-7942-879a-eaf43e316575`, read its empty owned
queue, and reported retained prior dialogue in a real Sol 6.1 turn.

The cold launch also exceeded the CLI's five-second request deadline. The command
reported UNKNOWN, while the daemon completed the launch. Inspect seat state and
events before retrying an uncertain lifecycle command; do not launch a duplicate.

A deliberately fresh conversation is a different operation and is not a retry
for uncertain resume:

```sh
rig-foundation seat launch study-reviewer@foundation --fresh --stop \
  --reason 'Explicit fresh-context recovery experiment' --json
```

Read queue state after replacement and require a real provider turn that finds
its obligations. A ready label or a preserved resume token alone is insufficient.

In this pilot, subset native resume created a new OpenRig session and generation
but retained the prior queue claim stamp. Fresh replacement released that
occupant's claim to pending and required a new claim. Do not infer generation
continuity from claim survival. Inspect both identities and the transition history.

If a native approval prompt owns input, ordinary `send` refuses delivery with
`target_needs_input`. Inspect `capture <seat> --lines 40`, approve only the intended
bounded action through the native interface, then resend the original message.
The prompt-interaction escape hatch is not a substitute for inspecting the prompt.

## Machine changes and recovery

Setup appended a managed tmux block while retaining the original bytes. Published
0.6.10 daemon startup added Codex hooks and trust configuration even with
`--no-kernel`. This differs from newer checkout code. The first seat launches
added workspace trust and native workspace metadata. Global discovery skills
were seeded. The team workspace received managed guidance and collector files.

Independent comparison retained all existing Codex TOML keys and values.
`.claude/settings.json` and `.codex/hooks.json` remained byte-identical. Claude's
global JSON also changed native cache/UI counters during concurrent activity;
those changes cannot all be attributed to OpenRig.

`OPENRIG_HOME` isolates instance state, not shared provider configuration. For
rollback, first stop only this team and daemon. Compare current files with the
private backup and remove only this installation's managed blocks and its
workspace trust entries. Do not blindly restore old provider files over later
native changes. Remove newly seeded discovery directories only after confirming
their ownership and that no other OpenRig instance uses them. Preserve the
private database, snapshots, artifacts, and native conversations for recovery.
Keep backups private: provider settings may contain sensitive data.

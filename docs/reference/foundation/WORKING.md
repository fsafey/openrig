# OpenRig foundation

Status: **stages 1-3 completed and accepted on 2026-10-17**. Atlas remains read-only;
no connector implementation is authorized by this document.

## Installed and demonstrated

Published **OpenRig 0.6.10**, build `3001cc436656c435e54425443e708e3e2d8c7d68`,
runs on Apple silicon with **Node 22.23.1**. It is installed under
`$HOME/.local/share/openrig/0.6.10`, independent of the source checkout and
worktree. The private instance is loopback port **18764**, with state in
`$HOME/.openrig-foundation` and working artifacts in
`$HOME/Project/openrig-foundation-workspace`.

The live pilot used two OpenRig seats: **GPT-6.1 Sol writer** and **Opus 5.5
reviewer**, with effective models verified from native provider records and
existing subscription authentication. Native Sol reconnaissance and an external
Opus worker supported investigation; they did not substitute for the live team.

Observed: durable assignment and claim, author handoff, independent review tied
to an artifact hash, native conversation resume, fresh-session reconstruction
through normal orientation and durable work, and global event replay after a
collector disconnect. See the trace for each evidence boundary.
All four pilot obligations are closed. Both seats are stopped and recoverable;
the daemon remains available, with no unattended experimental provider work.

## Decisions and rationale

- Pin the published package rather than run the newer development checkout.
  This gives an identifiable installed baseline without building core changes.
- Keep source/configuration, team artifacts, and private runtime state separate.
  Back up shared provider/tmux configuration because OPENRIG_HOME does not isolate it.
- Borrow Workshop's orientation, ownership and review practices for two seats.
  Use ordinary permissions, no kernel agents, and no optional workstation tools.
- Keep installation and lifecycle control with one coordinator. Give each seat
  bounded artifact ownership and use durable work for every handoff.
- Accept findings only with attributed evidence. Sending, claiming, finishing
  an author slice, and reviewer acceptance remain separate facts.

## Operate and inspect

Start with [daily operations and recovery](operations.md). The local wrapper is
`$HOME/.local/bin/rig-foundation`. After a team stop, use
`rig-foundation up foundation --existing --json`, then
`rig-foundation terminal open foundation --window --json`.
Inspect ownership with `rig-foundation queue list -a -A --json`.
Stop the team with `rig-foundation down foundation --snapshot --json`.

- [Reusable two-seat configuration](team/rig.yaml) and [culture](team/CULTURE.md)
- [Runtime trace, models, experiments and acceptance](evidence.md)
- [Reviewed brief and authored evidence](artifacts/README.md)
- [Preliminary connector outline and upstream limitations](connector-outline.md)

## Limitations and next decision

Delivery is in [personal-fork PR #1](https://github.com/fsafey/openrig/pull/1).
Local checks pass. Normal merge remains pending: GitHub reports Actions enabled
but no registered workflows, and activation of the existing `tests.yml` returns
404. Auto-merge is disabled in the fork. No branch rules or CI files were changed.

Native resume and fresh replacement have different claim behavior. A resumed
writer kept an old claim stamp despite a new OpenRig generation. Ordinary native
permission prompts need operator attention. Rig-filtered event streams omitted
queue events, so a future projection needs global replay and state reconciliation.
Declared collaboration edges were absent from the observed identity projection.
Desktop command success was observed; physical UI acceptance and host-reboot
recovery were not tested.

Recommend a **read-only Atlas projection** next, after an explicit owner decision:
show seats, current sessions, work owner, predecessor chain, accepted artifacts,
and next action. Use it to test human understanding before adding action controls.
Do not infer authorization, execution or undo semantics from spatial relationships.

Workshop reference: [pinned rig and culture at 2a5d93c8](https://github.com/mvschwarz/openrig-world/tree/2a5d93c8d8f8aafd5040bea8b74def4cf0f2f0d4/rigs/workshop).
No Workshop bundle was installed; its broad permission settings were excluded.

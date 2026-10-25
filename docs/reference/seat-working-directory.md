# Change an existing seat's working directory

Use `rig seat set-cwd` when an existing seat has been assigned another checkout.
Editing its RigSpec alone does not update its saved launch settings.

First inspect the seat with `rig ps --nodes --rig <rig> --full --json`. Retain its
native history and operational records, confirm target file custody, then update
the maintained declaration's member cwd. Supply that declaration and the observed
node ID and current stored cwd:

```sh
rig seat set-cwd design-aid@project \
  --cwd /projects/product-design \
  --expected-cwd /projects/operations/design-aid \
  --expected-node-id <observed-node-id> \
  --spec /projects/team/rig.yaml \
  --reason "assigned product checkout" --json
```

Outside a managed seat, include `--operator <address>`. The expected values prevent
a stale assignment from changing a recreated seat or overwriting a more recent
cwd choice. Relative paths, nonexistent directories, mismatched declarations and
unreadable required startup files are refused before writing anything.

The command resolves startup sources for this one member with the target cwd.
It commits the cwd, startup selection and `node.cwd_changed` audit event together.
Model, effort, permission selection, role, node ID, queue address, session bindings
and native history are retained. Other declaration members are not applied.
No file is projected into the target and no native process is interrupted.
Ordinary agent seats are supported; terminal and artifact-seeded startup selections
are refused rather than silently dropping their additional context.

Success means **saved future cwd and prepared startup selection**. The incumbent
process keeps its existing cwd and has not consumed target instructions or skills.
A controlled managed continuation is a separate action. A resume from an older
snapshot uses the current audited cwd and startup selection for that same stable
node, while retaining the snapshot's conversation lineage. Resume does not replay
startup prompts into an existing history. Reorient the occupant explicitly and
verify actual native cwd, applicable AGENTS.md, required skills, retained records
and routing after the move. A shell `cd`, successful persistence, or a stub test
does not prove that native context was consumed.

Keep operational records at their existing absolute homes and update startup
guidance that assumed an operational cwd. Preserve artifacts and move one seat at
a time. Changing a saved launch setting does not authorize a product build,
runtime installation, daemon restart or unrelated seat interruption.

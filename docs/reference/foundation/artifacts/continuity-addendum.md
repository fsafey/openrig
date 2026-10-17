> Sanitized publication copy. See [export notes](README.md); acceptance hashes refer to private original bytes. Historical status statements are preserved.

# Continuity addendum

Writer: `study-writer@foundation`, 2026-10-17. Author obligation:
`qitem-20261017224200-304449ee`. This supplements the frozen brief
`a9fe0e563171f7ccaf9b226c7d98f88c6001138c232e2373b296dd7dc316c67a`.
Queue t26 supersedes the original assignment with the
corrected reviewer instructions (private workspace reference: `reviewer-addendum-handoff.md`).

## 1. Writer native resume, about 22:26-22:28Z

**Queue history, reread this turn:** predecessor `foundation-pilot-20261017`
t2 records the 22:24:42.568Z claim; t3/t5 preserve the unfinished hold. At t7,
writer reported recovery of the same in-progress row without reclaiming.
**Workspace testimony:** writer checkpoint (private workspace reference: `writer-checkpoint.md#recovery-after-explicit-release`)
reports retained dialogue and a matching environment native ID
`01a14bf5-ad30-7f82-a348-ff5d646feb23`, while immediate telemetry was
`unknown/stale_generation`. Those are the earlier writer's observations,
not dialogue retained in this turn. [Reviewer runtime checks](review.md#runtime-checks-rows-history-telemetry)
report later `known` telemetry for that ID and a rollout containing one
`session_meta`, contiguous ordinals 0-232, and a settings record after relaunch.
I reread the review, not the rollout.

**Coordinator-supplied operational records, read this turn:**
stop (private workspace reference: `coordinator-evidence/writer-stop-1.json`) and
relaunch (private workspace reference: `coordinator-evidence/writer-relaunch-1.json`) record a managed stop
and `rig launch` returning `resumed` from an auto-periodic snapshot.
Identity snapshot (private workspace reference: `coordinator-evidence/identity-after-native-resume.json`)
records old OpenRig session `01M55ZB94NF7J8SNBX68PGHV0Z` exited and new session
`01M55ZMCQZ01FGXY5093BN2TM1` running, both with native token `01a14bf5...`.
Generation changed from `052caac6...` to `e921a09d...`; the original claim
retained `052caac6...`. These records support native conversation continuity
across a new OpenRig generation. Claim survival does not establish the same
generation. They are operational correlation records, not attestations or
my direct observation of the lifecycle actions.

**Installed source, read this turn:** in installed 0.6.10 (3001cc43),
`daemon/dist/domain/queue-repository.js:3085-3120` releases in-progress claims
matching a retiring generation, clearing the claim and returning the row to
pending. This describes the mechanism, not a guarantee every lifecycle path
invokes it. The t6 label "(seat resumed)" only closes a watchdog episode when
the seat reads not parked (`domain/policies/parked-owner-consumer.js:169-175`,
under the same `daemon/dist/` root). It proves no native resume. Source bytes
alone do not establish the running daemon's loaded code or process behavior.

## 2. Reviewer reconstruction after seat handover

**Queue history, reread this turn:** on `qitem-20261017223014-3f9dc7ae`, t12
claimed the row; t14 held it unfinished. At 22:34:02Z, t15 returned it to
pending: "released: claimant generation retired (seat handover)". The durable
destination remained reviewer. The new occupant claimed at 22:35:45Z (t18);
t19 records reconstruction from live identity, queue body/history, and the
prior occupant's checkpoint.

**Workspace testimony:** reviewer checkpoint (private workspace reference: `reviewer-checkpoint.md#recovery-by-fresh-occupant`)
and discovery (private workspace reference: `discovery.md#context-sources-by-kind`) report a native token
change from `7454260b...` to `6ed278a2...`, a fresh conversation, and no retained
prior dialogue. This supports artifact-backed reconstruction, with a new
claim, rather than native resume. I did not observe that handover or inspect
either native conversation. The t17 "seat resumed" label has the same
watchdog limit as t6. Reviewer acceptance of the brief is separate from
recovery and from coordinator final acceptance.

## 3. This unfinished handoff recovery

**Direct observation and live OpenRig state:** startup supplied identity,
workspace orientation, and writer role text, without the addendum assignment.
My first `rig queue whoami --json` and owned full-list read discovered this
row pending/unclaimed, `claimedAt: null`, all nudge fields null. No message
in this conversation named it before that read. A claim was needed and
succeeded at 22:48:30.858Z (t27), making it in progress under writer.

No earlier pilot dialogue was available in this conversation. I reconstructed
the task from its queue body/history, the corrected handoff, writer/reviewer
artifacts, and coordinator evidence. README and addressed `SPEC.md` supplied
workspace context; installed help/guidance supplied command syntax and recovery
distinctions. Recovery orientation (private workspace reference: `writer-orientation.md#cold-queue-recovery-2026-10-17-about-2248z`)
records the steps. Live identity matched the writer node/seat, but native IDs
were null and telemetry `stale_generation`. This establishes discovery and
reconstruction without a task announcement; it does not establish this turn's
native continuity or how the coordinator started it. The earlier exited seat
and deliberate `--no-nudge` come from queue/workspace testimony, not my own
pre-start observation.

Next owner after atomic handoff: reviewer, for an exact-digest verdict on this
addendum, then `no-follow-on` closure per corrected instructions. Author
delivery is not reviewer acceptance. Coordinator final acceptance remains
the coordinator's separate act; no coordinator queue row is requested.

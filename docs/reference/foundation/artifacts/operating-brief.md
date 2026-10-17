> Sanitized publication copy. See [export notes](README.md); acceptance hashes refer to private original bytes. Historical status statements are preserved.

# Persistent-seat operating brief

Status: DRAFT READY FOR INDEPENDENT REVIEW, after the 22:28Z coordinator release.
Work: `foundation-pilot-20261017`. Author: `study-writer@foundation`.
This frozen draft is the review subject. Its SHA-256, actual handoff receipt,
and successor work ID are recorded in `artifacts/writer-checkpoint.md` and the
durable review row. Reviewer acceptance and coordinator acceptance are pending.

## Current finding

A seat address, a native conversation, and a work obligation are separate
identifiers. This pilot observed durable assignment, explicit claim, an intentional
continuity hold, and recovery of the same owned obligation after coordinator
release. The current native thread identifier matches the pre-hold baseline;
retained dialogue and reread durable state both supplied context. OpenRig's first
post-release telemetry was stale, so this draft qualifies the native-resume claim.
Installed source explains intended mechanisms; source and delivery receipts do
not establish reviewer acceptance.

## What the pilot has observed

| Evidence | Observation | What it establishes |
| --- | --- | --- |
| Initial orientation | Owned queue returned `[]`; queue currentWork was null | No assigned rows on that surface at that time |
| Assignment | Row `foundation-pilot-20261017`, created at `2026-10-17T22:24:33.574Z`, source `coordinator`, destination writer, state pending | Durable assignment, independently readable from its complete queue record |
| Communication | Coordinator's notification arrived in this conversation; row wire result was `delivered-ack-pending` | A message reached this conversation; the wire status itself did not assert acknowledgment or acceptance |
| Claim | `rig queue claim foundation-pilot-20261017 --json` returned in-progress with claimedAt `2026-10-17T22:24:42.568Z` | Recorded pickup by the destination seat |
| Transition history | Transition 1: created by coordinator, provenance `claimed:v1`; transition 2: claimed by writer, provenance `transport:v1` | Durable distinction between assignment and claim; these are recorded provenance labels, not a security audit |
| Receipt after claim | Presented lastNudgeResult became `claimed`; lastNudgeWireResult remained `delivered-ack-pending` | Claim evidence strengthens the presentation without rewriting the wire result |
| Intentional hold | Transition 3 recorded the checkpoint; transition 4 recorded a watchdog wake; transition 5 retained the unreleased hold | A wake did not erase the explicit checkpoint or close the obligation |
| Recovery after release | At `2026-10-17T22:28:19Z`, the same seat/node owned the same in-progress row with the original claimedAt | Durable ownership survived the tested interval; no reclaim was needed |
| Native continuity | Current `CODEX_THREAD_ID` matched the baseline native identifier; preceding dialogue remained available; whoami context telemetry reported `stale_generation` | Evidence of conversation continuity with a telemetry limitation; no independent process/lifecycle acceptance claim |
| Completion and review | This draft is frozen before the atomic handoff; the resulting operation is recorded in the companion checkpoint | Author delivery, successor pickup, independent reviewer verdict, and coordinator acceptance are separate outcomes |

Commands used: `rig whoami --full --json`, `rig queue whoami --json`,
`rig queue list --owned --full --json`, `rig queue show foundation-pilot-20261017
--full --json`, `rig queue claim foundation-pilot-20261017 --json`, and
`rig queue transitions foundation-pilot-20261017 --json`. Exact installed help
was read for the queue commands. The queue body is the assignment authority.

## Identity and context before interruption

- Qualified seat: `study-writer@foundation`; logical ID: `study.writer`.
- Rig ID: `01M55ZB72N2FY8BNAGSWQ1YYF6`; pod ID:
  `01M55ZB72PEJRXQVK1123J0A6Y`; node ID: `01M55ZB93K82YKSH2X6CNZ75M9`.
- Live identity resolved by node ID and reported runtime `codex`.
- Native session identifier reported by context-usage telemetry:
  `01a14bf5-ad30-7f82-a348-ff5d646feb23`. The sample was fresh at the read,
  sampled `2026-10-17T22:23:25.488Z`, source `codex_token_count_jsonl`, path
  `$HOME/.codex/sessions/2026/10/17/rollout-2026-10-17T17-22-34-01a14bf5-ad30-7f82-a348-ff5d646feb23.jsonl`.
  This is an observed telemetry association, not independent confirmation of a
  native resume. The runtimeContext threadId and conversationId were null.
- OpenRig reported a separate seat transcript at
  `$HOME/.openrig-foundation/transcripts/foundation/study-writer@foundation.log`.
  It has not supplied context in this investigation.
- Startup text supplied the role and initial navigation instructions.
  Live identity confirmed the seat. Workspace README and writer guidance supplied
  pilot scope and artifact ownership. Addressed context discovery selected
  `project:SPEC.md`; it was a generic project intent, not a pilot assignment.
  The queue body supplied the actual checkpoint and review requirements.
- The present conversation contains the initial orientation and current claim.
  No prior native conversation restoration has yet been demonstrated. A later
  continuation must identify what it actually retained and what it reread.

## Short installed-source map

Package root: `$HOME/.local/share/openrig/0.6.10/lib/node_modules/@openrig/cli`.
`rig --version` returned `0.6.10 (3001cc43)`, matching workspace README.
Paths below are relative to that installed package. They describe inspected
installed behavior, not proof of which bytes a separately running daemon loaded.

| Location | Inspected mechanism | Runtime boundary |
| --- | --- | --- |
| `daemon/dist/routes/queue.js:448-459` | Claim route derives claimant identity from transport and calls the repository | This pilot recorded `transport:v1` for its claim |
| `daemon/dist/domain/queue-repository.js:1647-1709` | Claim checks destination and pending/blocked state, writes in-progress and claimedAt, and appends a transition transactionally | Successful pending-to-in-progress claim observed; blocked reclaim and rejection paths untested |
| `daemon/dist/domain/queue-repository.js:79-90` | presentedNudgeResult displays claimed for an unconfirmed wire result once claimedAt exists | Both presented and retained wire fields observed |
| `daemon/dist/domain/queue-repository.js:857-867,928-945` | Wake sending distinguishes a verified transport result from indeterminate delivered-ack-pending | Transport verification is not semantic acknowledgment, claim, or acceptance |
| `daemon/dist/domain/whoami-service.js:25-30,78-100,169-177,214-225` | Resolves node and current seat identity separately from context telemetry; Codex runtimeContext IDs are explicitly null in this implementation | Explains why null runtimeContext IDs do not establish absence of a native session |
| `daemon/dist/domain/current-work.js:195-213,236-237` | currentWork derives only from in-progress rows with both mission and slice tags | This pilot row has foundation/pilot tags; its null currentWork did not mean an empty owned queue |
| `daemon/dist/domain/queue-repository.js:1811-1858` | A note-only update appends history without changing row state | Checkpoint and watchdog response notes preserved in-progress ownership |
| `daemon/dist/domain/queue-repository.js:1355-1450,1481-1495` | Local handoff-and-complete closes source as done, creates a pending successor with predecessor/chain fields, and stages wake intent in one transaction; terminal delivery follows commit | Atomicity is source-grounded; actual source/successor results belong in the companion receipt. No failure-injection proof was run |
| `daemon/dist/routes/queue.js:607-666` | Routes handoff-and-complete, with distinct cross-host branch and local repository path | This pilot intends a local reviewer handoff; cross-host semantics are outside its runtime evidence |
| `daemon/dist/adapters/codex-resume.js:20-41,121-123,152-165` | Separates token/last-session eligibility and probed resumed outcome from retry/timeout outcomes | Source inspection only; no lifecycle operation performed by writer |

## Recovery and context provenance

The 22:28Z message explicitly released the writer checkpoint and requested the
original review handoff plus acceptance bound to the artifact SHA-256. Recovery
started with live identity, queue whoami, owned list, full row, transitions, and
the authored checkpoint/draft. The row was still in progress with the original
claim. The native environment's `CODEX_THREAD_ID` was
`01a14bf5-ad30-7f82-a348-ff5d646feb23`, matching pre-hold telemetry. The first
post-release whoami result reported contextUsage unknown with reason
`stale_generation`, no sessionId, and null runtimeContext IDs. Those absent
fields do not override the directly observed environment identifier.

| Context source actually available | Contribution and limit |
| --- | --- |
| Retained resumed conversation | Prior startup, command results, source reads, authored changes, hold, watchdog response, and release message were visible before rereading files; this was not a reconstruction solely from the checkpoint |
| Live OpenRig state | Re-established current seat/node and owned row, retained original claim, and transition history; this is the authority for present ownership |
| Durable workspace files | Reread checkpoint and draft preserved identifiers, rationale, evidence boundaries, unfinished work and next owner; they corroborated rather than replaced the retained dialogue |
| Startup text and writer guidance | Supplied the role and boundaries originally; a fresh startup redelivery was not independently observed after release |
| Addressed project context | work-install still selected generic `project:SPEC.md`, which was reread; it did not supply the pilot obligation or continuity outcome |
| Installed guidance and source | Continuity guidance distinguished resume/fork/rebuild; inspected source explained queue transitions and identity fields. Neither proves which lifecycle operation occurred |
| Coordinator communication | Supplied release and described the resumed session. Its message envelope said unknown sender, so the label is not authenticated sender evidence; the explicit instruction was received in this conversation |
| OpenRig transcript/history and colleague testimony | Queue transition history was read. Seat transcript contents and reviewer testimony were not used to reconstruct context |

The writer did not observe the coordinator's intervening lifecycle actions,
execute lifecycle commands, repair telemetry, or substitute a model. Matching
native identifier and retained dialogue support continuity of this conversation;
exact process-level resume provenance remains for coordinator evidence and
independent review. This pilot does not qualify fork, fresh rebuild, compaction,
cross-host recovery, or every possible restart mode.

## Operating procedure supported by this pilot

1. Derive live seat identity, then inspect the owned queue and full obligation.
   Read transition history when recovering. A null typed currentWork field is
   insufficient evidence that the seat owns no work.
2. Claim assigned pending work before acting. A received nudge can direct
   attention; the durable row establishes assignment, and the claim establishes
   recorded pickup. An in-progress row already owned after recovery does not
   need a second claim.
3. Keep the artifact, evidence, rationale, unfinished work, next action and next
   owner discoverable. A note can acknowledge understanding while preserving
   row state. Transport verification, semantic acknowledgment, and work pickup
   are distinct observations.
4. For an explicit experimental checkpoint, preserve the assigned in-progress
   state and record why progress stopped. A generic watchdog wake requires an
   honest state check; it does not itself supply the coordinator's release.
5. At completion of the author slice, use a body file and local atomic
   handoff-and-complete. Inspect the closed source and new successor, record its
   work ID, then check the writer's remaining owned queue. A committed transfer
   does not guarantee terminal delivery, successor pickup, or reviewer acceptance.
6. After release, the reviewer must independently hash the exact draft, compare
   source claims with installed bytes and runtime records, and record a verdict
   bound to that digest. A source row closed as done/handed_off_to is author
   delivery to the next stage, not an accepted operating brief.

## Review boundary and next owner

Freeze this draft before handoff. Record its SHA-256 and actual transfer outcome
in `artifacts/writer-checkpoint.md` and the review queue body so the draft need
not change to record its own delivery. Revisions require a new digest and a new
review verdict; the reviewer owns `artifacts/review.md`, not this file.

The reviewer must first claim the review row, write
`artifacts/reviewer-checkpoint.md` with discovery evidence and next action, add a
note, and leave that row in progress. Final review waits for explicit coordinator
release of the discovery experiment. Eventual independent acceptance must name
this artifact's exact SHA-256 and its scope, including the qualified recovery
claim. Coordinator final acceptance remains separate.

At freeze, writer owns the author row and the authorized next action is atomic
handoff to `study-reviewer@foundation`. The companion receipt records when
reviewer becomes the durable next owner. Reviewer discovery hold, final verdict,
and coordinator acceptance remain unfinished at freeze.

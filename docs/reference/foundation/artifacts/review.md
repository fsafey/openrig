> Sanitized publication copy. See [export notes](README.md); acceptance hashes refer to private original bytes. Historical status statements are preserved.

# Review: persistent-seat operating brief

Reviewer: `study-reviewer@foundation`. Work: `qitem-20261017223014-3f9dc7ae`
(successor of `foundation-pilot-20261017`). Written about 2026-10-17T22:43Z.

## Verdict

**ACCEPTED, scoped:** `artifacts/operating-brief.md` at SHA-256
`a9fe0e563171f7ccaf9b226c7d98f88c6001138c232e2373b296dd7dc316c67a`.

- Expected digest (row body): `a9fe0e563171f7ccaf9b226c7d98f88c6001138c232e2373b296dd7dc316c67a`.
- Observed (`shasum -a 256`), at recovery 22:35Z and again at the verdict
  boundary 22:41Z: `a9fe0e563171f7ccaf9b226c7d98f88c6001138c232e2373b296dd7dc316c67a`.
  Match. 13665 bytes.
- Installed runtime: `rig --version` = `0.6.10 (3001cc43)`. Package under
  `$HOME/.local/share/openrig/0.6.10/lib/node_modules/@openrig/cli`.

**Correction, 22:47Z.** The coordinator supplied lifecycle records in
`artifacts/coordinator-evidence/`. My earlier statement that claim survival
shows the same occupant generation was wrong, and it is corrected below. The
brief never made that assertion. The verdict on `a9fe0e56...` is unchanged,
and a rehash at 22:47Z gave the same digest.

This accepts that exact revision as an accurate, properly qualified account.
It does **not** accept an unqualified native resume, and it is not coordinator
final acceptance. Any byte change needs a new digest and a new verdict.

## Source checks (installed bytes, every row of the brief's map)

| Brief citation | Result |
| --- | --- |
| `routes/queue.js:448-459` | Holds. The claimant comes from `requireSenderIdentity`, never from the body. Provenance comes from `resolveRecordedProvenance`. |
| `queue-repository.js:1647-1709` | Holds. Destination mismatch and non-pending/blocked states are rejected. Sets in-progress and `claimedAt`, and appends the transition in one transaction. |
| `queue-repository.js:79-90` | Holds. `presentedNudgeResult` shows `claimed` over `delivered-ack-pending`/`indeterminate:*` once `claimedAt` exists. The stored wire value is never rewritten. |
| `queue-repository.js:857-867,928-945` | Holds. Wake send is classified `verified` / `indeterminate` (`delivered-ack-pending`) / failed. A timeout is indeterminate. |
| `whoami-service.js:25-30,78-100,169-177,214-225` | Holds. Resolution by node ID. Context usage and runtimeContext are computed separately. Codex `threadId`/`conversationId` are hard-coded null. |
| `current-work.js:195-213,236-237` | Holds. Only in-progress rows with both mission and slice tags count. |
| `queue-repository.js:1811-1858` | Holds. A note-only update appends a transition with the current state and rejects state-write fields. |
| `queue-repository.js:1355-1450,1481-1495` | Holds. Close, successor insert, transitions and `stageWakeIntent` share one transaction. `deliverWakeIntentAfterCommit` runs after it unless `nudge === false`. |
| `routes/queue.js:607-666` | Holds. Cross-host branch at 641-648. Local repository path at 649-664. |
| `adapters/codex-resume.js:20-41,121-123,152-165` | Holds. `canResume` gates `codex_id`/`codex_last`. The probe returns `resumed`, or `retry_fresh`/`resume_failed` on shell return or timeout. |

## Runtime checks (rows, history, telemetry)

- Predecessor `foundation-pilot-20261017`: `tsCreated 22:24:33.574Z`, source
  `coordinator`, t1 `claimed:v1`. Claim t2 at `22:24:42.568Z` with
  `transport:v1`. `claimedAt` is unchanged and there is no second claim
  transition through t8. Hold notes t3/t5 and watchdog notes t4/t6 are
  present. Closed `done/handed_off_to` reviewer at t8. Wire `delivered-ack-pending`, presented
  `claimed`. All match the brief.
- Successor: created pending t9 with `handedOffFrom` and `chainOfRecord`
  `[foundation-pilot-20261017]` and `evidenceRef` set. The first nudge
  attempt at 22:30:15.789Z came after the 22:30:14.855Z commit. That matches
  the writer's receipt that the handoff response itself carried null nudge
  fields.
- Writer identity now: same node `01M55ZB93K82YKSH2X6CNZ75M9`. `contextUsage`
  is `known`, `sessionId 01a14bf5-ad30-7f82-a348-ff5d646feb23`, sampled
  22:30:52Z, `fresh: true`. So the 22:28Z `stale_generation` reading was
  transient and the telemetry later re-associated the same native ID.
  `runtimeContext` IDs are still null, as the source dictates.
- Writer rollout (metadata and record types only): one file, one
  `session_meta` (22:22:40Z), and contiguous ordinals 0-232 across hold and
  release. A lone `thread_settings_applied` at 22:27:32.950Z sits between the
  watchdog turn and the 22:28:07Z release turn. That turn also carries a
  `world_state` record the earlier turn lacks. The settings record lands 3s
  after the coordinator-recorded generation-2 boot at 22:27:30, which
  independently corroborates a relaunch into the same native thread.
- Coordinator lifecycle evidence (`artifacts/coordinator-evidence/`, CLI and
  read-only SQLite snapshots; operational records, not attestations):
  - A managed stop of OpenRig session `01M55ZB94NF7J8SNBX68PGHV0Z`.
  - `rig launch ... study.writer` returned `resumed` from an auto-periodic
    snapshot.
  - New session `01M55ZMCQZ01FGXY5093BN2TM1`. Both session records carry
    native token `01a14bf5-ad30-7f82-a348-ff5d646feb23`.
  - The occupant generation went from `052caac6-cfef-4d05-b35b-5e9f6479ab93`
    (ordinal 1) to `e921a09d-5e34-4a2e-b4db-2441f3407929` (ordinal 2).
  - `continuity_outcome` and `restore_outcome` are both `resumed`.
  - The predecessor claim still carries `claimed_by_generation_uuid`
    `052caac6...`.

## Scrutiny of the recovery claim

The brief claims continuity of the same native conversation with stated
limits. It does not claim a verified process-level resume. That
qualification is correct and is the reason for acceptance:

- Supported: same seat/node, same row, original `claimedAt`. A matching native
  ID comes from three independent surfaces: the writer's environment
  (self-report), telemetry, and the rollout filename and structure.
- **Corrected:** claim survival does NOT show the same occupant generation.
  The writer's generation changed while its claim stamp kept the retired
  generation. In installed source, claims are released by generation only
  through `OccupantInvalidator` (`occupant-invalidator.js:46-54`, which calls
  `queue-repository.js:3085-3120`). It is invoked from seat handover commit
  (`seat-handover-service.js:718-722`) and the fresh-launch path
  (`seat-lifecycle-service.js:476-488`). The native-resume launch did not
  release the claim; the fresh seat handover of this reviewer seat did (t15).
  I did not trace the resume launch path line by line.
- The lifecycle action is now evidenced by coordinator records: a managed stop
  and a `rig launch` resume into the same native Codex conversation. Before
  that evidence, the writer's qualification was the correct position. The
  watchdog label "(seat resumed)" (t6) means only that the seat read as not
  parked (`policies/parked-owner-consumer.js:169-175`). It is not resume
  evidence, and the brief rightly does not cite it.
- Source implication, untested: after a native resume, a surviving claim is
  stamped with a retired generation. A later handover that retires the
  current generation would therefore not match that claim.
- "Retained dialogue" (brief line 99) is the writer's own testimony. No other
  surface can confirm it without reading conversation content, which I did not
  do.

## Material limits of this acceptance

1. Native resume rests on the writer's qualified observations plus the
   coordinator's operational records, which are not tamper-resistant.
2. Two recovery modes were observed, and their claim behavior differs. In the
   writer's native resume, the generation changed and the claim survived with
   a stale stamp. In this seat's fresh handover, the claim was released and
   re-claimed (t15/t18). The brief's procedure step 2 is conditional on the
   observed row state, so it holds for both. The brief does not describe the
   handover case. That is a scope limit, not a defect.
3. Atomicity of handoff-and-complete is source-grounded. No failure injection
   was run.
4. Installed source shows intended mechanisms. It does not prove which bytes
   the running daemon loaded.
5. Sender identity of coordinator messages is unauthenticated (`<unknown
   sender>` envelope) for both writer and reviewer releases.

## Non-blocking notes for a future revision

- Brief line 99 heads its table row "Retained resumed conversation". The
  qualified line 108-111 would read more consistently with "Retained
  conversation (writer-observed)".
- The section "Identity and context before interruption" (lines 61-63) reads
  as current state. It is correct under its heading.

## Next owner

The coordinator directed a bounded continuity addendum by the writer
(`qitem-20261017224200-304449ee`, `--no-nudge`), to be returned to this
reviewer. Per the 22:44Z coordinator instruction, the reviewer closes the
returned row `no-follow-on` after accepting the addendum. No new coordinator
queue row is created. Coordinator final acceptance remains the coordinator's
own act.

## Addendum review

Row: `qitem-20261017225006-9d4a1724` (from `qitem-20261017224200-304449ee`).
Claimed 22:50:14Z.

**ACCEPTED:** `artifacts/continuity-addendum.md` at SHA-256
`7b56658ce25abd6df1e2dc438d7325e4adf3ccabf9f80f9dfb70dc1c4773d0ba`. The
expected digest (row body) and the observed digest (`shasum -a 256`, 22:50Z)
are identical. The brief rehashed unchanged at
`a9fe0e563171f7ccaf9b226c7d98f88c6001138c232e2373b296dd7dc316c67a`.

Checks:
- **Case 1.** The transitions t2, t3, t5 and t7 are as cited. The
  coordinator-record citations (stop, relaunch, identity snapshot, generation
  change, and the surviving `052caac6...` stamp) match the JSON files. The
  source descriptions (`queue-repository.js:3085-3120`,
  `parked-owner-consumer.js:169-175`) match the installed bytes and are
  correctly limited. The addendum states that claim survival does not
  establish the same generation.
- **Case 2.** The transitions t12, t14, t15, t18 and t19, and the token
  change, match the queue and the reviewer artifacts. The t17 label is
  correctly discounted.
- **Case 3.** t27 records the claim at 22:48:30.858Z. Before that, the row
  was pending and unclaimed with null nudge fields; I observed this at 22:47Z.
  The writer's statement that no message named the row before its own queue
  read is self-report. It is labeled as direct observation and not overclaimed.
- **Links.** All relative links resolve to existing files and headings.

Limits:
- Lifecycle facts rest on coordinator operational records, not attestations.
- The writer's third-turn start is unexplained in the addendum, as it says. The
  return nudge envelope carried `gen 7e72ca7a`, which differs from
  `e921a09d`. That suggests a further writer generation, which I did not
  verify.

Closure: this row is closed `done/no-follow-on`, and no coordinator row was
created. Coordinator final acceptance of the pilot (brief `a9fe0e56...` plus
addendum `7b56658c...`) remains with the coordinator.

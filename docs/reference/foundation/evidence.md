# Foundation evidence

Run date: 2026-10-17. Times below are UTC for correlation with native records.
This is a sanitized coordinator report. Private raw CLI responses, native
transcripts, database state and backups stay outside the public repository.

## Participants and identity

| Role | Stable seat/node | Native conversation | OpenRig generation |
| --- | --- | --- | --- |
| Writer, initial | `study-writer@foundation`, node `01M55ZB93K82YKSH2X6CNZ75M9` | Codex `01a14bf5-ad30-7f82-a348-ff5d646feb23` | `052caac6-cfef-4d05-b35b-5e9f6479ab93` |
| Writer, resumed | Same seat/node | Same Codex conversation | `e921a09d-5e34-4a2e-b4db-2441f3407929` |
| Writer, cold recovery | Same seat/node | Codex `01a14c0c-f515-7942-879a-eaf43e316575` | `7e72ca7a-a0a5-4000-91a0-b84d140877a1` |
| Writer, explicit snapshot resume | Same seat/node | Same cold-recovery Codex conversation | `ef21e479-47ce-4171-8340-df4c8db42aa2` |
| Reviewer, initial | `study-reviewer@foundation`, node `01M55ZB72R558J4978YNP8CEP0` | Claude `7454260b-e164-4e36-9f3e-f8d1abd2a60a` | `ff3ff4af-2adb-4a15-ab4c-44ab8e54ce55` |
| Reviewer, fresh | Same seat/node | Claude `6ed278a2-6ce3-42dd-9783-e4818e7b95d9` | `0bb86a9e-620a-476f-8469-3dcfc75efb70` |

All belong to rig `01M55ZB72N2FY8BNAGSWQ1YYF6`, name `foundation`.
The OpenRig session record is yet another identity: the writer changed from
`01M55ZB94NF7J8SNBX68PGHV0Z` to `01M55ZMCQZ01FGXY5093BN2TM1` on native resume.
The reviewer changed from `01M55ZB74E0KAZWNH9Q7S4KDBH` to
`01M5600B45R4QZC7J2ZW2Q0DCH` on fresh replacement.
Cold writer recovery created session `01M560SV2K76B3MQWM6J49JKM0`;
explicit-snapshot resume created `01M560ZDB9K5X9YE0FDCZX3ESD`.

Native Codex `turn_context` records show `gpt-6.1-sol`, on-request approval,
workspace-write and network access. Native Claude assistant records in both
reviewer conversations show `claude-opus-5-5`. Model declarations alone were
not used as evidence of provider execution.

Two native Sol reconnaissance lanes supported setup and independent verification.
An external read-only Opus worker used the requested agent-worker bridge, run
`8bf6548a-6422-465a-83ed-58baef512870`, worker `opus-audit`, message
`6decd909-fccd-40f0-96a0-4c36868c026e`. It returned a successful source assessment;
its preserved provider accounting reports `claude-opus-5-5`, firstParty, with
provider-session scope and effort unverified. It was stopped after acceptance.
These helpers are supporting evidence. The live pilot below ran through OpenRig
seats, native providers, its queue, and its handoff mechanisms.

## Work trace

| Time | Work/transition | Observed outcome |
| --- | --- | --- |
| 22:24:33 | `foundation-pilot-20261017`, transition 1 | Coordinator creates pending writer obligation; durable row persisted |
| 22:24:34 | Initial wake | `delivered-ack-pending`; this did not prove claim or consumption |
| 22:24:42 | Transition 2 | Writer's native turn reads and claims the work; in-progress, provenance `transport:v1` |
| 22:25 | Writer checkpoint | Real draft and checkpoint artifacts exist; work intentionally unfinished |
| 22:26-22:27 | Stop and subset recovery | Work and artifact hashes persist; native Codex conversation resumes; reviewer remains live |
| 22:28 | Explicit checkpoint release | Resumed writer reads identity, owned queue, full body, transitions and artifacts; updates its evidence |
| 22:30:14 | Atomic handoff, transitions 8-9 | Writer row done/handed_off_to; successor `qitem-20261017223014-3f9dc7ae` pending for reviewer with predecessor chain |
| 22:31:22 | Reviewer transition 12 | Actual reviewer claims and checks the frozen artifact digest |
| 22:34:02 | Reviewer fresh replacement, transition 15 | Same seat, new native conversation; retiring occupant's claim released to pending |
| 22:34:06-22:34:33 | Fresh discovery | New conversation lists assigned work, follows durable artifact/checkpoint references and invokes hashing before coordinator's question |
| 22:35:45 | Transition 18 | Fresh reviewer reclaims work under its new generation |
| 22:36:02 | Content read | Native Read tool consumes the operating brief and supporting artifacts after explicit review release |
| 22:41-22:42 | Review and cold handoff, transitions 23-25 | Reviewer records accepted digest, closes review and creates `qitem-20261017224200-304449ee` for stopped writer with `--no-nudge`; pending/unclaimed, no nudge attempt |
| 22:47:42 | Correction, transition 26 | Reviewer records corrected lifecycle interpretation and authoritative revised handoff file; Q3 remains pending |
| 22:48:07 | Cold recovery, event 272 | Restore completes as fresh-primed after the CLI request times out; new native writer conversation |
| 22:48:12-22:48:30 | Discovery and claim, transition 27 | Writer's own startup queue read finds the task without a new message; reads correction and claims it |
| 22:50:06 | Addendum handoff, transitions 28-29 | Writer closes Q3 and creates final review `qitem-20261017225006-9d4a1724` with exact artifact digest |
| 22:50:14-22:50:47 | Review, transitions 30 and 32 | Reviewer claims, verifies and accepts the addendum, then closes done/no-follow-on |
| 22:51:13-22:51:22 | Explicit snapshot resume | Real Sol turn uses same native conversation, reports retained dialogue and reads empty owned queue |
| 22:52 | Coordinator acceptance and shutdown | Exact artifacts independently rehashed; both seats stopped with snapshot; daemon restarted from durable workspace |

The initial reviewed candidate is 13,665 bytes, SHA-256
`a9fe0e563171f7ccaf9b226c7d98f88c6001138c232e2373b296dd7dc316c67a`.
The reviewer accepted that exact frozen candidate, then corrected its initial
inference that claim survival implied the same OpenRig generation. The correction
used coordinator lifecycle receipts and SQLite identity records; it was appended
to the pending follow-on obligation before the writer resumed. The original
brief stayed byte-identical. The addendum was accepted at SHA-256
`7b56658ce25abd6df1e2dc438d7325e4adf3ccabf9f80f9dfb70dc1c4773d0ba`.
The final row's transition 32 binds both accepted artifacts and closes
`done/no-follow-on`. All four pilot rows are terminal, with no successor left
unowned. Coordinator acceptance is a separate authored record, not a new queue
obligation. See the [sanitized authored evidence](artifacts/README.md), including
review verdicts and original-versus-export hash manifest.

## Bounded experiments

| Experiment | Expected | Observed/recovery |
| --- | --- | --- |
| Interrupt unfinished writer work, then native resume | Stable seat/work/artifacts survive; actual native conversation identity is checked | Same node and Codex conversation, new OpenRig session/generation, same in-progress row and artifact hashes. A real continuation recovered the obligation and produced the review handoff |
| Fresh reviewer discovers existing answer | Normal startup leads to current owned work and relevant source without a new exact-file pointer | Startup queue discovery returned the prior handoff body; new conversation followed its artifact and checkpoint references. Claim release and re-claim were visible in transitions |
| Cold handoff to stopped writer | Ownership and next action survive without message delivery | Pending Q3 had no claim or nudge fields. A fresh native writer found it through its own queue read, consumed the recorded correction, claimed it, authored the addendum and handed it for accepted final review |
| Explicit pre-stop snapshot | Operator-selected active-seat snapshot preserves intended native conversation | Snapshot `01M560YRXKFDES2XHVR7GG9JAD` restored the same native writer ID; actual provider turn read empty owned work and reported retained dialogue; reviewer unaffected |
| Reconnect event collector | Events after saved cursor replay in order without duplicate sequence IDs | Global replay after seq36 returned 59 retained events, all greater than cursor and strictly increasing, including queue claims/updates missed while disconnected |

The first writer stop occurred after an intentionally unfinished checkpoint;
a watchdog wake was also active in the resumed conversation history. This proves
session interruption/recovery in the bounded pilot, not arbitrary mid-tool rollback,
host reboot, power-loss recovery or exactly-once external effects.

The whole-team `up --existing` attempt returned `rig_not_stopped` while the
reviewer lived. `launch foundation ...` returned `rig_not_found`; installed
`launch` requires the database rig ID. `launch <rigId> study.writer` then resumed
from auto-periodic snapshot `01M55ZHRNJ67M3RENMEKGDA2VJ`. No silent fresh fallback
was accepted. The launcher warned that it derived the session name after the
stop cleared its durable binding.

The second writer launch illustrates why automatic selection is insufficient
when native resume is required. Its earlier plan selected the 22:41 snapshot,
but execution selected newer `01M560PCFV61HA6G6YCBGKQS3B` from 22:46:04. Both
recorded the stopped writer's active occupant as absent and had no active-session
mapping, despite keeping historical resumable session rows. Installed
`restore-orchestrator.js:858` therefore resolves no active session and chooses
fresh-primed. Event 272 records that result. The CLI's five-second deadline
returned UNKNOWN; state inspection established completion, with no blind retry.

The resulting fresh conversation did useful recovery: native tool records prove
it found Q3 before any task announcement, followed transition 26's correction,
and completed the bounded addendum. A later explicit manual snapshot taken
while the writer was active produced a real native resume. These are distinct
observations. Automatic fallback was not counted as a second native resume.

Fresh reviewer launch warned that startup submission was unverified because
its composer boundary was not recognized. Subsequent native tool execution
proves consumption more strongly than that heuristic. The warning is preserved.

## What supplied context

- Native resume supplied the writer's prior conversation and the same native ID.
- Startup text supplied role, scope and navigation, not the answer.
- Queue body/history supplied obligations, ownership, predecessor links, hold
  conditions and artifact references.
- Workspace checkpoints supplied unfinished steps and earlier observations.
- Addressed context supplied installed guidance and the generic project intent.
  The initial generated `project:SPEC.md` was not a useful pilot-specific brief.
- Claude's native project memory contained only a note to use Read and simple
  commands to avoid permission prompts. It supplied neither answer path, hash,
  findings nor verdict. It is separate from OpenRig state.

Discovery is therefore observed reconstruction from durable work and files.
It is not proof of semantic search quality, automatic knowledge promotion, or
recovery without authored orientation. There is no separate verified content-ACK
field in this trace; actual native reads and responses establish consumption.
Claims, completion and reviewer acceptance remain separate records.

## Final state and checks

At 22:52:49Z, both seats were `exited`/`recoverable`, with zero assigned or pending
work; all four pilot rows were `done`. Team shutdown reported two sessions killed,
no errors, and snapshot `01M5611HZSFW4T2QKZ8MR5GTET`. The owned daemon was restarted
only after the seats stopped, from the durable workspace. PID 64332 used
`/opt/homebrew/Cellar/node@22/22.23.1/bin/node`, the installed package's daemon
entry, and loopback `127.0.0.1:18764`. The external CLI worker was already stopped.

Local qualification: installed ABI check, team launch plan and real two-provider
launch, actual four-obligation pilot, bounded lifecycle/replay experiments,
independent digest/native-turn/queue verification, configuration-copy equality,
documentation placement guard, link/export-integrity checks and whitespace check.
Source changes are documentation and reusable YAML only; no implementation test
was added. Full build, typecheck and repository/package/scenario suites belong
to the pull-request workflow and are not represented as local checks here.
At delivery, the personal fork had no rulesets or registered Actions workflows,
despite containing `.github/workflows/tests.yml` and reporting Actions enabled.
The ready PR scheduled no checks. `gh workflow enable tests.yml` returned 404.
This is an unresolved fork delivery limitation, not a green CI result. Auto-merge
was disabled; no admin bypass or unverified merge was used.

## Limits relevant to operation

- Native permission prompts remain part of ordinary team operation. A message
  sent while a prompt owned input was refused with `target_needs_input`, without
  delivering text. The coordinator inspected and approved only bounded actions.
- Old activity/context samples can remain visible during lifecycle changes;
  live `sessionStatus`, generation and native transcript evidence must be read
  together. Writer telemetry temporarily reported `stale_generation` after resume.
- The original writer claim retained its old generation stamp across native
  resume. The fresh reviewer replacement explicitly released its claim. These
  are different lifecycle paths, not interchangeable claim semantics.
- Rig-filtered SSE omits queue events lacking rig ID. Global replay plus current
  state reconciliation is required for the proposed work projection.
- `whoami.edges` was empty despite a declared intra-pod collaboration edge.
  This observation did not block work and is not a claim that all edge behavior
  is absent. No core repair was attempted.
- Physical desktop rendering, host reboot, cross-host operation, retention-gap
  recovery and production multi-user authorization were not tested.

## Reinspect locally

Use the command and state locations in [operations](operations.md). The raw
evidence directory contains `setup-plan.json`, `setup-result.json`,
`team-plan.json`, `team-up.json`, initial/fresh provider identity records,
`writer-relaunch-1.json`, `reviewer-fresh-launch.json`, SSE captures,
`opus-assessment-receipt.json`, and `latest-evidence.json`. Native provider
transcripts remain in their original provider homes. These are private operational
records, not tamper-resistant attestations.

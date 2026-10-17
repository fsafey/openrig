# Preliminary connector outline

This is a proposal informed by the installed 0.6.10 runtime. No Atlas or
connector code was changed. Atlas would own spatial presentation and interaction;
OpenRig would own execution, seats, work and coordination; files would hold
authored knowledge and decisions. A connector would bind references explicitly.

## Identity and authority

Use instance identity plus stable rig, node/seat, work and artifact identities.
Show native session ID and OpenRig occupant generation separately from the seat.
The pilot's same-seat native resume changed the OpenRig generation while retaining
its Codex conversation. A session name alone is insufficient provenance.
Display assignment, claimed state, claimant generation and current occupant
generation separately. Native resume retained an older claim stamp; fresh
replacement released it. A retained claim does not establish occupant continuity.

Read ownership and transitions from OpenRig's durable queue. Read decisions from
their attributed artifacts, preserving revision/hash and evidence class. A map's
position or relationship label would describe presentation; it would not grant
permission, create execution, or reverse external work. These are proposed
connector rules, not implemented Atlas guarantees.

## Interfaces verified against the installed package

| Interface | Evidence and use |
| --- | --- |
| HTTP `/api/ps` and seat/queue routes | CLI runtime observations read the live inventory projection, queue items and transitions; installed routes define the broader coordination surface |
| HTTP `/api/events` | Observed persisted SSE events and bounded reconnection with `Last-Event-ID`; numeric seq is the replay cursor |
| Addressed context through `rig context` | Both provider seats used list/work-install and addressed reads; queue bodies and workspace files carried task-specific context |
| MCP | Installed `dist/mcp-server.js` registers 18 tools for lifecycle, discovery, nodes, messaging, capture and chatroom; it has no queue, addressed-context, whoami, seat recovery or durable-event tool |

MCP registration was inspected in installed source; a real MCP client exchange
was not needed for this pilot and is not claimed. HTTP exposes more coordination
capability than this MCP adapter. Local HTTP access is for a trusted environment;
the pilot is not evidence of multi-user authorization or secure public exposure.

## Events and reconnection

**Use the global stream for work projection.** Observed `queue.created`,
`queue.claimed` and `queue.updated` events have NULL `rig_id`. A stream filtered by
`?rigId=...` omitted those events even though they were persisted. Seat activity
events can also lack rig ID. Filtering early would hide owned-work changes.

Proposed consumer behavior:

1. Persist complete global events under `(instance, seq)` before advancing a
   durable cursor, including events later excluded from a particular view.
2. Resolve work IDs through authoritative queue records and seat inventory.
   Resolve seat-node events through that inventory. Keep unresolved scope visible.
3. Treat events as invalidations and refresh current projections. Preserve
   historical owner transitions separately from current ownership.
4. Reconnect using `Last-Event-ID`, deduplicate by seq, and reconcile current
   inventory and queue state. Subscribe and buffer before taking initial reads.

Installed source subscribes before querying replay and deduplicates overlap.
No retention-gap signal was found in that SSE path. The bounded replay experiment
does not prove behavior after database loss, retention expiry or host reboot.

## Communication, work and relationships

Message delivery, agent acknowledgment, queue assignment, claim, completion and
reviewer acceptance are separate facts. `send --verify` checks pane rendering.
The pilot initially received `delivered-ack-pending`, followed by an actual claim;
that strengthened the presentation without rewriting the wire result. An atomic
queue handoff creates a successor obligation; its closure is not review acceptance.

The reviewed artifact needs an attributed verdict tied to its exact content hash.
Queue links alone do not validate artifact existence or quality. Preserve source,
rationale, uncertainty, native history references and context-reconstruction steps.

Topology edges are descriptive coordination relationships, not access controls.
Installed transport routes resolve identities and send without checking edges;
the source reference explicitly distinguishes these semantics. Some edge kinds
also influence launch or escalation behavior, which must be read by kind rather
than inferred from a drawn line.
Keep declared and observed relationships distinct: this pilot's `whoami.edges`
was empty despite its intra-pod YAML edge. Reconcile persisted topology before
drawing that declared edge as observed runtime state.

## Next experiment

A small read-only Atlas projection is the recommended next test after an explicit
owner decision: display the two seats, current native
sessions, owned-work chain, reviewed artifact and explicit next action. Test
whether a person can identify owner, evidence and recovery state. Keep any
Assign, Handoff, Resume or permission-changing action out of that first projection.
Implementation remains a later owner decision.

Known upstream limitations checked on 2026-10-17:
[full default event replay, #1386](https://github.com/mvschwarz/openrig/issues/1386)
and [seat-launch preview, #889](https://github.com/mvschwarz/openrig/issues/889)
were open. [Edge-only upsert, #1193](https://github.com/mvschwarz/openrig/issues/1193)
concerns a different edge-loss path. Their proposed remedies are not installed
features. Bounded issue searches found no direct match for the pilot's NULL
queue-event rig IDs, retained claim stamp, or initial empty identity edges.

Source anchors relative to the installed package: `dist/mcp-server.js:41`,
`daemon/dist/routes/events.js:7`, `daemon/dist/domain/event-bus.js:44`,
`daemon/dist/domain/event-bus.js:153`,
`daemon/dist/domain/queue-repository.js:1186`, `:1362`, `:1699`, `:2190`,
and `daemon/dist/routes/transport.js:70`.

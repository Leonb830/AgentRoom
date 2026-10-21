# Cloudroom — Reverse Engineering and Product Development Plan

**Prepared:** 21 October 2026 · Europe/Berlin  
**Research baseline:** Public changelog through v113; pinned public core and GUI source; static inspection of the delivered changelog website.  
**Deliverable:** A buildable development plan for a focused product based on Cloudroom’s capabilities.

## Executive decision

Build a **single-owner web workspace for reliable remote coding tasks**, using the existing Cloudroom Core behind a small application backend. The first release should let its owner start a repository task, leave the browser, return to preserved history, and inspect a concrete code change.

Use the existing runtime to manage native coding agents. Build the narrower product experience around it: projects, threads, execution state, reviewable output, diagnostics, and operations. Begin with one Linux machine and one harness. The reference implementation uses a TypeScript web interface and gateway, with the Rust core as a separately supervised service.

The initial product is a **private alpha for one trusted owner**. A public service for unrelated users needs a separate isolation, provisioning, and account-management project. Branches and worktrees separate changes; they do not create a security boundary between users.

**Reference effort:** 420–600 productive engineering hours; a 480-hour baseline gives 16 weeks at 30 hours/week. This is a planning estimate conditional on the runtime compatibility spike, not a promise of delivery or an estimate of Cloudroom’s original development effort.

**Product promise:** “Give a remote coding agent a task, disconnect, and return to a result you can inspect and accept.”

---

## 1. Scope, method, and evidence

### 1.1 Interpretation of the request

This plan covers the Cloudroom product described by the changelog. It also documents the changelog page itself. Rebuilding only that page would reproduce a release feed, while the product’s main value depends on execution, history, recovery, and code review.

The investigation used the requested **reverse-engineer-anything** skill from morluto/rea. The skill directs ordinary source-repository questions to repository tools and reserves REA analysis for shipped artifacts or runtime evidence. Accordingly, public source was inspected through GitHub, and the delivered website assets were inspected statically with REA.

### 1.2 Evidence classes

| Label | Meaning | What it establishes |
| --- | --- | --- |
| Observed artifact | Directly inspected HTML, assets, or source at a recorded revision | What those bytes contain |
| Published behavior | Official documentation or release notes | What the publisher says the product does |
| Inference | A conclusion drawn from several observations | A likely explanation, with its limits retained |
| Proposal | A decision in this development plan | What the new product should do |
| Unknown | Evidence was unavailable or insufficient | A question that remains open |

Static analysis does not establish that a feature works in a running product. The authenticated Cloudroom application was not exercised, and no managed infrastructure, user account, or production deployment was accessed.

### 1.3 Research inventory

| Item | Recorded result |
| --- | --- |
| Changelog | 59 visible entries, from v34 through v113; version numbers are not contiguous |
| Public release date range | 22 September–20 October 2026 as displayed in PDT on the page |
| Latest entry | v113, “Git diff panel for Cloud threads” |
| Public core snapshot | 7d25d300f8ca564beb16541118f13daf89512a14 |
| Public GUI snapshot | 90f4438174d354abec2ec0fdf4cc424893ebdb77 |
| REA CLI used | rea-agents 6.7.0 |
| REA skill read | Repository skill metadata version 44 |
| Downloaded website scope | Changelog HTML; its ten directly referenced JavaScript files and two linked CSS files |
| REA application input | The downloaded website tree, with preserved relative asset paths |
| Analysis mode | Static; the downloaded application code was not executed |

The pinned source snapshots are research snapshots. They are not asserted to be the exact source underlying every binary or managed service mentioned in v113. Source-main documentation can also describe capabilities ahead of a released tool; commands were checked against the installed REA CLI.

### 1.4 REA evidence and limitations

**Evidence ID:**  
ev_2536746672dd61462c1d26438d850eac17af68cdceb4db7ed0fdfab9cd4f8a06

**Analyzed directory SHA-256:**  
af1e8de6ff4935d877a84375561f360a5acce1aa1587d474a9ee7e6f0b280c4c

REA reported:

- 11 relevant files and 793,870 text bytes read.
- Nine JavaScript files parsed; one JavaScript file skipped after a worker heap limit.
- No parse failures among the processed files.
- Four inline script bodies in the HTML were outside the analyzer’s coverage.
- Incomplete graph coverage; dynamic expressions and bundle relationships remain unresolved.

The shipped HTML and script names contain Next.js/Turbopack markers. That supports identifying the **public web surface** as Next.js-related. It does not identify the desktop application as Next.js, reveal the managed backend’s database, or prove authenticated behavior.

No further expansion into framework-runtime internals was required to answer the product-planning questions. The skipped bundle and unexamined inline bodies remain explicit limitations.

### 1.5 Investigation questions and status

| Question | Status | Evidence / remaining limit |
| --- | --- | --- |
| What product capabilities are advertised? | Answered from public material | Changelog, docs, releases |
| What is the public application’s technical stack? | Answered at inspected source revisions | Manifests and runtime documentation |
| What does the public website ship? | Partially answered | HTML and bounded static asset analysis |
| How are execution, history, and recovery represented? | Answered at source/documentation level | Core API and lifecycle docs |
| Does every claimed feature work in production? | Unresolved | No authenticated runtime evaluation |
| What operates Cloudroom’s managed fleet? | Unresolved | Vendor, scheduler, tenancy database, capacity and costs not established |
| What should a smaller product build first? | Proposed | Priorities and milestones below |

Sources: [R1], [R2], [C1], [C2], [C3], [C4].

---

## 2. What the product does

### 2.1 Product model

Cloudroom coordinates existing coding agents. A **harness** is the program that runs the agent’s reasoning-and-tool loop, such as Codex or Claude Code. Cloudroom supplies the surrounding lifecycle: starting work, accepting follow-ups, saving history, reconnecting, and coordinating execution environments. [D1]

The useful unit is a **thread**: a durable conversation tied to work. A thread can contain several user requests over time. Each request can succeed, fail, be interrupted, or become uncertain independently of the thread.

This implies three distinct concerns in a reconstruction:

1. The user interface presents tasks, progress, history, and review.
2. The execution runtime supervises native agent processes and their durable commands.
3. The workspace holds repository files and the resulting changes.

### 2.2 Capability map

| Area | Evidence-backed capability | Development implication |
| --- | --- | --- |
| Projects and threads | Persistent work organized around projects and conversations | Stable product IDs and recoverable history |
| Harnesses | Multiple installed agents using the owner’s model accounts | One adapter first; explicit capability detection |
| Local work | Repository/worktree execution and review surfaces | Filesystem and process integration are substantial scope |
| Remote work | Agents run in cloud execution environments independently of the desktop | Client connectivity cannot own execution lifetime |
| Queues | Follow-ups, interruption, and queue control | Distinct command, queue, and process states |
| Git review | Cloud Git information and diff added in v113 | Review is part of the usable task workflow |
| Forks and handoff | Branch conversations and move work across environments | Provenance and recoverable transfer need explicit models |
| Delegation | Parent and child threads with completion reporting | Child completion and code integration are separate |
| Loops | Scheduled and webhook-triggered work | Definitions must outlive individual execution chats |
| Side chats | Fresh context, selected quotes, and shared files | Conversation isolation does not imply file isolation |
| Remote access | Mobile/browser access and machine selection | Clients should share the same control interface |
| Usage and lifecycle | Runtime allowance, idle behavior, and cleanup | Resource measurement must agree with visible state |

Sources: [D1]–[D7], [R3]–[R8].

### 2.3 What the release history reveals

The release history repeatedly returns to connection failures, expired credentials, queued messages, duplicate child starts, interrupted transfers, background jobs, and resource usage.

**Inference:** The differentiating engineering work is dependable coordination across these boundaries. A large list of supported agents does not compensate for losing task state or falsely reporting completion.

Three examples shape this plan:

- v104 reports fixes for stuck cloud messages and duplicate subagent starts. The corresponding product requirement is explicit command identity and observable recovery. [R5]
- v112 reports recovery after provider limits, better connection diagnostics, and preventing an idle browser from keeping a cloud environment awake. The corresponding requirement is a lifecycle based on actual work. [R4]
- v113 adds cloud review capabilities and aligns usage units. The corresponding requirement is a consistent path from execution to review, with understandable resource reporting. [R3]

---

## 3. Verified architecture and source conflicts

### 3.1 Public implementation

| Layer | Inspected implementation | Evidence |
| --- | --- | --- |
| Desktop shell | Electron; desktop packaging and updates | GUI desktop package |
| Application interface | React, TypeScript, Vite, Tailwind; client state and virtualized lists | GUI application package |
| Local application server | Node.js and Hono; WebSockets and authentication dependencies | GUI server package |
| Desktop persistence | SQLite through better-sqlite3 and Drizzle | GUI database package |
| Execution core | Rust; Axum, Tokio, HTTP client and compression dependencies | Core Cargo.toml |
| Agent execution | Native harness adapters; the harness keeps its own model/tool loop | Core harness documentation |
| Standalone history | Local journal mode without a database | Core setup and lifecycle docs |
| Managed history path | Local recording with an external history service and object-storage uploads | Core setup/history implementation |
| Public website | Next.js/Turbopack markers in delivered assets | Captured changelog HTML and scripts |

Sources: [C3]–[C10], [D1].

The public core and GUI declare Apache-2.0 licensing. The GUI also retains a notice for its BB origin. Record upstream revisions and preserve applicable notices when reusing code. The plan recommends original naming and presentation for a distinct product. [C1], [C2], [C11]

### 3.2 Important uncertainty boundaries

The public repositories do not, by themselves, establish the managed service’s exact:

- infrastructure vendor or isolation mechanism;
- tenant allocator, fleet scheduler, or autoscaling strategy;
- operational service levels or production failure rates;
- internal database schema or commercial margin;
- deployed configuration at the time of every changelog entry.

An optional integration with a sandbox provider is not proof that Cloudroom’s hosted service uses that provider.

### 3.3 Documentation conflicts and their resolution

| Topic | Conflicting material | Resolution used in this plan |
| --- | --- | --- |
| Cloud Git diff | Cloud-thread docs describe Local-only review; v113 adds Cloud diff | Use the newer release claim for product scope |
| Child isolation | Some pages describe shared sandboxes; newer subagent material describes dedicated ones by default | Model shared and separate execution explicitly; do not assume one policy everywhere |
| Side chats | Some descriptions say copied conversation; current body text and v112 describe fresh context | Treat context policy as a capability; choose fresh context for any later implementation |
| Self-hosted storage | Homepage mentions PostgreSQL; current core setup supports local history without a database | Separate standalone core storage from managed-service architecture |
| Prompt size | API prose still mentions 32 KiB; inspected source and v111 describe 256 KiB | Discover versioned capabilities; do not hard-code stale documentation |
| Stop behavior | User-facing docs describe stopping plus a paused queue; core interrupt alone allows queued work to continue | Implement the user operation through explicit queue pause and interruption |
| Harness coverage | Counts and individual support claims differ between pages and releases | Use capability negotiation instead of a fixed universal support list |
| Public access | Invite/waitlist text and open-start marketing coexist | Do not rely on hosted-service access for the first product |

Sources: [D1]–[D6], [R3], [R4], [R9], [C4], [C5], [C12].

The first implementation spike must test against a pinned runtime. It must not silently resolve these differences by assuming that similarly named operations have identical semantics.

---

## 4. Product requirements

Everything from this section onward is a **proposal**, except where explicitly attributed.

### 4.1 Initial user and problem

**Initial user:** A developer who already uses a coding agent and wants repository work to continue on a remote Linux machine.

**Problem:** An ordinary terminal session and a stream of chat text make it difficult to tell what was accepted, what is still running, what survived a disconnect, and which code changes are ready to review.

**Job to be done:** “When I delegate a bounded development task, keep the work and its evidence available so I can return later, understand what happened, and decide whether to accept the change.”

**Initial differentiation hypothesis:** A smaller interface focused on durable execution and explicit review could serve developers who find a broad agent workspace difficult to operate. This is a hypothesis to validate with pilot use, not an established market gap.

### 4.2 Product outcomes

A successful alpha enables its owner to:

1. Select a configured repository and execution environment.
2. Submit a bounded coding task with an explicit branch baseline.
3. See whether the task was accepted, is running, is blocked, or has ended.
4. Leave and reconnect without creating duplicate work.
5. Review an exact diff, test output, and final explanation.
6. Export or publish the result through an explicit action.
7. Recover historical results after an ordinary service restart or a tested backup restore.

### 4.3 First-release boundary

| Included in private alpha | Deferred to a later release |
| --- | --- |
| One trusted owner | Public multi-user hosting and organizations |
| One Linux host | Fleet scheduling, autoscaling and warm pools |
| One harness: Codex initially | Broad harness and account-rotation parity |
| One repository initially, with explicit task workspaces | Arbitrary repository discovery and complex project templates |
| Thread history and native events through a gateway | Full desktop application and local computer control |
| Start, queue, stop, resume and explicit recovery states | Transparent Local↔Cloud Teleport |
| Exact changed-file and diff inspection | Automatic merge or autonomous deployment |
| Test-result evidence and artifact/patch export | Recursive subagents and automatic integration |
| Basic resource visibility and conservative cleanup | Loops, webhooks and commercial billing |
| Browser interface with essential responsive layout | Native phone applications, plugin marketplace and computer use |

GitHub PR creation may be added after the branch-and-patch workflow works; it is not required to prove the first complete task loop.

### 4.4 Core functional requirements

| ID | Requirement | Acceptance criterion |
| --- | --- | --- |
| FR-01 | Owner access | Anonymous requests cannot list projects, read history, issue commands or retrieve artifacts |
| FR-02 | Runtime readiness | UI distinguishes unavailable host, unconfigured harness, authentication failure and ready state where the runtime provides evidence |
| FR-03 | Project registration | Configured repository root and baseline are validated before a task is admitted |
| FR-04 | Stable task submission | Retry with the same command identity returns the same result identity; changed content under that identity is rejected |
| FR-05 | Durable timeline | After reconnect, the owner sees retained events in order without duplicate visible entries |
| FR-06 | Honest status | Acceptance is never rendered as completion; uncertain execution is never rendered as failure-free success |
| FR-07 | Queue control | Follow-ups run in order; Stop visibly pauses the queue and interrupts the active request |
| FR-08 | Recovery | Crashed or lost work gets a documented next action; uncertain work is not automatically reissued |
| FR-09 | Reviewable changes | Changed paths and diff are tied to the exact task workspace and recorded base revision |
| FR-10 | Test evidence | A trusted test operation records command, exit status, time and the exact tested workspace snapshot; later edits mark that evidence stale |
| FR-11 | Result export | Owner can export a patch or branch reference without merging it |
| FR-12 | Cleanup and retention | Cleanup preserves unreviewed changes and retained result evidence |
| FR-13 | Credential boundaries | Core and Git credentials stay in server/runner-owned storage, outside browser payloads and ordinary logs |
| FR-14 | Version compatibility | Startup records core/harness versions and exposes unavailable capabilities instead of pretending they exist |

---

## 5. User experience specification

### 5.1 Navigation

Use four primary areas:

- **Projects:** Repository, configured runner, recent tasks and pending review.
- **Threads:** Task conversation, event timeline, request queue and execution controls.
- **Review:** Exact changes, test results, artifacts and export/publish actions.
- **Settings:** Runner connection, harness readiness, limits, retention and diagnostics.

The desktop layout can use a project/thread sidebar, a central timeline and a collapsible review panel. On narrow screens, those areas become separate views. The execution state should remain visible in either layout.

### 5.2 The primary flow

1. The owner selects a project.
2. The application records a task title, baseline revision, harness and request.
3. The backend creates or selects a validated task workspace.
4. It persists the submission identity before calling the core.
5. The UI shows Accepted only after a durable receipt exists.
6. Native progress events update the timeline.
7. Closing the browser ends the subscription, while accepted work continues.
8. Reopening resumes from the last persisted event cursor.
9. A finished run exposes changed files, tests and artifacts.
10. The owner accepts, requests changes, exports, or archives the result.

“Task finished” and “code accepted” are separate states. An agent can finish its turn with an incorrect or incomplete implementation.

### 5.3 Status language

| Visible state | User meaning | Allowed next action |
| --- | --- | --- |
| Draft | Request has not been durably accepted | Edit or send |
| Accepted | Runtime recorded the request | Observe or cancel if still queued |
| Starting | Agent process or native session is initializing | Observe; cancel where supported |
| Running | The current request is executing | Send follow-up or Stop |
| Waiting | Work is paused for a known dependency, limit or credential | Resolve cause; explicitly resume where required |
| Interrupted | The active request was stopped | Inspect partial results; resume queued work separately |
| Failed | A known failure ended this request | Inspect cause; issue an intentional retry/new request |
| Outcome unknown | The system cannot establish the effect of interrupted work | Inspect files and external effects before retrying |
| Finished | The runtime ended the request | Review changes and test evidence |
| Accepted by owner | Human review approved the result | Publish or archive |

Avoid an endlessly animated “thinking” state for an unavailable worker. A stale connection should show the last known state plus a connection warning, not convert the last state into a new factual claim.

### 5.4 Essential interface details

Preserve a draft when login fails. Keep large output collapsible and virtualize the timeline. Render Markdown and tool output as untrusted content. Show branch and runner near the task title. Make queued requests separately editable only when supported. Treat archive as a history action with explicit consequences for active work.

Side chats, provider comparison, mobile pairing and decorative animations remain outside the alpha’s critical path.

---

## 6. Recommended implementation architecture

### 6.1 Build-versus-reuse decision

| Option | Good fit | Main cost | Decision |
| --- | --- | --- | --- |
| Run upstream core and GUI unchanged | Use Cloudroom’s existing experience | Limited original product development | Useful reference environment |
| Fork the entire GUI and core | Deeply customize the existing desktop product | Broad Electron, IPC, plugin and compatibility surface | Defer |
| Build a narrow web product around the core | Controlled scope and direct ownership of the user workflow | Gateway, UI, auth, review service and operations | **Choose for the alpha** |
| Rebuild the entire runtime | A demonstrated incompatible requirement | Reimplementing durability, native resume and process supervision | Reject unless the compatibility gate proves necessary |

A small adapter or focused upstream-compatible fix is preferable to a second runtime. Pin the core and harness versions that pass the compatibility tests.

### 6.2 Component architecture

~~~mermaid
flowchart TD
    Browser["Browser workspace"] --> Gateway["Authenticated application gateway"]
    Gateway --> Metadata[("Product metadata")]
    Gateway --> Core["Cloudroom Core adapter"]
    Gateway --> Review["Workspace and review service"]
    Core --> Harness["Native coding harness"]
    Core --> Journal[("Durable runtime journal")]
    Harness --> Workspace["Task workspace"]
    Review --> Workspace
    Harness --> Provider["Model provider"]
    Journal --> Backup["Off-host backup"]
    Metadata --> Backup
    Workspace --> Backup
~~~

The diagram is a proposed deployment design. It is not a claim about Cloudroom’s private infrastructure.

### 6.3 Technology choices

| Component | Proposed choice | Reason |
| --- | --- | --- |
| Interface | React, TypeScript and Vite | Small web surface; suitable for a streamed task interface |
| UI state | Query cache for server state; separate local composer state | Avoid treating transient drafts as durable task state |
| Gateway | Node.js, Hono and schema validation | Narrow typed interface around the existing core |
| Owner authentication | Established authentication library; server-side sessions | Avoid inventing login/session security |
| Product metadata | SQLite and Drizzle on the gateway host | Adequate for a single-owner service; minimal operations |
| Execution | Pinned Cloudroom Core on Linux | Reuse native process and history coordination |
| Initial harness | One tested Codex installation | Reduce the first compatibility matrix |
| Transport | HTTP commands and Server-Sent Events | Commands and a one-way event feed have different responsibilities |
| Git/workspace operations | Typed service using Git argument arrays and validated paths | Produce exact review evidence without trusting agent summaries |
| Deployment | Long-running services under systemd behind TLS | Streaming and agents should outlive HTTP requests |
| Backup | Off-host backup of metadata, runtime history and required workspaces | These are separate kinds of data |
| Observability | Structured logs, health/readiness and simple counters | Diagnose failure before adding a complex telemetry platform |

Kubernetes, Redis, a service mesh and multiple databases are unnecessary for this first topology. Introduce a scheduler or distributed queue only when the execution fleet and measured workload require one.

### 6.4 Trust boundaries

The browser authenticates to the gateway. The gateway retains the core token and connects to the core on a private interface. Agents operate under the intended unprivileged execution account. The agent account must not receive the gateway’s session secrets, core token, unrestricted host administration, or a host Docker socket.

For this alpha, task workspaces share a trusted owner’s machine and agent account. A worktree reduces accidental change conflicts, but it does not stop one agent from reading that account’s other files. The product must not describe this topology as safe hosting for unrelated customers.

### 6.5 What must be implemented outside the core

The compatibility spike must verify what is available, rather than inventing convenient endpoints.

Expected product-owned responsibilities include:

- owner authentication and browser sessions;
- project/thread metadata and mapping to runtime session IDs;
- stable request identity and gateway-to-runtime reconciliation;
- normalized display events with native payloads retained where useful;
- task workspace preparation and branch baseline recording;
- exact diff, test-output and artifact presentation;
- configuration, diagnostics, release packaging and backup procedures.

The inspected core exposes workspace metadata, but this plan does not assume that it supplies a ready-made Git diff HTTP endpoint. The workspace/review service is explicit scope.

---

## 7. Data and execution contracts

### 7.1 Source of truth

The **core journal owns execution receipts, native session state and runtime events**. The application database owns product metadata and user decisions.

Do not create two independent prompt dispatchers or competing histories. An event cache in the gateway is a projection that can be rebuilt; it is not a second authority over whether a command ran.

### 7.2 Proposed entities

| Entity | Important fields | Authority |
| --- | --- | --- |
| Owner | ID, identity binding, session policy | Application |
| Runner | ID, endpoint reference, core version, capability snapshot, health | Application plus runtime observations |
| Project | ID, repository reference, allowed root, baseline policy | Application |
| Workspace | ID, project, path mapping, branch, base commit, retention status | Workspace service |
| Thread | ID, project, title, archive state, optional parent/source thread | Application |
| Execution binding | Thread, runner, native session ID, harness, protocol version | Application mapping to core |
| Command reference | Product command ID, core request ID, payload hash, receipt reference | Application reference; core execution authority |
| Event cursor | Session ID, last recorded sequence, cache version | Application projection |
| Review artifact | Workspace, base/head revisions, exact content snapshot, patch/test/artifact hashes, timestamps | Review service |
| Review decision | Owner, artifact revision, accepted/changes requested | Application |
| Usage sample | Runner, time interval, resource/workload measurements | Metering collector |

Later, add AutomationDefinition and AutomationRun separately from Thread. Archiving a run’s chat must not implicitly disable its schedule.

### 7.3 API boundary

Use a small product API with ownership checks, input validation and consistent errors. Internally, the adapter maps to verified core operations:

| Core operation | Product use |
| --- | --- |
| GET /v1/ready | Runtime readiness |
| GET /v1/capabilities | Harness, model and optional-operation discovery |
| POST /v1/sessions | Create a native session |
| POST /v1/sessions/{id}/prompts | Submit a request or queued follow-up |
| GET /v1/sessions/{id}/requests/{request_id} | Reconcile a specific command |
| GET /v1/sessions/{id}/events?after=N | Replay retained events |
| GET /v1/sessions/{id}/stream?after=N | Follow live records |
| POST /v1/sessions/{id}/stop | Pause the queue |
| POST /v1/sessions/{id}/interrupt | Interrupt the current request |
| POST /v1/sessions/{id}/resume | Resume according to the pinned runtime contract |
| GET /v1/sessions/{id}/recovery | Inspect native-history recovery readiness |
| GET /v1/sessions/{id}/workspace | Read workspace/branch/head metadata |

These paths come from the inspected API documentation. The implementation must validate supported semantics against the pinned executable, including any documentation drift. [C12]

### 7.4 Command identity and recovery

Generate the core request ID once per user action and persist it with a payload hash. If a network timeout makes acceptance uncertain, retry or query using that same ID. A deliberate new action uses a new ID.

Submission idempotency means that retrying acceptance does not create another accepted command. It does **not** prove exactly-once effects for a shell command or an external API called by an agent.

If the core reports uncertain dispatched work after a crash, preserve that state. The owner should inspect repository changes and external effects before issuing a new request.

### 7.5 Replay

Cache or render records by the pair of native session ID and sequence. Save the latest cursor after processing records. Resume through the documented cursor and tolerate duplicates from transport retries.

Sequences need not be contiguous within one session. A jump in numeric sequence alone is not proof of missing data. Use the runtime’s replay contract and explicit failure signals.

### 7.6 Stop is a compound user operation

A user-facing Stop must:

1. Request and confirm queue pause.
2. Inspect the current active request.
3. Request interruption of that request when necessary.
4. Reconcile the pause and interrupt receipts.
5. Display partial or uncertain outcomes honestly.

If the current request changes during a race, reconcile again instead of assuming the first interrupt stopped all work. Do not resume queued prompts merely because the interrupted process exited.

This requirement follows from the difference between core interrupt and queue-control semantics. [C4], [C12]

---

## 8. Git review and result integrity

### 8.1 Workspace policy

For the first proof, run one task at a time in an explicitly configured repository. Before the alpha pilot, create a separate branch and validated workspace for each task that can modify files.

Record the base revision before work starts. Keep the user’s original working checkout intact. The gateway’s repository paths must come from configured project/workspace identities, not arbitrary browser-supplied filesystem paths.

No automatic cleanup may discard unreviewed changes.

### 8.2 Review package

Every result should contain:

- task and request identity;
- base commit and current head, or an explicit uncommitted-work state;
- exact changed-file list and diff;
- test commands with exit status, timestamps and the exact tested content snapshot;
- artifact links where applicable;
- agent explanation;
- execution outcome and remaining uncertainties.

A successful agent turn does not mean tests passed. A passing test does not mean the owner accepted the implementation.

Git HEAD alone does not identify uncommitted changes or relevant untracked files. A trusted review/test operation must freeze or copy the exact input workspace, record a tree or content-manifest digest, and capture the test process's exit status against that snapshot. If files change afterward, the previous passing-test evidence becomes stale. Review, export and publication must refer to the same recorded snapshot. Agent-generated prose or a mutable log file cannot serve as the authority for a passing result.

### 8.3 Export and publication

The initial completion path is patch export or an existing branch reference. An explicit GitHub publishing action can later create a branch and PR through a scoped integration. It should publish the reviewed snapshot, record the resulting URL, and use an idempotent operation identity.

No automatic merge is required for the product’s first value proposition.

---

## 9. Implementation roadmap

### 9.1 Estimate assumptions

The baseline assumes one developer, approximately 30 productive engineering hours per week, an available Linux development machine, a usable harness account, and a core version that passes the first spike.

Learning time, approval delays, significant upstream bugs or a change to a multi-tenant product can push the effort beyond the 420–600-hour range.

| Time available | Calendar time for the 480-hour baseline |
| --- | ---: |
| 30 hours/week | 16 weeks |
| 20 hours/week | 24 weeks |
| 15 hours/week | 32 weeks |
| 10 hours/week | 48 weeks |

### 9.2 Milestones and release gates

| Phase | Reference weeks | Work | Exit gate |
| --- | --- | --- | --- |
| M0 — Runtime feasibility | 1–2 | Pin core/harness; start, observe, stop, reconnect and recover a task through a small client | Essential operations work without the Electron GUI; gaps and trust boundary documented |
| M1 — Browser vertical slice | 3–4 | Owner login, gateway, project settings, threads, composer and event timeline | Owner submits a real task and receives its result; privileged tokens never reach the browser |
| M2 — Durable interaction | 5–7 | Request identity, replay, queue controls, failure classification, interrupted/unknown handling | Disconnect and retry scenarios preserve identity and truthful state |
| M3 — Reviewable output | 8–9 | Task workspaces, baseline, diffs, tests, artifact/patch export | One real code change can be reviewed against the correct base revision |
| M4 — Operations | 10–11 | Service supervision, limits, metrics, backups, cleanup, update and rollback | Restore demonstration recovers history and required result artifacts |
| M5 — Failure and usability | 12–13 | Credential expiry, disk pressure, worker loss, large output and secure content rendering | Defined failure matrix passes; UI remains usable during long work |
| M6 — Private pilot | 14–16 | Real tasks, triage, onboarding, operator notes and release freeze | Repeated end-to-end use; no unresolved duplicate-dispatch or history-loss defect |

**Critical path:** Runtime contract → authenticated gateway → durable interaction → exact review output → recovery and operations → pilot.

If the M0 gate fails, implement the smallest adapter or upstream-compatible fix that resolves the gap. Re-estimate before expanding UI scope. Do not automatically respond by rewriting the full runtime.

### 9.3 First ten working days

| Day | Concrete output |
| --- | --- |
| 1 | Scope document, pinned revisions, development repository structure and capability checklist |
| 2 | Core on a disposable development machine with protected service/agent identities |
| 3 | One configured harness and one successful repository task |
| 4 | Minimal typed client for readiness, session creation, receipts and events |
| 5 | Recorded disconnect/reconnect and duplicate-submission demonstration |
| 6 | Queue pause, interruption and resume behavior documented and checked |
| 7 | Restart/recovery demonstration, including an uncertain outcome |
| 8 | Workspace/branch and exact-diff access proved without the desktop GUI |
| 9 | Credential/token boundary and backup/restore feasibility recorded |
| 10 | Architecture decision: keep core as-is, add a bounded adapter/fix, or revise scope with explicit reasons |

These are implementation tasks for the future project. This research turn did not provision a VM or run a model account.

---

## 10. Prioritized development backlog

**P0:** Required for the private alpha. **P1:** First expansion after the core workflow works. **P2:** Separate later project.  
Effort tags are relative: S means a narrow change, M a feature involving several components, and L a substantial integration. They do not imply a number of days and must not be added as duration estimates. The milestone schedule and 420–600-hour project range are the planning baseline; refine individual estimates after M0.

| ID | Priority / phase | Work item | Size | Depends on | Done when |
| --- | --- | --- | --- | --- | --- |
| PD-01 | P0 / M0 | Pin upstream core, harness and API fixtures | S | — | Versions and source references are recorded |
| PD-02 | P0 / M0 | Prove one real remote task | M | PD-01 | Task changes a fixture repo and emits a durable result |
| PD-03 | P0 / M0 | Prove lifecycle and recovery contracts | L | PD-02 | Acceptance, pause, interrupt, reconnect and crash states are documented |
| PD-04 | P0 / M1 | Create application skeleton and CI | M | PD-01 | Build, lint/type checks and deployment artifact succeed |
| PD-05 | P0 / M1 | Implement owner authentication | M | PD-04 | Unauthenticated calls cannot access commands/history/artifacts |
| PD-06 | P0 / M1 | Implement core gateway and error mapping | M | PD-03, PD-05 | Core token is server-only; capabilities and errors retain meaning |
| PD-07 | P0 / M1 | Add project/thread metadata | M | PD-06 | Product IDs map consistently to runtime/workspace identities |
| PD-08 | P0 / M1 | Build composer and timeline | L | PD-07 | Real streamed events, user messages and status render correctly |
| PD-09 | P0 / M2 | Persist request identity and reconcile timeouts | M | PD-06 | Retried submissions do not create duplicate accepted requests |
| PD-10 | P0 / M2 | Implement event replay and deduplication | M | PD-08 | Reconnect restores history using the recorded cursor |
| PD-11 | P0 / M2 | Implement compound Stop and queue controls | L | PD-03, PD-09 | Queue remains paused after interruption and race conditions are reconciled |
| PD-12 | P0 / M2 | Expose blocked, failed and unknown outcomes | M | PD-08, PD-09 | UI never presents an uncertain outcome as successful |
| PD-13 | P0 / M3 | Prepare validated task workspaces | L | PD-07 | Original checkout is preserved and task baseline recorded |
| PD-14 | P0 / M3 | Build changed-file and diff review | L | PD-13 | View matches exact workspace/base and handles binary/large files explicitly |
| PD-15 | P0 / M3 | Record test and artifact evidence | M | PD-14 | Trusted exit status and exact content snapshot appear; later edits invalidate the passing label |
| PD-16 | P0 / M3 | Export patch/result snapshot | M | PD-15 | Owner can retrieve a bounded, exact result package |
| PD-17 | P0 / M4 | Add supervision and operational diagnostics | M | PD-06 | Health/readiness and actionable logs identify failed components |
| PD-18 | P0 / M4 | Implement backup, restore and conservative cleanup | L | PD-13, PD-17 | Restore works and cleanup preserves unreviewed work |
| PD-19 | P0 / M4 | Add limits and usage measurements | M | PD-17 | Concurrency/runtime policies and measured intervals are visible |
| PD-20 | P0 / M5 | Execute failure-injection matrix | L | PD-09–PD-19 | Required failure cases pass with retained evidence |
| PD-21 | P0 / M5 | Harden rendering and large timelines | M | PD-08 | Untrusted content stays inert and long histories remain usable |
| PD-22 | P0 / M6 | Run pilot and publish operator documentation | L | PD-20, PD-21 | Pilot criteria and release checklist are met |
| PD-23 | P1 | Add explicit GitHub branch/PR publishing | M | PD-16 | Reviewed snapshot creates a traceable PR without merging |
| PD-24 | P1 | Add second harness | L | PD-03, PD-20 | Same product contracts pass against second native adapter |
| PD-25 | P1 | Add isolated second-owner deployment | L+ | M6 | Each owner has a separate protected execution boundary |
| PD-26 | P2 | Add durable child orchestration | L+ | Isolated execution, stable lifecycle | Child results and code integration are independently tracked |
| PD-27 | P2 | Add schedules and webhooks | L+ | Stable dispatch and recovery | Definition/run separation, deduplication and no-overlap policy work |
| PD-28 | P2 | Add Local↔Cloud handoff | L+ | Two runners, checkpoint/transfer contract | Failed transfer preserves recoverable source and destination states |
| PD-29 | P2 | Add fleet billing and organizations | L+ | Multi-user architecture | Usage, authorization and reconciliation are independently validated |

L+ means a feature must be decomposed and estimated as a separate initiative. It is outside the 16-week alpha baseline.

---

## 11. Validation and release criteria

### 11.1 Required failure matrix

| Scenario | Expected result |
| --- | --- |
| Browser disconnect during task | Accepted execution continues; reconnect recovers state and history |
| Duplicate HTTP submission | Same command/receipt is returned; no duplicate accepted execution |
| Gateway loses response after core acceptance | Reconciliation uses the same request ID |
| Core restarts mid-command | Known queued work survives; dispatched uncertainty is shown and not blindly replayed |
| Provider login expires | User sees the specific failure; draft/request identity remains available |
| Provider usage limit | State becomes blocked or otherwise reflects the core outcome; no hidden account rotation |
| Stop while another prompt is queued | Queue pause and active interruption are separately confirmed |
| Worker becomes unreachable | Last-known state is labeled stale; no invented completion |
| Disk pressure or journal write failure | New work is rejected/paused as appropriate; history is not silently discarded |
| Large tool output | UI remains usable; truncation or attachment storage is explicit |
| Markdown/HTML-like tool output | Scripts and unsafe navigation do not execute in the product origin |
| Dirty base checkout | Task workspace preserves unrelated user work |
| Test exits nonzero | Result is visibly failing regardless of agent explanation |
| Files change after a passing test | Existing test evidence becomes stale; export remains bound to the reviewed content snapshot |
| Cleanup runs with pending review | Unreviewed changes and required artifacts remain |
| Restore from backup | Historical thread and its referenced result can be reopened |
| Upstream protocol changes | Compatibility checks fail visibly before deployment |

### 11.2 Pilot

Use a fixed set of representative tasks: a small bug fix, a test addition, a bounded refactor, a documentation improvement and a dependency/configuration task. Repeat across enough runs to exercise recovery and review.

Initial pilot target: **20 real tasks over at least two weeks**, owned by one operator. Later independent testers should use separate protected installations until multi-user isolation is implemented.

Capture time to first successful task, intervention points, failures, review outcome and user understanding of states. Do not mistake token throughput or raw number of spawned agents for product value.

### 11.3 Metrics

| Metric | Proposed target or purpose |
| --- | --- |
| North-star outcome | Useful tasks reviewed and accepted per active developer per week |
| Valid task-start success | At least 95% in pilot, excluding deliberately injected faults; report denominator and causes |
| Confirmed duplicate accepted executions | Zero in the required retry scenarios |
| Confirmed loss of durably accepted history | Zero in the required disconnect/restart scenarios |
| Receipt acknowledgement | Provisional p95 below 2 seconds for a ready local gateway/core path; exclude model inference |
| Timeline update lag | Provisional p95 below 2 seconds under the reference test workload |
| Restore time | Demonstrate restoration of the reference dataset within 30 minutes |
| Review usefulness | Owner can explain what changed and inspect the matching test evidence |
| Operational burden | Count manual recoveries and minutes spent per useful completed task |

These are proposed targets, not measurements of Cloudroom or results already achieved by this project.

### 11.4 Definition of done

A release candidate is complete when its functional requirements pass, meaningful failure scenarios are demonstrated, operational procedures are reproducible, and no known history-loss or duplicate-dispatch defect remains unresolved.

Each accepted product change should include a clear explanation, relevant verification and a changelog entry where user-visible behavior changed. Tests should cover a real failure or contract, not merely restate implementation details.

---

## 12. Resource model and commercial considerations

### 12.1 Competitor reference

At research time, Cloudroom’s pricing page lists the following monthly terms in USD:

| Plan | Price | Cloud agent allowance | Agent-hours |
| --- | ---: | ---: | ---: |
| Free | $0 | 100 | 75 |
| Pro | $50 | 1,000 | 300 |
| Super | $150 | 3,000 | 900 |
| Ultra | $500 | 10,000 | 3,000 |

The page states that prices include tax. Cloudroom’s harness documentation describes using the user’s model accounts separately. These are competitor terms, not a recommended price for the proposed product. [B1], [D1]

### 12.2 Alpha operating model

Use an already budgeted development machine or a separately approved VM. No hosting purchase is included in this research task.

The monthly cost model is:

**Compute + persistent storage + off-host backup + transfer + monitoring + model usage + support time.**

For a fixed-price VM, agent-hours measure utilization; they do not automatically translate into proportional savings when a process sleeps. For a later elastic service, record billable environment intervals and resource classes so invoice reconciliation can be tested.

Do not set commercial prices before measuring resource use and support burden. Agent count, active task time, machine-awake time, retained data and inference cost are different quantities.

### 12.3 Concurrency policy

Begin with one active task, then enable a small bounded number only after workspace and lifecycle tests pass. Set CPU, memory, output and storage thresholds based on observed workloads.

Display resource-limited admission as a waiting or rejected state. Do not create an unbounded hidden queue or silently launch a new process each time a client retries.

---

## 13. Risk register

| Risk | Impact | Response / decision trigger |
| --- | --- | --- |
| Core contract does not cover a required alpha flow | Runtime reuse may not be viable as planned | Resolve in M0; implement bounded adapter or revise estimate |
| Harness changes native protocol | Start/resume/event parsing breaks | Pin versions; maintain compatibility fixtures and upgrade gate |
| Duplicate dispatch after retry | Repeated edits or external effects | Stable request IDs, receipts and failure-injection checks |
| Unknown work automatically retried | Duplicate side effects | Preserve unknown state; require intentional next action |
| Two execution locations own the same thread | Conflicting edits and state | Keep handoff out of alpha; later use explicit ownership transfer |
| Agent account accesses unrelated secrets | Exposure within trusted-owner machine | Dedicated account and limited mounts/credentials; stronger isolation before multiple owners |
| Review shows moving or different files | Owner approves unintended changes | Bind tests, review and export to one content snapshot, including relevant uncommitted/untracked files |
| Cleanup deletes unpublished work | Irrecoverable task output | Retention state and conservative protection of pending review |
| Backup restores metadata but not result files | Incomplete recovery | Backup/restore metadata, history and workspaces as an explicitly coordinated set |
| Upstream documentation drifts | Incorrect assumptions | Capabilities, pinned source and executable contract tests |
| Scope grows into parity clone | Schedule becomes unbounded | Freeze alpha requirements; keep later features as separate initiatives |
| Low user value despite technical success | Product is not worth operating | Pilot real work and measure accepted results and support burden |

---

## 14. Expansion roadmap

### Release 0.1 — Private alpha

One owner, one machine, one harness, durable remote task flow and explicit review.

### Release 0.2 — Broader personal workflow

Add PR publishing, a second harness, better project templates and independent tester installations. Prefer improvements that reduce recovery effort or shorten the path to a useful reviewed change.

### Release 0.3 — Delegation and repeatable work

Add bounded child orchestration and Loops only after command identity, result ownership and resource admission are reliable.

For delegation, use explicit child identities, parent links, limits and durable completion messages. Separate “child finished” from “child changes integrated.” Choose shared or separate execution consciously.

For Loops, separate the definition from each run, sign and deduplicate webhooks, define timezone/DST behavior, prevent unintended overlap and specify what happens to missed schedules after downtime.

### Release 0.4 — Environment handoff

Implement Local↔Cloud movement only with a versioned transfer manifest and recoverable state machine:

~~~mermaid
stateDiagram-v2
    [*] --> Preflight
    Preflight --> Copying: Capabilities and credentials valid
    Preflight --> SourceReady: Preflight fails
    Copying --> VerifyDestination
    Copying --> RecoverableFailure: Transfer interrupted
    VerifyDestination --> SwitchOwner: Files and native state verified
    VerifyDestination --> RecoverableFailure: Validation fails
    SwitchOwner --> DestinationReady
    SwitchOwner --> RecoverableFailure: Activation uncertain
    RecoverableFailure --> SourceReady: Explicit safe rollback
    RecoverableFailure --> Copying: Resume verified transfer
    DestinationReady --> [*]
    SourceReady --> [*]
~~~

This is a proposed stricter migration design. It is not a statement that Cloudroom implements that exact state machine. Source cleanup must follow verified destination activation; file conflicts and uncertain work must remain visible.

### Commercial hosting

Treat safe unrelated-user hosting as a distinct architecture milestone: tenant identity, authorization, isolated environments, credential injection and removal, fleet capacity, durable artifacts, abuse controls, metering, deletion and operational response. Estimate it after the private alpha has workload measurements.

---

## 15. Changelog page reconstruction

The supplied page is also a useful small subsystem.

**Scope classification:** This is an optional post-alpha subsystem. Its separate estimate is excluded from the 420–600-hour alpha baseline and from milestones M0–M6.

### 15.1 Observed content structure

The page contains a shared site header, a changelog title, reverse-chronological release entries, version numbers, timestamps, short feature-oriented headings, numbered changes, links to the full GitHub releases, and a site footer. Its delivered HTML includes the visible release content. [R1]

The public assets include Next.js/Turbopack markers. The investigation did not establish the original content source, publishing pipeline, cache strategy or private CMS.

### 15.2 Proposed implementation

For the new product, store structured release records:

~~~text
Release
  version
  publishedAt
  title
  changes[]
  sourceReleaseUrl
  status
~~~

Generate the feed as static HTML at build time, or use explicit prerendering, from validated content. A React/Vite client application alone does not make this content readable without JavaScript. Store timestamps in a canonical format and display a labeled timezone. Preserve stable version anchors, keyboard navigation, readable mobile layout and accessible contrast.

Use GitHub release metadata or reviewed repository content as the publication source. Sanitize imported Markdown. A preview should show exactly what will be published. Avoid publishing a feature entry before the release containing that behavior is available.

**Acceptance criteria:**

- Entries sort by publication time without relying on version-string ordering.
- Every entry has a valid timestamp, title, version and source link.
- No duplicate version entry is published accidentally.
- The page remains readable without client-side execution.
- A release can be corrected through a tracked content change.

**Estimated scope:** Approximately one to three engineering days after the application’s design and release process exist. This estimate is for a functional release feed, not a pixel-identical replica.

---

## 16. Decisions to carry into implementation

1. Reuse the pinned core through an adapter.
2. Build a narrow web application for one trusted owner.
3. Keep runtime history authoritative in the core.
4. Start with one harness and a limited execution topology.
5. Make acceptance, execution, completion and human review distinct.
6. Implement Stop through explicit queue and interruption semantics.
7. Produce exact Git and test evidence.
8. Make backup, recovery and conservative cleanup release requirements.
9. Use capability negotiation and compatibility tests for upstream changes.
10. Add delegation, Loops, handoff and commercial hosting as separate initiatives.

The first implementation deliverable is the M0 runtime contract demonstration. It is the evidence needed to validate the plan’s largest dependency before building the rest of the product.

---

## Sources

Sources were inspected on 21 October 2026. References to source files use pinned commits where available. Public-page claims can change after this date.

### REA

- **[R2]** REA repository and skill: <https://github.com/morluto/rea> and <https://github.com/morluto/rea/blob/main/.agents/skills/reverse-engineer-anything/SKILL.md>
- REA static JavaScript workflow: <https://github.com/morluto/rea/blob/main/.agents/skills/reverse-engineer-anything/references/javascript-applications.md>
- REA CLI documentation: <https://github.com/morluto/rea/blob/main/docs/cli.md>
- REA package analyzed with version 6.7.0; the research log retains the Evidence ID and directory digest above.

### Product pages and releases

- **[R1]** Changelog: <https://www.cloudroom.dev/changelog>
- **[R3]** v113: <https://github.com/davidondrej/cloudroom-gui/releases/tag/gui-v113-beta>
- **[R4]** v112: <https://github.com/davidondrej/cloudroom-gui/releases/tag/gui-v112-beta>
- **[R5]** v104: <https://github.com/davidondrej/cloudroom-gui/releases/tag/gui-v104-beta>
- **[R6]** v109: <https://github.com/davidondrej/cloudroom-gui/releases/tag/gui-v109-beta>
- **[R7]** v107: <https://github.com/davidondrej/cloudroom-gui/releases/tag/gui-v107-beta>
- **[R8]** v101: <https://github.com/davidondrej/cloudroom-gui/releases/tag/gui-v101-beta>
- **[R9]** v111: <https://github.com/davidondrej/cloudroom-gui/releases/tag/gui-v111-beta>
- **[D1]** Harnesses: <https://www.cloudroom.dev/docs/harnesses>
- **[D2]** Cloud threads: <https://www.cloudroom.dev/docs/cloud-threads>
- **[D3]** Local threads: <https://www.cloudroom.dev/docs/local-threads>
- **[D4]** Teleport: <https://www.cloudroom.dev/docs/teleport>
- **[D5]** Subagents: <https://www.cloudroom.dev/docs/subagents>
- **[D6]** Side chats: <https://www.cloudroom.dev/docs/side-chats>
- **[D7]** Automations: <https://www.cloudroom.dev/docs/automations>
- **[B1]** Pricing: <https://www.cloudroom.dev/pricing>

### Pinned source evidence

- **[C1]** Core repository: <https://github.com/davidondrej/cloudroom-core/tree/7d25d300f8ca564beb16541118f13daf89512a14>
- **[C2]** GUI repository: <https://github.com/davidondrej/cloudroom-gui/tree/90f4438174d354abec2ec0fdf4cc424893ebdb77>
- **[C3]** Core manifest: <https://github.com/davidondrej/cloudroom-core/blob/7d25d300f8ca564beb16541118f13daf89512a14/Cargo.toml>
- **[C4]** Core session lifecycle: <https://github.com/davidondrej/cloudroom-core/blob/7d25d300f8ca564beb16541118f13daf89512a14/docs/session-lifecycle.md>
- **[C5]** Core self-hosted setup: <https://github.com/davidondrej/cloudroom-core/blob/7d25d300f8ca564beb16541118f13daf89512a14/docs/setup.md>
- **[C6]** Desktop package: <https://github.com/davidondrej/cloudroom-gui/blob/90f4438174d354abec2ec0fdf4cc424893ebdb77/gui/apps/desktop/package.json>
- **[C7]** Application package: <https://github.com/davidondrej/cloudroom-gui/blob/90f4438174d354abec2ec0fdf4cc424893ebdb77/gui/apps/app/package.json>
- **[C8]** Server package: <https://github.com/davidondrej/cloudroom-gui/blob/90f4438174d354abec2ec0fdf4cc424893ebdb77/gui/apps/server/package.json>
- **[C9]** Database package: <https://github.com/davidondrej/cloudroom-gui/blob/90f4438174d354abec2ec0fdf4cc424893ebdb77/gui/packages/db/package.json>
- **[C10]** Core history implementation: <https://github.com/davidondrej/cloudroom-core/blob/7d25d300f8ca564beb16541118f13daf89512a14/src/session/history.rs>
- **[C11]** GUI notices: <https://github.com/davidondrej/cloudroom-gui/blob/90f4438174d354abec2ec0fdf4cc424893ebdb77/NOTICE>
- **[C12]** Core API: <https://github.com/davidondrej/cloudroom-core/blob/7d25d300f8ca564beb16541118f13daf89512a14/docs/api.md>

### Reproducing the static inspection

Fetch the public changelog HTML and only the JavaScript/CSS URLs explicitly referenced by it, retaining their relative paths in a local directory. Record retrieval time and SHA-256 digests. The equivalent analysis command is:

~~~bash
npx --yes --package=rea-agents@6.7.0 rea analyze-javascript-application /absolute/path/to/site-bundle --max-semantic-nodes 20000 --max-semantic-nodes-per-file 5000 --analysis-timeout-ms 60000 --json > rea-site-evidence.json
~~~

This writes static analysis evidence. It does not register an MCP server, authenticate to Cloudroom, run the downloaded app, or recover the private backend. Future fetches can produce different bytes and therefore different digests and Evidence IDs.



[B1]: https://www.cloudroom.dev/pricing
[C1]: https://github.com/davidondrej/cloudroom-core/tree/7d25d300f8ca564beb16541118f13daf89512a14
[C10]: https://github.com/davidondrej/cloudroom-core/blob/7d25d300f8ca564beb16541118f13daf89512a14/src/session/history.rs
[C11]: https://github.com/davidondrej/cloudroom-gui/blob/90f4438174d354abec2ec0fdf4cc424893ebdb77/NOTICE
[C12]: https://github.com/davidondrej/cloudroom-core/blob/7d25d300f8ca564beb16541118f13daf89512a14/docs/api.md
[C2]: https://github.com/davidondrej/cloudroom-gui/tree/90f4438174d354abec2ec0fdf4cc424893ebdb77
[C3]: https://github.com/davidondrej/cloudroom-core/blob/7d25d300f8ca564beb16541118f13daf89512a14/Cargo.toml
[C4]: https://github.com/davidondrej/cloudroom-core/blob/7d25d300f8ca564beb16541118f13daf89512a14/docs/session-lifecycle.md
[C5]: https://github.com/davidondrej/cloudroom-core/blob/7d25d300f8ca564beb16541118f13daf89512a14/docs/setup.md
[C6]: https://github.com/davidondrej/cloudroom-gui/blob/90f4438174d354abec2ec0fdf4cc424893ebdb77/gui/apps/desktop/package.json
[C7]: https://github.com/davidondrej/cloudroom-gui/blob/90f4438174d354abec2ec0fdf4cc424893ebdb77/gui/apps/app/package.json
[C8]: https://github.com/davidondrej/cloudroom-gui/blob/90f4438174d354abec2ec0fdf4cc424893ebdb77/gui/apps/server/package.json
[C9]: https://github.com/davidondrej/cloudroom-gui/blob/90f4438174d354abec2ec0fdf4cc424893ebdb77/gui/packages/db/package.json
[D1]: https://www.cloudroom.dev/docs/harnesses
[D2]: https://www.cloudroom.dev/docs/cloud-threads
[D3]: https://www.cloudroom.dev/docs/local-threads
[D4]: https://www.cloudroom.dev/docs/teleport
[D5]: https://www.cloudroom.dev/docs/subagents
[D6]: https://www.cloudroom.dev/docs/side-chats
[D7]: https://www.cloudroom.dev/docs/automations
[R1]: https://www.cloudroom.dev/changelog
[R2]: https://github.com/morluto/rea
[R3]: https://github.com/davidondrej/cloudroom-gui/releases/tag/gui-v113-beta
[R4]: https://github.com/davidondrej/cloudroom-gui/releases/tag/gui-v112-beta
[R5]: https://github.com/davidondrej/cloudroom-gui/releases/tag/gui-v104-beta
[R6]: https://github.com/davidondrej/cloudroom-gui/releases/tag/gui-v109-beta
[R7]: https://github.com/davidondrej/cloudroom-gui/releases/tag/gui-v107-beta
[R8]: https://github.com/davidondrej/cloudroom-gui/releases/tag/gui-v101-beta
[R9]: https://github.com/davidondrej/cloudroom-gui/releases/tag/gui-v111-beta

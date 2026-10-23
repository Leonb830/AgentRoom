"use client";

import { useEffect, useRef, useState } from "react";
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDownToLine, ArrowUp, Braces, Check, ChevronRight, Circle, Clock3, FileCode2, FolderGit2, GitBranch, History, LogOut, Menu, Plus, RefreshCw, Settings2, ShieldCheck, Square, Terminal, X } from "lucide-react";
import { mergeEvents, RecordEvent, visibleStatus } from "@/lib/display";

type Thread = { id: string; title: string; createdAt: string; baseCommit?: string; pendingId?: string };
type State = { state: string; current_request?: string; queue_paused?: boolean; queue?: string[]; receipts?: Record<string, { state: string; command?: string; error?: string }>; startup_reason?: string };
type Command = { id: string; kind: string; payload: Record<string, string>; createdAt: string };
type Review = { snapshot: string; baseCommit: string; patch: string; files: string[]; capturedAt: number; truncated: boolean; tests: null };
type Pending = { url: string; body: Record<string, string>; threadId?: string };
async function api<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api/room/${path}`, { method: body === undefined ? "GET" : "POST", headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "Request failed");
  return result;
}

export function Workspace(props: { owner: string; signOutAction: () => Promise<void> }) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: true } } }));
  return <QueryClientProvider client={client}><Room {...props}/></QueryClientProvider>;
}

function Room({ owner, signOutAction }: { owner: string; signOutAction: () => Promise<void> }) {
  const queryClient = useQueryClient();
  const [selected, select] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const [records, setRecords] = useState<RecordEvent[]>([]);
  const [review, setReview] = useState<Review | null>(null);
  const [panel, setPanel] = useState<"review" | "settings">("review");
  const [mobileNav, setMobileNav] = useState(false);
  const cursor = useRef(0);
  const bootstrap = useQuery({ queryKey: ["bootstrap"], queryFn: () => api<{ threads: Thread[]; runner: { ready: boolean; message: string; repository: string; baseline: string; account: unknown } | null; runnerError: string | null }>("bootstrap"), refetchInterval: 10000 });
  const detail = useQuery({ queryKey: ["thread", selected], queryFn: () => api<{ thread: Thread; state: State | null; runtimeError: string | null; commands: Command[]; reviews: { snapshot: string; decision: string }[] }>(`threads/${selected}`), enabled: Boolean(selected), refetchInterval: 2000 });
  useEffect(() => { try { setPending(JSON.parse(localStorage.getItem("agentroom.pending") ?? "null")); } catch { /* invalid local draft */ } }, []);
  useEffect(() => {
    if (busy) return;
    const saved = detail.data?.commands.find(command => command.id === detail.data?.thread.pendingId);
    if (!pending && saved && selected) {
      setPending({ url: saved.kind === "start" ? "threads" : `threads/${selected}/command`, body: saved.payload, threadId: saved.kind === "start" ? undefined : selected });
    }
  }, [detail.data, pending, selected, busy]);
  useEffect(() => {
    function shortcut(event: KeyboardEvent) {
      const target = event.target as HTMLElement;
      if (event.key.toLowerCase() === "n" && !event.metaKey && !event.ctrlKey && !event.altKey
        && !["INPUT", "TEXTAREA"].includes(target.tagName) && !target.isContentEditable) select(null);
      if (event.key === "Escape") setMobileNav(false);
    }
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, []);
  useEffect(() => {
    setDraft(localStorage.getItem(`agentroom.draft.${selected ?? "new"}`) ?? "");
    setRecords([]); setReview(null); cursor.current = 0;
  }, [selected]);
  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const result = await api<{ events: RecordEvent[] }>(`threads/${selected}/events?after=${cursor.current}`);
        if (cancelled) return;
        setRecords(previous => mergeEvents(previous, result.events).slice(-1500));
        for (const row of result.events) cursor.current = Math.max(cursor.current, row.sequence);
        timer = setTimeout(poll, result.events.length === 256 ? 10 : 1500);
      } catch { if (!cancelled) timer = setTimeout(poll, 3000); }
    }
    void poll();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [selected]);

  function saveDraft(text: string) { setDraft(text); localStorage.setItem(`agentroom.draft.${selected ?? "new"}`, text); }
  async function perform(action: Pending) {
    setBusy(true); setError(null); setPending(action); localStorage.setItem("agentroom.pending", JSON.stringify(action));
    try {
      const result = await api<{ id?: string }>(action.url, action.body);
      localStorage.removeItem("agentroom.pending"); setPending(null);
      if (action.body.kind === "prompt" || action.url === "threads") {
        localStorage.removeItem(`agentroom.draft.${action.threadId ?? "new"}`); setDraft("");
      }
      if (action.url === "threads" && result.id) select(result.id);
      await queryClient.invalidateQueries();
    } catch (problem) { setError(problem instanceof Error ? problem.message : "Request failed"); }
    finally { setBusy(false); }
  }
  function submit() {
    if (!draft.trim() || busy || pending) return;
    if (!selected) void perform({ url: "threads", body: { id: crypto.randomUUID(), promptId: crypto.randomUUID(), title: draft.trim().split("\n")[0].slice(0,120), text: draft.trim() } });
    else void perform({ url: `threads/${selected}/command`, threadId: selected, body: { id: crypto.randomUUID(), kind: "prompt", text: draft.trim() } });
  }
  async function capture() {
    if (!selected) return;
    setBusy(true); setError(null);
    try { setReview(await api<Review>(`threads/${selected}/review`, {})); }
    catch (problem) { setError(problem instanceof Error ? problem.message : "Capture failed"); }
    finally { setBusy(false); }
  }
  async function decide(decision: string) {
    if (!selected || !review) return;
    setBusy(true);
    try { await api(`threads/${selected}/decision`, { snapshot: review.snapshot, decision }); await queryClient.invalidateQueries({ queryKey: ["thread", selected] }); }
    catch (problem) { setError(problem instanceof Error ? problem.message : "Could not save review"); }
    finally { setBusy(false); }
  }
  const state = detail.data?.state ?? undefined;
  const runner = bootstrap.data?.runner;
  const stale = detail.isError || Boolean(detail.data?.runtimeError);
  const messages = detail.data?.commands.filter(command => command.kind === "prompt") ?? [];
  const status = visibleStatus(state, messages.at(-1)?.id);
  const activeTitle = detail.data?.thread.title ?? bootstrap.data?.threads.find(thread => thread.id === selected)?.title;
  const acceptance = detail.data?.reviews.find(item => item.snapshot === review?.snapshot)?.decision;

  return <div className="app-shell">
    <aside className={`sidebar ${mobileNav ? "open" : ""}`}><a className="brand" href="/"><span className="brand-icon"><Braces size={19}/></span>AgentRoom<span className="alpha">ALPHA</span></a>
      <button className="button new-task" onClick={() => { select(null); setMobileNav(false); }}><Plus size={16}/> New task <kbd>N</kbd></button>
      <div className="nav-label">WORKSPACE</div><button className="nav-item selected" onClick={() => setPanel("review")}><FolderGit2 size={17}/>{runner?.repository ?? "My project"}<span className="count">{bootstrap.data?.threads.length ?? 0}</span></button>
      <div className="nav-label recent-label">RECENT THREADS <History size={13}/></div><nav className="thread-list">{bootstrap.data?.threads.map(thread => <button className={`thread-link ${thread.id === selected ? "active" : ""}`} key={thread.id} onClick={() => { select(thread.id); setMobileNav(false); }}><Circle size={7}/><span>{thread.title}</span></button>)}{!bootstrap.data?.threads.length && <p className="nav-empty">Your tasks will appear here.</p>}</nav>
      <div className="sidebar-bottom"><button className="nav-item" onClick={() => setPanel("settings")}><Settings2 size={17}/> Runner & settings</button><div className="owner"><span className="avatar">{owner.slice(0,1)}</span><span><b>{owner}</b><small>Personal workspace</small></span><form action={signOutAction}><button aria-label="Sign out" className="icon-button"><LogOut size={15}/></button></form></div></div>
    </aside>
    {mobileNav && <button className="nav-overlay" aria-label="Close navigation" onClick={() => setMobileNav(false)}/>}
    <main className="main-workspace"><header className="topbar"><button className="icon-button mobile-menu" aria-label="Open navigation" onClick={() => setMobileNav(true)}><Menu size={18}/></button><span className="breadcrumb">Workspace <ChevronRight size={13}/> <span>{selected ? "Thread" : "New task"}</span></span><span className={`runner-pill ${runner?.ready ? "ready" : ""}`}><span className="status-dot"/>{runner?.message ?? "Runner offline"}</span></header>
      <section className="thread-header"><div><div className="eyebrow">{selected ? "TASK WORKSPACE" : "LET’S MAKE PROGRESS"}</div><h1>{selected ? activeTitle ?? "Loading thread…" : "What are we working on?"}</h1><div className="task-meta"><span><GitBranch size={13}/>{detail.data?.thread.baseCommit?.slice(0,8) ?? runner?.baseline ?? "Baseline not configured"}</span><span><Terminal size={13}/>Codex</span><span><ShieldCheck size={13}/>Private workspace</span></div></div>{selected && <div className="thread-controls"><span className="status-badge">{stale ? "Connection lost · " : ""}{status}</span><button className="button subtle" disabled={busy || Boolean(pending)} onClick={() => void perform({ url: `threads/${selected}/command`, threadId: selected, body: { id: crypto.randomUUID(), kind: state?.queue_paused ? "resume" : "stop", text: "" } })}>{state?.queue_paused ? <RefreshCw size={14}/> : <Square size={12}/>} {state?.queue_paused ? "Resume queue" : "Stop"}</button></div>}</section>
      <div className="work-columns"><section className="conversation"><div className="section-tabs"><span className="tab active"><Terminal size={14}/> {selected ? "Activity" : "Task brief"}</span>{selected && <span className="queue-count">{state?.queue?.length ?? 0} queued</span>}</div>
        <div className="timeline">{!selected ? <div className="empty-conversation"><div className="empty-mark"><Braces size={29}/></div><h2>A little direction.<br/>A lot of possibility.</h2><p>Describe a focused change. Your agent works in its own branch, with a history you can return to.</p><div className="suggestions">{["Find and fix a small bug", "Add tests for an existing feature", "Improve the project documentation"].map(text => <button key={text} onClick={() => saveDraft(text)}>{text}<ArrowUp size={13}/></button>)}</div><span className="quiet-note"><Clock3 size={12}/> Accepted tasks continue when this tab closes.</span></div> : <>
          {messages.map(command => <article className="message user-message" key={command.id}><div className="message-label"><span className="avatar tiny">{owner.slice(0,1)}</span><b>You</b><time>{new Date(command.createdAt).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}</time><span>{state?.receipts?.[command.id]?.state ?? "Awaiting receipt"}</span></div><p>{command.payload.text}</p></article>)}
          {records.length === 1500 && <div className="inline-notice">Showing the most recent 1,500 events. Earlier history is retained by Core.</div>}
          {records.filter(record => !["native_record", "native_event"].includes(record.kind)).map(record => <Event key={`${record.session_id}:${record.sequence}`} record={record}/>)}
          {state?.startup_reason && <div className="inline-error">{state.startup_reason}</div>}
          {!records.length && <p className="quiet-note timeline-wait">Waiting for recorded activity…</p>}
        </>}</div>
        {(error || bootstrap.error || detail.error) && <div className="inline-error" role="alert">{error ?? bootstrap.error?.message ?? detail.error?.message}</div>}
        {pending && <div className="pending-notice"><span>This request is saved locally. Reconcile it before starting another action.</span><button className="button subtle" disabled={busy} onClick={() => void perform(pending)}><RefreshCw size={13}/> Retry same request</button></div>}
        <div className="composer"><textarea aria-label={selected ? "Follow-up message" : "Task description"} value={draft} onChange={event => saveDraft(event.target.value)} placeholder={selected ? "Add a follow-up or clarify the task…" : "Describe your task. Be specific about the result you want…"} onKeyDown={event => { if ((event.metaKey || event.ctrlKey) && event.key === "Enter") { event.preventDefault(); submit(); } }}/><div className="composer-bottom"><span><Terminal size={13}/> Codex <span className="composer-divider">/</span> {selected ? "Follow-up" : "New branch"}</span><button aria-label={selected ? "Send follow-up" : "Start task"} className="send-button" disabled={!draft.trim() || busy || Boolean(pending) || !runner?.ready} onClick={submit}>{busy ? <RefreshCw className="spin" size={17}/> : <ArrowUp size={18}/>}</button></div></div><div className="composer-hint">{runner?.ready ? "⌘ / Ctrl + Enter to send · Drafts stay in this browser" : "Connect your runner in Settings to start a task"}</div>
      </section><aside className="review-panel"><div className="section-tabs"><button className={`tab ${panel === "review" ? "active" : ""}`} onClick={() => setPanel("review")}><GitBranch size={14}/> Review</button><button className={`tab ${panel === "settings" ? "active" : ""}`} onClick={() => setPanel("settings")}><Settings2 size={14}/> Settings</button></div>
      {panel === "settings" ? <div className="settings-content"><div className="eyebrow">RUNNER CONNECTION</div><h3>{runner?.message ?? "Finish runner setup"}</h3><p>{bootstrap.data?.runnerError ?? (runner?.ready ? "Your self-hosted runner executes tasks independently of this browser." : runner?.message ?? "Configure your Core connection to continue.")}</p><div className="setting-row"><span>Harness</span><b>Codex</b></div><div className="setting-row"><span>Execution</span><b>One active task</b></div><div className="setting-row"><span>Retention</span><b>Manual cleanup</b></div><div className="setting-row"><span>Access</span><b>Owner only</b></div><p className="quiet-note">Set up the protected Core service and complete ChatGPT sign-in on the runner. See the repository’s setup guide.</p><button className="button subtle" onClick={() => void queryClient.invalidateQueries()}><RefreshCw size={14}/> Check connection</button></div> : <>
      {!review ? <div className="review-empty"><div className="review-icon"><FileCode2 size={25}/></div><h3>Every change has a story.</h3><p>When your task settles, capture its changes to inspect the diff and export an exact patch.</p><button className="button subtle" disabled={!selected || busy || Boolean(state?.current_request) || Boolean(state?.queue?.length)} onClick={() => void capture()}><RefreshCw size={14}/> Capture changes</button><div className="review-checklist"><span><Check size={13}/>Recorded base revision</span><span><Check size={13}/>Snapshot-bound patch</span><span><Check size={13}/>Explicit owner review</span></div></div> : <div className="review-content"><div className="review-heading"><span>{review.files.length} changed files</span><button className="icon-button" onClick={() => void capture()} disabled={busy} aria-label="Refresh review snapshot"><RefreshCw size={14}/></button></div><div className="snapshot">Snapshot {review.snapshot.slice(0,12)}</div><div className="file-list">{review.files.map(file => <div key={file}><FileCode2 size={13}/><code>{file}</code></div>)}</div><details open><summary>Unified diff</summary><pre className="diff">{review.patch || "No changes from the recorded baseline."}</pre></details>{review.truncated && <p className="quiet-note">Preview truncated. The exported patch contains the complete captured diff.</p>}<div className="test-evidence"><Circle size={12}/><span>No trusted test evidence recorded</span></div><p className="quiet-note">This is the snapshot captured at {new Date(review.capturedAt).toLocaleTimeString()}. Capture again to include later edits.</p><a className="button subtle export-button" href={`/api/room/threads/${selected}/patch/${review.snapshot}`}><ArrowDownToLine size={14}/> Export patch</a><button className="button primary export-button" disabled={busy || acceptance === "accepted"} onClick={() => void decide("accepted")}><Check size={14}/>{acceptance === "accepted" ? "Snapshot accepted" : "Accept snapshot"}</button><button className="text-button" disabled={busy} onClick={() => void decide("changes_requested")}>{acceptance === "changes_requested" ? "Changes requested" : "Request changes"}</button></div>}
      <div className="review-footer"><ShieldCheck size={14}/><span>Nothing merges without you.</span></div></>}
      </aside></div>
    </main>
  </div>;
}

function Event({ record }: { record: RecordEvent }) {
  const data = record.data as Record<string, unknown> | string | null;
  const text = typeof data === "string" ? data : typeof data?.delta === "string" ? data.delta : typeof data?.text === "string" ? data.text : null;
  if (text && ["text_delta", "thinking_delta"].includes(record.kind)) return <div className={`agent-text ${record.kind === "thinking_delta" ? "thinking" : ""}`}>{text}</div>;
  return <details className="event"><summary><span className="event-icon"><Terminal size={12}/></span><span>{record.kind.replaceAll("_", " ")}</span><small>#{record.sequence}</small><ChevronRight size={12}/></summary><pre>{JSON.stringify(record.data, null, 2).slice(0,16000)}</pre></details>;
}

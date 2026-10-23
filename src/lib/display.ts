export type RecordEvent = { sequence: number; session_id: string; kind: string; data: unknown; timestamp_ms?: number };
export function mergeEvents(previous: RecordEvent[], incoming: RecordEvent[]) {
  const rows = new Map(previous.map(event => [`${event.session_id}:${event.sequence}`, event]));
  for (const event of incoming) rows.set(`${event.session_id}:${event.sequence}`, event);
  return [...rows.values()].sort((a, b) => a.sequence - b.sequence);
}
export function visibleStatus(state?: { state: string; current_request?: string | null; queue_paused?: boolean; receipts?: Record<string, {state: string}> }, lastPromptId?: string) {
  if (!state) return "Connecting";
  if (state.state === "process_lost") return "Outcome unknown";
  if (state.state === "failed") return "Failed";
  if (state.current_request) return state.state === "interrupting" ? "Stopping" : "Running";
  if (state.queue_paused) return "Queue paused";
  if (["starting", "starting_turn", "resuming", "pending"].includes(state.state)) return "Starting";
  const last = lastPromptId ? state.receipts?.[lastPromptId] : undefined;
  if (last?.state.startsWith("unknown")) return "Outcome unknown";
  if (last?.state === "failed") return "Failed";
  if (last?.state === "interrupted") return "Interrupted";
  if (last?.state === "completed") return "Finished";
  if (last?.state === "accepted" || last?.state === "delivered") return "Accepted";
  return state.state === "closed" ? "Closed" : "Ready";
}

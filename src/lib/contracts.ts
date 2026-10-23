import { createHash } from "node:crypto";
import { z } from "zod";

export const taskInput = z.object({
  id: z.uuidv4(), promptId: z.uuidv4(), title: z.string().trim().min(1).max(120),
  text: z.string().trim().min(1).refine(value => Buffer.byteLength(value) <= 32768, "Prompt exceeds 32 KiB")
});
export const commandInput = z.object({
  id: z.uuidv4(), kind: z.enum(["prompt", "stop", "resume"]),
  text: z.string().max(32768).default("")
}).refine(value => value.kind !== "prompt" || (value.text.trim().length > 0 && Buffer.byteLength(value.text) <= 32768), "Invalid prompt");
export function payloadHash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
export type RuntimeState = {
  state: string; current_request?: string | null; queue?: string[]; queue_paused?: boolean;
  receipts?: Record<string, { state: string; command?: string; error?: string | null }>;
  startup_reason?: string | null; last_sequence?: number;
};
export function settled(state: RuntimeState) {
  return ["idle", "sleeping", "closed", "failed", "process_lost"].includes(state.state)
    && !state.current_request && !(state.queue?.length);
}

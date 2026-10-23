import { describe, expect, it } from "vitest";
import { commandInput, payloadHash, settled, taskInput } from "./contracts";
import { mergeEvents, visibleStatus } from "./display";

describe("durable task contracts", () => {
  it("rejects oversized UTF-8 prompts even when the character count is smaller", () => {
    expect(commandInput.safeParse({ id: "b751fbab-a622-42a6-a6bb-68afd5a44918", kind: "prompt", text: "界".repeat(12000) }).success).toBe(false);
  });
  it("distinguishes payload content under a stable identity", () => {
    expect(payloadHash({ id: "same", text: "one" })).not.toBe(payloadHash({ id: "same", text: "two" }));
  });
  it("does not release admission for queued, running, or uncertain work", () => {
    expect(settled({ state: "idle", queue: ["a"] })).toBe(false);
    expect(settled({ state: "running", current_request: "a" })).toBe(false);
    expect(settled({ state: "unknown" })).toBe(false);
    expect(settled({ state: "idle", queue: [] })).toBe(true);
  });
  it("deduplicates replay without treating sequence gaps as missing history", () => {
    const one = { sequence: 3, session_id: "a", kind: "text_delta", data: "one" };
    const two = { ...one, sequence: 9, data: "two" };
    expect(mergeEvents([one], [one, two])).toEqual([one, two]);
  });
  it("does not report lost execution as success", () => {
    expect(visibleStatus({ state: "process_lost" })).toBe("Outcome unknown");
    expect(visibleStatus({ state: "idle", receipts: { a: { state: "accepted" } } })).not.toBe("Finished");
    expect(visibleStatus({ state: "idle", receipts: { newer: { state: "accepted" }, older: { state: "completed" } } }, "newer")).toBe("Accepted");
  });
});

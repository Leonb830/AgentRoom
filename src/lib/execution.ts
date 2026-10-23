export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export async function execution(path: string, body?: unknown) {
  if (!process.env.EXECUTION_TOKEN) throw new ApiError(503, "Execution service is not configured");
  let response: Response;
  try {
    response = await fetch(`${process.env.EXECUTION_URL ?? "http://127.0.0.1:8000"}${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: { Authorization: `Bearer ${process.env.EXECUTION_TOKEN}`, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body), cache: "no-store", signal: AbortSignal.timeout(60000)
    });
  } catch { throw new ApiError(503, "Execution service is unavailable. Retry the same request to reconcile its outcome."); }
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new ApiError(response.status, typeof error.detail === "string" ? error.detail : "Execution service rejected this operation");
  }
  return response;
}

import { auth, authConfigured } from "@/auth";
import { db } from "@/lib/db";
import { commandInput, payloadHash, settled, taskInput } from "@/lib/contracts";
import { ApiError, execution } from "@/lib/execution";
import { Prisma } from "@prisma/client";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ path: string[] }> };

async function reconcileAdmission() {
  const active = await db.thread.findUnique({ where: { admissionKey: "runner" } });
  if (!active || active.pendingId) return;
  try {
    const state = await (await execution(`/threads/${active.id}/state`)).json();
    if (settled(state)) await db.thread.updateMany({ where: { id: active.id, admissionKey: "runner" }, data: { admissionKey: null } });
  } catch { /* Unreachable or uncertain execution retains its admission slot. */ }
}

async function remember(threadId: string, input: z.infer<typeof commandInput>) {
  const hash = payloadHash(input);
  const previous = await db.command.findUnique({ where: { id: input.id } });
  if (previous) {
    if (previous.threadId !== threadId || previous.payloadHash !== hash) throw new ApiError(409, "Request identity was already used for different content");
    return;
  }
  await db.command.create({ data: { id: input.id, threadId, kind: input.kind, payloadHash: hash, payload: input } });
}

async function handle(request: Request, context: Context) {
  try {
    if (!authConfigured()) throw new ApiError(503, "Owner authentication is not configured");
    const session = await auth();
    if (!session?.user || session.user.id !== process.env.AGENTROOM_OWNER_GITHUB_ID) throw new ApiError(401, "Sign in as the configured owner");
    if (request.method !== "GET") {
      const expected = new URL(process.env.AUTH_URL ?? request.url).origin;
      if (request.headers.get("origin") !== expected) throw new ApiError(403, "Request origin is not allowed");
      if (Number(request.headers.get("content-length") ?? 0) > 70000) throw new ApiError(413, "Request is too large");
    }
    const { path } = await context.params;
    const method = request.method;
    const json = async () => {
      const raw = await request.text();
      if (Buffer.byteLength(raw) > 70000) throw new ApiError(413, "Request is too large");
      try { return JSON.parse(raw); } catch { throw new ApiError(400, "Invalid JSON"); }
    };
    if (path.join("/") === "bootstrap" && method === "GET") {
      await reconcileAdmission();
      const threads = await db.thread.findMany({ orderBy: { updatedAt: "desc" }, take: 100 });
      let runner = null, runnerError: string | null = null;
      try { runner = await (await execution("/health")).json(); }
      catch (error) { runnerError = error instanceof Error ? error.message : "Runner unavailable"; }
      return Response.json({ threads, runner, runnerError, owner: session.user.name });
    }
    if (path.join("/") === "threads" && method === "POST") {
      const input = taskInput.parse(await json());
      const hash = payloadHash(input);
      await reconcileAdmission();
      const existing = await db.command.findUnique({ where: { id: input.id } });
      if (existing && existing.payloadHash !== hash) throw new ApiError(409, "Task identity conflicts with the saved request");
      if (!existing) {
        await db.$transaction(async tx => {
          await tx.thread.create({ data: { id: input.id, title: input.title, sessionId: `cr_${input.id}`, admissionKey: "runner", pendingId: input.id } });
          await tx.command.create({ data: { id: input.id, threadId: input.id, kind: "start", payloadHash: hash, payload: input } });
        });
      } else {
        const retry = await db.thread.updateMany({ where: { id: input.id, OR: [{ pendingId: null }, { pendingId: input.id }] }, data: { admissionKey: "runner", pendingId: input.id } });
        if (!retry.count) throw new ApiError(409, "Reconcile this thread's pending action first");
      }
      const started = await (await execution(`/threads/${input.id}/start`, {})).json();
      await db.thread.update({ where: { id: input.id }, data: { baseCommit: started.baseCommit, workspace: started.workspace } });
      const prompt = { id: input.promptId, kind: "prompt" as const, text: input.text };
      await remember(input.id, prompt);
      await execution(`/threads/${input.id}/command`, prompt);
      await db.thread.update({ where: { id: input.id }, data: { pendingId: null } });
      return Response.json({ id: input.id }, { status: 202 });
    }
    if (path[0] === "threads" && path[1]) {
      const id = z.uuidv4().parse(path[1]);
      const thread = await db.thread.findUnique({ where: { id } });
      if (!thread) throw new ApiError(404, "Thread not found");
      const action = path[2];
      if (!action && method === "GET") {
        let state = null, runtimeError = null;
        try { state = await (await execution(`/threads/${id}/state`)).json(); }
        catch (error) { runtimeError = error instanceof Error ? error.message : "Runner unavailable"; }
        return Response.json({ thread, state, runtimeError, commands: await db.command.findMany({ where: { threadId: id }, orderBy: { createdAt: "asc" } }), reviews: await db.review.findMany({ where: { threadId: id } }) });
      }
      if (action === "events" && method === "GET") {
        const after = z.coerce.number().int().min(0).parse(new URL(request.url).searchParams.get("after") ?? 0);
        return Response.json(await (await execution(`/threads/${id}/events?after=${after}`)).json());
      }
      if (action === "command" && method === "POST") {
        const input = commandInput.parse(await json());
        await remember(id, input);
        if (input.kind !== "stop") {
          await reconcileAdmission();
        }
        const claim = await db.thread.updateMany({ where: { id, OR: [{ pendingId: null }, { pendingId: input.id }] }, data: { admissionKey: "runner", pendingId: input.id } });
        if (!claim.count) throw new ApiError(409, "Reconcile this thread's pending action first");
        const result = await (await execution(`/threads/${id}/command`, input)).json();
        await db.thread.update({ where: { id }, data: { pendingId: null } });
        return Response.json(result, { status: 202 });
      }
      if (action === "review" && method === "POST") {
        return Response.json(await (await execution(`/threads/${id}/review`, {})).json());
      }
      if (action === "decision" && method === "POST") {
        const input = z.object({ snapshot: z.string().regex(/^[a-f0-9]{40,64}$/), decision: z.enum(["accepted", "changes_requested"]) }).parse(await json());
        // Verify this exact captured artifact exists and passes its integrity check.
        await execution(`/threads/${id}/patch/${input.snapshot}`);
        const result = await db.review.upsert({ where: { threadId_snapshot: { threadId: id, snapshot: input.snapshot } },
          create: { threadId: id, ...input }, update: { decision: input.decision } });
        return Response.json(result);
      }
      if (action === "patch" && path[3] && method === "GET") {
        const snapshot = z.string().regex(/^[a-f0-9]{40,64}$/).parse(path[3]);
        const response = await execution(`/threads/${id}/patch/${snapshot}`);
        return new Response(response.body, { headers: { "Content-Type": "text/x-patch", "Content-Disposition": `attachment; filename="agentroom-${snapshot.slice(0,12)}.patch"`, "Cache-Control": "no-store" } });
      }
    }
    throw new ApiError(404, "Route not found");
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ error: error.issues[0]?.message ?? "Invalid input" }, { status: 422 });
    if (error instanceof ApiError) return Response.json({ error: error.message }, { status: error.status });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
      return Response.json({ error: "Another task or request holds this identity. Retry the same action after its state settles." }, { status: 409 });
    console.error("AgentRoom request failed", error instanceof Error ? error.name : "UnknownError");
    return Response.json({ error: "The application database is unavailable or the operation could not be recorded." }, { status: 503 });
  }
}
export const GET = handle;
export const POST = handle;

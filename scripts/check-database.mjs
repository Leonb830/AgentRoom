// Disposable database validation of the migration artifact and Prisma contracts.
// This does not substitute for a successful `prisma migrate deploy` check.
import pg from "pg";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

process.loadEnvFile(".env");
const name = "agentroom_check_" + Date.now();
const admin = new pg.Client({ connectionString: process.env.DATABASE_URL });
await admin.connect();
let database;
try {
  await admin.query(`CREATE DATABASE "${name}"`);
  const url = new URL(process.env.DATABASE_URL);
  url.pathname = "/" + name;
  database = new pg.Client({ connectionString: url.toString() });
  await database.connect();
  await database.query(await readFile("prisma/migrations/20261021000000_initial/migration.sql", "utf8"));
  const client = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString() }) });
  try {
    const id = randomUUID();
    await client.thread.create({ data: { id, title: "Fixture", sessionId: "cr_" + id, admissionKey: "runner", pendingId: id } });
    await assert.rejects(client.thread.create({ data: { id: randomUUID(), title: "Blocked", sessionId: "cr_second", admissionKey: "runner" } }), error => error.code === "P2002");
    await client.command.create({ data: { id: randomUUID(), threadId: id, kind: "prompt", payloadHash: "fixture", payload: { text: "hello" } } });
    assert.equal((await client.thread.findUnique({ where: { id }, include: { commands: true } })).commands.length, 1);
    await client.review.create({ data: { threadId: id, snapshot: "a".repeat(40), decision: "accepted" } });
    await client.review.deleteMany();
    await client.command.deleteMany();
    await client.thread.deleteMany();
    console.log("PASS: migration SQL, Prisma relations, review records, and unique runtime admission in disposable PostgreSQL.");
  } finally { await client.$disconnect(); }
  if (process.argv.includes("--browser")) {
    const core = process.argv[process.argv.indexOf("--browser") + 1];
    assert(core, "Provide the pinned Core source directory after --browser");
    const child = spawn("python3", ["scripts/check-browser.py", core], { stdio: "inherit", env: { ...process.env, DATABASE_URL: url.toString() } });
    const code = await new Promise(resolve => child.on("exit", resolve));
    assert.equal(code, 0, "Browser checks failed");
  }
} finally {
  if (database) await database.end();
  await admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
  await admin.end();
}

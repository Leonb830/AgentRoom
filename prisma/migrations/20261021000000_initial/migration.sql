CREATE TABLE "Thread" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "baseCommit" TEXT,
    "workspace" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "admissionKey" TEXT,
    "pendingId" TEXT,
    CONSTRAINT "Thread_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Command" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Command_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "snapshot" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Thread_sessionId_key" ON "Thread"("sessionId");
CREATE UNIQUE INDEX "Thread_admissionKey_key" ON "Thread"("admissionKey");
CREATE INDEX "Command_threadId_createdAt_idx" ON "Command"("threadId", "createdAt");
CREATE UNIQUE INDEX "Review_threadId_snapshot_key" ON "Review"("threadId", "snapshot");
ALTER TABLE "Command" ADD CONSTRAINT "Command_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "Thread"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Review" ADD CONSTRAINT "Review_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "Thread"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

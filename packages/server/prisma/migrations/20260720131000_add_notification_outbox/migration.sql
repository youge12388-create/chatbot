CREATE TABLE "NotificationOutbox" (
  "id" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "conversationId" TEXT,
  "leadId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lockedAt" TIMESTAMP(3),
  "lockedBy" TEXT,
  "lastError" TEXT,
  "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "NotificationOutbox_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NotificationOutbox_idempotencyKey_key"
  ON "NotificationOutbox"("idempotencyKey");

CREATE INDEX "NotificationOutbox_status_availableAt_idx"
  ON "NotificationOutbox"("status", "availableAt");

CREATE INDEX "NotificationOutbox_lockedAt_idx"
  ON "NotificationOutbox"("lockedAt");
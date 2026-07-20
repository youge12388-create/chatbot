ALTER TABLE "Conversation"
  ADD COLUMN "sessionTokenHash" TEXT,
  ADD COLUMN "sessionTokenExpiresAt" TIMESTAMP(3);

CREATE INDEX "Conversation_sessionTokenExpiresAt_idx"
  ON "Conversation"("sessionTokenExpiresAt");
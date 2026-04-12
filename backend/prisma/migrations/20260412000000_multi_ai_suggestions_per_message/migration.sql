-- DropIndex
DROP INDEX IF EXISTS "AiSuggestion_messageId_key";

-- CreateIndex (non-unique, for lookups)
CREATE INDEX IF NOT EXISTS "AiSuggestion_messageId_idx" ON "AiSuggestion"("messageId");

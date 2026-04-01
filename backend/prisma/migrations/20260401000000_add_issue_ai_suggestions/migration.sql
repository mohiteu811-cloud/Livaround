-- AlterTable: make conversationId and messageId optional on AiSuggestion
ALTER TABLE "AiSuggestion" ALTER COLUMN "conversationId" DROP NOT NULL;
ALTER TABLE "AiSuggestion" ALTER COLUMN "messageId" DROP NOT NULL;

-- Add issueId column
ALTER TABLE "AiSuggestion" ADD COLUMN "issueId" TEXT;

-- Add foreign key to Issue
ALTER TABLE "AiSuggestion" ADD CONSTRAINT "AiSuggestion_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "Issue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add index on issueId
CREATE INDEX "AiSuggestion_issueId_idx" ON "AiSuggestion"("issueId");

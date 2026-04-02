-- AlterTable
ALTER TABLE "Host" ADD COLUMN "notificationPrefs" TEXT NOT NULL DEFAULT '{"guestMessages":true,"workerMessages":true,"aiConversationAlerts":true,"aiIssueAlerts":"all"}';

-- AlterTable: add WhatsApp fields to Booking
ALTER TABLE "Booking" ADD COLUMN "whatsappSentAt" TIMESTAMP(3);
ALTER TABLE "Booking" ADD COLUMN "whatsappMessageId" TEXT;

-- AlterTable: add whatsappEnabled to Host
ALTER TABLE "Host" ADD COLUMN "whatsappEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable: WhatsAppLog
CREATE TABLE "WhatsAppLog" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT,
    "hostId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "messageId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SENT',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsAppLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WhatsAppLog_bookingId_idx" ON "WhatsAppLog"("bookingId");
CREATE INDEX "WhatsAppLog_hostId_idx" ON "WhatsAppLog"("hostId");

-- AddForeignKey
ALTER TABLE "WhatsAppLog" ADD CONSTRAINT "WhatsAppLog_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WhatsAppLog" ADD CONSTRAINT "WhatsAppLog_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "Host"("id") ON DELETE CASCADE ON UPDATE CASCADE;

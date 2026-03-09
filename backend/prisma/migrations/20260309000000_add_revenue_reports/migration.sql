-- Add commissionPct to PropertyOwnership
ALTER TABLE "PropertyOwnership" ADD COLUMN "commissionPct" DOUBLE PRECISION;

-- Create RevenueReport table
CREATE TABLE "RevenueReport" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "hostId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "grossRevenue" DOUBLE PRECISION NOT NULL,
    "airbnbServiceFees" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "netRevenue" DOUBLE PRECISION NOT NULL,
    "commissionPct" DOUBLE PRECISION NOT NULL DEFAULT 20,
    "commissionAmount" DOUBLE PRECISION NOT NULL,
    "airbnbReportUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RevenueReport_pkey" PRIMARY KEY ("id")
);

-- Create Expense table
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "expenseType" TEXT NOT NULL DEFAULT 'SHARED',
    "receiptUrl" TEXT,
    "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
    "approvalStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approverNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- Unique constraint on property+month+year
CREATE UNIQUE INDEX "RevenueReport_propertyId_month_year_key" ON "RevenueReport"("propertyId", "month", "year");

-- Foreign keys
ALTER TABLE "RevenueReport" ADD CONSTRAINT "RevenueReport_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "RevenueReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

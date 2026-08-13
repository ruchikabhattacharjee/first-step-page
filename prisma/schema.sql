-- Canonical SQLite DDL for CashFlow Pro (mirrors prisma/schema.prisma).
-- Applied by `node scripts/init-db.mjs` at build/boot time. Idempotent.

CREATE TABLE IF NOT EXISTS "User" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "businessName" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "industry" TEXT NOT NULL,
  "country" TEXT NOT NULL DEFAULT 'India',
  "currency" TEXT NOT NULL DEFAULT 'INR',
  "fyStartMonth" INTEGER NOT NULL DEFAULT 4,
  "bankBalance" REAL NOT NULL DEFAULT 0,
  "openingReceivables" REAL NOT NULL DEFAULT 0,
  "openingPayables" REAL NOT NULL DEFAULT 0,
  "setupComplete" BOOLEAN NOT NULL DEFAULT false,
  "role" TEXT NOT NULL DEFAULT 'Admin',
  "isVerified" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "businessId" TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");

CREATE TABLE IF NOT EXISTS "OtpToken" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "email" TEXT NOT NULL,
  "otp" TEXT NOT NULL,
  "purpose" TEXT NOT NULL DEFAULT 'SIGNUP',
  "expiresAt" DATETIME NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "Contact" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "ownerId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "email" TEXT,
  "phone" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Contact_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "Contact_ownerId_idx" ON "Contact"("ownerId");

CREATE TABLE IF NOT EXISTS "Invoice" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "ownerId" TEXT NOT NULL,
  "invoiceNumber" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "issueDate" DATETIME NOT NULL,
  "dueDate" DATETIME NOT NULL,
  "state" TEXT NOT NULL,
  "items" TEXT NOT NULL,
  "totalAmount" REAL NOT NULL,
  "paidDate" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Invoice_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Invoice_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Contact"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "Invoice_ownerId_idx" ON "Invoice"("ownerId");
CREATE UNIQUE INDEX IF NOT EXISTS "Invoice_ownerId_invoiceNumber_key" ON "Invoice"("ownerId", "invoiceNumber");

CREATE TABLE IF NOT EXISTS "Bill" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "ownerId" TEXT NOT NULL,
  "billNumber" TEXT NOT NULL,
  "vendorId" TEXT NOT NULL,
  "billDate" DATETIME NOT NULL,
  "dueDate" DATETIME NOT NULL,
  "category" TEXT NOT NULL,
  "state" TEXT NOT NULL,
  "items" TEXT NOT NULL,
  "totalAmount" REAL NOT NULL,
  "paidDate" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Bill_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Bill_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Contact"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "Bill_ownerId_idx" ON "Bill"("ownerId");

CREATE TABLE IF NOT EXISTS "Transaction" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "ownerId" TEXT NOT NULL,
  "date" DATETIME NOT NULL,
  "amount" REAL NOT NULL,
  "description" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "category" TEXT,
  "tag" TEXT NOT NULL,
  "invoiceId" TEXT,
  "billId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Transaction_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Transaction_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Transaction_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "Transaction_ownerId_idx" ON "Transaction"("ownerId");
CREATE INDEX IF NOT EXISTS "Transaction_ownerId_date_idx" ON "Transaction"("ownerId", "date");

CREATE TABLE IF NOT EXISTS "Budget" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "ownerId" TEXT NOT NULL,
  "month" INTEGER NOT NULL,
  "year" INTEGER NOT NULL,
  "category" TEXT NOT NULL,
  "amount" REAL NOT NULL,
  CONSTRAINT "Budget_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "Budget_ownerId_idx" ON "Budget"("ownerId");
CREATE UNIQUE INDEX IF NOT EXISTS "Budget_ownerId_year_month_category_key" ON "Budget"("ownerId", "year", "month", "category");

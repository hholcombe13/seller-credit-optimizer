-- CreateTable
CREATE TABLE "Template" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "program" TEXT NOT NULL,
    "termMonths" INTEGER NOT NULL,
    "price" REAL NOT NULL,
    "ltv" REAL,
    "loanAmount" REAL,
    "noteRate" REAL NOT NULL,
    "discountPts" REAL NOT NULL,
    "closingCosts" REAL NOT NULL,
    "sellerCredit" REAL NOT NULL,
    "pmiType" TEXT,
    "pmiAnnualFac" REAL,
    "taxesMonthly" REAL,
    "insuranceMonthly" REAL,
    "hoaMonthly" REAL,
    "lockRate" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

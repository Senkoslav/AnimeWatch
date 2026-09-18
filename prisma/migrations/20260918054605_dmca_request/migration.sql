-- CreateTable
CREATE TABLE "DmcaRequest" (
    "id" TEXT NOT NULL,
    "claimantName" TEXT NOT NULL,
    "claimantEmail" TEXT NOT NULL,
    "rightsHolder" TEXT NOT NULL,
    "targetUrl" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "ipHash" TEXT NOT NULL,
    "notifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DmcaRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DmcaRequest_createdAt_idx" ON "DmcaRequest"("createdAt");

-- CreateIndex
CREATE INDEX "DmcaRequest_ipHash_createdAt_idx" ON "DmcaRequest"("ipHash", "createdAt");

-- CreateEnum
CREATE TYPE "DocumentKind" AS ENUM ('STATEMENT', 'DATA_EXPORT');

-- CreateEnum
CREATE TYPE "DocumentFormat" AS ENUM ('DOCX', 'PDF', 'ZIP');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('PENDING', 'READY', 'FAILED');

-- DropIndex
DROP INDEX "Attestation_semesterId_idx";

-- CreateTable
CREATE TABLE "GeneratedDocument" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "kind" "DocumentKind" NOT NULL,
    "format" "DocumentFormat" NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'PENDING',
    "params" JSONB NOT NULL,
    "fileName" TEXT,
    "mimeType" TEXT,
    "content" BYTEA,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GeneratedDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarFeed" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rotatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CalendarFeed_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GeneratedDocument_organizationId_userId_createdAt_idx" ON "GeneratedDocument"("organizationId", "userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CalendarFeed_userId_key" ON "CalendarFeed"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CalendarFeed_token_key" ON "CalendarFeed"("token");

-- CreateIndex
CREATE UNIQUE INDEX "Attestation_semesterId_kind_key" ON "Attestation"("semesterId", "kind");

-- AddForeignKey
ALTER TABLE "GeneratedDocument" ADD CONSTRAINT "GeneratedDocument_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedDocument" ADD CONSTRAINT "GeneratedDocument_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarFeed" ADD CONSTRAINT "CalendarFeed_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


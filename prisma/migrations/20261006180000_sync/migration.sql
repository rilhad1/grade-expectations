-- AlterTable
ALTER TABLE "Attendance" ADD COLUMN     "editedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Grade" ADD COLUMN     "editedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "SyncOp" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "status" TEXT NOT NULL,
    "code" TEXT,
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SyncOp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SyncOp_userId_createdAt_idx" ON "SyncOp"("userId", "createdAt");


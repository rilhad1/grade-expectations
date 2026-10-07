-- AlterTable
ALTER TABLE "TeachingLoad" ADD COLUMN     "streamId" UUID;

-- CreateIndex
CREATE INDEX "TeachingLoad_streamId_idx" ON "TeachingLoad"("streamId");


-- DropIndex
DROP INDEX "Attestation_semesterId_kind_key";

-- AlterTable
ALTER TABLE "Assessment" ADD COLUMN     "attestationKind" "AttestationKind";

-- AlterTable
ALTER TABLE "Attestation" ADD COLUMN     "course" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "SemesterPeriod" ADD COLUMN     "course" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "Attestation_semesterId_kind_course_key" ON "Attestation"("semesterId", "kind", "course");


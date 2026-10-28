-- Журнал і «Сьогодні» фільтрують оцінки за колонкою оцінювання, а результати атестації за навантаженням
CREATE INDEX "Grade_assessmentId_idx" ON "Grade"("assessmentId");
CREATE INDEX "AttestationResult_loadId_idx" ON "AttestationResult"("loadId");

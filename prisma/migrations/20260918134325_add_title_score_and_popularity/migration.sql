-- AlterTable
ALTER TABLE "Title" ADD COLUMN     "popularityRank" INTEGER,
ADD COLUMN     "score" DOUBLE PRECISION;

-- CreateIndex
CREATE INDEX "Title_score_idx" ON "Title"("score");

-- CreateIndex
CREATE INDEX "Title_popularityRank_idx" ON "Title"("popularityRank");

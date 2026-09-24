-- CreateEnum
CREATE TYPE "RelationKind" AS ENUM ('SIMILAR', 'SEQUEL', 'PREQUEL', 'SIDE_STORY', 'OTHER');

-- CreateTable
CREATE TABLE "TitleRelation" (
    "titleId" TEXT NOT NULL,
    "targetShikimoriId" INTEGER NOT NULL,
    "kind" "RelationKind" NOT NULL,
    "rank" INTEGER NOT NULL,

    CONSTRAINT "TitleRelation_pkey" PRIMARY KEY ("titleId","targetShikimoriId","kind")
);

-- CreateTable
CREATE TABLE "RecommendationDismissal" (
    "userId" TEXT NOT NULL,
    "titleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecommendationDismissal_pkey" PRIMARY KEY ("userId","titleId")
);

-- CreateIndex
CREATE INDEX "TitleRelation_targetShikimoriId_idx" ON "TitleRelation"("targetShikimoriId");

-- CreateIndex
CREATE INDEX "RecommendationDismissal_titleId_idx" ON "RecommendationDismissal"("titleId");

-- AddForeignKey
ALTER TABLE "TitleRelation" ADD CONSTRAINT "TitleRelation_titleId_fkey" FOREIGN KEY ("titleId") REFERENCES "Title"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendationDismissal" ADD CONSTRAINT "RecommendationDismissal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendationDismissal" ADD CONSTRAINT "RecommendationDismissal_titleId_fkey" FOREIGN KEY ("titleId") REFERENCES "Title"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateEnum
CREATE TYPE "TitleStatus" AS ENUM ('ONGOING', 'COMPLETED', 'ANNOUNCED', 'HIDDEN');

-- CreateEnum
CREATE TYPE "TitleKind" AS ENUM ('TV', 'MOVIE', 'OVA', 'ONA', 'SPECIAL');

-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('HLS', 'MP4', 'TELEGRAM', 'VK', 'EXTERNAL');

-- CreateEnum
CREATE TYPE "IngestStatus" AS ENUM ('PENDING', 'DOWNLOADING', 'UPLOADING', 'ENCODING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'EDITOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "WatchState" AS ENUM ('WATCHING', 'PLANNED', 'COMPLETED', 'DROPPED');

-- CreateTable
CREATE TABLE "Title" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "shikimoriId" INTEGER,
    "name" TEXT NOT NULL,
    "nameRu" TEXT NOT NULL,
    "synonyms" TEXT[],
    "description" TEXT,
    "posterUrl" TEXT,
    "bannerUrl" TEXT,
    "kind" "TitleKind" NOT NULL DEFAULT 'TV',
    "status" "TitleStatus" NOT NULL DEFAULT 'ONGOING',
    "year" INTEGER,
    "season" TEXT,
    "ageRating" TEXT,
    "genres" TEXT[],
    "totalEpisodes" INTEGER,
    "airDay" INTEGER,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Title_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Episode" (
    "id" TEXT NOT NULL,
    "titleId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "name" TEXT,
    "description" TEXT,
    "thumbUrl" TEXT,
    "duration" INTEGER,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Episode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Source" (
    "id" TEXT NOT NULL,
    "episodeId" TEXT NOT NULL,
    "type" "SourceType" NOT NULL,
    "url" TEXT NOT NULL,
    "quality" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "priority" INTEGER NOT NULL DEFAULT 100,

    CONSTRAINT "Source_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IngestJob" (
    "id" TEXT NOT NULL,
    "episodeId" TEXT NOT NULL,
    "tgChatId" TEXT NOT NULL,
    "tgMessageId" INTEGER NOT NULL,
    "bunnyVideoId" TEXT,
    "status" "IngestStatus" NOT NULL DEFAULT 'PENDING',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IngestJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Member" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "nickname" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "bio" TEXT,
    "tgUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 100,

    CONSTRAINT "Member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Credit" (
    "id" TEXT NOT NULL,
    "titleId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "isVoice" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Credit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "tgId" BIGINT NOT NULL,
    "username" TEXT,
    "firstName" TEXT,
    "avatarUrl" TEXT,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bookmark" (
    "userId" TEXT NOT NULL,
    "titleId" TEXT NOT NULL,
    "state" "WatchState" NOT NULL DEFAULT 'WATCHING',
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bookmark_pkey" PRIMARY KEY ("userId","titleId")
);

-- CreateTable
CREATE TABLE "Progress" (
    "userId" TEXT NOT NULL,
    "episodeId" TEXT NOT NULL,
    "seconds" INTEGER NOT NULL DEFAULT 0,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Progress_pkey" PRIMARY KEY ("userId","episodeId")
);

-- CreateTable
CREATE TABLE "News" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "cover" TEXT,
    "body" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "News_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Title_slug_key" ON "Title"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Title_shikimoriId_key" ON "Title"("shikimoriId");

-- CreateIndex
CREATE INDEX "Title_status_updatedAt_idx" ON "Title"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "Title_publishedAt_idx" ON "Title"("publishedAt");

-- CreateIndex
CREATE INDEX "Title_year_idx" ON "Title"("year");

-- CreateIndex
CREATE INDEX "Episode_publishedAt_idx" ON "Episode"("publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Episode_titleId_number_key" ON "Episode"("titleId", "number");

-- CreateIndex
CREATE INDEX "Source_episodeId_priority_idx" ON "Source"("episodeId", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "IngestJob_episodeId_key" ON "IngestJob"("episodeId");

-- CreateIndex
CREATE INDEX "IngestJob_status_idx" ON "IngestJob"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Member_slug_key" ON "Member"("slug");

-- CreateIndex
CREATE INDEX "Credit_titleId_idx" ON "Credit"("titleId");

-- CreateIndex
CREATE UNIQUE INDEX "User_tgId_key" ON "User"("tgId");

-- CreateIndex
CREATE INDEX "Bookmark_userId_state_idx" ON "Bookmark"("userId", "state");

-- CreateIndex
CREATE INDEX "Progress_userId_updatedAt_idx" ON "Progress"("userId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "News_slug_key" ON "News"("slug");

-- AddForeignKey
ALTER TABLE "Episode" ADD CONSTRAINT "Episode_titleId_fkey" FOREIGN KEY ("titleId") REFERENCES "Title"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Source" ADD CONSTRAINT "Source_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngestJob" ADD CONSTRAINT "IngestJob_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Credit" ADD CONSTRAINT "Credit_titleId_fkey" FOREIGN KEY ("titleId") REFERENCES "Title"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Credit" ADD CONSTRAINT "Credit_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bookmark" ADD CONSTRAINT "Bookmark_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bookmark" ADD CONSTRAINT "Bookmark_titleId_fkey" FOREIGN KEY ("titleId") REFERENCES "Title"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Progress" ADD CONSTRAINT "Progress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Progress" ADD CONSTRAINT "Progress_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

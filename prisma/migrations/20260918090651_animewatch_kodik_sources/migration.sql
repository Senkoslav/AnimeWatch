-- AlterEnum
BEGIN;
CREATE TYPE "Role_new" AS ENUM ('USER', 'ADMIN');
ALTER TABLE "public"."User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" TYPE "Role_new" USING ("role"::text::"Role_new");
ALTER TYPE "Role" RENAME TO "Role_old";
ALTER TYPE "Role_new" RENAME TO "Role";
DROP TYPE "public"."Role_old";
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'USER';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "SourceType_new" AS ENUM ('KODIK', 'MP4', 'HLS', 'EXTERNAL');
ALTER TABLE "Source" ALTER COLUMN "type" TYPE "SourceType_new" USING ("type"::text::"SourceType_new");
ALTER TYPE "SourceType" RENAME TO "SourceType_old";
ALTER TYPE "SourceType_new" RENAME TO "SourceType";
DROP TYPE "public"."SourceType_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "Credit" DROP CONSTRAINT "Credit_memberId_fkey";

-- DropForeignKey
ALTER TABLE "Credit" DROP CONSTRAINT "Credit_titleId_fkey";

-- DropForeignKey
ALTER TABLE "IngestJob" DROP CONSTRAINT "IngestJob_episodeId_fkey";

-- DropTable
DROP TABLE "Credit";

-- DropTable
DROP TABLE "IngestJob";

-- DropTable
DROP TABLE "Member";

-- DropTable
DROP TABLE "News";

-- DropEnum
DROP TYPE "IngestStatus";

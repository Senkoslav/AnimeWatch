-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- CreateIndex
CREATE INDEX "Title_nameRu_idx" ON "Title" USING GIN ("nameRu" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "Title_name_idx" ON "Title" USING GIN ("name" gin_trgm_ops);

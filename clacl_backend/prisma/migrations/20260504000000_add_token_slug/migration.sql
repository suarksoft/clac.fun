-- Add slug field for human-friendly token URLs (/token/0xABC...)
ALTER TABLE "Token" ADD COLUMN "slug" TEXT;
CREATE UNIQUE INDEX "Token_slug_key" ON "Token"("slug");

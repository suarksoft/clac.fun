-- Add chainId to SyncState for multi-chain support
ALTER TABLE "SyncState" ADD COLUMN "chainId" INTEGER NOT NULL DEFAULT 10143;

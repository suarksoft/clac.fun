-- ════════════════════════════════════════════════════════════════
--  V2: per-token EIP-1167 clone architecture (ClacFactoryV2)
-- ════════════════════════════════════════════════════════════════

-- TokenV2
CREATE TABLE "TokenV2" (
    "address"             TEXT NOT NULL,
    "factoryAddress"      TEXT NOT NULL,
    "creator"             TEXT NOT NULL,
    "name"                TEXT NOT NULL,
    "symbol"              TEXT NOT NULL,
    "imageURI"            TEXT NOT NULL,
    "k"                   TEXT NOT NULL,
    "duration"            INTEGER NOT NULL,
    "createdAt"           INTEGER NOT NULL,
    "deathTime"           INTEGER NOT NULL,
    "virtualSupply"       TEXT NOT NULL DEFAULT '0',
    "poolBalance"         TEXT NOT NULL DEFAULT '0',
    "totalHolders"        INTEGER NOT NULL DEFAULT 0,
    "totalLotteryWeight"  TEXT NOT NULL DEFAULT '0',
    "marketCap"           DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currentPrice"        TEXT NOT NULL DEFAULT '0',
    "volume24h"           DOUBLE PRECISION NOT NULL DEFAULT 0,
    "change24h"           DOUBLE PRECISION NOT NULL DEFAULT 0,
    "firstBuyPrice"       TEXT,
    "deathRequested"      BOOLEAN NOT NULL DEFAULT false,
    "deathFinalized"      BOOLEAN NOT NULL DEFAULT false,
    "deathRequestedBy"    TEXT,
    "deathRequestedAt"    INTEGER,
    "deathFinalizedAt"    INTEGER,
    "proRataPool"         TEXT,
    "lotteryPool"         TEXT,
    "lotteryShare"        TEXT,
    "totalSupplySnapshot" TEXT,
    "lotteryWinners"      JSONB,
    "swept"               BOOLEAN NOT NULL DEFAULT false,
    "slug"                TEXT,
    "description"         TEXT,
    "website"             TEXT,
    "twitter"             TEXT,
    "telegram"            TEXT,
    "indexedAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TokenV2_pkey" PRIMARY KEY ("address")
);
CREATE UNIQUE INDEX "TokenV2_slug_key" ON "TokenV2"("slug");
CREATE INDEX "TokenV2_factoryAddress_idx" ON "TokenV2"("factoryAddress");
CREATE INDEX "TokenV2_deathFinalized_volume24h_idx" ON "TokenV2"("deathFinalized", "volume24h" DESC);
CREATE INDEX "TokenV2_deathTime_idx" ON "TokenV2"("deathTime");

-- TradeV2
CREATE TABLE "TradeV2" (
    "id"           SERIAL NOT NULL,
    "tokenAddress" TEXT NOT NULL,
    "trader"       TEXT NOT NULL,
    "isBuy"        BOOLEAN NOT NULL,
    "tokenAmount"  TEXT NOT NULL,
    "monAmount"    TEXT NOT NULL,
    "protocolFee"  TEXT NOT NULL,
    "creatorFee"   TEXT NOT NULL,
    "newSupply"    TEXT NOT NULL,
    "newPrice"     TEXT NOT NULL,
    "txHash"       TEXT NOT NULL,
    "logIndex"     INTEGER NOT NULL,
    "blockNumber"  INTEGER NOT NULL,
    "timestamp"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TradeV2_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TradeV2_txHash_logIndex_key" ON "TradeV2"("txHash", "logIndex");
CREATE INDEX "TradeV2_tokenAddress_timestamp_idx" ON "TradeV2"("tokenAddress", "timestamp" DESC);
CREATE INDEX "TradeV2_trader_idx" ON "TradeV2"("trader");
ALTER TABLE "TradeV2" ADD CONSTRAINT "TradeV2_tokenAddress_fkey"
    FOREIGN KEY ("tokenAddress") REFERENCES "TokenV2"("address") ON DELETE RESTRICT ON UPDATE CASCADE;

-- HolderV2
CREATE TABLE "HolderV2" (
    "id"            SERIAL NOT NULL,
    "tokenAddress"  TEXT NOT NULL,
    "address"       TEXT NOT NULL,
    "balance"       TEXT NOT NULL,
    "lotteryWeight" TEXT NOT NULL DEFAULT '0',
    CONSTRAINT "HolderV2_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "HolderV2_tokenAddress_address_key" ON "HolderV2"("tokenAddress", "address");
CREATE INDEX "HolderV2_address_idx" ON "HolderV2"("address");
ALTER TABLE "HolderV2" ADD CONSTRAINT "HolderV2_tokenAddress_fkey"
    FOREIGN KEY ("tokenAddress") REFERENCES "TokenV2"("address") ON DELETE RESTRICT ON UPDATE CASCADE;

-- LotteryWinV2
CREATE TABLE "LotteryWinV2" (
    "id"           SERIAL NOT NULL,
    "tokenAddress" TEXT NOT NULL,
    "winner"       TEXT NOT NULL,
    "amount"       TEXT NOT NULL,
    "txHash"       TEXT NOT NULL,
    "timestamp"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LotteryWinV2_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "LotteryWinV2_winner_idx" ON "LotteryWinV2"("winner");
ALTER TABLE "LotteryWinV2" ADD CONSTRAINT "LotteryWinV2_tokenAddress_fkey"
    FOREIGN KEY ("tokenAddress") REFERENCES "TokenV2"("address") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ClaimV2
CREATE TABLE "ClaimV2" (
    "id"            SERIAL NOT NULL,
    "tokenAddress"  TEXT NOT NULL,
    "holder"        TEXT NOT NULL,
    "proRataAmount" TEXT NOT NULL,
    "lotteryAmount" TEXT NOT NULL,
    "txHash"        TEXT NOT NULL,
    "timestamp"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClaimV2_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ClaimV2_txHash_key" ON "ClaimV2"("txHash");
CREATE INDEX "ClaimV2_holder_idx" ON "ClaimV2"("holder");
ALTER TABLE "ClaimV2" ADD CONSTRAINT "ClaimV2_tokenAddress_fkey"
    FOREIGN KEY ("tokenAddress") REFERENCES "TokenV2"("address") ON DELETE RESTRICT ON UPDATE CASCADE;

-- SyncStateV2
CREATE TABLE "SyncStateV2" (
    "id"              INTEGER NOT NULL DEFAULT 1,
    "lastBlockNumber" INTEGER NOT NULL DEFAULT 0,
    "chainId"         INTEGER NOT NULL DEFAULT 10143,
    "factoryAddress"  TEXT NOT NULL DEFAULT '',
    CONSTRAINT "SyncStateV2_pkey" PRIMARY KEY ("id")
);

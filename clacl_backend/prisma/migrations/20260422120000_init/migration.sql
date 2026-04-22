-- CreateTable
CREATE TABLE "Token" (
    "id" INTEGER NOT NULL,
    "creator" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "imageURI" TEXT NOT NULL,
    "virtualSupply" TEXT NOT NULL DEFAULT '0',
    "poolBalance" TEXT NOT NULL DEFAULT '0',
    "createdAt" INTEGER NOT NULL,
    "duration" INTEGER NOT NULL,
    "dead" BOOLEAN NOT NULL DEFAULT false,
    "deathProcessed" BOOLEAN NOT NULL DEFAULT false,
    "totalHolders" INTEGER NOT NULL DEFAULT 0,
    "marketCap" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currentPrice" TEXT NOT NULL DEFAULT '0',
    "volume24h" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "change24h" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "firstBuyPrice" TEXT,
    "indexedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Token_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Trade" (
    "id" SERIAL NOT NULL,
    "tokenId" INTEGER NOT NULL,
    "trader" TEXT NOT NULL,
    "isBuy" BOOLEAN NOT NULL,
    "tokenAmount" TEXT NOT NULL,
    "monAmount" TEXT NOT NULL,
    "protocolFee" TEXT NOT NULL,
    "creatorFee" TEXT NOT NULL,
    "newSupply" TEXT NOT NULL,
    "newPrice" TEXT NOT NULL,
    "txHash" TEXT NOT NULL,
    "blockNumber" INTEGER NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Trade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Holder" (
    "id" SERIAL NOT NULL,
    "tokenId" INTEGER NOT NULL,
    "address" TEXT NOT NULL,
    "balance" TEXT NOT NULL,
    CONSTRAINT "Holder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LotteryWin" (
    "id" SERIAL NOT NULL,
    "tokenId" INTEGER NOT NULL,
    "winner" TEXT NOT NULL,
    "amount" TEXT NOT NULL,
    "txHash" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LotteryWin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Claim" (
    "id" SERIAL NOT NULL,
    "tokenId" INTEGER NOT NULL,
    "holder" TEXT NOT NULL,
    "amount" TEXT NOT NULL,
    "txHash" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Claim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncState" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "lastBlockNumber" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "SyncState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Trade_txHash_key" ON "Trade"("txHash");

-- CreateIndex
CREATE UNIQUE INDEX "Holder_tokenId_address_key" ON "Holder"("tokenId", "address");

-- AddForeignKey
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_tokenId_fkey" FOREIGN KEY ("tokenId") REFERENCES "Token"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Holder" ADD CONSTRAINT "Holder_tokenId_fkey" FOREIGN KEY ("tokenId") REFERENCES "Token"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LotteryWin" ADD CONSTRAINT "LotteryWin_tokenId_fkey" FOREIGN KEY ("tokenId") REFERENCES "Token"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_tokenId_fkey" FOREIGN KEY ("tokenId") REFERENCES "Token"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

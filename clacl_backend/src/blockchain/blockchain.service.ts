import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ethers } from 'ethers';
import { PrismaService } from '../prisma/prisma.service';
import { activeConfig } from '../config/monad.config';
import { CLAC_FACTORY_ABI } from './contract.abi';
import { TokensGateway } from '../tokens/tokens.gateway';

@Injectable()
export class BlockchainService implements OnModuleInit {
  private readonly logger = new Logger(BlockchainService.name);
  private provider: ethers.Provider | null = null;
  private contract: ethers.Contract | null = null;
  private isRealtimeWs = false;
  private pollingTimer: NodeJS.Timeout | null = null;
  private readonly finalityBlocks = Number(
    process.env.MONAD_FINALITY_BLOCKS ?? 3,
  );
  private readonly replayBlocks = Number(process.env.MONAD_REPLAY_BLOCKS ?? 20);
  private readonly initialBackfillBlocks = Number(
    process.env.MONAD_INITIAL_BACKFILL_BLOCKS ?? 5000,
  );
  private readonly maxLogRange = Number(process.env.MONAD_MAX_LOG_RANGE ?? 100);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokensGateway: TokensGateway,
  ) {}

  async onModuleInit() {
    if (!activeConfig.contractAddress) {
      this.logger.warn(
        'MONAD_CONTRACT_ADDRESS empty. Blockchain listener pasif durumda.',
      );
      return;
    }

    await this.connect();
    try {
      await this.syncPastEvents();
    } catch (error) {
      this.logger.error(
        `Initial sync failed, continuing with realtime listener: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
    }
    this.listenToEvents();
  }

  private async connect() {
    try {
      this.provider = new ethers.WebSocketProvider(activeConfig.wsUrl);
      this.contract = new ethers.Contract(
        activeConfig.contractAddress,
        CLAC_FACTORY_ABI,
        this.provider,
      );
      this.isRealtimeWs = true;
      this.logger.log(`Connected to Monad at ${activeConfig.wsUrl}`);
    } catch (error) {
      this.logger.warn(
        `WebSocket connection failed, falling back to RPC polling at ${activeConfig.rpcUrl}: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
      this.provider = new ethers.JsonRpcProvider(activeConfig.rpcUrl);
      this.contract = new ethers.Contract(
        activeConfig.contractAddress,
        CLAC_FACTORY_ABI,
        this.provider,
      );
      this.isRealtimeWs = false;
    }
  }

  private getContract() {
    if (!this.contract || !this.provider) {
      throw new Error('Blockchain provider not initialized');
    }
    return { contract: this.contract, provider: this.provider };
  }

  private getEventTxHash(event: any): string | null {
    const candidates = [
      event?.transactionHash,
      event?.log?.transactionHash,
      event?.transaction?.hash,
      event?.hash,
    ];
    for (const value of candidates) {
      if (typeof value === 'string' && value.trim().length > 0) {
        return value;
      }
    }
    return null;
  }

  private getEventBlockNumber(event: any): number | null {
    const raw = event?.blockNumber ?? event?.log?.blockNumber;
    if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
    if (typeof raw === 'bigint') return Number(raw);
    return null;
  }

  private async syncPastEvents() {
    const { contract, provider } = this.getContract();
    const syncState = await this.prisma.syncState.findFirst();
    const currentBlock = await provider.getBlockNumber();
    const finalizedBlock = Math.max(currentBlock - this.finalityBlocks, 0);
    const defaultFromBlock = Math.max(finalizedBlock - this.initialBackfillBlocks, 0);
    const fromBlock = Math.max(
      (syncState?.lastBlockNumber ?? defaultFromBlock) - this.replayBlocks,
      0,
    );

    if (fromBlock >= finalizedBlock) {
      this.logger.log(
        `No finalized block to sync yet. from=${fromBlock} finalized=${finalizedBlock}`,
      );
      return;
    }

    this.logger.log(`Syncing from block ${fromBlock} to ${finalizedBlock}`);

    const chunkSize = Math.max(1, Math.min(this.maxLogRange, 100));
    for (let start = fromBlock; start <= finalizedBlock; start += chunkSize) {
      const end = Math.min(start + chunkSize - 1, finalizedBlock);

      const tokenCreatedEvents = await this.queryFilterSafe(
        contract,
        contract.filters.TokenCreated(),
        start,
        end,
      );
      const tradeEvents = await this.queryFilterSafe(
        contract,
        contract.filters.Trade(),
        start,
        end,
      );
      const deathEvents = await this.queryFilterSafe(
        contract,
        contract.filters.TokenClacced(),
        start,
        end,
      );
      const lotteryEvents = await this.queryFilterSafe(
        contract,
        contract.filters.LotteryWin(),
        start,
        end,
      );
      const claimEvents = await this.queryFilterSafe(
        contract,
        contract.filters.Claimed(),
        start,
        end,
      );

      for (const event of tokenCreatedEvents) await this.handleTokenCreated(event);
      for (const event of tradeEvents) await this.handleTrade(event);
      for (const event of deathEvents) await this.handleDeath(event);
      for (const event of lotteryEvents) await this.handleLottery(event);
      for (const event of claimEvents) await this.handleClaim(event);

      await this.markSyncedBlock(end);
    }

    this.logger.log(`Sync complete at finalized block ${finalizedBlock}`);
  }

  private async queryFilterSafe(
    contract: ethers.Contract,
    filter: any,
    fromBlock: number,
    toBlock: number,
  ) {
    try {
      return await contract.queryFilter(filter, fromBlock, toBlock);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const isRangeLimitError =
        message.includes('eth_getLogs is limited') ||
        message.includes('limited to a') ||
        message.includes('getLogs');

      if (!isRangeLimitError || fromBlock >= toBlock) {
        throw error;
      }

      const mid = Math.floor((fromBlock + toBlock) / 2);
      const left = await this.queryFilterSafe(contract, filter, fromBlock, mid);
      const right = await this.queryFilterSafe(contract, filter, mid + 1, toBlock);
      return [...left, ...right];
    }
  }

  private listenToEvents() {
    const { contract } = this.getContract();
    if (!this.isRealtimeWs) {
      const pollMs = Number(process.env.MONAD_POLL_INTERVAL_MS ?? 15000);
      this.pollingTimer = setInterval(() => {
        this.syncPastEvents().catch((error) => {
          this.logger.error(
            `Polling sync failed: ${
              error instanceof Error ? error.message : 'unknown error'
            }`,
          );
        });
      }, pollMs);
      this.logger.log(
        `Listening via polling every ${pollMs}ms using ${activeConfig.rpcUrl}`,
      );
      return;
    }

    contract.on('TokenCreated', async (...args: any[]) => {
      const event = args[args.length - 1];
      await this.handleTokenCreated(event);
    });

    contract.on('Trade', async (...args: any[]) => {
      const event = args[args.length - 1];
      await this.handleTrade(event);
    });

    contract.on('TokenClacced', async (...args: any[]) => {
      const event = args[args.length - 1];
      await this.handleDeath(event);
    });

    contract.on('LotteryWin', async (...args: any[]) => {
      const event = args[args.length - 1];
      await this.handleLottery(event);
    });

    contract.on('Claimed', async (...args: any[]) => {
      const event = args[args.length - 1];
      await this.handleClaim(event);
    });

    this.logger.log('Listening to real-time contract events');
  }

  private async handleTokenCreated(event: any) {
    const args = event?.args;
    if (!args) return;

    const { tokenId, creator, name, symbol, imageURI, duration } = args;
    const block = await event.getBlock();

    await this.prisma.token.upsert({
      where: { id: Number(tokenId) },
      create: {
        id: Number(tokenId),
        creator,
        name,
        symbol,
        imageURI,
        createdAt: Number(block.timestamp),
        duration: Number(duration),
      },
      update: {},
    });

    this.tokensGateway.emitTokenCreated({
      tokenId: Number(tokenId),
      creator,
      name,
      symbol,
      imageURI,
      duration: Number(duration),
      createdAt: Number(block.timestamp),
    });

    this.logger.log(`Token #${tokenId} created: ${name} (${symbol})`);
  }

  private async handleTrade(event: any) {
    const args = event?.args;
    if (!args) return;

    const {
      tokenId,
      trader,
      isBuy,
      tokenAmount,
      monAmount,
      protocolFee,
      creatorFee,
      newSupply,
      newPrice,
    } = args;
    const txHash = this.getEventTxHash(event);
    const blockNumber = this.getEventBlockNumber(event);
    if (!txHash) {
      this.logger.warn(
        `Skipping trade for token #${Number(tokenId)} because txHash is missing`,
      );
      return;
    }
    if (blockNumber === null) {
      this.logger.warn(
        `Skipping trade for token #${Number(tokenId)} because blockNumber is missing`,
      );
      return;
    }

    const normalizedTrader = String(trader).toLowerCase();
    const existing = await this.prisma.trade.findUnique({
      where: { txHash },
    });
    if (existing) return;

    try {
      await this.prisma.trade.create({
        data: {
          tokenId: Number(tokenId),
          trader: normalizedTrader,
          isBuy: Boolean(isBuy),
          tokenAmount: tokenAmount.toString(),
          monAmount: monAmount.toString(),
          protocolFee: protocolFee.toString(),
          creatorFee: creatorFee.toString(),
          newSupply: newSupply.toString(),
          newPrice: newPrice.toString(),
          txHash,
          blockNumber,
        },
      });
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') {
        return;
      }
      throw error;
    }

    const monFloat = Number(ethers.formatEther(monAmount));
    const priceFloat = Number(ethers.formatEther(newPrice));

    await this.prisma.token.update({
      where: { id: Number(tokenId) },
      data: {
        virtualSupply: newSupply.toString(),
        currentPrice: newPrice.toString(),
        marketCap: priceFloat * Number(newSupply.toString()),
        volume24h: { increment: monFloat },
      },
    });

    const tokenIdNumber = Number(tokenId);
    const holder = await this.prisma.holder.findUnique({
      where: {
        tokenId_address: {
          tokenId: tokenIdNumber,
          address: normalizedTrader,
        },
      },
    });

    if (Boolean(isBuy)) {
      const nextBalance = (
        (holder ? BigInt(holder.balance) : 0n) + BigInt(tokenAmount.toString())
      ).toString();
      await this.prisma.holder.upsert({
        where: {
          tokenId_address: {
            tokenId: tokenIdNumber,
            address: normalizedTrader,
          },
        },
        create: {
          tokenId: tokenIdNumber,
          address: normalizedTrader,
          balance: nextBalance,
        },
        update: { balance: nextBalance },
      });
    } else if (holder) {
      const nextBalance = BigInt(holder.balance) - BigInt(tokenAmount.toString());
      if (nextBalance <= 0n) {
        await this.prisma.holder.delete({
          where: {
            tokenId_address: {
              tokenId: tokenIdNumber,
              address: normalizedTrader,
            },
          },
        });
      } else {
        await this.prisma.holder.update({
          where: {
            tokenId_address: {
              tokenId: tokenIdNumber,
              address: normalizedTrader,
            },
          },
          data: { balance: nextBalance.toString() },
        });
      }
    }

    const totalHolders = await this.prisma.holder.count({
      where: { tokenId: tokenIdNumber },
    });
    await this.prisma.token.update({
      where: { id: tokenIdNumber },
      data: { totalHolders },
    });

    const token = await this.prisma.token.findUnique({
      where: { id: tokenIdNumber },
    });
    if (token && !token.firstBuyPrice && Boolean(isBuy)) {
      await this.prisma.token.update({
        where: { id: tokenIdNumber },
        data: { firstBuyPrice: newPrice.toString() },
      });
    }

    this.tokensGateway.emitTrade({
      tokenId: Number(tokenId),
      trader,
      isBuy: Boolean(isBuy),
      tokenAmount: tokenAmount.toString(),
      monAmount: ethers.formatEther(monAmount),
      newPrice: ethers.formatEther(newPrice),
      txHash,
    });

    this.logger.log(
      `Trade on #${tokenId}: ${Boolean(isBuy) ? 'BUY' : 'SELL'} ${ethers.formatEther(monAmount)} MON`,
    );
    await this.markSyncedBlock(blockNumber);
  }

  private async handleDeath(event: any) {
    const args = event?.args;
    if (!args) return;

    const { tokenId, poolRemaining, triggeredBy } = args;
    const blockNumber = this.getEventBlockNumber(event);
    if (blockNumber === null) {
      this.logger.warn(
        `Skipping death event for token #${Number(tokenId)} because blockNumber is missing`,
      );
      return;
    }

    await this.prisma.token.update({
      where: { id: Number(tokenId) },
      data: {
        dead: true,
        deathProcessed: true,
        poolBalance: '0',
      },
    });

    this.tokensGateway.emitDeath({
      tokenId: Number(tokenId),
      poolRemaining: ethers.formatEther(poolRemaining),
      triggeredBy,
    });

    this.logger.log(
      `Token #${tokenId} CLAC'D! Pool: ${ethers.formatEther(poolRemaining)} MON`,
    );
    await this.markSyncedBlock(blockNumber);
  }

  private async handleLottery(event: any) {
    const args = event?.args;
    if (!args) return;

    const { tokenId, winner, amount } = args;
    const txHash = this.getEventTxHash(event);
    const blockNumber = this.getEventBlockNumber(event);
    if (!txHash || blockNumber === null) {
      this.logger.warn(
        `Skipping lottery event for token #${Number(tokenId)} due to missing tx metadata`,
      );
      return;
    }

    const existingLottery = await this.prisma.lotteryWin.findFirst({
      where: {
        txHash,
        tokenId: Number(tokenId),
        winner: String(winner).toLowerCase(),
      },
    });
    if (existingLottery) return;

    await this.prisma.lotteryWin.create({
      data: {
        tokenId: Number(tokenId),
        winner: String(winner).toLowerCase(),
        amount: amount.toString(),
        txHash,
      },
    });

    this.tokensGateway.emitLotteryWin({
      tokenId: Number(tokenId),
      winner,
      amount: ethers.formatEther(amount),
    });

    this.logger.log(
      `Lottery win on #${tokenId}: ${winner} won ${ethers.formatEther(amount)} MON`,
    );
    await this.markSyncedBlock(blockNumber);
  }

  private async handleClaim(event: any) {
    const args = event?.args;
    if (!args) return;

    const { tokenId, holder, amount } = args;
    const txHash = this.getEventTxHash(event);
    const blockNumber = this.getEventBlockNumber(event);
    if (!txHash || blockNumber === null) {
      this.logger.warn(
        `Skipping claim event for token #${Number(tokenId)} due to missing tx metadata`,
      );
      return;
    }

    const existingClaim = await this.prisma.claim.findFirst({
      where: {
        txHash,
        tokenId: Number(tokenId),
        holder: String(holder).toLowerCase(),
      },
    });
    if (existingClaim) return;

    await this.prisma.claim.create({
      data: {
        tokenId: Number(tokenId),
        holder: String(holder).toLowerCase(),
        amount: amount.toString(),
        txHash,
      },
    });
    await this.markSyncedBlock(blockNumber);
  }

  private async markSyncedBlock(lastBlockNumber: number) {
    await this.prisma.syncState.upsert({
      where: { id: 1 },
      create: { id: 1, lastBlockNumber },
      update: { lastBlockNumber },
    });
  }
}

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ethers } from 'ethers';
import { PrismaService } from '../prisma/prisma.service';
import { activeConfig } from '../config/monad.config';
import { CLAC_FACTORY_V2_ABI, CLAC_TOKEN_V2_ABI } from './contract-v2.abi';
import { TokensV2Gateway } from './tokens-v2.gateway';

interface TokenRuntime {
  address: string;
  contract: ethers.Contract;
  attached: boolean;
}

@Injectable()
export class BlockchainV2Service implements OnModuleInit {
  private readonly logger = new Logger(BlockchainV2Service.name);

  private provider: ethers.Provider | null = null;
  private factory: ethers.Contract | null = null;
  private isWs = false;

  private readonly tokens = new Map<string, TokenRuntime>();

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
    private readonly gateway: TokensV2Gateway,
  ) {}

  async onModuleInit() {
    if (!activeConfig.factoryAddress) {
      this.logger.warn(
        'MONAD_FACTORY_ADDRESS empty — listener disabled.',
      );
      return;
    }

    await this.resetSyncStateIfChainChanged();
    await this.connect();
    if (!this.factory || !this.provider) return;

    // Realtime subscriptions; backfill runs in background to not block port bind
    this.subscribeFactory();
    setTimeout(() => {
      this.bootstrap().catch((err) =>
        this.logger.error(
          `v2 bootstrap failed: ${err instanceof Error ? err.message : err}`,
        ),
      );
    }, 0);
  }

  // ─────────────────────────────────────────
  //                 SETUP
  // ─────────────────────────────────────────

  private async connect() {
    try {
      this.provider = new ethers.WebSocketProvider(activeConfig.wsUrl);
      this.factory = new ethers.Contract(
        activeConfig.factoryAddress,
        CLAC_FACTORY_V2_ABI,
        this.provider,
      );
      this.isWs = true;
      this.logger.log(`v2 listener connected (WS) at ${activeConfig.wsUrl}`);
    } catch (err) {
      this.logger.warn(
        `v2 WS failed, falling back to HTTP polling: ${err instanceof Error ? err.message : err}`,
      );
      this.provider = new ethers.JsonRpcProvider(activeConfig.rpcUrl);
      this.factory = new ethers.Contract(
        activeConfig.factoryAddress,
        CLAC_FACTORY_V2_ABI,
        this.provider,
      );
      this.isWs = false;
    }
  }

  private async resetSyncStateIfChainChanged() {
    const sync = await this.prisma.syncStateV2.findUnique({ where: { id: 1 } });
    const targetChain = activeConfig.chainId;
    const targetFactory = activeConfig.factoryAddress.toLowerCase();
    if (
      !sync ||
      sync.chainId !== targetChain ||
      (sync.factoryAddress &&
        sync.factoryAddress.toLowerCase() !== targetFactory)
    ) {
      this.logger.warn(
        `v2 chain/factory changed. Wiping v2 tables and resetting sync state.`,
      );
      await this.prisma.tradeV2.deleteMany({});
      await this.prisma.holderV2.deleteMany({});
      await this.prisma.lotteryWinV2.deleteMany({});
      await this.prisma.claimV2.deleteMany({});
      await this.prisma.tokenV2.deleteMany({});
      await this.prisma.syncStateV2.upsert({
        where: { id: 1 },
        create: {
          id: 1,
          lastBlockNumber: 0,
          chainId: targetChain,
          factoryAddress: targetFactory,
        },
        update: {
          lastBlockNumber: 0,
          chainId: targetChain,
          factoryAddress: targetFactory,
        },
      });
    }
  }

  // ─────────────────────────────────────────
  //               FACTORY
  // ─────────────────────────────────────────

  private subscribeFactory() {
    if (!this.factory) return;

    this.factory.on('TokenCreated', async (...args: any[]) => {
      const event = args[args.length - 1];
      try {
        await this.handleTokenCreated(event, args);
      } catch (err) {
        this.logger.error(
          `TokenCreated handler error: ${err instanceof Error ? err.message : err}`,
        );
      }
    });
  }

  private async handleTokenCreated(_event: any, args: any[]) {
    const [
      tokenAddress,
      creator,
      _index,
      name,
      symbol,
      imageURI,
      duration,
      k,
    ] = args;
    const tokenAddr = String(tokenAddress).toLowerCase();
    const factoryAddr = activeConfig.factoryAddress.toLowerCase();

    const exists = await this.prisma.tokenV2.findUnique({
      where: { address: tokenAddr },
    });
    if (exists) {
      // already indexed by backfill or another call
      this.attachTokenListener(tokenAddr);
      return;
    }

    const block = await this.provider!.getBlock(_event.log?.blockNumber ?? _event.blockNumber);
    const blockTs = block?.timestamp ?? Math.floor(Date.now() / 1000);
    const dur = Number(duration);
    const slug = `v2-${tokenAddr.slice(2, 14)}`;

    await this.prisma.tokenV2.create({
      data: {
        address: tokenAddr,
        factoryAddress: factoryAddr,
        creator: String(creator).toLowerCase(),
        name: String(name),
        symbol: String(symbol),
        imageURI: String(imageURI),
        k: k.toString(),
        duration: dur,
        createdAt: blockTs,
        deathTime: blockTs + dur,
        slug,
      },
    });

    this.attachTokenListener(tokenAddr);
    this.gateway.emitTokenCreated(tokenAddr);

    this.logger.log(`v2 token registered: ${tokenAddr} (${name})`);
  }

  // ─────────────────────────────────────────
  //              PER-TOKEN
  // ─────────────────────────────────────────

  private attachTokenListener(address: string) {
    if (!this.provider) return;
    const lower = address.toLowerCase();
    if (this.tokens.has(lower) && this.tokens.get(lower)!.attached) return;

    const contract = new ethers.Contract(
      lower,
      CLAC_TOKEN_V2_ABI,
      this.provider,
    );

    contract.on('Trade', async (...args: any[]) => {
      try {
        await this.handleTrade(lower, args);
      } catch (err) {
        this.logger.error(
          `Trade handler error for ${lower}: ${err instanceof Error ? err.message : err}`,
        );
      }
    });

    contract.on('DeathRequested', async (...args: any[]) => {
      try {
        await this.handleDeathRequested(lower, args);
      } catch (err) {
        this.logger.error(
          `DeathRequested handler error for ${lower}: ${err instanceof Error ? err.message : err}`,
        );
      }
    });

    contract.on('DeathFinalized', async (...args: any[]) => {
      try {
        await this.handleDeathFinalized(lower, args);
      } catch (err) {
        this.logger.error(
          `DeathFinalized handler error for ${lower}: ${err instanceof Error ? err.message : err}`,
        );
      }
    });

    contract.on('Claimed', async (...args: any[]) => {
      try {
        await this.handleClaimed(lower, args);
      } catch (err) {
        this.logger.error(
          `Claimed handler error for ${lower}: ${err instanceof Error ? err.message : err}`,
        );
      }
    });

    contract.on('LotteryWeightChanged', async (...args: any[]) => {
      try {
        await this.handleLotteryWeightChanged(lower, args);
      } catch (err) {
        this.logger.error(
          `LotteryWeightChanged error for ${lower}: ${err instanceof Error ? err.message : err}`,
        );
      }
    });

    this.tokens.set(lower, { address: lower, contract, attached: true });
  }

  // ─────────────────────────────────────────
  //              EVENT HANDLERS
  // ─────────────────────────────────────────

  private async handleTrade(tokenAddress: string, args: any[]) {
    const event = args[args.length - 1];
    const [
      trader,
      isBuy,
      tokenAmount,
      monAmount,
      protocolFee,
      creatorFee,
      newSupply,
      newPrice,
    ] = args;
    const txHash = this.getTxHash(event);
    const logIndex = this.getLogIndex(event);
    const blockNumber = this.getBlockNumber(event);
    if (!txHash || logIndex == null) return;

    const traderAddr = String(trader).toLowerCase();

    // Idempotent insert
    await this.prisma.tradeV2.upsert({
      where: { txHash_logIndex: { txHash, logIndex } },
      create: {
        tokenAddress,
        trader: traderAddr,
        isBuy: Boolean(isBuy),
        tokenAmount: tokenAmount.toString(),
        monAmount: monAmount.toString(),
        protocolFee: protocolFee.toString(),
        creatorFee: creatorFee.toString(),
        newSupply: newSupply.toString(),
        newPrice: newPrice.toString(),
        txHash,
        logIndex,
        blockNumber: blockNumber ?? 0,
      },
      update: {},
    });

    // Update holder balance via on-chain read (truth source)
    await this.refreshHolderState(tokenAddress, traderAddr);

    // Update token aggregates from chain
    await this.refreshTokenAggregates(tokenAddress, newSupply, newPrice);

    this.gateway.emitTrade(tokenAddress, {
      trader: traderAddr,
      isBuy: Boolean(isBuy),
      tokenAmount: tokenAmount.toString(),
      monAmount: monAmount.toString(),
      newSupply: newSupply.toString(),
      newPrice: newPrice.toString(),
      txHash,
    });
  }

  private async handleDeathRequested(tokenAddress: string, args: any[]) {
    const event = args[args.length - 1];
    const [requestedBy, sequenceNumber, _lotteryFeePaid] = args;
    const blockNumber = this.getBlockNumber(event);
    const block = blockNumber
      ? await this.provider!.getBlock(blockNumber)
      : null;
    await this.prisma.tokenV2.update({
      where: { address: tokenAddress },
      data: {
        deathRequested: true,
        deathRequestedBy: String(requestedBy).toLowerCase(),
        deathRequestedAt: block?.timestamp ?? Math.floor(Date.now() / 1000),
      },
    });
    this.gateway.emitDeathRequested(tokenAddress, {
      requestedBy: String(requestedBy).toLowerCase(),
      sequenceNumber: String(sequenceNumber),
    });
  }

  private async handleDeathFinalized(tokenAddress: string, args: any[]) {
    const event = args[args.length - 1];
    const [proRataPool, lotteryPool, winners] = args;
    const blockNumber = this.getBlockNumber(event);
    const block = blockNumber
      ? await this.provider!.getBlock(blockNumber)
      : null;

    const winnersArr = Array.from(winners as any[]).map((w) =>
      String(w).toLowerCase(),
    );

    await this.prisma.tokenV2.update({
      where: { address: tokenAddress },
      data: {
        deathFinalized: true,
        deathFinalizedAt: block?.timestamp ?? Math.floor(Date.now() / 1000),
        proRataPool: proRataPool.toString(),
        lotteryPool: lotteryPool.toString(),
        lotteryWinners: winnersArr as any,
      },
    });

    // Record lottery wins (3 entries)
    const txHash = this.getTxHash(event) ?? '';
    for (const winner of winnersArr) {
      if (winner === '0x0000000000000000000000000000000000000000') continue;
      await this.prisma.lotteryWinV2
        .create({
          data: {
            tokenAddress,
            winner,
            amount: lotteryPool.toString(),
            txHash,
          },
        })
        .catch(() => {});
    }

    this.gateway.emitDeathFinalized(tokenAddress, {
      proRataPool: proRataPool.toString(),
      lotteryPool: lotteryPool.toString(),
      winners: winnersArr,
    });
  }

  private async handleClaimed(tokenAddress: string, args: any[]) {
    const event = args[args.length - 1];
    const [holder, proRataAmount, lotteryAmount] = args;
    const txHash = this.getTxHash(event);
    if (!txHash) return;
    await this.prisma.claimV2.upsert({
      where: { txHash },
      create: {
        tokenAddress,
        holder: String(holder).toLowerCase(),
        proRataAmount: proRataAmount.toString(),
        lotteryAmount: lotteryAmount.toString(),
        txHash,
      },
      update: {},
    });
  }

  private async handleLotteryWeightChanged(tokenAddress: string, args: any[]) {
    const [holder, newWeight, newTotalWeight] = args;
    const holderAddr = String(holder).toLowerCase();
    await this.prisma.holderV2.upsert({
      where: { tokenAddress_address: { tokenAddress, address: holderAddr } },
      create: {
        tokenAddress,
        address: holderAddr,
        balance: '0', // will be refreshed by Trade handler
        lotteryWeight: newWeight.toString(),
      },
      update: { lotteryWeight: newWeight.toString() },
    });
    await this.prisma.tokenV2.update({
      where: { address: tokenAddress },
      data: { totalLotteryWeight: newTotalWeight.toString() },
    });
  }

  // ─────────────────────────────────────────
  //              REFRESHERS
  // ─────────────────────────────────────────

  private async refreshHolderState(tokenAddress: string, holderAddress: string) {
    if (!this.provider) return;
    try {
      const tokenContract = new ethers.Contract(
        tokenAddress,
        CLAC_TOKEN_V2_ABI,
        this.provider,
      );
      const balance: bigint = await tokenContract.balances(holderAddress);
      await this.prisma.holderV2.upsert({
        where: {
          tokenAddress_address: { tokenAddress, address: holderAddress },
        },
        create: {
          tokenAddress,
          address: holderAddress,
          balance: balance.toString(),
        },
        update: { balance: balance.toString() },
      });

      // If balance is 0, optionally remove? Keep for history.
      const totalHolders: bigint = await tokenContract.totalHolders();
      await this.prisma.tokenV2.update({
        where: { address: tokenAddress },
        data: { totalHolders: Number(totalHolders) },
      });
    } catch (err) {
      this.logger.warn(
        `refreshHolderState ${tokenAddress}/${holderAddress}: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  private async refreshTokenAggregates(
    tokenAddress: string,
    newSupply: bigint,
    newPrice: bigint,
  ) {
    try {
      // Update virtualSupply, currentPrice, and refresh poolBalance/marketCap from chain
      const tokenContract = new ethers.Contract(
        tokenAddress,
        CLAC_TOKEN_V2_ABI,
        this.provider!,
      );
      const poolBalance: bigint = await tokenContract.poolBalance();

      await this.prisma.tokenV2.update({
        where: { address: tokenAddress },
        data: {
          virtualSupply: newSupply.toString(),
          currentPrice: newPrice.toString(),
          poolBalance: poolBalance.toString(),
        },
      });
    } catch (err) {
      this.logger.warn(
        `refreshTokenAggregates ${tokenAddress}: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  // ─────────────────────────────────────────
  //              BOOTSTRAP / BACKFILL
  // ─────────────────────────────────────────

  private async bootstrap() {
    if (!this.factory) return;
    const known: string[] = (await this.factory.getAllTokens()).map(
      (a: string) => a.toLowerCase(),
    );
    this.logger.log(`v2 bootstrap: ${known.length} tokens registered on-chain`);

    for (const addr of known) {
      // Ensure DB row exists for each
      const row = await this.prisma.tokenV2.findUnique({
        where: { address: addr },
      });
      if (!row) {
        await this.indexTokenFromChain(addr);
      }
      this.attachTokenListener(addr);
    }

    await this.backfillEvents();
  }

  private async indexTokenFromChain(address: string) {
    const c = new ethers.Contract(address, CLAC_TOKEN_V2_ABI, this.provider!);
    const [
      name,
      symbol,
      imageURI,
      creator,
      k,
      createdAt,
      deathTime,
      virtualSupply,
      poolBalance,
    ] = await Promise.all([
      c.name(),
      c.symbol(),
      c.imageURI(),
      c.creator(),
      c.k(),
      c.createdAt(),
      c.deathTime(),
      c.virtualSupply(),
      c.poolBalance(),
    ]);
    const factoryAddr = activeConfig.factoryAddress.toLowerCase();
    const slug = `v2-${address.toLowerCase().slice(2, 14)}`;

    await this.prisma.tokenV2.upsert({
      where: { address: address.toLowerCase() },
      create: {
        address: address.toLowerCase(),
        factoryAddress: factoryAddr,
        creator: String(creator).toLowerCase(),
        name: String(name),
        symbol: String(symbol),
        imageURI: String(imageURI),
        k: k.toString(),
        duration: Number(deathTime) - Number(createdAt),
        createdAt: Number(createdAt),
        deathTime: Number(deathTime),
        virtualSupply: virtualSupply.toString(),
        poolBalance: poolBalance.toString(),
        slug,
      },
      update: {
        virtualSupply: virtualSupply.toString(),
        poolBalance: poolBalance.toString(),
      },
    });
  }

  private async backfillEvents() {
    if (!this.provider) return;

    const head = await this.provider.getBlockNumber();
    const safeHead = Math.max(0, head - this.finalityBlocks);

    const sync = await this.prisma.syncStateV2.findUnique({ where: { id: 1 } });
    let from =
      sync && sync.lastBlockNumber > 0
        ? Math.max(0, sync.lastBlockNumber - this.replayBlocks)
        : Math.max(0, safeHead - this.initialBackfillBlocks);

    if (from > safeHead) return;

    this.logger.log(
      `v2 backfill: blocks ${from} → ${safeHead} (range ${safeHead - from})`,
    );

    // Pull factory.TokenCreated logs first (so we know all tokens)
    await this.scanFactoryRange(from, safeHead);

    // Then pull each token's events
    const allTokens = await this.prisma.tokenV2.findMany({
      select: { address: true },
    });
    for (const t of allTokens) {
      await this.scanTokenRange(t.address, from, safeHead);
    }

    await this.prisma.syncStateV2.upsert({
      where: { id: 1 },
      create: {
        id: 1,
        lastBlockNumber: safeHead,
        chainId: activeConfig.chainId,
        factoryAddress: activeConfig.factoryAddress.toLowerCase(),
      },
      update: { lastBlockNumber: safeHead },
    });
    this.logger.log(`v2 backfill complete up to ${safeHead}`);
  }

  private async scanFactoryRange(from: number, to: number) {
    if (!this.factory) return;
    const filter = this.factory.filters.TokenCreated();
    await this.iterateRange(from, to, async (chunkFrom, chunkTo) => {
      const events: any[] = await this.factory!.queryFilter(
        filter,
        chunkFrom,
        chunkTo,
      );
      for (const ev of events) {
        try {
          await this.handleTokenCreated(ev, [...ev.args!, ev]);
        } catch (err) {
          this.logger.warn(
            `factory backfill: ${err instanceof Error ? err.message : err}`,
          );
        }
      }
    });
  }

  private async scanTokenRange(tokenAddress: string, from: number, to: number) {
    if (!this.provider) return;
    const c = new ethers.Contract(
      tokenAddress,
      CLAC_TOKEN_V2_ABI,
      this.provider,
    );

    await this.iterateRange(from, to, async (chunkFrom, chunkTo) => {
      // Pull all per-token events in one queryFilter call per type
      const eventTypes = [
        'Trade',
        'DeathRequested',
        'DeathFinalized',
        'Claimed',
        'LotteryWeightChanged',
      ];
      for (const ev of eventTypes) {
        try {
          const logs: any[] = await c.queryFilter(
            c.filters[ev]() as any,
            chunkFrom,
            chunkTo,
          );
          for (const log of logs) {
            const args = [...log.args!, log];
            try {
              if (ev === 'Trade') await this.handleTrade(tokenAddress, args);
              else if (ev === 'DeathRequested')
                await this.handleDeathRequested(tokenAddress, args);
              else if (ev === 'DeathFinalized')
                await this.handleDeathFinalized(tokenAddress, args);
              else if (ev === 'Claimed')
                await this.handleClaimed(tokenAddress, args);
              else if (ev === 'LotteryWeightChanged')
                await this.handleLotteryWeightChanged(tokenAddress, args);
            } catch (err) {
              this.logger.warn(
                `backfill ${ev} ${tokenAddress}: ${err instanceof Error ? err.message : err}`,
              );
            }
          }
        } catch (err) {
          this.logger.warn(
            `queryFilter ${ev} ${tokenAddress}: ${err instanceof Error ? err.message : err}`,
          );
        }
      }
    });
  }

  private async iterateRange(
    from: number,
    to: number,
    fn: (a: number, b: number) => Promise<void>,
  ) {
    let cursor = from;
    while (cursor <= to) {
      const end = Math.min(to, cursor + this.maxLogRange - 1);
      try {
        await fn(cursor, end);
      } catch (err) {
        this.logger.warn(
          `range fetch ${cursor}-${end} failed: ${err instanceof Error ? err.message : err}`,
        );
      }
      cursor = end + 1;
    }
  }

  // ─────────────────────────────────────────
  //              HELPERS
  // ─────────────────────────────────────────

  private getTxHash(event: any): string | null {
    return event?.log?.transactionHash ?? event?.transactionHash ?? null;
  }

  private getLogIndex(event: any): number | null {
    const i = event?.log?.index ?? event?.index ?? event?.log?.logIndex;
    return typeof i === 'number' ? i : null;
  }

  private getBlockNumber(event: any): number | null {
    return event?.log?.blockNumber ?? event?.blockNumber ?? null;
  }
}

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ethers } from 'ethers';
import { PrismaService } from '../prisma/prisma.service';
import { activeConfig } from '../config/monad.config';
import { CLAC_FACTORY_ABI } from './contract.abi';
import { TokensGateway } from '../tokens/tokens.gateway';

@Injectable()
export class BlockchainService implements OnModuleInit {
  private readonly logger = new Logger(BlockchainService.name);
  private provider: ethers.WebSocketProvider | null = null;
  private contract: ethers.Contract | null = null;

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
    await this.syncPastEvents();
    this.listenToEvents();
  }

  private async connect() {
    this.provider = new ethers.WebSocketProvider(activeConfig.wsUrl);
    this.contract = new ethers.Contract(
      activeConfig.contractAddress,
      CLAC_FACTORY_ABI,
      this.provider,
    );
    this.logger.log(`Connected to Monad at ${activeConfig.wsUrl}`);
  }

  private getContract() {
    if (!this.contract || !this.provider) {
      throw new Error('Blockchain provider not initialized');
    }
    return { contract: this.contract, provider: this.provider };
  }

  private async syncPastEvents() {
    const { contract, provider } = this.getContract();
    const syncState = await this.prisma.syncState.findFirst();
    const fromBlock = syncState?.lastBlockNumber || 0;
    const currentBlock = await provider.getBlockNumber();

    this.logger.log(`Syncing from block ${fromBlock} to ${currentBlock}`);

    const chunkSize = 1000;
    for (let start = fromBlock; start < currentBlock; start += chunkSize) {
      const end = Math.min(start + chunkSize, currentBlock);

      const tokenCreatedEvents = await contract.queryFilter(
        contract.filters.TokenCreated(),
        start,
        end,
      );
      const tradeEvents = await contract.queryFilter(
        contract.filters.Trade(),
        start,
        end,
      );
      const deathEvents = await contract.queryFilter(
        contract.filters.TokenClacced(),
        start,
        end,
      );
      const lotteryEvents = await contract.queryFilter(
        contract.filters.LotteryWin(),
        start,
        end,
      );
      const claimEvents = await contract.queryFilter(
        contract.filters.Claimed(),
        start,
        end,
      );

      for (const event of tokenCreatedEvents) await this.handleTokenCreated(event);
      for (const event of tradeEvents) await this.handleTrade(event);
      for (const event of deathEvents) await this.handleDeath(event);
      for (const event of lotteryEvents) await this.handleLottery(event);
      for (const event of claimEvents) await this.handleClaim(event);
    }

    await this.prisma.syncState.upsert({
      where: { id: 1 },
      create: { id: 1, lastBlockNumber: currentBlock },
      update: { lastBlockNumber: currentBlock },
    });

    this.logger.log(`Sync complete at block ${currentBlock}`);
  }

  private listenToEvents() {
    const { contract } = this.getContract();

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

    const existing = await this.prisma.trade.findUnique({
      where: { txHash: event.transactionHash },
    });
    if (existing) return;

    await this.prisma.trade.create({
      data: {
        tokenId: Number(tokenId),
        trader: String(trader).toLowerCase(),
        isBuy: Boolean(isBuy),
        tokenAmount: tokenAmount.toString(),
        monAmount: monAmount.toString(),
        protocolFee: protocolFee.toString(),
        creatorFee: creatorFee.toString(),
        newSupply: newSupply.toString(),
        newPrice: newPrice.toString(),
        txHash: event.transactionHash,
        blockNumber: Number(event.blockNumber),
      },
    });

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

    if (Boolean(isBuy)) {
      const holder = await this.prisma.holder.findUnique({
        where: {
          tokenId_address: {
            tokenId: Number(tokenId),
            address: String(trader).toLowerCase(),
          },
        },
      });

      const nextBalance = holder
        ? (BigInt(holder.balance) + BigInt(tokenAmount.toString())).toString()
        : tokenAmount.toString();

      await this.prisma.holder.upsert({
        where: {
          tokenId_address: {
            tokenId: Number(tokenId),
            address: String(trader).toLowerCase(),
          },
        },
        create: {
          tokenId: Number(tokenId),
          address: String(trader).toLowerCase(),
          balance: nextBalance,
        },
        update: { balance: nextBalance },
      });
    }

    const token = await this.prisma.token.findUnique({
      where: { id: Number(tokenId) },
    });
    if (token && !token.firstBuyPrice && Boolean(isBuy)) {
      await this.prisma.token.update({
        where: { id: Number(tokenId) },
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
      txHash: event.transactionHash,
    });

    this.logger.log(
      `Trade on #${tokenId}: ${Boolean(isBuy) ? 'BUY' : 'SELL'} ${ethers.formatEther(monAmount)} MON`,
    );
  }

  private async handleDeath(event: any) {
    const args = event?.args;
    if (!args) return;

    const { tokenId, poolRemaining, triggeredBy } = args;

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
  }

  private async handleLottery(event: any) {
    const args = event?.args;
    if (!args) return;

    const { tokenId, winner, amount } = args;

    await this.prisma.lotteryWin.create({
      data: {
        tokenId: Number(tokenId),
        winner: String(winner).toLowerCase(),
        amount: amount.toString(),
        txHash: event.transactionHash,
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
  }

  private async handleClaim(event: any) {
    const args = event?.args;
    if (!args) return;

    const { tokenId, holder, amount } = args;

    await this.prisma.claim.create({
      data: {
        tokenId: Number(tokenId),
        holder: String(holder).toLowerCase(),
        amount: amount.toString(),
        txHash: event.transactionHash,
      },
    });
  }
}

import { formatEther } from 'viem'
import type { Token, Trade, LiveEvent } from '@/lib/mock-data'
import type { BackendToken, BackendTrade } from './types'

export function toUiToken(token: BackendToken): Token {
  const price = Number(formatEther(BigInt(token.currentPrice || '0')))
  const firstBuy = token.firstBuyPrice ? Number(formatEther(BigInt(token.firstBuyPrice))) : price
  const multiplier = firstBuy > 0 ? price / firstBuy : 0

  return {
    id: String(token.id),
    name: token.name,
    symbol: token.symbol,
    image: token.imageURI || '/tokens/pepe-king.jpg',
    creator: token.creator,
    createdAt: new Date(token.createdAt * 1000),
    durationSeconds: token.duration,
    marketCap: token.marketCap || 0,
    price,
    priceChange24h: token.change24h || 0,
    volume24h: token.volume24h || 0,
    holders: token.totalHolders || 0,
    txCount: 0,
    buys: 0,
    sells: 0,
    buyVolume: 0,
    sellVolume: 0,
    bondingProgress: 0,
    firstBuyerMultiplier: multiplier,
    claimableMon: 0,
    dead: token.dead,
    description: `${token.symbol} on clac.fun`,
  }
}

export function toUiTrade(trade: BackendTrade): Trade {
  return {
    id: String(trade.id),
    tokenId: String(trade.tokenId),
    tokenSymbol: trade.token?.symbol || 'CLAC',
    tokenImage: '/tokens/pepe-king.jpg',
    type: trade.isBuy ? 'buy' : 'sell',
    account: trade.trader,
    amount: Number(formatEther(BigInt(trade.monAmount || '0'))),
    value: Number(formatEther(BigInt(trade.monAmount || '0'))),
    tokenAmount: Number(formatEther(BigInt(trade.tokenAmount || '0'))),
    time: new Date(trade.timestamp),
    txHash: trade.txHash,
  }
}

export function tradeToLiveEvent(trade: Trade): LiveEvent {
  return {
    id: trade.id,
    type: trade.type,
    account: trade.account,
    amount: trade.amount,
    tokenSymbol: trade.tokenSymbol,
    tokenImage: trade.tokenImage,
    time: trade.time,
  }
}

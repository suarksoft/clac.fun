import { formatEther } from 'viem'
import type { Token, Trade, LiveEvent } from '@/lib/ui-types'
import type { BackendHolder, BackendToken, BackendTrade } from './types'
import { publicEnv } from '@/lib/env'

const FALLBACK_TOKEN_IMAGE = '/tokens/pepe-king.jpg'

export function resolveTokenImageUrl(imageURI?: string): string {
  const raw = (imageURI || '').trim()
  if (!raw) return FALLBACK_TOKEN_IMAGE

  if (raw.startsWith('http://') || raw.startsWith('https://')) {
    // Absolute URL values stored on-chain should be respected as-is.
    return raw
  }

  if (raw.startsWith('data:') || raw.startsWith('blob:')) {
    return raw
  }

  if (raw.startsWith('/')) {
    return new URL(raw, publicEnv.NEXT_PUBLIC_BACKEND_URL).toString()
  }

  if (raw.startsWith('ipfs://')) {
    return `https://ipfs.io/ipfs/${raw.replace('ipfs://', '')}`
  }

  return raw
}

export function toUiToken(token: BackendToken): Token {
  const price = Number(formatEther(BigInt(token.currentPrice || '0')))
  const virtualSupply = Number(formatEther(BigInt(token.virtualSupply || '0')))
  const poolBalanceMon = Number(formatEther(BigInt(token.poolBalance || '0')))
  const marketCap = virtualSupply * price
  const fdv = 1_000_000_000 * price
  const firstBuy = token.firstBuyPrice ? Number(formatEther(BigInt(token.firstBuyPrice))) : price
  const multiplier = firstBuy > 0 ? price / firstBuy : 0

  return {
    id: String(token.id),
    slug: token.slug ?? undefined,
    name: token.name,
    symbol: token.symbol,
    image: resolveTokenImageUrl(token.imageURI),
    creator: token.creator,
    createdAt: new Date(token.createdAt * 1000),
    durationSeconds: token.duration,
    marketCap,
    fdv,
    price,
    virtualSupply,
    poolBalanceMon,
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
    tokenImage: resolveTokenImageUrl(trade.token?.imageURI),
    type: trade.isBuy ? 'buy' : 'sell',
    account: trade.trader,
    amount: Number(formatEther(BigInt(trade.monAmount || '0'))),
    value: Number(formatEther(BigInt(trade.monAmount || '0'))),
    tokenAmount: Number(formatEther(BigInt(trade.tokenAmount || '0'))),
    time: new Date(trade.timestamp),
    txHash: trade.txHash,
  }
}

export function holderBalanceToNumber(balance: string): number {
  try {
    return Number(formatEther(BigInt(balance || '0')))
  } catch {
    return 0
  }
}

export function toHolderShare(holders: BackendHolder[]) {
  const total = holders.reduce((sum, holder) => sum + holderBalanceToNumber(holder.balance), 0)

  return holders.map((holder) => {
    const balance = holderBalanceToNumber(holder.balance)
    const percentage = total > 0 ? (balance / total) * 100 : 0
    return {
      address: holder.address,
      percentage,
      balance,
    }
  })
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

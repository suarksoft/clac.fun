import { formatEther } from 'viem'
import type { Trade } from '@/lib/ui-types'
import type { BackendTokenV2, BackendTradeV2 } from './types-v2'
import { resolveTokenImageUrl } from './mappers'

export interface TokenV2Ui {
  address: string
  name: string
  symbol: string
  image: string
  creator: string
  createdAt: Date
  deathTime: Date
  durationSeconds: number
  price: number
  virtualSupply: number
  poolBalanceMon: number
  marketCap: number
  volume24h: number
  priceChange24h: number
  holders: number
  dead: boolean
  deathRequested: boolean
  deathFinalized: boolean
  proRataPool: number
  lotteryPool: number
  lotteryWinners: string[]
  slug?: string
  description?: string
  website?: string
  twitter?: string
  telegram?: string
}

export function toUiTokenV2(token: BackendTokenV2): TokenV2Ui {
  const price = Number(formatEther(BigInt(token.currentPrice || '0')))
  const virtualSupply = Number(formatEther(BigInt(token.virtualSupply || '0')))
  const poolBalanceMon = Number(formatEther(BigInt(token.poolBalance || '0')))

  return {
    address: token.address,
    name: token.name,
    symbol: token.symbol,
    image: resolveTokenImageUrl(token.imageURI),
    creator: token.creator,
    createdAt: new Date(token.createdAt * 1000),
    deathTime: new Date(token.deathTime * 1000),
    durationSeconds: token.duration,
    price,
    virtualSupply,
    poolBalanceMon,
    marketCap: token.marketCap || virtualSupply * price,
    volume24h: token.volume24h || 0,
    priceChange24h: token.change24h || 0,
    holders: token.totalHolders || 0,
    dead: token.deathFinalized,
    deathRequested: token.deathRequested,
    deathFinalized: token.deathFinalized,
    proRataPool: Number(formatEther(BigInt(token.proRataPool || '0'))),
    lotteryPool: Number(formatEther(BigInt(token.lotteryPool || '0'))),
    lotteryWinners: token.lotteryWinners ?? [],
    slug: token.slug ?? undefined,
    description: token.description ?? undefined,
    website: token.website ?? undefined,
    twitter: token.twitter ?? undefined,
    telegram: token.telegram ?? undefined,
  }
}

export function toUiTradeV2(trade: BackendTradeV2, tokenSymbol: string, tokenImage: string): Trade {
  return {
    id: String(trade.id),
    tokenId: trade.tokenAddress,
    tokenSymbol,
    tokenImage,
    type: trade.isBuy ? 'buy' : 'sell',
    account: trade.trader,
    amount: Number(formatEther(BigInt(trade.monAmount || '0'))),
    value: Number(formatEther(BigInt(trade.monAmount || '0'))),
    tokenAmount: Number(formatEther(BigInt(trade.tokenAmount || '0'))),
    time: new Date(trade.timestamp),
    txHash: trade.txHash,
  }
}

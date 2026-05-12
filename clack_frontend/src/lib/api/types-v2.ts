/** Mirrors Prisma TokenV2 model */
export interface BackendTokenV2 {
  address: string
  factoryAddress: string
  creator: string
  name: string
  symbol: string
  imageURI: string
  k: string
  duration: number
  createdAt: number
  deathTime: number
  virtualSupply: string
  poolBalance: string
  totalHolders: number
  totalLotteryWeight: string
  marketCap: number
  currentPrice: string
  volume24h: number
  change24h: number
  firstBuyPrice?: string | null
  deathRequested: boolean
  deathFinalized: boolean
  deathRequestedBy?: string | null
  deathRequestedAt?: number | null
  deathFinalizedAt?: number | null
  proRataPool?: string | null
  lotteryPool?: string | null
  lotteryShare?: string | null
  totalSupplySnapshot?: string | null
  lotteryWinners?: string[] | null
  swept: boolean
  slug?: string | null
  description?: string | null
  website?: string | null
  twitter?: string | null
  telegram?: string | null
}

/** Mirrors Prisma TradeV2 model */
export interface BackendTradeV2 {
  id: number
  tokenAddress: string
  trader: string
  isBuy: boolean
  tokenAmount: string
  monAmount: string
  protocolFee: string
  creatorFee: string
  newSupply: string
  newPrice: string
  txHash: string
  logIndex: number
  blockNumber: number
  timestamp: string
}

/** Mirrors Prisma HolderV2 model */
export interface BackendHolderV2 {
  id: number
  tokenAddress: string
  address: string
  balance: string
  lotteryWeight: string
}

/** Mirrors Prisma LotteryWinV2 model */
export interface BackendLotteryWinV2 {
  id: number
  tokenAddress: string
  winner: string
  amount: string
  txHash: string
  timestamp: string
}

/** TradeV2 with embedded token info (returned by /v2/trades/recent) */
export interface BackendRecentTradeV2 extends BackendTradeV2 {
  token: { symbol: string; imageURI: string; name: string }
}

/** Mirrors Prisma ClaimV2 model */
export interface BackendClaimV2 {
  id: number
  tokenAddress: string
  holder: string
  proRataAmount: string
  lotteryAmount: string
  txHash: string
  timestamp: string
}

/** V2 socket trade event */
export interface SocketTradeV2Event {
  tokenAddress: string
  trader: string
  isBuy: boolean
  tokenAmount: string
  monAmount: string
  newPrice: string
  txHash: string
}

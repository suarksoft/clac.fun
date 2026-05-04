export interface BackendToken {
  id: number
  creator: string
  name: string
  symbol: string
  imageURI: string
  virtualSupply: string
  poolBalance: string
  createdAt: number
  duration: number
  dead: boolean
  totalHolders: number
  marketCap: number
  currentPrice: string
  volume24h: number
  change24h: number
  firstBuyPrice?: string | null
  slug?: string | null
}

export interface BackendTrade {
  id: number
  tokenId: number
  trader: string
  isBuy: boolean
  tokenAmount: string
  monAmount: string
  txHash: string
  timestamp: string
  token?: {
    id?: number
    name: string
    symbol: string
    imageURI?: string
  }
}

export interface BackendHolder {
  id: number
  tokenId: number
  address: string
  balance: string
}

export interface BackendPortfolio {
  holdings: Array<{
    id: number
    tokenId: number
    address: string
    balance: string
    token: BackendToken
  }>
  trades: BackendTrade[]
  claims: Array<{
    id: number
    tokenId: number
    holder: string
    amount: string
    txHash: string
    timestamp: string
  }>
  lotteryWins: Array<{
    id: number
    tokenId: number
    winner: string
    amount: string
    txHash: string
    timestamp: string
  }>
}

export interface SocketTradeEvent {
  tokenId: number
  trader: string
  isBuy: boolean
  tokenAmount: string
  monAmount: string
  newPrice: string
  txHash: string
}

export interface Token {
  id: string
  name: string
  symbol: string
  image: string
  creator: string
  createdAt: Date
  durationSeconds: number
  marketCap: number
  price: number
  priceChange24h: number
  volume24h: number
  holders: number
  txCount: number
  buys: number
  sells: number
  buyVolume: number
  sellVolume: number
  bondingProgress: number
  firstBuyerMultiplier: number
  claimableMon: number
  dead?: boolean
  description: string
}

export interface Trade {
  id: string
  tokenId: string
  tokenSymbol: string
  tokenImage: string
  type: 'buy' | 'sell'
  account: string
  amount: number
  value: number
  tokenAmount: number
  time: Date
  txHash: string
}

export interface LiveEvent {
  id: string
  type: 'buy' | 'sell' | 'create' | 'clac' | 'lottery' | 'win'
  account: string
  amount: number
  tokenSymbol: string
  tokenImage: string
  time: Date
}

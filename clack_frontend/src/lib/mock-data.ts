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

export const mockTokens: Token[] = [
  {
    id: '1',
    name: 'Pepe Classic',
    symbol: 'PEPE',
    image: '/tokens/pepe-king.jpg',
    creator: '0x7a3B...4f2D',
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    durationSeconds: 12 * 60 * 60,
    marketCap: 1250000,
    price: 0.0000421,
    priceChange24h: 15.4,
    volume24h: 89500,
    holders: 342,
    txCount: 1247,
    buys: 687,
    sells: 560,
    buyVolume: 52300,
    sellVolume: 37200,
    bondingProgress: 78,
    firstBuyerMultiplier: 8.3,
    claimableMon: 0,
    description: 'The original meme, reborn on chain. Pepe Classic brings the timeless frog to a new generation.'
  },
  {
    id: '2',
    name: 'Moon Dog',
    symbol: 'MDOG',
    image: '/tokens/moon-doge.jpg',
    creator: '0x3c1A...8e9F',
    createdAt: new Date(Date.now() - ((5 * 60 + 52) * 60 * 1000)),
    durationSeconds: 6 * 60 * 60,
    marketCap: 843000,
    price: 0.0000289,
    priceChange24h: -6.79,
    volume24h: 67800,
    holders: 231,
    txCount: 892,
    buys: 445,
    sells: 447,
    buyVolume: 31200,
    sellVolume: 36600,
    bondingProgress: 65,
    firstBuyerMultiplier: 5.7,
    claimableMon: 0,
    dead: false,
    description: 'Every dog has its day. Moon Dog is ready for liftoff.'
  },
  {
    id: '3',
    name: 'Rocket Cat',
    symbol: 'RCAT',
    image: '/tokens/rocket-cat.jpg',
    creator: '0x9d4E...2b7C',
    createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
    durationSeconds: 6 * 60 * 60,
    marketCap: 2100000,
    price: 0.0000712,
    priceChange24h: 42.3,
    volume24h: 156000,
    holders: 567,
    txCount: 2341,
    buys: 1456,
    sells: 885,
    buyVolume: 98700,
    sellVolume: 57300,
    bondingProgress: 92,
    firstBuyerMultiplier: 14.2,
    claimableMon: 0,
    description: 'Rocket Cat is ready for liftoff. To the moon and beyond!'
  },
  {
    id: '4',
    name: 'Diamond Hands',
    symbol: 'DIAM',
    image: '/tokens/diamond-hands.jpg',
    creator: '0x5f8B...1a3D',
    createdAt: new Date(Date.now() - 8 * 60 * 60 * 1000),
    durationSeconds: 6 * 60 * 60,
    marketCap: 456000,
    price: 0.0000156,
    priceChange24h: -12.8,
    volume24h: 34500,
    holders: 189,
    txCount: 567,
    buys: 234,
    sells: 333,
    buyVolume: 12300,
    sellVolume: 22200,
    bondingProgress: 45,
    firstBuyerMultiplier: 0.9,
    claimableMon: 2.4,
    description: 'Never selling. Diamond hands forever. HODL or die trying.'
  },
  {
    id: '5',
    name: 'Based Ape',
    symbol: 'BAPE',
    image: '/tokens/based-ape.jpg',
    creator: '0x2e6C...9f4A',
    createdAt: new Date(Date.now() - 30 * 60 * 1000),
    durationSeconds: 12 * 60 * 60,
    marketCap: 567000,
    price: 0.0000234,
    priceChange24h: 8.9,
    volume24h: 45600,
    holders: 145,
    txCount: 423,
    buys: 267,
    sells: 156,
    buyVolume: 28900,
    sellVolume: 16700,
    bondingProgress: 52,
    firstBuyerMultiplier: 3.2,
    claimableMon: 0,
    description: 'The most based ape on the blockchain. Ape in or stay poor.'
  },
  {
    id: '6',
    name: 'Wagmi Wolf',
    symbol: 'WAGMI',
    image: '/tokens/wagmi-wolf.jpg',
    creator: '0x8b2F...6c1E',
    createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000),
    durationSeconds: 24 * 60 * 60,
    marketCap: 1890000,
    price: 0.0000634,
    priceChange24h: 23.1,
    volume24h: 134000,
    holders: 478,
    txCount: 1876,
    buys: 1123,
    sells: 753,
    buyVolume: 87600,
    sellVolume: 46400,
    bondingProgress: 88,
    firstBuyerMultiplier: 11.8,
    claimableMon: 0,
    description: 'We are all gonna make it. The wolf pack sticks together.'
  },
  {
    id: '7',
    name: 'GM Sunrise',
    symbol: 'GM',
    image: '/tokens/gm-sunrise.jpg',
    creator: '0x4a1C...7d2E',
    createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
    durationSeconds: 12 * 60 * 60,
    marketCap: 678000,
    price: 0.0000312,
    priceChange24h: 5.6,
    volume24h: 54200,
    holders: 234,
    txCount: 678,
    buys: 412,
    sells: 266,
    buyVolume: 34100,
    sellVolume: 20100,
    bondingProgress: 61,
    firstBuyerMultiplier: 2.4,
    claimableMon: 0,
    description: 'GM frens. Start every day the right way with GM Sunrise.'
  },
  {
    id: '8',
    name: 'FOMO Fox',
    symbol: 'FOMO',
    image: '/tokens/fomo-fox.jpg',
    creator: '0x9c3D...5e8A',
    createdAt: new Date(Date.now() - 45 * 60 * 1000),
    durationSeconds: 6 * 60 * 60,
    marketCap: 234000,
    price: 0.0000098,
    priceChange24h: 67.4,
    volume24h: 89100,
    holders: 89,
    txCount: 312,
    buys: 245,
    sells: 67,
    buyVolume: 78900,
    sellVolume: 10200,
    bondingProgress: 34,
    firstBuyerMultiplier: 9.4,
    claimableMon: 0,
    description: 'Dont miss out. FOMO is real. Get in before its too late.'
  },
  {
    id: '9',
    name: 'Chad Bull',
    symbol: 'CHAD',
    image: '/tokens/chad-bull.jpg',
    creator: '0x6f2B...8c1D',
    createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000),
    durationSeconds: 6 * 60 * 60,
    marketCap: 1456000,
    price: 0.0000523,
    priceChange24h: 18.9,
    volume24h: 112000,
    holders: 398,
    txCount: 1234,
    buys: 789,
    sells: 445,
    buyVolume: 72000,
    sellVolume: 40000,
    bondingProgress: 76,
    firstBuyerMultiplier: 6.6,
    claimableMon: 1.2,
    dead: true,
    description: 'Bulls run this market. Chad Bull leads the charge.'
  },
  {
    id: '10',
    name: 'Laser Eyes',
    symbol: 'LASER',
    image: '/tokens/laser-eyes.jpg',
    creator: '0x1d4E...9a2F',
    createdAt: new Date(Date.now() - ((5 * 60 + 20) * 60 * 1000)),
    durationSeconds: 6 * 60 * 60,
    marketCap: 123000,
    price: 0.0000045,
    priceChange24h: 156.7,
    volume24h: 67800,
    holders: 67,
    txCount: 189,
    buys: 167,
    sells: 22,
    buyVolume: 65400,
    sellVolume: 2400,
    bondingProgress: 23,
    firstBuyerMultiplier: 15.7,
    claimableMon: 0,
    description: 'Laser eyes activated. We are all gonna make it.'
  }
]

export const mockTrades: Trade[] = [
  {
    id: '1',
    tokenId: '1',
    tokenSymbol: 'PEPE',
    tokenImage: '/tokens/pepe-king.jpg',
    type: 'buy',
    account: '0x4E22...9f3B',
    amount: 9.97,
    value: 0.33,
    tokenAmount: 396.88,
    time: new Date(Date.now() - 26 * 1000),
    txHash: '0x1234...5678'
  },
  {
    id: '2',
    tokenId: '1',
    tokenSymbol: 'PEPE',
    tokenImage: '/tokens/pepe-king.jpg',
    type: 'buy',
    account: '0x6F89...a2C1',
    amount: 0.99,
    value: 0.03,
    tokenAmount: 39.68,
    time: new Date(Date.now() - 6 * 60 * 1000),
    txHash: '0x2345...6789'
  },
  {
    id: '3',
    tokenId: '1',
    tokenSymbol: 'PEPE',
    tokenImage: '/tokens/pepe-king.jpg',
    type: 'sell',
    account: '0xEd7C...7e4D',
    amount: 0.02,
    value: 0.0068,
    tokenAmount: 0.81,
    time: new Date(Date.now() - 58 * 60 * 1000),
    txHash: '0x3456...7890'
  },
  {
    id: '4',
    tokenId: '1',
    tokenSymbol: 'PEPE',
    tokenImage: '/tokens/pepe-king.jpg',
    type: 'buy',
    account: '0x609f...6a8E',
    amount: 448.04,
    value: 15.19,
    tokenAmount: 17840,
    time: new Date(Date.now() - 1 * 60 * 60 * 1000),
    txHash: '0x4567...8901'
  },
  {
    id: '5',
    tokenId: '1',
    tokenSymbol: 'PEPE',
    tokenImage: '/tokens/pepe-king.jpg',
    type: 'buy',
    account: '0x3b0C...7f2A',
    amount: 100,
    value: 3.4,
    tokenAmount: 3980,
    time: new Date(Date.now() - 1 * 60 * 60 * 1000),
    txHash: '0x5678...9012'
  },
  {
    id: '6',
    tokenId: '1',
    tokenSymbol: 'PEPE',
    tokenImage: '/tokens/pepe-king.jpg',
    type: 'sell',
    account: '0xEd7C...7e4D',
    amount: 2.81,
    value: 0.09,
    tokenAmount: 114.4,
    time: new Date(Date.now() - 1 * 60 * 60 * 1000),
    txHash: '0x6789...0123'
  },
  {
    id: '7',
    tokenId: '1',
    tokenSymbol: 'PEPE',
    tokenImage: '/tokens/pepe-king.jpg',
    type: 'sell',
    account: '0xB20B...B4e1',
    amount: 0.97,
    value: 0.03,
    tokenAmount: 39.44,
    time: new Date(Date.now() - 1 * 60 * 60 * 1000),
    txHash: '0x7890...1234'
  },
  {
    id: '8',
    tokenId: '1',
    tokenSymbol: 'PEPE',
    tokenImage: '/tokens/pepe-king.jpg',
    type: 'buy',
    account: '0xB20B...B4e1',
    amount: 0.99,
    value: 0.03,
    tokenAmount: 39.44,
    time: new Date(Date.now() - 1 * 60 * 60 * 1000),
    txHash: '0x8901...2345'
  }
]

export const mockLiveEvents: LiveEvent[] = [
  {
    id: '1',
    type: 'buy',
    account: '0xSeint',
    amount: 99,
    tokenSymbol: 'MDOG',
    tokenImage: '/tokens/moon-doge.jpg',
    time: new Date(Date.now() - 5000)
  },
  {
    id: '2',
    type: 'sell',
    account: '0xB81F',
    amount: 443.39,
    tokenSymbol: 'RCAT',
    tokenImage: '/tokens/rocket-cat.jpg',
    time: new Date(Date.now() - 8000)
  },
  {
    id: '3',
    type: 'buy',
    account: '0xB81F',
    amount: 452.39,
    tokenSymbol: 'WAGMI',
    tokenImage: '/tokens/wagmi-wolf.jpg',
    time: new Date(Date.now() - 12000)
  },
  {
    id: '4',
    type: 'sell',
    account: '0xA32f',
    amount: 443.39,
    tokenSymbol: 'BAPE',
    tokenImage: '/tokens/based-ape.jpg',
    time: new Date(Date.now() - 15000)
  },
  {
    id: '5',
    type: 'create',
    account: '0xc09a',
    amount: 0,
    tokenSymbol: 'LASER',
    tokenImage: '/tokens/laser-eyes.jpg',
    time: new Date(Date.now() - 20000)
  },
  {
    id: '6',
    type: 'buy',
    account: '0x4E22',
    amount: 9.97,
    tokenSymbol: 'CHAD',
    tokenImage: '/tokens/chad-bull.jpg',
    time: new Date(Date.now() - 25000)
  },
  {
    id: '7',
    type: 'sell',
    account: '0xAC61',
    amount: 145.7,
    tokenSymbol: 'PEPE',
    tokenImage: '/tokens/pepe-king.jpg',
    time: new Date(Date.now() - 30000)
  },
  {
    id: '8',
    type: 'clac',
    account: '0xB11T',
    amount: 0,
    tokenSymbol: 'MOON',
    tokenImage: '/tokens/moon-doge.jpg',
    time: new Date(Date.now() - 35000)
  },
  {
    id: '9',
    type: 'lottery',
    account: '0x8c1',
    amount: 180,
    tokenSymbol: 'KAYSERI',
    tokenImage: '/tokens/chad-bull.jpg',
    time: new Date(Date.now() - 40000)
  },
  {
    id: '10',
    type: 'win',
    account: '0xab3',
    amount: 9.4,
    tokenSymbol: 'BLITZ',
    tokenImage: '/tokens/rocket-cat.jpg',
    time: new Date(Date.now() - 45000)
  }
]

export const trendingTokens = mockTokens.slice(0, 6).sort((a, b) => b.marketCap - a.marketCap)

export function formatNumber(num: number): string {
  if (num >= 1000000) {
    return `$${(num / 1000000).toFixed(2)}M`
  }
  if (num >= 1000) {
    return `$${(num / 1000).toFixed(2)}K`
  }
  return `$${num.toFixed(2)}`
}

export function formatPrice(price: number): string {
  if (price < 0.0001) {
    return price.toExponential(2)
  }
  return price.toFixed(6)
}

export function formatAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

export function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  
  if (seconds < 60) return `${seconds}s ago`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

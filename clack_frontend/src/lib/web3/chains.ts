import { defineChain } from 'viem'
import { publicEnv } from '@/lib/env'

export const monadTestnet = defineChain({
  id: 10143,
  name: 'Monad Testnet',
  nativeCurrency: {
    name: 'Monad',
    symbol: 'MON',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [publicEnv.NEXT_PUBLIC_MONAD_RPC],
      webSocket: [publicEnv.NEXT_PUBLIC_MONAD_WS],
    },
    public: {
      http: [publicEnv.NEXT_PUBLIC_MONAD_RPC],
      webSocket: [publicEnv.NEXT_PUBLIC_MONAD_WS],
    },
  },
  blockExplorers: {
    default: { name: 'MonadScan', url: 'https://testnet.monadscan.com' },
  },
  testnet: true,
})

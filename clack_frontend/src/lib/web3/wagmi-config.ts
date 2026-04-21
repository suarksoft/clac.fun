import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { monadTestnet } from './chains'
import { publicEnv } from '@/lib/env'

export const wagmiConfig = getDefaultConfig({
  appName: 'clac.fun',
  projectId: publicEnv.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID,
  chains: [monadTestnet],
  ssr: true,
})

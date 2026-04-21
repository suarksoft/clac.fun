import { createConfig, http } from 'wagmi'
import { injected, metaMask, walletConnect } from 'wagmi/connectors'
import { monadTestnet } from './chains'
import { publicEnv } from '@/lib/env'

const projectId = publicEnv.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim()
const hasWalletConnect = Boolean(projectId) && projectId !== 'demo-project-id'

const connectors = hasWalletConnect
  ? [
      injected(),
      metaMask(),
      walletConnect({ projectId: projectId! }),
    ]
  : [injected(), metaMask()]

if (!hasWalletConnect && typeof window !== 'undefined') {
  console.warn(
    '[Wallet] NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID missing or invalid. WalletConnect disabled; injected wallets remain enabled.',
  )
}

export const wagmiConfig = createConfig({
  chains: [monadTestnet],
  connectors,
  transports: {
    [monadTestnet.id]: http(),
  },
  ssr: true,
})

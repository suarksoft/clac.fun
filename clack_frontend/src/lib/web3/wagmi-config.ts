import { createConfig, http } from 'wagmi'
import { injected, metaMask } from 'wagmi/connectors'
import { connectorsForWallets } from '@rainbow-me/rainbowkit'
import {
  coinbaseWallet,
  metaMaskWallet,
  okxWallet,
  phantomWallet,
  rabbyWallet,
  rainbowWallet,
  trustWallet,
  walletConnectWallet,
} from '@rainbow-me/rainbowkit/wallets'
import { monadTestnet } from './chains'
import { publicEnv } from '@/lib/env'

const fallbackProjectId = 'fa9e0eafd8b2356cafde894807d78ca9'
const projectId = (
  publicEnv.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ||
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ||
  fallbackProjectId
).trim()
const hasWalletConnect = /^[a-f0-9]{32}$/i.test(projectId)
const isBrowser = typeof window !== 'undefined'

const connectors = isBrowser && hasWalletConnect
  ? connectorsForWallets(
      [
        {
          groupName: 'Popular',
          wallets: [
            metaMaskWallet,
            rabbyWallet,
            rainbowWallet,
            okxWallet,
            phantomWallet,
            trustWallet,
            walletConnectWallet,
            coinbaseWallet,
          ],
        },
      ],
      {
        appName: 'clac.fun',
        projectId: projectId!,
      },
    )
  : [injected(), metaMask()]

if (!hasWalletConnect && isBrowser) {
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
  ssr: false,
})

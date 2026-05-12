import { createConfig, fallback, http } from 'wagmi'
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
import { activeChain, monadTestnet, monadMainnet } from './chains'
import { publicEnv } from '@/lib/env'

const projectId = publicEnv.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID.trim()
const isBrowser = typeof window !== 'undefined'

const connectors = isBrowser
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
        projectId,
      },
    )
  : [injected(), metaMask()]

export const wagmiConfig = createConfig({
  chains: [activeChain],
  connectors,
  transports: {
    [monadTestnet.id]: fallback([
      http(publicEnv.NEXT_PUBLIC_MONAD_RPC),
      http('https://monad-testnet.drpc.org'),
    ], { rank: false }),
    [monadMainnet.id]: http(publicEnv.NEXT_PUBLIC_MONAD_RPC),
  },
  ssr: false,
})

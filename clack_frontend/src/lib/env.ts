import { z } from 'zod'

const publicEnvSchema = z.object({
  NEXT_PUBLIC_MONAD_RPC: z.string().url().default('https://testnet-rpc.monad.xyz'),
  NEXT_PUBLIC_MONAD_WS: z.string().url().default('wss://testnet-rpc.monad.xyz'),
  NEXT_PUBLIC_BACKEND_URL: z.string().url().default('http://localhost:3001'),
  NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID: z.string().min(1).default('demo-project-id'),
  NEXT_PUBLIC_CLAC_FACTORY_ADDRESS: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/)
    .default('0x0000000000000000000000000000000000000000'),
})

const parsed = publicEnvSchema.safeParse({
  NEXT_PUBLIC_MONAD_RPC: process.env.NEXT_PUBLIC_MONAD_RPC,
  NEXT_PUBLIC_MONAD_WS: process.env.NEXT_PUBLIC_MONAD_WS,
  NEXT_PUBLIC_BACKEND_URL: process.env.NEXT_PUBLIC_BACKEND_URL,
  NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID,
  NEXT_PUBLIC_CLAC_FACTORY_ADDRESS: process.env.NEXT_PUBLIC_CLAC_FACTORY_ADDRESS,
})

const fallback = {
  NEXT_PUBLIC_MONAD_RPC: process.env.NEXT_PUBLIC_MONAD_RPC || 'https://testnet-rpc.monad.xyz',
  NEXT_PUBLIC_MONAD_WS: process.env.NEXT_PUBLIC_MONAD_WS || 'wss://testnet-rpc.monad.xyz',
  NEXT_PUBLIC_BACKEND_URL: process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001',
  NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID:
    process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'demo-project-id',
  NEXT_PUBLIC_CLAC_FACTORY_ADDRESS:
    process.env.NEXT_PUBLIC_CLAC_FACTORY_ADDRESS || '0x0000000000000000000000000000000000000000',
}

export const publicEnv = parsed.success ? parsed.data : fallback

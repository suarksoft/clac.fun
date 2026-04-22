import { z } from 'zod'

const publicEnvSchema = z.object({
  NEXT_PUBLIC_MONAD_RPC: z.string().url(),
  NEXT_PUBLIC_MONAD_WS: z.string().url(),
  NEXT_PUBLIC_BACKEND_URL: z.string().url(),
  NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID: z.string().regex(/^[a-f0-9]{32}$/i),
  NEXT_PUBLIC_CLAC_FACTORY_ADDRESS: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/),
  NEXT_PUBLIC_SITE_URL: z.string().url(),
})

const parsed = publicEnvSchema.safeParse({
  NEXT_PUBLIC_MONAD_RPC: process.env.NEXT_PUBLIC_MONAD_RPC,
  NEXT_PUBLIC_MONAD_WS: process.env.NEXT_PUBLIC_MONAD_WS,
  NEXT_PUBLIC_BACKEND_URL: process.env.NEXT_PUBLIC_BACKEND_URL,
  NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID,
  NEXT_PUBLIC_CLAC_FACTORY_ADDRESS: process.env.NEXT_PUBLIC_CLAC_FACTORY_ADDRESS,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
})

if (!parsed.success) {
  throw new Error(
    `Invalid public environment variables: ${parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join(', ')}`,
  )
}

export const publicEnv = parsed.data

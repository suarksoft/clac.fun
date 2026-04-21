#!/usr/bin/env node

const requiredEnvKeys = [
  'NEXT_PUBLIC_MONAD_RPC',
  'NEXT_PUBLIC_MONAD_WS',
  'NEXT_PUBLIC_BACKEND_URL',
  'NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID',
  'NEXT_PUBLIC_CLAC_FACTORY_ADDRESS',
]

const missing = requiredEnvKeys.filter((key) => !process.env[key])

if (missing.length > 0) {
  console.error(`Missing required env values: ${missing.join(', ')}`)
  process.exit(1)
}

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL

async function run() {
  const checks = [
    `${backendUrl}/api/tokens`,
    `${backendUrl}/api/trades/recent`,
  ]

  for (const url of checks) {
    const res = await fetch(url)
    if (!res.ok) {
      throw new Error(`Smoke check failed for ${url}: ${res.status}`)
    }
  }

  console.log('Smoke checks passed.')
}

run().catch((error) => {
  console.error(error.message)
  process.exit(1)
})

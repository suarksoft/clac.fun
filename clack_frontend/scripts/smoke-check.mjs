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
const rpcUrl = process.env.NEXT_PUBLIC_MONAD_RPC
const contractAddress = process.env.NEXT_PUBLIC_CLAC_FACTORY_ADDRESS

async function run() {
  const checks = [
    `${backendUrl}/api/health`,
    `${backendUrl}/api/ready`,
    `${backendUrl}/api/tokens`,
    `${backendUrl}/api/trades/recent`,
  ]

  for (const url of checks) {
    const res = await fetch(url)
    if (!res.ok) {
      throw new Error(`Smoke check failed for ${url}: ${res.status}`)
    }
  }

  const chainIdRes = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_chainId',
      params: [],
    }),
  })
  if (!chainIdRes.ok) {
    throw new Error(`RPC check failed: ${chainIdRes.status}`)
  }
  const chainIdPayload = await chainIdRes.json()
  if (chainIdPayload.result !== '0x279f') {
    throw new Error(`Unexpected chain id: ${chainIdPayload.result}`)
  }

  const codeRes = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 2,
      method: 'eth_getCode',
      params: [contractAddress, 'latest'],
    }),
  })
  if (!codeRes.ok) {
    throw new Error(`Contract code check failed: ${codeRes.status}`)
  }
  const codePayload = await codeRes.json()
  if (!codePayload.result || codePayload.result === '0x') {
    throw new Error(`No contract code at address ${contractAddress}`)
  }

  console.log('Smoke checks passed.')
}

run().catch((error) => {
  console.error(error.message)
  process.exit(1)
})

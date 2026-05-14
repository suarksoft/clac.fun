import { io } from 'socket.io-client'
import type { BackendTokenV2, BackendTradeV2, BackendHolderV2, BackendLotteryWinV2, BackendClaimV2, BackendRecentTradeV2 } from './types-v2'
import { publicEnv } from '@/lib/env'

const BACKEND_URL = publicEnv.NEXT_PUBLIC_BACKEND_URL

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(`${BACKEND_URL}${path}`, {
    next: { revalidate: 5 },
  })
  if (!response.ok) throw new Error(`V2 API request failed for ${path}`)
  return response.json() as Promise<T>
}

async function fetchJsonOrNull<T>(path: string): Promise<T | null> {
  const response = await fetch(`${BACKEND_URL}${path}`, {
    next: { revalidate: 5 },
  })
  if (response.status === 404) return null
  if (!response.ok) throw new Error(`V2 API request failed for ${path}`)
  return response.json() as Promise<T>
}

export const apiClientV2 = {
  getTokens: (filter?: 'live' | 'dying' | 'dead' | 'new' | 'hot', limit = 50) => {
    const params = new URLSearchParams()
    if (filter) params.set('filter', filter)
    params.set('limit', String(limit))
    return fetchJson<BackendTokenV2[]>(`/api/v2/tokens?${params}`)
  },

  getToken: (addressOrSlug: string) =>
    fetchJsonOrNull<BackendTokenV2>(`/api/v2/tokens/${addressOrSlug}`),

  getTrades: (address: string, limit = 50) =>
    fetchJson<BackendTradeV2[]>(`/api/v2/tokens/${address}/trades?limit=${limit}`),

  getHolders: (address: string) =>
    fetchJson<BackendHolderV2[]>(`/api/v2/tokens/${address}/holders`),

  getLottery: (address: string) =>
    fetchJson<BackendLotteryWinV2[]>(`/api/v2/tokens/${address}/lottery`),

  getClaims: (address: string) =>
    fetchJson<BackendClaimV2[]>(`/api/v2/tokens/${address}/claims`),

  getRecentTrades: (limit = 20) =>
    fetchJson<BackendRecentTradeV2[]>(`/api/v2/trades/recent?limit=${limit}`),

  updateTokenSocials: (
    address: string,
    data: { website?: string; twitter?: string; telegram?: string; description?: string },
  ) =>
    fetch(`${BACKEND_URL}/api/v2/tokens/${address}/socials`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
}

export function createSocketClientV2() {
  return io(`${BACKEND_URL}/ws-v2`, {
    transports: ['polling', 'websocket'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 10,
  })
}

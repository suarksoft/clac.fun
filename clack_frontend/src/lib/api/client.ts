import { io } from 'socket.io-client'
import type { BackendHolder, BackendPortfolio, BackendToken, BackendTrade } from './types'
import { publicEnv } from '@/lib/env'

export interface CandleData {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

const BACKEND_URL = publicEnv.NEXT_PUBLIC_BACKEND_URL

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(`${BACKEND_URL}${path}`, {
    next: { revalidate: 5 },
  })

  if (!response.ok) {
    throw new Error(`API request failed for ${path}`)
  }

  return response.json() as Promise<T>
}

export const apiClient = {
  getTokens: (filter: 'live' | 'dying' | 'dead' | 'new' | 'hot' = 'live') =>
    fetchJson<BackendToken[]>(`/api/tokens?filter=${filter}`),
  getTrendingTokens: () => fetchJson<BackendToken[]>('/api/tokens/trending'),
  getLeaderboard: () => fetchJson<BackendToken[]>('/api/leaderboard'),
  getToken: (id: string) => fetchJson<BackendToken>(`/api/tokens/${id}`),
  getTradesByToken: (id: string) => fetchJson<BackendTrade[]>(`/api/tokens/${id}/trades`),
  getHoldersByToken: (id: string) => fetchJson<BackendHolder[]>(`/api/tokens/${id}/holders`),
  getWinners: () => fetchJson<BackendTrade[]>('/api/trades/winners'),
  getRecentTrades: () => fetchJson<BackendTrade[]>('/api/trades/recent'),
  getPortfolio: (address: string) => fetchJson<BackendPortfolio>(`/api/portfolio/${address}`),
  getCandles: (tokenId: number, interval = '1m', limit = 200) =>
    fetchJson<CandleData[]>(`/api/trades/candles/${tokenId}?interval=${interval}&limit=${limit}`),
}

export function createSocketClient() {
  return io(`${BACKEND_URL}/ws`, {
    transports: ['websocket'],
    reconnection: true,
  })
}

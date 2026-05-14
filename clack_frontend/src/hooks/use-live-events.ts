'use client'

import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { formatEther } from 'viem'
import { apiClientV2, createSocketClientV2 } from '@/lib/api/client-v2'
import { resolveTokenImageUrl, toUiRecentTradeV2, tradeToLiveEventV2 } from '@/lib/api/mappers-v2'
import type { LiveEvent } from '@/lib/ui-types'
import type { SocketTradeV2Event } from '@/lib/api/types-v2'

/**
 * V2-only live events stream. Seeds from /api/v2/trades/recent, then keeps the
 * list in sync via the v2 socket gateway.
 */
export function useLiveEvents(): LiveEvent[] {
  const [events, setEvents] = useState<LiveEvent[]>([])

  const recentQuery = useQuery({
    queryKey: ['v2-recent-trades'],
    queryFn: () => apiClientV2.getRecentTrades(20),
    staleTime: 5000,
    refetchInterval: 30_000,
  })

  useEffect(() => {
    if (!recentQuery.data) return
    const mapped = recentQuery.data.map(toUiRecentTradeV2).map(tradeToLiveEventV2)
    if (mapped.length > 0) setEvents(mapped)
  }, [recentQuery.data])

  useEffect(() => {
    const socket = createSocketClientV2()
    socket.on('trade', (payload: SocketTradeV2Event & { tokenSymbol?: string; tokenImage?: string }) => {
      try {
        const event: LiveEvent = {
          id: crypto.randomUUID(),
          type: payload.isBuy ? 'buy' : 'sell',
          account: payload.trader,
          amount: Number(formatEther(BigInt(payload.monAmount || '0'))),
          tokenSymbol: payload.tokenSymbol ?? 'CLAC',
          tokenImage: resolveTokenImageUrl(payload.tokenImage),
          time: new Date(),
        }
        setEvents((prev) => [event, ...prev].slice(0, 30))
      } catch (err) {
        console.error('[useLiveEvents] failed to handle socket trade', err)
      }
    })
    socket.on('connect_error', (err) => {
      console.error('[useLiveEvents] socket connect_error', err.message)
    })
    return () => { socket.disconnect() }
  }, [])

  return events
}

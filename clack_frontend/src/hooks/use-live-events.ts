'use client'

import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiClient, createSocketClient } from '@/lib/api/client'
import { toUiTrade, tradeToLiveEvent } from '@/lib/api/mappers'
import type { LiveEvent } from '@/lib/ui-types'

export function useLiveEvents() {
  const [events, setEvents] = useState<LiveEvent[]>([])

  const recentTradesQuery = useQuery({
    queryKey: ['recent-trades'],
    queryFn: apiClient.getRecentTrades,
    staleTime: 5000,
  })

  useEffect(() => {
    if (!recentTradesQuery.data) return
    const mapped = recentTradesQuery.data.map(toUiTrade).map(tradeToLiveEvent)
    if (mapped.length > 0) {
      setEvents(mapped)
    }
  }, [recentTradesQuery.data])

  useEffect(() => {
    const socket = createSocketClient()

    socket.on('trade', (payload) => {
      const liveEvent = {
        id: crypto.randomUUID(),
        type: payload.isBuy ? 'buy' : 'sell',
        account: payload.trader,
        amount: Number(payload.monAmount || 0),
          tokenSymbol: payload.tokenSymbol || 'CLAC',
        tokenImage: '/tokens/pepe-king.jpg',
        time: new Date(),
      } as const

      setEvents((prev) => [liveEvent, ...prev].slice(0, 30))
    })

    socket.on('tokenClacced', (payload) => {
      setEvents((prev) => [
        {
          id: crypto.randomUUID(),
          type: 'clac',
          account: payload.triggeredBy || 'system',
          amount: Number(payload.poolRemaining || 0),
          tokenSymbol: payload.tokenSymbol || 'CLAC',
          tokenImage: '/tokens/chad-bull.jpg',
          time: new Date(),
        },
        ...prev,
      ].slice(0, 30))
    })

    socket.on('lotteryWin', (payload) => {
      setEvents((prev) => [
        {
          id: crypto.randomUUID(),
          type: 'lottery',
          account: payload.winner,
          amount: Number(payload.amount || 0),
          tokenSymbol: payload.tokenSymbol || 'CLAC',
          tokenImage: '/tokens/rocket-cat.jpg',
          time: new Date(),
        },
        ...prev,
      ].slice(0, 30))
    })

    return () => {
      socket.disconnect()
    }
  }, [])

  return useMemo(() => events, [events])
}

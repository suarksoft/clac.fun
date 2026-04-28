'use client'

import { useEffect, useState } from 'react'
import type { Token } from '@/lib/ui-types'
import { TokenCard } from './token-card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { getDeathClockState } from '@/lib/death-clock'
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api/client'
import { toUiToken } from '@/lib/api/mappers'
import { Skeleton } from '@/components/ui/skeleton'

type FilterOption = 'live' | 'dying' | 'hot' | 'new' | 'clacd' | 'claiming'

export function TokenGrid() {
  const [activeFilter, setActiveFilter] = useState<FilterOption>('live')
  const [showNSFW, setShowNSFW] = useState(false)
  const [nowSeconds, setNowSeconds] = useState(() => Math.floor(Date.now() / 1000))
  const { data: tokensData = [], isLoading } = useQuery({
    queryKey: ['tokens', activeFilter],
    queryFn: async () => {
      const backendFilter =
        activeFilter === 'clacd' ? 'dead' : activeFilter === 'claiming' ? 'live' : activeFilter
      const response = await apiClient.getTokens(backendFilter)
      return response.map(toUiToken)
    },
    refetchInterval: 10000,
  })

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowSeconds(Math.floor(Date.now() / 1000))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [])

  const sortTokens = (tokens: Token[]): Token[] => {
    switch (activeFilter) {
      case 'dying':
        return [...tokens].sort(
          (a, b) =>
            getDeathClockState(a.createdAt, a.durationSeconds, nowSeconds).remainingSeconds -
            getDeathClockState(b.createdAt, b.durationSeconds, nowSeconds).remainingSeconds
        )
      case 'hot':
        return [...tokens].sort((a, b) => b.volume24h - a.volume24h)
      case 'new':
        return [...tokens].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      case 'clacd':
        return [...tokens].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      case 'claiming':
        return [...tokens].sort((a, b) => b.claimableMon - a.claimableMon)
      case 'live':
      default:
        return [...tokens].sort((a, b) => b.marketCap - a.marketCap)
    }
  }

  const filteredTokens = tokensData.filter((token) => {
    const death = getDeathClockState(token.createdAt, token.durationSeconds, nowSeconds)
    const isDead = token.dead || death.isDead
    switch (activeFilter) {
      case 'live':
        return !isDead
      case 'dying':
        return !isDead && death.remainingSeconds < 3600
      case 'hot':
        return !isDead
      case 'new':
        return !isDead
      case 'clacd':
        return isDead
      case 'claiming':
        return token.claimableMon > 0
      default:
        return true
    }
  })

  const sortedTokens = sortTokens(filteredTokens)

  const filterOptions: { value: FilterOption; label: string; className?: string }[] = [
    { value: 'live', label: '🟢 Live' },
    { value: 'dying', label: '⚠️ Dying Soon', className: 'border-red-500/40 text-red-400 hover:bg-red-500/10' },
    { value: 'hot', label: '🔥 Hot' },
    { value: 'new', label: '🆕 New' },
    { value: 'clacd', label: "💀 Clac'd" },
    { value: 'claiming', label: '🎰 Claiming' },
  ]

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-2">
          {filterOptions.map((option) => (
            <Button
              key={option.value}
              variant={activeFilter === option.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveFilter(option.value)}
              className={
                activeFilter === option.value
                  ? 'bg-primary text-primary-foreground'
                  : option.className ?? 'border-border bg-secondary text-secondary-foreground hover:bg-secondary/80'
              }
            >
              {option.label}
            </Button>
          ))}
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Label htmlFor="nsfw" className="text-xs text-muted-foreground">
              NSFW
            </Label>
            <Switch
              id="nsfw"
              checked={showNSFW}
              onCheckedChange={setShowNSFW}
              className="data-[state=checked]:bg-primary"
            />
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
              OFF
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="paused" className="text-xs text-muted-foreground">
              Paused
            </Label>
            <Switch
              id="paused"
              className="data-[state=checked]:bg-primary"
            />
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
              OFF
            </span>
          </div>
        </div>
      </div>

      {/* Grid */}
      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {Array.from({ length: 10 }).map((_, idx) => (
            <div key={idx} className="rounded-2xl border border-border bg-card p-3">
              <Skeleton className="aspect-square w-full rounded-xl" />
              <div className="mt-3 space-y-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-3 w-full" />
              </div>
            </div>
          ))}
        </div>
      )}
      {!isLoading && sortedTokens.length === 0 && (
        <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
          Gosterilecek token bulunamadi.
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
        {sortedTokens.map((token) => (
          <TokenCard key={token.id} token={token} />
        ))}
      </div>
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { Header } from '@/components/header'
import { LiveTicker } from '@/components/live-ticker'
import { formatNumber } from '@/lib/format'
import { TokenImage } from '@/components/token-image'
import Link from 'next/link'
import { Trophy, TrendingUp, Users } from 'lucide-react'
import { getDeathClockColor, getDeathClockState } from '@/lib/death-clock'
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api/client'
import { toUiToken } from '@/lib/api/mappers'

export default function LeaderboardPage() {
  const [nowSeconds, setNowSeconds] = useState(() => Math.floor(Date.now() / 1000))
  const { data: sortedTokens = [] } = useQuery({
    queryKey: ['leaderboard'],
    queryFn: async () => {
      const response = await apiClient.getLeaderboard()
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

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <LiveTicker />

      <main className="flex-1">
        <div className="container mx-auto px-4 py-8">
          <div className="mb-8 flex items-center gap-3">
            <Trophy className="h-8 w-8 text-amber-500" />
            <h1 className="text-3xl font-bold text-foreground">Leaderboard</h1>
          </div>

          <div className="rounded-xl border border-border bg-card">
            {/* Mobile: kartlar */}
            <div className="space-y-3 p-3 md:hidden">
              {sortedTokens.length === 0 && (
                <p className="py-8 text-center text-sm text-muted-foreground">No tokens yet.</p>
              )}
              {sortedTokens.map((token, index) => {
                const death = getDeathClockState(token.createdAt, token.durationSeconds, nowSeconds)
                const isDead = token.dead || death.isDead
                return (
                  <Link
                    key={token.id}
                    href={`/token/${token.slug || token.id}`}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border bg-secondary/20 p-4 transition-colors hover:bg-secondary/40"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-bold ${
                          index === 0
                            ? 'bg-amber-500/20 text-amber-500'
                            : index === 1
                              ? 'bg-zinc-400/20 text-zinc-400'
                              : index === 2
                                ? 'bg-orange-600/20 text-orange-600'
                                : 'bg-secondary text-muted-foreground'
                        }`}
                      >
                        {index + 1}
                      </div>
                      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full">
                        <TokenImage src={token.image} alt={token.name} fill className="object-cover" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1">
                          <span className="rounded bg-primary/20 px-1.5 py-0.5 text-xs font-bold text-primary">
                            {token.symbol}
                          </span>
                          <span className="truncate font-medium text-foreground">{token.name}</span>
                        </div>
                        <p className="truncate font-mono text-xs text-muted-foreground">
                          MC {formatNumber(token.marketCap)}
                        </p>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div
                        className={`font-mono text-sm font-semibold ${
                          token.priceChange24h >= 0 ? 'text-emerald-500' : 'text-red-500'
                        }`}
                      >
                        {token.priceChange24h >= 0 ? '+' : ''}
                        {token.priceChange24h.toFixed(2)}%
                      </div>
                      <div className="mt-1 font-mono text-xs text-muted-foreground">
                        Vol {formatNumber(token.volume24h)}
                      </div>
                      <div className="mt-1 font-mono text-xs">
                        <span className={isDead ? 'text-red-500' : getDeathClockColor(death.remainingSeconds)}>
                          {isDead ? "💀" : death.longText}
                        </span>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>

            {/* Desktop: tablo */}
            <div className="hidden overflow-x-auto md:block">
              <table className="min-w-[920px] w-full">
                <thead>
                  <tr className="border-b border-border text-left text-sm text-muted-foreground">
                    <th className="px-6 py-4">Rank</th>
                    <th className="px-6 py-4">Token</th>
                    <th className="px-6 py-4">Market Cap</th>
                    <th className="px-6 py-4">24h Change</th>
                    <th className="px-6 py-4">Volume</th>
                    <th className="px-6 py-4">Holders</th>
                    <th className="px-6 py-4">Time Left</th>
                    <th className="px-6 py-4">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedTokens.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-6 py-10 text-center text-sm text-muted-foreground">
                        No tokens yet.
                      </td>
                    </tr>
                  )}
                  {sortedTokens.map((token, index) => {
                    const death = getDeathClockState(token.createdAt, token.durationSeconds, nowSeconds)
                    const isDead = token.dead || death.isDead
                    return (
                      <tr
                        key={token.id}
                        className="border-b border-border/50 transition-colors hover:bg-secondary/30"
                      >
                        <td className="px-6 py-4">
                          <div
                            className={`flex h-8 w-8 items-center justify-center rounded-full font-bold ${
                              index === 0
                                ? 'bg-amber-500/20 text-amber-500'
                                : index === 1
                                  ? 'bg-zinc-400/20 text-zinc-400'
                                  : index === 2
                                    ? 'bg-orange-600/20 text-orange-600'
                                    : 'bg-secondary text-muted-foreground'
                            }`}
                          >
                            {index + 1}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <Link href={`/token/${token.slug || token.id}`} className="flex items-center gap-3 hover:opacity-80">
                            <div className="relative h-10 w-10 overflow-hidden rounded-full">
                              <TokenImage src={token.image} alt={token.name} fill className="object-cover" />
                            </div>
                            <div>
                              <span className="mr-2 rounded bg-primary/20 px-1.5 py-0.5 text-xs font-bold text-primary">
                                {token.symbol}
                              </span>
                              <span className="font-medium text-foreground">{token.name}</span>
                            </div>
                          </Link>
                        </td>
                        <td className="px-6 py-4 font-mono text-foreground">{formatNumber(token.marketCap)}</td>
                        <td className="px-6 py-4">
                          <div
                            className={`flex items-center gap-1 font-mono ${
                              token.priceChange24h >= 0 ? 'text-emerald-500' : 'text-red-500'
                            }`}
                          >
                            <TrendingUp className={`h-4 w-4 ${token.priceChange24h < 0 ? 'rotate-180' : ''}`} />
                            {token.priceChange24h >= 0 ? '+' : ''}
                            {token.priceChange24h.toFixed(2)}%
                          </div>
                        </td>
                        <td className="px-6 py-4 font-mono text-foreground">{formatNumber(token.volume24h)}</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Users className="h-4 w-4" />
                            {token.holders}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`font-mono text-sm ${isDead ? 'text-red-500' : getDeathClockColor(death.remainingSeconds)}`}
                          >
                            {isDead ? "CLAC'D" : death.longText}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`rounded-full px-2 py-1 text-xs font-bold ${
                              isDead
                                ? 'bg-red-500/20 text-red-500'
                                : death.status === 'dying' || death.status === 'critical'
                                  ? 'bg-orange-500/20 text-orange-400'
                                  : 'bg-emerald-500/20 text-emerald-500'
                            }`}
                          >
                            {isDead ? "💀 CLAC'D" : death.status === 'dying' || death.status === 'critical' ? '⚠️ DYING' : '🟢 LIVE'}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-border bg-card py-6">
        <div className="container mx-auto flex flex-col items-center justify-between gap-4 px-4 text-sm text-muted-foreground md:flex-row">
          <div className="flex items-center gap-4">
            <span className="font-semibold text-foreground">Clac.fun</span>
            <span className="text-xs">Built for degens</span>
          </div>
          <div className="flex items-center gap-6">
            <a href="#" className="transition-colors hover:text-foreground">Docs</a>
            <a href="#" className="transition-colors hover:text-foreground">Twitter</a>
            <a href="#" className="transition-colors hover:text-foreground">Telegram</a>
          </div>
        </div>
      </footer>
    </div>
  )
}

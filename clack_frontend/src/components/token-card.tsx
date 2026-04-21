'use client'

import { Token, formatNumber, formatTimeAgo } from '@/lib/mock-data'
import Image from 'next/image'
import Link from 'next/link'
import { Users, BarChart3, Clock } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useDeathClock } from '@/hooks/use-death-clock'

interface TokenCardProps {
  token: Token
}

export function TokenCard({ token }: TokenCardProps) {
  const isPositive = token.priceChange24h >= 0
  const [timeAgo, setTimeAgo] = useState<string>('')
  const death = useDeathClock(token.createdAt, token.durationSeconds)
  const isDead = token.dead || death.status === 'dead'

  useEffect(() => {
    setTimeAgo(formatTimeAgo(token.createdAt))
    const interval = setInterval(() => {
      setTimeAgo(formatTimeAgo(token.createdAt))
    }, 60000)
    return () => clearInterval(interval)
  }, [token.createdAt])

  return (
    <Link href={`/token/${token.id}`} className="group block">
      <div className="overflow-hidden rounded-2xl border border-border bg-card transition-all duration-300 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5">
        {/* Image Section */}
        <div className="relative aspect-square overflow-hidden">
          <Image
            src={token.image}
            alt={token.name}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
          {/* Death Clock Overlay */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="text-white/80">Death Clock</span>
              <span
                className={`font-mono text-base font-bold ${
                  isDead
                    ? 'text-red-500'
                    : death.status === 'critical'
                    ? 'animate-pulse text-red-400'
                    : death.status === 'dying'
                    ? 'text-orange-400'
                    : 'text-white'
                }`}
              >
                {isDead ? "💀 CLAC'D" : death.longText}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/20">
              <div
                className={`h-full rounded-full transition-all ${
                  isDead
                    ? 'bg-red-500'
                    : death.status === 'critical'
                    ? 'animate-pulse bg-red-500'
                    : death.status === 'dying'
                    ? 'bg-gradient-to-r from-yellow-500 to-orange-500'
                    : 'bg-white'
                }`}
                style={{ width: `${isDead ? 0 : death.percentage}%` }}
              />
            </div>
          </div>
          {isDead ? (
            <div className="absolute left-2 top-2 rounded-full bg-red-600/90 px-2 py-1 text-xs font-bold text-white">
              💀 CLAC'D
            </div>
          ) : death.status !== 'alive' ? (
            <div className="absolute left-2 top-2 flex animate-pulse items-center gap-1 rounded-full bg-red-600/90 px-2 py-1 text-xs font-bold text-white">
              ⚠️ DYING SOON
            </div>
          ) : null}
          {/* Time Badge */}
          <div className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 text-xs text-white backdrop-blur-sm">
            <Clock className="h-3 w-3" />
            {timeAgo || 'Just now'}
          </div>
        </div>

        {/* Content Section */}
        <div className="p-4">
          {/* Symbol Badge & Name */}
          <div className="mb-2 flex items-start justify-between">
            <div>
              <span className="inline-block rounded bg-primary/20 px-2 py-0.5 text-xs font-bold text-primary">
                {token.symbol}
              </span>
              <h3 className="mt-1 text-base font-semibold text-foreground">{token.name}</h3>
              <span className="mt-1 inline-block rounded bg-emerald-500/20 px-2 py-0.5 text-xs font-bold text-emerald-500">
                First buyer: {token.firstBuyerMultiplier.toFixed(1)}x
              </span>
            </div>
            <div
              className={`rounded px-2 py-0.5 text-xs font-semibold ${
                isPositive 
                  ? 'bg-emerald-500/20 text-emerald-500' 
                  : 'bg-red-500/20 text-red-500'
              }`}
            >
              {isPositive ? '+' : ''}{token.priceChange24h.toFixed(2)}%
            </div>
          </div>

          {/* Description */}
          <p className="mb-3 line-clamp-2 text-xs text-muted-foreground">
            {token.description}
          </p>

          {/* Stats */}
          <div className="flex items-center justify-between border-t border-border pt-3">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <BarChart3 className="h-3 w-3" />
              <span>{formatNumber(token.marketCap)}</span>
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Users className="h-3 w-3" />
              <span>{token.holders} holders</span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  )
}

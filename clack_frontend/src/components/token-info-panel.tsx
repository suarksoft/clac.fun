'use client'

import type { Token } from '@/lib/ui-types'
import { formatAddress, formatTimeAgo } from '@/lib/format'
import Image from 'next/image'
import { Copy, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react'
import { useState, useEffect } from 'react'

interface TokenInfoPanelProps {
  token: Token
}

export function TokenInfoPanel({ token }: TokenInfoPanelProps) {
  const [showOtherInfo, setShowOtherInfo] = useState(true)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  const buys = token.buys
  const sells = token.sells
  const totalSide = buys + sells
  const buyRate = totalSide > 0 ? (buys / totalSide) * 100 : 0

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border bg-card p-3">
        <div className="space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Pool Balance</span>
            <span className="font-mono text-foreground">{token.claimableMon.toFixed(4)} MON</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Total Trades</span>
            <span className="font-mono text-foreground">{token.txCount}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Death Tax Pool</span>
            <span className="font-mono text-foreground">--</span>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-3">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-medium text-foreground">Information</span>
          <button className="text-xs text-muted-foreground hover:text-foreground">{token.symbol.toLowerCase()}</button>
        </div>

        <div className="mb-3 flex items-start gap-2.5">
          <div className="relative h-10 w-10 overflow-hidden rounded-lg">
            <Image src={token.image} alt={token.name} fill className="object-cover" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">{token.name}</p>
            <p className="truncate text-xs text-muted-foreground">{token.description}</p>
          </div>
        </div>

        <div className="mb-3 grid grid-cols-3 gap-1.5">
          <button className="rounded-md border border-border bg-secondary/30 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground">
            Telegram
          </button>
          <button className="rounded-md border border-border bg-secondary/30 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground">
            X
          </button>
          <button className="rounded-md border border-border bg-secondary/30 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground">
            <ExternalLink className="mx-auto h-3.5 w-3.5" />
          </button>
        </div>

        <div className="mb-3 grid grid-cols-3 gap-2">
          <div className="rounded-md border border-border bg-secondary/20 p-2">
            <p className="text-[10px] text-muted-foreground">PRICE USD</p>
            <p className="font-mono text-xs text-foreground">${token.price.toFixed(4)}</p>
          </div>
          <div className="rounded-md border border-border bg-secondary/20 p-2">
            <p className="text-[10px] text-muted-foreground">PRICE MON</p>
            <p className="font-mono text-xs text-foreground">{token.price.toExponential(4)}</p>
          </div>
          <div className="rounded-md border border-border bg-secondary/20 p-2">
            <p className="text-[10px] text-muted-foreground">FDV</p>
            <p className="font-mono text-xs text-foreground">${token.marketCap.toFixed(2)}</p>
          </div>
        </div>

        <div className="mb-3 grid grid-cols-4 gap-1.5 text-center">
          <div className="rounded-md border border-border bg-secondary/20 p-1.5">
            <p className="text-[10px] text-muted-foreground">30M</p>
            <p className="text-[11px] text-emerald-500">+11.87%</p>
          </div>
          <div className="rounded-md border border-border bg-secondary/20 p-1.5">
            <p className="text-[10px] text-muted-foreground">1H</p>
            <p className="text-[11px] text-emerald-500">+12.4%</p>
          </div>
          <div className="rounded-md border border-border bg-secondary/20 p-1.5">
            <p className="text-[10px] text-muted-foreground">4H</p>
            <p className="text-[11px] text-emerald-500">+15.69%</p>
          </div>
          <div className="rounded-md border border-border bg-secondary/20 p-1.5">
            <p className="text-[10px] text-muted-foreground">24H</p>
            <p className={`text-[11px] ${token.priceChange24h >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
              {token.priceChange24h >= 0 ? '+' : ''}
              {token.priceChange24h.toFixed(2)}%
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground">TXNS {token.txCount}</span>
            <span className="text-muted-foreground">
              BUYS <span className="text-emerald-500">{buys}</span> / SELLS <span className="text-red-500">{sells}</span>
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
            <div className="h-full bg-emerald-500" style={{ width: `${buyRate}%` }} />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card">
        <button
          onClick={() => setShowOtherInfo(!showOtherInfo)}
          className="flex w-full items-center justify-between p-3"
        >
          <span className="text-sm font-medium text-foreground">Other Info</span>
          {showOtherInfo ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </button>

        {showOtherInfo && (
          <div className="space-y-2 border-t border-border p-3">
            <div className="flex items-center justify-between rounded-md border border-border bg-secondary/20 px-2.5 py-2">
              <span className="text-[11px] text-muted-foreground">Creator</span>
              <button
                onClick={() => copyToClipboard(token.creator)}
                className="flex items-center gap-1.5 text-xs text-foreground hover:text-primary"
              >
                {formatAddress(token.creator)}
                <Copy className="h-3 w-3" />
              </button>
            </div>
            <div className="flex items-center justify-between rounded-md border border-border bg-secondary/20 px-2.5 py-2">
              <span className="text-[11px] text-muted-foreground">Contract Address</span>
              <button
                onClick={() => copyToClipboard(token.id)}
                className="flex items-center gap-1.5 text-xs text-foreground hover:text-primary"
              >
                #{token.id}
                <Copy className="h-3 w-3" />
              </button>
            </div>
            <div className="flex items-center justify-between rounded-md border border-border bg-secondary/20 px-2.5 py-2">
              <span className="text-[11px] text-muted-foreground">Creation Time</span>
              <span className="text-xs text-foreground">{mounted ? formatTimeAgo(token.createdAt) : '--'}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

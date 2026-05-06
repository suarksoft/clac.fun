'use client'

import { useState, useEffect, useRef } from 'react'
import {
  formatAbbreviatedTokenAmount,
  formatAddress,
  formatTimeAgo,
  formatTokenPrice,
} from '@/lib/format'
import type { Trade } from '@/lib/ui-types'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import {
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  MessageSquare,
} from 'lucide-react'
import { cn } from '@/lib/utils'

function addressToGradient(address: string): string {
  if (!address || address.length < 10) return 'linear-gradient(135deg, #6366f1, #8b5cf6)'
  const h1 = parseInt(address.slice(2, 8), 16) % 360
  const h2 = (h1 + 50) % 360
  return `linear-gradient(135deg, hsl(${h1},70%,55%), hsl(${h2},70%,45%))`
}

interface TradesTableProps {
  trades: Trade[]
}

export function TradesTable({ trades }: TradesTableProps) {
  const [activeTab, setActiveTab] = useState<'comments' | 'trades'>('trades')
  const [filterBySize, setFilterBySize] = useState(false)
  const [filterValue, setFilterValue] = useState('0.05')
  const [currentPage, setCurrentPage] = useState(1)
  const [mounted, setMounted] = useState(false)
  const [newTradeIds, setNewTradeIds] = useState<Set<string>>(new Set())
  const isInitializedRef = useRef(false)
  const prevTradeIdsRef = useRef<Set<string>>(new Set())

  useEffect(() => { setMounted(true) }, [])

  // Flash animation for newly arriving trades
  useEffect(() => {
    if (trades.length === 0) return

    if (!isInitializedRef.current) {
      isInitializedRef.current = true
      prevTradeIdsRef.current = new Set(trades.map((t) => t.id))
      return
    }

    const newIds = trades
      .filter((t) => !prevTradeIdsRef.current.has(t.id))
      .map((t) => t.id)

    prevTradeIdsRef.current = new Set(trades.map((t) => t.id))

    if (newIds.length > 0) {
      setNewTradeIds((prev) => new Set([...prev, ...newIds]))
      const timer = setTimeout(() => {
        setNewTradeIds((prev) => {
          const next = new Set(prev)
          newIds.forEach((id) => next.delete(id))
          return next
        })
      }, 1500)
      return () => clearTimeout(timer)
    }
  }, [trades])

  const pageSize = 20
  const filteredTrades = trades.filter((t) =>
    filterBySize ? t.amount > Number(filterValue || '0') : true,
  )
  const totalPages = Math.max(1, Math.ceil(filteredTrades.length / pageSize))
  const pageStart = (currentPage - 1) * pageSize
  const tableTrades = filteredTrades.slice(pageStart, pageStart + pageSize)

  const totalVolume = trades.reduce((sum, t) => sum + t.amount, 0)
  const buyCount = trades.filter((t) => t.type === 'buy').length
  const sellCount = trades.filter((t) => t.type === 'sell').length
  const latestTrade = trades[0]

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      {/* Stats bar */}
      <div className="grid grid-cols-2 border-b border-border sm:grid-cols-5">
        {[
          { label: 'Volume', value: `${totalVolume.toFixed(3)} MON`, color: '' },
          { label: 'Last Trade', value: latestTrade ? `${latestTrade.amount.toFixed(4)} MON` : '--', color: '' },
          { label: 'Buys', value: String(buyCount), color: 'text-emerald-500' },
          { label: 'Sells', value: String(sellCount), color: 'text-red-500' },
          { label: 'Trades', value: String(trades.length), color: '' },
        ].map((stat, i) => (
          <div
            key={stat.label}
            className={cn(
              'p-3 text-center',
              i < 2 ? 'border-b border-border sm:border-b-0' : '',
              i < 4 ? 'border-r border-border' : '',
              i < 2 ? 'border-r' : '',
            )}
          >
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{stat.label}</p>
            <p className={cn('font-mono text-sm font-bold', stat.color || 'text-foreground')}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs + filter */}
      <div className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1">
          <button
            onClick={() => setActiveTab('comments')}
            className={cn(
              'flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
              activeTab === 'comments'
                ? 'bg-secondary text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            Comments
          </button>
          <button
            onClick={() => setActiveTab('trades')}
            className={cn(
              'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
              activeTab === 'trades'
                ? 'bg-secondary text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            Trades
            {buyCount + sellCount > 0 && (
              <span className="ml-1.5 rounded-full bg-primary/20 px-1.5 py-0.5 text-[10px] text-primary">
                {buyCount + sellCount}
              </span>
            )}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Min size</span>
          <Switch checked={filterBySize} onCheckedChange={setFilterBySize} />
          {filterBySize && (
            <div className="flex items-center gap-1 rounded-lg border border-border bg-secondary/40 px-2 py-1">
              <span className="text-xs text-muted-foreground">{'>'}</span>
              <input
                type="text"
                value={filterValue}
                onChange={(e) => setFilterValue(e.target.value)}
                className="w-12 bg-transparent text-center text-xs text-foreground focus:outline-none"
              />
              <span className="text-xs text-muted-foreground">MON</span>
            </div>
          )}
        </div>
      </div>

      {activeTab === 'trades' ? (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px]">
              <thead>
                <tr className="border-b border-border">
                  {['Account', 'Type', 'MON', 'Tokens', 'Price', 'Time', 'Tx'].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tableTrades.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-sm text-muted-foreground">
                      No trades yet. Be the first to trade!
                    </td>
                  </tr>
                )}
                {tableTrades.map((trade) => {
                  const isNew = newTradeIds.has(trade.id)
                  const isBuy = trade.type === 'buy'
                  return (
                    <tr
                      key={trade.id}
                      className={cn(
                        'border-b border-border/30 text-sm transition-colors duration-700',
                        isNew
                          ? isBuy
                            ? 'bg-emerald-500/20'
                            : 'bg-red-500/20'
                          : isBuy
                          ? 'hover:bg-emerald-500/[0.04]'
                          : 'hover:bg-red-500/[0.04]',
                      )}
                    >
                      {/* Account */}
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <div
                            className="h-6 w-6 shrink-0 rounded-full"
                            style={{ background: addressToGradient(trade.account) }}
                          />
                          <span className="font-mono text-xs text-foreground">
                            {formatAddress(trade.account)}
                          </span>
                          {isNew && (
                            <span
                              className={cn(
                                'rounded px-1 py-0.5 text-[9px] font-bold uppercase',
                                isBuy
                                  ? 'bg-emerald-500/20 text-emerald-400'
                                  : 'bg-red-500/20 text-red-400',
                              )}
                            >
                              new
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Type badge */}
                      <td className="px-4 py-2.5">
                        <span
                          className={cn(
                            'rounded-md px-2 py-0.5 text-[11px] font-bold',
                            isBuy
                              ? 'bg-emerald-500/15 text-emerald-400'
                              : 'bg-red-500/15 text-red-400',
                          )}
                        >
                          {isBuy ? 'BUY' : 'SELL'}
                        </span>
                      </td>

                      {/* MON amount */}
                      <td className="px-4 py-2.5 font-mono text-xs text-foreground">
                        {trade.amount.toFixed(4)}
                      </td>

                      {/* Token amount */}
                      <td className="max-w-[110px] px-4 py-2.5">
                        <span
                          className="block truncate font-mono text-xs text-cyan-400"
                          title={String(trade.tokenAmount)}
                        >
                          {formatAbbreviatedTokenAmount(trade.tokenAmount)}
                        </span>
                      </td>

                      {/* Price */}
                      <td className="px-4 py-2.5 font-mono text-xs text-foreground">
                        {trade.tokenAmount > 0
                          ? formatTokenPrice(trade.amount / trade.tokenAmount)
                          : '—'}
                      </td>

                      {/* Time */}
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">
                        {mounted ? formatTimeAgo(trade.time) : '--'}
                      </td>

                      {/* Tx link */}
                      <td className="px-4 py-2.5">
                        <a
                          href={`https://testnet.monadexplorer.com/tx/${trade.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={cn(
                            'inline-flex h-6 w-6 items-center justify-center rounded-md transition-colors',
                            isBuy
                              ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/25'
                              : 'bg-red-500/10 text-red-400 hover:bg-red-500/25',
                          )}
                        >
                          <ArrowUpRight className="h-3.5 w-3.5" />
                        </a>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination — only shown when needed */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-1 border-t border-border p-3">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCurrentPage(1)} disabled={currentPage === 1}>
                <ChevronsLeft className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}>
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <span className="px-3 font-mono text-xs text-muted-foreground">
                {currentPage} / {totalPages}
              </span>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages}>
                <ChevronsRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-col items-center justify-center gap-2 py-14 text-muted-foreground">
          <MessageSquare className="h-8 w-8 opacity-30" />
          <p className="text-sm">Comments coming soon.</p>
        </div>
      )}
    </div>
  )
}

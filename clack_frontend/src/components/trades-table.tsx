'use client'

import { useState, useEffect } from 'react'
import { formatAddress, formatTimeAgo } from '@/lib/format'
import type { Trade } from '@/lib/ui-types'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { 
  ArrowRight, 
  ChevronLeft, 
  ChevronRight, 
  ChevronsLeft, 
  ChevronsRight,
  MessageSquare
} from 'lucide-react'

interface TradesTableProps {
  trades: Trade[]
}

export function TradesTable({ trades }: TradesTableProps) {
  const [activeTab, setActiveTab] = useState<'comments' | 'trades'>('trades')
  const [filterBySize, setFilterBySize] = useState(false)
  const [filterValue, setFilterValue] = useState('0.05')
  const [currentPage, setCurrentPage] = useState(1)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const pageSize = 20
  const filteredTrades = trades.filter((trade) =>
    filterBySize ? trade.amount > Number(filterValue || '0') : true
  )
  const totalPages = Math.max(1, Math.ceil(filteredTrades.length / pageSize))
  const pageStart = (currentPage - 1) * pageSize
  const tableTrades = filteredTrades.slice(pageStart, pageStart + pageSize)
  const totalVolume = trades.reduce((sum, trade) => sum + trade.amount, 0)
  const latestTrade = trades[0]
  const buyTrades = trades.filter((trade) => trade.type === 'buy').length
  const sellTrades = trades.filter((trade) => trade.type === 'sell').length

  return (
    <div className="rounded-xl border border-border bg-card">
      {/* Stats Bar */}
      <div className="grid grid-cols-5 border-b border-border">
        <div className="border-r border-border p-4 text-center">
          <p className="text-xs text-muted-foreground">Vol 24h</p>
          <p className="font-mono text-sm font-bold text-foreground">{totalVolume.toFixed(3)} MON</p>
        </div>
        <div className="border-r border-border p-4 text-center">
          <p className="text-xs text-muted-foreground">Last Trade</p>
          <p className="font-mono text-sm font-bold text-foreground">
            {latestTrade ? `${latestTrade.amount.toFixed(4)} MON` : '--'}
          </p>
        </div>
        <div className="border-r border-border p-4 text-center">
          <p className="text-xs text-muted-foreground">Buys</p>
          <p className="font-mono text-sm font-bold text-emerald-500">{buyTrades}</p>
        </div>
        <div className="border-r border-border p-4 text-center">
          <p className="text-xs text-muted-foreground">Sells</p>
          <p className="font-mono text-sm font-bold text-red-500">{sellTrades}</p>
        </div>
        <div className="p-4 text-center">
          <p className="text-xs text-muted-foreground">Trades</p>
          <p className="font-mono text-sm font-bold text-foreground">{trades.length}</p>
        </div>
      </div>

      {/* Tabs & Filter */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex gap-1">
          <button
            onClick={() => setActiveTab('comments')}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'comments'
                ? 'bg-secondary text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <MessageSquare className="h-4 w-4" />
            Comments
          </button>
          <button
            onClick={() => setActiveTab('trades')}
            className={`relative rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'trades'
                ? 'bg-secondary text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Trades
            {activeTab === 'trades' && (
              <div className="absolute -bottom-3 left-0 right-0 h-0.5 bg-amber-500" />
            )}
          </button>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">Filter by size</span>
          <Switch
            checked={filterBySize}
            onCheckedChange={setFilterBySize}
          />
          {filterBySize && (
            <div className="flex items-center gap-1 rounded-lg bg-secondary px-2 py-1">
              <span className="text-xs text-muted-foreground">&gt;</span>
              <input
                type="text"
                value={filterValue}
                onChange={(e) => setFilterValue(e.target.value)}
                className="w-12 bg-transparent text-center text-xs text-foreground focus:outline-none"
              />
            </div>
          )}
          <span className="text-xs text-muted-foreground">
            (showing trades greater than {filterValue} MON)
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="px-4 py-3 font-medium">Account</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Amount (MON)</th>
              <th className="px-4 py-3 font-medium">Amount (Token)</th>
              <th className="px-4 py-3 font-medium">Time</th>
              <th className="px-4 py-3 font-medium">Txn</th>
            </tr>
          </thead>
          <tbody>
            {tableTrades.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-sm text-muted-foreground">
                  Trade bulunamadi.
                </td>
              </tr>
            )}
            {tableTrades.map((trade) => (
              <tr
                key={trade.id}
                className="border-b border-border/30 text-sm transition-colors hover:bg-secondary/20"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-500/20">
                      <span className="text-xs">😊</span>
                    </div>
                    <span className="font-mono font-medium text-foreground">
                      {formatAddress(trade.account)}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`font-medium ${
                      trade.type === 'buy' ? 'text-emerald-500' : 'text-red-500'
                    }`}
                  >
                    {trade.type === 'buy' ? 'Buy' : 'Sell'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="font-mono text-emerald-500">
                    {trade.amount.toFixed(6)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="font-mono text-cyan-400">
                    {trade.tokenAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {mounted ? formatTimeAgo(trade.time) : '--'}
                </td>
                <td className="px-4 py-3">
                  <a
                    href={`https://explorer.monad.xyz/tx/${trade.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center text-emerald-500 transition-colors hover:text-emerald-400"
                  >
                    <ArrowRight className="h-5 w-5" />
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-center gap-2 border-t border-border p-4">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setCurrentPage(1)}
          disabled={currentPage === 1}
        >
          <ChevronsLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
          disabled={currentPage === 1}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        
        <span className="px-4 font-mono text-sm text-muted-foreground">
          {currentPage} / {totalPages}
        </span>
        
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
          disabled={currentPage === totalPages}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setCurrentPage(totalPages)}
          disabled={currentPage === totalPages}
        >
          <ChevronsRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

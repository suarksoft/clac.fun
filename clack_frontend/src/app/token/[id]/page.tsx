'use client'

import { use, useState, useEffect } from 'react'
import { Header } from '@/components/header'
import { LiveTicker } from '@/components/live-ticker'
import { PriceChart } from '@/components/price-chart'
import { TradePanel } from '@/components/trade-panel'
import { TokenInfoPanel } from '@/components/token-info-panel'
import { TradesTable } from '@/components/trades-table'
import { formatTimeAgo, formatNumber } from '@/lib/format'
import type { Trade } from '@/lib/ui-types'
import { Button } from '@/components/ui/button'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeft, Copy, Share2, Star, ExternalLink, Search } from 'lucide-react'
import { useDeathClock } from '@/hooks/use-death-clock'
import { useQuery } from '@tanstack/react-query'
import { apiClient, createSocketClient } from '@/lib/api/client'
import { toUiToken, toUiTrade } from '@/lib/api/mappers'

export default function TokenDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const resolvedTokenId = Number(id)
  const [liveTrades, setLiveTrades] = useState<Trade[]>([])
  const [mounted, setMounted] = useState(false)
  const tokenQuery = useQuery({
    queryKey: ['token', id],
    queryFn: () => apiClient.getToken(id),
    refetchInterval: 10000,
  })
  const tradesQuery = useQuery({
    queryKey: ['token-trades', id],
    queryFn: () => apiClient.getTradesByToken(id),
    refetchInterval: 10000,
  })
  const token = tokenQuery.data ? toUiToken(tokenQuery.data) : null
  const pageTradeTokenId = Number.isFinite(resolvedTokenId) ? BigInt(resolvedTokenId) : BigInt(0)
  const death = useDeathClock(token?.createdAt ?? new Date(), token?.durationSeconds ?? 1)
  const isDead = token?.dead || death.isDead
  const [displayPrice, setDisplayPrice] = useState(0)
  const displayMonPrice = displayPrice > 0 ? displayPrice.toExponential(3) : '0.00000000'

  useEffect(() => {
    if (token) {
      setDisplayPrice(token.price)
    }
  }, [token])

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (tradesQuery.data) {
      setLiveTrades(tradesQuery.data.map(toUiTrade))
    }
  }, [tradesQuery.data])

  useEffect(() => {
    if (!token) return
    const socket = createSocketClient()
    const tokenId = Number(id)

    socket.on('trade', (payload) => {
      if (payload.tokenId !== tokenId) return

      const nextTrade: Trade = {
        id: crypto.randomUUID(),
        tokenId: String(payload.tokenId),
        tokenSymbol: token.symbol,
        tokenImage: token.image,
        type: payload.isBuy ? 'buy' : 'sell',
        account: payload.trader,
        amount: Number(payload.monAmount || 0),
        value: Number(payload.monAmount || 0),
        tokenAmount: Number(payload.tokenAmount || 0),
        time: new Date(),
        txHash: payload.txHash || '',
      }

      setLiveTrades((prev) => [nextTrade, ...prev].slice(0, 50))
      if (payload.newPrice) {
        setDisplayPrice(Number(payload.newPrice))
      }
    })

    socket.on('tokenClacced', (payload) => {
      if (payload.tokenId !== tokenId) return
      setDisplayPrice(0)
    })

    return () => {
      socket.disconnect()
    }
  }, [id, token])

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  if (tokenQuery.isError) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Header />
        <LiveTicker />
        <main className="flex flex-1 items-center justify-center text-red-400">Token verisi alinamadi.</main>
      </div>
    )
  }

  if (tokenQuery.isLoading || !token) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Header />
        <LiveTicker />
        <main className="flex flex-1 items-center justify-center text-muted-foreground">Token yukleniyor...</main>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <LiveTicker />

      <main className="flex-1">
        <div className="mx-auto w-full max-w-[1680px] px-3 py-4 sm:px-4 lg:px-6">
          {isDead && (
            <div className="mb-4 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-center">
              <p className="text-lg font-bold text-red-500">💀 ${token.symbol} GOT CLAC'D</p>
            </div>
          )}
          <div className="mb-4 rounded-xl border border-border bg-card/70 px-3 py-3 sm:px-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <Link
                  href="/"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-muted-foreground transition-colors hover:bg-secondary/80 hover:text-foreground"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Link>
                <div className="relative h-10 w-10 overflow-hidden rounded-full">
                  <Image
                    src={token.image}
                    alt={token.name}
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h1 className="truncate text-lg font-bold text-foreground sm:text-xl">{token.name}</h1>
                    <span className="text-sm text-muted-foreground">/ MON</span>
                    <button className="text-muted-foreground transition-colors hover:text-foreground">
                      <Search className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                    <span>Token ID:</span>
                    <button
                      onClick={() => copyToClipboard(token.id)}
                      className="flex items-center gap-1 font-mono transition-colors hover:text-foreground"
                    >
                      #{token.id}
                      <Copy className="h-3 w-3" />
                    </button>
                    <span className="hidden sm:inline">|</span>
                    <span>Created by</span>
                    <div className="h-3 w-3 rounded-full bg-emerald-500" />
                    <span className="font-mono">{token.creator.slice(0, 6)}...{token.creator.slice(-4)}</span>
                    <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px]">AI</span>
                  </div>
                </div>
              </div>

              <div className="ml-auto flex items-center gap-3">
                <div className="text-right">
                  <p className="font-mono text-xl font-bold text-foreground sm:text-2xl">
                    {displayMonPrice} MON
                  </p>
                  <p className="text-sm text-emerald-500">+64.27%</p>
                </div>

                <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon" className="h-9 w-9">
                    <Share2 className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" className="h-9 w-9">
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" className="h-9 w-9">
                    <Star className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
              <div className="rounded-lg border border-border bg-secondary/40 px-3 py-2">
                <p className="text-[11px] text-muted-foreground">Market Cap</p>
                <p className="font-mono text-sm font-semibold text-foreground">{formatNumber(token.marketCap)}</p>
              </div>
              <div className="rounded-lg border border-border bg-secondary/40 px-3 py-2">
                <p className="text-[11px] text-muted-foreground">Virtual Liquidity</p>
                <p className="font-mono text-sm font-semibold text-foreground">10K MON</p>
              </div>
              <div className="rounded-lg border border-border bg-secondary/40 px-3 py-2">
                <p className="text-[11px] text-muted-foreground">24h Volume</p>
                <p className="font-mono text-sm font-semibold text-foreground">{formatNumber(token.volume24h)}</p>
              </div>
              <div className="rounded-lg border border-border bg-secondary/40 px-3 py-2">
                <p className="text-[11px] text-muted-foreground">Creation Time</p>
                <p className="font-mono text-sm font-semibold text-foreground">
                  {mounted ? formatTimeAgo(token.createdAt) : '--'}
                </p>
              </div>
            </div>

            <div className={`mt-3 rounded-xl border px-4 py-3 ${
              isDead
                ? 'border-red-500/50 bg-red-500/10'
                : death.status === 'critical'
                ? 'border-red-500/50 bg-red-500/10'
                : death.status === 'dying'
                ? 'border-orange-500/50 bg-orange-500/10'
                : 'border-border bg-secondary/30'
            }`}>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-semibold text-foreground">Death Clock</span>
                <span className={`rounded-full px-2 py-1 text-xs font-bold ${
                  isDead
                    ? 'bg-red-600 text-white'
                    : death.status === 'critical'
                    ? 'animate-pulse bg-red-500 text-white'
                    : death.status === 'dying'
                    ? 'bg-orange-500 text-white'
                    : 'bg-white/10 text-foreground'
                }`}>
                  {isDead ? "💀 CLAC'D" : death.status === 'dying' || death.status === 'critical' ? '⚠️ DYING SOON' : '🟢 LIVE'}
                </span>
              </div>
              <div className={`font-mono text-3xl font-bold sm:text-4xl ${
                isDead
                  ? 'text-red-500'
                  : death.status === 'critical'
                  ? 'animate-pulse text-red-400'
                  : death.status === 'dying'
                  ? 'text-orange-400'
                  : 'text-foreground'
              }`}>
                {isDead ? "💀 CLAC'D" : death.compactText}
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-secondary">
                <div
                  className={`h-full rounded-full transition-all ${
                    isDead
                      ? 'bg-red-500'
                      : death.status === 'critical'
                      ? 'animate-pulse bg-red-500'
                      : 'bg-gradient-to-r from-emerald-500 via-yellow-500 via-orange-500 to-red-500'
                  }`}
                  style={{ width: `${isDead ? 0 : death.percentage}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Created at {death.createdAtLabel} • Dies at {death.diesAtLabel}
              </p>
            </div>
          </div>

          <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_380px] 2xl:grid-cols-[minmax(0,1fr)_420px]">
            <div className="space-y-4">
              <div className="relative">
                <PriceChart
                  currentPrice={token.marketCap}
                  priceChange={token.priceChange24h}
                  high={token.marketCap * 1.05}
                  low={token.marketCap * 0.92}
                  open={token.marketCap * 0.98}
                  trades={liveTrades}
                />
                {isDead && (
                  <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/55 backdrop-blur-[1px]">
                    <span className="font-mono text-4xl font-bold tracking-widest text-red-500/90">
                      CLAC'D
                    </span>
                  </div>
                )}
              </div>
              <TradesTable trades={liveTrades} />
            </div>

            <aside className="space-y-4 lg:sticky lg:top-20">
              {isDead ? (
                <div className="rounded-xl border border-border bg-card p-4">
                  <h3 className="mb-3 text-lg font-semibold text-foreground">Final Results</h3>
                  <div className="space-y-2 font-mono text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Pool at death:</span><span>--</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Death tax (5%):</span><span>--</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Pro-rata (65%):</span><span>--</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Lottery (30%):</span><span>--</span></div>
                  </div>
                  <div className="my-4 border-t border-border pt-3">
                    <p className="mb-2 text-sm font-semibold text-amber-400">🎰 Lottery Winners</p>
                    <p className="text-sm text-muted-foreground">Veri bekleniyor.</p>
                  </div>
                  <p className="mb-2 text-sm text-foreground">
                    Your claim: <span className="font-mono text-amber-400">{token.claimableMon.toFixed(4)} MON</span>
                  </p>
                  <Button className="w-full bg-amber-500 text-black hover:bg-amber-400">
                    Claim {token.claimableMon.toFixed(4)} MON
                  </Button>
                </div>
              ) : (
                <TradePanel
                  tokenId={pageTradeTokenId}
                  tokenSymbol={token.symbol}
                  currentPrice={token.price}
                  isDead={isDead}
                  onTradeSuccess={() => {
                    tokenQuery.refetch()
                    tradesQuery.refetch()
                  }}
                />
              )}
              <TokenInfoPanel token={token} />
            </aside>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-card py-4">
        <div className="container mx-auto flex flex-col items-center justify-between gap-4 px-4 text-sm text-muted-foreground md:flex-row">
          <div className="flex items-center gap-4">
            <Image 
              src="/clac-logo.svg" 
              alt="Clac.fun" 
              width={24} 
              height={24}
            />
            <span className="font-semibold text-foreground">Clac.fun</span>
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

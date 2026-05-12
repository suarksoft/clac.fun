'use client'

import { useState, useEffect, useMemo } from 'react'
import { Header } from '@/components/header'
import { LiveTicker } from '@/components/live-ticker'
import { PriceChart } from '@/components/price-chart'
import { TradePanel } from '@/components/trade-panel'
import { TokenInfoPanel } from '@/components/token-info-panel'
import { TradesTable } from '@/components/trades-table'
import { formatTimeAgo, formatNumber, formatTokenPrice, formatMonAmount } from '@/lib/format'
import type { Trade } from '@/lib/ui-types'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import Image from 'next/image'
import { TokenImage } from '@/components/token-image'
import Link from 'next/link'
import { ArrowLeft, Copy, Share2, Star, ExternalLink, Search } from 'lucide-react'
import { useDeathClock } from '@/hooks/use-death-clock'
import { getDeathClockColor } from '@/lib/death-clock'
import { useQuery } from '@tanstack/react-query'
import { apiClient, createSocketClient } from '@/lib/api/client'
import { toUiToken, toUiTrade } from '@/lib/api/mappers'
import { CLAC_FACTORY_ABI, CLAC_FACTORY_ADDRESS } from '@/lib/web3/contracts'
import { formatEther } from 'viem'
import {
  useAccount,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from 'wagmi'

type TradeSocketPayload = {
  tokenId: number
  isBuy: boolean
  trader: string
  monAmount: string
  tokenAmount: string
  newPrice?: string
  txHash?: string
}

type TokenClaccedPayload = {
  tokenId: number
}

export function TokenDetailV1({ id }: { id: string }) {
  const [liveTrades, setLiveTrades] = useState<Trade[]>([])
  const [mounted, setMounted] = useState(false)

  const tokenQuery = useQuery({
    queryKey: ['token', id],
    queryFn: () => apiClient.getToken(id),
    refetchInterval: 10000,
  })
  const token = tokenQuery.data ? toUiToken(tokenQuery.data) : null
  const resolvedTokenId = tokenQuery.data?.id ?? 0
  const pageTradeTokenId = BigInt(resolvedTokenId)

  const tradesQuery = useQuery({
    queryKey: ['token-trades', resolvedTokenId],
    queryFn: () => apiClient.getTradesByToken(String(resolvedTokenId)),
    enabled: resolvedTokenId > 0,
    refetchInterval: 10000,
  })

  const death = useDeathClock(token?.createdAt ?? new Date(), token?.durationSeconds ?? 1)
  const isDead = token?.dead || death.isDead
  const [displayPrice, setDisplayPrice] = useState(0)
  const displayMonPrice = formatTokenPrice(displayPrice)
  const { address, isConnected } = useAccount()
  const { writeContractAsync, data: actionHash, isPending: isActionPending } = useWriteContract()
  const { isLoading: isActionConfirming } = useWaitForTransactionReceipt({ hash: actionHash })

  useEffect(() => {
    if (token) setDisplayPrice(token.price)
  }, [token])

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (tradesQuery.data) {
      setLiveTrades(tradesQuery.data.map(toUiTrade))
    }
  }, [tradesQuery.data])

  useEffect(() => {
    if (!token) return
    const socket = createSocketClient()
    const tokenId = Number(id)

    socket.on('trade', (payload: TradeSocketPayload) => {
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
        tokenAmount: Number(formatEther(BigInt(payload.tokenAmount || '0'))),
        time: new Date(),
        txHash: payload.txHash || '',
      }
      setLiveTrades((prev) => [nextTrade, ...prev].slice(0, 50))
      if (payload.newPrice) setDisplayPrice(Number(payload.newPrice))
    })

    socket.on('tokenClacced', (payload: TokenClaccedPayload) => {
      if (payload.tokenId !== tokenId) return
      setDisplayPrice(0)
    })

    return () => { socket.disconnect() }
  }, [id, token])

  const claimableQuery = useReadContract({
    address: CLAC_FACTORY_ADDRESS as `0x${string}`,
    abi: CLAC_FACTORY_ABI,
    functionName: 'getClaimable',
    args: [pageTradeTokenId, (address ?? '0x0000000000000000000000000000000000000000') as `0x${string}`],
    query: {
      enabled: isConnected && Boolean(address) && Boolean(token?.dead),
      refetchInterval: 10_000,
    },
  })

  const claimableFromChain = claimableQuery.data
    ? Number(claimableQuery.data) / 1e18
    : (token?.claimableMon ?? 0)
  const canClaim = Boolean(token?.dead) && claimableFromChain > 0
  const canTriggerDeath = !Boolean(token?.dead) && death.isDead

  const tradeStats = useMemo(() => {
    const buyCount = liveTrades.filter((t) => t.type === 'buy').length
    const sellCount = liveTrades.filter((t) => t.type === 'sell').length
    return { totalTxns: liveTrades.length, buyCount, sellCount }
  }, [liveTrades])

  const copyToClipboard = (text: string) => { navigator.clipboard.writeText(text) }

  const handleTriggerDeath = async () => {
    await writeContractAsync({
      address: CLAC_FACTORY_ADDRESS as `0x${string}`,
      abi: CLAC_FACTORY_ABI,
      functionName: 'triggerDeath',
      args: [pageTradeTokenId],
    })
    await tokenQuery.refetch()
    await tradesQuery.refetch()
  }

  const handleClaim = async () => {
    await writeContractAsync({
      address: CLAC_FACTORY_ADDRESS as `0x${string}`,
      abi: CLAC_FACTORY_ABI,
      functionName: 'claim',
      args: [pageTradeTokenId],
    })
    await tokenQuery.refetch()
    await tradesQuery.refetch()
    await claimableQuery.refetch()
  }

  if (tokenQuery.isError) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Header /><LiveTicker />
        <main className="flex flex-1 items-center justify-center text-red-400">Failed to load token data.</main>
      </div>
    )
  }

  if (tokenQuery.isLoading || !token) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Header /><LiveTicker />
        <main className="flex-1 px-4 py-6">
          <div className="mx-auto max-w-[1680px] space-y-4">
            <Skeleton className="h-36 w-full rounded-xl" />
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
              <Skeleton className="h-[520px] w-full rounded-xl" />
              <div className="space-y-4">
                <Skeleton className="h-[320px] w-full rounded-xl" />
                <Skeleton className="h-[260px] w-full rounded-xl" />
              </div>
            </div>
          </div>
        </main>
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
              <p className="text-lg font-bold text-red-500">💀 {token.name} GOT CLAC&apos;D</p>
            </div>
          )}

          <div className="mb-4 rounded-xl border border-border bg-card/70 px-3 py-3 sm:px-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <Link
                  href="/"
                  className="flex h-11 min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground transition-colors hover:bg-secondary/80 hover:text-foreground"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Link>
                <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full">
                  <TokenImage src={token.image} alt={token.name} fill className="object-cover" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <h1 className="truncate text-lg font-bold text-foreground sm:text-xl">{token.name}</h1>
                    <span className="shrink-0 text-sm text-muted-foreground">/ MON</span>
                    <button type="button" className="text-muted-foreground transition-colors hover:text-foreground" aria-label="Search">
                      <Search className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                    <span>Token ID:</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(token.id)}
                      className="flex items-center gap-1 font-mono transition-colors hover:text-foreground"
                    >
                      #{token.id}
                      <Copy className="h-3 w-3" />
                    </button>
                    <span className="hidden sm:inline">|</span>
                    <span>Created by</span>
                    <div className="h-3 w-3 shrink-0 rounded-full bg-emerald-500" />
                    <span className="truncate font-mono">{token.creator.slice(0, 6)}...{token.creator.slice(-4)}</span>
                    <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px]">AI</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 md:justify-end">
                <div className="text-left md:text-right">
                  <p className="font-mono text-lg font-bold text-foreground sm:text-xl md:text-2xl">{displayMonPrice} MON</p>
                  <p className={`text-sm font-semibold ${token.priceChange24h >= 0 ? 'text-emerald-500' : 'text-red-400'}`}>
                    {token.priceChange24h >= 0 ? '+' : ''}{token.priceChange24h.toFixed(2)}%
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1 sm:gap-2">
                  <Button variant="outline" size="icon" className="h-11 min-h-[44px] min-w-[44px] sm:h-9 sm:min-h-0 sm:min-w-0"><Share2 className="h-4 w-4" /></Button>
                  <Button variant="outline" size="icon" className="h-11 min-h-[44px] min-w-[44px] sm:h-9 sm:min-h-0 sm:min-w-0"><ExternalLink className="h-4 w-4" /></Button>
                  <Button variant="outline" size="icon" className="h-11 min-h-[44px] min-w-[44px] sm:h-9 sm:min-h-0 sm:min-w-0"><Star className="h-4 w-4" /></Button>
                </div>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
              {[
                { label: 'Market Cap', value: formatNumber(token.marketCap) },
                { label: 'Virtual Liquidity', value: `${formatMonAmount(token.poolBalanceMon, 4)} MON` },
                { label: '24h Volume', value: formatNumber(token.volume24h) },
                { label: 'Creation Time', value: mounted ? formatTimeAgo(token.createdAt) : '--' },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-xl border border-border bg-secondary/40 p-3">
                  <p className="truncate text-xs text-muted-foreground">{label}</p>
                  <p className="truncate font-mono text-sm font-semibold text-foreground">{value}</p>
                </div>
              ))}
            </div>

            <div className={`mt-3 rounded-xl border px-4 py-3 ${
              isDead ? 'border-red-500/50 bg-red-500/10'
              : death.status === 'critical' ? 'border-red-500/50 bg-red-500/10'
              : death.status === 'dying' ? 'border-orange-500/50 bg-orange-500/10'
              : 'border-border bg-secondary/30'
            }`}>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-semibold text-foreground">Death Clock</span>
                <span className={`rounded-full px-2 py-1 text-xs font-bold ${
                  isDead ? 'bg-red-600 text-white'
                  : death.status === 'critical' ? 'animate-pulse bg-red-500 text-white'
                  : death.status === 'dying' ? 'bg-orange-500 text-white'
                  : 'bg-white/10 text-foreground'
                }`}>
                  {isDead ? "💀 CLAC'D" : death.status === 'dying' || death.status === 'critical' ? '⚠️ DYING SOON' : '🟢 LIVE'}
                </span>
              </div>
              <div className={`font-mono text-3xl font-bold sm:text-4xl ${isDead ? 'text-red-500' : getDeathClockColor(death.remainingSeconds)}`}>
                {isDead ? "💀 CLAC'D" : death.compactText}
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-secondary">
                <div
                  className={`h-full rounded-full transition-all ${
                    isDead ? 'bg-red-500'
                    : death.status === 'critical' ? 'animate-pulse bg-red-500'
                    : 'bg-gradient-to-r from-emerald-500 via-yellow-500 via-orange-500 to-red-500'
                  }`}
                  style={{ width: `${isDead ? 100 : death.percentage}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                <span className="hidden sm:inline">Created at {death.createdAtLabel} • Dies at {death.diesAtLabel}</span>
                <span className="sm:hidden">{death.createdAtLabel} → {death.diesAtLabel}</span>
              </p>
            </div>
          </div>

          <div className="flex flex-col-reverse gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_380px] 2xl:grid-cols-[minmax(0,1fr)_420px] lg:items-start">
            <div className="min-w-0 space-y-4">
              <div className="relative">
                <PriceChart
                  tokenId={resolvedTokenId}
                  symbol={token.symbol}
                  currentPrice={displayPrice || token.price}
                  virtualSupply={token.virtualSupply}
                />
                {isDead && (
                  <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/55 backdrop-blur-[1px]">
                    <span className="font-mono text-4xl font-bold tracking-widest text-red-500/90">CLAC&apos;D</span>
                  </div>
                )}
              </div>
              <TradesTable trades={liveTrades} />
            </div>

            <aside className="min-w-0 space-y-4 lg:sticky lg:top-20">
              {isDead ? (
                <div className="rounded-xl border border-border bg-card p-4">
                  <h3 className="mb-3 text-lg font-semibold text-red-500">💀 Final Results</h3>
                  {(() => {
                    const poolAtDeath = token.poolBalanceMon
                    const deathTax = poolAtDeath * 0.03
                    const proRata = poolAtDeath * 0.77
                    const lottery = poolAtDeath * 0.20
                    return (
                      <div className="space-y-2 font-mono text-sm">
                        <div className="flex justify-between"><span className="text-muted-foreground">Pool at death:</span><span>{formatMonAmount(poolAtDeath, 4)} MON</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Death tax (3%):</span><span>{formatMonAmount(deathTax, 4)} MON</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Pro-rata (77%):</span><span>{formatMonAmount(proRata, 4)} MON</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Lottery (20%):</span><span>{formatMonAmount(lottery, 4)} MON</span></div>
                      </div>
                    )
                  })()}
                  <div className="my-4 border-t border-border pt-3">
                    <p className="mb-2 text-sm font-semibold text-amber-400">🎰 Lottery Winners</p>
                    <p className="text-sm text-muted-foreground">Veri bekleniyor.</p>
                  </div>
                  <p className="mb-2 text-sm text-foreground">
                    Your claim: <span className="font-mono text-amber-400">{claimableFromChain.toFixed(4)} MON</span>
                  </p>
                  <Button
                    className="w-full bg-amber-500 text-black hover:bg-amber-400"
                    onClick={handleClaim}
                    disabled={!canClaim || isActionPending || isActionConfirming}
                  >
                    {isActionPending || isActionConfirming ? 'Claiming...' : `Claim ${formatMonAmount(claimableFromChain, 4)} MON`}
                  </Button>
                </div>
              ) : (
                <TradePanel
                  tokenId={pageTradeTokenId}
                  tokenSymbol={token.symbol}
                  currentPrice={token.price}
                  virtualSupply={token.virtualSupply}
                  isDead={isDead}
                  onTradeSuccess={() => { tokenQuery.refetch(); tradesQuery.refetch() }}
                />
              )}
              {canTriggerDeath && (
                <Button
                  className="w-full bg-red-500 text-white hover:bg-red-600"
                  onClick={handleTriggerDeath}
                  disabled={isActionPending || isActionConfirming}
                >
                  {isActionPending || isActionConfirming ? 'Triggering Clac...' : 'Trigger Clac 💀'}
                </Button>
              )}
              <TokenInfoPanel
                token={token}
                totalTxns={tradeStats.totalTxns}
                buyCount={tradeStats.buyCount}
                sellCount={tradeStats.sellCount}
              />
            </aside>
          </div>
        </div>
      </main>

      <footer className="border-t border-border bg-card py-4">
        <div className="container mx-auto flex flex-col items-center justify-between gap-4 px-4 text-sm text-muted-foreground md:flex-row">
          <div className="flex items-center gap-4">
            <Image src="/clac-logo.svg" alt="Clac.fun" width={24} height={24} />
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

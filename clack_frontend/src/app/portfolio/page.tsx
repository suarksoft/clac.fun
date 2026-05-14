'use client'

import { useMemo } from 'react'
import { Header } from '@/components/header'
import { LiveTicker } from '@/components/live-ticker'
import { Button } from '@/components/ui/button'
import { Wallet, TrendingUp, TrendingDown, PieChart } from 'lucide-react'
import { TokenImage } from '@/components/token-image'
import Link from 'next/link'
import { useAccount, useChainId, useConnect, useSwitchChain } from 'wagmi'
import { useQuery } from '@tanstack/react-query'
import { apiClientV2 } from '@/lib/api/client-v2'
import { resolveTokenImageUrl } from '@/lib/api/mappers-v2'
import { monadTestnet } from '@/lib/web3/chains'
import { formatEther } from 'viem'

function formatMon(value: number) {
  return `${value.toLocaleString('en-US', { maximumFractionDigits: 4 })} MON`
}

function formatTimeLeft(createdAt: number, duration: number) {
  const left = createdAt + duration - Math.floor(Date.now() / 1000)
  if (left <= 0) return "💀 CLAC'D"
  const h = Math.floor(left / 3600)
  const m = Math.floor((left % 3600) / 60)
  const s = left % 60
  return `${h}h ${m}m ${s}s`
}

function weiToMon(value: string | bigint): number {
  try {
    const raw = typeof value === 'bigint' ? value : BigInt(value || '0')
    return Number(formatEther(raw))
  } catch (err) {
    console.error('[portfolio] weiToMon failed', err, value)
    return 0
  }
}

export default function PortfolioPage() {
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const { switchChain } = useSwitchChain()
  const { connect, connectors } = useConnect()
  const isWrongChain = isConnected && chainId !== monadTestnet.id

  const portfolioQuery = useQuery({
    queryKey: ['v2-portfolio', address],
    queryFn: () => apiClientV2.getPortfolio(address!.toLowerCase()),
    enabled: Boolean(address),
    refetchInterval: 20_000,
  })

  const holdings = useMemo(() => {
    if (!portfolioQuery.data) return []
    return portfolioQuery.data.map((h) => {
      const balance = weiToMon(h.balance)
      const valueMon = weiToMon(h.valueMon)
      return {
        ...h,
        uiBalance: balance,
        uiValueMon: valueMon,
      }
    })
  }, [portfolioQuery.data])

  const totalValueMon = holdings.reduce((sum, h) => sum + h.uiValueMon, 0)
  const livePositions = holdings.filter((h) => !h.deathFinalized).length
  const deadPositions = holdings.length - livePositions

  if (!isConnected) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Header />
        <LiveTicker />
        <main className="flex flex-1 items-center justify-center px-4">
          <div className="text-center">
            <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-primary/10">
              <Wallet className="h-12 w-12 text-primary" />
            </div>
            <h1 className="mb-2 text-2xl font-bold text-foreground">Connect</h1>
            <p className="mb-6 max-w-sm text-muted-foreground">
              Connect your wallet to view your holdings and trade history.
            </p>
            <Button
              className="gap-2 bg-primary px-8 py-6 text-lg text-primary-foreground hover:bg-primary/90"
              onClick={() => {
                const preferred = connectors[0]
                if (preferred) connect({ connector: preferred })
              }}
            >
              <Wallet className="h-5 w-5" />
              Connect
            </Button>
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
        <div className="container mx-auto max-w-7xl px-4 py-8">
          {isWrongChain && (
            <div className="mb-6 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-400">
              Wrong network — switch to Monad Testnet to claim or trade.
              <Button variant="link" className="ml-2 text-amber-300" onClick={() => switchChain({ chainId: monadTestnet.id })}>
                Switch
              </Button>
            </div>
          )}

          <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground md:text-sm">
                <PieChart className="h-4 w-4" />
                Total Value
              </div>
              <div className="text-xl font-bold text-foreground md:text-3xl">{formatMon(totalValueMon)}</div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground md:text-sm">
                <TrendingUp className="h-4 w-4" />
                Active Positions
              </div>
              <div className="text-xl font-bold text-foreground md:text-3xl">{livePositions}</div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground md:text-sm">
                <TrendingDown className="h-4 w-4" />
                Dead Positions
              </div>
              <div className="text-xl font-bold text-foreground md:text-3xl">{deadPositions}</div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card">
            <div className="border-b border-border p-4">
              <h2 className="text-lg font-semibold text-foreground">Positions</h2>
              {portfolioQuery.isError && (
                <p className="mt-1 text-xs text-red-400">
                  Failed to load portfolio. {(portfolioQuery.error as Error).message}
                </p>
              )}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <table className="min-w-[720px] w-full">
                <thead>
                  <tr className="border-b border-border text-left text-sm text-muted-foreground">
                    <th className="px-6 py-4">Token</th>
                    <th className="px-6 py-4">Balance</th>
                    <th className="px-6 py-4">Value</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Death Clock</th>
                    <th className="px-6 py-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {portfolioQuery.isLoading && (
                    <tr><td colSpan={6} className="px-6 py-10 text-center text-sm text-muted-foreground">Loading…</td></tr>
                  )}
                  {!portfolioQuery.isLoading && holdings.length === 0 && (
                    <tr><td colSpan={6} className="px-6 py-10 text-center text-sm text-muted-foreground">No positions yet.</td></tr>
                  )}
                  {holdings.map((h) => (
                    <tr key={h.tokenAddress} className="border-b border-border/50">
                      <td className="px-6 py-4">
                        <Link href={`/token/${h.tokenAddress}`} className="flex items-center gap-3 hover:opacity-80">
                          <div className="relative h-10 w-10 overflow-hidden rounded-full">
                            <TokenImage src={resolveTokenImageUrl(h.imageURI)} alt={h.tokenName} fill className="object-cover" />
                          </div>
                          <div>
                            <span className="mr-2 rounded bg-primary/20 px-1.5 py-0.5 text-xs font-bold text-primary">
                              {h.tokenSymbol}
                            </span>
                            <span className="font-medium text-foreground">{h.tokenName}</span>
                          </div>
                        </Link>
                      </td>
                      <td className="px-6 py-4 font-mono text-foreground">
                        {h.uiBalance.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4 font-mono text-foreground">{formatMon(h.uiValueMon)}</td>
                      <td className="px-6 py-4">
                        <span className={`rounded-full px-2 py-1 text-xs font-bold ${h.deathFinalized ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-500'}`}>
                          {h.deathFinalized ? "💀 CLAC'D" : '🟢 LIVE'}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-mono text-sm text-foreground">
                        {formatTimeLeft(h.createdAt, h.duration)}
                      </td>
                      <td className="px-6 py-4">
                        <Link href={`/token/${h.tokenAddress}`}>
                          <Button variant="outline" size="sm" className="border-primary/40 text-primary hover:bg-primary/10">
                            {h.deathFinalized ? 'Claim' : 'Trade'}
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-3 p-3 md:hidden">
              {portfolioQuery.isLoading && (
                <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
              )}
              {!portfolioQuery.isLoading && holdings.length === 0 && (
                <p className="py-6 text-center text-sm text-muted-foreground">No positions yet.</p>
              )}
              {holdings.map((h) => (
                <div key={h.tokenAddress} className="rounded-xl border border-border bg-secondary/20 p-4">
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <Link href={`/token/${h.tokenAddress}`} className="flex min-w-0 flex-1 items-center gap-3">
                      <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full">
                        <TokenImage src={resolveTokenImageUrl(h.imageURI)} alt={h.tokenName} fill className="object-cover" />
                      </div>
                      <div className="min-w-0">
                        <span className="mr-2 rounded bg-primary/20 px-1.5 py-0.5 text-xs font-bold text-primary">
                          {h.tokenSymbol}
                        </span>
                        <p className="truncate font-medium text-foreground">{h.tokenName}</p>
                      </div>
                    </Link>
                    <span className="shrink-0 font-mono text-xs text-muted-foreground">
                      {formatTimeLeft(h.createdAt, h.duration)}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 border-t border-border pt-3 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Balance</p>
                      <p className="font-mono font-medium text-foreground">
                        {h.uiBalance.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Value</p>
                      <p className="font-mono font-medium text-foreground">{formatMon(h.uiValueMon)}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex justify-end">
                    <Link href={`/token/${h.tokenAddress}`}>
                      <Button variant="outline" size="sm" className="min-h-[44px] border-primary/40 px-6 text-primary hover:bg-primary/10">
                        {h.deathFinalized ? 'Claim' : 'Trade'}
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

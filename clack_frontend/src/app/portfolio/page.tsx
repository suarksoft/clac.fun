'use client'

import { Header } from '@/components/header'
import { LiveTicker } from '@/components/live-ticker'
import { Button } from '@/components/ui/button'
import { Wallet, TrendingUp, TrendingDown, PieChart, History } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { useConnectModal } from '@rainbow-me/rainbowkit'
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api/client'
import { CLAC_FACTORY_ABI, CLAC_FACTORY_ADDRESS } from '@/lib/web3/contracts'
import { formatEther } from 'viem'

function formatUsd(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value)
}

function formatTimeLeft(createdAt: number, duration: number) {
  const left = createdAt + duration - Math.floor(Date.now() / 1000)
  if (left <= 0) return "💀 CLAC'D"
  const h = Math.floor(left / 3600)
  const m = Math.floor((left % 3600) / 60)
  const s = left % 60
  return `${h}h ${m}m ${s}s`
}

export default function PortfolioPage() {
  const { address, isConnected } = useAccount()
  const { openConnectModal } = useConnectModal()
  const { writeContractAsync, data: claimHash, isPending } = useWriteContract()
  const claimReceipt = useWaitForTransactionReceipt({ hash: claimHash })

  const portfolioQuery = useQuery({
    queryKey: ['portfolio', address],
    queryFn: () => apiClient.getPortfolio(address!),
    enabled: Boolean(address),
    refetchInterval: 15000,
  })

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
            <h1 className="mb-2 text-2xl font-bold text-foreground">Connect Your Wallet</h1>
            <p className="mb-6 max-w-sm text-muted-foreground">
              Connect your wallet to view your portfolio, track your holdings, and see your trading history.
            </p>
            <Button
              className="gap-2 bg-primary px-8 py-6 text-lg text-primary-foreground hover:bg-primary/90"
              onClick={() => openConnectModal?.()}
            >
              <Wallet className="h-5 w-5" />
              Connect Wallet
            </Button>
          </div>
        </main>
      </div>
    )
  }

  const portfolio = portfolioQuery.data
  const holdings = (portfolio?.holdings || []).map((holding) => {
    const tokenPrice = Number(formatEther(BigInt(holding.token.currentPrice || '0')))
    const balance = Number(formatEther(BigInt(holding.balance)))
    const value = tokenPrice * balance
    const buys = (portfolio?.trades || []).filter((trade) => trade.tokenId === holding.tokenId && trade.isBuy)
    const sells = (portfolio?.trades || []).filter((trade) => trade.tokenId === holding.tokenId && !trade.isBuy)
    const invested = buys.reduce((sum, trade) => sum + Number(formatEther(BigInt(trade.monAmount))), 0)
    const realized = sells.reduce((sum, trade) => sum + Number(formatEther(BigInt(trade.monAmount))), 0)
    const pnl = value + realized - invested

    return {
      ...holding,
      uiBalance: balance,
      uiValue: value,
      uiInvested: invested,
      uiPnl: pnl,
    }
  })

  const trades = portfolio?.trades || []
  const claims = portfolio?.claims || []
  const totalInvested = holdings.reduce((sum, item) => sum + item.uiInvested, 0)
  const totalValue = holdings.reduce((sum, item) => sum + item.uiValue, 0)
  const totalPnl = holdings.reduce((sum, item) => sum + item.uiPnl, 0)
  const pnlPercent = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0
  const bestTrade = trades
    .filter((trade) => !trade.isBuy)
    .reduce((best, current) =>
      Number(formatEther(BigInt(current.monAmount))) > Number(formatEther(BigInt(best?.monAmount || '0')))
        ? current
        : best,
    trades[0])

  const claimToken = async (tokenId: number) => {
    await writeContractAsync({
      address: CLAC_FACTORY_ADDRESS as `0x${string}`,
      abi: CLAC_FACTORY_ABI,
      functionName: 'claim',
      args: [BigInt(tokenId)],
    })
    portfolioQuery.refetch()
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <LiveTicker />

      <main className="flex-1">
        <div className="container mx-auto px-4 py-8">
          {/* Portfolio Summary */}
          <div className="mb-8 grid gap-4 md:grid-cols-4">
            <div className="rounded-xl border border-border bg-card p-6">
              <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
                <PieChart className="h-4 w-4" />
                Total Invested
              </div>
              <div className="text-3xl font-bold text-foreground">
                {formatUsd(totalInvested)}
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card p-6">
              <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
                <PieChart className="h-4 w-4" />
                Current Value
              </div>
              <div className="text-3xl font-bold text-foreground">{formatUsd(totalValue)}</div>
            </div>
            <div className="rounded-xl border border-border bg-card p-6">
              <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
                {totalPnl >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                PnL (%)
              </div>
              <div className={`text-3xl font-bold ${totalPnl >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                {pnlPercent >= 0 ? '+' : ''}
                {pnlPercent.toFixed(2)}%
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card p-6">
              <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
                <History className="h-4 w-4" />
                Best Trade (Xx)
              </div>
              <div className="text-3xl font-bold text-foreground">
                {bestTrade ? `${Math.max(Number(formatEther(BigInt(bestTrade.monAmount))), 1).toFixed(2)}x` : '--'}
              </div>
            </div>
          </div>

          {/* Holdings */}
          <div className="rounded-xl border border-border bg-card">
            <div className="border-b border-border p-4">
              <h2 className="text-lg font-semibold text-foreground">Active Positions</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border text-left text-sm text-muted-foreground">
                    <th className="px-6 py-4">Token</th>
                    <th className="px-6 py-4">Balance</th>
                    <th className="px-6 py-4">Value</th>
                    <th className="px-6 py-4">P&L</th>
                    <th className="px-6 py-4">Death Clock</th>
                    <th className="px-6 py-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {holdings.map((holding) => (
                    <tr key={holding.id} className="border-b border-border/50">
                      <td className="px-6 py-4">
                        <Link href={`/token/${holding.id}`} className="flex items-center gap-3 hover:opacity-80">
                          <div className="relative h-10 w-10 overflow-hidden rounded-full">
                            <Image src={holding.image} alt={holding.name} fill className="object-cover" />
                          </div>
                          <div>
                            <span className="mr-2 rounded bg-primary/20 px-1.5 py-0.5 text-xs font-bold text-primary">
                              {holding.symbol}
                            </span>
                            <span className="font-medium text-foreground">{holding.name}</span>
                          </div>
                        </Link>
                      </td>
                      <td className="px-6 py-4 font-mono text-foreground">
                        {holding.uiBalance.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                      </td>
                      <td className="px-6 py-4 font-mono text-foreground">
                        {formatUsd(holding.uiValue)}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`font-mono ${holding.uiPnl >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                          {holding.uiPnl >= 0 ? '+' : ''}
                          {formatUsd(holding.uiPnl)}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-mono text-sm text-foreground">
                        {formatTimeLeft(holding.token.createdAt, holding.token.duration)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <Link href={`/token/${holding.tokenId}`}>
                            <Button variant="outline" size="sm" className="border-emerald-500/50 text-emerald-500 hover:bg-emerald-500/10">
                              Sell
                            </Button>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-8 rounded-xl border border-border bg-card">
            <div className="border-b border-border p-4">
              <h2 className="text-lg font-semibold text-foreground">Claimable</h2>
            </div>
            <div className="space-y-3 p-4">
              {claims.length === 0 && <p className="text-sm text-muted-foreground">No claimable rewards yet.</p>}
              {claims.map((claim) => (
                <div key={claim.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3">
                  <div>
                    <p className="font-medium text-foreground">Token #{claim.tokenId}</p>
                    <p className="font-mono text-sm text-amber-400">{Number(formatEther(BigInt(claim.amount))).toFixed(4)} MON</p>
                  </div>
                  <Button
                    onClick={() => claimToken(claim.tokenId)}
                    disabled={isPending || claimReceipt.isLoading}
                    className="bg-amber-500 text-black hover:bg-amber-400"
                  >
                    Claim
                  </Button>
                </div>
              ))}
              {claims.length > 1 && (
                <Button
                  variant="outline"
                  onClick={async () => {
                    for (const claim of claims) {
                      await claimToken(claim.tokenId)
                    }
                  }}
                >
                  Claim All
                </Button>
              )}
            </div>
          </div>

          <div className="mt-8 rounded-xl border border-border bg-card">
            <div className="border-b border-border p-4">
              <h2 className="text-lg font-semibold text-foreground">Trade History</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border text-left text-sm text-muted-foreground">
                    <th className="px-6 py-4">Type</th>
                    <th className="px-6 py-4">Token</th>
                    <th className="px-6 py-4">Amount (MON)</th>
                    <th className="px-6 py-4">Txn</th>
                  </tr>
                </thead>
                <tbody>
                  {trades.map((trade) => (
                    <tr key={trade.id} className="border-b border-border/50">
                      <td className="px-6 py-4">
                        <span className={trade.isBuy ? 'text-emerald-500' : 'text-red-500'}>
                          {trade.isBuy ? 'BUY' : 'SELL'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-foreground">{trade.token?.symbol || `#${trade.tokenId}`}</td>
                      <td className="px-6 py-4 font-mono text-foreground">
                        {Number(formatEther(BigInt(trade.monAmount))).toFixed(4)}
                      </td>
                      <td className="px-6 py-4">
                        <a className="text-primary hover:underline" target="_blank" rel="noreferrer" href={`https://testnet.monadscan.com/tx/${trade.txHash}`}>
                          View
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

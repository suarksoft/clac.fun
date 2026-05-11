'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { Header } from '@/components/header'
import { LiveTicker } from '@/components/live-ticker'
import { TradesTable } from '@/components/trades-table'
import { TokenImage } from '@/components/token-image'
import { TradePanelV2 } from '@/components/v2/trade-panel-v2'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatNumber, formatTimeAgo, formatTokenPrice, formatMonAmount } from '@/lib/format'
import { useDeathClock } from '@/hooks/use-death-clock'
import { getDeathClockColor } from '@/lib/death-clock'
import { useQuery } from '@tanstack/react-query'
import { apiClientV2, createSocketClientV2 } from '@/lib/api/client-v2'
import { toUiTokenV2, toUiTradeV2 } from '@/lib/api/mappers-v2'
import { CLAC_TOKEN_V2_ABI } from '@/lib/web3/contracts-v2'
import { formatEther } from 'viem'
import {
  useAccount,
  useReadContract,
  useReadContracts,
  useWaitForTransactionReceipt,
  useWriteContract,
} from 'wagmi'
import { ArrowLeft, Copy, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import type { Trade } from '@/lib/ui-types'
import type { SocketTradeV2Event } from '@/lib/api/types-v2'

interface TokenDetailV2Props {
  address: `0x${string}`
}

export function TokenDetailV2({ address }: TokenDetailV2Props) {
  const [liveTrades, setLiveTrades] = useState<Trade[]>([])
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  const { address: walletAddress, isConnected } = useAccount()

  // ── Backend data ────────────────────────────────────────────────────────
  const tokenQuery = useQuery({
    queryKey: ['v2-token', address],
    queryFn: () => apiClientV2.getToken(address),
    refetchInterval: 10000,
  })
  const token = tokenQuery.data ? toUiTokenV2(tokenQuery.data) : null

  const tradesQuery = useQuery({
    queryKey: ['v2-trades', address],
    queryFn: () => apiClientV2.getTrades(address),
    refetchInterval: 10000,
  })

  // ── On-chain reads ──────────────────────────────────────────────────────
  const { data: chainData, refetch: refetchChain } = useReadContracts({
    contracts: [
      { address, abi: CLAC_TOKEN_V2_ABI, functionName: 'isInLastHour' },
      { address, abi: CLAC_TOKEN_V2_ABI, functionName: 'deathRequested' },
      { address, abi: CLAC_TOKEN_V2_ABI, functionName: 'deathFinalized' },
      { address, abi: CLAC_TOKEN_V2_ABI, functionName: 'getPrice' },
      { address, abi: CLAC_TOKEN_V2_ABI, functionName: 'getRandomnessFee' },
      { address, abi: CLAC_TOKEN_V2_ABI, functionName: 'getLotteryWinners' },
    ],
    query: { refetchInterval: 8000 },
  })

  // Static info from chain — fallback when backend hasn't indexed yet
  const { data: chainStatic } = useReadContracts({
    contracts: [
      { address, abi: CLAC_TOKEN_V2_ABI, functionName: 'name' },
      { address, abi: CLAC_TOKEN_V2_ABI, functionName: 'symbol' },
      { address, abi: CLAC_TOKEN_V2_ABI, functionName: 'imageURI' },
      { address, abi: CLAC_TOKEN_V2_ABI, functionName: 'creator' },
      { address, abi: CLAC_TOKEN_V2_ABI, functionName: 'createdAt' },
      { address, abi: CLAC_TOKEN_V2_ABI, functionName: 'deathTime' },
      { address, abi: CLAC_TOKEN_V2_ABI, functionName: 'poolBalance' },
      { address, abi: CLAC_TOKEN_V2_ABI, functionName: 'virtualSupply' },
    ],
    query: { enabled: !token, staleTime: 60000 },
  })

  const chainFallbackToken: import('@/lib/api/mappers-v2').TokenV2Ui | null = useMemo(() => {
    if (token || !chainStatic) return null
    const [name, symbol, imageURI, creator, createdAt, deathTime, poolBalance, virtualSupply] = chainStatic
    if (!name?.result) return null
    const createdAtSec = Number(createdAt?.result ?? BigInt(0))
    const deathTimeSec = Number(deathTime?.result ?? BigInt(0))
    const poolMon = Number(formatEther((poolBalance?.result as bigint) ?? BigInt(0)))
    const supplyHuman = Number(formatEther((virtualSupply?.result as bigint) ?? BigInt(0)))
    const priceOnChain = chainData?.[3]?.result ? Number(formatEther(chainData[3].result as bigint)) : 0
    return {
      address,
      name: name.result as string,
      symbol: symbol?.result as string ?? '',
      image: imageURI?.result as string ?? '',
      creator: creator?.result as string ?? '',
      createdAt: new Date(createdAtSec * 1000),
      deathTime: new Date(deathTimeSec * 1000),
      durationSeconds: deathTimeSec - createdAtSec,
      price: priceOnChain,
      virtualSupply: supplyHuman,
      poolBalanceMon: poolMon,
      marketCap: supplyHuman * priceOnChain,
      volume24h: 0,
      priceChange24h: 0,
      holders: 0,
      dead: false,
      deathRequested: false,
      deathFinalized: false,
      proRataPool: 0,
      lotteryPool: 0,
      lotteryWinners: [],
    }
  }, [token, chainStatic, chainData, address])

  const isInLastHour = (chainData?.[0]?.result as boolean) ?? false
  const deathRequested = (chainData?.[1]?.result as boolean) ?? token?.deathRequested ?? false
  const deathFinalized = (chainData?.[2]?.result as boolean) ?? token?.deathFinalized ?? false
  const chainPrice = chainData?.[3]?.result ? Number(formatEther(chainData[3].result as bigint)) : null
  const randomnessFee = (chainData?.[4]?.result as bigint) ?? BigInt(0)
  const lotteryWinners = (chainData?.[5]?.result ? [...chainData[5].result as readonly string[]] : null) ?? token?.lotteryWinners ?? []

  const activeToken = token ?? chainFallbackToken
  const displayPrice = chainPrice ?? activeToken?.price ?? 0

  useEffect(() => {
    if (tradesQuery.data && activeToken) {
      setLiveTrades(tradesQuery.data.map(t => toUiTradeV2(t, activeToken.symbol, activeToken.image)))
    }
  }, [tradesQuery.data, activeToken])

  // ── Claimable ──────────────────────────────────────────────────────────
  const { data: claimableData, refetch: refetchClaimable } = useReadContract({
    address,
    abi: CLAC_TOKEN_V2_ABI,
    functionName: 'getClaimable',
    args: [walletAddress ?? '0x0000000000000000000000000000000000000000'],
    query: { enabled: isConnected && Boolean(walletAddress) && deathFinalized, refetchInterval: 10000 },
  })
  const [proRataClaimable, lotteryClaimable] = claimableData
    ? [Number(formatEther((claimableData as [bigint, bigint])[0])), Number(formatEther((claimableData as [bigint, bigint])[1]))]
    : [0, 0]
  const totalClaimable = proRataClaimable + lotteryClaimable

  const { data: hasClaimed } = useReadContract({
    address,
    abi: CLAC_TOKEN_V2_ABI,
    functionName: 'claimed',
    args: [walletAddress ?? '0x0000000000000000000000000000000000000000'],
    query: { enabled: isConnected && Boolean(walletAddress) && deathFinalized },
  })

  const { data: trophyMinted } = useReadContract({
    address,
    abi: CLAC_TOKEN_V2_ABI,
    functionName: 'trophyMinted',
    args: [walletAddress ?? '0x0000000000000000000000000000000000000000'],
    query: { enabled: isConnected && Boolean(walletAddress) && deathFinalized },
  })

  // ── Write actions ───────────────────────────────────────────────────────
  const { writeContractAsync, data: actionHash, isPending } = useWriteContract()
  const { isLoading: isConfirming } = useWaitForTransactionReceipt({ hash: actionHash })
  const isBusy = isPending || isConfirming

  const handleRequestDeath = async () => {
    await writeContractAsync({
      address,
      abi: CLAC_TOKEN_V2_ABI,
      functionName: 'requestDeath',
      value: randomnessFee,
    })
    setTimeout(() => { refetchChain(); tokenQuery.refetch() }, 3000)
  }

  const handleClaim = async () => {
    await writeContractAsync({ address, abi: CLAC_TOKEN_V2_ABI, functionName: 'claim' })
    setTimeout(() => { refetchClaimable(); refetchChain() }, 3000)
  }

  const handleMintTrophy = async () => {
    await writeContractAsync({ address, abi: CLAC_TOKEN_V2_ABI, functionName: 'mintTrophy' })
    setTimeout(() => { refetchChain() }, 3000)
  }

  // ── WebSocket ───────────────────────────────────────────────────────────
  const activeTokenRef = useRef(activeToken)
  useEffect(() => { activeTokenRef.current = activeToken }, [activeToken])

  useEffect(() => {
    const socket = createSocketClientV2()
    socket.on('trade', (payload: SocketTradeV2Event) => {
      if (payload.tokenAddress.toLowerCase() !== address.toLowerCase()) return
      const t: Trade = {
        id: crypto.randomUUID(),
        tokenId: address,
        tokenSymbol: activeTokenRef.current?.symbol ?? '',
        tokenImage: activeTokenRef.current?.image ?? '',
        type: payload.isBuy ? 'buy' : 'sell',
        account: payload.trader,
        amount: Number(formatEther(BigInt(payload.monAmount || '0'))),
        value: Number(formatEther(BigInt(payload.monAmount || '0'))),
        tokenAmount: Number(formatEther(BigInt(payload.tokenAmount || '0'))),
        time: new Date(),
        txHash: payload.txHash,
      }
      setLiveTrades(prev => [t, ...prev].slice(0, 50))
    })
    return () => { socket.disconnect() }
  }, [address])

  // ── Death clock ─────────────────────────────────────────────────────────
  const death = useDeathClock(activeToken?.createdAt ?? new Date(), activeToken?.durationSeconds ?? 1)
  const isDead = deathFinalized || death.isDead
  const canRequestDeath = !isDead && !deathRequested && death.isDead
  const canClaim = deathFinalized && !hasClaimed && totalClaimable > 0
  const canMintTrophy = deathFinalized && (hasClaimed as boolean) && !(trophyMinted as boolean)

  const tradeStats = useMemo(() => ({
    totalTxns: liveTrades.length,
    buyCount: liveTrades.filter(t => t.type === 'buy').length,
    sellCount: liveTrades.filter(t => t.type === 'sell').length,
  }), [liveTrades])

  // ── Loading / error guards ──────────────────────────────────────────────
  if (tokenQuery.isLoading && !activeToken) {
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
                <Skeleton className="h-[200px] w-full rounded-xl" />
              </div>
            </div>
          </div>
        </main>
      </div>
    )
  }

  if (!activeToken) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Header /><LiveTicker />
        <main className="flex flex-1 items-center justify-center text-muted-foreground">
          Token not found or still syncing — try again in a moment.
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

          {/* Dead banner */}
          {isDead && (
            <div className="mb-4 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-center">
              <p className="text-lg font-bold text-red-500">💀 {activeToken!.name} GOT CLAC&apos;D</p>
            </div>
          )}

          {/* Death requested banner */}
          {deathRequested && !deathFinalized && (
            <div className="mb-4 rounded-xl border border-orange-500/40 bg-orange-500/10 px-4 py-3 text-center">
              <p className="text-sm font-semibold text-orange-400">⏳ Death requested — waiting for randomness callback...</p>
            </div>
          )}

          {/* Token header */}
          <div className="mb-4 rounded-xl border border-border bg-card/70 px-3 py-3 sm:px-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <Link href="/" className="flex h-11 min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground transition-colors hover:bg-secondary/80 hover:text-foreground">
                  <ArrowLeft className="h-4 w-4" />
                </Link>
                <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full">
                  <TokenImage src={activeToken!.image} alt={activeToken!.name} fill className="object-cover" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <h1 className="truncate text-lg font-bold text-foreground sm:text-xl">{activeToken!.name}</h1>
                    <span className="shrink-0 text-sm text-muted-foreground">/ MON</span>
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                    <span>Contract:</span>
                    <button
                      type="button"
                      onClick={() => navigator.clipboard.writeText(address)}
                      className="flex items-center gap-1 font-mono transition-colors hover:text-foreground"
                    >
                      {address.slice(0, 6)}...{address.slice(-4)}
                      <Copy className="h-3 w-3" />
                    </button>
                    <span className="hidden sm:inline">|</span>
                    <span>By</span>
                    <span className="truncate font-mono">{activeToken!.creator.slice(0, 6)}...{activeToken!.creator.slice(-4)}</span>
                    <a
                      href={`https://testnet.monadexplorer.com/address/${address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 transition-colors hover:text-foreground"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 md:justify-end">
                <div className="text-left md:text-right">
                  <p className="font-mono text-lg font-bold text-foreground sm:text-xl md:text-2xl">
                    {formatTokenPrice(displayPrice)} MON
                  </p>
                  <p className={`text-sm font-semibold ${activeToken!.priceChange24h >= 0 ? 'text-emerald-500' : 'text-red-400'}`}>
                    {activeToken!.priceChange24h >= 0 ? '+' : ''}{activeToken!.priceChange24h.toFixed(2)}%
                  </p>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
              {[
                { label: 'Market Cap', value: formatNumber(activeToken!.marketCap) },
                { label: 'Pool Balance', value: `${formatMonAmount(activeToken!.poolBalanceMon, 4)} MON` },
                { label: '24h Volume', value: formatNumber(activeToken!.volume24h) },
                { label: 'Holders', value: String(activeToken!.holders) },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-xl border border-border bg-secondary/40 p-3">
                  <p className="truncate text-xs text-muted-foreground">{label}</p>
                  <p className="truncate font-mono text-sm font-semibold text-foreground">{value}</p>
                </div>
              ))}
            </div>

            {/* Death clock */}
            <div className={`mt-3 rounded-xl border px-4 py-3 ${
              isDead ? 'border-red-500/50 bg-red-500/10'
              : death.status === 'critical' ? 'border-red-500/50 bg-red-500/10'
              : death.status === 'dying' ? 'border-orange-500/50 bg-orange-500/10'
              : isInLastHour ? 'border-orange-500/30 bg-orange-500/5'
              : 'border-border bg-secondary/30'
            }`}>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-semibold text-foreground">Death Clock</span>
                <span className={`rounded-full px-2 py-1 text-xs font-bold ${
                  isDead ? 'bg-red-600 text-white'
                  : deathRequested ? 'animate-pulse bg-orange-500 text-white'
                  : isInLastHour ? 'bg-orange-500 text-white'
                  : death.status === 'critical' ? 'animate-pulse bg-red-500 text-white'
                  : 'bg-white/10 text-foreground'
                }`}>
                  {isDead ? "💀 CLAC'D" : deathRequested ? '⏳ FINALIZING' : isInLastHour ? '🔒 LAST HOUR' : '🟢 LIVE'}
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
                {mounted ? `${death.createdAtLabel} → ${death.diesAtLabel}` : '--'}
              </p>
            </div>
          </div>

          {/* Main content */}
          <div className="flex flex-col-reverse gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_380px] lg:items-start">

            {/* Left — trades */}
            <div className="min-w-0 space-y-4">
              {/* Simple price + supply info */}
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs mb-1">Price</p>
                    <p className="font-mono font-semibold">{formatTokenPrice(displayPrice)} MON</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs mb-1">Virtual Supply</p>
                    <p className="font-mono font-semibold">{formatNumber(activeToken!.virtualSupply)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs mb-1">Txns</p>
                    <p className="font-mono font-semibold">{tradeStats.totalTxns}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs mb-1">Buys / Sells</p>
                    <p className="font-mono font-semibold text-emerald-400">{tradeStats.buyCount}</p>
                    <span className="text-muted-foreground"> / </span>
                    <p className="font-mono font-semibold text-red-400 inline">{tradeStats.sellCount}</p>
                  </div>
                </div>
              </div>
              <TradesTable trades={liveTrades} />
            </div>

            {/* Right — actions */}
            <aside className="min-w-0 space-y-4 lg:sticky lg:top-20">

              {/* Death finalized — claim panel */}
              {deathFinalized && (
                <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                  <h3 className="text-lg font-semibold text-red-400">💀 Final Results</h3>
                  <div className="space-y-2 font-mono text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Pool at death:</span>
                      <span>{formatMonAmount(activeToken!.poolBalanceMon, 4)} MON</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Pro-rata (77%):</span>
                      <span>{formatMonAmount(activeToken!.proRataPool, 4)} MON</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Lottery (20%):</span>
                      <span>{formatMonAmount(activeToken!.lotteryPool, 4)} MON</span>
                    </div>
                  </div>

                  {lotteryWinners.filter(w => w !== '0x0000000000000000000000000000000000000000').length > 0 && (
                    <div className="border-t border-border pt-3">
                      <p className="mb-2 text-sm font-semibold text-amber-400">🎰 Lottery Winners</p>
                      {lotteryWinners.filter(w => w !== '0x0000000000000000000000000000000000000000').map((w, i) => (
                        <p key={i} className="font-mono text-xs text-muted-foreground">
                          {i + 1}. {w.slice(0, 8)}...{w.slice(-6)}
                        </p>
                      ))}
                    </div>
                  )}

                  {isConnected && (
                    <div className="border-t border-border pt-3 space-y-2">
                      {!hasClaimed && totalClaimable > 0 && (
                        <>
                          <p className="text-sm text-foreground">
                            Your claim: <span className="font-mono text-amber-400">{totalClaimable.toFixed(4)} MON</span>
                            {lotteryClaimable > 0 && <span className="ml-1 text-xs text-amber-300">(incl. lottery 🎰)</span>}
                          </p>
                          <Button
                            className="w-full bg-amber-500 text-black hover:bg-amber-400"
                            onClick={handleClaim}
                            disabled={!canClaim || isBusy}
                          >
                            {isBusy ? 'Claiming...' : `Claim ${totalClaimable.toFixed(4)} MON`}
                          </Button>
                        </>
                      )}
                      {hasClaimed && <p className="text-center text-sm text-emerald-400">✓ Claimed</p>}
                      {canMintTrophy && (
                        <Button
                          className="w-full bg-violet-600 text-white hover:bg-violet-500"
                          onClick={handleMintTrophy}
                          disabled={isBusy}
                        >
                          {isBusy ? 'Minting...' : '🏆 Mint Trophy NFT'}
                        </Button>
                      )}
                      {trophyMinted && <p className="text-center text-sm text-violet-400">🏆 Trophy minted</p>}
                    </div>
                  )}
                </div>
              )}

              {/* Trade panel (live) */}
              {!deathFinalized && (
                <TradePanelV2
                  tokenAddress={address}
                  tokenSymbol={activeToken!.symbol}
                  currentPrice={displayPrice}
                  virtualSupply={activeToken!.virtualSupply}
                  isInLastHour={isInLastHour}
                  isDead={isDead}
                  onTradeSuccess={() => { tokenQuery.refetch(); tradesQuery.refetch(); refetchChain() }}
                />
              )}

              {/* Request death button */}
              {canRequestDeath && (
                <Button
                  className="w-full bg-red-500 text-white hover:bg-red-600"
                  onClick={handleRequestDeath}
                  disabled={isBusy}
                >
                  {isBusy ? 'Requesting...' : `Trigger Clac 💀 (fee: ${formatMonAmount(Number(formatEther(randomnessFee)), 4)} MON)`}
                </Button>
              )}

              {/* Token info */}
              <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Token Info</h3>
                <div className="space-y-2 text-xs text-muted-foreground">
                  {activeToken!.description && <p>{activeToken!.description}</p>}
                  <div className="flex justify-between">
                    <span>Created</span>
                    <span className="font-mono">{mounted ? formatTimeAgo(activeToken!.createdAt) : '--'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Duration</span>
                    <span className="font-mono">{activeToken!.durationSeconds / 3600}h</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Holders</span>
                    <span className="font-mono">{activeToken!.holders}</span>
                  </div>
                  {activeToken!.website && (
                    <a href={activeToken!.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-foreground transition-colors">
                      🌐 Website
                    </a>
                  )}
                  {activeToken!.twitter && (
                    <a href={activeToken!.twitter} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-foreground transition-colors">
                      𝕏 Twitter
                    </a>
                  )}
                  {activeToken!.telegram && (
                    <a href={activeToken!.telegram} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-foreground transition-colors">
                      ✈ Telegram
                    </a>
                  )}
                </div>
              </div>
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

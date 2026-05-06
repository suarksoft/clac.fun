'use client'

import { useEffect, useMemo, useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Wallet, Settings, X, Loader2, CheckCircle2,
  AlertTriangle, TrendingUp, TrendingDown,
} from 'lucide-react'
import {
  useAccount,
  useBalance,
  useChainId,
  usePublicClient,
  useSwitchChain,
  useWriteContract,
} from 'wagmi'
import { useConnectModal } from '@rainbow-me/rainbowkit'
import { formatEther, parseEther } from 'viem'
import { CLAC_FACTORY_ABI, CLAC_FACTORY_ADDRESS } from '@/lib/web3/contracts'
import { monadTestnet } from '@/lib/web3/chains'
import { formatMonAmount, formatTokenPrice, formatAbbreviatedTokenAmount } from '@/lib/format'
import { cn } from '@/lib/utils'

// Bonding curve: price = K * sqrt(supply)
// Cost to buy T tokens from supply S = K * 2/3 * [(S+T)^1.5 - S^1.5]
// Derive K from currentPrice and virtualSupply, then solve for T given MON input
function estimateBuyTokens(inputMON: number, currentPrice: number, virtualSupply: number): number {
  if (inputMON <= 0 || currentPrice <= 0 || virtualSupply <= 0) return 0
  const netMON = inputMON * 0.985 // deduct 1% protocol + 0.5% creator fee
  const K = currentPrice / Math.sqrt(virtualSupply)
  const inner = Math.pow(virtualSupply, 1.5) + (netMON * 3) / (2 * K)
  return Math.max(0, Math.pow(inner, 2 / 3) - virtualSupply)
}

const SLIPPAGE_PRESETS = [0.5, 1, 2, 5]

interface TradePanelProps {
  tokenId: bigint
  tokenSymbol: string
  currentPrice: number
  virtualSupply: number
  userBalance?: number
  isDead?: boolean
  onTradeSuccess?: () => void
}

export function TradePanel({
  tokenId,
  tokenSymbol,
  currentPrice,
  virtualSupply,
  userBalance = 0,
  isDead = false,
  onTradeSuccess,
}: TradePanelProps) {
  const [activeTab, setActiveTab] = useState<'buy' | 'sell'>('buy')
  const [amount, setAmount] = useState('')
  const [sellQuoteRaw, setSellQuoteRaw] = useState<bigint | null>(null)
  const [errorText, setErrorText] = useState<string | null>(null)
  const [txError, setTxError] = useState<string | null>(null)
  const [txSuccess, setTxSuccess] = useState(false)
  const [walletTokenBalance, setWalletTokenBalance] = useState(0)
  const [balanceFetchError, setBalanceFetchError] = useState(false)
  const [slippage, setSlippage] = useState(1)
  const [customSlippage, setCustomSlippage] = useState('')
  const [showSlippagePanel, setShowSlippagePanel] = useState(false)
  const [awaitingConfirm, setAwaitingConfirm] = useState(false)
  const [confirmedHash, setConfirmedHash] = useState<`0x${string}` | null>(null)
  const slippagePanelRef = useRef<HTMLDivElement>(null)

  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const { switchChain } = useSwitchChain()
  const { openConnectModal } = useConnectModal()
  const publicClient = usePublicClient()
  const { data: hash, isPending, writeContractAsync } = useWriteContract()
  const { data: balanceData } = useBalance({ address })

  const walletMonBalance = Number(balanceData?.formatted || userBalance || 0)
  const isWrongChain = isConnected && chainId !== monadTestnet.id
  const MAX_HOLDING_TOKENS = 100_000_000
  const remainingCapacity = Math.max(MAX_HOLDING_TOKENS - walletTokenBalance, 0)
  const atWhaleLimit = walletTokenBalance >= MAX_HOLDING_TOKENS
  const effectiveSlippage = customSlippage ? parseFloat(customSlippage) : slippage
  const isBusy = isPending || awaitingConfirm

  const parsedAmount = useMemo(() => {
    const normalized = amount.trim()
    if (!normalized || normalized === 'max') return null
    try { return parseEther(normalized) } catch { return null }
  }, [amount])

  const estimatedBuyTokens = useMemo(() => {
    if (activeTab !== 'buy' || !amount) return 0
    const mon = parseFloat(amount)
    if (!Number.isFinite(mon) || mon <= 0) return 0
    return estimateBuyTokens(mon, currentPrice, virtualSupply)
  }, [amount, activeTab, currentPrice, virtualSupply])

  const priceImpact = useMemo(() => {
    if (activeTab === 'buy') {
      if (estimatedBuyTokens <= 0 || virtualSupply <= 0) return 0
      return (Math.sqrt((virtualSupply + estimatedBuyTokens) / virtualSupply) - 1) * 100
    }
    const tokenAmt = parseFloat(amount)
    if (!Number.isFinite(tokenAmt) || tokenAmt <= 0 || virtualSupply <= 0) return 0
    const newSupply = virtualSupply - tokenAmt
    if (newSupply <= 0) return 99
    return (1 - Math.sqrt(newSupply / virtualSupply)) * 100
  }, [activeTab, estimatedBuyTokens, amount, virtualSupply])

  const wouldExceedWhaleLimit =
    activeTab === 'buy' && !atWhaleLimit && remainingCapacity > 0 && estimatedBuyTokens > remainingCapacity

  useEffect(() => {
    setAmount('')
    setSellQuoteRaw(null)
    setErrorText(null)
    setTxError(null)
  }, [activeTab])

  // Sell quote from contract
  useEffect(() => {
    if (!parsedAmount || !publicClient || isDead || activeTab !== 'sell') {
      setSellQuoteRaw(null)
      return
    }
    const run = async () => {
      try {
        const result = await publicClient.readContract({
          address: CLAC_FACTORY_ADDRESS as `0x${string}`,
          abi: CLAC_FACTORY_ABI,
          functionName: 'getSellQuote',
          args: [tokenId, parsedAmount],
        })
        setSellQuoteRaw(result as bigint)
      } catch {
        setSellQuoteRaw(null)
      }
    }
    run()
  }, [activeTab, parsedAmount, publicClient, tokenId, isDead])

  // Wallet token balance
  useEffect(() => {
    if (!publicClient || !isConnected || !address || isDead) {
      setWalletTokenBalance(0)
      return
    }
    let cancelled = false
    setBalanceFetchError(false)
    const run = async () => {
      try {
        const balance = await publicClient.readContract({
          address: CLAC_FACTORY_ADDRESS as `0x${string}`,
          abi: CLAC_FACTORY_ABI,
          functionName: 'getBalance',
          args: [tokenId, address],
        })
        if (!cancelled) setWalletTokenBalance(Number(formatEther(balance as bigint)))
      } catch {
        if (!cancelled) { setWalletTokenBalance(0); setBalanceFetchError(true) }
      }
    }
    run()
    return () => { cancelled = true }
  }, [publicClient, isConnected, address, activeTab, tokenId, isDead, confirmedHash])

  // Receipt polling
  useEffect(() => {
    if (!hash || !publicClient) return
    setAwaitingConfirm(true)
    let stopped = false
    let attempts = 0
    const poll = async () => {
      while (!stopped && attempts < 60) {
        await new Promise((r) => setTimeout(r, 2_000))
        if (stopped) break
        attempts++
        try {
          const receipt = await publicClient.getTransactionReceipt({ hash })
          if (!receipt) continue
          stopped = true
          setAwaitingConfirm(false)
          if (receipt.status === 'reverted') {
            try {
              const tx = await publicClient.getTransaction({ hash })
              await publicClient.call({ to: tx.to ?? undefined, data: tx.input, value: tx.value, account: tx.from })
              setTxError('Transaction reverted. Please try again.')
            } catch (e) { setTxError(parseTxError(e)) }
          } else {
            setConfirmedHash(hash)
            setTxSuccess(true)
            setTimeout(() => setTxSuccess(false), 3000)
            setAmount('')
            onTradeSuccess?.()
          }
          return
        } catch { /* keep polling */ }
      }
      if (!stopped) { setAwaitingConfirm(false); setTxError('Could not confirm transaction. Check explorer.') }
    }
    poll()
    return () => { stopped = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hash])

  useEffect(() => {
    if (!txError) return
    const t = setTimeout(() => setTxError(null), 5000)
    return () => clearTimeout(t)
  }, [txError])

  // Close slippage panel on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (slippagePanelRef.current && !slippagePanelRef.current.contains(e.target as Node)) {
        setShowSlippagePanel(false)
      }
    }
    if (showSlippagePanel) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showSlippagePanel])

  const parseTxError = (error: unknown): string => {
    const msg = error instanceof Error ? error.message : String(error)
    if (/user rejected|user denied|rejected the request/i.test(msg)) return 'Transaction rejected.'
    if (/insufficient funds/i.test(msg)) return 'Insufficient MON balance.'
    if (/Min buy/i.test(msg)) return 'Minimum buy is 0.01 MON.'
    if (/cooldown/i.test(msg)) return 'Buy cooldown active. Wait a moment.'
    if (/Max holding/i.test(msg)) return 'Whale limit: max 10% of supply per wallet.'
    if (/Pool cap reached/i.test(msg)) return 'Pool cap reached.'
    if (/Anti-sniper/i.test(msg)) return 'Anti-sniper limit: reduce your buy amount.'
    if (/Max supply/i.test(msg)) return 'Token supply limit reached.'
    if (/Time expired/i.test(msg)) return 'Token has expired — trading is closed.'
    if (/token.*dead|trading.*disabled|CLAC.D/i.test(msg)) return 'This token has expired.'
    if (/slippage|PRICE_IMPACT|minTokens|minMon/i.test(msg)) return 'Price moved too much. Increase slippage or try again.'
    if (/insufficient.*balance|balance.*insufficient/i.test(msg)) return `Insufficient ${tokenSymbol} balance.`
    return 'Transaction failed. Please try again.'
  }

  const setSellByPercent = (pct: number) => {
    if (walletTokenBalance <= 0) { setAmount(''); return }
    const val = pct === 100 ? (walletTokenBalance * 98) / 100 : (walletTokenBalance * pct) / 100
    setAmount(val.toFixed(6))
  }

  const setBuyQuick = (val: string) => {
    if (val === 'max') {
      const gasReserve = 0.01
      const maxSpendable = Math.max(walletMonBalance - gasReserve, 0)
      const maxByWhale = remainingCapacity > 0 && currentPrice > 0
        ? remainingCapacity * currentPrice : maxSpendable
      const capped = Math.min(maxSpendable, maxByWhale)
      setAmount(capped > 0 ? capped.toFixed(6) : '')
    } else {
      setAmount(val)
    }
  }

  const executeTrade = async () => {
    if (isDead) return
    if (!isConnected) { openConnectModal?.(); return }
    if (isWrongChain) { switchChain({ chainId: monadTestnet.id }); return }
    if (!parsedAmount) { setErrorText('Please enter a valid amount.'); return }
    if (activeTab === 'buy' && atWhaleLimit) { setErrorText('Whale limit reached. Max 10% of supply.'); return }
    if (activeTab === 'buy' && wouldExceedWhaleLimit) {
      setErrorText(`Exceeds whale limit. Max ${remainingCapacity.toLocaleString('en-US', { maximumFractionDigits: 0 })} more ${tokenSymbol}.`)
      return
    }
    if (activeTab === 'sell') {
      if (!balanceFetchError && walletTokenBalance <= 0) { setErrorText(`You don't have any ${tokenSymbol} to sell.`); return }
      const n = Number(amount)
      if (!Number.isFinite(n) || n <= 0) { setErrorText(`Enter a valid ${tokenSymbol} amount.`); return }
      if (!balanceFetchError && n > walletTokenBalance) { setErrorText(`Insufficient balance. Max: ${walletTokenBalance.toFixed(6)}`); return }
    }
    setErrorText(null)
    try {
      if (activeTab === 'buy') {
        const minTokens = estimatedBuyTokens > 0 && effectiveSlippage > 0
          ? parseEther((estimatedBuyTokens * (1 - effectiveSlippage / 100)).toFixed(18))
          : BigInt(0)
        await writeContractAsync({
          address: CLAC_FACTORY_ADDRESS as `0x${string}`,
          abi: CLAC_FACTORY_ABI,
          functionName: 'buy',
          args: [tokenId, minTokens],
          value: parsedAmount,
        })
      } else {
        const minMon = sellQuoteRaw && effectiveSlippage > 0
          ? (sellQuoteRaw * BigInt(Math.floor((1 - effectiveSlippage / 100) * 10000))) / BigInt(10000)
          : BigInt(0)
        await writeContractAsync({
          address: CLAC_FACTORY_ADDRESS as `0x${string}`,
          abi: CLAC_FACTORY_ABI,
          functionName: 'sell',
          args: [tokenId, parsedAmount, minMon],
        })
      }
    } catch (e) {
      setTxError(parseTxError(e))
    }
  }

  const impactColor = priceImpact >= 5 ? 'text-red-500' : priceImpact >= 3 ? 'text-orange-500' : priceImpact >= 1 ? 'text-yellow-500' : 'text-muted-foreground'
  const sellQuoteMon = sellQuoteRaw !== null ? Number(formatEther(sellQuoteRaw)) : null

  return (
    <div className="relative rounded-xl border border-border bg-card overflow-hidden">
      {/* Success flash overlay */}
      {txSuccess && (
        <div className="pointer-events-none absolute inset-0 z-10 rounded-xl bg-emerald-500/10 ring-2 ring-inset ring-emerald-500/40 animate-pulse" />
      )}

      <div className="p-3 space-y-2.5">
        {/* Buy / Sell Tabs — sliding indicator */}
        <div className="relative flex rounded-lg border border-border bg-secondary/40 p-1">
          <div
            className={cn(
              'absolute top-1 bottom-1 rounded-md transition-all duration-200',
              'w-[calc(50%-4px)]',
              activeTab === 'buy' ? 'left-1 bg-emerald-500' : 'left-[calc(50%+3px)] bg-red-500',
            )}
          />
          <button
            onClick={() => setActiveTab('buy')}
            disabled={isDead}
            className={cn(
              'relative z-10 flex-1 py-2 text-center text-sm font-bold transition-colors duration-150',
              activeTab === 'buy' ? 'text-white' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            Buy
          </button>
          <button
            onClick={() => setActiveTab('sell')}
            disabled={isDead}
            className={cn(
              'relative z-10 flex-1 py-2 text-center text-sm font-bold transition-colors duration-150',
              activeTab === 'sell' ? 'text-white' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            Sell
          </button>
        </div>

        {/* Balance row + Slippage control */}
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-muted-foreground">
            {activeTab === 'buy' ? (
              <>
                Balance: <span className="font-mono text-foreground">{walletMonBalance.toLocaleString('en-US', { maximumFractionDigits: 4 })} MON</span>
                {isConnected && atWhaleLimit && <span className="ml-1.5 text-red-400">· Whale limit reached</span>}
              </>
            ) : (
              <>
                Balance:{' '}
                <span className={cn('font-mono', balanceFetchError ? 'text-amber-400' : 'text-foreground')}>
                  {balanceFetchError ? 'Unavailable' : `${walletTokenBalance.toLocaleString('en-US', { maximumFractionDigits: 4 })} ${tokenSymbol}`}
                </span>
              </>
            )}
          </span>

          {/* Slippage popover */}
          <div ref={slippagePanelRef} className="relative">
            <button
              type="button"
              onClick={() => setShowSlippagePanel(v => !v)}
              className={cn(
                'flex items-center gap-1 rounded-md px-2 py-1 text-[11px] transition-colors',
                showSlippagePanel ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60',
              )}
            >
              <Settings className="h-3 w-3" />
              {effectiveSlippage}% slip
            </button>

            {showSlippagePanel && (
              <div className="absolute right-0 top-full z-50 mt-1.5 w-52 rounded-xl border border-border bg-card p-3 shadow-2xl">
                <p className="mb-2 text-[11px] font-medium text-muted-foreground">Slippage Tolerance</p>
                <div className="mb-2 grid grid-cols-4 gap-1">
                  {SLIPPAGE_PRESETS.map((p) => (
                    <button
                      key={p}
                      onClick={() => { setSlippage(p); setCustomSlippage('') }}
                      className={cn(
                        'rounded-md py-1.5 text-[11px] font-semibold transition-colors',
                        slippage === p && !customSlippage
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-secondary/50 text-foreground hover:bg-secondary',
                      )}
                    >
                      {p}%
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-1.5 rounded-md border border-border bg-secondary/30 px-2 py-1.5">
                  <input
                    type="number"
                    placeholder="Custom"
                    value={customSlippage}
                    onChange={(e) => setCustomSlippage(e.target.value)}
                    className="w-full bg-transparent text-[11px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
                  />
                  <span className="text-[11px] text-muted-foreground">%</span>
                </div>
                {effectiveSlippage > 5 && (
                  <p className="mt-1.5 text-[10px] text-orange-400">⚠ High slippage — you may get a worse price.</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Amount input */}
        <div className="relative">
          <Input
            type="number"
            placeholder="0.00"
            value={amount}
            onChange={(e) => { setAmount(e.target.value); setErrorText(null) }}
            disabled={isDead}
            className="h-12 border-border bg-secondary/30 pr-20 font-mono text-xl placeholder:text-muted-foreground/40 focus-visible:ring-1 focus-visible:ring-primary/50"
          />
          <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1.5">
            {amount && (
              <button
                type="button"
                onClick={() => { setAmount(''); setErrorText(null) }}
                className="flex h-5 w-5 items-center justify-center rounded-full bg-secondary/80 text-muted-foreground transition-colors hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            )}
            <span className="min-w-[28px] text-right text-xs font-bold text-muted-foreground">
              {activeTab === 'buy' ? 'MON' : tokenSymbol}
            </span>
          </div>
        </div>

        {/* Quick amount buttons */}
        {activeTab === 'buy' ? (
          <div className="flex flex-wrap gap-1.5">
            {['0.5', '1', '5', '10'].map((val) => (
              <button
                key={val}
                onClick={() => setBuyQuick(val)}
                disabled={isDead}
                className={cn(
                  'rounded-full border px-3 py-1 text-[11px] font-semibold transition-all active:scale-95',
                  amount === val
                    ? 'border-emerald-500/60 bg-emerald-500/20 text-emerald-400'
                    : 'border-border bg-secondary/30 text-foreground hover:bg-secondary/60',
                )}
              >
                {val} MON
              </button>
            ))}
            <button
              onClick={() => setBuyQuick('max')}
              disabled={isDead}
              className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold text-emerald-400 transition-all active:scale-95 hover:bg-emerald-500/20"
            >
              Max
            </button>
          </div>
        ) : (
          <div className="flex gap-1.5">
            {[25, 50, 75, 100].map((pct) => (
              <button
                key={pct}
                onClick={() => setSellByPercent(pct)}
                disabled={isDead || walletTokenBalance <= 0}
                className={cn(
                  'flex-1 rounded-full border py-1 text-[11px] font-semibold transition-all active:scale-95',
                  pct === 100
                    ? 'border-red-500/40 bg-red-500/10 text-red-400 hover:bg-red-500/20'
                    : 'border-border bg-secondary/30 text-foreground hover:bg-secondary/60',
                )}
                title={pct === 100 ? 'Sells ~98% to avoid rounding reverts' : undefined}
              >
                {pct === 100 ? 'Max' : `${pct}%`}
              </button>
            ))}
          </div>
        )}

        {/* Summary box: You receive + price impact + fee */}
        <div className="rounded-lg border border-border/60 bg-secondary/20 px-3 py-2.5 space-y-1.5">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground">You receive</span>
            <span className="font-mono font-semibold text-foreground">
              {activeTab === 'buy'
                ? estimatedBuyTokens > 0
                  ? `~${formatAbbreviatedTokenAmount(estimatedBuyTokens)} ${tokenSymbol}`
                  : `– ${tokenSymbol}`
                : sellQuoteMon !== null
                ? `${formatTokenPrice(sellQuoteMon)} MON`
                : `– MON`}
            </span>
          </div>
          {((activeTab === 'buy' && estimatedBuyTokens > 0) || (activeTab === 'sell' && parsedAmount !== null)) && (
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">Price impact</span>
              <span className={cn('font-mono font-semibold', impactColor)}>
                {priceImpact < 0.01 ? '< 0.01%' : `~${priceImpact.toFixed(2)}%`}
                {priceImpact >= 5 && ' ⚠'}
              </span>
            </div>
          )}
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground">Fee</span>
            <span className="font-mono text-muted-foreground/70">1.5% (protocol + creator)</span>
          </div>
        </div>

        {/* Warnings */}
        {atWhaleLimit && activeTab === 'buy' && (
          <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-2 text-[11px] text-red-400">
            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
            <span>Whale limit reached (max 100M {tokenSymbol} per wallet).</span>
          </div>
        )}
        {wouldExceedWhaleLimit && (
          <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-2 text-[11px] text-red-400">
            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
            <span>Exceeds whale limit. Max {remainingCapacity.toLocaleString('en-US', { maximumFractionDigits: 0 })} more {tokenSymbol}.</span>
          </div>
        )}
        {priceImpact >= 5 && amount && !wouldExceedWhaleLimit && !atWhaleLimit && (
          <div className="flex items-start gap-2 rounded-lg border border-orange-500/30 bg-orange-500/10 px-2.5 py-2 text-[11px] text-orange-400">
            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
            <span>High price impact ({priceImpact.toFixed(1)}%). Consider a smaller amount or increase slippage.</span>
          </div>
        )}

        {/* CTA button */}
        <Button
          disabled={isDead || isBusy}
          onClick={executeTrade}
          className={cn(
            'w-full gap-2 py-5 text-sm font-bold transition-all active:scale-[0.98]',
            txSuccess
              ? 'bg-emerald-500 text-white hover:bg-emerald-500'
              : activeTab === 'buy'
              ? 'bg-emerald-500 text-white hover:bg-emerald-600'
              : 'bg-red-500 text-white hover:bg-red-600',
          )}
        >
          {txSuccess ? (
            <><CheckCircle2 className="h-4 w-4" /> Trade Confirmed!</>
          ) : isBusy ? (
            <><Loader2 className="h-4 w-4 animate-spin" />{isPending ? 'Waiting for wallet…' : 'Confirming on-chain…'}</>
          ) : isDead ? (
            "💀 THIS TOKEN GOT CLAC'D"
          ) : !isConnected ? (
            <><Wallet className="h-4 w-4" />Connect Wallet</>
          ) : isWrongChain ? (
            'Switch to Monad Testnet'
          ) : activeTab === 'buy' ? (
            <><TrendingUp className="h-4 w-4" />Buy {tokenSymbol}</>
          ) : (
            <><TrendingDown className="h-4 w-4" />Sell {tokenSymbol}</>
          )}
        </Button>

        {/* TX link */}
        {hash && (
          <p className="truncate text-center text-[11px] text-muted-foreground">
            Tx:{' '}
            <a
              href={`https://testnet.monadexplorer.com/tx/${hash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground"
            >
              {hash.slice(0, 10)}…{hash.slice(-6)}
            </a>
          </p>
        )}

        {/* Error display */}
        {(errorText || txError) && (
          <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-2 text-xs text-red-400">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{errorText || txError}</span>
          </div>
        )}
        {isWrongChain && !errorText && !txError && (
          <p className="text-center text-xs text-amber-400">Wrong network. Switch to Monad Testnet.</p>
        )}
        {isDead && (
          <p className="text-center text-xs text-red-400">Trading is closed after death clock hits 0.</p>
        )}
      </div>
    </div>
  )
}

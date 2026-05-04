'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Wallet, Settings, RotateCcw, Loader2 } from 'lucide-react'
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
import { formatMonAmount, formatTokenPrice } from '@/lib/format'

interface TradePanelProps {
  tokenId: bigint
  tokenSymbol: string
  currentPrice: number
  userBalance?: number
  isDead?: boolean
  onTradeSuccess?: () => void
}

export function TradePanel({
  tokenId,
  tokenSymbol,
  currentPrice,
  userBalance = 0,
  isDead = false,
  onTradeSuccess,
}: TradePanelProps) {
  const [activeTab, setActiveTab] = useState<'buy' | 'sell'>('buy')
  const [amount, setAmount] = useState('')
  const [quote, setQuote] = useState<string | null>(null)
  const [quoteRaw, setQuoteRaw] = useState<bigint | null>(null)
  const [errorText, setErrorText] = useState<string | null>(null)
  const [txError, setTxError] = useState<string | null>(null)
  const [walletTokenBalance, setWalletTokenBalance] = useState(0)
  const [balanceFetchError, setBalanceFetchError] = useState(false)
  const [slippageEnabled, setSlippageEnabled] = useState(false)
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const { switchChain } = useSwitchChain()
  const { openConnectModal } = useConnectModal()
  const publicClient = usePublicClient()
  const { data: hash, isPending, writeContractAsync } = useWriteContract()
  const [awaitingConfirm, setAwaitingConfirm] = useState(false)
  const [confirmedHash, setConfirmedHash] = useState<`0x${string}` | null>(null)
  const { data: balanceData } = useBalance({ address })
  const walletMonBalance = Number(balanceData?.formatted || userBalance || 0)
  const isWrongChain = isConnected && chainId !== monadTestnet.id

  const quickBuyAmounts = [
    { label: 'Reset', value: '', isReset: true },
    { label: '0.5 MON', value: '0.5' },
    { label: '1 MON', value: '1' },
    { label: '5 MON', value: '5' },
    { label: '10 MON', value: '10' },
    { label: 'Max', value: 'max', isMax: true },
  ]
  const quickSellPercents = [25, 50, 75, 100]
  const MAX_HOLDING_TOKENS = 100_000_000 // 10% of 1B max supply
  const remainingCapacity = Math.max(MAX_HOLDING_TOKENS - walletTokenBalance, 0)
  const atWhaleLimit = walletTokenBalance >= MAX_HOLDING_TOKENS

  const calculatedTokens =
    amount && amount !== 'max' && currentPrice > 0
      ? (parseFloat(amount) / currentPrice).toFixed(2)
      : '0'
  const walletMonBalanceText = walletMonBalance.toLocaleString('en-US', {
    maximumFractionDigits: 4,
  })
  const walletTokenBalanceText = walletTokenBalance.toLocaleString('en-US', {
    maximumFractionDigits: 4,
  })

  const parsedAmount = useMemo(() => {
    const normalized = amount.trim()
    if (!normalized || normalized === 'max') return null
    try {
      return parseEther(normalized)
    } catch {
      return null
    }
  }, [amount])

  useEffect(() => {
    setAmount('')
    setQuote(null)
    setQuoteRaw(null)
    setErrorText(null)
    setTxError(null)
  }, [activeTab])

  useEffect(() => {
    // getBuyCost takes tokenAmount and returns MON cost — not usable for buy-side quote.
    // Only query chain for sell: getSellQuote(tokenId, tokenAmount) → MON received.
    if (!parsedAmount || !publicClient || isDead || activeTab !== 'sell') {
      setQuote(null)
      return
    }

    const readQuote = async () => {
      try {
        const result = await publicClient.readContract({
          address: CLAC_FACTORY_ADDRESS as `0x${string}`,
          abi: CLAC_FACTORY_ABI,
          functionName: 'getSellQuote',
          args: [tokenId, parsedAmount],
        })
        const raw = result as bigint
        setQuoteRaw(raw)
        setQuote(formatTokenPrice(Number(formatEther(raw))))
      } catch {
        setQuoteRaw(null)
        setQuote(null)
      }
    }

    readQuote()
  }, [activeTab, parsedAmount, publicClient, tokenId, isDead])

  useEffect(() => {
    if (!publicClient || !isConnected || !address || isDead) {
      setWalletTokenBalance(0)
      return
    }

    let cancelled = false
    const readWalletTokenBalance = async () => {
      try {
        const balance = await publicClient.readContract({
          address: CLAC_FACTORY_ADDRESS as `0x${string}`,
          abi: CLAC_FACTORY_ABI,
          functionName: 'getBalance',
          args: [tokenId, address],
        })
        if (!cancelled) {
          setWalletTokenBalance(Number(formatEther(balance as bigint)))
        }
      } catch {
        if (!cancelled) {
          setWalletTokenBalance(0)
          setBalanceFetchError(true)
        }
      }
    }

    setBalanceFetchError(false)
    readWalletTokenBalance()
    return () => {
      cancelled = true
    }
  }, [publicClient, isConnected, address, activeTab, tokenId, isDead, confirmedHash])

  // Manual receipt polling — more reliable than useWaitForTransactionReceipt on Monad testnet.
  useEffect(() => {
    if (!hash || !publicClient) return

    setAwaitingConfirm(true)
    let stopped = false
    let attempts = 0
    const MAX_ATTEMPTS = 60 // 60 × 2s = 2 minutes

    const poll = async () => {
      while (!stopped && attempts < MAX_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, 2_000))
        if (stopped) break
        attempts++
        try {
          const receipt = await publicClient.getTransactionReceipt({ hash })
          if (!receipt) continue

          stopped = true
          setAwaitingConfirm(false)
          setConfirmedHash(hash)

          if (receipt.status === 'reverted') {
            // Re-simulate to extract revert reason
            try {
              const tx = await publicClient.getTransaction({ hash })
              await publicClient.call({
                to: tx.to ?? undefined,
                data: tx.input,
                value: tx.value,
                account: tx.from,
              })
              setTxError('Transaction reverted. Please try again.')
            } catch (simErr: unknown) {
              setTxError(parseTxError(simErr))
            }
          } else {
            onTradeSuccess?.()
          }
          return
        } catch {
          // Receipt not yet available — keep polling
        }
      }

      if (!stopped) {
        setAwaitingConfirm(false)
        setTxError('Could not confirm transaction. Check MonadScan for status.')
      }
    }

    poll()
    return () => { stopped = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hash])

  useEffect(() => {
    if (!txError) return
    const timer = setTimeout(() => setTxError(null), 5000)
    return () => clearTimeout(timer)
  }, [txError])

  const parseTxError = (error: unknown): string => {
    const msg = error instanceof Error ? error.message : String(error)
    if (/user rejected|user denied|rejected the request/i.test(msg)) return 'Transaction rejected.'
    if (/insufficient funds/i.test(msg)) return 'Insufficient MON balance.'
    if (/Min buy/i.test(msg)) return 'Minimum buy is 0.01 MON.'
    if (/cooldown/i.test(msg)) return 'Buy cooldown active. Wait a moment.'
    if (/Max holding/i.test(msg)) return 'Whale limit: max 10% of supply per wallet.'
    if (/Pool cap reached/i.test(msg)) return 'Pool cap reached. Token is nearly complete.'
    if (/Anti-sniper/i.test(msg)) return 'Anti-sniper limit: reduce your buy amount.'
    if (/Max supply/i.test(msg)) return 'Token supply limit reached.'
    if (/Time expired/i.test(msg)) return 'Token has expired — trading is closed.'
    if (/token.*dead|trading.*disabled|CLAC.D/i.test(msg)) return 'This token has expired.'
    if (/slippage|PRICE_IMPACT|minTokens|minMon/i.test(msg)) return 'Price moved too much. Enable slippage or try again.'
    if (/insufficient.*balance|balance.*insufficient/i.test(msg)) return `Insufficient ${tokenSymbol} balance.`
    return 'Transaction failed. Please try again.'
  }

  const executeTrade = async () => {
    if (isDead) return
    if (!isConnected) {
      openConnectModal?.()
      return
    }
    if (isWrongChain) {
      switchChain({ chainId: monadTestnet.id })
      return
    }
    if (!parsedAmount) {
      setErrorText('Please enter a valid amount.')
      return
    }
    if (activeTab === 'buy') {
      if (atWhaleLimit) {
        setErrorText(`Wallet limit reached. Max 10% of supply (100M ${tokenSymbol}) per wallet.`)
        return
      }
      const estimatedTokens = currentPrice > 0 ? Number(amount) / currentPrice : 0
      if (estimatedTokens > remainingCapacity) {
        setErrorText(
          `Whale limit: this buy would exceed 100M ${tokenSymbol}. You can buy up to ${remainingCapacity.toLocaleString('en-US', { maximumFractionDigits: 0 })} more.`,
        )
        return
      }
    }
    if (activeTab === 'sell') {
      if (!balanceFetchError && walletTokenBalance <= 0) {
        setErrorText(`You do not have ${tokenSymbol} to sell.`)
        return
      }
      const amountAsNumber = Number(amount)
      if (!Number.isFinite(amountAsNumber) || amountAsNumber <= 0) {
        setErrorText(`Enter a valid ${tokenSymbol} amount.`)
        return
      }
      if (!balanceFetchError && amountAsNumber > walletTokenBalance) {
        setErrorText(
          `Insufficient ${tokenSymbol} balance. Max: ${walletTokenBalance.toFixed(6)}`,
        )
        return
      }
    }
    setErrorText(null)

    const SLIPPAGE = 0.95
    try {
      if (activeTab === 'buy') {
        const minTokens = slippageEnabled && currentPrice > 0 && parsedAmount
          ? parseEther(((Number(formatEther(parsedAmount)) / currentPrice) * SLIPPAGE).toFixed(18))
          : BigInt(0)
        await writeContractAsync({
          address: CLAC_FACTORY_ADDRESS as `0x${string}`,
          abi: CLAC_FACTORY_ABI,
          functionName: 'buy',
          args: [tokenId, minTokens],
          value: parsedAmount,
        })
      } else {
        const minMon = slippageEnabled && quoteRaw
          ? (quoteRaw * BigInt(Math.floor(SLIPPAGE * 1000))) / BigInt(1000)
          : BigInt(0)
        await writeContractAsync({
          address: CLAC_FACTORY_ADDRESS as `0x${string}`,
          abi: CLAC_FACTORY_ABI,
          functionName: 'sell',
          args: [tokenId, parsedAmount, minMon],
        })
      }
      setAmount('')
    } catch (error) {
      console.error('Transaction error:', error)
      setTxError(parseTxError(error))
    }
  }

  const setSellAmountByPercent = (percent: number) => {
    if (walletTokenBalance <= 0) {
      setAmount('')
      return
    }
    if (percent === 100) {
      // Cap at 98% to avoid revert from rounding in the bonding curve sell path.
      setAmount(((walletTokenBalance * 98) / 100).toFixed(6))
      return
    }
    const value = (walletTokenBalance * percent) / 100
    setAmount(value.toFixed(6))
  }

  const setBuyAmountByQuickAction = (value: string) => {
    if (value === 'max') {
      const gasReserve = 0.01
      const maxSpendable = Math.max(walletMonBalance - gasReserve, 0)
      setAmount(maxSpendable > 0 ? maxSpendable.toFixed(6) : '')
      return
    }
    setAmount(value)
  }

  return (
    <div className="relative rounded-xl border border-border bg-card p-3">
      <div className="mb-3 flex rounded-lg border border-border bg-secondary/40 p-1">
        <button
          onClick={() => setActiveTab('buy')}
          disabled={isDead}
          className={`flex-1 rounded-md py-2 text-center text-sm font-semibold transition-all ${
            activeTab === 'buy' ? 'bg-emerald-500 text-white' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Buy
        </button>
        <button
          onClick={() => setActiveTab('sell')}
          disabled={isDead}
          className={`flex-1 rounded-md py-2 text-center text-sm font-semibold transition-all ${
            activeTab === 'sell' ? 'bg-red-500 text-white' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Sell
        </button>
      </div>

      <div className="mb-2 flex items-center justify-between text-[11px]">
        <span className="text-muted-foreground">
          {activeTab === 'buy' ? (
            <>
              MON:{' '}
              <span className="text-foreground">{walletMonBalanceText}</span>
              {isConnected && walletTokenBalance > 0 && (
                <span className={`ml-1.5 ${atWhaleLimit ? 'text-red-400' : 'text-muted-foreground'}`}>
                  · {tokenSymbol}: {walletTokenBalance.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                  {atWhaleLimit ? ' (limit reached)' : ''}
                </span>
              )}
            </>
          ) : (
            <>
              Balance:{' '}
              <span className={balanceFetchError ? 'text-amber-400' : 'text-foreground'}>
                {balanceFetchError ? 'Unable to fetch' : `${walletTokenBalanceText} ${tokenSymbol}`}
              </span>
            </>
          )}
        </span>
        <button
          type="button"
          onClick={() => setSlippageEnabled(v => !v)}
          title={slippageEnabled ? 'Slippage protection ON (5%). Click to disable.' : 'Slippage protection OFF. Click to enable 5% slippage.'}
          className={`flex items-center gap-1 transition-colors ${slippageEnabled ? 'text-primary hover:text-primary/80' : 'text-muted-foreground hover:text-foreground'}`}
        >
          <Settings className="h-3.5 w-3.5" />
          {slippageEnabled ? 'Slippage 5%' : 'Slippage Off'}
        </button>
      </div>

      <div className="relative mb-2">
        <Input
          type="number"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          disabled={isDead}
          className="h-11 border-border bg-secondary/30 pr-24 font-mono text-lg placeholder:text-muted-foreground/50"
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <span className="text-xs font-medium text-foreground">{activeTab === 'buy' ? 'MON' : tokenSymbol}</span>
        </div>
      </div>

      {activeTab === 'buy' ? (
        <div className="mb-2 grid grid-cols-5 gap-1.5">
          {quickBuyAmounts.map((qa) => (
            <button
              key={qa.label}
              onClick={() => setBuyAmountByQuickAction(qa.value)}
              disabled={isDead}
              className={`rounded-md border py-1.5 text-[11px] font-medium transition-colors ${
                qa.isReset
                  ? 'border-border bg-secondary/30 text-muted-foreground hover:bg-secondary/60'
                  : qa.isMax
                  ? 'border-primary/50 bg-primary/10 text-primary hover:bg-primary/20'
                  : 'border-border bg-secondary/30 text-foreground hover:bg-secondary/60'
              }`}
            >
              {qa.isReset ? <RotateCcw className="mx-auto h-3 w-3" /> : qa.label}
            </button>
          ))}
        </div>
      ) : (
        <div className="mb-2 grid grid-cols-5 gap-1.5">
          <button
            onClick={() => setAmount('')}
            disabled={isDead}
            className="rounded-md border border-border bg-secondary/30 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-secondary/60"
          >
            <RotateCcw className="mx-auto h-3 w-3" />
          </button>
          {quickSellPercents.map((percent) => (
            <button
              key={percent}
              onClick={() => setSellAmountByPercent(percent)}
              disabled={isDead || walletTokenBalance <= 0}
              title={percent === 100 ? 'Sells 98% of balance — reserves 2% to avoid bonding curve rounding reverts.' : undefined}
              className={`rounded-md border py-1.5 text-[11px] font-medium transition-colors ${
                percent === 100
                  ? 'border-primary/50 bg-primary/10 text-primary hover:bg-primary/20'
                  : 'border-border bg-secondary/30 text-foreground hover:bg-secondary/60'
              }`}
            >
              {percent === 100 ? 'Max' : `%${percent}`}
            </button>
          ))}
        </div>
      )}

      <div className="mb-2 flex items-center justify-between text-[11px]">
        <span className="text-muted-foreground">
          {activeTab === 'buy' ? 'You receive ~' : 'You receive'}
        </span>
        <span className="font-mono text-primary">
          {activeTab === 'buy'
            ? `~${formatMonAmount(Number(calculatedTokens), 2)} ${tokenSymbol}`
            : `${quote ?? '–'} MON`}
        </span>
      </div>

      <div className="mb-3 rounded-md border border-border bg-amber-500/10 px-2.5 py-2 text-[11px] text-muted-foreground">
        You earn round points by trading and can receive extra rewards.
      </div>

      <Button
        disabled={isDead || isPending || awaitingConfirm}
        onClick={executeTrade}
        className={`w-full gap-2 py-5 text-sm font-semibold ${
          activeTab === 'buy' ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'bg-red-500 text-white hover:bg-red-600'
        }`}
      >
        {isPending || awaitingConfirm ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
        {isDead
          ? "💀 THIS TOKEN GOT CLAC'D"
          : !isConnected
          ? 'Connect'
          : isWrongChain
          ? 'Switch to Monad Testnet'
          : isPending
          ? 'Waiting for wallet...'
          : awaitingConfirm
          ? 'Confirming...'
          : activeTab === 'buy'
          ? 'Buy'
          : 'Sell'}
      </Button>
      {hash && (
        <p className="mt-2 truncate text-center text-[11px] text-muted-foreground">
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
      {errorText && (
        <p className="mt-2 text-center text-xs text-red-400">{errorText}</p>
      )}
      {txError && (
        <p className="mt-2 text-center text-sm text-red-400">{txError}</p>
      )}
      {isWrongChain && (
        <p className="mt-2 text-center text-xs text-amber-400">
          Wrong network detected. Switch to Monad Testnet to trade.
        </p>
      )}
      {isDead && (
        <div className="mt-2 text-center text-xs text-red-400">
          Trading is disabled after death clock reaches 0.
        </div>
      )}
    </div>
  )
}

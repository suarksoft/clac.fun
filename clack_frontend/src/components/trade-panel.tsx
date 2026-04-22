'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Wallet, Settings, RotateCcw } from 'lucide-react'
import {
  useAccount,
  useBalance,
  useChainId,
  usePublicClient,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from 'wagmi'
import { useConnectModal } from '@rainbow-me/rainbowkit'
import { formatEther, parseEther } from 'viem'
import { CLAC_FACTORY_ABI, CLAC_FACTORY_ADDRESS } from '@/lib/web3/contracts'
import { monadTestnet } from '@/lib/web3/chains'

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
  const [errorText, setErrorText] = useState<string | null>(null)
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const { switchChain } = useSwitchChain()
  const { openConnectModal } = useConnectModal()
  const publicClient = usePublicClient()
  const { data: hash, isPending, writeContractAsync } = useWriteContract()
  const txReceipt = useWaitForTransactionReceipt({ hash })
  const { data: balanceData } = useBalance({ address })
  const walletMonBalance = Number(balanceData?.formatted || userBalance || 0)
  const isWrongChain = isConnected && chainId !== monadTestnet.id

  const quickAmounts = [
    { label: 'Reset', value: '', isReset: true },
    { label: '0.5 MON', value: '0.5' },
    { label: '1 MON', value: '1' },
    { label: '5 MON', value: '5' },
    { label: '10 MON', value: '10' },
    { label: 'Max', value: 'max', isMax: true },
  ]

  const calculatedTokens =
    amount && amount !== 'max' ? (parseFloat(amount) / currentPrice).toFixed(2) : '0'

  const parsedAmount = useMemo(() => {
    if (!amount || amount === 'max') return null
    try {
      return parseEther(amount)
    } catch {
      return null
    }
  }, [amount])

  useEffect(() => {
    if (!parsedAmount || !publicClient || isDead) {
      setQuote(null)
      return
    }

    const readQuote = async () => {
      try {
        const fn = activeTab === 'buy' ? 'getBuyCost' : 'getSellQuote'
        const result = await publicClient.readContract({
          address: CLAC_FACTORY_ADDRESS as `0x${string}`,
          abi: CLAC_FACTORY_ABI,
          functionName: fn,
          args: [tokenId, parsedAmount],
        })
        setQuote(Number(formatEther(result as bigint)).toFixed(6))
      } catch {
        setQuote(null)
      }
    }

    readQuote()
  }, [activeTab, parsedAmount, publicClient, tokenId, isDead])

  useEffect(() => {
    if (txReceipt.isSuccess && onTradeSuccess) {
      onTradeSuccess()
    }
  }, [txReceipt.isSuccess, onTradeSuccess])

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
    setErrorText(null)

    try {
      if (activeTab === 'buy') {
        await writeContractAsync({
          address: CLAC_FACTORY_ADDRESS as `0x${string}`,
          abi: CLAC_FACTORY_ABI,
          functionName: 'buy',
          args: [tokenId, BigInt(0)],
          value: parsedAmount,
        })
      } else {
        await writeContractAsync({
          address: CLAC_FACTORY_ADDRESS as `0x${string}`,
          abi: CLAC_FACTORY_ABI,
          functionName: 'sell',
          args: [tokenId, parsedAmount, BigInt(0)],
        })
      }
      setAmount('')
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : 'Transaction failed.')
    }
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
          Balance: <span className="text-foreground">{walletMonBalance.toFixed(4)} MON</span>
        </span>
        <button
          type="button"
          className="flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground"
        >
          <Settings className="h-3.5 w-3.5" />
          Slippage Off
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

      <div className="mb-2 grid grid-cols-5 gap-1.5">
        {quickAmounts.map((qa) => (
          <button
            key={qa.label}
            onClick={() => setAmount(qa.value)}
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

      <div className="mb-2 flex items-center justify-between text-[11px]">
        <span className="text-muted-foreground">Expected</span>
        <span className="font-mono text-primary">
          {activeTab === 'buy' ? `${calculatedTokens} ${tokenSymbol}` : `${amount || '0'} MON`}
        </span>
      </div>
      {quote && (
        <div className="mb-2 flex items-center justify-between text-[11px]">
          <span className="text-muted-foreground">{activeTab === 'buy' ? 'Estimated Cost' : 'Estimated Return'}</span>
          <span className="font-mono text-foreground">{quote} MON</span>
        </div>
      )}

      <div className="mb-3 rounded-md border border-border bg-amber-500/10 px-2.5 py-2 text-[11px] text-muted-foreground">
        You earn round points by trading and can receive extra rewards.
      </div>

      <Button
        disabled={isDead || isPending || txReceipt.isLoading}
        onClick={executeTrade}
        className={`w-full gap-2 py-5 text-sm font-semibold ${
          activeTab === 'buy' ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'bg-red-500 text-white hover:bg-red-600'
        }`}
      >
        <Wallet className="h-4 w-4" />
        {isDead
          ? "💀 THIS TOKEN GOT CLAC'D"
          : !isConnected
          ? 'Connect'
          : isWrongChain
          ? 'Switch to Monad Testnet'
          : isPending || txReceipt.isLoading
          ? 'Processing...'
          : activeTab === 'buy'
          ? 'Buy'
          : 'Sell'}
      </Button>
      {hash && (
        <p className="mt-2 truncate text-center text-[11px] text-muted-foreground">Tx: {hash}</p>
      )}
      {errorText && (
        <p className="mt-2 text-center text-xs text-red-400">{errorText}</p>
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

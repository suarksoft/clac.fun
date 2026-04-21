'use client'

import { Header } from '@/components/header'
import { Button } from '@/components/ui/button'
import { ArrowDownUp, Wallet, Info } from 'lucide-react'
import { useState } from 'react'

const chains = [
  { id: 'ethereum', name: 'Ethereum', symbol: 'ETH', icon: '⟠' },
  { id: 'monad', name: 'Monad', symbol: 'MON', icon: '◈' },
  { id: 'arbitrum', name: 'Arbitrum', symbol: 'ARB', icon: '△' },
  { id: 'base', name: 'Base', symbol: 'ETH', icon: '◯' },
]

export default function BridgePage() {
  const [fromChain, setFromChain] = useState(chains[0])
  const [toChain, setToChain] = useState(chains[1])
  const [amount, setAmount] = useState('')

  const swapChains = () => {
    setFromChain(toChain)
    setToChain(fromChain)
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />

      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <h1 className="mb-2 text-3xl font-bold text-foreground">Bridge Assets</h1>
            <p className="text-muted-foreground">Transfer tokens between chains seamlessly</p>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6">
            {/* From Chain */}
            <div className="mb-2 rounded-xl bg-secondary/50 p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm text-muted-foreground">From</span>
                <span className="text-xs text-muted-foreground">Balance: 0.00</span>
              </div>
              <div className="flex items-center gap-3">
                <select
                  value={fromChain.id}
                  onChange={(e) => setFromChain(chains.find(c => c.id === e.target.value) || chains[0])}
                  className="rounded-lg border-0 bg-secondary px-3 py-2 text-foreground outline-none"
                >
                  {chains.map((chain) => (
                    <option key={chain.id} value={chain.id}>
                      {chain.icon} {chain.name}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="flex-1 bg-transparent text-right font-mono text-2xl text-foreground outline-none placeholder:text-muted-foreground"
                />
              </div>
            </div>

            {/* Swap Button */}
            <div className="relative z-10 -my-2 flex justify-center">
              <button
                onClick={swapChains}
                className="rounded-xl border-4 border-background bg-secondary p-2 text-muted-foreground transition-colors hover:bg-primary hover:text-primary-foreground"
              >
                <ArrowDownUp className="h-5 w-5" />
              </button>
            </div>

            {/* To Chain */}
            <div className="mb-6 rounded-xl bg-secondary/50 p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm text-muted-foreground">To</span>
                <span className="text-xs text-muted-foreground">You receive</span>
              </div>
              <div className="flex items-center gap-3">
                <select
                  value={toChain.id}
                  onChange={(e) => setToChain(chains.find(c => c.id === e.target.value) || chains[1])}
                  className="rounded-lg border-0 bg-secondary px-3 py-2 text-foreground outline-none"
                >
                  {chains.map((chain) => (
                    <option key={chain.id} value={chain.id}>
                      {chain.icon} {chain.name}
                    </option>
                  ))}
                </select>
                <div className="flex-1 text-right font-mono text-2xl text-muted-foreground">
                  {amount || '0.00'}
                </div>
              </div>
            </div>

            {/* Info */}
            <div className="mb-6 space-y-2 rounded-lg bg-secondary/30 p-3 text-sm">
              <div className="flex items-center justify-between text-muted-foreground">
                <span>Estimated time</span>
                <span>~2-5 minutes</span>
              </div>
              <div className="flex items-center justify-between text-muted-foreground">
                <span>Bridge fee</span>
                <span>0.1%</span>
              </div>
              <div className="flex items-center justify-between text-muted-foreground">
                <span>Gas fee</span>
                <span>~$0.50</span>
              </div>
            </div>

            {/* Connect Wallet Button */}
            <Button className="w-full gap-2 bg-primary py-6 text-lg text-primary-foreground hover:bg-primary/90">
              <Wallet className="h-5 w-5" />
              Connect to Bridge
            </Button>

            {/* Warning */}
            <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              <p className="text-xs text-amber-500/80">
                Bridge transactions are final and cannot be reversed. Please verify all details before confirming.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

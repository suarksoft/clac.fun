'use client'

import { Header } from '@/components/header'
import { ArrowDownUp } from 'lucide-react'

export default function BridgePage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />

      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl border border-border bg-card">
            <ArrowDownUp className="h-9 w-9 text-muted-foreground" />
          </div>
          <h1 className="mb-3 text-3xl font-bold text-foreground">Bridge</h1>
          <p className="mb-2 text-muted-foreground">
            Cross-chain bridging is coming soon.
          </p>
          <p className="text-sm text-muted-foreground/60">
            For now, use the official Monad faucet or a third-party bridge to get MON on testnet.
          </p>
        </div>
      </main>
    </div>
  )
}

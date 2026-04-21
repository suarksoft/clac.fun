'use client'

import { useState } from 'react'
import { Header } from '@/components/header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { 
  Zap, 
  Clock, 
  AlertCircle,
  Image as ImageIcon,
  Wallet
} from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'

type Duration = '6h' | '12h' | '24h'

export default function CreateTokenPage() {
  const [name, setName] = useState('')
  const [symbol, setSymbol] = useState('')
  const [description, setDescription] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [duration, setDuration] = useState<Duration>('12h')
  const [isConnected] = useState(false)

  const durations: { value: Duration; label: string; description: string; icon: React.ReactNode }[] = [
    {
      value: '6h',
      label: '6 Hours',
      description: 'Maximum intensity',
      icon: <Zap className="h-5 w-5" />
    },
    {
      value: '12h',
      label: '12 Hours',
      description: 'Half-day heat',
      icon: <Clock className="h-5 w-5" />
    },
    {
      value: '24h',
      label: '24 Hours',
      description: 'Full day run',
      icon: <Clock className="h-5 w-5" />
    }
  ]

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Handle form submission
    console.log({ name, symbol, description, imageUrl, duration })
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />

      <main className="flex-1">
        <div className="container mx-auto max-w-2xl px-4 py-8">
          {/* Page Header */}
          <div className="mb-8 text-center">
            <div className="mb-4 inline-flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/20">
              <Image 
                src="/clac-logo.svg" 
                alt="Clac" 
                width={48} 
                height={48}
                className="h-12 w-12"
              />
            </div>
            <h1 className="mb-2 text-3xl font-bold text-foreground">Snap Your Token Into Existence</h1>
            <p className="text-muted-foreground">
              One snap and your memecoin goes live. Fair bonding curve, no presale, no team allocation.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Image Upload */}
            <div className="space-y-2">
              <Label htmlFor="image" className="text-foreground">Token Image</Label>
              <div className="flex gap-4">
                <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl border-2 border-dashed border-border bg-secondary">
                  {imageUrl ? (
                    <img src={imageUrl} alt="Preview" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <ImageIcon className="h-8 w-8 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <div className="flex flex-1 flex-col justify-center gap-2">
                  <Input
                    id="image"
                    type="url"
                    placeholder="Enter image URL or upload"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    className="border-border bg-input"
                  />
                  <p className="text-xs text-muted-foreground">
                    Recommended: 400x400px, PNG or JPG format
                  </p>
                </div>
              </div>
            </div>

            {/* Token Name */}
            <div className="space-y-2">
              <Label htmlFor="name" className="text-foreground">Token Name</Label>
              <Input
                id="name"
                placeholder="e.g., Moon Shot"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={32}
                className="border-border bg-input"
              />
              <p className="text-xs text-muted-foreground">{name.length}/32 characters</p>
            </div>

            {/* Token Symbol */}
            <div className="space-y-2">
              <Label htmlFor="symbol" className="text-foreground">Token Symbol</Label>
              <Input
                id="symbol"
                placeholder="e.g., MOON"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                maxLength={8}
                className="border-border bg-input uppercase"
              />
              <p className="text-xs text-muted-foreground">{symbol.length}/8 characters</p>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description" className="text-foreground">Description</Label>
              <Textarea
                id="description"
                placeholder="Tell the world about your token..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={256}
                className="min-h-[100px] resize-none border-border bg-input"
              />
              <p className="text-xs text-muted-foreground">{description.length}/256 characters</p>
            </div>

            {/* Duration Selection - Time until SNAP */}
            <div className="space-y-3">
              <Label className="text-foreground">Time Until Snap (Token Graduation)</Label>
              <div className="grid gap-3 sm:grid-cols-3">
                {durations.map((d) => (
                  <button
                    key={d.value}
                    type="button"
                    onClick={() => setDuration(d.value)}
                    className={`relative rounded-xl border p-4 text-left transition-all ${
                      duration === d.value
                        ? 'border-primary bg-primary/10'
                        : 'border-border bg-card hover:border-primary/50'
                    }`}
                  >
                    {d.value === '6h' && (
                      <span className="absolute -top-2 right-2 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
                        RECOMMENDED
                      </span>
                    )}
                    <div
                      className={`mb-2 ${
                        duration === d.value ? 'text-primary' : 'text-muted-foreground'
                      }`}
                    >
                      {d.icon}
                    </div>
                    <p
                      className={`font-semibold ${
                        duration === d.value ? 'text-foreground' : 'text-foreground'
                      }`}
                    >
                      {d.label}
                    </p>
                    <p className="text-xs text-muted-foreground">{d.description}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Fee Info */}
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Creation Fee</span>
                <span className="font-mono font-semibold text-foreground">10 MON</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Initial Liquidity</span>
                <span className="text-muted-foreground">Provided by bonding curve</span>
              </div>
            </div>

            {/* Warning */}
            <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
              <div className="text-sm text-amber-500/90">
                <p className="font-semibold">The Snap is Coming</p>
                <p>
                  When the bonding curve hits 100%, SNAP - your token graduates to DEX. 
                  Like Thanos, but everyone wins. Ape in before the snap.
                </p>
              </div>
            </div>

            {/* Submit Button */}
            {isConnected ? (
              <Button
                type="submit"
                className="w-full gap-3 bg-primary py-6 text-lg font-semibold text-primary-foreground hover:bg-primary/90"
                disabled={!name || !symbol}
              >
                <Image 
                  src="/clac-logo.svg" 
                  alt="Snap" 
                  width={24} 
                  height={24}
                  className="h-6 w-6"
                />
                Snap Into Existence
              </Button>
            ) : (
              <Button
                type="button"
                className="w-full gap-3 bg-primary py-6 text-lg font-semibold text-primary-foreground hover:bg-primary/90"
              >
                <Wallet className="h-5 w-5" />
                Connect Wallet to Snap
              </Button>
            )}

            <p className="text-center text-xs text-muted-foreground">
              By creating a token, you agree to our{' '}
              <Link href="#" className="text-primary hover:underline">
                Terms of Service
              </Link>
            </p>
          </form>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-card py-6">
        <div className="container mx-auto flex flex-col items-center justify-between gap-4 px-4 text-sm text-muted-foreground md:flex-row">
          <div className="flex items-center gap-4">
            <span className="font-semibold text-foreground">Clac.fun</span>
            <span className="text-xs">Built for degens</span>
          </div>
          <div className="flex items-center gap-6">
            <a href="#" className="transition-colors hover:text-foreground">
              Docs
            </a>
            <a href="#" className="transition-colors hover:text-foreground">
              Twitter
            </a>
            <a href="#" className="transition-colors hover:text-foreground">
              Telegram
            </a>
            <a href="#" className="transition-colors hover:text-foreground">
              Contract
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}

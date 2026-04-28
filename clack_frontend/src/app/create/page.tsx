'use client'

import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { Header } from '@/components/header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  useAccount,
  useChainId,
  usePublicClient,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from 'wagmi'
import { useConnectModal } from '@rainbow-me/rainbowkit'
import { decodeEventLog, formatEther, parseEther } from 'viem'
import { CLAC_FACTORY_ABI, CLAC_FACTORY_ADDRESS } from '@/lib/web3/contracts'
import { monadTestnet } from '@/lib/web3/chains'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
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

const DURATION_SECONDS: Record<Duration, bigint> = {
  '6h': BigInt(6 * 60 * 60),
  '12h': BigInt(12 * 60 * 60),
  '24h': BigInt(24 * 60 * 60),
}

export default function CreateTokenPage() {
  const [name, setName] = useState('')
  const [symbol, setSymbol] = useState('')
  const [description, setDescription] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [duration, setDuration] = useState<Duration>('12h')
  const [errorText, setErrorText] = useState<string | null>(null)
  const [successText, setSuccessText] = useState<string | null>(null)
  const [creationFeeWei, setCreationFeeWei] = useState<bigint>(parseEther('10'))
  const [publicCreation, setPublicCreation] = useState<boolean | null>(null)
  const [ownerAddress, setOwnerAddress] = useState<string | null>(null)
  const [isConfigLoading, setIsConfigLoading] = useState(true)
  const router = useRouter()
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const { switchChain } = useSwitchChain()
  const { openConnectModal } = useConnectModal()
  const publicClient = usePublicClient()
  const { writeContractAsync, data: txHash, isPending } = useWriteContract()
  const {
    data: txReceipt,
    isLoading: isConfirming,
    isSuccess,
    isError: isReceiptError,
  } = useWaitForTransactionReceipt({ hash: txHash })

  const durations: { value: Duration; label: string; description: string; icon: ReactNode }[] = [
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

  const creationFeeDisplay = useMemo(() => Number(formatEther(creationFeeWei)).toFixed(2), [creationFeeWei])
  const isOwner = Boolean(
    address &&
      ownerAddress &&
      address.toLowerCase() === ownerAddress.toLowerCase(),
  )
  const isWrongChain = isConnected && chainId !== monadTestnet.id
  const creationLockedForUser = publicCreation === false && !isOwner
  const canSubmit =
    Boolean(name.trim()) &&
    Boolean(symbol.trim()) &&
    Boolean(imageUrl.trim()) &&
    !isConfigLoading &&
    !isWrongChain &&
    !creationLockedForUser &&
    !isPending &&
    !isConfirming

  useEffect(() => {
    if (!publicClient) return

    let cancelled = false
    const loadCreateConfig = async () => {
      setIsConfigLoading(true)
      try {
        const [fee, isPublic, owner] = await Promise.all([
          publicClient.readContract({
            address: CLAC_FACTORY_ADDRESS as `0x${string}`,
            abi: CLAC_FACTORY_ABI,
            functionName: 'creationFee',
          }),
          publicClient.readContract({
            address: CLAC_FACTORY_ADDRESS as `0x${string}`,
            abi: CLAC_FACTORY_ABI,
            functionName: 'publicCreation',
          }),
          publicClient.readContract({
            address: CLAC_FACTORY_ADDRESS as `0x${string}`,
            abi: CLAC_FACTORY_ABI,
            functionName: 'owner',
          }),
        ])

        if (!cancelled) {
          setCreationFeeWei(fee as bigint)
          setPublicCreation(Boolean(isPublic))
          setOwnerAddress(String(owner))
        }
      } catch {
        if (!cancelled) {
          setErrorText('Could not read contract config. Check RPC and contract address.')
        }
      } finally {
        if (!cancelled) {
          setIsConfigLoading(false)
        }
      }
    }

    loadCreateConfig()
    return () => {
      cancelled = true
    }
  }, [publicClient])

  useEffect(() => {
    if (isSuccess && txReceipt) {
      let createdTokenId: string | null = null
      for (const log of txReceipt.logs) {
        try {
          const decoded = decodeEventLog({
            abi: CLAC_FACTORY_ABI,
            data: log.data,
            topics: log.topics,
          })
          if (decoded.eventName === 'TokenCreated') {
            createdTokenId = String(decoded.args.tokenId)
            break
          }
        } catch {
          // ignore unrelated logs
        }
      }

      setSuccessText('Token created successfully. It will appear after indexer sync.')
      setErrorText(null)
      setName('')
      setSymbol('')
      setDescription('')
      setImageUrl('')
      setDuration('12h')
      if (createdTokenId) {
        router.push(`/token/${createdTokenId}`)
      }
    } else if (isReceiptError) {
      setSuccessText(null)
      setErrorText('Transaction failed while waiting for confirmation.')
      toast.error('Transaction failed while waiting for confirmation.')
    }
  }, [isSuccess, isReceiptError, txReceipt, router])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!isConnected) {
      openConnectModal?.()
      return
    }
    if (isWrongChain) {
      switchChain({ chainId: monadTestnet.id })
      return
    }

    if (!name.trim() || !symbol.trim() || !imageUrl.trim()) {
      setErrorText('Name, symbol, and image URL are required.')
      return
    }
    if (!imageUrl.trim().startsWith('https://')) {
      setErrorText('Token image URL must start with https://')
      return
    }

    if (creationLockedForUser) {
      setErrorText('Token creation is currently restricted to contract owner.')
      return
    }

    setErrorText(null)
    setSuccessText(null)
    try {
      await writeContractAsync({
        address: CLAC_FACTORY_ADDRESS as `0x${string}`,
        abi: CLAC_FACTORY_ABI,
        functionName: 'createToken',
        args: [name.trim(), symbol.trim().toUpperCase(), imageUrl.trim(), DURATION_SECONDS[duration]],
        value: creationFeeWei,
      })
    } catch (error) {
      setErrorText(
        error instanceof Error ? 'Token creation transaction failed. Please confirm wallet and fee.' : 'Token creation transaction failed.',
      )
      toast.error('Token creation transaction failed.')
    }
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
                        ? 'border-violet-400 bg-violet-500/10 shadow-[0_0_20px_rgba(139,92,246,0.25)]'
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
                <span className="text-sm text-muted-foreground">Creation fee:</span>
                <span className="font-mono font-semibold text-foreground">
                  {isConfigLoading ? 'Loading...' : `${creationFeeDisplay} MON`}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Initial Liquidity</span>
                <span className="text-muted-foreground">Provided by bonding curve</span>
              </div>
            </div>

            {publicCreation === false && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-500/90">
                Public creation is disabled on contract. Only owner can create tokens right now.
              </div>
            )}
            {isWrongChain && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-500/90">
                Wrong network detected. Switch to Monad Testnet before creating a token.
              </div>
            )}

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
                style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #8b5cf6 45%, #a78bfa 100%)' }}
                disabled={!canSubmit}
              >
                <Image 
                  src="/clac-logo.svg" 
                  alt="Snap" 
                  width={24} 
                  height={24}
                  className="h-6 w-6"
                />
                {isWrongChain
                  ? 'Switch to Monad Testnet'
                  : isPending
                  ? 'Waiting for wallet...'
                  : isConfirming
                  ? 'Creating token...'
                  : 'Launch Token 🚀'}
              </Button>
            ) : (
              <Button
                type="button"
                className="w-full gap-3 bg-primary py-6 text-lg font-semibold text-primary-foreground hover:bg-primary/90"
                style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #8b5cf6 45%, #a78bfa 100%)' }}
                onClick={() => openConnectModal?.()}
              >
                <Wallet className="h-5 w-5" />
                Connect to Snap
              </Button>
            )}
            {txHash && (
              <p className="truncate text-center text-xs text-muted-foreground">
                Tx: {txHash}
              </p>
            )}
            {successText && <p className="text-center text-xs text-emerald-400">{successText}</p>}
            {errorText && <p className="text-center text-xs text-red-400">{errorText}</p>}

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

'use client'

import { useEffect, useMemo, useState } from 'react'
import { Header } from '@/components/header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import {
  useAccount,
  useChainId,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from 'wagmi'
import { decodeEventLog, parseEther } from 'viem'
import { CLAC_FACTORY_ABI, CLAC_FACTORY_ADDRESS } from '@/lib/web3/contracts'
import { monadTestnet } from '@/lib/web3/chains'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import Link from 'next/link'

export default function CreateTokenPage() {
  const [tokenName, setTokenName] = useState('')
  const [tokenSymbol, setTokenSymbol] = useState('')
  const [imageURI, setImageURI] = useState('')
  const [selectedDuration, setSelectedDuration] = useState(21600)
  const [newTokenId, setNewTokenId] = useState<string | null>(null)

  const durations = [
    {
      value: 21600,
      label: '6 Hours',
      icon: '⚡',
      desc: 'Maximum intensity',
      recommended: true,
    },
    {
      value: 43200,
      label: '12 Hours',
      icon: '🔥',
      desc: 'Half-day heat',
      recommended: false,
    },
    {
      value: 86400,
      label: '24 Hours',
      icon: '⏰',
      desc: 'Full day run',
      recommended: false,
    },
  ] as const

  const router = useRouter()
  const { isConnected } = useAccount()
  const chainId = useChainId()
  const { switchChain } = useSwitchChain()
  const {
    writeContract,
    data: hash,
    isPending,
    error,
  } = useWriteContract()
  const { isLoading: isConfirming, isSuccess, data: receipt } =
    useWaitForTransactionReceipt({ hash })

  const isWrongChain = isConnected && chainId !== monadTestnet.id
  const isDurationValid = [21600, 43200, 86400].includes(selectedDuration)
  const isFormValid = useMemo(
    () =>
      tokenName.trim().length > 0 &&
      tokenName.trim().length <= 32 &&
      tokenSymbol.trim().length > 0 &&
      tokenSymbol.trim().length <= 8 &&
      isDurationValid,
    [tokenName, tokenSymbol, isDurationValid],
  )

  useEffect(() => {
    if (!receipt || !isSuccess) return

    let createdTokenId: string | null = null
    for (const log of receipt.logs) {
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

    setNewTokenId(createdTokenId)
    toast.success('Token created successfully!')

    const timer = setTimeout(() => {
      if (createdTokenId) {
        router.push(`/token/${createdTokenId}`)
      } else {
        router.push('/')
      }
    }, 2000)

    return () => clearTimeout(timer)
  }, [isSuccess, receipt, router])

  useEffect(() => {
    if (!error) return
    const message = error.message.toLowerCase()
    if (message.includes('insufficient funds')) {
      toast.error('Insufficient MON balance. You need 10 MON to create a token.')
      return
    }
    if (
      message.includes('user rejected') ||
      message.includes('user denied') ||
      message.includes('rejected the request')
    ) {
      toast.error('Transaction cancelled.')
      return
    }
    if (message.includes('creation not public yet')) {
      toast.error('Token creation is currently restricted to admins.')
      return
    }
    toast.error('Transaction failed. Please try again.')
  }, [error])

  const handleCreate = () => {
    if (!tokenName.trim() || !tokenSymbol.trim()) {
      toast.error('Token name and symbol are required')
      return
    }

    if (!isConnected) {
      toast.error('Connect your wallet first')
      return
    }

    if (isWrongChain) {
      switchChain({ chainId: monadTestnet.id })
      toast.error('Switch to Monad Testnet first')
      return
    }

    if (!isDurationValid) {
      toast.error('Invalid duration selected')
      return
    }

    writeContract({
      address: CLAC_FACTORY_ADDRESS as `0x${string}`,
      abi: CLAC_FACTORY_ABI,
      functionName: 'createToken',
      args: [
        tokenName.trim(),
        tokenSymbol.trim().toUpperCase(),
        imageURI.trim() || '',
        BigInt(selectedDuration),
      ],
      value: parseEther('10'),
    })
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />

      <main className="flex-1 px-4 py-10">
        <div className="mx-auto w-full max-w-[480px] rounded-2xl border border-zinc-800 bg-zinc-950/70 p-6 shadow-2xl">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-bold text-white">🚀 Create Token</h1>
            <p className="mt-1 text-sm text-zinc-400">
              Launch your token on clac.fun
            </p>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="token-name" className="text-zinc-200">
                Token Name *
              </Label>
              <Input
                id="token-name"
                value={tokenName}
                maxLength={32}
                onChange={(e) => setTokenName(e.target.value)}
                placeholder="e.g., Moon Shot"
                className="border-zinc-700 bg-zinc-900 text-white"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="token-symbol" className="text-zinc-200">
                Token Symbol *
              </Label>
              <Input
                id="token-symbol"
                value={tokenSymbol}
                maxLength={8}
                onChange={(e) => setTokenSymbol(e.target.value.toUpperCase())}
                placeholder="e.g., MOON"
                className="border-zinc-700 bg-zinc-900 text-white uppercase"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="token-image" className="text-zinc-200">
                Token Image (optional)
              </Label>
              <Input
                id="token-image"
                type="text"
                value={imageURI}
                onChange={(e) => setImageURI(e.target.value)}
                placeholder="https://example.com/image.png"
                className="border-zinc-700 bg-zinc-900 text-white"
              />
              <p className="text-xs text-zinc-500">
                Paste an image URL. Leave empty for default.
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-zinc-200">Duration *</Label>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {durations.map((d) => {
                  const isSelected = selectedDuration === d.value
                  return (
                    <button
                      key={d.value}
                      type="button"
                      onClick={() => setSelectedDuration(d.value)}
                      className={`relative rounded-xl border p-3 text-left transition-all ${
                        isSelected
                          ? 'border-violet-400 bg-violet-500/10 shadow-[0_0_20px_rgba(139,92,246,0.28)]'
                          : 'border-zinc-700 bg-zinc-900 text-zinc-300'
                      }`}
                    >
                      {d.recommended && (
                        <span className="absolute -top-2 right-2 rounded-full bg-violet-600 px-2 py-0.5 text-[10px] font-semibold text-white">
                          Recommended
                        </span>
                      )}
                      <div className="text-xl">{d.icon}</div>
                      <p className="mt-1 font-semibold">{d.label}</p>
                      <p className="text-xs text-zinc-400">{d.desc}</p>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="mb-1 text-center text-sm text-zinc-400">
              <span className="font-bold text-white">Creation fee: 10 MON</span>
              <br />
              This fee is sent to the protocol treasury.
            </div>

            {!isConnected && (
              <Button
                disabled
                className="w-full cursor-not-allowed py-6 text-base opacity-50"
              >
                Connect Wallet to Create
              </Button>
            )}

            {isConnected && !isPending && !isConfirming && !isSuccess && (
              <Button
                onClick={handleCreate}
                disabled={!isFormValid || isWrongChain}
                className="w-full bg-violet-600 py-6 text-base text-white hover:bg-violet-500 disabled:opacity-50"
              >
                🚀 Launch Token (10 MON)
              </Button>
            )}

            {isPending && (
              <Button disabled className="w-full py-6 text-base opacity-50">
                ⏳ Waiting for wallet...
              </Button>
            )}

            {isConfirming && (
              <Button disabled className="w-full gap-2 py-6 text-base opacity-50">
                <Spinner />
                Creating token...
              </Button>
            )}

            {isSuccess && (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-center text-sm text-emerald-400">
                ✅ Token created successfully!
                {newTokenId ? (
                  <div className="mt-1">
                    <Link className="underline hover:text-emerald-300" href={`/token/${newTokenId}`}>
                      View your token →
                    </Link>
                  </div>
                ) : null}
              </div>
            )}

            {isWrongChain && isConnected && !isPending && !isConfirming && !isSuccess && (
              <p className="text-center text-xs text-amber-400">
                Wrong network detected. Please switch to Monad Testnet (10143).
              </p>
            )}

            {hash ? (
              <p className="truncate text-center text-xs text-zinc-500">
                Tx: {hash}
              </p>
            ) : null}

            <p className="text-center text-xs text-zinc-500">
              Every token has a death clock.
              <br />
              When time&apos;s up: clac. 💀
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}

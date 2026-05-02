'use client'

import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { Header } from '@/components/header'
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
import { publicEnv } from '@/lib/env'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import Link from 'next/link'

export default function CreateTokenPage() {
  const [tokenName, setTokenName] = useState('')
  const [tokenSymbol, setTokenSymbol] = useState('')
  const [imageURI, setImageURI] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [selectedDuration, setSelectedDuration] = useState(21600)
  const [newTokenId, setNewTokenId] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  const durations = [
    {
      value: 21600,
      label: '6 Hours',
      icon: '⚡',
      desc: 'Max intensity',
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
    return () => {
      if (imagePreview.startsWith('blob:')) {
        URL.revokeObjectURL(imagePreview)
      }
    }
  }, [imagePreview])

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

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Max file size is 5MB')
      return
    }
    if (!/^image\/(jpeg|jpg|png|gif|webp)$/i.test(file.type)) {
      toast.error('Only JPEG, PNG, GIF, or WEBP images are allowed')
      return
    }
    setImageFile(file)
    setImageURI('')
    setImagePreview((prev) => {
      if (prev.startsWith('blob:')) URL.revokeObjectURL(prev)
      return URL.createObjectURL(file)
    })
  }

  const handleCreate = async () => {
    setSubmitted(true)

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

    let finalImageURI = imageURI.trim()

    if (imageFile) {
      setIsUploading(true)
      try {
        const formData = new FormData()
        formData.append('file', imageFile)
        const res = await fetch(
          `${publicEnv.NEXT_PUBLIC_BACKEND_URL}/api/upload/image`,
          { method: 'POST', body: formData },
        )
        if (!res.ok) {
          const errText = await res.text().catch(() => '')
          throw new Error(errText || `Upload failed (${res.status})`)
        }
        const data = (await res.json()) as { url?: string }
        if (!data.url) throw new Error('Invalid upload response')
        finalImageURI = data.url
      } catch {
        toast.error('Image upload failed. Check backend Cloudinary config.')
        setIsUploading(false)
        return
      }
      setIsUploading(false)
    } else if (finalImageURI && /^https?:\/\//i.test(finalImageURI)) {
      setIsUploading(true)
      try {
        const res = await fetch(
          `${publicEnv.NEXT_PUBLIC_BACKEND_URL}/api/upload/image-url`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: finalImageURI }),
          },
        )
        if (res.ok) {
          const data = (await res.json()) as { url?: string }
          if (data.url) finalImageURI = data.url
        }
      } catch {
        // Keep original remote URL if mirror fails
      }
      setIsUploading(false)
    }

    writeContract({
      address: CLAC_FACTORY_ADDRESS as `0x${string}`,
      abi: CLAC_FACTORY_ABI,
      functionName: 'createToken',
      args: [
        tokenName.trim(),
        tokenSymbol.trim().toUpperCase(),
        finalImageURI || '',
        BigInt(selectedDuration),
      ],
      value: parseEther('10'),
    })
  }

  const clearImage = () => {
    if (imagePreview.startsWith('blob:')) URL.revokeObjectURL(imagePreview)
    setImageFile(null)
    setImagePreview('')
    setImageURI('')
  }

  const isBusy = isUploading || isPending || isConfirming

  return (
    <div className="flex min-h-screen flex-col bg-gray-950">
      <Header />

      <main className="flex-1 px-4 pb-20 pt-8">
        <div className="mx-auto max-w-lg">

          {/* Header */}
          <div className="mb-8 text-center">
            <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-purple-800">
              <span className="text-3xl">🫰</span>
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">Create Token</h1>
            <p className="text-gray-400">Every token has a death clock. Make it count.</p>
          </div>

          {/* Form Card */}
          <div className="space-y-6 rounded-2xl border border-gray-800 bg-gray-900/50 p-6 backdrop-blur-sm">

            {/* Token Name */}
            <div className="space-y-2">
              <label className="flex items-center gap-1 text-sm font-medium text-gray-300">
                Token Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g., Moon Shot"
                value={tokenName}
                onChange={(e) => setTokenName(e.target.value)}
                maxLength={32}
                className={`w-full rounded-xl border bg-gray-800/50 px-4 py-3 text-white placeholder-gray-500 transition-all focus:outline-none focus:ring-1 focus:ring-violet-500 ${
                  submitted && !tokenName.trim()
                    ? 'border-red-500 focus:border-red-500'
                    : 'border-gray-700 focus:border-violet-500'
                }`}
              />
              <p className={`text-right text-xs ${tokenName.length > 28 ? 'text-red-400' : 'text-gray-600'}`}>
                {tokenName.length}/32
              </p>
            </div>

            {/* Token Symbol */}
            <div className="space-y-2">
              <label className="flex items-center gap-1 text-sm font-medium text-gray-300">
                Token Symbol <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g., MOON"
                value={tokenSymbol}
                onChange={(e) => setTokenSymbol(e.target.value.toUpperCase())}
                maxLength={8}
                className={`w-full rounded-xl border bg-gray-800/50 px-4 py-3 font-mono tracking-wider text-white uppercase placeholder-gray-500 transition-all focus:outline-none focus:ring-1 focus:ring-violet-500 ${
                  submitted && !tokenSymbol.trim()
                    ? 'border-red-500 focus:border-red-500'
                    : 'border-gray-700 focus:border-violet-500'
                }`}
              />
              <p className={`text-right text-xs ${tokenSymbol.length > 6 ? 'text-red-400' : 'text-gray-600'}`}>
                {tokenSymbol.length}/8
              </p>
            </div>

            <div className="border-t border-gray-800" />

            {/* Token Image */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">Token Image</label>

              {/* Upload Zone */}
              <div
                onClick={() => document.getElementById('imageInput')?.click()}
                className="group relative cursor-pointer rounded-xl border-2 border-dashed border-gray-700 p-8 text-center transition-all duration-300 hover:border-violet-500/50 hover:bg-violet-500/5"
              >
                {imagePreview ? (
                  <div className="relative inline-block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="mx-auto h-28 w-28 animate-pulse rounded-2xl object-cover ring-2 ring-violet-500/30"
                    />
                    <button
                      onClick={(e) => { e.stopPropagation(); clearImage() }}
                      className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-xs text-white hover:bg-red-400"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <div className="text-gray-500 transition-colors group-hover:text-gray-400">
                    <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-xl bg-gray-800 transition-colors group-hover:bg-gray-700">
                      <span className="text-2xl">📷</span>
                    </div>
                    <p className="text-sm font-medium">Click to upload image</p>
                    <p className="mt-1 text-xs text-gray-600">PNG, JPG, GIF, WEBP — Max 5MB</p>
                  </div>
                )}
              </div>

              <input
                id="imageInput"
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                onChange={handleFileChange}
                className="hidden"
              />

              {/* URL Alternative */}
              <div className="my-3 flex items-center gap-3">
                <div className="flex-1 border-t border-gray-800" />
                <span className="text-xs text-gray-600">or paste URL</span>
                <div className="flex-1 border-t border-gray-800" />
              </div>

              <input
                type="text"
                placeholder="https://example.com/image.png"
                value={imageURI}
                onChange={(e) => {
                  const v = e.target.value
                  setImageURI(v)
                  setImageFile(null)
                  setImagePreview((prev) => {
                    if (prev.startsWith('blob:')) URL.revokeObjectURL(prev)
                    return v.trim().startsWith('http') ? v.trim() : ''
                  })
                }}
                className="w-full rounded-xl border border-gray-700 bg-gray-800/50 px-4 py-3 text-sm text-white placeholder-gray-500 transition-all focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
              />
            </div>

            <div className="border-t border-gray-800" />

            {/* Duration Selector */}
            <div className="space-y-3">
              <label className="flex items-center gap-1 text-sm font-medium text-gray-300">
                Duration <span className="text-red-400">*</span>
              </label>

              <div className="grid grid-cols-3 gap-3">
                {durations.map((d) => {
                  const isSelected = selectedDuration === d.value
                  return (
                    <button
                      key={d.value}
                      type="button"
                      onClick={() => setSelectedDuration(d.value)}
                      className={`relative rounded-xl border-2 p-4 text-center transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] ${
                        isSelected
                          ? 'border-violet-500 bg-violet-500/10 shadow-lg shadow-violet-500/10'
                          : 'border-gray-700 bg-gray-800/30 hover:border-gray-600 hover:bg-gray-800/50'
                      }`}
                    >
                      {isSelected && (
                        <div className="absolute -top-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-violet-500 px-2 py-0.5 text-[10px] font-bold text-white">
                          SELECTED
                        </div>
                      )}
                      {d.recommended && !isSelected && (
                        <div className="absolute -top-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-green-600 px-2 py-0.5 text-[10px] font-bold text-white">
                          BEST
                        </div>
                      )}
                      <div className="mb-1 text-2xl">{d.icon}</div>
                      <div className="text-sm font-bold text-white">{d.label}</div>
                      <div className="mt-0.5 text-xs text-gray-500">{d.desc}</div>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="border-t border-gray-800" />

            {/* Fee Info */}
            <div className="rounded-xl border border-gray-800 bg-gray-800/30 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">💎</span>
                  <span className="text-sm text-gray-400">Creation Fee</span>
                </div>
                <span className="font-mono text-lg font-bold text-white">10 MON</span>
              </div>
              <p className="mt-2 text-xs text-gray-600">
                Fee is sent to the protocol treasury. Your token goes live immediately.
              </p>
            </div>

            {/* Wrong chain warning */}
            {isWrongChain && isConnected && !isPending && !isConfirming && !isSuccess && (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-center">
                <p className="text-xs text-amber-400">
                  Wrong network. Please switch to Monad Testnet (10143).
                </p>
              </div>
            )}

            {/* Submit Button */}
            {!isConnected ? (
              <button
                disabled
                className="w-full cursor-not-allowed rounded-xl bg-gray-700 py-4 text-base font-bold text-gray-400"
              >
                Connect Wallet to Create
              </button>
            ) : (
              <button
                onClick={() => void handleCreate()}
                disabled={!isFormValid || isBusy || isWrongChain}
                className={`w-full rounded-xl py-4 text-base font-bold transition-all duration-300 ${
                  !isFormValid || isBusy || isWrongChain
                    ? 'cursor-not-allowed bg-gray-700 text-gray-400'
                    : 'bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-lg shadow-violet-500/20 hover:from-violet-500 hover:to-purple-500 hover:shadow-violet-500/30 active:scale-[0.98]'
                }`}
              >
                {isUploading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Spinner />
                    Uploading image...
                  </span>
                ) : isPending ? (
                  <span className="flex items-center justify-center gap-2">
                    <Spinner />
                    Waiting for wallet...
                  </span>
                ) : isConfirming ? (
                  <span className="flex items-center justify-center gap-2">
                    <Spinner />
                    Creating token...
                  </span>
                ) : (
                  <span>🚀 Launch Token (10 MON)</span>
                )}
              </button>
            )}

            {/* Success State */}
            {isSuccess && (
              <div className="animate-in fade-in rounded-xl border border-green-500/20 bg-green-500/10 p-4 text-center duration-500">
                <div className="mb-2 text-3xl">🎉</div>
                <p className="font-bold text-green-400">Token created successfully!</p>
                <p className="mt-1 text-sm text-gray-400">Death clock is ticking...</p>
                {newTokenId && (
                  <div className="mt-2">
                    <Link className="text-sm text-green-300 underline hover:text-green-200" href={`/token/${newTokenId}`}>
                      View your token →
                    </Link>
                  </div>
                )}
              </div>
            )}

            {/* Error State */}
            {error && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-center">
                <p className="text-sm text-red-400">
                  {error.message?.toLowerCase().includes('insufficient')
                    ? 'Insufficient MON balance. You need at least 10 MON.'
                    : error.message?.toLowerCase().includes('rejected') || error.message?.toLowerCase().includes('denied')
                    ? 'Transaction cancelled.'
                    : 'Transaction failed. Please try again.'}
                </p>
              </div>
            )}

            {/* Tx Hash */}
            {hash && (
              <p className="truncate text-center text-xs text-gray-600">
                Tx: {hash}
              </p>
            )}
          </div>

          {/* Bottom Info */}
          <div className="mt-6 text-center">
            <p className="text-xs text-gray-600">
              Every token has a death clock. When time&apos;s up: clac. 💀
            </p>
            <p className="mt-1 text-xs text-gray-700">
              2% protocol fee + 1% creator fee per trade • 5% death tax
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}

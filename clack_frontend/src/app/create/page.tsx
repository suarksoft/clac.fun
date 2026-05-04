'use client'

import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { Header } from '@/components/header'
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
import { apiClient } from '@/lib/api/client'

// ---------------------------------------------------------------------------
// Mini preview — mobile sticky top bar
// ---------------------------------------------------------------------------
function MiniPreviewCard({
  name,
  symbol,
  image,
  duration,
  timeLeft,
}: {
  name: string
  symbol: string
  image: string
  duration: number
  timeLeft: string
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-gray-800 bg-gray-900/95 p-3 shadow-lg backdrop-blur-md">
      <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-xl bg-gray-800">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-lg opacity-30">
            🫰
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          {symbol && (
            <span className="font-mono text-[10px] font-bold text-violet-400">
              ${symbol}
            </span>
          )}
          <span className="truncate text-sm font-bold text-white">
            {name || 'Your Token'}
          </span>
        </div>
        <p className="text-[10px] text-gray-500">Live Preview</p>
      </div>

      <div className="flex-shrink-0 text-right">
        <span className="font-mono text-sm font-bold text-white">{timeLeft}</span>
        <p className="text-[10px] text-gray-500">
          {duration === 21600 ? '6H' : duration === 43200 ? '12H' : '24H'}
        </p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
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
  const [previewTimeLeft, setPreviewTimeLeft] = useState('06:00:00')
  const [tokenDescription, setTokenDescription] = useState('')
  const [tokenWebsite, setTokenWebsite] = useState('')
  const [tokenTwitter, setTokenTwitter] = useState('')
  const [tokenTelegram, setTokenTelegram] = useState('')
  const [showSocials, setShowSocials] = useState(false)

  const router = useRouter()
  const { isConnected } = useAccount()
  const chainId = useChainId()
  const { switchChain } = useSwitchChain()
  const { writeContract, data: hash, isPending, error } = useWriteContract()
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
      !!(imageFile || imageURI.trim()) &&
      isDurationValid,
    [tokenName, tokenSymbol, imageFile, imageURI, isDurationValid],
  )
  const isBusy = isUploading || isPending || isConfirming

  // Reset preview clock when duration changes
  useEffect(() => {
    const map: Record<number, string> = {
      21600: '06:00:00',
      43200: '12:00:00',
      86400: '24:00:00',
    }
    setPreviewTimeLeft(map[selectedDuration] ?? '06:00:00')
  }, [selectedDuration])

  // Simulated countdown for the live preview
  useEffect(() => {
    const id = setInterval(() => {
      setPreviewTimeLeft((prev) => {
        const [h, m, s] = prev.split(':').map(Number)
        let ns = s, nm = m, nh = h
        if (ns > 0) ns--
        else if (nm > 0) { nm--; ns = 59 }
        else if (nh > 0) { nh--; nm = 59; ns = 59 }
        return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}:${String(ns).padStart(2, '0')}`
      })
    }, 1000)
    return () => clearInterval(id)
  }, [selectedDuration])

  // Revoke blob URL on change
  useEffect(() => {
    return () => {
      if (imagePreview.startsWith('blob:')) URL.revokeObjectURL(imagePreview)
    }
  }, [imagePreview])

  // Success redirect
  useEffect(() => {
    if (!receipt || !isSuccess) return
    let createdTokenId: string | null = null
    for (const log of receipt.logs) {
      try {
        const decoded = decodeEventLog({ abi: CLAC_FACTORY_ABI, data: log.data, topics: log.topics })
        if (decoded.eventName === 'TokenCreated') {
          createdTokenId = String(decoded.args.tokenId)
          break
        }
      } catch { /* ignore unrelated logs */ }
    }
    setNewTokenId(createdTokenId)
    toast.success('Token created successfully!')

    // Save social links to backend (best-effort, non-blocking)
    if (createdTokenId) {
      const socials = {
        description: tokenDescription.trim() || undefined,
        website: tokenWebsite.trim() || undefined,
        twitter: tokenTwitter.trim() || undefined,
        telegram: tokenTelegram.trim() || undefined,
      }
      if (Object.values(socials).some(Boolean)) {
        apiClient.updateTokenSocials(Number(createdTokenId), socials).catch(() => {/* ignore */})
      }
    }

    const timer = setTimeout(() => {
      router.push(createdTokenId ? `/token/${createdTokenId}` : '/')
    }, 2000)
    return () => clearTimeout(timer)
  }, [isSuccess, receipt, router, tokenDescription, tokenWebsite, tokenTwitter, tokenTelegram])

  // Error toasts
  useEffect(() => {
    if (!error) return
    const msg = error.message.toLowerCase()
    if (msg.includes('insufficient funds')) {
      toast.error('Insufficient MON balance. You need 10 MON to create a token.')
    } else if (msg.includes('user rejected') || msg.includes('user denied') || msg.includes('rejected the request')) {
      toast.error('Transaction cancelled.')
    } else if (msg.includes('creation not public yet')) {
      toast.error('Token creation is currently restricted to admins.')
    } else {
      toast.error('Transaction failed. Please try again.')
    }
  }, [error])

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { toast.error('Max file size is 5MB'); return }
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

  const clearImage = () => {
    if (imagePreview.startsWith('blob:')) URL.revokeObjectURL(imagePreview)
    setImageFile(null)
    setImagePreview('')
    setImageURI('')
  }

  const handleCreate = async () => {
    setSubmitted(true)
    if (!tokenName.trim() || !tokenSymbol.trim()) {
      toast.error('Token name and symbol are required')
      return
    }
    if (!imageFile && !imageURI.trim()) {
      toast.error('Please upload a token image')
      return
    }
    if (!isConnected) { toast.error('Connect your wallet first'); return }
    if (isWrongChain) { switchChain({ chainId: monadTestnet.id }); toast.error('Switch to Monad Testnet first'); return }
    if (!isDurationValid) { toast.error('Invalid duration selected'); return }

    let finalImageURI = imageURI.trim()

    if (imageFile) {
      setIsUploading(true)
      try {
        const formData = new FormData()
        formData.append('file', imageFile)
        const res = await fetch(`${publicEnv.NEXT_PUBLIC_BACKEND_URL}/api/upload/image`, { method: 'POST', body: formData })
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
        const res = await fetch(`${publicEnv.NEXT_PUBLIC_BACKEND_URL}/api/upload/image-url`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: finalImageURI }),
        })
        if (res.ok) {
          const data = (await res.json()) as { url?: string }
          if (data.url) finalImageURI = data.url
        }
      } catch { /* Keep original remote URL if mirror fails */ }
      setIsUploading(false)
    }

    writeContract({
      address: CLAC_FACTORY_ADDRESS as `0x${string}`,
      abi: CLAC_FACTORY_ABI,
      functionName: 'createToken',
      args: [tokenName.trim(), tokenSymbol.trim().toUpperCase(), finalImageURI || '', BigInt(selectedDuration)],
      value: parseEther('10'),
    })
  }

  const getActiveStep = () => {
    if (!tokenName && !tokenSymbol) return 1
    if (tokenName && !tokenSymbol) return 2
    if (tokenName && tokenSymbol && !imagePreview) return 3
    return 4
  }

  const durationLabel = selectedDuration === 21600 ? '6H' : selectedDuration === 43200 ? '12H' : '24H'

  return (
    <div className="flex min-h-screen flex-col bg-gray-950">
      <Header />

      <main className="flex-1 px-4 pb-20 pt-4">
        <div className="mx-auto max-w-5xl">

          {/* Mobile sticky preview */}
          <div className="sticky top-16 z-30 mb-4 md:hidden">
            <MiniPreviewCard
              name={tokenName}
              symbol={tokenSymbol}
              image={imagePreview}
              duration={selectedDuration}
              timeLeft={previewTimeLeft}
            />
          </div>

          <div className="flex gap-10">

            {/* ── LEFT: Form ── */}
            <div className="w-full max-w-lg md:mx-0">

              <div className="mb-8">
                <h1 className="text-2xl font-bold text-white">Create Token</h1>
                <p className="mt-1 text-sm text-gray-500">Fill in the details. Watch your token come alive.</p>
              </div>

              {/* Progress steps */}
              <div className="mb-8 flex items-center">
                {[
                  { num: 1, label: 'Name' },
                  { num: 2, label: 'Symbol' },
                  { num: 3, label: 'Image' },
                  { num: 4, label: 'Duration' },
                ].map((step, i) => {
                  const active = getActiveStep()
                  const done = active > step.num
                  const current = active === step.num
                  return (
                    <div key={step.num} className="flex flex-1 items-center">
                      <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all duration-300 ${
                        done ? 'bg-green-500 text-white'
                          : current ? 'bg-violet-500 text-white ring-4 ring-violet-500/20'
                          : 'bg-gray-800 text-gray-500'
                      }`}>
                        {done ? '✓' : step.num}
                      </div>
                      <span className={`ml-2 hidden text-xs sm:block ${active >= step.num ? 'text-white' : 'text-gray-600'}`}>
                        {step.label}
                      </span>
                      {i < 3 && (
                        <div className={`mx-3 h-px flex-1 transition-colors duration-300 ${done ? 'bg-green-500' : 'bg-gray-800'}`} />
                      )}
                    </div>
                  )
                })}
              </div>

              <div className="space-y-6">

                {/* Step 1 — Name */}
                <div className={`transition-opacity duration-300 ${getActiveStep() >= 1 ? 'opacity-100' : 'opacity-40'}`}>
                  <label className="mb-2 block text-sm font-medium text-gray-300">
                    What&apos;s your token called? <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Moon Shot, Degen Cat, Based AF..."
                    value={tokenName}
                    onChange={(e) => setTokenName(e.target.value)}
                    maxLength={32}
                    autoFocus
                    className={`w-full rounded-xl border bg-gray-900 px-4 py-4 text-lg text-white placeholder-gray-600 transition-all focus:outline-none focus:ring-1 focus:ring-violet-500 ${
                      submitted && !tokenName.trim() ? 'border-red-500' : 'border-gray-800 focus:border-violet-500'
                    }`}
                  />
                  <div className="mt-1.5 flex justify-between">
                    <p className="text-xs text-gray-600">Make it memorable</p>
                    <p className={`text-xs ${tokenName.length > 28 ? 'text-red-400' : 'text-gray-600'}`}>
                      {tokenName.length}/32
                    </p>
                  </div>
                </div>

                {/* Step 2 — Symbol */}
                <div className={`transition-opacity duration-300 ${getActiveStep() >= 2 ? 'opacity-100' : 'opacity-40'}`}>
                  <label className="mb-2 block text-sm font-medium text-gray-300">
                    Ticker symbol <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-mono text-lg text-gray-500">$</span>
                    <input
                      type="text"
                      placeholder="MOON"
                      value={tokenSymbol}
                      onChange={(e) => setTokenSymbol(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                      maxLength={8}
                      className={`w-full rounded-xl border bg-gray-900 py-4 pl-10 pr-4 font-mono text-lg uppercase tracking-widest text-white placeholder-gray-600 transition-all focus:outline-none focus:ring-1 focus:ring-violet-500 ${
                        submitted && !tokenSymbol.trim() ? 'border-red-500' : 'border-gray-800 focus:border-violet-500'
                      }`}
                    />
                  </div>
                  <div className="mt-1.5 flex justify-between">
                    <p className="text-xs text-gray-600">Letters and numbers only</p>
                    <p className={`text-xs ${tokenSymbol.length > 6 ? 'text-orange-400' : 'text-gray-600'}`}>
                      {tokenSymbol.length}/8
                    </p>
                  </div>
                </div>

                {/* Step 3 — Image */}
                <div className={`transition-opacity duration-300 ${getActiveStep() >= 3 ? 'opacity-100' : 'opacity-40'}`}>
                  <label className="mb-2 block text-sm font-medium text-gray-300">
                    Token image <span className="text-red-400">*</span>
                  </label>

                  <div
                    onClick={() => document.getElementById('imageInput')?.click()}
                    className={`group relative cursor-pointer overflow-hidden rounded-xl border-2 border-dashed text-center transition-all duration-300 ${
                      imagePreview
                        ? 'border-violet-500/30 p-2'
                        : `${submitted && !imagePreview ? 'border-red-500/50' : 'border-gray-800'} p-8 hover:border-violet-500/30 hover:bg-violet-500/5`
                    }`}
                  >
                    {imagePreview ? (
                      <div className="relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={imagePreview} alt="Preview" className="h-40 w-full rounded-lg object-cover" />
                        <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/0 transition-colors group-hover:bg-black/40">
                          <span className="text-sm font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
                            Change image
                          </span>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); clearImage() }}
                          className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-xs text-white backdrop-blur-sm transition-colors hover:bg-red-500"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-800/80 transition-colors group-hover:bg-violet-500/20">
                          <svg className="h-6 w-6 text-gray-500 transition-colors group-hover:text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <p className="text-sm text-gray-400 group-hover:text-gray-300">Drop an image or click to browse</p>
                        <p className="mt-1 text-xs text-gray-600">PNG, JPG, GIF, WEBP • Max 5MB</p>
                      </>
                    )}
                  </div>

                  <input
                    id="imageInput"
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    onChange={handleFileChange}
                    className="hidden"
                  />

                  {!imagePreview && (
                    <>
                      <div className="my-3 flex items-center gap-3">
                        <div className="flex-1 border-t border-gray-800/50" />
                        <span className="text-[10px] uppercase tracking-wider text-gray-700">or paste url</span>
                        <div className="flex-1 border-t border-gray-800/50" />
                      </div>
                      <input
                        type="text"
                        placeholder="https://..."
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
                        className="w-full rounded-xl border border-gray-800 bg-gray-900 px-4 py-3 text-sm text-white placeholder-gray-600 transition-all focus:border-violet-500 focus:outline-none"
                      />
                    </>
                  )}
                </div>

                {/* Step 4 — Duration */}
                <div className={`transition-opacity duration-300 ${getActiveStep() >= 4 ? 'opacity-100' : 'opacity-40'}`}>
                  <label className="mb-3 block text-sm font-medium text-gray-300">
                    How long should it live? <span className="text-red-400">*</span>
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { value: 21600, label: '6h', sublabel: 'Sprint', emoji: '⚡', hot: true },
                      { value: 43200, label: '12h', sublabel: 'Marathon', emoji: '🔥', hot: false },
                      { value: 86400, label: '24h', sublabel: 'Endurance', emoji: '⏰', hot: false },
                    ].map((d) => {
                      const isSelected = selectedDuration === d.value
                      return (
                        <button
                          key={d.value}
                          type="button"
                          onClick={() => setSelectedDuration(d.value)}
                          className={`relative rounded-xl border p-4 text-center transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] ${
                            isSelected
                              ? 'border-violet-500 bg-violet-500/10 shadow-lg shadow-violet-500/5'
                              : 'border-gray-800 bg-gray-900/50 hover:border-gray-700'
                          }`}
                        >
                          {d.hot && (
                            <div className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-green-500/80 px-2 py-0.5 text-[9px] font-bold text-white">
                              HOT
                            </div>
                          )}
                          <div className="mb-1 text-xl">{d.emoji}</div>
                          <div className="font-mono text-lg font-bold text-white">{d.label}</div>
                          <div className="mt-0.5 text-[10px] uppercase tracking-wider text-gray-500">{d.sublabel}</div>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Step 5 — Social links (optional, collapsible) */}
                <div className="transition-opacity duration-300">
                  <button
                    type="button"
                    onClick={() => setShowSocials(v => !v)}
                    className="flex w-full items-center justify-between text-sm font-medium text-gray-300 hover:text-white"
                  >
                    <span>Social links <span className="text-gray-600 font-normal">(optional)</span></span>
                    <span className="text-gray-600">{showSocials ? '▲' : '▼'}</span>
                  </button>

                  {showSocials && (
                    <div className="mt-3 space-y-3">
                      <textarea
                        placeholder="Description (what's the story?)"
                        value={tokenDescription}
                        onChange={(e) => setTokenDescription(e.target.value)}
                        maxLength={280}
                        rows={2}
                        className="w-full resize-none rounded-xl border border-gray-800 bg-gray-900 px-4 py-3 text-sm text-white placeholder-gray-600 transition-all focus:border-violet-500 focus:outline-none"
                      />
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-gray-600">🌐</span>
                        <input
                          type="url"
                          placeholder="Website (https://...)"
                          value={tokenWebsite}
                          onChange={(e) => setTokenWebsite(e.target.value)}
                          className="w-full rounded-xl border border-gray-800 bg-gray-900 py-3 pl-10 pr-4 text-sm text-white placeholder-gray-600 transition-all focus:border-violet-500 focus:outline-none"
                        />
                      </div>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-gray-600">𝕏</span>
                        <input
                          type="text"
                          placeholder="Twitter/X (https://x.com/...)"
                          value={tokenTwitter}
                          onChange={(e) => setTokenTwitter(e.target.value)}
                          className="w-full rounded-xl border border-gray-800 bg-gray-900 py-3 pl-10 pr-4 text-sm text-white placeholder-gray-600 transition-all focus:border-violet-500 focus:outline-none"
                        />
                      </div>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-gray-600">✈</span>
                        <input
                          type="text"
                          placeholder="Telegram (https://t.me/...)"
                          value={tokenTelegram}
                          onChange={(e) => setTokenTelegram(e.target.value)}
                          className="w-full rounded-xl border border-gray-800 bg-gray-900 py-3 pl-10 pr-4 text-sm text-white placeholder-gray-600 transition-all focus:border-violet-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Launch section */}
                <div className="border-t border-gray-800/50 pt-4">
                  <div className="mb-4 flex items-center justify-between py-1">
                    <span className="text-sm text-gray-400">Creation fee</span>
                    <span className="font-mono text-base font-bold text-white">10 MON</span>
                  </div>

                  {isWrongChain && isConnected && !isPending && !isConfirming && !isSuccess && (
                    <div className="mb-3 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-center">
                      <p className="text-xs text-amber-400">Wrong network — please switch to Monad Testnet (10143).</p>
                    </div>
                  )}

                  {!isConnected ? (
                    <button disabled className="w-full rounded-xl bg-gray-800 py-4 font-bold text-gray-500">
                      Connect wallet to launch
                    </button>
                  ) : (
                    <button
                      onClick={() => void handleCreate()}
                      disabled={!isFormValid || isBusy || isWrongChain}
                      className={`w-full rounded-xl py-4 text-base font-bold transition-all duration-300 ${
                        !isFormValid || isBusy || isWrongChain
                          ? 'cursor-not-allowed bg-gray-800 text-gray-500'
                          : 'bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-xl shadow-violet-500/20 hover:from-violet-500 hover:to-purple-500 active:scale-[0.98]'
                      }`}
                    >
                      {isUploading ? (
                        <span className="flex items-center justify-center gap-2">
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                          Uploading image...
                        </span>
                      ) : isPending ? (
                        <span className="flex items-center justify-center gap-2">
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                          Check your wallet...
                        </span>
                      ) : isConfirming ? (
                        <span className="flex items-center justify-center gap-2">
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                          Creating...
                        </span>
                      ) : (
                        '🚀 Launch Token'
                      )}
                    </button>
                  )}

                  {isSuccess && (
                    <div className="mt-4 rounded-xl border border-green-500/20 bg-green-500/10 p-5 text-center">
                      <div className="mb-2 text-4xl">🎉</div>
                      <p className="text-lg font-bold text-green-400">Your token is live!</p>
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

                  {error && (
                    <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-center">
                      <p className="text-sm text-red-400">
                        {error.message?.toLowerCase().includes('insufficient')
                          ? 'Not enough MON. You need 10 MON.'
                          : error.message?.toLowerCase().includes('rejected') || error.message?.toLowerCase().includes('denied')
                          ? 'Transaction cancelled.'
                          : 'Something went wrong. Try again.'}
                      </p>
                    </div>
                  )}

                  {hash && (
                    <p className="mt-3 truncate text-center text-xs text-gray-600">Tx: {hash}</p>
                  )}
                </div>
              </div>
            </div>

            {/* ── RIGHT: Live Preview (desktop only) ── */}
            <div className="hidden w-80 shrink-0 md:block lg:w-96">
              <div className="sticky top-24">
                <p className="mb-3 text-xs uppercase tracking-wider text-gray-600">Live Preview</p>

                <div className="relative overflow-hidden rounded-2xl border border-gray-800 bg-gray-900 shadow-2xl shadow-black/50">

                  {/* Image area */}
                  <div className="relative h-52 overflow-hidden bg-gray-800">
                    {imagePreview ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="h-full w-full object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                      />
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center">
                        <span className="text-5xl opacity-20">🫰</span>
                        <p className="mt-2 text-xs text-gray-700">Your image here</p>
                      </div>
                    )}

                    {/* Death clock overlay */}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-gray-900 via-gray-900/80 to-transparent p-4 pt-12">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-400">Death Clock</span>
                        <span className="font-mono text-lg font-bold text-white">{previewTimeLeft}</span>
                      </div>
                      <div className="mt-2 h-1 overflow-hidden rounded-full bg-gray-700">
                        <div className="h-full w-full rounded-full bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                      </div>
                    </div>

                    {/* Duration badge */}
                    <div className="absolute right-3 top-3 rounded-lg bg-black/60 px-2 py-1 font-mono text-xs text-white backdrop-blur-sm">
                      {durationLabel}
                    </div>
                  </div>

                  {/* Token info */}
                  <div className="p-4">
                    <div className="mb-1 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {tokenSymbol && (
                          <span className="rounded bg-violet-500/20 px-2 py-0.5 font-mono text-[11px] font-bold text-violet-300">
                            {tokenSymbol}
                          </span>
                        )}
                        <span className="text-base font-bold text-white">
                          {tokenName || 'Your Token'}
                        </span>
                      </div>
                      <span className="font-mono text-xs text-green-400">+0.00%</span>
                    </div>

                    <p className="mb-3 text-xs text-gray-500">
                      {tokenName ? `${tokenName} on clac.fun` : 'Preview of your token'}
                    </p>

                    <div className="flex items-center justify-between border-t border-gray-800 pt-3 text-xs text-gray-500">
                      <span>MCap: $0.00</span>
                      <span>0 holders</span>
                    </div>
                  </div>

                  {/* Valid glow ring */}
                  {isFormValid && (
                    <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-violet-500/30" />
                  )}
                </div>

                {/* Fee breakdown */}
                <div className="mt-4 space-y-2">
                  {[
                    '1% protocol fee per trade',
                    '0.5% creator fee per trade',
                    '3% death tax when token expires',
                    '20% lottery to 3 random holders',
                  ].map((item) => (
                    <div key={item} className="flex items-center gap-2 text-xs text-gray-600">
                      <span className="h-1 w-1 rounded-full bg-gray-700" />
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  )
}

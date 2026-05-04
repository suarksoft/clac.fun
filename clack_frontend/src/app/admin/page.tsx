'use client'

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Header } from '@/components/header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useRouter } from 'next/navigation'
import {
  useAccount,
  useChainId,
  useConnect,
  usePublicClient,
  useSwitchChain,
  useWriteContract,
} from 'wagmi'
import { decodeEventLog, formatEther, parseEther } from 'viem'
import { toast } from 'sonner'
import { CLAC_FACTORY_ABI, CLAC_FACTORY_ADDRESS } from '@/lib/web3/contracts'
import { monadTestnet } from '@/lib/web3/chains'
import { publicEnv } from '@/lib/env'
import { apiClient } from '@/lib/api/client'

type Duration = '6h' | '12h' | '24h'
type AdminTokenRow = {
  id: number
  name: string
  symbol: string
  imageURI: string
  dead: boolean
  createdAt: number
}

const DURATION_SECONDS: Record<Duration, bigint> = {
  '6h': BigInt(6 * 60 * 60),
  '12h': BigInt(12 * 60 * 60),
  '24h': BigInt(24 * 60 * 60),
}
const ADMIN_PASSWORD_STORAGE_KEY = 'clac_admin_password'

export default function AdminPage() {
  const router = useRouter()
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const { switchChain } = useSwitchChain()
  const { connect, connectors } = useConnect()
  const publicClient = usePublicClient()
  const { writeContractAsync, isPending } = useWriteContract()

  const [name, setName] = useState('')
  const [symbol, setSymbol] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [adminDescription, setAdminDescription] = useState('')
  const [adminWebsite, setAdminWebsite] = useState('')
  const [adminTwitter, setAdminTwitter] = useState('')
  const [adminTelegram, setAdminTelegram] = useState('')
  const [selectedImageName, setSelectedImageName] = useState('')
  const [duration, setDuration] = useState<Duration>('12h')
  const [desiredFeeMon, setDesiredFeeMon] = useState('0')
  const [restoreFeeAfterCreate, setRestoreFeeAfterCreate] = useState(true)
  const [creationFeeWei, setCreationFeeWei] = useState<bigint>(BigInt(0))
  const [publicCreation, setPublicCreation] = useState<boolean>(false)
  const [ownerAddress, setOwnerAddress] = useState<string>('')
  const [statusText, setStatusText] = useState<string>('')
  const [errorText, setErrorText] = useState<string>('')
  const [isLoadingConfig, setIsLoadingConfig] = useState(true)
  const [isWorking, setIsWorking] = useState(false)
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const [adminTokens, setAdminTokens] = useState<AdminTokenRow[]>([])
  const [isTokensLoading, setIsTokensLoading] = useState(false)
  const [deletingTokenId, setDeletingTokenId] = useState<number | null>(null)
  const [createSubmitAttempted, setCreateSubmitAttempted] = useState(false)
  const [adminPasswordInput, setAdminPasswordInput] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const [isAdminUnlocked, setIsAdminUnlocked] = useState(false)
  const [isAuthChecking, setIsAuthChecking] = useState(false)

  const isWrongChain = isConnected && chainId !== monadTestnet.id
  const isOwner = Boolean(
    address &&
      ownerAddress &&
      address.toLowerCase() === ownerAddress.toLowerCase(),
  )

  const creationFeeDisplay = useMemo(
    () => Number(formatEther(creationFeeWei)).toFixed(4),
    [creationFeeWei],
  )
  const adminHeaders = useMemo(
    () =>
      adminPassword
        ? ({
            'x-admin-password': adminPassword,
          } as HeadersInit)
        : ({} as HeadersInit),
    [adminPassword],
  )

  useEffect(() => {
    if (typeof window === 'undefined') return
    const storedPassword = sessionStorage.getItem(ADMIN_PASSWORD_STORAGE_KEY) || ''
    if (storedPassword) {
      setAdminPassword(storedPassword)
      setAdminPasswordInput(storedPassword)
      setIsAdminUnlocked(true)
    }
  }, [])

  const loadConfig = async () => {
    if (!publicClient) return
    setIsLoadingConfig(true)
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

      setCreationFeeWei(fee as bigint)
      setPublicCreation(Boolean(isPublic))
      setOwnerAddress(String(owner))
      setErrorText('')
    } catch (error) {
      setErrorText(
        error instanceof Error
          ? error.message
          : 'Kontrat ayarlari okunamadi.',
      )
    } finally {
      setIsLoadingConfig(false)
    }
  }

  useEffect(() => {
    loadConfig()
  }, [publicClient])

  useEffect(() => {
    if (!isAdminUnlocked || !adminPassword) return
    void loadAdminTokens()
  }, [isAdminUnlocked, adminPassword])

  const ensureWalletAndChain = async () => {
    if (!isConnected) {
      const preferredConnector = connectors[0]
      if (preferredConnector) {
        connect({ connector: preferredConnector })
      }
      throw new Error('Lutfen once cuzdani bagla.')
    }

    if (isWrongChain) {
      switchChain({ chainId: monadTestnet.id })
      throw new Error('Lutfen Monad Testnet agina gec.')
    }

    if (!isOwner) {
      throw new Error('Bu admin sayfasi sadece owner cuzdan ile kullanilabilir.')
    }

    if (!publicClient) {
      throw new Error('RPC istemcisi hazir degil.')
    }
  }

  const waitForTx = async (hash: `0x${string}`) => {
    if (!publicClient) return
    await publicClient.waitForTransactionReceipt({ hash })
  }

  async function loadAdminTokens() {
    setIsTokensLoading(true)
    try {
      const response = await fetch(
        `${publicEnv.NEXT_PUBLIC_BACKEND_URL}/api/admin/tokens?limit=200`,
        {
          headers: adminHeaders,
        },
      )
      if (!response.ok) {
        throw new Error('Token listesi alinamadi.')
      }
      const rows = (await response.json()) as AdminTokenRow[]
      setAdminTokens(rows)
    } catch (error) {
      setErrorText(
        error instanceof Error ? error.message : 'Token listesi alinamadi.',
      )
    } finally {
      setIsTokensLoading(false)
    }
  }

  const deleteTokenFromSystem = async (tokenId: number) => {
    if (!isOwner) {
      setErrorText('Sadece owner token silebilir.')
      return
    }
    const confirmed = window.confirm(
      `Token #${tokenId} veritabanindan silinecek. Bu islem geri alinamaz. Devam edilsin mi?`,
    )
    if (!confirmed) return

    setDeletingTokenId(tokenId)
    setErrorText('')
    setStatusText(`Token #${tokenId} siliniyor...`)
    try {
      const response = await fetch(
        `${publicEnv.NEXT_PUBLIC_BACKEND_URL}/api/admin/tokens/${tokenId}`,
        { method: 'DELETE', headers: adminHeaders },
      )
      if (!response.ok) {
        throw new Error('Token silme islemi basarisiz.')
      }
      await loadAdminTokens()
      setStatusText(`Token #${tokenId} sistemden silindi.`)
      toast.success(`Token #${tokenId} silindi.`)
    } catch (error) {
      setErrorText(
        error instanceof Error ? error.message : 'Token silme islemi basarisiz.',
      )
      toast.error('Token silinemedi.')
    } finally {
      setDeletingTokenId(null)
    }
  }

  const unlockAdminPanel = async () => {
    const password = adminPasswordInput.trim()
    if (!password) {
      setErrorText('Admin sifresi zorunlu.')
      return
    }

    setIsAuthChecking(true)
    setErrorText('')
    try {
      const response = await fetch(
        `${publicEnv.NEXT_PUBLIC_BACKEND_URL}/api/admin/tokens?limit=1`,
        {
          headers: {
            'x-admin-password': password,
          },
        },
      )
      if (!response.ok) {
        throw new Error('Sifre hatali veya admin endpointine erisim yok.')
      }

      setAdminPassword(password)
      setIsAdminUnlocked(true)
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(ADMIN_PASSWORD_STORAGE_KEY, password)
      }
      setStatusText('Admin panel kilidi acildi.')
      toast.success('Admin girisi basarili.')
    } catch (error) {
      setErrorText(
        error instanceof Error ? error.message : 'Admin girisi basarisiz.',
      )
      setIsAdminUnlocked(false)
      setAdminPassword('')
    } finally {
      setIsAuthChecking(false)
    }
  }

  const updateCreationFee = async () => {
    try {
      await ensureWalletAndChain()
      const feeWei = parseEther(desiredFeeMon || '0')
      setIsWorking(true)
      setStatusText('Creation fee guncelleniyor...')
      setErrorText('')
      const hash = await writeContractAsync({
        address: CLAC_FACTORY_ADDRESS as `0x${string}`,
        abi: CLAC_FACTORY_ABI,
        functionName: 'setCreationFee',
        args: [feeWei],
      })
      await waitForTx(hash)
      await loadConfig()
      setStatusText('Creation fee guncellendi.')
      toast.success('Creation fee guncellendi.')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Fee guncellenemedi.'
      setErrorText(message)
      toast.error('Fee guncellenemedi.')
    } finally {
      setIsWorking(false)
    }
  }

  const togglePublicCreation = async (nextValue: boolean) => {
    try {
      await ensureWalletAndChain()
      setIsWorking(true)
      setStatusText(nextValue ? 'Public creation aciliyor...' : 'Public creation kapatiliyor...')
      setErrorText('')
      const hash = await writeContractAsync({
        address: CLAC_FACTORY_ADDRESS as `0x${string}`,
        abi: CLAC_FACTORY_ABI,
        functionName: 'setPublicCreation',
        args: [nextValue],
      })
      await waitForTx(hash)
      await loadConfig()
      setStatusText(nextValue ? 'Public creation acildi.' : 'Public creation kapatildi.')
      toast.success('Public creation ayari guncellendi.')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Public creation guncellenemedi.'
      setErrorText(message)
      toast.error('Public creation guncellenemedi.')
    } finally {
      setIsWorking(false)
    }
  }

  const handleAdminCreate = async (e: FormEvent) => {
    e.preventDefault()
    setCreateSubmitAttempted(true)

    try {
      await ensureWalletAndChain()
      if (!name.trim() || !symbol.trim() || !imageUrl.trim()) {
        throw new Error('Name, symbol ve image URL zorunlu.')
      }
      const normalizedImageUrl = imageUrl.trim()
      let parsedImageUrl: URL
      try {
        parsedImageUrl = new URL(normalizedImageUrl)
      } catch {
        throw new Error('Image URL gecersiz.')
      }
      if (parsedImageUrl.protocol !== 'https:' && parsedImageUrl.protocol !== 'http:') {
        throw new Error('Image URL http veya https olmali.')
      }

      const previousFee = creationFeeWei
      let feeLowered = false

      setIsWorking(true)
      setErrorText('')
      setStatusText('Ucretsiz admin create akisi baslatiliyor...')

      if (previousFee > BigInt(0)) {
        setStatusText('Adim 1/3: creationFee 0 yapiliyor...')
        const lowerFeeHash = await writeContractAsync({
          address: CLAC_FACTORY_ADDRESS as `0x${string}`,
          abi: CLAC_FACTORY_ABI,
          functionName: 'setCreationFee',
          args: [BigInt(0)],
        })
        await waitForTx(lowerFeeHash)
        feeLowered = true
        setCreationFeeWei(BigInt(0))
      }

      setStatusText('Adim 2/3: token 0 MON ile olusturuluyor...')
      const createHash = await writeContractAsync({
        address: CLAC_FACTORY_ADDRESS as `0x${string}`,
        abi: CLAC_FACTORY_ABI,
        functionName: 'createToken',
        args: [name.trim(), symbol.trim().toUpperCase(), normalizedImageUrl, DURATION_SECONDS[duration]],
        value: BigInt(0),
      })
      const receipt = await publicClient!.waitForTransactionReceipt({ hash: createHash })

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
          // ignore
        }
      }

      if (restoreFeeAfterCreate && feeLowered && previousFee > BigInt(0)) {
        setStatusText('Adim 3/3: eski creationFee geri yukleniyor...')
        const restoreHash = await writeContractAsync({
          address: CLAC_FACTORY_ADDRESS as `0x${string}`,
          abi: CLAC_FACTORY_ABI,
          functionName: 'setCreationFee',
          args: [previousFee],
        })
        await waitForTx(restoreHash)
        setCreationFeeWei(previousFee)
      }

      // Save social links (best-effort)
      if (createdTokenId) {
        const socials = {
          description: adminDescription.trim() || undefined,
          website: adminWebsite.trim() || undefined,
          twitter: adminTwitter.trim() || undefined,
          telegram: adminTelegram.trim() || undefined,
        }
        if (Object.values(socials).some(Boolean)) {
          apiClient.updateTokenSocials(Number(createdTokenId), socials).catch(() => {/* ignore */})
        }
      }

      await loadConfig()
      setStatusText('Admin token olusturma tamamlandi.')
      toast.success('Admin token olusturuldu.')

      if (createdTokenId) {
        router.push(`/token/${createdTokenId}`)
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Admin create isleminde hata olustu.'
      setErrorText(message)
      toast.error('Admin create basarisiz.')
    } finally {
      setIsWorking(false)
    }
  }

  const handleImageFileSelect = (file: File | null) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setErrorText('Lutfen gecerli bir gorsel dosyasi sec.')
      return
    }
    const formData = new FormData()
    formData.append('file', file)
    setIsUploadingImage(true)
    setErrorText('')
    setStatusText('Gorsel yukleniyor...')

    fetch(`${publicEnv.NEXT_PUBLIC_BACKEND_URL}/api/upload/image`, {
      method: 'POST',
      body: formData,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error('Gorsel yukleme basarisiz oldu.')
        }
        const data = (await response.json()) as { url?: string }
        if (!data.url) {
          throw new Error('Yukleme cevabi gecersiz.')
        }
        const uploadedUrl = data.url
        setImageUrl(uploadedUrl)
        setSelectedImageName(file.name)
        setStatusText('Gorsel yuklendi, create icin hazir.')
        toast.success('Gorsel yuklendi.')
      })
      .catch((error) => {
        const message =
          error instanceof Error ? error.message : 'Gorsel yukleme hatasi.'
        setErrorText(message)
        setStatusText('')
      })
      .finally(() => {
        setIsUploadingImage(false)
      })
  }

  if (!isAdminUnlocked) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Header />
        <main className="flex-1">
          <div className="container mx-auto flex max-w-md flex-col gap-4 px-4 py-12">
            <h1 className="text-3xl font-bold text-foreground">Admin Login</h1>
            <p className="text-sm text-muted-foreground">
              Admin paneline girmek icin sifreyi gir.
            </p>
            <div className="space-y-2">
              <Label htmlFor="admin-password">Sifre</Label>
              <Input
                id="admin-password"
                type="password"
                value={adminPasswordInput}
                onChange={(e) => setAdminPasswordInput(e.target.value)}
                placeholder="Admin sifresi"
              />
            </div>
            <Button onClick={() => void unlockAdminPanel()} disabled={isAuthChecking}>
              {isAuthChecking ? 'Kontrol ediliyor...' : 'Admin Girisi Yap'}
            </Button>
            {errorText && (
              <p className="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-400">
                {errorText}
              </p>
            )}
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1">
        <div className="container mx-auto max-w-3xl px-4 py-8">
          <h1 className="mb-2 text-3xl font-bold text-foreground">Admin Token Create</h1>
          <p className="mb-6 text-sm text-muted-foreground">
            Bu ekran sadece owner cuzdan icindir. Akis: fee 0 yap, ucretsiz create calistir, gerekirse fee geri al.
          </p>

          <div className="mb-6 grid gap-3 rounded-xl border border-border bg-card p-4 text-sm sm:grid-cols-2">
            <p>Contract: <span className="font-mono">{CLAC_FACTORY_ADDRESS}</span></p>
            <p>Owner: <span className="font-mono">{ownerAddress || '-'}</span></p>
            <p>Current Fee: <span className="font-mono">{isLoadingConfig ? '...' : `${creationFeeDisplay} MON`}</span></p>
            <p>Public Creation: <span className="font-mono">{String(publicCreation)}</span></p>
          </div>

          <div className="mb-6 space-y-3 rounded-xl border border-border bg-card p-4">
            <h2 className="text-lg font-semibold">Admin Controls</h2>
            <div className="flex gap-2">
              <Input
                value={desiredFeeMon}
                onChange={(e) => setDesiredFeeMon(e.target.value)}
                placeholder="0"
              />
              <Button onClick={updateCreationFee} disabled={isWorking || isPending}>
                Set Creation Fee
              </Button>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => togglePublicCreation(true)}
                disabled={isWorking || isPending}
              >
                Public Creation ON
              </Button>
              <Button
                variant="outline"
                onClick={() => togglePublicCreation(false)}
                disabled={isWorking || isPending}
              >
                Public Creation OFF
              </Button>
            </div>
          </div>

          <form onSubmit={handleAdminCreate} className="space-y-4 rounded-xl border border-border bg-card p-4">
            <h2 className="text-lg font-semibold">Free Admin Create</h2>
            <div className="space-y-2">
              <Label>Token Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={32} />
            </div>
            <div className="space-y-2">
              <Label>Token Symbol</Label>
              <Input value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} maxLength={8} />
            </div>
            <div className="space-y-2">
              <Label>
                Image URL <span className="text-red-400">*</span>
              </Label>
              <Input
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                type="url"
                className={createSubmitAttempted && !imageUrl.trim() ? 'border-red-500' : ''}
              />
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex cursor-pointer items-center rounded-md border border-border px-3 py-2 text-sm hover:bg-secondary">
                  {isUploadingImage ? 'Yukleniyor...' : 'Fotograf Yukle'}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={isUploadingImage}
                    onChange={(e) => handleImageFileSelect(e.target.files?.[0] ?? null)}
                  />
                </label>
                {selectedImageName && (
                  <span className="text-xs text-muted-foreground">{selectedImageName}</span>
                )}
              </div>
              {imageUrl && (
                <img
                  src={imageUrl}
                  alt="Token preview"
                  className="h-24 w-24 rounded-md border border-border object-cover"
                />
              )}
            </div>
            <div className="space-y-2">
              <Label>Duration</Label>
              <div className="flex gap-2">
                {(['6h', '12h', '24h'] as Duration[]).map((d) => (
                  <Button
                    key={d}
                    type="button"
                    variant={duration === d ? 'default' : 'outline'}
                    onClick={() => setDuration(d)}
                  >
                    {d}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <textarea
                value={adminDescription}
                onChange={(e) => setAdminDescription(e.target.value)}
                maxLength={280}
                rows={2}
                placeholder="Token description..."
                className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <div className="space-y-2">
              <Label>Website <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input value={adminWebsite} onChange={(e) => setAdminWebsite(e.target.value)} placeholder="https://..." type="url" />
            </div>
            <div className="space-y-2">
              <Label>Twitter/X <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input value={adminTwitter} onChange={(e) => setAdminTwitter(e.target.value)} placeholder="https://x.com/..." />
            </div>
            <div className="space-y-2">
              <Label>Telegram <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input value={adminTelegram} onChange={(e) => setAdminTelegram(e.target.value)} placeholder="https://t.me/..." />
            </div>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={restoreFeeAfterCreate}
                onChange={(e) => setRestoreFeeAfterCreate(e.target.checked)}
              />
              Create sonrasi eski creation fee geri yuklensin
            </label>

            {!isConnected ? (
              <Button
                type="button"
                onClick={() => {
                  const preferredConnector = connectors[0]
                  if (preferredConnector) connect({ connector: preferredConnector })
                }}
              >
                Cuzdan Bagla
              </Button>
            ) : (
              <Button type="submit" disabled={isWorking || isPending || !isOwner || isUploadingImage}>
                {isWorking || isPending ? 'Calisiyor...' : '0 MON ile Admin Create'}
              </Button>
            )}
          </form>

          <div className="mt-6 rounded-xl border border-border bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Existing Tokens (System)</h2>
              <Button
                variant="outline"
                onClick={() => void loadAdminTokens()}
                disabled={isTokensLoading || deletingTokenId !== null}
              >
                {isTokensLoading ? 'Yenileniyor...' : 'Refresh'}
              </Button>
            </div>
            {adminTokens.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {isTokensLoading ? 'Tokenlar yukleniyor...' : 'Token bulunamadi.'}
              </p>
            ) : (
              <div className="space-y-2">
                {adminTokens.map((row) => (
                  <div
                    key={row.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-foreground">
                        #{row.id} {row.symbol} - {row.name}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {row.imageURI}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded px-2 py-1 text-xs ${
                          row.dead
                            ? 'bg-red-500/15 text-red-400'
                            : 'bg-emerald-500/15 text-emerald-400'
                        }`}
                      >
                        {row.dead ? 'dead' : 'live'}
                      </span>
                      <Button
                        variant="destructive"
                        onClick={() => void deleteTokenFromSystem(row.id)}
                        disabled={!isOwner || deletingTokenId === row.id}
                      >
                        {deletingTokenId === row.id ? 'Siliniyor...' : 'Sistemden Sil'}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {statusText && (
            <p className="mt-4 rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-400">
              {statusText}
            </p>
          )}
          {errorText && (
            <p className="mt-3 rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-400">
              {errorText}
            </p>
          )}
          {isWrongChain && (
            <p className="mt-3 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-300">
              Wrong network: Monad Testnet'e gecmelisin.
            </p>
          )}
          {isConnected && !isOwner && (
            <p className="mt-3 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-300">
              Bu cuzdan owner degil. Sadece owner admin create yapabilir.
            </p>
          )}
        </div>
      </main>
    </div>
  )
}

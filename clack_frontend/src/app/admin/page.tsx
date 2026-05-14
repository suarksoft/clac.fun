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
import { CLAC_FACTORY_V2_ABI, CLAC_FACTORY_V2_ADDRESS } from '@/lib/web3/contracts-v2'
import { monadTestnet } from '@/lib/web3/chains'
import { publicEnv } from '@/lib/env'

type Duration = '6h' | '12h' | '24h'
type AdminTokenRow = {
  address: string
  name: string
  symbol: string
  imageURI: string
  deathFinalized: boolean
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
  const [currentK, setCurrentK] = useState<bigint>(BigInt(0))
  const [desiredK, setDesiredK] = useState('')
  const [ownerAddress, setOwnerAddress] = useState<string>('')
  const [treasuryInput, setTreasuryInput] = useState('')
  const [pendingOwnerInput, setPendingOwnerInput] = useState('')
  const [statusText, setStatusText] = useState<string>('')
  const [errorText, setErrorText] = useState<string>('')
  const [isLoadingConfig, setIsLoadingConfig] = useState(true)
  const [isWorking, setIsWorking] = useState(false)
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const [adminTokens, setAdminTokens] = useState<AdminTokenRow[]>([])
  const [isTokensLoading, setIsTokensLoading] = useState(false)
  const [deletingAddress, setDeletingAddress] = useState<string | null>(null)
  const [createSubmitAttempted, setCreateSubmitAttempted] = useState(false)
  const [adminPasswordInput, setAdminPasswordInput] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const [isAdminUnlocked, setIsAdminUnlocked] = useState(false)
  const [isAuthChecking, setIsAuthChecking] = useState(false)

  const isWrongChain = isConnected && chainId !== monadTestnet.id
  const isOwner = Boolean(
    address && ownerAddress && address.toLowerCase() === ownerAddress.toLowerCase(),
  )

  const creationFeeDisplay = useMemo(
    () => Number(formatEther(creationFeeWei)).toFixed(4),
    [creationFeeWei],
  )
  const adminHeaders = useMemo(
    () => (adminPassword ? ({ 'x-admin-password': adminPassword } as HeadersInit) : ({} as HeadersInit)),
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
      const [fee, isPublic, owner, k] = await Promise.all([
        publicClient.readContract({ address: CLAC_FACTORY_V2_ADDRESS, abi: CLAC_FACTORY_V2_ABI, functionName: 'creationFee' }),
        publicClient.readContract({ address: CLAC_FACTORY_V2_ADDRESS, abi: CLAC_FACTORY_V2_ABI, functionName: 'publicCreation' }),
        publicClient.readContract({ address: CLAC_FACTORY_V2_ADDRESS, abi: CLAC_FACTORY_V2_ABI, functionName: 'owner' }),
        publicClient.readContract({ address: CLAC_FACTORY_V2_ADDRESS, abi: CLAC_FACTORY_V2_ABI, functionName: 'defaultK' }),
      ])
      setCreationFeeWei(fee as bigint)
      setPublicCreation(Boolean(isPublic))
      setOwnerAddress(String(owner))
      setCurrentK(k as bigint)
      setErrorText('')
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : 'Factory config okunamadi.')
    } finally {
      setIsLoadingConfig(false)
    }
  }

  useEffect(() => { loadConfig() }, [publicClient])

  useEffect(() => {
    if (!isAdminUnlocked || !adminPassword) return
    void loadAdminTokens()
  }, [isAdminUnlocked, adminPassword])

  const ensureWalletAndChain = async () => {
    if (!isConnected) {
      const c = connectors[0]
      if (c) connect({ connector: c })
      throw new Error('Lutfen once cuzdani bagla.')
    }
    if (isWrongChain) {
      switchChain({ chainId: monadTestnet.id })
      throw new Error('Lutfen Monad Testnet agina gec.')
    }
    if (!isOwner) throw new Error('Sadece owner cuzdan kullanabilir.')
    if (!publicClient) throw new Error('RPC istemcisi hazir degil.')
  }

  const waitForTx = async (hash: `0x${string}`) => {
    if (!publicClient) return
    await publicClient.waitForTransactionReceipt({ hash })
  }

  async function loadAdminTokens() {
    setIsTokensLoading(true)
    try {
      const response = await fetch(
        `${publicEnv.NEXT_PUBLIC_BACKEND_URL}/api/admin/v2/tokens?limit=200`,
        { headers: adminHeaders },
      )
      if (!response.ok) throw new Error('Token listesi alinamadi.')
      setAdminTokens((await response.json()) as AdminTokenRow[])
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : 'Token listesi alinamadi.')
    } finally {
      setIsTokensLoading(false)
    }
  }

  const deleteV2Token = async (tokenAddress: string) => {
    if (!isOwner) { setErrorText('Sadece owner token silebilir.'); return }
    const confirmed = window.confirm(`${tokenAddress} adresindeki token veritabanindan silinecek. Devam?`)
    if (!confirmed) return

    setDeletingAddress(tokenAddress)
    setErrorText('')
    setStatusText('Token siliniyor...')
    try {
      const response = await fetch(
        `${publicEnv.NEXT_PUBLIC_BACKEND_URL}/api/admin/v2/tokens/${tokenAddress}`,
        { method: 'DELETE', headers: adminHeaders },
      )
      if (!response.ok) throw new Error('Token silme islemi basarisiz.')
      await loadAdminTokens()
      setStatusText('Token sistemden silindi.')
      toast.success('Token silindi.')
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : 'Token silinemedi.')
      toast.error('Token silinemedi.')
    } finally {
      setDeletingAddress(null)
    }
  }

  const unlockAdminPanel = async () => {
    const password = adminPasswordInput.trim()
    if (!password) { setErrorText('Admin sifresi zorunlu.'); return }
    setIsAuthChecking(true)
    setErrorText('')
    try {
      const response = await fetch(
        `${publicEnv.NEXT_PUBLIC_BACKEND_URL}/api/admin/v2/tokens?limit=1`,
        { headers: { 'x-admin-password': password } },
      )
      if (!response.ok) throw new Error('Sifre hatali veya admin endpointine erisim yok.')
      setAdminPassword(password)
      setIsAdminUnlocked(true)
      if (typeof window !== 'undefined') sessionStorage.setItem(ADMIN_PASSWORD_STORAGE_KEY, password)
      setStatusText('Admin panel kilidi acildi.')
      toast.success('Admin girisi basarili.')
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : 'Admin girisi basarisiz.')
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
        address: CLAC_FACTORY_V2_ADDRESS,
        abi: CLAC_FACTORY_V2_ABI,
        functionName: 'setCreationFee',
        args: [feeWei],
      })
      await waitForTx(hash)
      await loadConfig()
      setStatusText('Creation fee guncellendi.')
      toast.success('Creation fee guncellendi.')
    } catch (error) {
      console.error('[admin] setCreationFee failed', error)
      setErrorText(error instanceof Error ? error.message : 'Fee guncellenemedi.')
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
        address: CLAC_FACTORY_V2_ADDRESS,
        abi: CLAC_FACTORY_V2_ABI,
        functionName: 'setPublicCreation',
        args: [nextValue],
      })
      await waitForTx(hash)
      await loadConfig()
      setStatusText(nextValue ? 'Public creation acildi.' : 'Public creation kapatildi.')
      toast.success('Public creation ayari guncellendi.')
    } catch (error) {
      console.error('[admin] setPublicCreation failed', error)
      setErrorText(error instanceof Error ? error.message : 'Public creation guncellenemedi.')
      toast.error('Public creation guncellenemedi.')
    } finally {
      setIsWorking(false)
    }
  }

  const updateK = async () => {
    try {
      await ensureWalletAndChain()
      const kBigInt = BigInt(desiredK || '0')
      setIsWorking(true)
      setStatusText('defaultK guncelleniyor...')
      setErrorText('')
      const hash = await writeContractAsync({
        address: CLAC_FACTORY_V2_ADDRESS,
        abi: CLAC_FACTORY_V2_ABI,
        functionName: 'setDefaultK',
        args: [kBigInt],
      })
      await waitForTx(hash)
      await loadConfig()
      setStatusText(`defaultK ${kBigInt.toString()} olarak guncellendi.`)
      toast.success('defaultK guncellendi.')
    } catch (error) {
      console.error('[admin] setDefaultK failed', error)
      setErrorText(error instanceof Error ? error.message : 'defaultK guncellenemedi.')
      toast.error('defaultK guncellenemedi.')
    } finally {
      setIsWorking(false)
    }
  }

  const updateTreasury = async () => {
    try {
      await ensureWalletAndChain()
      const newTreasury = treasuryInput.trim()
      if (!/^0x[a-fA-F0-9]{40}$/.test(newTreasury)) throw new Error('Treasury adresi gecersiz.')
      setIsWorking(true)
      setStatusText('Treasury guncelleniyor...')
      setErrorText('')
      const hash = await writeContractAsync({
        address: CLAC_FACTORY_V2_ADDRESS,
        abi: CLAC_FACTORY_V2_ABI,
        functionName: 'setTreasury',
        args: [newTreasury as `0x${string}`],
      })
      await waitForTx(hash)
      await loadConfig()
      setStatusText('Treasury guncellendi.')
      toast.success('Treasury guncellendi.')
      setTreasuryInput('')
    } catch (error) {
      console.error('[admin] setTreasury failed', error)
      setErrorText(error instanceof Error ? error.message : 'Treasury guncellenemedi.')
      toast.error('Treasury guncellenemedi.')
    } finally {
      setIsWorking(false)
    }
  }

  const startTransferOwnership = async () => {
    try {
      await ensureWalletAndChain()
      const newOwner = pendingOwnerInput.trim()
      if (!/^0x[a-fA-F0-9]{40}$/.test(newOwner)) throw new Error('Yeni owner adresi gecersiz.')
      if (!window.confirm(`Ownership transferi baslatilacak: ${newOwner}\nYeni owner kendisi acceptOwnership cagirmadan transfer tamamlanmaz. Devam?`)) return
      setIsWorking(true)
      setStatusText('Ownership transferi baslatiliyor...')
      setErrorText('')
      const hash = await writeContractAsync({
        address: CLAC_FACTORY_V2_ADDRESS,
        abi: CLAC_FACTORY_V2_ABI,
        functionName: 'transferOwnership',
        args: [newOwner as `0x${string}`],
      })
      await waitForTx(hash)
      setStatusText(`Ownership transferi baslatildi. ${newOwner} kabul etmeli.`)
      toast.success('Ownership transferi baslatildi (2-step).')
      setPendingOwnerInput('')
    } catch (error) {
      console.error('[admin] transferOwnership failed', error)
      setErrorText(error instanceof Error ? error.message : 'Ownership transferi basarisiz.')
      toast.error('Ownership transferi basarisiz.')
    } finally {
      setIsWorking(false)
    }
  }

  const handleAdminCreate = async (e: FormEvent) => {
    e.preventDefault()
    setCreateSubmitAttempted(true)
    try {
      await ensureWalletAndChain()
      if (!name.trim() || !symbol.trim() || !imageUrl.trim()) throw new Error('Name, symbol ve image URL zorunlu.')
      let parsedImageUrl: URL
      try { parsedImageUrl = new URL(imageUrl.trim()) } catch { throw new Error('Image URL gecersiz.') }
      if (parsedImageUrl.protocol !== 'https:' && parsedImageUrl.protocol !== 'http:') throw new Error('Image URL http veya https olmali.')

      const previousFee = creationFeeWei
      let feeLowered = false

      setIsWorking(true)
      setErrorText('')
      setStatusText('Admin create akisi baslatiliyor...')

      // Step 1: lower fee to 0 if needed
      if (previousFee > BigInt(0)) {
        setStatusText('1/3: creationFee 0 yapiliyor...')
        const hash = await writeContractAsync({
          address: CLAC_FACTORY_V2_ADDRESS,
          abi: CLAC_FACTORY_V2_ABI,
          functionName: 'setCreationFee',
          args: [BigInt(0)],
        })
        await waitForTx(hash)
        feeLowered = true
        setCreationFeeWei(BigInt(0))
      }

      let createdTokenAddress: string | null = null
      try {
        // Step 2: create token
        setStatusText('2/3: token olusturuluyor...')
        const createHash = await writeContractAsync({
          address: CLAC_FACTORY_V2_ADDRESS,
          abi: CLAC_FACTORY_V2_ABI,
          functionName: 'createToken',
          args: [name.trim(), symbol.trim().toUpperCase(), imageUrl.trim(), DURATION_SECONDS[duration], BigInt(0)],
          value: BigInt(0),
        })
        const receipt = await publicClient!.waitForTransactionReceipt({ hash: createHash })

        for (const log of receipt.logs) {
          try {
            const decoded = decodeEventLog({ abi: CLAC_FACTORY_V2_ABI, data: log.data, topics: log.topics })
            if (decoded.eventName === 'TokenCreated') {
              createdTokenAddress = (decoded.args as { token: string }).token
              break
            }
          } catch { /* ignore */ }
        }
      } finally {
        // Step 3: restore fee regardless of create success/failure
        if (restoreFeeAfterCreate && feeLowered && previousFee > BigInt(0)) {
          setStatusText('3/3: eski creationFee geri yukleniyor...')
          try {
            const restoreHash = await writeContractAsync({
              address: CLAC_FACTORY_V2_ADDRESS,
              abi: CLAC_FACTORY_V2_ABI,
              functionName: 'setCreationFee',
              args: [previousFee],
            })
            await waitForTx(restoreHash)
            setCreationFeeWei(previousFee)
          } catch (restoreErr) {
            setErrorText(`Fee geri yuklenemedi: ${restoreErr instanceof Error ? restoreErr.message : 'Bilinmeyen hata'}`)
          }
        }
      }

      // Save socials best-effort
      if (createdTokenAddress) {
        const socials = {
          description: adminDescription.trim() || undefined,
          website: adminWebsite.trim() || undefined,
          twitter: adminTwitter.trim() || undefined,
          telegram: adminTelegram.trim() || undefined,
        }
        if (Object.values(socials).some(Boolean)) {
          fetch(`${publicEnv.NEXT_PUBLIC_BACKEND_URL}/api/v2/tokens/${createdTokenAddress}/socials`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(socials),
          }).catch(() => {/* ignore */})
        }
      }

      await loadConfig()
      setStatusText('Token olusturuldu.')
      toast.success('Token olusturuldu.')

      if (createdTokenAddress) {
        router.push(`/token/${createdTokenAddress}`)
      } else {
        toast.error('Token adresi alinamadi — explorer\'dan tx kontrol et.')
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Admin create basarisiz.'
      setErrorText(message)
      toast.error('Admin create basarisiz.')
    } finally {
      setIsWorking(false)
    }
  }

  const handleImageFileSelect = (file: File | null) => {
    if (!file) return
    if (!file.type.startsWith('image/')) { setErrorText('Gecerli bir gorsel dosyasi sec.'); return }
    const formData = new FormData()
    formData.append('file', file)
    setIsUploadingImage(true)
    setErrorText('')
    setStatusText('Gorsel yukleniyor...')

    fetch(`${publicEnv.NEXT_PUBLIC_BACKEND_URL}/api/upload/image`, { method: 'POST', body: formData })
      .then(async (response) => {
        if (!response.ok) throw new Error('Gorsel yukleme basarisiz.')
        const data = (await response.json()) as { url?: string }
        if (!data.url) throw new Error('Yukleme cevabi gecersiz.')
        setImageUrl(data.url)
        setSelectedImageName(file.name)
        setStatusText('Gorsel yuklendi.')
        toast.success('Gorsel yuklendi.')
      })
      .catch((error) => {
        setErrorText(error instanceof Error ? error.message : 'Gorsel yukleme hatasi.')
        setStatusText('')
      })
      .finally(() => { setIsUploadingImage(false) })
  }

  if (!isAdminUnlocked) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Header />
        <main className="flex-1">
          <div className="container mx-auto flex max-w-md flex-col gap-4 px-4 py-12">
            <h1 className="text-3xl font-bold text-foreground">Admin Login</h1>
            <p className="text-sm text-muted-foreground">Admin paneline girmek icin sifreyi gir.</p>
            <div className="space-y-2">
              <Label htmlFor="admin-password">Sifre</Label>
              <Input
                id="admin-password"
                type="password"
                value={adminPasswordInput}
                onChange={(e) => setAdminPasswordInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void unlockAdminPanel() }}
                placeholder="Admin sifresi"
              />
            </div>
            <Button onClick={() => void unlockAdminPanel()} disabled={isAuthChecking}>
              {isAuthChecking ? 'Kontrol ediliyor...' : 'Admin Girisi Yap'}
            </Button>
            {errorText && (
              <p className="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-400">{errorText}</p>
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
          <h1 className="mb-2 text-3xl font-bold text-foreground">Admin Panel</h1>
          <p className="mb-6 text-sm text-muted-foreground">
            Factory: <span className="font-mono">{CLAC_FACTORY_V2_ADDRESS}</span>
          </p>

          {/* Factory config */}
          <div className="mb-6 grid gap-3 rounded-xl border border-border bg-card p-4 text-sm sm:grid-cols-2">
            <p>Owner: <span className="font-mono text-xs">{isLoadingConfig ? '...' : (ownerAddress || '-')}</span></p>
            <p>Creation Fee: <span className="font-mono">{isLoadingConfig ? '...' : `${creationFeeDisplay} MON`}</span></p>
            <p>Public Creation: <span className="font-mono">{isLoadingConfig ? '...' : String(publicCreation)}</span></p>
            <p>Default K: <span className="font-mono">{isLoadingConfig ? '...' : currentK.toString()}</span></p>
          </div>

          {/* Controls */}
          <div className="mb-6 space-y-3 rounded-xl border border-border bg-card p-4">
            <h2 className="text-lg font-semibold">Factory Controls</h2>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Creation Fee (yeni tokenlar bu kadar MON oder)</p>
              <div className="flex gap-2">
                <Input value={desiredFeeMon} onChange={(e) => setDesiredFeeMon(e.target.value)} placeholder="1" />
                <Button onClick={updateCreationFee} disabled={isWorking || isPending}>Set Fee</Button>
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Public Creation (kapaliysa sadece owner token acabilir)</p>
              <div className="flex gap-2">
                <Button variant={publicCreation ? 'outline' : 'default'} onClick={() => togglePublicCreation(true)} disabled={isWorking || isPending || publicCreation}>Public ON</Button>
                <Button variant={publicCreation ? 'default' : 'outline'} onClick={() => togglePublicCreation(false)} disabled={isWorking || isPending || !publicCreation}>Public OFF</Button>
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Default K (bonding curve katsayisi; yeni tokenlar icin)</p>
              <div className="flex gap-2">
                <Input value={desiredK} onChange={(e) => setDesiredK(e.target.value)} placeholder={`Current: ${currentK.toString()}`} />
                <Button onClick={updateK} disabled={isWorking || isPending}>Set K</Button>
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Treasury Adresi (creation fee + death tax buraya gider)</p>
              <div className="flex gap-2">
                <Input value={treasuryInput} onChange={(e) => setTreasuryInput(e.target.value)} placeholder="0x..." />
                <Button onClick={updateTreasury} disabled={isWorking || isPending}>Set Treasury</Button>
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Ownership transferi (2-step: yeni owner acceptOwnership cagirmali)</p>
              <div className="flex gap-2">
                <Input value={pendingOwnerInput} onChange={(e) => setPendingOwnerInput(e.target.value)} placeholder="0x... (yeni owner)" />
                <Button variant="destructive" onClick={startTransferOwnership} disabled={isWorking || isPending}>Transfer Ownership</Button>
              </div>
            </div>
          </div>

          {/* Create */}
          <form onSubmit={handleAdminCreate} className="mb-6 space-y-4 rounded-xl border border-border bg-card p-4">
            <h2 className="text-lg font-semibold">Free Admin Create</h2>
            <div className="space-y-2">
              <Label>Token Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={32} />
            </div>
            <div className="space-y-2">
              <Label>Symbol</Label>
              <Input value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} maxLength={8} />
            </div>
            <div className="space-y-2">
              <Label>Image URL <span className="text-red-400">*</span></Label>
              <Input
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                type="url"
                className={createSubmitAttempted && !imageUrl.trim() ? 'border-red-500' : ''}
              />
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex cursor-pointer items-center rounded-md border border-border px-3 py-2 text-sm hover:bg-secondary">
                  {isUploadingImage ? 'Yukleniyor...' : 'Fotograf Yukle'}
                  <input type="file" accept="image/*" className="hidden" disabled={isUploadingImage}
                    onChange={(e) => handleImageFileSelect(e.target.files?.[0] ?? null)} />
                </label>
                {selectedImageName && <span className="text-xs text-muted-foreground">{selectedImageName}</span>}
              </div>
              {imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imageUrl} alt="" className="h-20 w-20 rounded-md border border-border object-cover" />
              )}
            </div>
            <div className="space-y-2">
              <Label>Duration</Label>
              <div className="flex gap-2">
                {(['6h', '12h', '24h'] as Duration[]).map((d) => (
                  <Button key={d} type="button" variant={duration === d ? 'default' : 'outline'} onClick={() => setDuration(d)}>{d}</Button>
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
                className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <div className="space-y-2">
              <Label>Website</Label>
              <Input value={adminWebsite} onChange={(e) => setAdminWebsite(e.target.value)} placeholder="https://..." />
            </div>
            <div className="space-y-2">
              <Label>Twitter/X</Label>
              <Input value={adminTwitter} onChange={(e) => setAdminTwitter(e.target.value)} placeholder="https://x.com/..." />
            </div>
            <div className="space-y-2">
              <Label>Telegram</Label>
              <Input value={adminTelegram} onChange={(e) => setAdminTelegram(e.target.value)} placeholder="https://t.me/..." />
            </div>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input type="checkbox" checked={restoreFeeAfterCreate} onChange={(e) => setRestoreFeeAfterCreate(e.target.checked)} />
              Create sonrasi eski creation fee geri yuklensin
            </label>

            {!isConnected ? (
              <Button type="button" onClick={() => { const c = connectors[0]; if (c) connect({ connector: c }) }}>Cuzdan Bagla</Button>
            ) : (
              <Button type="submit" disabled={isWorking || isPending || !isOwner || isUploadingImage}>
                {isWorking || isPending ? 'Calisiyor...' : '0 MON ile Admin Create'}
              </Button>
            )}
          </form>

          {/* Token list */}
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Mevcut Tokenlar</h2>
              <Button variant="outline" onClick={() => void loadAdminTokens()} disabled={isTokensLoading}>
                {isTokensLoading ? 'Yenileniyor...' : 'Yenile'}
              </Button>
            </div>
            {adminTokens.length === 0 ? (
              <p className="text-sm text-muted-foreground">{isTokensLoading ? 'Yukleniyor...' : 'Token yok.'}</p>
            ) : (
              <div className="space-y-2">
                {adminTokens.map((row) => (
                  <div key={row.address} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3">
                    <div className="min-w-0">
                      <p className="font-medium text-foreground">{row.symbol} — {row.name}</p>
                      <p className="font-mono text-xs text-muted-foreground">{row.address}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`rounded px-2 py-1 text-xs ${row.deathFinalized ? 'bg-red-500/15 text-red-400' : 'bg-emerald-500/15 text-emerald-400'}`}>
                        {row.deathFinalized ? 'dead' : 'live'}
                      </span>
                      <Button
                        variant="destructive"
                        onClick={() => void deleteV2Token(row.address)}
                        disabled={!isOwner || deletingAddress === row.address}
                      >
                        {deletingAddress === row.address ? 'Siliniyor...' : 'Sil'}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {statusText && (
            <p className="mt-4 rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-400">{statusText}</p>
          )}
          {errorText && (
            <p className="mt-3 rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-400">{errorText}</p>
          )}
          {isWrongChain && (
            <p className="mt-3 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-300">
              Wrong network — Monad Testnet&apos;e gec (chainId: 10143).
            </p>
          )}
          {isConnected && !isOwner && ownerAddress && (
            <p className="mt-3 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-300">
              Bu cuzdan owner degil. Factory owner: {ownerAddress.slice(0, 8)}...{ownerAddress.slice(-6)}
            </p>
          )}
        </div>
      </main>
    </div>
  )
}

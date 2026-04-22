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

type Duration = '6h' | '12h' | '24h'

const DURATION_SECONDS: Record<Duration, bigint> = {
  '6h': BigInt(6 * 60 * 60),
  '12h': BigInt(12 * 60 * 60),
  '24h': BigInt(24 * 60 * 60),
}

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

    try {
      await ensureWalletAndChain()
      if (!name.trim() || !symbol.trim() || !imageUrl.trim()) {
        throw new Error('Name, symbol ve image URL zorunlu.')
      }
      if (!imageUrl.trim().startsWith('https://')) {
        throw new Error('Image URL https:// ile baslamali.')
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
        args: [name.trim(), symbol.trim().toUpperCase(), imageUrl.trim(), DURATION_SECONDS[duration]],
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
              <Label>Image URL (https)</Label>
              <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} type="url" />
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
              <Button type="submit" disabled={isWorking || isPending || !isOwner}>
                {isWorking || isPending ? 'Calisiyor...' : '0 MON ile Admin Create'}
              </Button>
            )}
          </form>

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

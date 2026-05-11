# Ekip Arkadaşı (Aeztrest) — Değişiklik Raporu

**Kapsam:** `127563e` → `889d9c3` (7 commit)
**Tarih:** 5 Mayıs 2026 – 7 Mayıs 2026
**Yazar:** Aeztrest (`gktgtunc@gmail.com`)

---

## Özet

Ekip arkadaşı iki aşamalı bir çalışma yaptı:

1. **5 Mayıs:** V1 bonding-curve'ün whale limit ve market cap sorunlarını acil fix olarak kapattı.
2. **7 Mayıs:** Projenin tamamını V2 mimarisine geçirdi — akıllı kontratlar, backend ve frontend aynı anda yeniden yazıldı.

Toplam değişiklik: **~15.000 satır ekleme, ~35.000 satır silme** (eski artifact ve build dosyaları dahil).

---

## 1. Acil Düzeltmeler — 5 Mayıs

### 1a. `fix whale limit: bump K 1M→100M and redeploy` (`127563e`)

**Sorun:** Bonding curve sabitinin (`K`) 1M olması, 100M token'ı (arzın %10'u = whale limiti) mint etmek için yalnızca ~0.67 MON yeterliydi. Bu yüzden 0.67 MON'dan büyük her alım "Max holding 10% exceeded" hatası veriyordu.

**Yapılan değişiklik:**
- `ignition/parameters/testnet.json` ve `mainnet.json` dosyalarında `K` değeri `1_000_000` → `100_000_000` olarak güncellendi.
- Yeni testnet kontratı deploy edildi: `0xE7f484B53909E3543AA949BCfe2C54ba3017f71A`

**Etki:** 10–60 MON arasındaki alımlar artık başarıyla çalışıyor, whale limiti (%10) korunuyor.

---

### 1b. `remove MAX_POOL cap and bump K to 1e10 for higher market cap ceiling` (`f5407d0`)

**Sorun:** `MAX_POOL = 10.000 MON` kodu ölüydü — bonding curve zaten `MAX_SUPPLY` (1B token) tarafından ~2.108 MON'da limitleniyordu. Ayrıca K=1e8 ile efektif max market cap yalnızca ~$84 değerindeydi.

**Yapılan değişiklik:**
- `ClacFactory.sol` içinden `MAX_POOL` kontrolü tamamen kaldırıldı.
- `K` değeri `1e8` → `1e10` (100x artış) olarak güncellendi.
- Yeni testnet kontratı: `0xd57D7Bd6b1f86Df12dF02B6CCC3e8e3202c3a340`

**Etki:**
| Metrik | Önce | Sonra |
|---|---|---|
| Max market cap | ~$84 | ~$8.400 |
| Whale limiti (cüzdan başı) | ~68 MON | ~6.770 MON |
| Anti-sniper (%1) | ~2 MON | ~211 MON |

---

## 2. V2 Mimari Geçişi — 7 Mayıs

### 2a. `contracts: v2 per-token clone architecture with initial buy` (`7e4144e`)

**Yeni dosyalar:** `hardhat-monad/contracts/v2/`

Bu commit projenin akıllı kontrat katmanını komple yeniden yazdı.

#### `ClacFactoryV2.sol` (262 satır)
- EIP-1167 minimal-proxy (clone) pattern ile her token için ayrı kontrat adresi üretiliyor.
- Token başına `K` değeri yaratılış anında kilitleniyor (ileride değiştirilemez).
- `publicCreation` flag'i ile token oluşturma whitelist kontrolü.
- `creationFee` mekanizması eklendi.
- İzlenen event'ler: `TokenCreated`, `OwnershipTransferStarted/Completed`.

#### `ClacTokenImpl.sol` (700 satır)
- Her token için clone'lanan ana implementasyon.
- **Pull-pattern claim:** Kullanıcılar kazandıklarını kendileri çekiyor (push yerine).
- **Weighted lottery:** Holding miktarına göre ağırlıklı çekiliş sistemi.
- **Son 1 saat mekaniği:** Satış yasağı + lottery snapshot freeze.
- `ReentrancyGuard` — fresh clone'larda `_status=0` (NOT_ENTERED) olduğundan doğrudan çalışıyor.
- `MAX_INITIAL_BUY_BPS = 7931` (~%79.31): Creator başlangıçta tüm arzı satın alamaz.

#### `ClacTrophyNFT.sol` (98 satır)
- Token ölümü sonrası claim hakkı olan sahiplere özel commemorative ERC-721 NFT.
- Yalnızca factory'ye kayıtlı tokenlar mint edebilir.

#### Randomness altyapısı
- `IPythEntropy.sol`: Pyth Entropy protokol arayüzü.
- `PythEntropyProvider.sol`: Canlı ağ için Pyth entegrasyonu.
- `MockRandomnessProvider.sol` (75 satır): Lokal geliştirme için anlık callback simülasyonu.

#### Yardımcı scriptler
- `scripts/swap-randomness-provider.ts`: Pyth ↔ Mock geçişi için deploy sonrası araç.
- `scripts/enable-public-creation.ts`: `publicCreation` flag'ini factory üzerinde açma.

#### Testler
- **65/65 test geçiyor** (28 V1 + 37 V2, bunlardan 5 tanesi yeni initial-buy senaryoları).

---

### 2b. `backend: v2 listener + zero-setup local dev with PGlite` (`b8c6942`)

**Yeni dosyalar:** `clacl_backend/src/blockchain-v2/`

#### `BlockchainV2Service` (728 satır)
- `ClacFactoryV2.TokenCreated` event'ini dinleyerek her yeni token için dinamik olarak per-clone listener başlatıyor.
- Dinlenen event'ler: `Trade`, `DeathRequested`, `DeathFinalized`, `Claimed`, `LotteryWeightChanged`.
- **Backfill + reorg replay**: `MONAD_REPLAY_BLOCKS` env değişkeni ile yeniden işleme.

#### Yeni Prisma V2 Tabloları (migration: `20260507120000_v2_tables`)
```
TokenV2       — Her V2 token kaydı (adres-anahtarlı)
TradeV2       — Alım/satım işlemleri (txHash + logIndex ile idempotency)
HolderV2      — Cüzdan bazlı holding takibi
LotteryWinV2  — Lottery kazananları
ClaimV2       — Pull-pattern claim kayıtları
SyncStateV2   — Blockchain sync durumu
```

#### API Endpoint'leri
- `GET /api/v2/tokens` — V2 token listesi (TokensV2Controller)
- `WS /ws-v2` namespace — Gerçek zamanlı V2 güncellemeleri (TokensV2Gateway)
- `GET /api/health` — DB + RPC ping health check

#### Lokal Geliştirme Kolaylığı
- `scripts/start-pglite.mjs`: `@electric-sql/pglite` + `pg-gateway` üzerinden TCP PostgreSQL emülasyonu.
- **Sistem PostgreSQL kurulumuna gerek kalmadı.** `pnpm dev:full` komutu: PGlite + prisma migrate + NestJS'i tek komutta başlatıyor.

#### Diğer Backend Değişiklikleri
- `main.ts`: `import 'dotenv/config'` eklendi (modül yüklenirken env okuma sorunu giderildi).
- `monad.config.ts`: `MONAD_FACTORY_V2_ADDRESS` env değişkeni eklendi.
- `render.yaml`: Production ortamına `MONAD_FACTORY_V2_ADDRESS` eklendi.
- `prisma-bootstrap.mjs`: pnpm altında `prisma` binary'sini doğrudan resolve edecek şekilde düzeltildi.

---

### 2c. `frontend: v2 create flow with initial buy + SSR/CSP fixes` (`e07a89f`)

**Yeni dosyalar:** `clack_frontend/src/components/v2/`, `clack_frontend/src/hooks/use-token-v2*.ts`, `clack_frontend/src/lib/web3/contracts-v2.ts`

#### `/create` sayfası — Initial Buy özelliği
- Artık `ClacFactoryV2` ile konuşuyor (UI görsel olarak aynı kaldı).
- Yeni "Initial Buy" bölümü:
  - `1% / 5% / 10% / 20%` hızlı seçim butonları.
  - Gerçek zamanlı MON maliyet önizlemesi (RPC çağrısı olmadan, TypeScript'te bonding-curve math mirroring).
  - Cüzdan bakiyesi, alım miktarı ve toplam arz gösterimi.

#### Token sayfaları — Versiyondan bağımsız routing
- `/token/[id]`: `0x...` adres formatını otomatik algılıyor → `TokenDetailByAddress` (V2 view).
- Sayısal ID / slug → eski V1 sayfası.
- **`/create/v2` ve `/token/v2/[address]` route'ları kaldırıldı** — URL'ler artık factory versiyonundan bağımsız.
- UI'daki tüm "v2" ifadeleri kaldırıldı.

#### Homepage
- V2 factory üzerinden `getAllTokens` ile live token listesi (backend dependency yok).

#### SSR / CSP Düzeltmeleri
- `Web3Provider`: `wagmiConfig` artık `useEffect` içinde lazy build ediliyor (SSR-safe).
- `RainbowKitProvider` sadece client-side mount oluyor.
- Düzeltilen hata: `/_not-found`, `/admin`, `/bridge` sayfalarındaki "localStorage.getItem is not a function" prerender crash (Next.js 16).
- `next.config.mjs` CSP artık ortama duyarlı:
  - Dev: `http(s)://localhost` ve `ws://localhost` izinli.
  - Prod: Strict CSP korunuyor.
  - `NEXT_PUBLIC_BACKEND_URL` / `NEXT_PUBLIC_MONAD_RPC` env değerleri otomatik olarak `connect-src`'e ekleniyor.

#### Yeni V2 Hook'ları
```typescript
useTokenV2            // Token state okuma
useUserV2State        // Kullanıcı durumu
useV2RandomnessFee    // Lottery randomness ücreti
useV2FactoryCreationFee
useV2Buy / Sell       // İşlem hook'ları
useV2RequestDeath     // Ölüm isteği
useV2Claim            // Pull-pattern claim
useV2WithdrawFees     // Treasury çekimi
useV2MintTrophy       // NFT mint
useV2CreateToken      // Token oluşturma
```

#### Diğer Frontend Değişiklikleri
- `TokenImage`: `fill` prop kullanımına geçildi (Next.js 16 zorunluluğu).
- `tsconfig.json`: `target` ES2020'ye çıkarıldı (BigInt literal desteği için).

---

### 2d. `docs: rewrite README quick-start and tighten .gitignore` (`ccd8de0`)

- README `Quick Start` bölümü yeniden yazıldı: pnpm, PGlite, 3-komutlu setup.
- Güncel testnet factory adresleri README'ye eklendi.
- `.gitignore`'a eklenenler:
  - PGlite yerel veri dizini
  - Arşivlenmiş Ignition deployment klasörleri
  - Dev screenshot'ları

---

### 2e. `chore: track current testnet ignition artifacts + hardhat lockfile` (`889d9c3`)

- V2 Mock module Ignition artifact'ları commit'lendi:
  - `ClacFactoryV2MockModule#ClacFactoryV2`
  - `ClacFactoryV2MockModule#ClacTokenImpl`
  - `ClacFactoryV2MockModule#ClacTrophyNFT`
  - `ClacFactoryV2MockModule#MockRandomnessProvider`
- `hardhat-monad/pnpm-lock.yaml` (4.484 satır) ilk kez commit'lendi (reproducible build için).

---

## Değişiklik Özeti (Dosya Bazında)

| Alan | Etkilenen Dosyalar | Durum |
|---|---|---|
| **Akıllı Kontratlar** | `contracts/v2/*.sol` (10 dosya) | Yeni |
| **Kontrat Testleri** | `test/ClacV2.test.ts` (785 satır) | Yeni |
| **Ignition Modülleri** | `modules/ClacFactoryV2*.ts` | Yeni |
| **Deploy Scripts** | `scripts/swap-randomness-provider.ts`, `enable-public-creation.ts` | Yeni |
| **Backend Servis** | `blockchain-v2/blockchain-v2.service.ts` (728 satır) | Yeni |
| **Backend API** | `tokens-v2.controller.ts`, `tokens-v2.gateway.ts` | Yeni |
| **Prisma Schema** | 6 yeni tablo, migration SQL | Yeni |
| **Lokal Dev** | `scripts/start-pglite.mjs` | Yeni |
| **Frontend Hook'lar** | `use-token-v2.ts`, `use-token-v2-actions.ts` | Yeni |
| **Frontend Bileşenler** | `v2/token-detail.tsx`, `trade-panel-v2.tsx`, `death-controls.tsx` vb. | Yeni |
| **Web3 Config** | `contracts-v2.ts`, `wagmi-config.ts` | Yeni/Güncellendi |
| **Next.js Config** | `next.config.mjs`, `tsconfig.json` | Güncellendi |
| **Render Deploy** | `render.yaml` | Güncellendi |
| **Dokümantasyon** | `README.md`, `.gitignore` | Güncellendi |

---

## Dikkat Edilmesi Gereken Noktalar

1. **`pnpm-lock.yaml`** ilk kez commit'lendi (hem `clacl_backend` hem `hardhat-monad` için). `npm install` yerine `pnpm install` kullanılmalı.
2. **Yeni env değişkenleri** gerekiyor: `MONAD_FACTORY_V2_ADDRESS` (backend ve frontend `.env.example` güncellenmiş).
3. **`/create/v2` ve `/token/v2/[address]` URL'leri artık yok** — eğer bu URL'lere hardcoded referans varsa güncellenmesi gerekiyor.
4. **Lokal dev akışı değişti:** Artık PostgreSQL yerine `pnpm dev:full` (PGlite otomatik başlıyor).
5. **V1 kontratlar hâlâ çalışıyor** — V2 tamamen ayrı bir deployment, V1 kodu silinmedi.

---

*Rapor tarihi: 11 Mayıs 2026 — `git log` çıktısından otomatik oluşturulmuştur.*

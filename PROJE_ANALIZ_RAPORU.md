# clac.fun — Kapsamlı Proje Analiz Raporu

**Tarih**: 2 Mayıs 2026  
**Kapsam**: Tüm kod tabanı, mimari, konfigürasyon, dokümantasyon

---

## 1. Proje Özeti

**clac.fun**, Monad blockchain ağında çalışan, bonding-curve tabanlı, süreli memecoin (ERC-20 benzeri) oluşturma ve trading platformudur. Her token oluşturulduğunda bir "ölüm saati" belirlenir (6h / 12h / 24h). Süre dolduğunda `triggerDeath()` çağrılır ve havuz pro-rata + lottery mekanizmasıyla holder'lara dağıtılır.

**Monorepo Yapısı:**
- `clack_frontend` — Next.js 16 + React 19 + Wagmi/RainbowKit
- `clacl_backend` — NestJS 11 + Prisma 7 + PostgreSQL + Socket.IO
- `hardhat-monad` — Solidity kontratlar, testler, deploy araçları
- `docs/operations` — Operasyon runbook'ları ve checklist'leri

---

## 2. Dizin Yapısı

```
clac.fun/
├── clack_frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx                  # Ana sayfa
│   │   │   ├── create/page.tsx           # Token oluşturma
│   │   │   ├── token/[id]/page.tsx       # Token detay + trade
│   │   │   ├── portfolio/page.tsx        # Kullanıcı portföyü
│   │   │   ├── leaderboard/page.tsx      # Top tokenlar
│   │   │   ├── admin/page.tsx            # Admin panel
│   │   │   └── bridge/page.tsx           # ⚠️ Stub — boş
│   │   ├── components/
│   │   │   ├── trade-panel.tsx
│   │   │   ├── token-grid.tsx
│   │   │   ├── price-chart.tsx
│   │   │   ├── live-ticker.tsx
│   │   │   ├── winners-feed.tsx
│   │   │   ├── trending-carousel.tsx
│   │   │   ├── header.tsx
│   │   │   └── ui/                       # Radix UI bileşenleri
│   │   ├── hooks/
│   │   │   ├── use-live-events.ts
│   │   │   ├── use-death-clock.ts
│   │   │   └── use-mobile.ts
│   │   └── lib/
│   │       ├── env.ts                    # Zod env validation
│   │       ├── api/client.ts             # REST + Socket.IO client
│   │       ├── api/types.ts
│   │       ├── api/mappers.ts
│   │       ├── web3/contracts.ts         # ABI + address
│   │       ├── web3/chains.ts            # Monad testnet config
│   │       ├── web3/wagmi-config.ts
│   │       ├── format.ts
│   │       ├── death-clock.ts
│   │       └── utils.ts
│   ├── next.config.mjs
│   ├── .env.local
│   └── .env.example
│
├── clacl_backend/
│   ├── src/
│   │   ├── main.ts                       # Bootstrap (port 3001, /api prefix)
│   │   ├── app.module.ts
│   │   ├── app.controller.ts             # /health, /ready
│   │   ├── admin.controller.ts           # Admin API (password guard)
│   │   ├── blockchain/
│   │   │   ├── blockchain.service.ts     # Event indexer + sync
│   │   │   ├── contract.abi.ts
│   │   │   └── blockchain.module.ts
│   │   ├── tokens/
│   │   ├── trades/
│   │   ├── portfolio/
│   │   ├── leaderboard/
│   │   ├── upload/                       # Cloudinary
│   │   └── config/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/20260422120000_init/
│   ├── test/
│   │   └── app.controller.spec.ts
│   ├── render.yaml
│   ├── .env
│   └── .env.example
│
├── hardhat-monad/
│   ├── contracts/
│   │   ├── ClacFactory.sol
│   │   └── libraries/BondingCurve.sol
│   ├── ignition/
│   │   ├── modules/ClacFactory.ts
│   │   ├── parameters/testnet.json
│   │   └── deployments/chain-10143/      # Deploy adresleri
│   ├── test/ClacFactory.test.ts          # 85+ test case
│   ├── hardhat.config.ts
│   └── package.json
│
├── docs/operations/
│   ├── GO_NO_GO_EVIDENCE_CHECKLIST.md
│   ├── INCIDENT_RESPONSE_RUNBOOK.md
│   ├── BACKUP_RESTORE_RUNBOOK.md
│   └── OBSERVABILITY_RUNBOOK.md
│
├── README.md
├── render.yaml
└── PROJE_DURUM_VE_AKIS_RAPORU.md
```

---

## 3. Teknoloji Stack

| Katman | Araç | Versiyon | Not |
|--------|------|----------|-----|
| Frontend | Next.js | 16.2.0 | React 19, SSR/SSG |
| | Wagmi | 2.19.5 | Web3 wallet hook'ları |
| | RainbowKit | 2.2.10 | Wallet connect UI |
| | Viem | 2.48.2 | Ethers yerine |
| | Tailwind CSS | 4.2.0 | Styling |
| | Radix UI | Çeşitli | Headless UI |
| Backend | NestJS | 11.0.1 | TypeScript framework |
| | Prisma | 7.7.0 | ORM + migrations |
| | PostgreSQL | — | Prod DB |
| | Socket.IO | 4.x | Real-time events |
| | Ethers | 6.16.0 | Blockchain RPC |
| | Cloudinary | 2.10.0 | Image storage |
| Contract | Solidity | 0.8.28 | EVM |
| | Hardhat | 2.22.19 | Dev framework |
| | OpenZeppelin | 5.6.1 | ReentrancyGuard vb. |

---

## 4. Smart Contract (ClacFactory.sol)

### Deploy Bilgisi
- **Testnet Adresi**: `0x8E6F959838ee38BDDBa43fE29468aa2080fc2043` (Chain 10143)
- **Treasury**: Aynı adres (testnet)
- **Public Creation**: `false` — testnet'te sadece owner oluşturabilir

### Önemli Sabitler

| Parametre | Değer |
|-----------|-------|
| Bonding Curve | `price(supply) = K * sqrt(supply)` (K=1000000) |
| Protocol Fee | 2% |
| Creator Fee | 1% |
| Death Tax | 5% |
| Pro-Rata / Lottery Split | 65% / 35% |
| Creation Fee | 10 MON |
| Max Pool | 10.000 MON |
| Max Supply | 1 milyar token |
| Sniper Protection | İlk 5 blok'ta max %1 buy |

### Ana Fonksiyonlar

| Fonksiyon | Açıklama |
|-----------|---------|
| `createToken(name, symbol, imageURI, duration)` | Token oluştur (10 MON) |
| `buy(tokenId, minTokens)` | Token al |
| `sell(tokenId, amount, minMON)` | Token sat |
| `triggerDeath(tokenId)` | Süresi dolmuş tokenı öldür + dağıt |
| `claim(tokenId)` | Pro-rata / lottery hissesini talep et |
| `getBuyCost(tokenId, amount)` | Satın alma maliyeti sorgula |
| `getSellQuote(tokenId, amount)` | Satış geliri sorgula |

### Contract Durum: ✅ Tamamlanmış

- Bonding curve mantığı implement edilmiş
- Death mekanizması çalışıyor
- Lottery + pro-rata dağıtım çalışıyor
- Sniper koruması aktif
- ReentrancyGuard kullanılıyor
- 85+ Hardhat test case yazılmış

---

## 5. Backend (NestJS)

### Modüller

| Modül | Servis | Durum |
|-------|--------|-------|
| BlockchainModule | Event indexer + sync | ✅ |
| TokensModule | CRUD + trending | ✅ |
| TradesModule | Recent trades + winners | ✅ |
| LeaderboardModule | Top tokens + traders | ✅ |
| PortfolioModule | Holdings + claims | ✅ |
| UploadModule | Cloudinary image upload | ✅ |
| AdminModule | Password-protected yönetim | ✅ |

### Veritabanı Modelleri (Prisma)

```prisma
Token       — id, creator, name, symbol, imageURI, virtualSupply,
              poolBalance, createdAt, duration, dead, deathProcessed,
              totalHolders, marketCap, currentPrice, volume24h, change24h

Trade       — id, tokenId, trader, isBuy, tokenAmount, monAmount,
              protocolFee, creatorFee, newSupply, newPrice,
              txHash (UNIQUE), blockNumber, timestamp

Holder      — id, tokenId, address, balance (UNIQUE tokenId+address)

LotteryWin  — id, tokenId, winner, amount, txHash, timestamp

Claim       — id, tokenId, holder, amount, txHash, timestamp

SyncState   — id=1, lastBlockNumber
```

### API Endpoint'leri

| Method | Endpoint | Açıklama | Auth |
|--------|----------|---------|------|
| GET | `/api/health` | Sağlık kontrolü | — |
| GET | `/api/ready` | DB ready check | — |
| GET | `/api/tokens` | Token listesi (filter: live/dying/dead/new/hot) | — |
| GET | `/api/tokens/:id` | Token detayı + son 50 trade | — |
| GET | `/api/tokens/:id/trades` | Paginated trades | — |
| GET | `/api/tokens/:id/holders` | Top 250 holder | — |
| GET | `/api/tokens/:id/lottery` | Top 100 lottery win | — |
| GET | `/api/tokens/trending` | Trending (volume24h desc) | — |
| GET | `/api/trades/recent` | Son işlemler | — |
| GET | `/api/trades/winners` | En yüksek satışlar | — |
| GET | `/api/leaderboard` | Top tokens (marketCap desc) | — |
| GET | `/api/leaderboard/traders` | Top traders | — |
| GET | `/api/portfolio/:address` | Holdings + trades + claims + lottery | — |
| GET | `/api/portfolio/:address/claims` | Claim geçmişi | — |
| POST | `/api/upload/image` | Dosya upload (Cloudinary) | — |
| POST | `/api/upload/image-url` | URL'den image mirror | — |
| GET | `/api/admin/tokens` | Admin token listesi | ✅ `x-admin-password` |
| DELETE | `/api/admin/tokens/:id` | Token sil + dosya temizlik | ✅ `x-admin-password` |

### WebSocket (Socket.IO)

**Namespace**: `/ws`

| Event | Açıklama |
|-------|---------|
| `tokenCreated` | Yeni token oluşturuldu |
| `trade` | Buy/sell işlemi |
| `tokenClacced` | Token öldü + death trigger |
| `lotteryWin` | Lottery kazananı |
| `ticker` | Price update |

### Blockchain Service Senkronizasyon Stratejisi

1. **Startup**: `syncPastEvents()` — arka planda, non-blocking  
   - Son senkronize blok'tan başla  
   - Finality buffer ile korunma (default 3 blok)  
   - 100 blok'luk chunk'lar halinde query  
   - Rate limit aşılırsa recursive binary split  

2. **Real-time**: WebSocket veya polling  
   - Event listener attach  
   - `handleTokenCreated`, `handleTrade`, `handleDeath` vb.  

3. **Replay**: 20 blok geri giderek reorg koruması

---

## 6. Frontend (Next.js)

### Sayfalar

| Route | Durum | Not |
|-------|-------|-----|
| `/` | ✅ Tamamlanmış | Ana sayfa, trending, live ticker |
| `/token/[id]` | ✅ Tamamlanmış | Token detay + trade panel |
| `/create` | ✅ Tamamlanmış | Token oluşturma formu |
| `/portfolio` | ✅ Tamamlanmış | Holdings, trades, claims |
| `/leaderboard` | ✅ Tamamlanmış | Top tokens + traders |
| `/admin` | ✅ Tamamlanmış | Password korumalı yönetim |
| `/bridge` | ❌ Stub | Boş placeholder sayfa |

### Önemli Component'lar

| Component | Amaç |
|-----------|------|
| `trade-panel.tsx` | Buy/Sell UI + quote fetching |
| `token-grid.tsx` | Token listesi grid view |
| `price-chart.tsx` | Lightweight Charts (candlestick) |
| `live-ticker.tsx` | Real-time event ticker |
| `winners-feed.tsx` | Canlı lottery/trade feed |
| `trending-carousel.tsx` | Trending tokens carousel |
| `header.tsx` | Nav + wallet connect |

### Eksik / Yarım UI Özellikleri

| Özellik | Durum | Not |
|---------|-------|-----|
| Search/Filter | ⚠️ Placeholder | Header'da ikon var, non-functional |
| Dark Mode Toggle | ⚠️ Static | next-themes setup var, UI yok |
| Bridge sayfası | ❌ Boş | Kaldırılmalı veya implement edilmeli |
| Portfolio Analytics | ⚠️ Minimal | Sadece liste görünümü |
| Chart Geçmişi | ⚠️ Temel | Sınırlı candlestick data |

### Build Durumu

| Komut | Durum | Not |
|-------|-------|-----|
| `npm run dev` | ✅ | Dev server çalışıyor |
| `npm run build` | ❌ FAIL | Next.js entry point hatası |
| `npm run lint` | ❌ FAIL | ESLint parser hatası |
| `npm run start` | ✅ | Production start çalışıyor |
| `npm run smoke:release` | ❌ FAIL | Env validation hatası |

---

## 7. Environment Variables

### Frontend (`.env.local`)
```
NEXT_PUBLIC_MONAD_RPC=https://testnet-rpc.monad.xyz
NEXT_PUBLIC_MONAD_WS=wss://testnet-rpc.monad.xyz
NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
NEXT_PUBLIC_SITE_URL=https://clac.fun
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=fa9e0eafd8b2356cafde894807d78ca9
NEXT_PUBLIC_CLAC_FACTORY_ADDRESS=0x8E6F959838ee38BDDBa43fE29468aa2080fc2043
```

### Backend (`.env`)
```
DATABASE_URL=postgresql://... (prod) | file:./clac.db (dev)
MONAD_RPC_URL=https://testnet-rpc.monad.xyz
MONAD_WS_URL=wss://testnet-rpc.monad.xyz
MONAD_CONTRACT_ADDRESS=0x8E6F959838ee38BDDBa43fE29468aa2080fc2043
PORT=3001
RATE_LIMIT_TTL_MS=60000
RATE_LIMIT_MAX=120
WS_MAX_CONNECTIONS_PER_IP=5
MONAD_FINALITY_BLOCKS=3
MONAD_REPLAY_BLOCKS=20
MONAD_INITIAL_BACKFILL_BLOCKS=5000
MONAD_MAX_LOG_RANGE=100
ADMIN_PANEL_PASSWORD=Bugra.0601      ← ⚠️ Secret manager'a taşı
CLOUDINARY_CLOUD_NAME=dejkvivjx      ← ⚠️ Secret manager'a taşı
CLOUDINARY_API_KEY=...               ← ⚠️ Secret manager'a taşı
CLOUDINARY_API_SECRET=...            ← ⚠️ Secret manager'a taşı
```

---

## 8. Deploy Konfigürasyonu (Render.com)

### Services

**clac-frontend**
- Runtime: Node 22.22.0
- Root: `clack_frontend`
- Build: `npm install && npm run build`
- Start: `npm run start`

**clac-backend**
- Runtime: Node 22.22.0
- Root: `clacl_backend`
- Build: `npm install && npx prisma generate && npm run build`
- Start: `npm run start:prod`
- Pre-start: Prisma migration otomatik çalışıyor

**Not**: Backend `start:prod` script'i:
```bash
npm run prisma:migrate && (node dist/src/main.js || node dist/main.js)
```

---

## 9. Test Durumu

### Smart Contract
- ✅ `npm run compile` — başarılı
- ✅ `npm run test` — 85+ test case
- ⚠️ Test script `exit 1` döndürüyor (test geçse bile) — CI/CD'yi kırıyor

### Backend
- ✅ `npm run build` — başarılı
- ✅ `npm run test` — unit test (AppController) geçiyor
- ✅ `npm run test:e2e` — jest e2e config hazır

### Frontend
- ❌ `npm run build` — FAIL
- ❌ `npm run lint` — FAIL (ESLint parser hatası)
- ✅ `npm run dev` — çalışıyor

---

## 10. Güvenlik Analizi

| Alan | Durum | Açıklama |
|------|-------|---------|
| CORS | ⚠️ | `origin: '*'` — prod'da kısıtlanmalı |
| Admin Panel Auth | ⚠️ | Sadece header password — HTTPS + IP allowlist önerilir |
| Rate Limiting | ✅ | ThrottlerGuard aktif (120 req/min per IP) |
| Input Validation | ✅ | ValidationPipe + DTO + class-validator |
| Reentrancy | ✅ | Contract'ta ReentrancyGuard var |
| Admin Password | ❌ | `.env`'de plaintext, secret manager'a taşınmalı |
| Cloudinary Keys | ❌ | `.env`'de açık, secret manager'a taşınmalı |
| TS Build Errors Ignore | ⚠️ | `next.config.mjs`'de `ignoreBuildErrors: true` |

---

## 11. Mimari ve Veri Akışı

```
┌──────────────────────────────────────────────────────────────┐
│                       USER BROWSER                           │
│  (Next.js @ port 3000)                                       │
│  - Wagmi/RainbowKit wallet connect                           │
│  - create / buy / sell / claim tx'leri                       │
└────────────┬─────────────────────┬──────────────┬────────────┘
             │ REST API            │ WebSocket    │ Contract Tx
             ▼                     ▼              ▼
  ┌──────────────────┐   ┌──────────────────┐  ┌─────────────┐
  │  NestJS Backend  │   │  Socket.IO /ws   │  │    Monad    │
  │  @ port 3001     │   │  Events:         │  │   Network   │
  │  GET/POST/DELETE │   │  tokenCreated    │  │  ClacFactory│
  └────────┬─────────┘   │  trade           │  └──────┬──────┘
           │             │  tokenClacced    │         │
           │             │  lotteryWin      │         │
           │             │  ticker          │         │
           ▼             └──────────────────┘         ▼
  ┌──────────────────────────────────┐  ┌──────────────────────┐
  │  PostgreSQL / SQLite             │  │  Monad RPC/WS        │
  │  Token, Trade, Holder,           │  │  - Event listener    │
  │  LotteryWin, Claim, SyncState    │  │  - Backfill query    │
  └──────────────────────────────────┘  └──────────────────────┘
```

**Veri Akışı:**
1. User `createToken()` tx gönderir
2. Contract `TokenCreated` event emit eder
3. Backend WS listener / polling event'i yakalar
4. Prisma ile DB'ye yazılır
5. Socket.IO ile frontend'e push edilir
6. UI otomatik güncellenir

---

## 12. Eksik ve Yarım Kalan Özellikler

| Özellik | Dosya | Durum | Öncelik |
|---------|-------|-------|---------|
| Bridge sayfası | `app/bridge/page.tsx` | ❌ Boş stub | Düşük |
| Header search | `components/header.tsx` | ⚠️ Non-functional ikon | Orta |
| Dark mode toggle | `components/theme-provider.tsx` | ⚠️ next-themes kurulu, UI yok | Düşük |
| Portfolio analytics | `portfolio/page.tsx` | ⚠️ Sadece liste | Orta |
| Chart geçmişi | `components/price-chart.tsx` | ⚠️ Temel candlestick | Orta |
| Leaderboard detayı | `leaderboard/page.tsx` | ⚠️ Minimal | Düşük |
| Frontend build | `next.config.mjs` | ❌ Build broken | **Kritik** |
| Monitoring/alerting | `docs/operations/` | ⚠️ Runbook var, impl yok | Yüksek |

---

## 13. Bilinen Sorunlar

### Kritik

1. **Frontend Build Broken**  
   `npm run build` başarısız oluyor.  
   Sebep: ESLint parser config veya Next.js entry point çözümlemesi.  
   Etki: Render.com deployment başarısız olur.  
   Çözüm: ESLint config düzeltilmeli veya `next.config.mjs`'deki `ignoreBuildErrors: true`'yu kaldırıp tüm TS hataları düzeltilmeli.

2. **Smoke Test Fail**  
   `npm run smoke:release` başarısız oluyor.  
   Sebep: Env validation (WalletConnect Project ID veya başka bir key eksik/hatalı).  
   Etki: Release CI pipeline kırık.

3. **Admin Şifresi Plaintext**  
   `ADMIN_PANEL_PASSWORD=Bugra.0601` `.env`'de açık.  
   Risk: Repo erişimi olan herkes görebilir.  
   Çözüm: Render secret store veya başka bir secret manager.

### Orta Seviye

4. **Cloudinary Credentials Exposed**  
   `.env`'de API key ve secret açık.  
   Risk: Hesap ele geçirilebilir.

5. **CORS Wildcard**  
   Backend `enableCors({ origin: '*' })` kullanıyor.  
   Risk: Yetkisiz API erişimi.  
   Çözüm: Prod'da `CORS_ORIGINS=https://clac.fun` vb. kısıtlama.

6. **Trade Quote Birim Uyumsuzluğu**  
   Frontend `TradePanel` ile `getBuyCost`/`getSellQuote` arasındaki birim dönüşümü kontrol edilmeli.  
   Risk: Slippage hesaplaması hatalı olabilir.

### Düşük Seviye (Teknik Borç)

7. `next.config.mjs`'de `typescript.ignoreBuildErrors: true` — gizli type hataları.
8. Hardhat test script `exit 1` döndürüyor — CI/CD'yi kırıyor.
9. Bridge sayfası boş — kullanıcı kafa karışıklığı yaratır.
10. Dev'de SQLite, prod'da PostgreSQL — migration riski.
11. Blockchain Service'te RPC timeout/failure için graceful fallback eksik.
12. `MONAD_INITIAL_BACKFILL_BLOCKS=5000` — Monad'da yaklaşık 1 saat geçmiş. Başlangıç bloğu belirsizse veriler eksik kalabilir.

---

## 14. Production Hazırlık Özeti

| Bileşen | Durum | Not |
|---------|-------|-----|
| Smart Contract | ✅ Hazır | Test edilmiş, deploy edilmiş |
| Backend | ⚠️ Yakın | Build OK, env/config tuning gerekli |
| Frontend | ❌ Hazır değil | Build broken, lint broken |
| Database | ✅ Hazır | PostgreSQL + migration aktif |
| Monitoring | ⚠️ Eksik | Runbook var, implementation yok |
| Backup/Restore | ⚠️ Eksik | Prosedür tanımlandı, test edilmedi |
| Security | ⚠️ Eksik | Credentials, CORS, admin auth |

---

## 15. Launch Öncesi Yapılması Gerekenler

### Zorunlu (Blockers)
- [ ] Frontend build/lint hatası giderilmeli
- [ ] Admin şifresi secret manager'a taşınmalı
- [ ] Cloudinary credentials secret manager'a taşınmalı
- [ ] CORS allowlist konfigüre edilmeli (`https://clac.fun`)
- [ ] `typescript.ignoreBuildErrors` kaldırılmalı, TS hataları fix edilmeli
- [ ] Smoke test geçer hale getirilmeli

### Önemli (Yüksek Öncelik)
- [ ] Monitoring/alerting kurulumu yapılmalı
- [ ] Database backup test edilmeli
- [ ] Trade quote birim uyumluluğu doğrulanmalı
- [ ] Hardhat test script `exit 1` hatası düzeltilmeli
- [ ] Contract MonadScan'da verify edilmeli

### İsteğe Bağlı (Orta Öncelik)
- [ ] Bridge sayfası kaldırılmalı veya implement edilmeli
- [ ] Header search implement edilmeli veya kaldırılmalı
- [ ] Dark mode toggle UI eklenmeli
- [ ] Dev ortamında da PostgreSQL kullanılmalı
- [ ] Blockchain service için RPC failure graceful handling eklenmeli

---

## 16. Genel Değerlendirme

**clac.fun**, bonding-curve tabanlı süreli memecoin platformu olarak iyi tasarlanmış. Backend solid, smart contract mantığı güvenli ve test edilmiş, frontend'in main feature'ları çalışıyor.

**Güçlü Yönler:**
- Tamamlanmış smart contract (bonding curve, death mekanizması, lottery)
- Backend API ve event indexer well-structured
- Frontend ana özellikler implement edilmiş
- Real-time events (Socket.IO) çalışıyor
- Kapsamlı operasyon dokümantasyonu

**Kritik Eksikler:**
- Frontend build broken → deployment riski
- Credentials plaintext → güvenlik açığı
- CORS wildcard → güvenlik açığı
- Monitoring yok → production incidents'lara kör kalınabilir

Soft launch için minimum: Frontend build fix + credentials güvenliği + CORS kısıtlama + temel monitoring.

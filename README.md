# clac.fun Monorepo

`clac.fun`, Monad aginda calisan bonding-curve tabanli token olusturma ve trade platformudur.  
Bu repo 3 ana parcadan olusur:

- `clack_frontend`: Next.js arayuzu (kullanici, token sayfasi, create, admin)
- `clacl_backend`: NestJS API + Prisma + on-chain event indexer + websocket
- `hardhat-monad`: Solidity kontratlar, test ve deploy workspace

## Mimari Ozet

1. Kullanici frontend uzerinden kontrat ile etkilesir (`createToken`, `buy`, `sell`, vb.).
2. Backend, Monad RPC/WS uzerinden eventleri indexler ve PostgreSQL'e yazar.
3. Frontend, REST API + websocket (`/ws`) uzerinden anlik veri alir.
4. Upload edilen token gorselleri backend tarafinda `uploads/` klasorunde tutulur ve `/uploads/*` ile servis edilir.

## Repo Yapisi

```text
.
├── clack_frontend/        # Next.js 16 + React 19
├── clacl_backend/         # NestJS 11 + Prisma 7 + PostgreSQL
├── hardhat-monad/         # Hardhat + Ignition + Solidity
├── docs/operations/       # Runbook ve go-live checklist dokumanlari
└── PROJE_DURUM_VE_AKIS_RAPORU.md
```

## Teknoloji Stack

- Frontend: Next.js 16, React 19, Wagmi, RainbowKit, Viem, Socket.IO Client
- Backend: NestJS 11, Prisma 7, PostgreSQL, Ethers v6, Socket.IO Gateway
- Smart Contract: Solidity 0.8.28, Hardhat, OpenZeppelin
- Ops/Security: Helmet, throttling, validation pipe, runbook tabanli operasyon

## Hızlı Baslangic (Local Development)

## 0) On Kosullar

- Node.js 20+ (onerilen LTS)
- npm 10+
- PostgreSQL calisan bir instance
- Monad testnet RPC erisimi

## 1) Backend kurulumu (`clacl_backend`)

```bash
cd clacl_backend
cp .env.example .env
npm install
npm run prisma:generate
npm run prisma:migrate
npm run start:dev
```

Gerekli temel env degiskenleri:

- `DATABASE_URL`: PostgreSQL baglantisi olmali (SQLite degil)
- `MONAD_RPC_URL`, `MONAD_WS_URL`
- `MONAD_CONTRACT_ADDRESS`
- `ADMIN_PANEL_PASSWORD` (onerilen: guclu ve benzersiz sifre)

Backend varsayilan port: `3001`  
Health endpointleri:

- `GET /api/health`
- `GET /api/ready`

## 2) Frontend kurulumu (`clack_frontend`)

```bash
cd clack_frontend
cp .env.example .env.local
npm install
npm run dev
```

Gerekli temel env degiskenleri:

- `NEXT_PUBLIC_BACKEND_URL` (ornek: `http://localhost:3001`)
- `NEXT_PUBLIC_MONAD_RPC`, `NEXT_PUBLIC_MONAD_WS`
- `NEXT_PUBLIC_CLAC_FACTORY_ADDRESS`
- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`

Frontend varsayilan port: `3000`

## 3) Kontrat workspace (`hardhat-monad`)

```bash
cd hardhat-monad
cp .env.example .env
npm install
npm run compile
npm run test
```

Deploy komutlari:

```bash
npm run deploy:testnet
npm run deploy:mainnet
```

Detayli deploy/verify adimlari icin: `hardhat-monad/README.md`

## Cevresel Degiskenler (Ozet)

Bu repoda 3 farkli `.env` alani vardir:

- `clack_frontend/.env.example`
- `clacl_backend/.env.example`
- `hardhat-monad/.env.example`

Kontrat adresi degistiginde:

1. `hardhat-monad` deploy ciktilarindan yeni adresi alin
2. `clacl_backend/.env` icindeki `MONAD_CONTRACT_ADDRESS` alanini guncelleyin
3. `clack_frontend/.env.local` icindeki `NEXT_PUBLIC_CLAC_FACTORY_ADDRESS` alanini guncelleyin

## API Ozet (Backend)

Tum endpointler `api` prefix'i ile yayinlanir.

- `GET /api/tokens`
- `GET /api/tokens/:id`
- `GET /api/tokens/:id/trades`
- `GET /api/trades/recent`
- `GET /api/leaderboard`
- `GET /api/portfolio/:address`
- `POST /api/uploads/image` (admin sifresi gerekir)
- `GET /api/admin/tokens` (admin sifresi gerekir)
- `DELETE /api/admin/tokens/:id` (admin sifresi gerekir)

Admin korumali endpointlerde `x-admin-password` header'i beklenir.

## WebSocket Ozet

Namespace: `/ws`  
Yayinlanan temel eventler:

- `tokenCreated`
- `trade`
- `tokenClacced`
- `lotteryWin`
- `ticker`

## Admin Panel

Frontend panel: `/admin`  
Panelde:

- admin sifresi ile giris
- fee/publicCreation ayarlari
- gorsel upload + fee'siz token create akis destegi
- tokenlari listeden sistemden silme

Not: Bu panel operasyonel amaclidir; prod ortamda sifreyi mutlaka env ile degistirin.

## Operasyon ve Go-Live Dokumanlari

Detayli operasyon dokumanlari:

- `docs/operations/OBSERVABILITY_RUNBOOK.md`
- `docs/operations/INCIDENT_RESPONSE_RUNBOOK.md`
- `docs/operations/BACKUP_RESTORE_RUNBOOK.md`
- `docs/operations/GO_NO_GO_EVIDENCE_CHECKLIST.md`

## Sorun Giderme

- **`/api/ready` false donuyor**: Oncelikle PostgreSQL baglantisini ve `DATABASE_URL` degerini kontrol edin.
- **Gorseller gorunmuyor**: `imageURI` mutlak URL mi, `/uploads` servis ediliyor mu, `NEXT_PUBLIC_BACKEND_URL` dogru mu kontrol edin.
- **Trade verisi akmiyor**: `MONAD_RPC_URL`, `MONAD_WS_URL` ve kontrat adresinin guncel oldugunu dogrulayin.
- **Frontend sayilari anlamsiz**: Wei -> MON formatlamasinin bozulmadigindan emin olun; eski cache/socket verisini temizleyip tekrar deneyin.

## Test ve Kalite Kapisi

Frontend:

```bash
cd clack_frontend
npm run lint
npm run build
```

Backend:

```bash
cd clacl_backend
npm run build
npm run test
```

Kontrat:

```bash
cd hardhat-monad
npm run compile
npm run test
```

## Guvenlik Notlari

- `.env` dosyalarini asla commit etmeyin.
- `PRIVATE_KEY`, `ADMIN_PANEL_PASSWORD` ve benzeri secret'lari secret manager uzerinden yonetin.
- Prod'da CORS allowlist ve rate-limit degerlerini hedef trafiige gore sikilastirin.
- Admin endpointlerini reverse proxy + IP allowlist ile kisitlamak tavsiye edilir.

## Lisans

Bu repo su an private/kapali gelistirme amacli kullanilmaktadir.

# clac.fun - Proje Durum ve Akis Raporu

Hazirlayan: Cursor AI Agent  
Tarih: 2026-04-22

## 1) Kisa Ozet

Bu repo 3 ana parcadan olusuyor:

1. `clack_frontend` -> Next.js tabanli web uygulamasi
2. `clacl_backend` -> NestJS + Prisma + Socket.IO API/indexer servisi
3. `hardhat-monad` -> Solidity kontratlari ve deploy araci

Temel tasarim:

- Frontend kullanici islemlerini dogrudan `ClacFactory` kontratina gonderiyor.
- Backend ayni kontrati dinleyip eventleri veritabanina yaziyor.
- Frontend token listeleri, leaderboard, portfolio gibi verileri backend API'den aliyor.
- Canli trade/token eventleri Socket.IO (`/ws`) ile frontend'e akiyor.

## 2) Repo Yapisi

```text
clac.fun/
  clack_frontend/       # Next.js frontend
  clacl_backend/        # NestJS backend + Prisma
  hardhat-monad/        # Solidity + Hardhat + Ignition
```

Not: Kokte tek bir monorepo `package.json` yok; servisler ayri ayri calistiriliyor.

## 3) Frontend (clack_frontend)

### 3.1 Teknoloji ve Giris Noktalari

- Framework: Next.js 16 + React 19
- Web3: Wagmi + Viem + RainbowKit
- API/Realtime: `fetch` + `socket.io-client`
- Ana sayfalar:
  - `src/app/page.tsx`
  - `src/app/token/[id]/page.tsx`
  - `src/app/create/page.tsx`
  - `src/app/portfolio/page.tsx`
  - `src/app/leaderboard/page.tsx`
  - `src/app/bridge/page.tsx`

### 3.2 Onemli Dosyalar

- Env parse/fallback: `src/lib/env.ts`
- Backend API client + socket: `src/lib/api/client.ts`
- Kontrat adresi + ABI: `src/lib/web3/contracts.ts`
- Trade panel (buy/sell islemleri): `src/components/trade-panel.tsx`
- Token create UI: `src/app/create/page.tsx`

### 3.3 Scriptler

- `npm run dev`
- `npm run build`
- `npm run start`
- `npm run lint`
- `npm run smoke:release`

## 4) Backend (clacl_backend)

### 4.1 Teknoloji ve Giris Noktasi

- Framework: NestJS 11
- ORM: Prisma 7 (`@prisma/client`, `@prisma/adapter-pg`)
- Zincir baglantisi: Ethers v6
- Realtime: Socket.IO gateway
- Giris dosyasi: `src/main.ts`
  - Global prefix: `/api`
  - CORS: `origin: '*'`
  - Port: `PORT` yoksa `3001`

### 4.2 Moduller

`src/app.module.ts`:

- `BlockchainModule`
- `TokensModule`
- `TradesModule`
- `LeaderboardModule`
- `PortfolioModule`
- `ScheduleModule.forRoot()`

### 4.3 API Endpoint Ozeti

Global prefix nedeniyle tum endpointler `/api` altinda:

- Tokens:
  - `GET /api/tokens?filter=live|dying|dead|new|hot`
  - `GET /api/tokens/trending`
  - `GET /api/tokens/dying`
  - `GET /api/tokens/:id`
  - `GET /api/tokens/:id/trades?page=1&limit=50`
  - `GET /api/tokens/:id/holders`
  - `GET /api/tokens/:id/lottery`
- Trades:
  - `GET /api/trades/recent?limit=20`
  - `GET /api/trades/winners?limit=10`
- Leaderboard:
  - `GET /api/leaderboard`
  - `GET /api/leaderboard/traders`
- Portfolio:
  - `GET /api/portfolio/:address`
  - `GET /api/portfolio/:address/claims`

### 4.4 WebSocket

Namespace: `/ws`  
Yayilan eventler (`TokensGateway`):

- `tokenCreated`
- `trade`
- `tokenClacced`
- `lotteryWin`
- `ticker`

## 5) Smart Contract (hardhat-monad)

### 5.1 Teknoloji

- Solidity `0.8.28`
- Hardhat 2 + Ignition
- OpenZeppelin contracts

### 5.2 Kontrat

- Ana kontrat: `contracts/ClacFactory.sol`
- Onemli fonksiyonlar:
  - `buy(uint256 tokenId, uint256 minTokens)` (payable)
  - `sell(uint256 tokenId, uint256 tokenAmount, uint256 minMON)`
  - `claim(uint256 tokenId)`
  - `getBuyCost(uint256 tokenId, uint256 tokenAmount)`
  - `getSellQuote(uint256 tokenId, uint256 tokenAmount)`

### 5.3 Deploy Bilgisi

- `ignition/deployments/chain-10143/deployed_addresses.json` dosyasinda:
  - `ClacFactoryModule#ClacFactory = 0x8E6F959838ee38BDDBa43fE29468aa2080fc2043`

## 6) Uctan Uca Veri Akisi

1. Kullanici frontend'de cuzdan baglar (Wagmi/RainbowKit).
2. Buy/Sell/Claim islemleri frontend tarafindan dogrudan kontrata gonderilir.
3. Backend `BlockchainService`, kontrat eventlerini:
   - gecmis bloklardan sync eder (`syncPastEvents`)
   - real-time dinler (`listenToEvents`)
4. Eventler Prisma ile DB'ye yazilir (`Token`, `Trade`, `Holder`, `LotteryWin`, `Claim`, `SyncState`).
5. Frontend liste/leaderboard/portfolio verilerini backend API'den ceker.
6. Frontend canli akisi Socket.IO (`/ws`) ile alir.

## 7) Veri Modeli (Prisma)

`prisma/schema.prisma` model ozeti:

- `Token`
- `Trade`
- `Holder`
- `LotteryWin`
- `Claim`
- `SyncState` (event sync icin kritik)

Not: Datasource provider `postgresql` olarak tanimli.

## 8) Ortam Degiskenleri (Env)

### 8.1 Frontend (ornek: `.env.example`)

- `NEXT_PUBLIC_MONAD_RPC`
- `NEXT_PUBLIC_MONAD_WS`
- `NEXT_PUBLIC_BACKEND_URL`
- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`
- `NEXT_PUBLIC_CLAC_FACTORY_ADDRESS`

### 8.2 Backend

Koddan zorunlu/fiili kullanilanlar:

- `DATABASE_URL`
- `MONAD_CONTRACT_ADDRESS`
- `MONAD_CONTRACT_ADDRESS_MAINNET` (tanimli ama aktif config testnet)
- `PORT` (opsiyonel)

### 8.3 Kritik Tutarlilik

Asagidaki adresler ayni kontrati gostermeli:

- Frontend: `NEXT_PUBLIC_CLAC_FACTORY_ADDRESS`
- Backend: `MONAD_CONTRACT_ADDRESS`
- Hardhat deploy ciktisi: `deployed_addresses.json`

## 9) Son Teknik Durum (Calistirma Kontrolleri)

Bu rapor hazirlanirken alinan son sonuclar:

- Frontend:
  - `npm run lint` -> FAIL (Next eslint parser modulu hatasi)
  - `npm run build` -> FAIL (`next/dist/bin/next` bulunamadi)
  - `npm run smoke:release` -> FAIL (zorunlu env degiskenleri eksik)
- Backend:
  - `npm run build` -> PASS
  - `npm test` -> PASS
- Smart contract:
  - `npx hardhat compile` -> PASS
  - `npm test` -> FAIL (script bilincli olarak `exit 1`)

## 10) Kapanan Kritik Hata (Yapilan Duzeltme)

Alinan production hatasi:

- Prisma `P2021` -> `public.SyncState` tablosu yok
- Sonuc: backend startup sirasinda `BlockchainService.syncPastEvents` asamasinda crash

Uygulanan cozum:

- `clacl_backend/package.json` icine eklendi:
  - `prisma:generate`
  - `prisma:push`
- `start:prod` scripti guncellendi:
  - once `npm run prisma:push`
  - sonra Nest app baslatiliyor

Boylece deploy sirasinda schema DB'ye itilerek eksik tablo riski azaltildi.

## 11) Mevcut Riskler ve Teknik Borclar

1. Frontend build/lint zinciri su an kirik (CI/release riski).
2. `create` sayfasi (`src/app/create/page.tsx`) su an kontrata token olusturma cagrisi yapmiyor (yalnizca UI/stub).
3. Trade panelde buy quote parametresi ile kontrat `getBuyCost` beklentisi arasinda birim uyusmazligi riski var.
4. `next.config.mjs` icinde `typescript.ignoreBuildErrors: true` acik.
5. Backend env'de kontrat adresi basinda bosluk olma riski (adres parse hatasi uretebilir).
6. CORS wildcard (`*`) production icin guvenlik acisindan fazla genis.
7. Hardhat `npm test` scripti gercek test kosmuyor.

## 12) AI'dan Oneri Almak Icin Hazir Promptlar

Asagidaki promptlari bu dosyayla birlikte diger AI aracina verebilirsin:

1. "Bu mimariyi baz alarak production-ready deployment plani cikar. Ozellikle frontend build kirikligi, prisma migration strategy ve websocket olcekleme stratejisi uzerine odaklan."
2. "Ayni repo icin 30-60-90 gunluk teknik borc azaltma plani olustur. Oncelikleri risk/etki/maliyet matrisi ile puanla."
3. "Trade panelde buy/sell quote hesaplamalarini kontrat ABI beklentisiyle karsilastir, birim uyusmazligi varsa kod duzeltme oner."
4. "NestJS + Prisma + blockchain indexer yapisini event replay, reorg handling, idempotency ve backfill acilarindan review et."
5. "Frontend ve backend icin minimum ama etkili test stratejisi oner (unit + integration + e2e + smoke), ornek test dosya agaci ver."

## 13) Hedeflenen Son Durum (Definition of Done)

1. Frontend `lint` ve `build` temiz geciyor.
2. Backend production startup'ta Prisma tablo hatasi vermiyor.
3. `create token` akisi zincire gercek cagrilarla tamamlanmis.
4. `buy/sell` quote ve gercek tx sonuclari uyumlu.
5. Ortam degiskenleri ve kontrat adresleri tek kaynaktan yonetiliyor.
6. CI pipeline'da frontend/backend/contract kontrolleri otomatik.

---

Bu rapor "mevcut kod + son calistirma ciktilari" temelinde hazirlanmistir.  
Canli ortamda (Render vb.) farkli env/deploy ayarlari ek risk olusturabilir; deployment YAML/servis ayarlari da ayrica review edilmelidir.


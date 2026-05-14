# clac.fun — Detaylı Sistem Analizi

> **Tarih:** 14 Mayıs 2026  
> **Sürüm:** V2 (ClacFactoryV2 + ClacTokenImpl)  
> **Blockchain:** Monad Testnet (10143) / Mainnet (143)

---

## İÇİNDEKİLER

1. [Proje Özeti](#1-proje-özeti)
2. [Sistem Mimarisi](#2-sistem-mimarisi)
3. [Smart Contract Yapısı](#3-smart-contract-yapısı)
4. [Bonding Curve Matematiği](#4-bonding-curve-matematiği)
5. [Kullanıcı Akışları](#5-kullanıcı-akışları)
6. [Backend API](#6-backend-api)
7. [Frontend Uygulaması](#7-frontend-uygulaması)
8. [Blockchain Entegrasyonu](#8-blockchain-entegrasyonu)
9. [Fee & Komisyon Mekanizması](#9-fee--komisyon-mekanizması)
10. [Güvenlik Hususları](#10-güvenlik-hususları)
11. [Database Şeması](#11-database-şeması)
12. [WebSocket Akışı](#12-websocket-akışı)
13. [Deployment & Konfigürasyon](#13-deployment--konfigürasyon)
14. [Teknik Borç & Riskler](#14-teknik-borç--riskler)
15. [Önemli Dosyalar Haritası](#15-önemli-dosyalar-haritası)

---

## 1. Proje Özeti

**clac.fun**, Monad blockchain üzerinde çalışan **bonding curve tabanlı, zaman sınırlı memecoin launchpad** platformudur.

### Temel Konsept

Her token bir **"ölüm saati"** ile yaratılır:

| Süre | Açıklama |
|------|----------|
| 6H   | Çok agresif, yüksek risk/ödül |
| 12H  | Standart |
| 24H  | Daha uzun trading window |

Süre bitince token **"clac"** olur (ölür) ve havuzdaki MON:
- %3 → Treasury (Death Tax)
- %77 → Tüm holderlara pro-rata dağıtılır
- %20 → 3 rastgele kazanana lottery (Pyth Entropy ile)

---

## 2. Sistem Mimarisi

```
┌─────────────────────────────────────────────────────────┐
│                    KULLANICI                             │
│                  (Browser)                               │
└─────────────┬───────────────────────────┬───────────────┘
              │ HTTP/REST                 │ Socket.IO
              │                          │
┌─────────────▼──────────────────────────▼───────────────┐
│              FRONTEND (Next.js 16 + React 19)           │
│                                                          │
│  Pages: Home, Create, Token Detail, Leaderboard,         │
│         Portfolio, Admin                                 │
│                                                          │
│  Web3: Wagmi + RainbowKit + Viem                         │
└─────────────┬───────────────────────────┬───────────────┘
              │ REST API                  │ WebSocket
              │ (fetch)                   │ (Socket.IO)
┌─────────────▼──────────────────────────▼───────────────┐
│              BACKEND (NestJS 11 + Prisma 7)             │
│                                                          │
│  Modules: TokenV2, TradeV2, Leaderboard,                 │
│           Portfolio, Admin, Upload, Health               │
│                                                          │
│  Blockchain Indexer (BlockchainV2Service)                │
│  - WebSocket → Monad RPC                                │
│  - Event listening: Trade, Death, Claim                  │
│  - Sync state: SyncStateV2                              │
└─────────────┬───────────────────────────┬───────────────┘
              │ ethers.js / viem          │ Prisma ORM
              │                          │
┌─────────────▼───────────┐  ┌──────────▼──────────────── ┐
│  MONAD BLOCKCHAIN       │  │  PostgreSQL Database        │
│                         │  │                             │
│  ClacFactoryV2          │  │  TokenV2, TradeV2,          │
│  ClacTokenImpl (clone)  │  │  HolderV2, LotteryWinV2,   │
│  BondingCurve library   │  │  ClaimV2, SyncStateV2       │
│  Pyth Entropy           │  │                             │
└─────────────────────────┘  └─────────────────────────────┘
```

### Teknoloji Stack

| Katman | Teknoloji |
|--------|-----------|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS |
| Web3 | Wagmi, RainbowKit, Viem |
| Real-time | Socket.IO Client |
| Backend | NestJS 11, TypeScript |
| ORM | Prisma 7 |
| Database | PostgreSQL |
| Blockchain lib | Ethers.js v6, Viem |
| Smart Contract | Solidity 0.8.28, OpenZeppelin |
| Deploy Tool | Hardhat + Hardhat Ignition |
| Randomness | Pyth Entropy |
| Image Storage | Cloudinary |
| Wallet | WalletConnect v2, MetaMask |

---

## 3. Smart Contract Yapısı

### 3.1 Kontrat Hiyerarşisi

```
ClacFactoryV2.sol  (ana factory)
│
├── ClacTokenImpl.sol  ← her token = minimal proxy clone
│   ├── ReentrancyGuard (OpenZeppelin)
│   └── BondingCurve library (internal)
│
└── BondingCurve.sol  (fiyatlama kütüphanesi)
```

Ayrıca V1 kontratı:
```
ClacFactory.sol  (eski versiyon, tüm logic tek kontrat)
```

---

### 3.2 ClacFactoryV2.sol

**Pattern:** EIP-1167 Minimal Proxy (Clone Factory)

Her `createToken()` çağrısında yeni bir clone deploy edilir. Bu sayede:
- Her token bağımsız bir kontrat adresine sahip
- Gas maliyeti çok düşük (full bytecode yerine minimal proxy)
- Token adresi = benzersiz identifier

**Ana Fonksiyonlar:**

```solidity
function createToken(
    string memory name,
    string memory symbol,
    string memory imageURI,
    uint256 duration,
    uint256 minInitialTokens    // slippage koruması için
) external payable returns (address token)
```

**Factory Storage:**
```solidity
address public implementation;      // ClacTokenImpl adresi
address public treasury;            // fee receiver
uint256 public defaultK;            // bonding curve parametresi
uint256 public creationFee;         // default: 10 MON
bool   public publicCreation;       // herkes yaratabilir mi?
address[] public allTokens;         // tüm token adresleri
```

**Deploy Adresi (Testnet):**
```
Factory:  0x4093a7D5624B854A0f5cBBbD0b751a1aCe8049eD
Treasury: 0x94C0Eed75bD91684621D0b8464e289356E95A3EF
```

---

### 3.3 ClacTokenImpl.sol

**Her token clone kontratı bu implementation'ı proxy'ler.**

#### Sabitler (Constants)

| Sabit | Değer | Açıklama |
|-------|-------|----------|
| `PROTOCOL_FEE_BPS` | 100 | 1% — her trade'den treasury'e |
| `CREATOR_FEE_BPS` | 50 | 0.5% — her trade'den yaratıcıya |
| `DEATH_TAX_BPS` | 300 | 3% — havuzdan death tax |
| `PRO_RATA_BPS` | 7700 | 77% — pro-rata dağıtım |
| `LOTTERY_BPS` | 2000 | 20% — lottery ödülü |
| `LOTTERY_WINNERS` | 3 | kaç kişi kazanır |
| `DEATH_TRIGGER_BONUS` | 0.1 MON | ölümü tetikleyen kişiye bonus |
| `MAX_HOLDING_BPS` | 1000 | max %10 — tek wallet'ta |
| `MAX_INITIAL_BUY_BPS` | 7931 | creator initial buy cap ~%79.31 |
| `SNIPER_WINDOW` | 30 saniye | anti-sniper koruma süresi |
| `SNIPER_MAX_BPS` | 100 | sniper window'da max %1 |
| `CLAIM_DEADLINE` | 30 gün | claim edebilme süresi |

#### Initialization

```solidity
function initialize(
    address _creator,
    string memory _name,
    string memory _symbol,
    string memory _imageURI,
    uint256 _duration,       // saniye cinsinden (6*3600, 12*3600, 24*3600)
    uint256 _k,              // bonding curve K parametresi
    address _treasury,
    address _randomnessProvider,
    address _trophyNFT,
    uint256 minInitialTokens // initial buy için min token miktarı
) external payable
```

İlk çağrıda creator isteğe bağlı olarak `msg.value` ile atomik initial buy yapabilir.

#### Trading Fonksiyonları

```solidity
// MON gönder, token al
function buy(uint256 minTokens) external payable

// Token sat, MON al
function sell(uint256 tokenAmount, uint256 minMON) external
```

**Buy akışı:**
1. Fee hesaplamaları (protocol + creator)
2. Net MON ile bonding curve'den kaç token hesaplanır
3. Slippage kontrolü: `tokens >= minTokens`
4. Anti-sniper + whale limit kontrolleri
5. Balance ve lottery weight güncellenir
6. `Trade` event emit

**Sell akışı:**
1. Balance kontrolü
2. Bonding curve'den MON hesaplanır
3. Pool balance'ı aşamaz (capped)
4. Fees düşülür
5. Last hour ise sell yasağı yoktur ama lottery weight azalır
6. `Trade` event emit

#### Death Fonksiyonları

```solidity
// Adım 1: Ölüm başlat (herkes çağırabilir, block.timestamp >= deathTime)
function requestDeath() external payable
// msg.value = Pyth entropy fee

// Adım 2: Pyth callback (sadece randomnessProvider çağırabilir)
function onReceiveRandomness(bytes32 randomness) external

// Adım 3: Holder'lar kendi paylarını çeker
function claim() external
```

**requestDeath() sırası:**
1. `block.timestamp >= deathTime` kontrolü
2. Pyth Entropy'den randomness istemek için fee gönderilir
3. `deathRequested = true`
4. `DeathRequested` event emit

**onReceiveRandomness() sırası:**
1. Sadece `randomnessProvider` çağırabilir
2. Pool'dan %3 death tax kesilir → treasury
3. Kalan pool = proRataPool + lotteryPool
4. 3 winner belirlenir (weighted random, lottery weight'e göre)
5. `deathFinalized = true`
6. `DeathFinalized` event emit

**claim() sırası:**
1. `deathFinalized == true` kontrolü
2. 30 gün deadline kontrolü
3. Pro-rata hesabı: `balance * proRataPool / totalSupplySnapshot`
4. Lottery kontrolü: winner ise `lotteryShare` eklenir
5. MON transfer
6. Trophy NFT mint (opsiyonel)

#### Storage Yapısı

```solidity
// Token metadata
address public creator;
string  public name;
string  public symbol;
string  public imageURI;
uint256 public deathTime;
uint256 public k;           // bonding curve parametresi (lock'lı)

// Trading state
uint256 public virtualSupply;   // mevcut token miktarı
uint256 public poolBalance;     // havuzdaki MON (native)

// Holder tracking
mapping(address => uint256) public balances;
address[] internal _holders;
mapping(address => bool)    internal _isHolder;

// Lottery tracking
mapping(address => uint256) public lotteryWeight;
uint256 public totalLotteryWeight;

// Death state
bool    public deathRequested;
bool    public deathFinalized;
address public deathRequestedBy;
uint256 public proRataPool;
uint256 public lotteryPool;
uint256 public lotteryShare;       // her winner'a düşen
uint256 public totalSupplySnapshot; // ölüm anındaki total supply
address[3] public lotteryWinners;

// Fee pending
mapping(address => uint256) public pendingFees;

// Anti-bot
mapping(address => uint256) public lastBuyBlock;
uint256 public launchBlock;
```

---

### 3.4 BondingCurve Library

**Fiyat Formülü:**

```
price(supply) = K × √(supply)
```

**Integral (maliyet/gelir hesabı):**

```
integral(x) = (2/3) × x^(3/2)
```

**Buy maliyeti:**
```
cost = K × [integral(newSupply) - integral(currentSupply)]
     = K × (2/3) × [newSupply^(3/2) - currentSupply^(3/2)]
```

**Sell geliri (aynı formül ters):**
```
revenue = K × (2/3) × [currentSupply^(3/2) - newSupply^(3/2)]
```

**Precision:** Tüm hesaplar `1e18` fixed-point ile yapılır.

**K Değeri:**
- Default testnet K: `10_000_000_000`
- Token deploy anında lock'lanır, sonradan değiştirilemez
- Farklı K değerleri → farklı başlangıç fiyatları ve eğri dikliği

---

## 4. Bonding Curve Matematiği

### Fiyat Eğrisi Özellikleri

- **Supply artışı → fiyat artar** (karekök ilişkisi)
- **Supply azalması → fiyat düşer**
- **Buy'lar pahalılaşır**, sell'ler ucuzlar
- İlk alımlar ucuz, sonraki alımlar daha pahalı

### Fiyat Örneği (K=10^10)

| Supply (token) | Price (MON) |
|---------------|-------------|
| 1,000         | 0.00316... |
| 10,000        | 0.01       |
| 100,000       | 0.0316...  |
| 1,000,000     | 0.1        |

### Pool Balance Dinamiği

Pool balance = toplam buy MON - toplam sell MON - toplam fee

Satışlar pool'dan yapılır. Pool tükenirse satış olsa bile pool sıfırda kalır (revert olmaz).

---

## 5. Kullanıcı Akışları

### 5.1 Token Oluşturma

```
Kullanıcı
  │
  ├─── /create sayfasını açar
  │
  ├─── Form doldurur:
  │     ├── Token Name (max 32 karakter)
  │     ├── Symbol (max 8 karakter, alfanümerik)
  │     ├── Resim yükle (JPEG/PNG/GIF/WEBP, max 5MB)
  │     ├── Süre seç (6H / 12H / 24H)
  │     ├── [Opsiyonel] Initial Buy (MON miktarı)
  │     └── [Opsiyonel] Sosyal linkler (Twitter, Telegram, Website)
  │
  ├─── Frontend validasyonları:
  │     ├── Cüzdan bağlı mı?
  │     ├── Doğru chain mi? (Monad Testnet 10143)
  │     └── Form alanları geçerli mi?
  │
  ├─── Resim upload: POST /api/upload/image → Cloudinary
  │     Response: { url: "https://res.cloudinary.com/..." }
  │
  ├─── createToken() transaction imzalanır:
  │     args: [name, symbol, imageURI, duration, minInitialTokens]
  │     value: creationFee + initialBuyAmount (MON)
  │
  ├─── Smart Contract (ClacFactoryV2):
  │     ├── creationFee → treasury
  │     ├── Clone deploy (EIP-1167)
  │     ├── clone.initialize() çağrılır
  │     ├── Eğer msg.value > creationFee → atomik ilk alım yapılır
  │     └── TokenCreated event emit
  │
  ├─── Frontend receipt bekler:
  │     └── Event log'dan token adresi decode edilir
  │
  ├─── Sosyal bilgiler varsa:
  │     └── PATCH /api/v2/tokens/:address/socials
  │
  └─── /token/[address] sayfasına yönlendirilir
```

### 5.2 Token Satın Alma (Buy)

```
Kullanıcı → Token Detay Sayfası
  │
  ├─── "Buy" sekmesi
  ├─── MON miktarı girer
  │
  ├─── Frontend hesaplar:
  │     ├── Estimated tokens (bonding curve read call)
  │     ├── Slippage tolerance uygulanır (%1-5)
  │     └── minTokens = estimated × (1 - slippage)
  │
  ├─── buy(minTokens) transaction:
  │     value: girilen MON miktarı
  │
  ├─── Smart Contract:
  │     ├── Protocol fee = value × 1% → pending treasury
  │     ├── Creator fee = value × 0.5% → pending creator
  │     ├── Net = value × 98.5%
  │     ├── Bonding curve hesabı: kaç token alınabilir?
  │     ├── minTokens kontrolü (slippage)
  │     ├── Anti-sniper: ilk 30 saniye max %1 supply
  │     ├── Whale limit: toplam balance max %10 supply
  │     ├── balances güncellenir
  │     ├── poolBalance artar
  │     ├── virtualSupply artar
  │     ├── Eğer last hour değilse → lotteryWeight artar
  │     └── Trade event emit
  │
  ├─── Backend (event listener):
  │     ├── Trade kaydı oluşturur
  │     ├── HolderV2 balance güncellenir
  │     ├── lotteryWeight güncellenir
  │     └── Socket.IO ile broadcast
  │
  └─── Frontend UI gerçek zamanlı güncellenir
```

### 5.3 Token Satma (Sell)

```
Kullanıcı → Token Detay Sayfası → "Sell" sekmesi
  │
  ├─── Satmak istediği token miktarını girer
  │
  ├─── Frontend hesaplar:
  │     ├── Estimated MON (bonding curve read)
  │     ├── Fee kesintileri
  │     └── minMON = estimated net × (1 - slippage)
  │
  ├─── sell(tokenAmount, minMON) transaction
  │
  ├─── Smart Contract:
  │     ├── Balance yeterli mi?
  │     ├── Son 1 saat değilse sell serbest
  │     │   [Son 1 saatte sell hâlâ açık ama lottery weight azalır]
  │     ├── Revenue = bonding curve geliri
  │     ├── Revenue = min(revenue, poolBalance) [pool tükenmesi koruması]
  │     ├── Protocol fee + creator fee düşülür
  │     ├── Net MON kullanıcıya gönderilir
  │     ├── virtualSupply azalır
  │     ├── poolBalance azalır
  │     ├── balances azalır
  │     ├── lotteryWeight azalır (sell oranında)
  │     └── Trade event emit
  │
  └─── Backend + Frontend güncellenir
```

### 5.4 Token Ölüm Akışı (Death Flow)

```
deathTime geçer (block.timestamp >= deathTime)
  │
  ├─── Herhangi biri requestDeath() çağırır:
  │     value: Pyth Entropy fee (dinamik, küçük miktar)
  │     ├─── deathRequested = true
  │     ├─── Pyth Entropy'e randomness isteği gönderilir
  │     └─── DeathRequested event emit
  │
  ├─── Pyth callback (saniyeler-dakikalar içinde):
  │     onReceiveRandomness(bytes32 randomness)
  │     │
  │     ├─── Pool'dan %3 death tax → treasury pending
  │     ├─── Kalan = proRataPool + lotteryPool:
  │     │     ├─── proRataPool = kalan × 77%
  │     │     └─── lotteryPool = kalan × 20%
  │     │
  │     ├─── totalSupplySnapshot = virtualSupply (ölüm anındaki supply)
  │     │
  │     ├─── 3 lottery winner seçilir (weighted random):
  │     │     ├─── Ağırlık: lotteryWeight per holder
  │     │     ├─── Min weight threshold: totalLotteryWeight × 0.1%
  │     │     └─── Randomness: Pyth'ten gelen bytes32
  │     │
  │     ├─── lotteryShare = lotteryPool / 3
  │     ├─── deathFinalized = true
  │     └─── DeathFinalized event emit
  │
  ├─── Her holder claim() çağırabilir:
  │     ├─── Deadline: deathFinalized + 30 gün
  │     ├─── proRata = balance × proRataPool / totalSupplySnapshot
  │     ├─── Eğer winner ise + lotteryShare
  │     ├─── Toplam MON transfer edilir
  │     ├─── [Opsiyonel] Trophy NFT mint
  │     └─── Claimed event emit
  │
  └─── 30 gün sonra: unclaimed → treasury (sweep)
```

### 5.5 Admin Akışı

```
/admin sayfası
  │
  ├─── ADMIN_PANEL_PASSWORD girişi (header: x-admin-password)
  │
  ├─── Yapabilecekleri:
  │     ├─── Token listesi görüntüleme (V1 + V2)
  │     ├─── Token silme (DB + Cloudinary cleanup)
  │     ├─── Resim yükleme (token için)
  │     ├─── Creation fee güncelleme
  │     ├─── publicCreation toggle
  │     └─── Protocol/creator fee BPS güncelleme
  │
  └─── Tüm admin endpoint'leri x-admin-password header doğrulaması
```

### 5.6 Portfolio Akışı

```
/portfolio/[address]
  │
  ├─── GET /api/portfolio/:address
  │     ├─── Holdings: aktif token bakiyeleri
  │     ├─── Trade history: yapılan alım/satımlar
  │     ├─── Claim history: çekilen ödemeler
  │     └─── Lottery wins: kazanılan lottery'ler
  │
  └─── Ölü tokenlarda claim butonu gösterilir
```

### 5.7 Leaderboard Akışı

```
/leaderboard
  │
  ├─── GET /api/leaderboard
  │     └─── Top 50 token (marketCap'e göre sıralı)
  │
  └─── Token kartlarına tıklanınca /token/[address]'e gidilir
```

---

## 6. Backend API

### 6.1 Endpoint Listesi

**Base URL:** `https://clac.fun/api` (prod) / `http://localhost:3001/api` (dev)

#### V2 Token Endpoints

| Method | Path | Açıklama |
|--------|------|----------|
| GET | `/v2/tokens` | Token listesi (filtre: live, dying, dead, new, hot) |
| GET | `/v2/tokens/:idOrSlug` | Token detayı (adres veya slug) |
| GET | `/v2/tokens/:address/holders` | Top 250 holder (balance desc) |
| GET | `/v2/tokens/:address/trades` | Son 50 trade |
| GET | `/v2/tokens/:address/lottery` | Lottery sonuçları |
| GET | `/v2/tokens/:address/claims` | Claim kayıtları |
| PATCH | `/v2/tokens/:address/socials` | Sosyal linkleri güncelle |

#### Global Feed

| Method | Path | Açıklama |
|--------|------|----------|
| GET | `/trades/recent` | Son trades (tüm tokenlar) |
| GET | `/leaderboard` | Top 50 token (marketCap sırası) |
| GET | `/portfolio/:address` | Kullanıcı holdings/trades/claims |

#### Admin (x-admin-password header zorunlu)

| Method | Path | Açıklama |
|--------|------|----------|
| GET | `/admin/tokens` | V1 token listesi |
| GET | `/admin/v2/tokens` | V2 token listesi |
| DELETE | `/admin/tokens/:id` | V1 token sil |
| DELETE | `/admin/v2/tokens/:address` | V2 token sil |

#### Upload

| Method | Path | Açıklama |
|--------|------|----------|
| POST | `/upload/image` | Dosya yükle (multipart) → Cloudinary |
| POST | `/upload/image-url` | URL'den yükle → Cloudinary |

#### Health

| Method | Path | Açıklama |
|--------|------|----------|
| GET | `/health` | Liveness probe |
| GET | `/ready` | Readiness (DB + RPC + sync kontrolü) |

---

### 6.2 Blockchain Indexer (BlockchainV2Service)

**Çalışma Prensibi:**

```
Startup:
  ├── PostgreSQL bağlantısı
  ├── Monad WebSocket RPC bağlantısı
  ├── SyncStateV2 yüklenir (son işlenen block)
  ├── Eğer chain/factory değişmişse → tüm V2 tabloları silinir
  └── Backfill: son N blok geriye taranır (default: 5000)

Live Listening:
  ├── Factory'den TokenCreated event'leri dinlenir
  └── Her token için Trade, Death, Claim event'leri dinlenir

Event İşleme:
  ├── TokenCreated  → TokenV2 kaydı oluştur + yeni token listener başlat
  ├── Trade         → TradeV2 kaydet, HolderV2 güncelle
  ├── DeathRequested → deathRequested flag set
  ├── DeathFinalized → winners kaydet, pool dağılımı kaydet
  └── Claimed        → ClaimV2 kaydı
```

**Sync Parametreleri:**

| Env Variable | Default | Açıklama |
|-------------|---------|----------|
| `MONAD_FINALITY_BLOCKS` | 3 | Blok kesinleşme marjı |
| `MONAD_REPLAY_BLOCKS` | 20 | Reorg koruması |
| `MONAD_INITIAL_BACKFILL_BLOCKS` | 5000 | Startup'ta geriye tarama |
| `MONAD_MAX_LOG_RANGE` | 100 | RPC call başına max log aralığı |

---

## 7. Frontend Uygulaması

### 7.1 Sayfa Yapısı

```
/                    → Home (live ticker, winners, trending, token grid)
/create              → Token oluşturma formu
/token/[id]          → Token detay (chart, trade paneli, holders, history)
/leaderboard         → Tüm tokenların sıralaması
/portfolio/[address] → Kullanıcının holdings/trades/claims
/admin               → Admin paneli
```

### 7.2 Token Detay Sayfası

URL formatları:
- V2: `/token/0x4093a7...` (tam adres)
- V2: `/token/v2-some-slug` (slug)
- V1: `/token/42` (sayısal ID)

İçerik:
- Fiyat grafiği (trade history'den)
- Buy/Sell paneli
- Death clock countdown
- Holder listesi
- Trade geçmişi
- Lottery durumu

### 7.3 Cüzdan Bağlantısı

**RainbowKit** ile cüzdan modal:
- MetaMask, WalletConnect, Coinbase Wallet ve daha fazlası
- Chain: Monad Testnet (10143), Mainnet (143)

**Chain Switch:**
- Kullanıcı yanlış chain'deyse otomatik switch uyarısı
- Transaction öncesi chain doğrulama

### 7.4 Real-time Updates

Socket.IO (`/ws-v2` namespace):
- `tokenCreated` → yeni token göster
- `trade` → fiyat/supply güncelle
- `deathRequested` → death banner göster
- `deathFinalized` → winners reveal, claim butonu aktif et

---

## 8. Blockchain Entegrasyonu

### 8.1 RPC Endpoints

| Network | RPC | WS | Chain ID |
|---------|-----|----|---------|
| Monad Testnet | `https://testnet-rpc.monad.xyz` | `wss://testnet-rpc.monad.xyz` | 10143 |
| Monad Mainnet | `https://rpc.monad.xyz` | `wss://rpc.monad.xyz` | 143 |

### 8.2 Viem Contract Interactions

**Factory read:**
```typescript
useReadContract({
  address: CLAC_FACTORY_V2_ADDRESS,
  abi: CLAC_FACTORY_V2_ABI,
  functionName: 'creationFee' | 'defaultK' | 'publicCreation'
})
```

**Token read:**
```typescript
useReadContract({
  address: tokenAddress,
  abi: CLAC_TOKEN_V2_ABI,
  functionName: 'buy' | 'sell' | 'balances' | 'lotteryWeight' | ...
})
```

**Write (transaction):**
```typescript
writeContract({
  address: CLAC_FACTORY_V2_ADDRESS,
  abi: CLAC_FACTORY_V2_ABI,
  functionName: 'createToken',
  args: [name, symbol, imageURI, duration, minInitialTokens],
  value: totalValue  // creationFee + initialBuy
})
```

### 8.3 Event Decoding

```typescript
import { decodeEventLog } from 'viem'

const decoded = decodeEventLog({
  abi: CLAC_FACTORY_V2_ABI,
  data: log.data,
  topics: log.topics
})
// decoded.args.token = yeni token adresi
```

---

## 9. Fee & Komisyon Mekanizması

### 9.1 Trade Bazlı Ücretler

Her alım/satımda:

```
Kullanıcı → [brüt amount]
           ├── Protocol Fee (1%)  → Treasury pending
           ├── Creator Fee (0.5%) → Creator pending
           └── Net Amount (%98.5) → Bonding curve
```

### 9.2 Token Ölüm Dağılımı

```
Pool Balance (ölüm anında)
  ├── %3  Death Tax          → Treasury
  └── %97 Remaining Pool
         ├── %77 Pro-Rata    → Tüm holderlara (balance oranında)
         └── %20 Lottery     → 3 random winner (lotteryWeight oranında)
```

### 9.3 Yaratma Ücreti

```
createToken() → msg.value
  ├── creationFee (default: 10 MON) → Treasury
  └── Kalan → atomik initial buy (opsiyonel)
```

### 9.4 Fee Çekme (Pull Pattern)

Creator ve treasury biriken fee'leri manuel çeker:
```solidity
function withdrawFees() external
// pendingFees[msg.sender] → msg.sender'a transfer
```

### 9.5 Gelir Özeti (Platform)

| Kaynak | Oran | Alıcı |
|--------|------|-------|
| Her trade protocol fee | %1 | Treasury |
| Token creation | 10 MON sabit | Treasury |
| Death tax | %3 (pool'dan) | Treasury |
| Claim deadline sonrası | unclaimed | Treasury (sweep) |
| **Creator geliri** | **%0.5** | Token creator |

---

## 10. Güvenlik Hususları

### 10.1 Smart Contract Güvenliği

| Mekanizma | Uygulama |
|-----------|----------|
| Reentrancy koruması | OpenZeppelin `ReentrancyGuard` tüm state-changing fonksiyonlarda |
| Integer overflow | Solidity 0.8.28 (built-in checked math) |
| Pool draining | Sell revenue `min(revenue, poolBalance)` ile sınırlı |
| Anti-sniper | İlk 30 saniye max %1 per wallet |
| Whale limit | Max %10 supply per wallet (post-launch) |
| Ownership | 2-step ownership transfer (Ownable2Step) |
| Randomness | Pyth Entropy (external, verifiable randomness) |

### 10.2 Backend Güvenliği

| Mekanizma | Uygulama |
|-----------|----------|
| Admin auth | `x-admin-password` header doğrulaması |
| Rate limiting | 120 req/60s per IP (Throttler) |
| WS connection limit | Max 5 per IP |
| Helmet middleware | HTTP security headers |
| Input validation | class-validator DTOs |
| Idempotency | `(txHash, logIndex)` unique constraint |

### 10.3 Frontend Güvenliği

- Private key yok — wallet extension imzalar
- HTTPS (prod)
- CORS backend'de yapılandırılmış
- RPC URL env'den (hardcode değil)

### 10.4 Operasyonel Güvenlik

- Private key asla commit edilmez
- Admin password asla commit edilmez
- Cloudinary credentials env'de
- Factory address env'den (değiştirilebilir)

---

## 11. Database Şeması

### V2 Ana Tablolar

```prisma
model TokenV2 {
  address            String      @id           // clone contract adresi
  factoryAddress     String
  creator            String
  name               String
  symbol             String
  imageURI           String
  k                  BigInt                    // bonding curve K (lock'lı)
  duration           Int                       // saniye
  createdAt          DateTime
  deathTime          DateTime
  virtualSupply      BigInt
  poolBalance        BigInt
  totalHolders       Int
  totalLotteryWeight BigInt
  marketCap          BigInt
  currentPrice       BigInt
  volume24h          BigInt
  change24h          Float
  deathRequested     Boolean     @default(false)
  deathFinalized     Boolean     @default(false)
  deathRequestedBy   String?
  deathRequestedAt   DateTime?
  proRataPool        BigInt?
  lotteryPool        BigInt?
  lotteryShare       BigInt?
  totalSupplySnapshot BigInt?
  lotteryWinners     Json?                     // address[3]
  swept              Boolean     @default(false)
  slug               String?     @unique
  description        String?
  website            String?
  twitter            String?
  telegram           String?
  trades             TradeV2[]
  holders            HolderV2[]
  lotteryWins        LotteryWinV2[]
  claims             ClaimV2[]
}

model TradeV2 {
  id           Int      @id @default(autoincrement())
  tokenAddress String
  trader       String
  isBuy        Boolean
  tokenAmount  BigInt
  monAmount    BigInt
  protocolFee  BigInt
  creatorFee   BigInt
  newSupply    BigInt
  newPrice     BigInt
  txHash       String
  logIndex     Int
  blockNumber  BigInt
  timestamp    DateTime
  token        TokenV2  @relation(...)
  @@unique([txHash, logIndex])              // idempotency
}

model HolderV2 {
  id            Int    @id @default(autoincrement())
  tokenAddress  String
  address       String
  balance       BigInt
  lotteryWeight BigInt
  @@unique([tokenAddress, address])
}

model LotteryWinV2 {
  id           Int    @id @default(autoincrement())
  tokenAddress String
  winner       String
  amount       BigInt
  txHash       String
}

model ClaimV2 {
  id             Int    @id @default(autoincrement())
  tokenAddress   String
  holder         String
  proRataAmount  BigInt
  lotteryAmount  BigInt
  txHash         String @unique
  claimedAt      DateTime
}

model SyncStateV2 {
  id             Int    @id @default(1)
  lastBlockNumber BigInt
  chainId        Int
  factoryAddress String
}
```

---

## 12. WebSocket Akışı

**Namespace:** `/ws-v2`  
**Connection limit:** 5 per IP

### Frontend → Sunucu

```typescript
socket.connect()
socket.on('tokenCreated', ({ tokenAddress }) => { ... })
socket.on('trade', ({ tokenAddress, trader, isBuy, ... }) => { ... })
socket.on('deathRequested', ({ tokenAddress, requestedBy, ... }) => { ... })
socket.on('deathFinalized', ({ tokenAddress, proRataPool, lotteryPool, winners }) => { ... })
```

### Backend Emit Sırası

```
Blockchain Event
  └── BlockchainV2Service handler
        └── DB güncellenir
              └── SocketGateway.emit*(...)
                    └── Tüm bağlı clientlara yayın
```

---

## 13. Deployment & Konfigürasyon

### 13.1 Smart Contract Deployment

```bash
# Testnet
npx hardhat ignition deploy --network monadTestnet \
  --parameters ignition/parameters/testnet-v2.json

# Mainnet
npx hardhat ignition deploy --network monadMainnet \
  --parameters ignition/parameters/mainnet-v2.json
```

**Deployment Parametreleri (testnet-v2.json):**
```json
{
  "ClacDeployV2": {
    "treasuryAddress": "0x94C0Eed75bD91684621D0b8464e289356E95A3EF",
    "defaultK": "10000000000",
    "pythEntropyAddress": "0x36825bf3Fbdf5a29E2d5148bfe7Dcf7B5639e320",
    "pythProviderAddress": "0x6CC14824Ea2918f5De5C2f75A9Da968ad4BD6344"
  }
}
```

### 13.2 Backend .env

```env
DATABASE_URL=postgresql://user:pass@localhost:5432/clacdb
MONAD_NETWORK=testnet
MONAD_RPC_URL=https://testnet-rpc.monad.xyz
MONAD_WS_URL=wss://testnet-rpc.monad.xyz
MONAD_FACTORY_ADDRESS=0x...
MONAD_FACTORY_ADDRESS_MAINNET=0x...
ADMIN_PANEL_PASSWORD=<güçlü şifre>
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
RATE_LIMIT_TTL_MS=60000
RATE_LIMIT_MAX=120
WS_MAX_CONNECTIONS_PER_IP=5
MONAD_FINALITY_BLOCKS=3
MONAD_REPLAY_BLOCKS=20
MONAD_INITIAL_BACKFILL_BLOCKS=5000
MONAD_MAX_LOG_RANGE=100
```

### 13.3 Frontend .env.local

```env
NEXT_PUBLIC_MONAD_RPC=https://testnet-rpc.monad.xyz
NEXT_PUBLIC_MONAD_WS=wss://testnet-rpc.monad.xyz
NEXT_PUBLIC_BACKEND_URL=https://clac.fun
NEXT_PUBLIC_FACTORY_ADDRESS=0x...
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=...
```

---

## 14. Teknik Borç & Riskler

### 14.1 Yüksek Risk

| Risk | Açıklama | Önlem |
|------|----------|-------|
| Pyth Entropy bağımlılığı | Death finalize için Pyth gerekli; downtime → token takılır | Mock provider (test), Pyth SLA izleme |
| Pool depletion | Satışlar pool'u tüketebilir, son buyerlar zarar görür | Pool balance cap (revert yok, capped) |
| Randomness manipulation | Miner/validator randomness bilgisi | Pyth commit-reveal scheme |

### 14.2 Orta Risk

| Risk | Açıklama | Önlem |
|------|----------|-------|
| Centralization | Owner fees, treasury, K değerini değiştirebilir | Multisig önerilir |
| RPC rate limits | Monad RPC 429 hataları indexer'ı etkileyebilir | Exponential backoff, max log range ayarı |
| DB reorg | Chain reorg'unda DB tutarsızlığı | Replay blocks marjı (20 blok) |

### 14.3 Düşük Risk

| Risk | Açıklama | Önlem |
|------|----------|-------|
| Image storage | Cloudinary down → upload başarısız | External URL fallback |
| USD Price | USD değeri yok, sadece MON | Client-side calculation |
| Gas spike | Death trigger pahalı olabilir | Trigger bonus (0.1 MON) |

### 14.4 Gelecek İyileştirmeler

- [ ] Multisig treasury ve owner
- [ ] The Graph subgraph (merkeziyetsiz indexing)
- [ ] IPFS metadata storage
- [ ] GraphQL API katmanı
- [ ] Multi-token claim (tek transaction)
- [ ] Frontend token list caching
- [ ] Mainnet K değeri kalibrasyonu

---

## 15. Önemli Dosyalar Haritası

| Dosya | Amaç |
|-------|------|
| `hardhat-monad/contracts/v2/ClacFactoryV2.sol` | Factory + EIP-1167 clone deployer |
| `hardhat-monad/contracts/v2/ClacTokenImpl.sol` | Per-token logic (buy/sell/death/claim) |
| `hardhat-monad/contracts/libraries/BondingCurve.sol` | Fiyat hesaplama kütüphanesi |
| `hardhat-monad/contracts/ClacFactory.sol` | V1 legacy kontrat |
| `hardhat-monad/ignition/parameters/testnet-v2.json` | Testnet deploy parametreleri |
| `clacl_backend/src/blockchain-v2/blockchain-v2.service.ts` | Blockchain event indexer |
| `clacl_backend/prisma/schema.prisma` | Database modelleri |
| `clacl_backend/src/config/monad.config.ts` | RPC/chain konfigürasyonu |
| `clack_frontend/src/app/page.tsx` | Ana sayfa |
| `clack_frontend/src/app/create/page.tsx` | Token oluşturma |
| `clack_frontend/src/app/token/[id]/page.tsx` | Token detay |
| `clack_frontend/src/lib/web3/contracts-v2.ts` | ABI + contract helpers |
| `clack_frontend/src/lib/web3/wagmi-config.ts` | Wagmi + RainbowKit setup |

---

*Bu rapor, sistem durumunu 14 Mayıs 2026 itibarıyla yansıtmaktadır.*

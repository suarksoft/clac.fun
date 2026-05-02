# clac.fun — Güvenlik Önlemleri

Projenin üç katmanında (akıllı kontrat, backend, frontend) uygulanan güvenlik kontrollerinin özeti.

---

## 1. Akıllı Kontrat — `ClacFactory.sol`

### 1.1 Reentrancy Koruması
- `ReentrancyGuard` (OpenZeppelin) inherit edildi.
- `buy()`, `sell()`, `triggerDeath()`, `claim()` fonksiyonlarının tamamı `nonReentrant` modifier ile korunuyor.

### 1.2 Erişim Kontrolü
| Koruma | Detay |
|--------|-------|
| `onlyOwner` modifier | `setPublicCreation`, `setCreationFee`, `setK`, `setTreasury` yalnızca owner çağırabilir |
| `createToken` erişim bayrağı | `publicCreation == false` iken yalnızca owner token oluşturabilir |
| Treasury adres kontrolü | `setTreasury` sıfır adrese (`address(0)`) izin vermez |

### 1.3 Token Durum Doğrulaması
- `tokenAlive` modifier: token ID geçerliliği, `dead` flag, deadline kontrolü tek seferde yapar.
- `tokenExists` modifier: ID sınır dışı erişimi engeller.

### 1.4 İşlem Doğrulamaları
| Kontrol | Yer | Detay |
|---------|-----|-------|
| Sıfır değer yasağı | `buy` | `msg.value > 0` zorunlu |
| Sıfır değer yasağı | `sell` | `tokenAmount > 0` zorunlu |
| Sıfır değer yasağı | `claim` | `amount > 0` zorunlu |
| Slippage koruması — alış | `buy` | `tokenAmount >= minTokens` |
| Slippage koruması — satış | `sell` | `netRevenue >= minMON` |
| Havuz tavan kontrolü | `buy` | `poolBalance + msg.value <= MAX_POOL` (10.000 MON) |
| Maksimum arz kontrolü | `buy` | `virtualSupply + tokenAmount <= MAX_SUPPLY` (1B token) |
| Bakiye kontrolü | `sell` | `balances[tokenId][msg.sender] >= tokenAmount` |
| Havuz likidite kontrolü | `sell` | `grossRevenue <= t.poolBalance` |
| Süre doğrulaması | `createToken` | Yalnızca 6s / 12s / 24s kabul edilir |
| Oluşturma ücreti | `createToken` | Eksik ücret reddedilir, fazlası iade edilir |

### 1.5 Anti-Sniper (MEV Koruması)
- İlk 5 blok (`SNIPER_BLOCKS = 5`) içinde bir adres supply'in maksimum %1'ini (`MAX_BUY_BPS_EARLY = 100`) alabilir.
- Erken büyük alımlar kontrat seviyesinde `require` ile bloklanır.

### 1.6 Güvenli Transfer
- `_sendMON`: transfer başarısızsa `require(success, "MON transfer failed")` ile revert.
- Sıfır miktarda transfer erken çıkışla (`return`) işlenmez.

### 1.7 Integer Overflow / Underflow
- `pragma solidity ^0.8.28`: 0.8+ sürümü built-in overflow/underflow kontrolü sağlar; ek SafeMath gerekmez.
- `BondingCurve.sol` `getSellRevenue`: `tokenAmount <= currentSupply` kontrolü.

### 1.8 Holder Takibi
- `isHolder` mapping ile aynı adres holder listesine iki kez eklenmez.
- Satıştan sonra bakiye sıfırlanırsa holder sayacı düşülür.

### 1.9 Olay Kaydı
`TokenCreated`, `Trade`, `TokenClacced`, `LotteryWin`, `Claimed` — tüm kritik işlemler on-chain event ile loglanır.

---

## 2. Backend — `clacl_backend`

### 2.1 Rate Limiting
- `@nestjs/throttler` ile global throttle: varsayılan 60 saniyede 120 istek (`RATE_LIMIT_TTL_MS` / `RATE_LIMIT_MAX` env değişkenleri ile ayarlanabilir).
- `ThrottlerGuard` tüm controller'lara APP_GUARD olarak uygulanır.

### 2.2 HTTP Güvenlik Başlıkları (Helmet)
- `helmet()` middleware ile:
  - `Cross-Origin-Resource-Policy: cross-origin`
  - XSS koruması, MIME sniffing engeli, frame options gibi standart Helmet başlıkları otomatik eklenir.

### 2.3 CORS
- `CORS_ORIGINS` env değişkeninden virgülle ayrılmış origin listesi okunur.
- Origin whitelist dışı istekler callback ile reddedilir.
- `credentials: true` — cookie desteği etkin.

### 2.4 Global Input Validation
`ValidationPipe` tüm endpoint'lere global olarak uygulanır:
- `whitelist: true` — DTO'da tanımsız alanlar otomatik çıkarılır.
- `forbidUnknownValues: true` — bilinmeyen alanlar içeren istek reddedilir.
- `transform: true` — tip dönüşümleri otomatik yapılır.

### 2.5 Admin Kimlik Doğrulaması
- `AdminPasswordGuard`: `x-admin-password` header'ı `ADMIN_PANEL_PASSWORD` env değişkeniyle karşılaştırılır.
- Parola yapılandırılmamışsa veya hatalıysa `401 Unauthorized` döner.
- Guard, admin controller'ın tamamına `@UseGuards` ile uygulanır.

### 2.6 Dosya Yükleme Kısıtlamaları
| Kontrol | Uygulama |
|---------|----------|
| Maksimum boyut | 5 MB (upload ve cloudinary controller'larında) |
| MIME tipi doğrulaması | `image/(jpeg\|jpg\|png\|gif\|webp)` regex (iki ayrı controller) |
| Güvenli dosya adı | Uzantı `[^a-zA-Z0-9.]` ile sanitize, rastgele prefix |
| Bellek içi işlem | Cloudinary yükleme `memoryStorage()` kullanır (diske yazmaz) |

### 2.7 URL Girdi Doğrulaması
`UploadFromUrlDto`:
- `@IsUrl({ require_protocol: true })` — http/https zorunlu.
- `@MaxLength(2048)` — URL uzunluk sınırı.

### 2.8 Sayfalama / Limit Parametreleri
- `PaginationQueryDto`: `limit` için `@Min(1)` ve `@Max(100)`.
- `LimitQueryDto`: aynı kısıtlamalar.
- Admin panel: `Math.min(Math.max(parsed, 1), 500)` hard sınırı.

### 2.9 Ethereum Adres Doğrulaması
- `EthAddressPipe`: `ethers.isAddress()` ile doğrulama, küçük harfe normalize.

### 2.10 Veritabanı Güvenliği
- Tüm sorgular Prisma ORM'nin parameterized query'leri ile yapılır — SQL injection riski yok.
- Admin token silme işlemleri Prisma transaction ile cascade delete kullanır.
- `@Param('id', ParseIntPipe)` — ID parametresi integer tipine zorlanır.

### 2.11 Blockchain Senkronizasyonu
- Transaction hash veya block number eksikse log girişi atlanır, uyarı loglanır.
- Adresler her zaman küçük harfe normalize edilerek kaydedilir.
- `resetSyncStateIfChainChanged`: chain ID değişikliği tespit edilirse sync state sıfırlanır, geçersiz veri birikimi önlenir.

---

## 3. Frontend — `clack_frontend`

### 3.1 HTTP Güvenlik Başlıkları (`next.config.mjs`)

**Content Security Policy:**
```
default-src 'self'
base-uri 'self'
frame-ancestors 'none'          ← Clickjacking engeli
form-action 'self'
img-src 'self' https: data: blob:
font-src 'self' https: data:
connect-src 'self' https: wss:  ← XHR/WebSocket kısıtlaması
style-src 'self' 'unsafe-inline'
script-src 'self' 'unsafe-inline' 'unsafe-eval'
```

**Ek başlıklar (tüm route'lar):**
| Başlık | Değer |
|--------|-------|
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` |

### 3.2 Form Girdi Doğrulaması
- Token Name: `maxLength={32}`, boşluk trim, submit öncesi doğrulama.
- Token Symbol: `maxLength={8}`, otomatik büyük harfe çevirme.
- Karakter sayacı: Name > 28, Symbol > 6 olduğunda kırmızıya döner.
- `submitted` state: zorunlu alanlar boşsa kırmızı border gösterilir.

### 3.3 Dosya Yükleme Doğrulaması (İstemci Tarafı)
- Boyut kontrolü: > 5 MB reddedilir.
- MIME kontrolü: `/^image\/(jpeg|jpg|png|gif|webp)$/i` regex.
- `accept` attribute ile tarayıcı dosya seçimi kısıtlanır.
- Ön kontrol, backend yüklemesinden önce hataları erken yakalar.

### 3.4 Cüzdan ve Zincir Koruması
- `isWrongChain`: bağlı cüzdan Monad Testnet (ID: 10143) değilse işlem engellenir.
- Yanlış zincirde otomatik `switchChain()` tetiklenir.
- `isDurationValid`: yalnızca 21600 / 43200 / 86400 saniye kabul edilir.
- Cüzdan bağlı değilse submit butonu disabled + "Connect Wallet" mesajı.

### 3.5 Image URL Doğrulaması
- Frontend: `finalImageURI` gönderilmeden önce `/^https?:\/\//i` kontrolü.
- Admin panel: `new URL()` ile parse + `protocol` kontrolü (http/https zorunlu).

### 3.6 Admin Panel Ek Korumalar
- Admin şifresi `sessionStorage`'da tutulur (sekmeden çıkınca temizlenir, `localStorage` değil).
- Owner kontrolü: `address.toLowerCase() === ownerAddress.toLowerCase()`.
- Kontrat çağrısı öncesi cüzdan, zincir ve owner doğrulaması birlikte yapılır.

---

## 4. Genel Notlar

### Kuvvetli Yönler
1. Üç katmanda (kontrat / backend / frontend) savunma derinliği mevcut.
2. Kritik kontrat fonksiyonlarında reentrancy koruması eksiksiz.
3. MEV / sniper koruması kontrat seviyesinde uygulanıyor.
4. Dosya yüklemede hem frontend hem backend doğrulaması var.
5. Input validation backend'de global `ValidationPipe` ile merkezi yönetiliyor.
6. CSP ve güvenlik başlıkları clickjacking, MIME sniffing ve XSS riskini azaltıyor.

### Dikkat Edilmesi Gereken Alanlar
1. **`script-src 'unsafe-eval'`**: Next.js dev modu gereksinimi; production build'de mümkünse kaldırılmalı.
2. **Admin şifresi**: `x-admin-password` header'ı basit parola tabanlı; ileride imza tabanlı auth düşünülebilir.
3. **Rate limiting**: Şu an endpoint başına değil, IP başına global — kritik endpoint'ler (`/api/upload/*`) için ayrı, daha sıkı limit eklenebilir.
4. **Kontrat audit**: Mainnet öncesi bağımsız güvenlik denetimi önerilir.

# Clac.fun — Değişiklik Özeti

## Akıllı Kontratlar

| | Önceki | Şimdiki |
|---|---|---|
| Factory adresi | `0xeCeA41...8ce18` | `0x4093a7...049eD` |
| Token mimarisi | Tek factory, her token bir `tokenId` (sayı) | Her token kendi bağımsız kontratı, `0x` adresiyle tanımlanır |
| Buy/Sell | Factory üzerinden `buy(tokenId, ...)` | Token kontratı üzerinden doğrudan `buy(minTokens)` |
| Ödül dağıtımı | Factory üzerinde `claim(tokenId)` | Token kontratı üzerinde `claim()` |
| Rastgelelik | Pyth (gerçek ücret) | MockRandomnessProvider (testnet, ücretsiz) |
| Death tetikleme | `triggerDeath(tokenId)` | `requestDeath()` → zincir callback → `deathFinalized` |

### Kontrat Adresleri (Monad Testnet)

| Kontrat | Adres |
|---|---|
| ClacFactoryV2 | `0x4093a7D5624B854A0f5cBBbD0b751a1aCe8049eD` |
| ClacTokenImpl | `0x05a84A23111c1CE88287fb388ab4b77904F0c248` |
| MockRandomnessProvider | `0xAbC622174F0e5Bb4E166A5860332ff941A29384d` |
| ClacTrophyNFT | `0x607756a786fCeb83370A33d7391AdFf8Fd7531DF` |

---

## Backend (NestJS)

| | Önceki | Şimdiki |
|---|---|---|
| Çalışan modüller | `BlockchainModule` (V1) + `BlockchainV2Module` | Sadece `BlockchainV2Module` |
| Factory env değişkeni | `MONAD_CONTRACT_ADDRESS` + `MONAD_FACTORY_V2_ADDRESS` | Tek `MONAD_FACTORY_ADDRESS` |
| Config alanı | `contractAddress` + `factoryV2Address` | Tek `factoryAddress` |
| Health endpoint | `factory_v1` + `factory_v2` döndürüyordu | Tek `factory` döndürüyor |

### Render Env Değişiklikleri

| İşlem | Key |
|---|---|
| Silindi | `MONAD_CONTRACT_ADDRESS` |
| Silindi | `MONAD_CONTRACT_ADDRESS_MAINNET` |
| Eklendi | `MONAD_FACTORY_ADDRESS` = `0x4093a7D5624B854A0f5cBBbD0b751a1aCe8049eD` |
| Eklendi | `NEXT_PUBLIC_FACTORY_ADDRESS` = `0x4093a7D5624B854A0f5cBBbD0b751a1aCe8049eD` |

---

## Frontend (Next.js)

| | Önceki | Şimdiki |
|---|---|---|
| `/token/[id]` | Sadece sayısal ID destekliyordu (`/token/42`) | `0x...` adresi gelirse yeni token sayfasına, sayı gelirse eski sayfaya yönlendirir |
| Token detay | Factory'den tokenId ile veri çekiyordu | Token kontratından `useReadContracts` ile batch okuma |
| Trade paneli | Factory'de `buy/sell` | Token kontratında doğrudan `buy/sell` |
| Claim | Factory'de `claim(tokenId)` | Token kontratında `claim()` + Trophy NFT mint butonu |
| `/create` sayfası | Hardcoded `10 MON`, 4 argümanlı `createToken` | Creation fee zincirden okunuyor, 5 argümanlı `createToken` |
| Initial buy | Yoktu | Token oluştururken aynı tx'te alım yapılabiliyor (0 / 1 / 5 / 10 / 20 MON) |
| Başarı yönlendirmesi | `/token/42` (sayısal ID) | `/token/0x...` (kontrat adresi) |
| Env değişkeni | `NEXT_PUBLIC_CLAC_FACTORY_V2_ADDRESS` | `NEXT_PUBLIC_FACTORY_ADDRESS` |

### Vercel Env Değişiklikleri

| İşlem | Key |
|---|---|
| Eklendi | `NEXT_PUBLIC_FACTORY_ADDRESS` = `0x4093a7D5624B854A0f5cBBbD0b751a1aCe8049eD` |

---

## Akış Karşılaştırması

**Önceki:**
```
Kullanıcı token yaratır → Factory tokenId verir → /token/42
Buy/Sell  → Factory.buy(42, amount)
Death     → Factory.triggerDeath(42)
Claim     → Factory.claim(42)
```

**Şimdiki:**
```
Kullanıcı token yaratır → Factory yeni kontrat deploy eder → /token/0x4a3b...
Buy/Sell  → TokenKontratı.buy() / TokenKontratı.sell()
Death     → TokenKontratı.requestDeath() → zincir callback → deathFinalized
Claim     → TokenKontratı.claim() + opsiyonel mintTrophy()
```

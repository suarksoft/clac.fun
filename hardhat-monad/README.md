# ClacFactory Hardhat Workspace

Bu klasör `clac.fun` kontratlarını derlemek, test etmek, dağıtmak ve doğrulamak için kullanılır.

## Kontratlar

- `contracts/ClacFactory.sol`
- `contracts/libraries/BondingCurve.sol`

## Hızlı Başlangıç

1. Bağımlılıkları kur:

```bash
npm install
```

2. `.env` oluştur:

```bash
cp .env.example .env
```

3. Parametre dosyalarını güncelle:
- `ignition/parameters/testnet.json`
- `ignition/parameters/mainnet.json`

`treasury` alanı gerçek cüzdan adresi olmalı. `0x000...0001` sadece placeholder'dır.

## Komutlar

```bash
npm run compile
npm run test
npm run deploy:testnet
npm run deploy:mainnet
```

## Testnet Deploy Akışı

1. `ignition/parameters/testnet.json` içindeki `treasury` ve `k` değerlerini ayarla.
2. Deploy et:

```bash
npm run deploy:testnet
```

3. Deploy çıktısını doğrula:
- `ignition/deployments/chain-10143/deployed_addresses.json`
- `ignition/deployments/chain-10143/journal.jsonl`

4. Kontratı verify et:

```bash
npx hardhat verify <CONTRACT_ADDRESS> "<TREASURY_ADDRESS>" <K> --network monadTestnet
```

## Mainnet Deploy Akışı

1. `ignition/parameters/mainnet.json` güncelle.
2. Deploy et:

```bash
npm run deploy:mainnet
```

3. Verify et:

```bash
npx hardhat verify <CONTRACT_ADDRESS> "<TREASURY_ADDRESS>" <K> --network monadMainnet
```

## Soft Launch Öncesi On-Chain Kontrol Listesi

Deploy sonrası aşağıdaki değerler explorer veya script ile doğrulanmalı:

- `owner()`
- `treasury()`
- `publicCreation()`
- `creationFee()`
- `k()`

Testnet soft launch için önerilen başlangıç:
- `publicCreation = false` (ilk aşamada sadece owner create)
- `treasury` güvenli operasyon cüzdanı

## Güvenlik Notları

- Deploy private key yalnızca güvenli ortamda tutulmalı.
- `.env` dosyasını asla commit etmeyin.
- `setTreasury`, `setCreationFee`, `setK`, `setPublicCreation` çağrıları için onay/prosedür belgesi kullanın.

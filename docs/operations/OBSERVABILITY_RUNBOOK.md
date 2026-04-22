# Observability Runbook

## Amaç
Testnet soft launch sırasında backend, frontend ve indexer davranışını gerçek zamanlı izlemek.

## İzlenmesi Gereken Sinyaller

- Backend health: `GET /api/health`
- Backend readiness: `GET /api/ready`
- API hata oranı: 4xx/5xx
- WebSocket bağlantı sayısı ve ip başına limit aşımı
- Indexer ilerleme: `SyncState.lastBlockNumber`
- RPC bağlantı durumu: `Connected to Monad` logları

## Uyarı Eşikleri

- `api/ready` 2 dakika boyunca başarısız
- 5xx oranı 5 dakikada %2 üzeri
- Son indekslenen blok ile zincir arası fark 50 blok üzeri
- Aynı IP’den sürekli WS limit ihlali

## Olay Sırasında İlk 10 Dakika

1. `api/health` ve `api/ready` kontrol et.
2. Son deploy hash ve env değişikliği var mı doğrula.
3. RPC erişimini ayrı bir istemciyle doğrula (`eth_chainId`, `eth_blockNumber`).
4. Veritabanı bağlantısını doğrula.
5. Sorun sınıfını belirle: API, DB, RPC, kontrat adresi, trafik.

## Delil Toplama

- Hata zamanı ve etkilenen endpoint
- Son 15 dakika backend logları
- İlgili tx hash / block number
- Geçici aksiyonlar ve sonucu

# Incident Response Runbook

## Severity Tanımları

- Sev-1: Kullanıcı işlemleri durdu / kritik veri kaybı riski
- Sev-2: Kısmi fonksiyon kaybı / yüksek hata oranı
- Sev-3: Düşük etki / workaround mevcut

## İlk Müdahale

1. Incident owner ata.
2. Etki alanını belirle (frontend, backend, kontrat, altyapı).
3. Kullanıcı etkisini sınıflandır.
4. Geçici mitigasyonu uygula.

## Teknik Kontrol Listesi

- Backend:
  - `api/health`, `api/ready`
  - son deploy ve env farkı
  - CORS/rate-limit davranışı
- RPC/Contract:
  - `eth_chainId`, `eth_getCode`
  - kontrat adresi eşleşmesi
- DB:
  - bağlantı
  - migration durumu
  - `SyncState` güncelleniyor mu

## İletişim Şablonu

- Başlangıç bildirimi: etki, kapsam, ilk aksiyon
- 15 dakikada bir durum güncellemesi
- Kapanış bildirimi: kök neden, alınan aksiyon, kalıcı önlem

## Postmortem

- 24 saat içinde hazırlanır
- İçerik:
  - zaman çizelgesi
  - kök neden
  - algılama boşluğu
  - kalıcı aksiyonlar

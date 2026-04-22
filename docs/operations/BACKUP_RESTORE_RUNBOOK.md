# Backup and Restore Runbook

## Amaç
Veritabanı arızası veya veri bozulmasında kontrollü geri dönüş sağlamak.

## Yedekleme Politikası (Testnet)

- Günlük otomatik tam yedek
- Kritik deploy öncesi manuel yedek
- Minimum 7 günlük saklama

## Deploy Öncesi Adım

1. Son yedeğin başarılı olduğunu doğrula.
2. Yedek zamanını release notuna ekle.
3. Migration çalıştırmadan önce restore planını hazır tut.

## Restore Tatbikatı

1. Ayrı bir staging DB oluştur.
2. Son yedeği staging DB’ye geri yükle.
3. Backend’i staging DB ile ayağa kaldır.
4. `GET /api/health`, `GET /api/ready`, `GET /api/tokens` çağrılarını doğrula.
5. Sonuçları kanıt dosyasına ekle.

## Acil Restore

1. Yazma trafiğini geçici olarak durdur.
2. Hedef snapshot/yedek sürümünü belirle.
3. Restore uygula.
4. Uygulama env ve bağlantı stringini doğrula.
5. Smoke check çalıştır:
   - `npm run smoke:release` (frontend)
6. Servisi kontrollü aç.

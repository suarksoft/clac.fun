# ClacFactory Admin Operations Policy

Bu dosya testnet soft launch sırasında admin fonksiyonlarının nasıl kullanılacağını tanımlar.

## Admin Fonksiyonları

- `setTreasury(address _treasury)`
- `setCreationFee(uint256 _fee)`
- `setK(uint256 _k)`
- `setPublicCreation(bool _public)`

## Zorunlu Süreç

1. Değişiklik talebi issue/PR içinde yazılı gerekçe ile açılır.
2. En az 1 teknik onay + 1 operasyon onayı alınır.
3. Değişiklikten önce mevcut değerler kayda geçirilir:
   - `treasury`, `creationFee`, `k`, `publicCreation`
4. İşlem hash’i ve blok numarası release notuna eklenir.
5. İşlem sonrası backend/frontend davranışı doğrulanır.

## Acil Durum Kuralları

- Yalnızca kritik güvenlik veya fon riski durumunda acil değişiklik yapılır.
- Acil değişiklik sonrası 24 saat içinde postmortem hazırlanır.

## Soft Launch Varsayılanları

- `publicCreation = false`
- `creationFee = 10 MON`
- `k = 1000000`
- `treasury` sıfır adres olamaz

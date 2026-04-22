# Go/No-Go Evidence Checklist

Bu dosya release toplantısında kanıt toplamak için kullanılır.

## 1) Contract Evidence

- [ ] Deploy tx hash
- [ ] Verify link (MonadScan/Sourcify)
- [ ] `owner`, `treasury`, `creationFee`, `publicCreation`, `k` değer kanıtı
- [ ] Frontend ve backend env’deki kontrat adresi eşleşiyor

## 2) Backend Evidence

- [ ] `GET /api/health` başarılı
- [ ] `GET /api/ready` başarılı
- [ ] `npm run build` başarılı
- [ ] `npm test` başarılı
- [ ] Rate limit / CORS env değerleri doğrulandı

## 3) Frontend Evidence

- [ ] `npm run smoke:release` başarılı
- [ ] Wrong-chain guard davranışı doğrulandı
- [ ] create/buy/sell/claim manuel akışları test edildi
- [ ] CSP ve güvenlik header’ları response içinde doğrulandı

## 4) Data & Recovery Evidence

- [ ] Son yedek zaman damgası
- [ ] Restore tatbikatı sonucu
- [ ] SyncState ilerleme kanıtı

## 5) Operasyon Evidence

- [ ] Alarm testleri geçti
- [ ] Incident owner + iletişim kanalı tanımlı
- [ ] Rollback adımları doğrulandı

## Karar

- Karar: [ ] GO  [ ] NO-GO
- Karar tarihi:
- Katılımcılar:
- Notlar:

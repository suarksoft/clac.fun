# clac.fun — Mainnet Hazırlık Raporu

**Tarih:** 4 Mayıs 2026  
**Durum:** Testnet soft launch yapılabilir — Mainnet için kritik eksikler var

---

## Genel Değerlendirme

**clac.fun** Monad blockchain üzerinde bonding curve tabanlı bir memecoin launchpad platformu. Üç katmandan oluşuyor: Next.js frontend, NestJS backend, Solidity akıllı kontrat.

Mimari sağlam kurulmuş. Reentrancy guard, CORS, CSP, rate limit, validasyon pipe'ları gibi temel güvenlik katmanları var. Smart contract test suite kapsamlı (618 satır). Ops runbook'lar yazılmış. Ancak mainnet için kapanması gereken ciddi açıklar mevcut.

---

## KRİTİK BLOKERLAR

> Bu maddeler çözülmeden mainnet'e gidilmez.

### 1. Exposed Secrets — ACİL

`.env` dosyaları ve `.env.example` git'e düşmüş, içlerinde gerçek secret'lar var:

| Dosya | Exposed Secret |
|-------|---------------|
| `hardhat-monad/.env` | Deployer private key (`88f66e0f...`) |
| `clacl_backend/.env` | Cloudinary API secret (`IbuIhs0Q...`) |
| `clacl_backend/.env` | Admin panel şifresi (`Bugra.0601`) |
| `clacl_backend/.env.example` | Admin şifresi template'e de yazılmış |
| `clack_frontend/.env.local` | WalletConnect project ID |

**Yapılacaklar:**
- [ ] Private key'i derhal rotate et, treasury adresini değiştir
- [ ] Cloudinary API key'i yenile
- [ ] Admin şifresini değiştir
- [ ] `.env.example` dosyalarındaki gerçek değerleri placeholder ile değiştir (`your_password_here`)

---

### 2. Smart Contract Audit Yok

`ClacFactory.sol` 454 satır Solidity içeriyor: bonding curve matematiği, death mekaniği, pro-rata dağıtım, lottery sistemi. Hiçbiri dış bir güvenlik firması tarafından denetlenmemiş.

**Risk:** Matematiksel hatalar, reentrancy açıkları, edge case'ler. Mainnet'e audit raporu olmadan gidilmez.

**Yapılacaklar:**
- [ ] OpenZeppelin, Trail of Bits veya benzeri bir firmaya audit yaptır
- [ ] Audit sonuçlarını uygula ve tekrar onaylat

---

### 3. Lottery Blockhash Kullanıyor (MEV Riski)

`ClacFactory.sol` satır 301-302:

```solidity
uint256 seed = uint256(keccak256(abi.encodePacked(
    blockhash(block.number - 1), tokenId, i, holderCount, block.timestamp
)));
```

Blockhash block builder'lar tarafından görülür ve manipüle edilebilir. Validator'lar lottery sonucunu etkileyebilir.

**Yapılacaklar:**
- [ ] Chainlink VRF entegre et ya da commit-reveal pattern kullan



---

### 4. Admin Authentication Çok Zayıf

`/clacl_backend/src/common/guards/admin-password.guard.ts` — sadece header'daki string'i karşılaştırıyor. Admin endpoint'lerine özel rate limit yok, IP kısıtlaması yok, replay saldırısına karşı önlem yok.

**Yapılacaklar:**
- [ ] EIP-191 imza tabanlı auth'a geç
- [ ] Admin endpoint'leri için ayrı `@Throttle(5, 60)` decorator ekle
- [ ] Bilinen IP'lerden whitelist uygula

---

### 5. Monitoring ve Alerting Yok

RPC düşse, event listener takılsa, backend çökse — kimse haberdar olmaz. Ops runbook'lar yazılmış ama tetikleyecek sistem yok.

**Yapılacaklar:**
- [ ] Sentry ekle (frontend + backend crash reporting)
- [ ] Backend health endpoint'ini bir uptime monitörüne bağla (Better Uptime, UptimeRobot)
- [ ] Event listener lag için alert kur (>10 blok geride kalırsa alarm)
- [ ] RPC/WS bağlantı kopması için alert
- [ ] Grafana veya Datadog dashboard

---

## ÖNEMLİ EKSİKLER

### Güvenlik

| Sorun | Dosya | Risk |
|-------|-------|------|
| `unsafe-eval` CSP'de var | `next.config.mjs:11` | XSS escalation |
| Rate limit global, endpoint bazlı değil | `app.module.ts` | Upload/admin brute force |
| WebSocket bağlantı limiti env'de var ama uygulanmıyor | `TokensGateway` | WS flood |
| Image URI backend'de doğrulanmıyor | `tokens.controller.ts` | XSS via malformed URI |
| File upload'da basename sanitize edilmiyor | `uploads.controller.ts` | Path traversal (düşük risk) |

**Yapılacaklar:**
- [ ] Production build'de `unsafe-eval` kaldırılabilir mi test et
- [ ] Upload ve admin endpoint'lerine `@Throttle` decorator ekle
- [ ] `TokensGateway`'e IP başına bağlantı sayısı kontrolü ekle
- [ ] Token oluşturma DTO'suna `@IsUrl()` validasyonu ekle

### Test Kapsamı

| Paket | Durum |
|-------|-------|
| Smart Contract | ✅ İyi (618 satır, kapsamlı) |
| Backend | ⚠️ Yetersiz (11 modül, 2 test dosyası) |
| Frontend | ❌ Hiç test yok |

**Yapılacaklar:**
- [ ] Backend için eksik modüllere unit test yaz (blockchain service, token service, portfolio, upload validasyon)
- [ ] Frontend için Jest + React Testing Library kur
- [ ] Create page form validasyonu, trade panel slippage, wallet bağlantısı için test yaz

### CI/CD

Render.yaml var ama pre-deploy check yok.

**Yapılacaklar:**
- [ ] GitHub Actions ekle: lint → build → test → smart contract test → güvenlik taraması (Slither)
- [ ] Deploy öncesi otomatik kontrat derleme ve test koşumu
- [ ] Docker image'larına versiyon tag'i ekle

### Operasyonel

| Eksik | Açıklama |
|-------|----------|
| Backup restore test edilmemiş | `BACKUP_RESTORE_RUNBOOK.md` var ama hiç çalıştırılmamış |
| Load test yok | Kaç concurrent user kaldırıyor bilinmiyor |
| Incident response drill yok | Runbook var, prova yapılmamış |
| Admin key management yok | Raw private key tutuluyor, vault/HSM yok |
| Testnet soft launch tamamlanmamış | `GO_NO_GO_EVIDENCE_CHECKLIST.md` boş |

**Yapılacaklar:**
- [ ] PostgreSQL backup'ı test et, restore sürecini belgele
- [ ] k6 veya Locust ile yük testi yap
- [ ] 48 saatlik testnet soft launch gerçekleştir, tüm senaryoları manuel test et
- [ ] GO_NO_GO checklist'i kanıtlarla doldur

---

## GÜÇLÜ YANLAR

- Üç katmanlı mimari temiz kurulmuş (frontend / backend / contracts)
- `ReentrancyGuard`, slippage koruması, `ValidationPipe`, Helmet, CORS yapılandırması mevcut
- Smart contract test suite kapsamlı
- Render deployment konfigürasyonu hazır
- INCIDENT_RESPONSE, BACKUP_RESTORE, OBSERVABILITY runbook'ları yazılmış
- Prisma migration'ları düzenli
- CSP header'ları yapılandırılmış

---

## Öncelik Sırası

```
HAFTA 1-2 (Kritik)
├── Private key, Cloudinary, admin şifresi rotate et
├── Smart contract audit başlat
├── Monitoring kur (Sentry + uptime)
└── Admin auth'u imza tabanlıya taşı

HAFTA 3-4 (Önemli)
├── Audit sonuçlarını uygula
├── Frontend test suite kur
├── Rate limit endpoint bazlı hale getir
├── CI/CD pipeline ekle
└── Backup restore testi yap

HAFTA 5 (Pre-launch)
├── 48 saatlik testnet soft launch
├── Load testi
├── GO_NO_GO checklist'i doldur
└── Incident response drill

MAINNET
└── Tüm checklistler tamamsa deploy
```

---

## Özet Tablo

| Kriter | Durum |
|--------|-------|
| Kod mimarisi | ✅ Sağlam |
| Temel güvenlik katmanları | ✅ Var |
| Smart contract testleri | ✅ Kapsamlı |
| **Secrets yönetimi** | ❌ Kritik açık |
| **Smart contract audit** | ❌ Yok |
| **Lottery randomness** | ❌ MEV'e açık |
| **Admin auth** | ⚠️ Zayıf |
| **Monitoring** | ❌ Yok |
| Frontend testleri | ❌ Hiç yok |
| Backend test kapsamı | ⚠️ Yetersiz |
| CI/CD pipeline | ❌ Yok |
| Backup test | ❌ Yapılmamış |
| Load test | ❌ Yapılmamış |
| Testnet soft launch | ⚠️ Planlandı, tamamlanmadı |

**Sonuç:** Testnet soft launch için hazır. Mainnet için yukarıdaki kritik blokerların tamamı kapanmalı.

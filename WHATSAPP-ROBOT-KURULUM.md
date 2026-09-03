# CappadociaGo — WhatsApp Rezervasyon Robotu

Bu paket resmi WhatsApp Cloud API kullanmaz. `whatsapp-bot/` servisi WhatsApp Web multi-device bağlantısını Baileys üzerinden kullanır. Ayrı bir robot numarası önerilir. Bu yöntem resmi Meta API değildir; WhatsApp oturumu zaman zaman yeniden eşleştirme isteyebilir ve kullanım WhatsApp şartlarına tabidir.

## Akış

1. Misafir tur sayfasındaki **Quick Reservation** formunu gönderir.
2. Site `/api/reservation-notify` endpoint'ine rezervasyonu gönderir.
3. Vercel endpoint'i gizli anahtar ile robot sunucusuna iletir.
4. Robot WhatsApp hesabı, rezervasyon bilgisini `NOTIFY_TO` numarasına otomatik yollar.
5. Robot servisi ulaşılamazsa site mevcut WhatsApp bağlantısını yedek olarak açar; lead kaybolmaz.

## 1 — Robot servisini kur

`whatsapp-bot` klasörünü sürekli çalışan bir Node.js sunucuya/VPS'e koy.

```bash
cd whatsapp-bot
cp .env.example .env
npm install
npm start
```

`.env` içinde:

```env
PORT=3001
WEBHOOK_SECRET=BURAYA_UZUN_RASTGELE_BIR_ANAHTAR
NOTIFY_TO=905401015050
AUTH_DIR=./auth
```

`NOTIFY_TO`: rezervasyon bildirimlerini alacak WhatsApp numarasıdır. `+` kullanmadan ülke koduyla yaz.

İlk `npm start` çalıştırmasında terminalde QR çıkar. Robot telefonda:

**WhatsApp > Ayarlar / Menü > Bağlı Cihazlar > Cihaz Bağla**

ile QR'ı okut. `auth/` klasörünü silme; oturum burada kalır.

## 2 — Bot servisini HTTPS olarak yayınla

Robot endpoint'i:

`POST https://BOT-DOMAININ/webhook/reservation`

Health kontrolü:

`GET https://BOT-DOMAININ/health`

VPS'te Nginx/Caddy reverse proxy veya HTTPS sağlayan bir Node hosting kullanabilirsin. Bot servisi **Vercel serverless içinde çalıştırılmamalı**; WhatsApp bağlantısının sürekli açık kalması gerekir.

## 3 — Vercel Environment Variables

CappadociaGo Vercel projesine iki server-side değişken ekle:

```env
WHATSAPP_BOT_WEBHOOK_URL=https://BOT-DOMAININ/webhook/reservation
WHATSAPP_BOT_WEBHOOK_SECRET=ROBOT_ENV_ILE_AYNI_ANAHTAR
```

Bunlarda `PUBLIC_` öneki KULLANMA. Sonra siteyi yeniden deploy et.

## 4 — Test

Robot servisi:

```bash
curl http://localhost:3001/health
```

Beklenen:

```json
{"ok":true,"whatsappReady":true}
```

Sonra siteden bir tur sayfasında Quick Reservation formunu doldur. Bildirim `NOTIFY_TO` numarasına şu biçimde gelir:

```text
🎈 NEW RESERVATION — CAPPADOCIAGO
Tour: Göreme Comfort Hot Air Balloon Tour
Date: 06.09.2026
Guests: 4 Pax
Name: John Smith
Phone: +44 7700 123456
Price: 80 €
Total: 320 €
```

## Güvenlik

- `WEBHOOK_SECRET` ve `WHATSAPP_BOT_WEBHOOK_SECRET` aynı olmalı.
- `.env` ve `auth/` Git'e gönderilmemeli.
- Robot için müşteri iletişiminde kullanılan ana numaradan ayrı numara kullanmak daha güvenlidir.
- Bu yapı toplu mesaj/spam için değil, yalnızca kendi sitendeki rezervasyon bildirimleri için tasarlanmıştır.

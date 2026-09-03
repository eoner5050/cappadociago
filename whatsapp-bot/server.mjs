import 'dotenv/config';
import express from 'express';
import qrcode from 'qrcode-terminal';
import pino from 'pino';
import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
} from '@whiskeysockets/baileys';

const PORT = Number(process.env.PORT || 3001);
const WEBHOOK_SECRET = String(process.env.WEBHOOK_SECRET || '');
const AUTH_DIR = String(process.env.AUTH_DIR || './auth');
const NOTIFY_TO = String(process.env.NOTIFY_TO || '').replace(/\D/g, '');

if (!WEBHOOK_SECRET || WEBHOOK_SECRET.length < 16) {
  console.error('WEBHOOK_SECRET is missing or too short. Use at least 16 random characters.');
  process.exit(1);
}
if (!NOTIFY_TO) {
  console.error('NOTIFY_TO is missing. Example: 905401015050');
  process.exit(1);
}

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });
const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '20kb' }));

let sock = null;
let whatsappReady = false;
let reconnectTimer = null;

const jidFor = (digits) => `${String(digits).replace(/\D/g, '')}@s.whatsapp.net`;
const euro = (value) => Number.isFinite(Number(value)) ? `${Number(value).toLocaleString('en-US', { maximumFractionDigits: 2 })} €` : '—';
const safe = (v, max = 400) => String(v ?? '').trim().slice(0, max);

function reservationText(data) {
  const price = data.priceOnRequest ? 'Price on Request' : euro(data.unitPrice);
  const total = data.priceOnRequest ? 'Price on Request' : euro(data.totalPrice);
  return [
    '🎈 *NEW RESERVATION — CAPPADOCIAGO*',
    '',
    `🧭 *Tour:* ${safe(data.tourTitle, 180)}`,
    `📅 *Date:* ${safe(data.date, 40)}`,
    `👥 *Guests:* ${Math.max(1, Math.min(30, Number(data.people || 1)))} Pax`,
    `👤 *Name:* ${safe(data.name, 120)}`,
    `📞 *Phone:* ${safe(data.phone, 60)}`,
    `💶 *Price:* ${price}`,
    `🧾 *Total:* ${total}`,
    data.message ? `📝 *Note:* ${safe(data.message, 1000)}` : '',
    '',
    data.tourSlug ? `🔖 ${safe(data.tourSlug, 180)}` : '',
    data.receivedAt ? `🕒 ${new Date(data.receivedAt).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })}` : '',
  ].filter(Boolean).join('\n');
}

async function connectWhatsApp() {
  clearTimeout(reconnectTimer);
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: 'silent' }),
    browser: ['CappadociaGo', 'Chrome', '1.0.0'],
    markOnlineOnConnect: false,
    syncFullHistory: false,
  });

  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      console.log('\nWhatsApp robot numarasinda: Bagli cihazlar > Cihaz bagla > bu QR kodu okut.\n');
      qrcode.generate(qr, { small: true });
    }
    if (connection === 'open') {
      whatsappReady = true;
      console.log('✅ WhatsApp robot connected.');
    }
    if (connection === 'close') {
      whatsappReady = false;
      const statusCode = lastDisconnect?.error?.output?.statusCode || lastDisconnect?.error?.statusCode;
      if (statusCode === DisconnectReason.loggedOut) {
        console.error('❌ WhatsApp logged out. Delete AUTH_DIR and scan QR again.');
        return;
      }
      console.warn('WhatsApp connection closed; reconnecting...');
      reconnectTimer = setTimeout(() => connectWhatsApp().catch(console.error), 3000);
    }
  });
}

app.get('/health', (_req, res) => {
  res.json({ ok: true, whatsappReady });
});

app.post('/webhook/reservation', async (req, res) => {
  if (req.get('x-bot-secret') !== WEBHOOK_SECRET) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }
  if (!whatsappReady || !sock) {
    return res.status(503).json({ ok: false, error: 'WhatsApp is not connected' });
  }

  const data = req.body || {};
  if (!safe(data.name) || !safe(data.phone) || !safe(data.tourTitle) || !safe(data.date)) {
    return res.status(400).json({ ok: false, error: 'Missing reservation fields' });
  }

  try {
    const result = await sock.sendMessage(jidFor(NOTIFY_TO), { text: reservationText(data) });
    logger.info({ reservation: data.tourSlug, id: result?.key?.id }, 'Reservation notification sent');
    return res.json({ ok: true, messageId: result?.key?.id || null });
  } catch (error) {
    logger.error({ err: error }, 'Failed to send reservation notification');
    return res.status(500).json({ ok: false, error: 'Send failed' });
  }
});

app.use((_req, res) => res.status(404).json({ ok: false, error: 'Not found' }));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`CappadociaGo WhatsApp bot listening on :${PORT}`);
  console.log(`Health: http://localhost:${PORT}/health`);
});

connectWhatsApp().catch((error) => {
  console.error('Initial WhatsApp connection failed:', error);
});

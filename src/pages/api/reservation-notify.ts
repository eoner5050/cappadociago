import type { APIRoute } from 'astro';

export const prerender = false;

const MAX = {
  name: 120,
  phone: 60,
  tourTitle: 180,
  tourSlug: 180,
  date: 40,
  dateIso: 20,
  message: 1200,
  language: 10,
  pageUrl: 500,
};

function clean(value: unknown, max: number) {
  return String(value ?? '').replace(/[\u0000-\u001F\u007F]/g, ' ').trim().slice(0, max);
}

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

export const POST: APIRoute = async ({ request, url }) => {
  const contentType = request.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) return json(415, { ok: false, error: 'JSON required' });

  // Reject obvious cross-site browser posts. This is not authentication; the bot webhook secret remains server-only.
  const origin = request.headers.get('origin');
  if (origin) {
    try {
      if (new URL(origin).host !== url.host) return json(403, { ok: false, error: 'Origin rejected' });
    } catch {
      return json(403, { ok: false, error: 'Origin rejected' });
    }
  }

  let raw: any;
  try {
    raw = await request.json();
  } catch {
    return json(400, { ok: false, error: 'Invalid JSON' });
  }

  // Honeypot: humans never see/fill this field.
  if (clean(raw?.website, 200)) return json(200, { ok: true });

  const payload = {
    tourSlug: clean(raw?.tourSlug, MAX.tourSlug),
    tourTitle: clean(raw?.tourTitle, MAX.tourTitle),
    name: clean(raw?.name, MAX.name),
    phone: clean(raw?.phone, MAX.phone),
    date: clean(raw?.date, MAX.date),
    dateIso: clean(raw?.dateIso, MAX.dateIso),
    people: Math.max(1, Math.min(30, Number(raw?.people || 1))),
    unitPrice: raw?.unitPrice == null ? null : Number(raw.unitPrice),
    totalPrice: raw?.totalPrice == null ? null : Number(raw.totalPrice),
    priceOnRequest: Boolean(raw?.priceOnRequest),
    message: clean(raw?.message, MAX.message),
    language: clean(raw?.language, MAX.language),
    pageUrl: clean(raw?.pageUrl, MAX.pageUrl),
    receivedAt: new Date().toISOString(),
  };

  if (!payload.name || !payload.phone || !payload.tourTitle || !payload.date || !Number.isFinite(payload.people)) {
    return json(400, { ok: false, error: 'Missing reservation fields' });
  }


  // GREEN-API is preferred when configured. Existing WhatsApp bot remains the fallback.
  const greenInstance = import.meta.env.GREEN_API_ID_INSTANCE || process.env.GREEN_API_ID_INSTANCE;
  const greenToken = import.meta.env.GREEN_API_TOKEN || process.env.GREEN_API_TOKEN;
  const greenRecipient = import.meta.env.GREEN_API_NOTIFY_TO || process.env.GREEN_API_NOTIFY_TO;
  const greenBase = import.meta.env.GREEN_API_URL || process.env.GREEN_API_URL || 'https://api.green-api.com';

  if (greenInstance || greenToken || greenRecipient) {
    if (!greenInstance || !greenToken || !greenRecipient) {
      return json(503, { ok: false, error: 'GREEN-API configuration incomplete' });
    }
    const number = String(greenRecipient).replace(/\D/g, '');
    if (!/^\d{6,15}$/.test(String(greenInstance)) || !/^\d{8,15}$/.test(number)) {
      return json(503, { ok: false, error: 'Notification configuration invalid' });
    }
    let apiHost: URL;
    try {
      apiHost = new URL(greenBase);
      if (apiHost.protocol !== 'https:' ||
          !/^(?:[a-z0-9-]+\.)*(?:green-api\.com|greenapi\.com)$/.test(apiHost.hostname) ||
          apiHost.username || apiHost.password || apiHost.search || apiHost.hash) {
        throw new Error('Invalid API host');
      }
    } catch {
      return json(503, { ok: false, error: 'Notification API URL invalid' });
    }
    const total = payload.priceOnRequest ? 'Price on request' :
      payload.totalPrice != null && Number.isFinite(payload.totalPrice) ? payload.totalPrice + ' EUR' : 'Not available';
    const message = [
      '🎈 *NEW RESERVATION REQUEST — CAPPADOCIAGO*',
      '*Tour:* ' + payload.tourTitle,
      '*Date:* ' + payload.date,
      '*Guests:* ' + payload.people,
      '*Name:* ' + payload.name,
      '*Phone:* ' + payload.phone,
      '*Total:* ' + total,
      payload.message ? '*Note:* ' + payload.message : '',
      '*Status:* Awaiting confirmation'
    ].filter(Boolean).join('\n');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const base = apiHost.origin + apiHost.pathname.replace(/\/$/, '');
      const endpoint = base + '/waInstance' + greenInstance + '/sendMessage/' + encodeURIComponent(greenToken);
      const upstream = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ chatId: number + '@c.us', message, linkPreview: false }),
        signal: controller.signal,
      });
      if (!upstream.ok) {
        console.error('GREEN-API message request failed', upstream.status);
        return json(502, { ok: false, error: 'Notification service rejected the request' });
      }
      const result = await upstream.json().catch(() => null);
      if (!result?.idMessage) return json(502, { ok: false, error: 'Notification was not accepted' });
      return json(200, { ok: true });
    } catch {
      console.error('GREEN-API request could not complete');
      return json(502, { ok: false, error: 'Notification service unavailable' });
    } finally {
      clearTimeout(timer);
    }
  }

  const webhookUrl = import.meta.env.WHATSAPP_BOT_WEBHOOK_URL || process.env.WHATSAPP_BOT_WEBHOOK_URL;
  const webhookSecret = import.meta.env.WHATSAPP_BOT_WEBHOOK_SECRET || process.env.WHATSAPP_BOT_WEBHOOK_SECRET;
  if (!webhookUrl || !webhookSecret) {
    console.error('WhatsApp bot webhook environment variables are missing');
    return json(503, { ok: false, error: 'Notification service is not configured' });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const upstream = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-bot-secret': webhookSecret,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!upstream.ok) {
      const detail = (await upstream.text()).slice(0, 300);
      console.error('WhatsApp bot webhook error', upstream.status, detail);
      return json(502, { ok: false, error: 'Notification service rejected the request' });
    }
    return json(200, { ok: true });
  } catch (error) {
    console.error('WhatsApp bot webhook unavailable', error);
    return json(502, { ok: false, error: 'Notification service unavailable' });
  } finally {
    clearTimeout(timer);
  }
};

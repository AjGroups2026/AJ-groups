/* Bun Bun orders backend: one Cloudflare Worker plus one KV store. Runs on the free plan.
   Setup steps are in SETUP.md. Secrets (BAKER_CODE, Telegram token) live in Cloudflare settings, never in this file or the website. */

const json = (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer' } });
const str = (v, n) => String(v == null ? '' : v).slice(0, n);
const num = (v, lo, hi) => { const n = Number(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : 0; };
const same = (a, b) => { a = String(a); b = String(b); if (a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; };
const KEEP = 60 * 60 * 24 * 180;   // personal details are removed automatically after 180 days
const PAY_CUSTOMER = ['started', 'claimed', 'later'], PAY_BAKER = ['none', 'started', 'claimed', 'confirmed', 'later'];

export default {
  async fetch(req, env, ctx) {
    const allow = env.ALLOW_ORIGIN || '*', cors = { 'access-control-allow-origin': allow, 'access-control-allow-headers': 'content-type, x-baker-code', 'access-control-allow-methods': 'GET, POST, PATCH, DELETE, OPTIONS', 'access-control-max-age': '86400', vary: 'origin' };
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    let res;
    try {
      const origin = req.headers.get('origin');
      if (allow !== '*' && origin && origin !== allow) res = json({ error: 'origin' }, 403); else res = await route(req, env, ctx);
    } catch (e) { res = json({ error: 'server' }, 500); }
    Object.entries(cors).forEach(([k, v]) => res.headers.set(k, v)); return res;
  }
};

async function route(req, env, ctx) {
  const url = new URL(req.url), p = url.pathname.replace(/\/+$/, ''), m = req.method;
  if (p === '' || p === '/' || p === '/api') return json({ ok: true, service: 'bun-bun-orders' });
  /* ----- customers ----- */
  if (p === '/api/orders' && m === 'POST') return create(req, env, ctx);
  let x = p.match(/^\/api\/orders\/([A-Za-z0-9-]{3,20})\/status$/);
  if (x && m === 'GET') { const o = await load(env, x[1]); if (!o || !same(o.token, url.searchParams.get('t') || '')) return json({ error: 'not found' }, 404); return json({ stage: o.stage, pay: o.pay }); }
  x = p.match(/^\/api\/orders\/([A-Za-z0-9-]{3,20})\/pay$/);
  if (x && m === 'POST') {
    const b = await body(req), o = await load(env, x[1]); if (!o || !same(o.token, str(b.t, 40))) return json({ error: 'not found' }, 404);
    if (o.pay && o.pay.state === 'confirmed') return json({ ok: true }); if (!PAY_CUSTOMER.includes(b.state)) return json({ error: 'state' }, 400);
    o.pay = { state: b.state, amount: num(b.amount, 0, 500000), kind: b.kind === 'full' ? 'full' : 'deposit' }; o.updated = Date.now(); await env.ORDERS.put('order:' + o.id, JSON.stringify(o), { expirationTtl: KEEP });
    if (b.state === 'claimed') ctx.waitUntil(tell(env, `Payment claimed for ${o.id}: Rs ${o.pay.amount}. Check your UPI app, then tap "Payment received" in the baker page.`)); return json({ ok: true });
  }
  /* ----- baker ----- */
  if (p.startsWith('/api/orders')) {
    const ip = req.headers.get('cf-connecting-ip') || 'x', fk = 'fail:' + ip, fails = Number((await env.ORDERS.get(fk)) || 0);
    if (fails >= 8) return json({ error: 'locked' }, 429);   // too many wrong codes: locked for 15 minutes
    if (!env.BAKER_CODE || env.BAKER_CODE.length < 12 || !same(req.headers.get('x-baker-code') || '', env.BAKER_CODE)) { await env.ORDERS.put(fk, String(fails + 1), { expirationTtl: 900 }); await new Promise((r) => setTimeout(r, 400)); return json({ error: 'unauthorized' }, 401); }
    if (p === '/api/orders' && m === 'GET') {
      const idx = JSON.parse((await env.ORDERS.get('idx')) || '[]').slice(0, 120), all = await Promise.all(idx.map((id) => load(env, id)));
      return json({ orders: all.filter(Boolean).map(({ token, ...o }) => o) });
    }
    x = p.match(/^\/api\/orders\/([A-Za-z0-9-]{3,20})$/);
    if (x && m === 'DELETE') { await env.ORDERS.delete('order:' + x[1]); const idx = JSON.parse((await env.ORDERS.get('idx')) || '[]').filter((i) => i !== x[1]); await env.ORDERS.put('idx', JSON.stringify(idx)); return json({ ok: true }); }
    if (x && m === 'PATCH') {
      const b = await body(req), o = await load(env, x[1]); if (!o) return json({ error: 'not found' }, 404);
      if (b.stage !== undefined && b.stage !== null) o.stage = Math.round(num(b.stage, 0, 6));
      if (b.at !== undefined) o.at = num(b.at, 0, Date.now() + 1e9);
      if (b.pay && PAY_BAKER.includes(b.pay.state)) o.pay = { state: b.pay.state, amount: num(b.pay.amount, 0, 500000), kind: b.pay.kind === 'full' ? 'full' : 'deposit', confirmedAt: b.pay.state === 'confirmed' ? Date.now() : undefined };
      if (b.bakerNote !== undefined) o.bakerNote = str(b.bakerNote, 500);
      o.updated = Date.now(); await env.ORDERS.put('order:' + o.id, JSON.stringify(o), { expirationTtl: KEEP }); const { token, ...out } = o; return json({ order: out });
    }
  }
  return json({ error: 'not found' }, 404);
}

async function create(req, env, ctx) {
  const b = await body(req); if (b.hp) return json({ ok: true });   // hidden field filled in by bots
  const phone = String(b.phone || '').replace(/\D/g, ''); if (phone.length < 7 || phone.length > 15 || !str(b.who, 80).trim()) return json({ error: 'invalid' }, 400);
  let id = '', tries = 0; do { id = 'BB-' + (1000 + Math.floor(Math.random() * 9000)); tries++; } while ((await env.ORDERS.get('order:' + id)) && tries < 8);
  const o = { id, token: crypto.randomUUID().replace(/-/g, '').slice(0, 20), at: Date.now(), who: str(b.who, 80), phone, summary: str(b.summary, 700), total: num(b.total, 0, 500000), when: str(b.when, 80), slot: str(b.slot, 40), delivery: !!b.delivery, notes: str(b.notes, 300), eta: num(b.eta, 0, 300), stage: 0, pay: null };
  await env.ORDERS.put('order:' + id, JSON.stringify(o), { expirationTtl: KEEP });
  const idx = JSON.parse((await env.ORDERS.get('idx')) || '[]'); idx.unshift(id); await env.ORDERS.put('idx', JSON.stringify(idx.slice(0, 300)));
  ctx.waitUntil(tell(env, `New order ${id} from ${o.who}. Total Rs ${o.total}. ${o.delivery ? 'Delivery' : 'Pickup'}: ${o.when}.`));
  return json({ id, token: o.token });
}
async function load(env, id) { const s = await env.ORDERS.get('order:' + id); return s ? JSON.parse(s) : null; }
async function body(req) { const t = await req.text(); if (t.length > 8192) throw new Error('big'); try { return JSON.parse(t || '{}'); } catch (e) { return {}; } }
async function tell(env, text) {   // optional: free Telegram message to the baker
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) return;
  try { await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text }) }); } catch (e) {}
}

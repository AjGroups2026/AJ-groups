/* Baker dashboard: see orders, confirm payments, move each order along. */
import { makeStore } from '../store.js?v=2';
import { stepsFor } from '../tracker.js?v=4';
import { BACKEND, TRACKER } from '../menu.js?v=15';

const $ = (id) => document.getElementById(id), store = makeStore(BACKEND);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const inr = (n) => '₹' + Math.round(n || 0).toLocaleString('en-IN');
let code = '', orders = [], tab = 'new', known = null, audio = null, timer = 0;
try { code = sessionStorage.getItem('bbcode') || localStorage.getItem('bbcode') || ''; } catch (e) {}
let idleAt = Date.now(); ['click', 'keydown', 'touchstart'].forEach((ev) => addEventListener(ev, () => { idleAt = Date.now(); }, { passive: true }));

/* ---------- stage and payment helpers ---------- */
const lastIdx = (o) => stepsFor(o.delivery).length - 1;
const stageOf = (o) => (o.stage != null ? Math.min(lastIdx(o), Math.max(0, o.stage | 0)) : store.remote ? 0 : Math.min(lastIdx(o), Math.floor((Date.now() - o.at) / (TRACKER.stepSeconds * 1000))));
const ps = (o) => (o.pay && o.pay.state) || 'none';
const needs = (o) => stageOf(o) <= 1 || ps(o) === 'claimed';
const group = (o) => (stageOf(o) >= lastIdx(o) ? 'done' : needs(o) ? 'new' : 'prog');
const ago = (t) => { const m = Math.max(0, Math.round((Date.now() - t) / 60000)); return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : m < 1440 ? Math.round(m / 60) + ' h ago' : Math.round(m / 1440) + ' d ago'; };
const phoneNum = (p) => { const d = String(p || '').replace(/\D/g, ''); return d.length === 10 ? '91' + d : d; };

/* ---------- alerts for new orders ---------- */
function beep() { try { audio = audio || new (window.AudioContext || window.webkitAudioContext)(); const o = audio.createOscillator(), g = audio.createGain(); o.connect(g); g.connect(audio.destination); o.type = 'sine'; o.frequency.value = 880; g.gain.setValueAtTime(.0001, audio.currentTime); g.gain.exponentialRampToValueAtTime(.25, audio.currentTime + .02); g.gain.exponentialRampToValueAtTime(.0001, audio.currentTime + .5); o.start(); o.stop(audio.currentTime + .55); } catch (e) {} }
function notify(n) { document.title = `(${n}) New order · Bun Bun Baker`; beep(); try { if ('Notification' in window && Notification.permission === 'granted') new Notification('New Bun Bun order', { body: `${n} new order${n > 1 ? 's' : ''} to look at`, icon: 'icon-192.png' }); } catch (e) {} if (navigator.vibrate) navigator.vibrate([120, 60, 120]); }

/* ---------- rendering ---------- */
function payChip(o) {
  const s = ps(o), p = o.pay || {}, amt = p.amount ? ' · ' + inr(p.amount) + (p.kind === 'full' ? ' in full' : ' deposit') : '';
  if (s === 'confirmed') return '<span class="chip ok">Payment confirmed' + amt + '</span>';
  if (s === 'claimed') return '<span class="chip warn">Customer says paid' + amt + ': check your UPI app</span>';
  if (s === 'later') return '<span class="chip">Pay on ' + (o.delivery ? 'delivery' : 'pickup') + '</span>';
  return '<span class="chip bad">Not paid yet</span>';
}
function card(o) {
  const st = stepsFor(o.delivery), idx = stageOf(o), last = idx >= st.length - 1, s = ps(o), num = phoneNum(o.phone);
  const wa = num ? `https://wa.me/${num}?text=${encodeURIComponent(`Hi ${String(o.who || '').split(' ')[0]}, update on your Bun Bun order ${o.id}: ${st[idx].t}. ${st[idx].now}`)}` : '';
  return `<article class="card glass" data-id="${esc(o.id)}">
    <div class="top"><div><h3>${esc(o.id)} · ${esc(String(o.who || '').split(' · ')[0])}</h3><small>${ago(o.at)} · ${esc(o.delivery ? 'Delivery' : 'Pickup')}</small></div><span class="chip ${last ? 'ok' : ''}">${esc(st[idx].t)}</span></div>
    <div class="sum">${esc(o.summary || (o.who || ''))}</div>
    <div class="meta"><span>When: <b>${esc(o.when || 'to confirm')}</b></span>${o.total ? `<span>Total: <b>${inr(o.total)}</b></span>` : ''}${o.notes ? `<span>Notes: <b>${esc(o.notes)}</b></span>` : ''}</div>
    <div class="paybar">${payChip(o)}${s !== 'confirmed' ? '<button class="btn sm" data-a="paid" type="button">Payment received ✓</button>' : '<button class="btn ghost sm" data-a="unpaid" type="button">Undo</button>'}</div>
    <div class="steps" aria-label="Progress">${st.map((_, i) => `<i class="${i <= idx ? 'on' : ''}"></i>`).join('')}</div>
    <div class="acts">${idx > 0 ? '<button class="btn ghost sm" data-a="back" type="button">← Back</button>' : ''}${!last ? `<button class="btn sm" data-a="next" type="button">${esc(st[idx + 1].t)} →</button>` : '<span class="chip ok">All done</span>'}${num ? `<a class="btn ghost sm" href="tel:+${num}">Call</a><a class="btn ghost sm" href="${wa}" target="_blank" rel="noopener">WhatsApp</a>` : ''}</div>
    <div class="acts"><button class="btn ghost sm" data-a="del" type="button">Delete order</button></div>
    <textarea data-a="note" placeholder="Private note for the kitchen" aria-label="Private note">${esc(o.bakerNote || '')}</textarea>
  </article>`;
}
function render() {
  const g = { new: [], prog: [], done: [] }; orders.forEach((o) => g[group(o)].push(o));
  $('tabs').innerHTML = [['new', 'Needs action'], ['prog', 'In progress'], ['done', 'Done']].map(([k, l]) => `<button class="tab" role="tab" data-t="${k}" aria-pressed="${tab === k}">${l}<b>${g[k].length}</b></button>`).join('');
  const rows = g[tab].slice().sort((a, b) => (tab === 'done' ? b.at - a.at : a.at - b.at));
  const active = document.activeElement; if (active && active.tagName === 'TEXTAREA' && $('list').contains(active)) return;   // do not wipe a note while typing
  $('list').innerHTML = rows.length ? rows.map(card).join('') : `<div class="empty glass">${tab === 'new' ? 'No orders need action right now.' : tab === 'prog' ? 'Nothing in progress.' : 'No finished orders yet.'}</div>`;
}

/* ---------- data ---------- */
async function refresh() {
  try {
    orders = (await store.list(code)) || []; $('loginErr').textContent = '';
    const ids = new Set(orders.map((o) => o.id)); if (known) { const fresh = orders.filter((o) => !known.has(o.id)).length; if (fresh) notify(fresh); } known = ids; render();
  } catch (e) { if (e.status === 401) { signOut('That code is not right.'); } else $('modeLine').textContent = 'Cannot reach the backend. Retrying…'; }
}
async function patch(id, p) { const o = orders.find((x) => x.id === id); if (!o) return; Object.assign(o, p); render(); try { await store.update(id, p, code); } catch (e) { $('modeLine').textContent = 'Could not save. Check your connection.'; } }
$('list').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-a]'); if (!b) return; const id = b.closest('.card').dataset.id, o = orders.find((x) => x.id === id), a = b.dataset.a; if (!o) return;
  if (a === 'paid') patch(id, { pay: { ...(o.pay || {}), state: 'confirmed', confirmedAt: Date.now() } });
  else if (a === 'unpaid') patch(id, { pay: { ...(o.pay || {}), state: 'none' } });
  else if (a === 'next') { const to = stageOf(o) + 1; if (to === 2 && ps(o) !== 'confirmed' && ps(o) !== 'later' && !confirm('Payment is not confirmed yet. Start baking anyway?')) return; patch(id, { stage: to }); }
  else if (a === 'back') patch(id, { stage: Math.max(0, stageOf(o) - 1) });
  else if (a === 'del') { if (confirm(`Delete ${o.id} and the customer's details for good?`)) { orders = orders.filter((x) => x.id !== id); render(); store.remove(id, code).catch(() => {}); } }
});
$('list').addEventListener('focusout', (e) => { if (e.target.dataset && e.target.dataset.a === 'note') { const id = e.target.closest('.card').dataset.id, o = orders.find((x) => x.id === id); if (o && (o.bakerNote || '') !== e.target.value) patch(id, { bakerNote: e.target.value.slice(0, 500) }); } });
$('tabs').addEventListener('click', (e) => { const b = e.target.closest('.tab'); if (b) { tab = b.dataset.t; render(); } });

/* ---------- toolbar ---------- */
$('bNotify').addEventListener('click', async () => { beep(); try { if ('Notification' in window) { const r = await Notification.requestPermission(); $('bNotify').textContent = r === 'granted' ? 'Alerts on' : 'Alerts blocked'; } } catch (e) {} });
$('bCsv').addEventListener('click', () => {
  const head = ['Order', 'Created', 'Name', 'Phone', 'Total', 'Payment', 'Stage', 'When', 'Type', 'Summary'], q = (v) => { let t = String(v == null ? '' : v).replace(/\r?\n/g, ' | '); if (/^[=+\-@\t\r]/.test(t)) t = "'" + t; return '"' + t.replace(/"/g, '""') + '"'; };   // a leading = + - @ could run as a spreadsheet formula, so it is defused
  const rows = orders.map((o) => [o.id, new Date(o.at).toISOString(), o.who, o.phone, o.total, ps(o), stepsFor(o.delivery)[stageOf(o)].t, o.when, o.delivery ? 'Delivery' : 'Pickup', o.summary].map(q).join(','));
  const url = URL.createObjectURL(new Blob([[head.join(','), ...rows].join('\n')], { type: 'text/csv' })), a = document.createElement('a'); a.href = url; a.download = 'bun-bun-orders.csv'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 3000);
});
$('bOut').addEventListener('click', () => signOut(''));

/* ---------- sign in ---------- */
function start() {
  $('login').hidden = true; $('app').hidden = false; $('demoBanner').hidden = store.remote; $('modeLine').textContent = store.remote ? 'Connected · updates every 15 seconds' : 'Demo mode · orders on this device';
  refresh(); clearInterval(timer); timer = setInterval(() => { if (store.remote && !localStorage.getItem('bbcode') && Date.now() - idleAt > 20 * 60000) { signOut('Signed out after 20 minutes of no activity.'); return; } refresh(); }, store.remote ? 15000 : 2000);
}
function signOut(msg) { clearInterval(timer); try { localStorage.removeItem('bbcode'); sessionStorage.removeItem('bbcode'); } catch (e) {} code = ''; $('app').hidden = true; $('login').hidden = false; $('loginErr').textContent = msg || ''; known = null; }
$('loginForm').addEventListener('submit', async (e) => { e.preventDefault(); code = $('code').value.trim(); beep(); try { await store.list(code); try { (($('keep') && $('keep').checked) ? localStorage : sessionStorage).setItem('bbcode', code); } catch (x) {} start(); } catch (x) { $('loginErr').textContent = x.status === 401 ? 'That code is not right.' : 'Cannot reach the backend. Check the address in menu.js.'; } });
if (!store.remote) start(); else if (code) store.list(code).then(start).catch(() => { $('login').hidden = false; }); else $('login').hidden = false;
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

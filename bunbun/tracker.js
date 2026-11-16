/* Bun Bun order tracker. In this draft it follows a timer so you can see how it will feel.
   When orders are connected to a real service, replace stageOf() with the status that comes back (TRACKER in menu.js). */
const ICON = {
  placed: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
  confirmed: '<path d="M6 3h4l1.5 4-2 1.5a11 11 0 0 0 6 6l1.5-2 4 1.5v4a2 2 0 0 1-2 2A15 15 0 0 1 4 5a2 2 0 0 1 2-2z"/>',
  baking: '<rect x="3" y="5" width="18" height="15" rx="3"/><path d="M3 10h18"/><circle cx="12" cy="15.5" r="2.5"/>',
  decorating: '<path d="M12 3l2.4 5 5.6.7-4.1 3.9 1 5.6L12 15.6 7.1 18.2l1-5.6L4 8.7 9.6 8z"/>',
  packed: '<path d="M3 8l9-5 9 5v9l-9 5-9-5z"/><path d="M3 8l9 5 9-5M12 13v9"/>',
  out: '<circle cx="6" cy="17" r="3"/><circle cx="18" cy="17" r="3"/><path d="M9 17h6l2-8h-3M6 9h4"/>',
  ready: '<path d="M5 8h14l-1 12H6z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
  done: '<circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/>'
};
export const stepsFor = (delivery) => [
  { k: 'placed', t: 'Order received', now: 'We have your order request. A baker will call you shortly.' },
  { k: 'confirmed', t: 'Baker confirmed', now: 'A baker has confirmed your design and date.' },
  { k: 'baking', t: 'Baking', now: 'Your cake is in the oven.' },
  { k: 'decorating', t: 'Decorating', now: 'Piping, finishing and writing your message.' },
  { k: 'packed', t: 'Packed with love', now: 'Boxed with ribbon and ready to go.' },
  delivery ? { k: 'out', t: 'Out for delivery', now: 'On its way to you.' } : { k: 'ready', t: 'Ready for pickup', now: 'Ready for you at the kitchen.' },
  { k: 'done', t: delivery ? 'Delivered' : 'Collected', now: delivery ? 'Delivered. Enjoy every slice.' : 'Collected. Enjoy every slice.' }
];

export function initTracker(c) {
  const { $, T, reduce, store } = c, sec = $('track');
  const mine = () => (store.remote ? store.mine() : store.localAll());
  let cur = mine()[0] || null, built = '';
  const stageOf = (o) => { const max = stepsFor(o.delivery).length - 1; if (store.remote || o.stage != null) return Math.min(max, Math.max(0, o.stage | 0)); return Math.min(max, Math.floor((Date.now() - o.at) / (T.stepSeconds * 1000))); };
  const inr = (n) => '₹' + Math.round(n).toLocaleString('en-IN');
  function build() {
    const st = stepsFor(cur.delivery), key = cur.id + (cur.delivery ? 'd' : 'p'); if (built === key) return; built = key;
    $('trkSteps').style.setProperty('--n', st.length);
    $('trkSteps').innerHTML = '<span class="trkline" aria-hidden="true"><i></i></span>' + st.map((s, i) => `<li class="trs" data-i="${i}"><span class="tri"><svg viewBox="0 0 24 24" aria-hidden="true">${ICON[s.k]}</svg></span><b>${s.t}</b></li>`).join('');
    $('trkId').textContent = cur.id; $('trkFor').textContent = cur.who; $('trkWhenL').textContent = cur.delivery ? 'Delivery' : 'Pickup'; $('trkWhen').textContent = cur.when;
  }
  function payText(p) {
    if (!p) return ''; const kind = p.kind === 'full' ? 'in full' : 'deposit', amt = p.amount ? inr(p.amount) + ' ' + kind : '';
    return p.state === 'confirmed' ? `Payment confirmed${amt ? ': ' + amt : ''}. Thank you.` : p.state === 'claimed' ? `Payment: ${amt} marked as paid. The baker is checking it and will confirm.` : p.state === 'started' ? 'Payment page opened. Tap "I\'ve paid" once you have paid.' : p.state === 'later' ? 'Payment: on ' + (cur.delivery ? 'delivery' : 'pickup') + '.' : p.state === 'demo' ? 'Payment: not connected in this draft.' : '';
  }
  function update() {
    if (!cur) return; if (!store.remote) { const f = store.localAll().find((x) => x.id === cur.id); if (f) cur = f; }
    build(); const st = stepsFor(cur.delivery), idx = stageOf(cur), ol = $('trkSteps');
    ol.style.setProperty('--p', (idx / (st.length - 1)).toFixed(3));
    [...ol.querySelectorAll('.trs')].forEach((li, i) => { li.classList.toggle('done', i < idx || (idx === st.length - 1 && i === idx)); li.classList.toggle('now', i === idx && idx < st.length - 1); if (i === idx) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current'); });
    let msg = st[idx].now; if (st[idx].k === 'out' && cur.eta) { if (store.remote || cur.stage != null) msg = `On its way to you. About ${cur.eta} min on the road.`; else { const left = Math.max(1, Math.round(cur.eta * (1 - ((Date.now() - cur.at) / 1000 - idx * T.stepSeconds) / T.stepSeconds))); msg = `On its way to you. Arriving in about ${left} min.`; } }
    $('trkNow').textContent = msg; $('trkDemo').hidden = !(T.demo && !store.remote); $('trkPay').textContent = payText(cur.pay);
  }
  function setPay(id, p) { if (!cur || cur.id !== id) return; cur.pay = p; update(); store.customerPay(cur, p).catch(() => {}); }
  function show(o) { cur = o; built = ''; sec.hidden = false; update(); }
  async function add(o) {
    const rec = await store.create(o); show(rec); if (!o.noScroll) setTimeout(() => sec.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' }), 350); return rec.id;
  }
  $('trkFind').addEventListener('submit', (e) => { e.preventDefault(); const q = $('trkQ').value.trim().toUpperCase(), f = mine().find((o) => o.id === q), m = $('trkFindMsg'); if (f) { m.textContent = ''; show(f); } else m.textContent = 'No order with that number on this device.'; });
  $('trkReplay').hidden = store.remote;
  $('trkReplay').addEventListener('click', async () => { if (!cur || store.remote) return; await store.update(cur.id, { at: Date.now(), stage: null, pay: null }); built = ''; update(); });
  if (cur) show(cur);
  setInterval(update, 1000);
  if (store.remote) setInterval(async () => { if (!cur || !cur.token) return; try { const s = await store.status(cur); if (s) { cur.stage = s.stage; cur.pay = s.pay; update(); } } catch (e) {} }, 12000);
  return { add, setPay };
}

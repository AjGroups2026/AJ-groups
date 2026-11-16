/* Order data layer, used by the customer site (tracker, pay) and the baker dashboard.
   Demo mode (no BACKEND.url): orders live in this browser only, so the dashboard and the site work together on one device.
   Connected mode (BACKEND.url set): orders go to the free Cloudflare backend in /server and every device sees the same orders. */
const LOCAL = 'bborders', MINE = 'bbmine';
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || d); } catch (e) { return JSON.parse(d); } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };

export function makeStore(BACKEND) {
  const api = (BACKEND && BACKEND.url ? BACKEND.url : '').replace(/\/+$/, ''), remote = !!api;
  async function call(path, opt = {}, code) {
    const r = await fetch(api + path, { ...opt, headers: { 'content-type': 'application/json', ...(code ? { 'x-baker-code': code } : {}), ...(opt.headers || {}) } });
    if (!r.ok) { const e = new Error('http ' + r.status); e.status = r.status; throw e; }
    return r.json();
  }
  return {
    remote,
    /* ---- customer side ---- */
    mine() { return read(MINE, '[]'); },
    async create(o) {
      if (!remote) { const rec = { id: 'BB-' + (Math.floor(Math.random() * 9000) + 1000), at: Date.now(), stage: null, pay: null, ...o }; const all = read(LOCAL, '[]'); all.unshift(rec); write(LOCAL, all.slice(0, 60)); return rec; }
      const r = await call('/api/orders', { method: 'POST', body: JSON.stringify(o) });
      const rec = { id: r.id, token: r.token, at: Date.now(), stage: 0, pay: null, who: o.who, when: o.when, delivery: o.delivery, eta: o.eta || 0 };
      const mine = read(MINE, '[]'); mine.unshift(rec); write(MINE, mine.slice(0, 6)); return rec;
    },
    async status(rec) {
      if (!remote) { const f = read(LOCAL, '[]').find((x) => x.id === rec.id); return f ? { stage: f.stage, pay: f.pay } : null; }
      return call(`/api/orders/${encodeURIComponent(rec.id)}/status?t=${encodeURIComponent(rec.token || '')}`);
    },
    async customerPay(rec, pay) {
      if (!remote) { const all = read(LOCAL, '[]'), f = all.find((x) => x.id === rec.id); if (f) { f.pay = pay; write(LOCAL, all); } return; }
      await call(`/api/orders/${encodeURIComponent(rec.id)}/pay`, { method: 'POST', body: JSON.stringify({ t: rec.token, ...pay }) });
    },
    localAll() { return read(LOCAL, '[]'); },
    /* ---- baker side ---- */
    async list(code) { if (!remote) return read(LOCAL, '[]'); return (await call('/api/orders', {}, code)).orders; },
    async remove(id, code) { if (!remote) { write(LOCAL, read(LOCAL, '[]').filter((x) => x.id !== id)); return; } await call('/api/orders/' + encodeURIComponent(id), { method: 'DELETE' }, code); },
    async update(id, patch, code) {
      if (!remote) { const all = read(LOCAL, '[]'), f = all.find((x) => x.id === id); if (f) { Object.assign(f, patch); write(LOCAL, all); } return f; }
      return (await call('/api/orders/' + encodeURIComponent(id), { method: 'PATCH', body: JSON.stringify(patch) }, code)).order;
    }
  };
}

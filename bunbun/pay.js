/* "Pay now" step shown after an order request.
   It works as soon as PAYMENT in menu.js has a payment link and/or a UPI id. Until then it explains that payment is not connected. */
export function initPay({ $, inr, PAY, TK }) {
  const box = $('paybox'); let ctx = null, choice = 'deposit';
  const live = () => !!(PAY.link || PAY.upiId), phone = /Android|iPhone|iPad/i.test(navigator.userAgent);
  const amount = () => (choice === 'later' ? 0 : choice === 'full' ? ctx.total : Math.round(ctx.total * PAY.depositPercent / 100));
  const modal = document.createElement('div'); modal.className = 'shm'; modal.hidden = true; modal.setAttribute('role', 'dialog'); modal.setAttribute('aria-modal', 'true'); modal.setAttribute('aria-label', 'Payment');
  modal.innerHTML = '<div class="shb"><button type="button" class="shx" aria-label="Close">✕</button><h3 style="margin:6px 0 10px;font-family:var(--disp);font-weight:500;font-size:22px">Payment is not connected yet</h3><p class="shmsg" style="font-size:14px;line-height:1.6;color:var(--ink)">In the live site this opens the secure payment page with your amount already filled in. Nothing has been charged.</p><div class="shr" style="margin-top:14px"><button type="button" class="btn" id="payOk">Got it</button></div></div>';
  document.body.appendChild(modal); const close = () => { modal.hidden = true; document.body.style.overflow = ''; };
  modal.addEventListener('click', (e) => { if (e.target === modal || e.target.closest('.shx') || e.target.closest('#payOk')) close(); }); addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modal.hidden) close(); });
  const opts = () => [['deposit', `Pay ${PAY.depositPercent}% now · ${inr(Math.round(ctx.total * PAY.depositPercent / 100))}`], ...(PAY.allowFull ? [['full', `Pay in full · ${inr(ctx.total)}`]] : []), ['later', ctx.delivery ? 'Pay on delivery' : 'Pay at pickup']];
  function render() {
    const a = amount(), later = choice === 'later';
    box.innerHTML = `<h3>Confirm with a payment</h3><p class="paysub">Custom cakes are baked to order, so we ask for an advance. The rest is paid on ${ctx.delivery ? 'delivery' : 'pickup'}.</p><div class="chips" id="payOpts">${opts().map(([k, l]) => `<button type="button" class="chip${k === choice ? ' on' : ''}" data-k="${k}" aria-pressed="${k === choice}">${l}</button>`).join('')}</div><div class="payrow"><div><span class="mono">You pay now</span><b>${inr(a)}</b></div><button type="button" class="btn" id="payGo">${later ? 'Continue without paying' : 'Pay now'}</button></div><p class="paynote" id="payNote" role="status">${live() ? 'A secure payment page opens. We never see your card or bank details.' : 'Draft: the payment link is not connected yet, so nothing is charged.'}</p>`;
    $('payOpts').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { choice = b.dataset.k; render(); }));
    $('payGo').addEventListener('click', go);
  }
  function go() {
    const a = amount(), note = $('payNote'), kind = choice;
    if (kind === 'later') { TK.setPay(ctx.id, { state: 'later', kind }); note.textContent = 'No problem. The baker will confirm the amount on the call.'; return; }
    if (!live()) { TK.setPay(ctx.id, { state: 'demo', amount: a, kind }); modal.hidden = false; document.body.style.overflow = 'hidden'; return; }
    if (PAY.upiId && (phone || !PAY.link)) location.href = `upi://pay?pa=${encodeURIComponent(PAY.upiId)}&pn=${encodeURIComponent(PAY.payeeName)}&am=${a}&cu=INR&tn=${encodeURIComponent('Bun Bun order ' + ctx.id)}`;
    else window.open(PAY.link, '_blank', 'noopener');
    TK.setPay(ctx.id, { state: 'started', amount: a, kind }); note.textContent = `Payment page opened. When you have paid, come back and tap "I've paid".`;
    if (!$('payDone')) { note.insertAdjacentHTML('afterend', "<button type=\"button\" class=\"btn\" id=\"payDone\">I've paid</button>"); $('payDone').onclick = () => { TK.setPay(ctx.id, { state: 'claimed', amount: a, kind }); $('payDone').remove(); note.textContent = 'Thank you. The baker will confirm once the money arrives.'; }; }
  }
  return { show(o) { if (!o.total) { box.hidden = true; return; } ctx = o; choice = 'deposit'; box.hidden = false; render(); } };
}

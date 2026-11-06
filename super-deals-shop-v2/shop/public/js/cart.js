(async function () {
  'use strict';
  await Shop.init('');
  const root = document.getElementById('cart-root');

  async function loadDetailed() {
    const cart = Shop.cartGet();
    if (!cart.length) return [];
    const results = await Promise.all(
      cart.map(async (row) => {
        try {
          const p = await Shop.api('/api/products/product/' + row.id);
          return { p, qty: row.qty };
        } catch (_) {
          return null; // product removed/unavailable
        }
      })
    );
    const valid = results.filter(Boolean);
    // Prune any items that disappeared
    if (valid.length !== cart.length) {
      Shop.cartGet()
        .filter((r) => !valid.find((v) => v.p.id === r.id))
        .forEach((r) => Shop.cartRemove(r.id));
    }
    return valid;
  }

  function render(items) {
    if (!items.length) {
      root.innerHTML = `
        <div class="empty" style="margin:20px 0">
          <div class="big">🛒</div>
          <h3>Your cart is empty</h3>
          <p>Browse the deals and add something you love.</p>
          <p style="margin-top:16px"><a class="btn" href="/">Start shopping</a></p>
        </div>`;
      return;
    }
    const subtotal = items.reduce((s, it) => s + it.p.discountedPrice * it.qty, 0);
    const youSave = items.reduce((s, it) => s + Math.max(0, it.p.originalPrice - it.p.discountedPrice) * it.qty, 0);

    root.innerHTML = `
      <div class="cart-wrap">
        <div class="cart-items">
          ${items
            .map(
              (it) => `
            <div class="cart-row" data-id="${it.p.id}">
              <a class="thumb" href="/c/${Shop.esc(it.p.category)}">${
                it.p.image ? `<img src="${Shop.esc(it.p.image)}" alt="${Shop.esc(it.p.name)}">` : ''
              }</a>
              <div class="meta">
                <div class="name">${Shop.esc(it.p.name)}</div>
                <div class="unit">${Shop.money(it.p.discountedPrice)}
                  ${it.p.originalPrice > it.p.discountedPrice ? `<span class="was">${Shop.money(it.p.originalPrice)}</span>` : ''}
                </div>
              </div>
              <div class="right">
                <div class="qty">
                  <button data-dec="${it.p.id}" aria-label="Decrease quantity">−</button>
                  <span>${it.qty}</span>
                  <button data-inc="${it.p.id}" aria-label="Increase quantity">+</button>
                </div>
                <div style="font-weight:800">${Shop.money(it.p.discountedPrice * it.qty)}</div>
                <button class="link-remove" data-del="${it.p.id}">Remove</button>
              </div>
            </div>`
            )
            .join('')}
        </div>
        <aside class="summary">
          <h3>Order Summary</h3>
          <div class="line"><span>Subtotal</span><span>${Shop.money(subtotal)}</span></div>
          ${youSave > 0 ? `<div class="line" style="color:#1f8a3b"><span>You save</span><span>−${Shop.money(youSave)}</span></div>` : ''}
          <div class="line"><span>Shipping</span><span>Calculated at checkout</span></div>
          <div class="line total"><span>Total</span><span class="amt">${Shop.money(subtotal)}</span></div>
          <button class="btn btn--lg btn--block" id="checkout" style="margin-top:16px">Secure Checkout</button>
          <div class="note">🔒 Payments processed securely by Stripe. Card details never touch this site.</div>
        </aside>
      </div>`;

    root.querySelector('#checkout').addEventListener('click', checkout);
  }

  async function checkout(e) {
    const btn = e.currentTarget;
    btn.disabled = true;
    btn.textContent = 'Starting secure checkout…';
    try {
      const items = Shop.cartGet().map((r) => ({ id: r.id, qty: r.qty }));
      const data = await Shop.api('/api/checkout/create-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });
      if (data && data.url) { window.location.href = data.url; return; }
      throw new Error('Could not start checkout.');
    } catch (err) {
      Shop.toast(err.message || 'Checkout failed', 'error');
      btn.disabled = false;
      btn.textContent = 'Secure Checkout';
    }
  }

  async function refresh() { render(await loadDetailed()); }

  // Delegated qty / remove controls
  root.addEventListener('click', (e) => {
    const inc = e.target.closest('[data-inc]');
    const dec = e.target.closest('[data-dec]');
    const del = e.target.closest('[data-del]');
    if (inc) { const id = Number(inc.dataset.inc); const cur = Shop.cartGet().find((r) => r.id === id); Shop.cartSetQty(id, (cur ? cur.qty : 0) + 1); }
    if (dec) { const id = Number(dec.dataset.dec); const cur = Shop.cartGet().find((r) => r.id === id); Shop.cartSetQty(id, (cur ? cur.qty : 1) - 1); }
    if (del) { Shop.cartRemove(Number(del.dataset.del)); }
  });

  window.addEventListener('cart:changed', refresh);
  refresh();
})();

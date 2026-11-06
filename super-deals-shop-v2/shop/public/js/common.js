/* Shared storefront logic. Brand text is a placeholder — change BRAND below. */
(function () {
  'use strict';

  const BRAND = { line1: 'Super', line2: 'Deals', tag: 'DEALS EVERY DAY' };

  // The FIVE fixed navigation tabs. Home + the four shopping categories.
  const TABS = [
    { slug: '', name: 'Home', href: '/' },
    { slug: 'fat-loss-abs', name: 'Fat Loss / Abs', href: '/c/fat-loss-abs' },
    { slug: 'clearance-deals', name: 'Clearance Deals', href: '/c/clearance-deals' },
    { slug: 'special-deals', name: 'Special Deals', href: '/c/special-deals' },
    { slug: 'limited-time-offers', name: 'Limited Time Offers', href: '/c/limited-time-offers' },
  ];

  const CART_KEY = 'deals_cart_v1';
  let currency = 'usd';

  /* ------------------------------- utils ------------------------------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
    );
  }

  async function api(path, opts) {
    const res = await fetch(path, opts);
    let data = null;
    try { data = await res.json(); } catch (_) {}
    if (!res.ok) throw new Error((data && data.error) || `Request failed (${res.status})`);
    return data;
  }

  function money(minor) {
    const v = (Number(minor) || 0) / 100;
    try {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency: currency.toUpperCase() }).format(v);
    } catch (_) {
      return '$' + v.toFixed(2);
    }
  }

  /* ------------------------------- cart ------------------------------- */
  function cartGet() {
    try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; }
    catch (_) { return []; }
  }
  function cartSave(items) {
    localStorage.setItem(CART_KEY, JSON.stringify(items));
    updateCartCount();
    window.dispatchEvent(new CustomEvent('cart:changed'));
  }
  function cartCount() { return cartGet().reduce((n, i) => n + (i.qty || 0), 0); }
  function cartAdd(id, qty) {
    id = Number(id); qty = Math.max(1, Math.floor(qty || 1));
    const items = cartGet();
    const row = items.find((i) => i.id === id);
    if (row) row.qty = Math.min(99, row.qty + qty);
    else items.push({ id, qty: Math.min(99, qty) });
    cartSave(items);
  }
  function cartSetQty(id, qty) {
    id = Number(id); qty = Math.floor(qty);
    let items = cartGet();
    if (qty <= 0) items = items.filter((i) => i.id !== id);
    else { const row = items.find((i) => i.id === id); if (row) row.qty = Math.min(99, qty); }
    cartSave(items);
  }
  function cartRemove(id) { cartSave(cartGet().filter((i) => i.id !== Number(id))); }
  function cartClear() { cartSave([]); }

  function updateCartCount() {
    const el = document.querySelector('.cart-link .count');
    if (!el) return;
    const n = cartCount();
    el.textContent = n > 99 ? '99+' : String(n);
    el.hidden = n === 0;
  }

  /* ------------------------------- toast ------------------------------- */
  function toast(msg, type) {
    let host = document.querySelector('.toast-host');
    if (!host) { host = document.createElement('div'); host.className = 'toast-host'; document.body.appendChild(host); }
    const t = document.createElement('div');
    t.className = 'toast' + (type ? ' ' + type : '');
    t.textContent = msg;
    host.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .3s'; }, 2200);
    setTimeout(() => t.remove(), 2600);
  }

  /* ------------------------------- header/footer ------------------------------- */
  function renderHeader(activeSlug) {
    const host = document.getElementById('site-header');
    if (!host) return;
    host.innerHTML = `
      <header class="site-header">
        <div class="container header-top">
          <a class="brand" href="/" aria-label="${esc(BRAND.line1 + BRAND.line2)} home">
            <span class="b1">${esc(BRAND.line1)}</span><span class="b2">${esc(BRAND.line2)}</span>
            <small>${esc(BRAND.tag)}</small>
          </a>
          <div class="header-spacer"></div>
          <a class="cart-link" href="/cart.html" aria-label="View cart">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6"/></svg>
            <span>Cart</span>
            <span class="count" hidden>0</span>
          </a>
        </div>
        <nav class="nav-tabs" aria-label="Primary">
          <div class="container">
            ${TABS.map((t) => `<a class="nav-tab${t.slug === activeSlug ? ' active' : ''}" href="${t.href}"${t.slug === activeSlug ? ' aria-current="page"' : ''}>${esc(t.name)}</a>`).join('')}
          </div>
        </nav>
      </header>`;
    updateCartCount();
  }

  function renderFooter() {
    const host = document.getElementById('site-footer');
    if (!host) return;
    host.innerHTML = `
      <footer class="site-footer">
        <div class="container">
          <div class="cols">
            <div>
              <div class="brand"><span style="color:#ff4747">${esc(BRAND.line1)}</span><span style="color:#ff6a00">${esc(BRAND.line2)}</span></div>
              <div style="max-width:280px">Unbeatable deals, every day. Shop clearance, special offers and limited-time flash deals.</div>
            </div>
            <div>
              <strong style="color:#fff;display:block;margin-bottom:8px">Shop</strong>
              ${TABS.filter((t) => t.slug).map((t) => `<a href="${t.href}" style="display:block;margin:4px 0">${esc(t.name)}</a>`).join('')}
            </div>
            <div>
              <strong style="color:#fff;display:block;margin-bottom:8px">Help</strong>
              <a href="/cart.html" style="display:block;margin:4px 0">Your Cart</a>
              <span style="display:block;margin:4px 0">Secure checkout by Stripe</span>
            </div>
          </div>
          <div class="legal">© ${new Date().getFullYear()} ${esc(BRAND.line1 + BRAND.line2)}. Secure payments powered by Stripe.</div>
        </div>
      </footer>`;
  }

  /* ------------------------------- countdowns ------------------------------- */
  function countdownParts(iso, repeatDays) {
    let end = new Date(iso).getTime();
    if (isNaN(end)) return null;
    const now = Date.now();
    // Repeating offer: roll the end forward by whole periods until it's in the future.
    const r = Number(repeatDays);
    if (r >= 1) {
      const period = r * 86400 * 1000;
      if (end <= now) {
        const cycles = Math.floor((now - end) / period) + 1;
        end += cycles * period;
      }
    }
    let diff = Math.floor((end - now) / 1000);
    if (diff <= 0) return { ended: true, text: 'Offer ended' };
    const d = Math.floor(diff / 86400); diff -= d * 86400;
    const h = Math.floor(diff / 3600); diff -= h * 3600;
    const m = Math.floor(diff / 60); const s = diff - m * 60;
    const pad = (n) => String(n).padStart(2, '0');
    const text = d > 0 ? `${d}d ${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(h)}:${pad(m)}:${pad(s)}`;
    return { ended: false, text };
  }
  function tickCountdowns() {
    document.querySelectorAll('[data-ends]').forEach((el) => {
      const p = countdownParts(el.getAttribute('data-ends'), el.getAttribute('data-repeat'));
      if (!p) { el.remove(); return; }
      const label = el.querySelector('.cd-text') || el;
      label.textContent = p.ended ? 'Offer ended' : '⏱ ' + p.text;
      el.classList.toggle('ended', p.ended);
    });
  }
  let cdTimer = null;
  function startCountdowns() { tickCountdowns(); if (cdTimer) clearInterval(cdTimer); cdTimer = setInterval(tickCountdowns, 1000); }

  /* ------------------------------- product card ------------------------------- */
  function productCardHTML(p) {
    const media = p.image
      ? `<img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy">`
      : `<div class="noimg">No image</div>`;
    const save = p.discountPct > 0 ? `<span class="badge-save">-${p.discountPct}%</span>` : '';
    const timer = p.offerEndsAt
      ? `<div class="badge-timer" data-ends="${esc(p.offerEndsAt)}"${p.offerRepeatDays ? ` data-repeat="${p.offerRepeatDays}"` : ''}><span class="cd-text">⏱</span></div>` : '';
    const was = p.originalPrice > p.discountedPrice
      ? `<span class="price-was">${money(p.originalPrice)}</span>` : '';
    const href = `/p/${p.id}`;
    return `
      <article class="pcard" data-id="${p.id}">
        <a class="media" href="${href}" aria-label="${esc(p.name)}">
          ${media}${save}${timer}
        </a>
        <div class="body">
          <a class="name" href="${href}">${esc(p.name)}</a>
          ${p.description ? `<div class="desc">${esc(p.description)}</div>` : ''}
          <div class="price-row">
            <span class="price-now">${money(p.discountedPrice)}</span>
            ${was}
          </div>
          <div class="actions">
            <button class="btn" data-add="${p.id}">Add to Cart</button>
            <button class="btn btn--accent" data-buy="${p.id}" title="Buy now">Buy Now</button>
          </div>
        </div>
      </article>`;
  }

  /* ------------------------------- actions ------------------------------- */
  async function buyNow(id) {
    try {
      const data = await api('/api/checkout/create-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: [{ id: Number(id), qty: 1 }] }),
      });
      if (data && data.url) { window.location.href = data.url; return; }
      throw new Error('Could not start checkout');
    } catch (e) {
      // Stripe not configured or error → fall back to the cart
      cartAdd(id, 1);
      toast(e.message ? e.message + ' — added to cart instead' : 'Added to cart', 'error');
      setTimeout(() => (window.location.href = '/cart.html'), 900);
    }
  }

  function wireProductActions(root) {
    (root || document).addEventListener('click', (e) => {
      const addBtn = e.target.closest('[data-add]');
      const buyBtn = e.target.closest('[data-buy]');
      if (addBtn) { cartAdd(addBtn.getAttribute('data-add'), 1); toast('Added to cart', 'success'); }
      if (buyBtn) { buyBtn.disabled = true; buyNow(buyBtn.getAttribute('data-buy')); }
    });
  }

  /* ------------------------------- boot ------------------------------- */
  async function loadConfig() {
    try { const c = await api('/api/checkout/config'); if (c && c.currency) currency = c.currency; }
    catch (_) {}
  }

  async function init(activeSlug) {
    await loadConfig();
    renderHeader(activeSlug || '');
    renderFooter();
    wireProductActions(document);
  }

  window.Shop = {
    TABS, init, api, money, toast,
    cartGet, cartAdd, cartSetQty, cartRemove, cartClear, cartCount, updateCartCount,
    productCardHTML, startCountdowns, esc, buyNow,
  };
})();

(async function () {
  'use strict';
  await Shop.init('');
  const root = document.getElementById('product-root');
  const id = Number((location.pathname.match(/^\/p\/(\d+)/) || [])[1] || new URLSearchParams(location.search).get('id'));

  if (!id) { root.innerHTML = notFound(); return; }

  let p;
  try {
    p = await Shop.api('/api/products/product/' + id);
  } catch (_) {
    root.innerHTML = notFound();
    return;
  }

  document.title = p.name + ' — Super Deals';
  const gallery = (p.images && p.images.length) ? p.images : (p.image ? [p.image] : []);
  const was = p.originalPrice > p.discountedPrice ? `<span class="pdp-was">${Shop.money(p.originalPrice)}</span>` : '';
  const saveBadge = p.discountPct > 0 ? `<span class="pdp-save">-${p.discountPct}% OFF</span>` : '';
  const timer = p.offerEndsAt
    ? `<div class="pdp-timer badge-timer" data-ends="${Shop.esc(p.offerEndsAt)}"${p.offerRepeatDays ? ` data-repeat="${p.offerRepeatDays}"` : ''} style="position:static">
         <span class="cd-text">⏱</span></div>
       ${p.offerRepeatDays ? `<span class="pdp-repeat">Deal refreshes every ${p.offerRepeatDays} day${p.offerRepeatDays > 1 ? 's' : ''}</span>` : ''}` : '';

  root.className = '';
  root.innerHTML = `
    <nav class="crumbs"><a href="/">Home</a> › <a href="/c/${Shop.esc(p.category)}">${Shop.esc(catName(p.category))}</a></nav>
    <div class="pdp">
      <div class="pdp-gallery">
        <div class="pdp-main">
          ${gallery.length ? `<img id="main-img" src="${Shop.esc(gallery[0])}" alt="${Shop.esc(p.name)}">` : `<div class="noimg" style="aspect-ratio:1;display:grid;place-items:center;color:#ccc">No image</div>`}
          ${saveBadge}
        </div>
        ${gallery.length > 1 ? `<div class="pdp-thumbs">${gallery.map((src, i) => `<button class="pdp-thumb${i === 0 ? ' active' : ''}" data-src="${Shop.esc(src)}"><img src="${Shop.esc(src)}" alt="View ${i + 1}"></button>`).join('')}</div>` : ''}
      </div>
      <div class="pdp-info">
        <h1 class="pdp-name">${Shop.esc(p.name)}</h1>
        <div class="pdp-price-row">
          <span class="pdp-now">${Shop.money(p.discountedPrice)}</span>
          ${was}
        </div>
        ${timer ? `<div class="pdp-timer-wrap">${timer}</div>` : ''}
        ${p.description ? `<p class="pdp-desc">${Shop.esc(p.description)}</p>` : ''}
        <div class="pdp-qty">
          <span>Quantity</span>
          <div class="qty">
            <button id="q-dec" aria-label="Decrease">−</button>
            <span id="q-val">1</span>
            <button id="q-inc" aria-label="Increase">+</button>
          </div>
        </div>
        <div class="pdp-actions">
          <button class="btn btn--lg" id="pdp-add">Add to Cart</button>
          <button class="btn btn--accent btn--lg" id="pdp-buy">Buy Now</button>
        </div>
        <div class="pdp-trust">🔒 Secure checkout by Stripe · Deals change fast</div>
      </div>
    </div>`;

  Shop.startCountdowns();

  // Quantity
  let qty = 1;
  const qVal = document.getElementById('q-val');
  document.getElementById('q-inc').addEventListener('click', () => { qty = Math.min(99, qty + 1); qVal.textContent = qty; });
  document.getElementById('q-dec').addEventListener('click', () => { qty = Math.max(1, qty - 1); qVal.textContent = qty; });

  // Add / Buy
  document.getElementById('pdp-add').addEventListener('click', () => { Shop.cartAdd(p.id, qty); Shop.toast('Added to cart', 'success'); });
  document.getElementById('pdp-buy').addEventListener('click', (e) => {
    e.currentTarget.disabled = true;
    // Buy Now honors the chosen quantity
    const items = [{ id: p.id, qty }];
    Shop.api('/api/checkout/create-session', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items }),
    }).then((d) => { if (d && d.url) window.location.href = d.url; else throw new Error('x'); })
      .catch((err) => { Shop.cartAdd(p.id, qty); Shop.toast((err && err.message && err.message !== 'x' ? err.message + ' — ' : '') + 'Added to cart', 'error'); setTimeout(() => location.href = '/cart.html', 800); });
  });

  // Thumbnails + lightbox
  const mainImg = document.getElementById('main-img');
  document.querySelectorAll('.pdp-thumb').forEach((t) => {
    t.addEventListener('click', () => {
      document.querySelectorAll('.pdp-thumb').forEach((x) => x.classList.remove('active'));
      t.classList.add('active');
      if (mainImg) mainImg.src = t.getAttribute('data-src');
    });
  });
  const lb = document.getElementById('lightbox');
  const lbImg = document.getElementById('lb-img');
  if (mainImg) mainImg.addEventListener('click', () => { lbImg.src = mainImg.src; lb.hidden = false; });
  lb.addEventListener('click', () => { lb.hidden = true; });

  function catName(slug) { const t = Shop.TABS.find((x) => x.slug === slug); return t ? t.name : slug; }
  function notFound() { return `<div class="empty" style="margin:40px 0"><div class="big">🔍</div><h3>Product not found</h3><p>It may have been removed.</p><p style="margin-top:14px"><a class="btn" href="/">Back to shop</a></p></div>`; }
})();

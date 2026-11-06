(async function () {
  'use strict';
  await Shop.init('');

  // Category shortcut tiles (link to the four fixed category pages)
  const strip = document.getElementById('cat-strip');
  const cats = Shop.TABS.filter((t) => t.slug);
  const colors = ['#ff7a59', '#ff4747', '#ff6a00', '#e62e04'];
  strip.innerHTML = cats
    .map(
      (c, i) => `
      <a class="pcard" href="${c.href}" style="text-decoration:none">
        <div class="media" style="background:linear-gradient(135deg, ${colors[i]}, #ffb08a);display:grid;place-items:center">
          <span style="color:#fff;font-weight:800;font-size:18px;text-align:center;padding:0 10px">${Shop.esc(c.name)}</span>
        </div>
        <div class="body"><div class="name" style="min-height:auto">Shop ${Shop.esc(c.name)} →</div></div>
      </a>`
    )
    .join('');

  // Featured "Super Deals"
  const host = document.getElementById('superdeals');
  try {
    const deals = await Shop.api('/api/products/featured');
    if (!deals.length) {
      host.innerHTML = `
        <div class="empty" style="grid-column:1/-1;background:rgba(255,255,255,.1);border-color:rgba(255,255,255,.35);color:#fff">
          <div class="big">🛍️</div>
          <h3 style="color:#fff">No featured deals yet</h3>
          <p style="color:rgba(255,255,255,.85)">Your 2–3 homepage Super Deals will appear here once you feature products in the admin dashboard.</p>
        </div>`;
      return;
    }
    host.innerHTML = deals
      .map((p) => {
        const media = p.image
          ? `<img src="${Shop.esc(p.image)}" alt="${Shop.esc(p.name)}">`
          : `<div class="noimg" style="height:100%">No image</div>`;
        const save = p.discountPct > 0 ? `<span class="save-badge">SAVE ${p.discountPct}%</span>` : '';
        const was = p.originalPrice > p.discountedPrice ? `<span class="price-was">${Shop.money(p.originalPrice)}</span>` : '';
        const timer = p.offerEndsAt
          ? `<div class="badge-timer" data-ends="${Shop.esc(p.offerEndsAt)}"${p.offerRepeatDays ? ` data-repeat="${p.offerRepeatDays}"` : ''} style="position:static;margin-top:4px"><span class="cd-text">⏱</span></div>` : '';
        return `
        <article class="superdeal" data-id="${p.id}">
          <a class="media" href="/p/${p.id}" aria-label="${Shop.esc(p.name)}">${media}${save}</a>
          <div class="body">
            <a class="name" href="/p/${p.id}" style="color:inherit">${Shop.esc(p.name)}</a>
            ${p.description ? `<div class="desc">${Shop.esc(p.description)}</div>` : ''}
            ${timer}
            <div class="price-row">
              <span class="price-now">${Shop.money(p.discountedPrice)}</span>
              ${was}
            </div>
            <a class="btn btn--lg btn--block" href="/p/${p.id}">Shop Now</a>
          </div>
        </article>`;
      })
      .join('');
    Shop.startCountdowns();
  } catch (e) {
    host.innerHTML = `<div class="empty" style="grid-column:1/-1">Could not load deals: ${Shop.esc(e.message)}</div>`;
  }
})();

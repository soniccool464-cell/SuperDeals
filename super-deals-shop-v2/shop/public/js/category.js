(async function () {
  'use strict';

  // Resolve the category slug from /c/<slug> or ?cat=<slug>
  const path = location.pathname.match(/^\/c\/([a-z0-9-]+)/i);
  const params = new URLSearchParams(location.search);
  const slug = (path && path[1]) || params.get('cat') || '';

  const known = Shop.TABS.find((t) => t.slug === slug);
  await Shop.init(slug);

  const banner = document.getElementById('cat-banner');
  const host = document.getElementById('products');

  if (!known) {
    banner.innerHTML = '';
    host.innerHTML = `<div class="empty"><div class="big">🔎</div><h3>Category not found</h3><p>Please pick a category from the menu above.</p></div>`;
    return;
  }

  document.title = `${known.name} — Super Deals`;
  // loading skeleton
  host.innerHTML = `<div class="skeleton-grid">${Array.from({ length: 10 }).map(() => '<div class="sk"><div class="m"></div><div class="b"></div></div>').join('')}</div>`;

  try {
    const products = await Shop.api('/api/products/category/' + encodeURIComponent(slug));
    banner.innerHTML = `
      <div class="cat-banner">
        <div>
          <h1>${Shop.esc(known.name)}</h1>
          <p>${products.length ? 'Grab these deals before they are gone.' : 'Deals are on the way.'}</p>
        </div>
        <div class="count-pill">${products.length} item${products.length === 1 ? '' : 's'}</div>
      </div>`;

    if (!products.length) {
      host.innerHTML = `
        <div class="empty">
          <div class="big">📦</div>
          <h3>No products in ${Shop.esc(known.name)} yet</h3>
          <p>Add products to this category from the admin dashboard and they'll show up here.</p>
        </div>`;
      return;
    }

    host.innerHTML = `<div class="grid">${products.map(Shop.productCardHTML).join('')}</div>`;
    Shop.startCountdowns();
  } catch (e) {
    host.innerHTML = `<div class="empty"><h3>Couldn't load products</h3><p>${Shop.esc(e.message)}</p></div>`;
  }
})();

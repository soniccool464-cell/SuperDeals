(function () {
  'use strict';

  const CATS = [
    { slug: 'fat-loss-abs', name: 'Fat Loss / Abs' },
    { slug: 'clearance-deals', name: 'Clearance Deals' },
    { slug: 'special-deals', name: 'Special Deals' },
    { slug: 'limited-time-offers', name: 'Limited Time Offers' },
  ];
  const MAX_FEATURED = 3;
  const catName = (s) => (CATS.find((c) => c.slug === s) || {}).name || s;

  const $ = (sel, root) => (root || document).querySelector(sel);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = (minor) => '$' + ((Number(minor) || 0) / 100).toFixed(2);

  async function api(path, opts) {
    const res = await fetch(path, opts);
    let data = null;
    try { data = await res.json(); } catch (_) {}
    if (res.status === 401) { showLogin(); throw new Error('Session expired. Please sign in again.'); }
    if (!res.ok) throw new Error((data && data.error) || `Request failed (${res.status})`);
    return data;
  }

  let PRODUCTS = [];

  /* ------------------------------ auth ------------------------------ */
  function showLogin() { $('#login-view').classList.remove('hidden'); $('#dash-view').classList.add('hidden'); }
  function showDash(email) {
    $('#login-view').classList.add('hidden');
    $('#dash-view').classList.remove('hidden');
    $('#who').textContent = email ? 'Signed in as ' + email : '';
    loadProducts();
  }

  $('#login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errEl = $('#login-err');
    errEl.classList.add('hidden');
    try {
      const r = await api('/admin/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: $('#email').value, password: $('#password').value }),
      });
      showDash(r.email);
    } catch (err) {
      errEl.textContent = err.message;
      errEl.classList.remove('hidden');
    }
  });

  $('#logout').addEventListener('click', async () => {
    try { await api('/admin/api/logout', { method: 'POST' }); } catch (_) {}
    showLogin();
  });

  /* ------------------------------ tabs ------------------------------ */
  document.querySelectorAll('.tabbar button').forEach((b) => {
    b.addEventListener('click', () => {
      document.querySelectorAll('.tabbar button').forEach((x) => x.classList.remove('active'));
      b.classList.add('active');
      const tab = b.dataset.tab;
      $('#tab-products').classList.toggle('hidden', tab !== 'products');
      $('#tab-orders').classList.toggle('hidden', tab !== 'orders');
      if (tab === 'orders') loadOrders();
    });
  });

  /* ------------------------------ products ------------------------------ */
  $('#filter-cat').addEventListener('change', renderProducts);
  $('#add-btn').addEventListener('click', () => openProductModal(null));

  async function loadProducts() {
    try {
      PRODUCTS = await api('/admin/api/products');
      renderProducts();
    } catch (e) {
      $('#products-host').innerHTML = `<div class="err">${esc(e.message)}</div>`;
    }
  }

  function renderProducts() {
    const host = $('#products-host');
    const featCount = PRODUCTS.filter((p) => p.featured).length;
    $('#feat-note').textContent = `${featCount}/${MAX_FEATURED} homepage deals featured`;

    const filter = $('#filter-cat').value;
    const list = filter ? PRODUCTS.filter((p) => p.category === filter) : PRODUCTS;

    if (!PRODUCTS.length) {
      host.innerHTML = `<div class="empty-note"><div class="big">📦</div><strong>No products yet</strong><div style="margin-top:6px">Click “Add product” to create your first listing. The storefront stays empty until you do.</div></div>`;
      return;
    }
    if (!list.length) { host.innerHTML = `<div class="empty-note">No products in this category.</div>`; return; }

    host.innerHTML = `<div class="prod-grid">${list.map(cardHTML).join('')}</div>`;
    host.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => openProductModal(Number(b.dataset.edit))));
    host.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => removeProduct(Number(b.dataset.del))));
    host.querySelectorAll('[data-feat]').forEach((b) => b.addEventListener('click', () => toggleFeature(Number(b.dataset.feat))));
    tickTimers();
  }

  function cardHTML(p) {
    const chips = [];
    if (p.featured) chips.push('<span class="chip feat">★ Featured</span>');
    if (p.discountPct > 0) chips.push(`<span class="chip save">-${p.discountPct}%</span>`);
    if (p.offerEndsAt) chips.push(`<span class="chip timer" data-ends="${esc(p.offerEndsAt)}">⏱</span>`);
    return `
      <div class="padmin">
        <div class="thumb">${p.image ? `<img src="${esc(p.image)}" alt="">` : '<div class="noimg">No image</div>'}</div>
        <div class="pb">
          <div class="pn">${esc(p.name)}</div>
          <div class="cat">${esc(catName(p.category))}</div>
          <div class="chips">${chips.join('')}</div>
          <div class="pr">${money(p.discountedPrice)}${p.originalPrice > p.discountedPrice ? `<s>${money(p.originalPrice)}</s>` : ''}</div>
          <div class="pactions">
            <button class="btn sec tiny" data-feat="${p.id}">${p.featured ? 'Unfeature' : 'Feature'}</button>
            <button class="btn sec tiny" data-edit="${p.id}">Edit</button>
            <button class="btn danger tiny" data-del="${p.id}">Delete</button>
          </div>
        </div>
      </div>`;
  }

  async function toggleFeature(id) {
    const p = PRODUCTS.find((x) => x.id === id);
    if (!p) return;
    try {
      await api(`/admin/api/products/${id}/feature`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ featured: !p.featured }),
      });
      await loadProducts();
    } catch (e) { alert(e.message); }
  }

  async function removeProduct(id) {
    const p = PRODUCTS.find((x) => x.id === id);
    if (!p) return;
    if (!confirm(`Delete “${p.name}”? This cannot be undone.`)) return;
    try { await api(`/admin/api/products/${id}`, { method: 'DELETE' }); await loadProducts(); }
    catch (e) { alert(e.message); }
  }

  /* ------------------------------ product modal ------------------------------ */
  function toLocalInput(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d)) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function openProductModal(id) {
    const p = id ? PRODUCTS.find((x) => x.id === id) : null;
    const host = $('#modal-host');
    host.innerHTML = `
      <div class="modal-back">
        <form class="modal" id="product-form">
          <h2>${p ? 'Edit product' : 'Add product'}</h2>
          <div id="form-err" class="err hidden"></div>
          <div class="field">
            <label for="f-name">Product name *</label>
            <input id="f-name" name="name" required value="${p ? esc(p.name) : ''}" />
          </div>
          <div class="field">
            <label for="f-desc">Short description</label>
            <textarea id="f-desc" name="description">${p ? esc(p.description) : ''}</textarea>
          </div>
          <div class="field">
            <label for="f-cat">Category *</label>
            <select id="f-cat" name="category" required>
              <option value="">Select a category…</option>
              ${CATS.map((c) => `<option value="${c.slug}"${p && p.category === c.slug ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}
            </select>
          </div>
          <div class="row2">
            <div class="field">
              <label for="f-orig">Original price *</label>
              <input id="f-orig" name="originalPrice" type="number" step="0.01" min="0" required value="${p ? (p.originalPrice / 100).toFixed(2) : ''}" />
            </div>
            <div class="field">
              <label for="f-disc">Discounted price *</label>
              <input id="f-disc" name="discountedPrice" type="number" step="0.01" min="0" required value="${p ? (p.discountedPrice / 100).toFixed(2) : ''}" />
            </div>
          </div>
          <div class="row2">
            <div class="field">
              <label for="f-offer">Limited-time offer ends (optional)</label>
              <input id="f-offer" name="offerEndsAt" type="datetime-local" value="${p ? toLocalInput(p.offerEndsAt) : ''}" />
              <div class="hint">Live countdown on the product. Blank = no timer.</div>
            </div>
            <div class="field">
              <label for="f-repeat">Auto-restart every (days)</label>
              <input id="f-repeat" name="offerRepeatDays" type="number" min="1" step="1" placeholder="e.g. 3" value="${p && p.offerRepeatDays ? p.offerRepeatDays : ''}" />
              <div class="hint">Makes the countdown repeat forever. Blank = one-time.</div>
            </div>
          </div>
          <div class="field">
            <label><input type="checkbox" id="f-feat" name="featured" style="width:auto;margin-right:8px"${p && p.featured ? ' checked' : ''} /> Feature on homepage (Super Deals)</label>
            <div class="hint">Up to ${MAX_FEATURED} products can be featured at once.</div>
          </div>
          <div class="field">
            <label for="f-img">Product images ${p && p.image ? '(upload to replace the whole gallery)' : '— you can select several'}</label>
            <input id="f-img" name="images" type="file" accept="image/*" multiple />
            <div class="hint">First image is the main photo. Select multiple for a gallery (up to 8).</div>
            <div id="preview-strip" class="preview-strip">
              ${p && p.images && p.images.length ? p.images.map((src) => `<img src="${esc(src)}" alt="">`).join('') : ''}
            </div>
          </div>
          <div class="foot">
            <button type="button" class="btn sec" id="cancel-modal">Cancel</button>
            <button type="submit" class="btn" id="save-btn">${p ? 'Save changes' : 'Create product'}</button>
          </div>
        </form>
      </div>`;

    const close = () => (host.innerHTML = '');
    $('#cancel-modal').addEventListener('click', close);
    host.querySelector('.modal-back').addEventListener('click', (e) => { if (e.target.classList.contains('modal-back')) close(); });

    const imgInput = $('#f-img');
    imgInput.addEventListener('change', () => {
      const strip = $('#preview-strip');
      if (!imgInput.files.length) return;
      strip.innerHTML = Array.from(imgInput.files)
        .slice(0, 8)
        .map((f) => `<img src="${URL.createObjectURL(f)}" alt="">`)
        .join('');
    });

    $('#product-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const errEl = $('#form-err');
      errEl.classList.add('hidden');
      const saveBtn = $('#save-btn');
      saveBtn.disabled = true;

      const orig = parseFloat($('#f-orig').value);
      const disc = parseFloat($('#f-disc').value);
      if (isFinite(orig) && isFinite(disc) && disc > orig) {
        errEl.textContent = 'Discounted price cannot be higher than the original price.';
        errEl.classList.remove('hidden'); saveBtn.disabled = false; return;
      }

      const fd = new FormData();
      fd.append('name', $('#f-name').value.trim());
      fd.append('description', $('#f-desc').value.trim());
      fd.append('category', $('#f-cat').value);
      fd.append('originalPrice', $('#f-orig').value);
      fd.append('discountedPrice', $('#f-disc').value);
      fd.append('featured', $('#f-feat').checked ? 'true' : 'false');
      const offerVal = $('#f-offer').value;
      fd.append('offerEndsAt', offerVal ? new Date(offerVal).toISOString() : '');
      fd.append('offerRepeatDays', $('#f-repeat').value || '');
      Array.from(imgInput.files).slice(0, 8).forEach((f) => fd.append('images', f));

      try {
        if (p) await api(`/admin/api/products/${p.id}`, { method: 'PUT', body: fd });
        else await api('/admin/api/products', { method: 'POST', body: fd });
        close();
        await loadProducts();
      } catch (err) {
        errEl.textContent = err.message;
        errEl.classList.remove('hidden');
        saveBtn.disabled = false;
      }
    });
  }

  /* ------------------------------ orders ------------------------------ */
  async function loadOrders() {
    const host = $('#orders-host');
    host.innerHTML = '<div class="card">Loading orders…</div>';
    try {
      const orders = await api('/admin/api/orders');
      if (!orders.length) {
        host.innerHTML = `<div class="empty-note"><div class="big">🧾</div><strong>No orders yet</strong><div style="margin-top:6px">Paid orders will appear here.</div></div>`;
        return;
      }
      host.innerHTML = `
        <table>
          <thead><tr><th>Order</th><th>Date</th><th>Customer</th><th>Items</th><th>Total</th><th>Status</th><th></th></tr></thead>
          <tbody>
            ${orders.map((o) => `
              <tr>
                <td>#${o.id}</td>
                <td>${esc(new Date(o.createdAt.replace(' ','T') + 'Z').toLocaleString())}</td>
                <td>${esc(o.customerName || o.customerEmail || '—')}</td>
                <td>${o.itemCount}</td>
                <td>${o.amountTotal != null ? money(o.amountTotal) : '—'}</td>
                <td><span class="status ${esc(o.status)}">${esc(o.status)}</span></td>
                <td><button class="btn sec tiny" data-order="${o.id}">View</button></td>
              </tr>`).join('')}
          </tbody>
        </table>`;
      host.querySelectorAll('[data-order]').forEach((b) => b.addEventListener('click', () => openOrder(Number(b.dataset.order))));
    } catch (e) {
      host.innerHTML = `<div class="err">${esc(e.message)}</div>`;
    }
  }

  async function openOrder(id) {
    const host = $('#order-modal-host');
    try {
      const o = await api(`/admin/api/orders/${id}`);
      const addr = o.shipping && o.shipping.address ? o.shipping.address : null;
      const addrHtml = addr
        ? `${esc(o.shipping.name || '')}<br>${esc(addr.line1 || '')}${addr.line2 ? '<br>' + esc(addr.line2) : ''}<br>${esc(addr.city || '')}, ${esc(addr.state || '')} ${esc(addr.postal_code || '')}<br>${esc(addr.country || '')}${o.shipping.phone ? '<br>☎ ' + esc(o.shipping.phone) : ''}`
        : '<span style="color:#888">No shipping address recorded</span>';
      host.innerHTML = `
        <div class="modal-back">
          <div class="modal">
            <h2>Order #${o.id} <span class="status ${esc(o.status)}" style="font-size:12px;vertical-align:middle">${esc(o.status)}</span></h2>
            <p style="color:#6b7280;margin-top:-6px">${esc(new Date(o.createdAt.replace(' ','T') + 'Z').toLocaleString())}</p>
            <div class="card" style="margin-bottom:12px">
              <strong>Customer</strong><br>
              ${esc(o.customerName || '—')}<br>${esc(o.customerEmail || '—')}
            </div>
            <div class="card" style="margin-bottom:12px">
              <strong>Shipping address</strong><br>${addrHtml}
            </div>
            <div class="card">
              <strong>Items</strong>
              <table style="margin-top:8px">
                <tbody>
                  ${(o.items || []).map((i) => `<tr><td>${esc(i.name)} × ${i.qty}</td><td style="text-align:right">${money(i.lineAmount)}</td></tr>`).join('')}
                  <tr><td style="font-weight:800;border-top:2px solid #eee">Total${o.status === 'paid' ? ' paid' : ''}</td><td style="text-align:right;font-weight:800;border-top:2px solid #eee">${o.amountTotal != null ? money(o.amountTotal) : '—'}</td></tr>
                </tbody>
              </table>
            </div>
            <div class="foot"><button class="btn sec" id="close-order">Close</button></div>
          </div>
        </div>`;
      const close = () => (host.innerHTML = '');
      $('#close-order').addEventListener('click', close);
      host.querySelector('.modal-back').addEventListener('click', (e) => { if (e.target.classList.contains('modal-back')) close(); });
    } catch (e) { alert(e.message); }
  }

  /* ------------------------------ admin countdown ticks ------------------------------ */
  function tickTimers() {
    document.querySelectorAll('.chip.timer[data-ends]').forEach((el) => {
      const diff = Math.floor((new Date(el.dataset.ends).getTime() - Date.now()) / 1000);
      if (isNaN(diff)) return;
      if (diff <= 0) { el.textContent = 'Ended'; return; }
      const d = Math.floor(diff / 86400), h = Math.floor((diff % 86400) / 3600), m = Math.floor((diff % 3600) / 60);
      el.textContent = '⏱ ' + (d > 0 ? `${d}d ${h}h` : `${h}h ${m}m`);
    });
  }
  setInterval(tickTimers, 30000);

  /* ------------------------------ boot ------------------------------ */
  (async function () {
    try {
      const me = await fetch('/admin/api/me').then((r) => (r.ok ? r.json() : null));
      if (me && me.authenticated) showDash(me.email);
      else showLogin();
    } catch (_) { showLogin(); }
  })();
})();

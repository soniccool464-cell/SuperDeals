'use strict';

const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const bcrypt = require('bcryptjs');

const db = require('../../db');
const model = require('../model');
const { requireAdmin } = require('../middleware/auth');
const { isValidCategory } = require('../categories');

const router = express.Router();

/* ----------------------------- image uploads ----------------------------- */
const UPLOAD_DIR = path.join(__dirname, '..', '..', 'public', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = (path.extname(file.originalname) || '').toLowerCase().slice(0, 10);
    cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`);
  },
});
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']);
const upload = multer({
  storage,
  limits: { fileSize: 6 * 1024 * 1024 }, // 6 MB
  fileFilter: (req, file, cb) => {
    if (ALLOWED.has(file.mimetype)) return cb(null, true);
    cb(new Error('Only JPG, PNG, WEBP, GIF or AVIF images are allowed.'));
  },
});

/* ------------------------------- helpers --------------------------------- */
function parseMoney(value) {
  // Accepts "19.99" (major units) -> 1999 (minor units).
  const n = typeof value === 'number' ? value : parseFloat(String(value).replace(/[^0-9.]/g, ''));
  if (!isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

function toBool(v) {
  return v === true || v === 'true' || v === '1' || v === 1 || v === 'on';
}

function validateOfferEndsAt(value) {
  if (!value) return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) return undefined; // signal invalid
  return d.toISOString();
}

function deleteImageFile(filename) {
  if (!filename) return;
  const p = path.join(UPLOAD_DIR, filename);
  fs.promises.unlink(p).catch(() => {});
}

function parseRepeatDays(value) {
  if (value === undefined || value === null || value === '' || value === '0') return null;
  const n = parseInt(value, 10);
  if (!Number.isInteger(n) || n < 1 || n > 3650) return undefined; // signal invalid
  return n;
}

// Gather the gallery filenames for an existing row (from images_json, else legacy image).
function existingGallery(row) {
  try {
    const arr = row.images_json ? JSON.parse(row.images_json) : [];
    if (Array.isArray(arr) && arr.length) return arr;
  } catch (_) {}
  return row.image ? [row.image] : [];
}

/* -------------------------------- auth ----------------------------------- */
router.post('/login', express.json(), (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const admin = db.prepare('SELECT * FROM admins WHERE email = ?').get(email);
  // Always run a compare to reduce timing differences.
  const hash = admin ? admin.password_hash : '$2a$12$0000000000000000000000000000000000000000000000000000';
  const ok = bcrypt.compareSync(password, hash);
  if (!admin || !ok) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  req.session.adminId = admin.id;
  req.session.adminEmail = admin.email;
  res.json({ ok: true, email: admin.email });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

router.get('/me', (req, res) => {
  if (req.session && req.session.adminId) {
    return res.json({ authenticated: true, email: req.session.adminEmail });
  }
  res.status(401).json({ authenticated: false });
});

/* ------------------------- everything below is protected ------------------ */
router.use(requireAdmin);

/* list all products (for management) */
router.get('/products', (req, res) => {
  const rows = db.prepare('SELECT * FROM products ORDER BY created_at DESC').all();
  res.json(rows.map(model.serialize));
});

router.get('/products/:id', (req, res) => {
  const p = model.getById(Number(req.params.id));
  if (!p) return res.status(404).json({ error: 'Not found' });
  res.json(p);
});

/* create product */
router.post('/products', upload.array('images', 8), (req, res) => {
  const b = req.body;
  const name = String(b.name || '').trim();
  const description = String(b.description || '').trim();
  const category = String(b.category || '').trim();
  const original = parseMoney(b.originalPrice);
  const discounted = parseMoney(b.discountedPrice);
  const featured = toBool(b.featured);
  const offer = validateOfferEndsAt(b.offerEndsAt);
  const repeat = parseRepeatDays(b.offerRepeatDays);

  if (!name) return fail(res, req, 'Product name is required.');
  if (!isValidCategory(category)) return fail(res, req, 'A valid category is required.');
  if (original === null) return fail(res, req, 'Valid original price is required.');
  if (discounted === null) return fail(res, req, 'Valid discounted price is required.');
  if (discounted > original) return fail(res, req, 'Discounted price cannot exceed original price.');
  if (offer === undefined) return fail(res, req, 'Offer end date/time is invalid.');
  if (repeat === undefined) return fail(res, req, 'Offer repeat interval must be a whole number of days.');
  if (featured && model.countFeatured() >= model.MAX_FEATURED) {
    return fail(res, req, `You can only feature up to ${model.MAX_FEATURED} homepage deals. Un-feature one first.`);
  }

  const files = (req.files || []).map((f) => f.filename);
  const primary = files[0] || null;

  const info = db
    .prepare(
      `INSERT INTO products (name, description, original_price, discounted_price, category, image, images_json, featured, offer_ends_at, offer_repeat_days)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      name, description, original, discounted, category,
      primary, files.length ? JSON.stringify(files) : null,
      featured ? 1 : 0, offer, repeat
    );
  res.status(201).json(model.getById(info.lastInsertRowid));
});

/* update product */
router.put('/products/:id', upload.array('images', 8), (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  if (!existing) return fail(res, req, 'Product not found.', 404);

  const b = req.body;
  const name = String(b.name ?? existing.name).trim();
  const description = String(b.description ?? existing.description).trim();
  const category = String(b.category ?? existing.category).trim();
  const original = b.originalPrice !== undefined ? parseMoney(b.originalPrice) : existing.original_price;
  const discounted = b.discountedPrice !== undefined ? parseMoney(b.discountedPrice) : existing.discounted_price;
  const featured = b.featured !== undefined ? toBool(b.featured) : !!existing.featured;
  let offer = existing.offer_ends_at;
  if (b.offerEndsAt !== undefined) {
    offer = b.offerEndsAt === '' ? null : validateOfferEndsAt(b.offerEndsAt);
  }
  let repeat = existing.offer_repeat_days;
  if (b.offerRepeatDays !== undefined) {
    repeat = parseRepeatDays(b.offerRepeatDays);
  }

  if (!name) return fail(res, req, 'Product name is required.');
  if (!isValidCategory(category)) return fail(res, req, 'A valid category is required.');
  if (original === null || discounted === null) return fail(res, req, 'Valid prices are required.');
  if (discounted > original) return fail(res, req, 'Discounted price cannot exceed original price.');
  if (offer === undefined) return fail(res, req, 'Offer end date/time is invalid.');
  if (repeat === undefined) return fail(res, req, 'Offer repeat interval must be a whole number of days.');
  if (featured && !existing.featured && model.countFeatured() >= model.MAX_FEATURED) {
    return fail(res, req, `You can only feature up to ${model.MAX_FEATURED} homepage deals. Un-feature one first.`);
  }

  // If new images were uploaded, they REPLACE the whole gallery (old files removed).
  let gallery = existingGallery(existing);
  if (req.files && req.files.length) {
    existingGallery(existing).forEach(deleteImageFile);
    gallery = req.files.map((f) => f.filename);
  }
  const primary = gallery[0] || null;

  db.prepare(
    `UPDATE products
       SET name=?, description=?, original_price=?, discounted_price=?, category=?, image=?, images_json=?, featured=?, offer_ends_at=?, offer_repeat_days=?, updated_at=datetime('now')
     WHERE id=?`
  ).run(
    name, description, original, discounted, category,
    primary, gallery.length ? JSON.stringify(gallery) : null,
    featured ? 1 : 0, offer, repeat, id
  );

  res.json(model.getById(id));
});

/* toggle featured (max 3 enforced) */
router.post('/products/:id/feature', express.json(), (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Product not found.' });
  const featured = toBool(req.body.featured);
  if (featured && !existing.featured && model.countFeatured() >= model.MAX_FEATURED) {
    return res
      .status(400)
      .json({ error: `You can only feature up to ${model.MAX_FEATURED} homepage deals. Un-feature one first.` });
  }
  db.prepare("UPDATE products SET featured=?, updated_at=datetime('now') WHERE id=?").run(featured ? 1 : 0, id);
  res.json(model.getById(id));
});

/* delete product */
router.delete('/products/:id', (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Product not found.' });
  db.prepare('DELETE FROM products WHERE id = ?').run(id);
  existingGallery(existing).forEach(deleteImageFile);
  res.json({ ok: true });
});

/* orders */
router.get('/orders', (req, res) => {
  const rows = db
    .prepare('SELECT * FROM orders ORDER BY created_at DESC')
    .all()
    .map((o) => ({
      id: o.id,
      status: o.status,
      amountTotal: o.amount_total,
      currency: o.currency,
      customerEmail: o.customer_email,
      customerName: o.customer_name,
      createdAt: o.created_at,
      paidAt: o.paid_at,
      itemCount: safeParse(o.items_json, []).reduce((n, i) => n + (i.qty || 0), 0),
    }));
  res.json(rows);
});

router.get('/orders/:id', (req, res) => {
  const o = db.prepare('SELECT * FROM orders WHERE id = ?').get(Number(req.params.id));
  if (!o) return res.status(404).json({ error: 'Order not found.' });
  res.json({
    id: o.id,
    stripeSessionId: o.stripe_session_id,
    paymentIntent: o.payment_intent,
    status: o.status,
    amountTotal: o.amount_total,
    currency: o.currency,
    customerEmail: o.customer_email,
    customerName: o.customer_name,
    shipping: safeParse(o.shipping_json, null),
    items: safeParse(o.items_json, []),
    createdAt: o.created_at,
    paidAt: o.paid_at,
  });
});

function safeParse(s, fallback) {
  try {
    return s ? JSON.parse(s) : fallback;
  } catch {
    return fallback;
  }
}

/* On validation failure, clean up any uploaded files so we don't leave orphans. */
function fail(res, req, message, code = 400) {
  (req.files || []).forEach((f) => deleteImageFile(f.filename));
  if (req.file) deleteImageFile(req.file.filename);
  return res.status(code).json({ error: message });
}

/* multer / generic error handler for this router */
router.use((err, req, res, next) => {
  (req.files || []).forEach((f) => deleteImageFile(f.filename));
  if (req.file) deleteImageFile(req.file.filename);
  res.status(400).json({ error: err.message || 'Upload error' });
});

module.exports = router;

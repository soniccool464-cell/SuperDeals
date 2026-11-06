'use strict';

const db = require('../db');

const MAX_FEATURED = 3;

/** Convert a DB product row into the shape the frontend consumes. */
function serialize(row) {
  if (!row) return null;
  const discountPct =
    row.original_price > 0
      ? Math.round(((row.original_price - row.discounted_price) / row.original_price) * 100)
      : 0;

  // Build the gallery list. images_json is the source of truth; fall back to the
  // single `image` column for older rows.
  let files = [];
  try {
    files = row.images_json ? JSON.parse(row.images_json) : [];
  } catch (_) {
    files = [];
  }
  if (!Array.isArray(files)) files = [];
  if (files.length === 0 && row.image) files = [row.image];
  const images = files.map((f) => `/uploads/${f}`);

  return {
    id: row.id,
    name: row.name,
    description: row.description || '',
    originalPrice: row.original_price,     // minor units
    discountedPrice: row.discounted_price, // minor units
    discountPct,
    category: row.category,
    image: images[0] || null,              // primary image (used on cards)
    images,                                // full gallery
    featured: !!row.featured,
    offerEndsAt: row.offer_ends_at || null,
    offerRepeatDays: row.offer_repeat_days || null,
    createdAt: row.created_at,
  };
}

function getActiveByCategory(category) {
  return db
    .prepare('SELECT * FROM products WHERE category = ? AND active = 1 ORDER BY created_at DESC')
    .all(category)
    .map(serialize);
}

function getFeatured() {
  return db
    .prepare('SELECT * FROM products WHERE featured = 1 AND active = 1 ORDER BY updated_at DESC LIMIT ?')
    .all(MAX_FEATURED)
    .map(serialize);
}

function getById(id) {
  return serialize(db.prepare('SELECT * FROM products WHERE id = ?').get(id));
}

function getManyActive(ids) {
  if (!ids.length) return [];
  const placeholders = ids.map(() => '?').join(',');
  return db
    .prepare(`SELECT * FROM products WHERE active = 1 AND id IN (${placeholders})`)
    .all(...ids)
    .map(serialize);
}

function countFeatured(excludeId) {
  if (excludeId) {
    return db
      .prepare('SELECT COUNT(*) AS n FROM products WHERE featured = 1 AND id != ?')
      .get(excludeId).n;
  }
  return db.prepare('SELECT COUNT(*) AS n FROM products WHERE featured = 1').get().n;
}

module.exports = {
  MAX_FEATURED,
  serialize,
  getActiveByCategory,
  getFeatured,
  getById,
  getManyActive,
  countFeatured,
};

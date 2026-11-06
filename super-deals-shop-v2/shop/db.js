'use strict';

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'shop.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS admins (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    email         TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS products (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    name             TEXT NOT NULL,
    description      TEXT NOT NULL DEFAULT '',
    original_price   INTEGER NOT NULL,          -- in minor units (e.g. cents)
    discounted_price INTEGER NOT NULL,          -- in minor units (e.g. cents)
    category         TEXT NOT NULL,             -- one of the four fixed slugs
    image            TEXT DEFAULT NULL,         -- stored filename under /uploads
    featured         INTEGER NOT NULL DEFAULT 0, -- 1 = shown as homepage Super Deal
    offer_ends_at    TEXT DEFAULT NULL,         -- ISO datetime for limited-time countdown
    active           INTEGER NOT NULL DEFAULT 1,
    created_at       TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS orders (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    stripe_session_id  TEXT UNIQUE,
    payment_intent     TEXT,
    status             TEXT NOT NULL DEFAULT 'pending', -- pending | paid | failed
    amount_total       INTEGER,                         -- minor units
    currency           TEXT,
    customer_email     TEXT,
    customer_name      TEXT,
    shipping_json      TEXT,                             -- JSON address blob
    items_json         TEXT NOT NULL,                    -- snapshot of purchased items
    created_at         TEXT NOT NULL DEFAULT (datetime('now')),
    paid_at            TEXT DEFAULT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
  CREATE INDEX IF NOT EXISTS idx_products_featured ON products(featured);
  CREATE INDEX IF NOT EXISTS idx_orders_session ON orders(stripe_session_id);
`);

/* ---- lightweight migrations for existing databases ---- */
const cols = db.prepare("PRAGMA table_info(products)").all().map((c) => c.name);
if (!cols.includes('offer_repeat_days')) {
  // When set (e.g. 3), the limited-time countdown auto-restarts every N days (infinite).
  db.exec('ALTER TABLE products ADD COLUMN offer_repeat_days INTEGER DEFAULT NULL');
}
if (!cols.includes('images_json')) {
  // JSON array of image filenames for the product gallery. `image` stays the primary/first.
  db.exec('ALTER TABLE products ADD COLUMN images_json TEXT DEFAULT NULL');
}

module.exports = db;

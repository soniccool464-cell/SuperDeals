'use strict';

require('dotenv').config();
const path = require('path');
const express = require('express');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);

const productsRoutes = require('./src/routes/products');
const adminRoutes = require('./src/routes/admin');
const { router: checkoutRouter, webhookHandler } = require('./src/routes/checkout');

const app = express();
const PORT = process.env.PORT || 3000;

app.disable('x-powered-by');
app.set('trust proxy', 1);

/* --- Stripe webhook must receive the RAW body, so mount it BEFORE json() --- */
app.post('/api/checkout/webhook', express.raw({ type: 'application/json' }), webhookHandler);

/* --- Sessions (admin login) --- */
app.use(
  session({
    store: new SQLiteStore({ db: 'sessions.db', dir: path.join(__dirname, 'data') }),
    secret: process.env.SESSION_SECRET || 'insecure-dev-secret-change-me',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 1000 * 60 * 60 * 8, // 8 hours
    },
  })
);

/* --- API routes --- */
app.use('/api/products', productsRoutes);
app.use('/api/checkout', checkoutRouter);
app.use('/admin/api', adminRoutes);

/* --- Static assets (storefront + admin UI + uploaded images) --- */
app.use(express.static(path.join(__dirname, 'public')));

/* Clean category URLs: /c/<slug> -> category page */
app.get('/c/:slug', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'category.html'));
});

/* Product detail page: /p/<id> */
app.get('/p/:id', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'product.html'));
});

/* Admin dashboard entry */
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin', 'index.html'));
});

/* Health check */
app.get('/healthz', (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`Deals shop running at http://localhost:${PORT}`);
  if (!process.env.STRIPE_SECRET_KEY) {
    console.log('  (Stripe keys not set — storefront/admin work; checkout is disabled until you add them to .env)');
  }
});

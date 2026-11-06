'use strict';

const express = require('express');
const db = require('../../db');
const model = require('../model');

const router = express.Router();

const CURRENCY = (process.env.CURRENCY || 'usd').toLowerCase();
const BASE_URL = (process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/$/, '');

/* Lazily build the Stripe client so the site still runs without keys configured. */
let _stripe = null;
function stripe() {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  _stripe = require('stripe')(key);
  return _stripe;
}
function stripeConfigured() {
  return !!process.env.STRIPE_SECRET_KEY;
}

/* Countries Stripe Checkout may collect a shipping address from. */
const SHIPPING_COUNTRIES = [
  'US', 'CA', 'GB', 'AU', 'NZ', 'IE', 'IN', 'SG', 'MY', 'PH', 'AE', 'SA',
  'DE', 'FR', 'ES', 'IT', 'NL', 'BE', 'SE', 'NO', 'DK', 'FI', 'PT', 'AT',
  'CH', 'PL', 'JP', 'KR', 'HK', 'MX', 'BR', 'ZA',
];

/** Public config for the frontend (publishable key only — never the secret). */
router.get('/config', (req, res) => {
  res.json({
    configured: stripeConfigured(),
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || null,
    currency: CURRENCY,
  });
});

/**
 * Create a Stripe Checkout Session.
 * The client sends only product ids + quantities; ALL prices are recomputed
 * from the database here, so a tampered client cannot change what is charged.
 */
router.post('/create-session', express.json(), async (req, res) => {
  if (!stripeConfigured()) {
    return res.status(503).json({ error: 'Payments are not configured yet. Add Stripe keys to .env.' });
  }

  const rawItems = Array.isArray(req.body.items) ? req.body.items : [];
  const qtyById = new Map();
  for (const it of rawItems) {
    const id = Number(it.id);
    let qty = Math.floor(Number(it.qty));
    if (!Number.isInteger(id) || id <= 0) continue;
    if (!Number.isInteger(qty) || qty <= 0) continue;
    qty = Math.min(qty, 99);
    qtyById.set(id, (qtyById.get(id) || 0) + qty);
  }
  if (qtyById.size === 0) {
    return res.status(400).json({ error: 'Your cart is empty.' });
  }

  const products = model.getManyActive([...qtyById.keys()]);
  if (products.length === 0) {
    return res.status(400).json({ error: 'None of the items in your cart are available.' });
  }

  const lineItems = [];
  const snapshot = [];
  let amountTotal = 0;
  for (const p of products) {
    const qty = qtyById.get(p.id);
    if (!qty) continue;
    amountTotal += p.discountedPrice * qty;
    snapshot.push({
      id: p.id,
      name: p.name,
      qty,
      unitAmount: p.discountedPrice,
      lineAmount: p.discountedPrice * qty,
      image: p.image,
    });
    lineItems.push({
      quantity: qty,
      price_data: {
        currency: CURRENCY,
        unit_amount: p.discountedPrice,
        product_data: {
          name: p.name,
          images: p.image ? [BASE_URL + p.image] : undefined,
        },
      },
    });
  }

  try {
    const session = await stripe().checkout.sessions.create({
      mode: 'payment',
      line_items: lineItems,
      billing_address_collection: 'auto',
      shipping_address_collection: { allowed_countries: SHIPPING_COUNTRIES },
      phone_number_collection: { enabled: true },
      success_url: `${BASE_URL}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${BASE_URL}/cart.html`,
    });

    db.prepare(
      `INSERT INTO orders (stripe_session_id, status, amount_total, currency, items_json)
       VALUES (?, 'pending', ?, ?, ?)`
    ).run(session.id, amountTotal, CURRENCY, JSON.stringify(snapshot));

    res.json({ url: session.url, id: session.id });
  } catch (err) {
    console.error('Stripe create-session error:', err.message);
    res.status(500).json({ error: 'Could not start checkout. Please try again.' });
  }
});

/**
 * Finalize an order from a (paid) Checkout Session. Idempotent.
 * Called by both the webhook and the success-page verification.
 */
function finalizeOrder(session) {
  const order = db.prepare('SELECT * FROM orders WHERE stripe_session_id = ?').get(session.id);
  if (!order) return null;
  if (order.status === 'paid') return order;

  if (session.payment_status === 'paid') {
    const cust = session.customer_details || {};
    const ship =
      session.shipping_details ||
      (session.collected_information && session.collected_information.shipping_details) ||
      null;
    const shippingBlob = ship
      ? { name: ship.name, phone: cust.phone || null, address: ship.address }
      : cust.address
      ? { name: cust.name, phone: cust.phone || null, address: cust.address }
      : null;

    db.prepare(
      `UPDATE orders
         SET status='paid',
             payment_intent=?,
             amount_total=?,
             currency=?,
             customer_email=?,
             customer_name=?,
             shipping_json=?,
             paid_at=datetime('now')
       WHERE id=?`
    ).run(
      typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id || null,
      session.amount_total,
      session.currency,
      cust.email || null,
      cust.name || null,
      shippingBlob ? JSON.stringify(shippingBlob) : null,
      order.id
    );
    return db.prepare('SELECT * FROM orders WHERE id = ?').get(order.id);
  }
  return order;
}

/**
 * Stripe webhook. Mounted in server.js with a RAW body parser (signature
 * verification needs the unparsed bytes). Primary source of truth for payment.
 */
function webhookHandler(req, res) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const s = stripe();
  if (!s || !secret) return res.status(200).json({ received: true, note: 'webhook not configured' });

  let event;
  try {
    event = s.webhooks.constructEvent(req.body, req.headers['stripe-signature'], secret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (
    event.type === 'checkout.session.completed' ||
    event.type === 'checkout.session.async_payment_succeeded'
  ) {
    const session = event.data.object;
    try {
      finalizeOrder(session);
    } catch (e) {
      console.error('finalizeOrder error:', e.message);
    }
  }
  res.json({ received: true });
}

/**
 * Success-page verification / confirmation.
 * Retrieves the session straight from Stripe (server-side) and confirms payment,
 * so confirmation is verified even if the webhook is not set up (e.g. local dev).
 */
router.get('/session/:id', async (req, res) => {
  if (!stripeConfigured()) return res.status(503).json({ error: 'Payments not configured.' });
  try {
    const session = await stripe().checkout.sessions.retrieve(req.params.id);
    const order = finalizeOrder(session);
    res.json({
      paid: session.payment_status === 'paid',
      status: session.payment_status,
      amountTotal: session.amount_total,
      currency: session.currency,
      email: session.customer_details ? session.customer_details.email : null,
      orderId: order ? order.id : null,
      items: order ? JSON.parse(order.items_json) : [],
    });
  } catch (err) {
    console.error('session retrieve error:', err.message);
    res.status(404).json({ error: 'Order not found.' });
  }
});

module.exports = { router, webhookHandler };

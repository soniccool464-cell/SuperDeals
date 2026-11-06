# Super Deals — Deals Shopping Site

A deals-focused online store with a storefront, a persistent cart, secure Stripe
checkout, and a private admin dashboard. Built with Node.js + Express + SQLite.

> **Brand name** is a placeholder (`Super Deals`). Change it in
> `public/js/common.js` (the `BRAND` object) and `public/admin/index.html`.

---

## What it does

- **Fixed 5-tab navigation:** Home, Fat Loss / Abs, Clearance Deals, Special Deals,
  Limited Time Offers. (These are hard-coded by design and not auto-extended.)
- **Homepage hero** featuring **2–3 Super Deals** you choose in the admin. Empty
  until you feature products.
- **Four category pages** with product cards: image, name, original price,
  discounted price, discount %, description, **Add to Cart** and **Buy Now**.
- **Cart** with quantity changes, remove, subtotal/total — persists in the browser.
- **Stripe Checkout** (hosted) — card payments, shipping + email collected by
  Stripe, **server-side price recomputation**, webhook verification, order storage,
  and an order-confirmation page.
- **Private admin dashboard** (`/admin`): add/edit/remove products, upload images,
  assign categories, feature homepage deals (max 3), set limited-time offer
  countdowns, and view customer orders.
- **Empty product catalog by default** — nothing is shown until you add products.

The storefront always loads products from the database. Nothing is hard-coded.

---

## Requirements

- Node.js 18+ (built and tested on Node 22)
- A Stripe account (test mode is fine to start): <https://dashboard.stripe.com>

---

## Setup

```bash
cd shop
npm install
cp .env.example .env
```

Edit `.env` and set at least:

| Variable | What it is |
|---|---|
| `SESSION_SECRET` | Any long random string (signs admin login sessions) |
| `BASE_URL` | Public URL of the site, e.g. `http://localhost:3000` |
| `CURRENCY` | Price currency, e.g. `usd` |
| `ADMIN_EMAIL` | The single admin email allowed to log in |
| `STRIPE_SECRET_KEY` | `sk_test_...` from Stripe (server-only, never shipped to the browser) |
| `STRIPE_PUBLISHABLE_KEY` | `pk_test_...` from Stripe |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` (optional for local dev — see below) |

### Create your admin password

```bash
npm run init-admin "your-strong-password"
```

This creates the admin account for `ADMIN_EMAIL`. Run it again anytime to change
the password.

### Run

```bash
npm start
# → http://localhost:3000        (storefront)
# → http://localhost:3000/admin  (admin dashboard)
```

The site runs without Stripe keys (storefront + admin work); checkout stays
disabled until you add the keys.

---

## Stripe

1. Get your **test** API keys from <https://dashboard.stripe.com/test/apikeys> and
   put them in `.env` (`STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`).
2. Test cards: use `4242 4242 4242 4242`, any future expiry, any CVC, any ZIP.
3. **Webhook (recommended for production):** In the Stripe dashboard, create a
   webhook endpoint pointing to `https://YOUR_DOMAIN/api/checkout/webhook`, listen
   for `checkout.session.completed`, and copy the signing secret into
   `STRIPE_WEBHOOK_SECRET`.
   - For local testing you can use the Stripe CLI:
     `stripe listen --forward-to localhost:3000/api/checkout/webhook`
   - Even **without** a webhook, the confirmation page verifies the payment
     server-side by retrieving the session from Stripe, so local testing works.

**Security:** the secret key lives only on the server. The browser only ever
receives the publishable key. All charged prices are recomputed from the database
on the server, so a tampered cart cannot change what is charged.

---

## Project structure

```
shop/
├── server.js                 # Express app: routes, sessions, static, webhook
├── db.js                     # SQLite schema (products, orders, admins)
├── src/
│   ├── categories.js         # The four fixed category slugs
│   ├── model.js              # Product queries + serialization
│   ├── middleware/auth.js    # Admin session guard
│   └── routes/
│       ├── products.js       # Public read API (featured, category, product)
│       ├── admin.js          # Protected admin API (CRUD, upload, orders)
│       └── checkout.js       # Stripe session, webhook, order finalization
├── scripts/set-admin-password.js
├── public/                   # Storefront + admin UI (static)
│   ├── index.html / js/home.js
│   ├── category.html / js/category.js
│   ├── cart.html / js/cart.js
│   ├── success.html
│   ├── js/common.js          # Header/footer, cart store, product cards
│   ├── css/styles.css
│   ├── admin/                # Private dashboard (index.html, admin.js, admin.css)
│   └── uploads/              # Product images (created at runtime)
└── data/                     # SQLite database files (created at runtime)
```

---

## Deployment notes

- Set `NODE_ENV=production` (enables secure cookies) and run behind HTTPS.
- Set `BASE_URL` to your real domain so Stripe redirects and product image URLs
  are correct.
- `data/` (database) and `public/uploads/` (images) must live on a **persistent
  disk** — on hosts with ephemeral filesystems, mount a volume for them.
- Keep all secrets in environment variables; never commit `.env`.

---

## Notes / scope

- The catalog ships **empty on purpose**. Add products from the admin dashboard.
- The five tabs and four categories are fixed by request and are not configurable
  from the UI.
- Product placeholder images in any screenshots are illustrative; upload real
  product photos via the admin.

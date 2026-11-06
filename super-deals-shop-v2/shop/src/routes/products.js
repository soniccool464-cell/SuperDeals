'use strict';

const express = require('express');
const router = express.Router();
const model = require('../model');
const { isValidCategory, CATEGORIES } = require('../categories');

/** List the fixed categories (name + slug). */
router.get('/categories', (req, res) => {
  res.json(CATEGORIES);
});

/** Featured homepage "Super Deals" (max 3). Empty until the admin features some. */
router.get('/featured', (req, res) => {
  res.json(model.getFeatured());
});

/** Products for one category page. */
router.get('/category/:slug', (req, res) => {
  const { slug } = req.params;
  if (!isValidCategory(slug)) {
    return res.status(404).json({ error: 'Unknown category' });
  }
  res.json(model.getActiveByCategory(slug));
});

/** Single product (used for quick lookups / buy-now). */
router.get('/product/:id', (req, res) => {
  const p = model.getById(Number(req.params.id));
  if (!p || p.active === false) return res.status(404).json({ error: 'Not found' });
  res.json(p);
});

module.exports = router;

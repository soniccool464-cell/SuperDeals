'use strict';

/**
 * The FOUR fixed shopping categories. These are fixed by design and must not
 * be added to or changed without approval. "Home" is not a category — it is the
 * homepage that shows the featured "Super Deals".
 */
const CATEGORIES = [
  { slug: 'fat-loss-abs', name: 'Fat Loss / Abs' },
  { slug: 'clearance-deals', name: 'Clearance Deals' },
  { slug: 'special-deals', name: 'Special Deals' },
  { slug: 'limited-time-offers', name: 'Limited Time Offers' },
];

const CATEGORY_SLUGS = CATEGORIES.map((c) => c.slug);

function isValidCategory(slug) {
  return CATEGORY_SLUGS.includes(slug);
}

function categoryName(slug) {
  const c = CATEGORIES.find((x) => x.slug === slug);
  return c ? c.name : slug;
}

module.exports = { CATEGORIES, CATEGORY_SLUGS, isValidCategory, categoryName };

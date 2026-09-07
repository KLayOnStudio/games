// Procedurally-generated weekly practice content, per class.
//
// Instead of a fixed hand-authored pool, each week's pairs are GENERATED on
// the fly from a weighted mix of "categories" (power rule on a plain
// monomial, sum of monomials, etc.) so every playthrough is different.
// Weeks are cumulative: playing "Week N" blends every week 1..N's
// categories together (each week keeps its own internal weighting), so
// earlier material keeps getting reinforced all semester.
//
// To add a new week: append an entry to that class's array in
// WEEKLY_CURRICULUM below. Nothing else needs to change — the Week dropdown,
// auto-detection, and generation all read from this list.

// Anchor for the date-driven default week (getCurrentWeekNumber below) —
// not necessarily the literal first day of class, just tuned so the
// auto-selected week flips on whatever day the material's actually ready.
// Adjust this whenever a new week's release date needs to move; each week
// still stays manually pickable from the dropdown regardless of this date.
const SEMESTER_START = "2026-08-18";

function pickInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

// Kept small across the WHOLE game (not just later weeks) as of
// 2026-09-07 — occasional "big round" exponents/coefficients (20/50/100)
// and a per-week override system used to exist, but the user reversed
// that once more complex rules started getting introduced: simpler to
// keep one consistent range everywhere than to juggle exceptions per week.
const MAX_EXPONENT = 6;
const MIN_COEFFICIENT = 2;
const MAX_COEFFICIENT = 5;

// Product rule pairs (Week 4) use their own, smaller exponent range —
// computing a product-rule derivative by hand is already more work than
// plain power rule, so the numbers stay simpler while that's being learned.
const PRODUCT_MIN_EXPONENT = 1;
const PRODUCT_MAX_EXPONENT = 3;

function pickExponent() {
  return pickInt(0, MAX_EXPONENT);
}

// Starts at 2, not 1 — a coefficient of 1 would make "monomialWithCoefficient"
// indistinguishable from the plain "monomial" category.
function pickCoefficient() {
  return pickInt(MIN_COEFFICIENT, MAX_COEFFICIENT);
}

// Renders coef*x^exp as LaTeX, following normal conventions: exponent 0
// collapses to just the coefficient (a constant), exponent 1 drops the
// "^1", and coefficient 1 is omitted (but not dropped for exp === 0, where
// the coefficient IS the whole value).
function formatMonomial(coef, exp) {
  if (exp === 0) return String(coef);
  const varPart = exp === 1 ? "x" : `x^{${exp}}`;
  const coefPart = coef === 1 ? "" : String(coef);
  return `${coefPart}${varPart}`;
}

function powerRuleDerivative(coef, exp) {
  if (exp === 0) return "0";
  return formatMonomial(coef * exp, exp - 1);
}

// e^x is its own derivative, so coefficient 1 (plain e^x) and any other
// coefficient both just reproduce the same text on both sides — no power
// rule involved.
function formatExponential(coef) {
  const coefPart = coef === 1 ? "" : String(coef);
  return `${coefPart}e^x`;
}

// Renders coef*x^exp*e^x (a single term of a product-rule pair) — exp === 0
// collapses to just coef*e^x, same convention as formatMonomial.
function formatMonomialTimesExp(coef, exp) {
  if (exp === 0) return formatExponential(coef);
  const varPart = exp === 1 ? "x" : `x^{${exp}}`;
  const coefPart = coef === 1 ? "" : String(coef);
  return `${coefPart}${varPart}e^x`;
}

// Product rule: d/dx[coef*x^exp*e^x] = coef*exp*x^(exp-1)*e^x + coef*x^exp*e^x
// — written out as an expanded sum of two terms (not factored), matching
// the game's existing convention of never factoring a derivative.
function productRuleDerivative(coef, exp) {
  const firstTerm = formatMonomialTimesExp(coef * exp, exp - 1);
  const secondTerm = formatMonomialTimesExp(coef, exp);
  return `${firstTerm} + ${secondTerm}`;
}

const CONTENT_CATEGORIES = {
  exponential: () => {
    const a = pickInt(1, MAX_COEFFICIENT);
    return { func: formatExponential(a), deriv: formatExponential(a), variable: "x" };
  },
  monomial: () => {
    const n = pickExponent();
    return { func: formatMonomial(1, n), deriv: powerRuleDerivative(1, n), variable: "x" };
  },
  sumOfMonomials: () => {
    const n = pickExponent();
    const m = pickExponent();
    return {
      func: `${formatMonomial(1, n)} + ${formatMonomial(1, m)}`,
      deriv: `${powerRuleDerivative(1, n)} + ${powerRuleDerivative(1, m)}`,
      variable: "x",
    };
  },
  monomialWithCoefficient: () => {
    const a = pickCoefficient();
    const n = pickExponent();
    return { func: formatMonomial(a, n), deriv: powerRuleDerivative(a, n), variable: "x" };
  },
  linearCombination: () => {
    const a = pickCoefficient();
    const b = pickCoefficient();
    const n = pickExponent();
    const m = pickExponent();
    return {
      func: `${formatMonomial(a, n)} + ${formatMonomial(b, m)}`,
      deriv: `${powerRuleDerivative(a, n)} + ${powerRuleDerivative(b, m)}`,
      variable: "x",
    };
  },
  productMonomialExp: () => {
    const n = pickInt(PRODUCT_MIN_EXPONENT, PRODUCT_MAX_EXPONENT);
    return { func: formatMonomialTimesExp(1, n), deriv: productRuleDerivative(1, n), variable: "x" };
  },
  productMonomialExpWithCoefficient: () => {
    const a = pickCoefficient();
    const n = pickInt(PRODUCT_MIN_EXPONENT, PRODUCT_MAX_EXPONENT);
    return { func: formatMonomialTimesExp(a, n), deriv: productRuleDerivative(a, n), variable: "x" };
  },
};

// Cumulative weekly curriculum per class. `categories` weights should sum
// to 1 within a week.
//
// Weeks 1-2 are identical for both classes per the user (2026-08-17).
// Math 204-1 should never use trig functions — keep that in mind when
// adding future weeks for that class specifically.
//
// Week 3 (2026-08-31): introduces exponential functions (e^x and
// coefficient*e^x only — no chain rule / e^(kx) forms, no general a^x —
// per the user's explicit scoping) via the single `exponential` category.
//
// Week 4 (2026-09-07): introduces the product rule via simple
// monomial*e^x pairs (`productMonomialExp`/`productMonomialExpWithCoefficient`)
// — exponent kept to PRODUCT_MIN_EXPONENT..PRODUCT_MAX_EXPONENT (1-3, smaller
// than the game-wide 0-6) since a product-rule derivative is already more
// work to compute by hand.
const WEEKLY_CURRICULUM = {
  "Math 204-1": [
    { categories: [{ key: "monomial", weight: 0.8 }, { key: "sumOfMonomials", weight: 0.2 }] },
    { categories: [{ key: "monomialWithCoefficient", weight: 0.8 }, { key: "linearCombination", weight: 0.2 }] },
    { categories: [{ key: "exponential", weight: 1.0 }] },
    { categories: [{ key: "productMonomialExp", weight: 0.8 }, { key: "productMonomialExpWithCoefficient", weight: 0.2 }] },
  ],
  "Math 207": [
    { categories: [{ key: "monomial", weight: 0.8 }, { key: "sumOfMonomials", weight: 0.2 }] },
    { categories: [{ key: "monomialWithCoefficient", weight: 0.8 }, { key: "linearCombination", weight: 0.2 }] },
    { categories: [{ key: "exponential", weight: 1.0 }] },
    { categories: [{ key: "productMonomialExp", weight: 0.8 }, { key: "productMonomialExpWithCoefficient", weight: 0.2 }] },
  ],
  // Guest/tester content — a single always-available "week" mixing every
  // category at once, since there's no real weekly pacing to follow here.
  "Guest Practice": [
    {
      categories: [
        { key: "monomial", weight: 0.35 },
        { key: "sumOfMonomials", weight: 0.15 },
        { key: "monomialWithCoefficient", weight: 0.35 },
        { key: "linearCombination", weight: 0.15 },
      ],
    },
  ],
};

function getAvailableWeeks(className) {
  return (WEEKLY_CURRICULUM[className] || []).map((_, i) => i + 1);
}

function getCurrentWeekNumber(className) {
  const available = getAvailableWeeks(className);
  if (available.length === 0) return 1;

  const start = new Date(SEMESTER_START);
  const diffDays = Math.floor((Date.now() - start.getTime()) / (24 * 60 * 60 * 1000));
  const rawWeek = Math.floor(diffDays / 7) + 1;

  return Math.min(Math.max(rawWeek, 1), available.length);
}

function weightedPick(entries) {
  const total = entries.reduce((sum, e) => sum + e.weight, 0);
  let roll = Math.random() * total;
  for (const entry of entries) {
    if (roll < entry.weight) return entry;
    roll -= entry.weight;
  }
  return entries[entries.length - 1];
}

function generateOnePair(className, weekNumber) {
  const weeks = (WEEKLY_CURRICULUM[className] || []).slice(0, weekNumber);
  const pool = weeks.flatMap((week) => week.categories);
  const chosen = weightedPick(pool);
  return CONTENT_CATEGORIES[chosen.key]();
}

// Generates `pairCount` pairs with no duplicate expression text across
// either side (same uniqueness guarantee the old hand-authored pool had —
// two cards showing identical text would be an ambiguous match).
function generateSessionPairs(className, weekNumber, pairCount) {
  const usedTexts = new Set();
  const pairs = [];
  let attempts = 0;

  while (pairs.length < pairCount && attempts < pairCount * 50) {
    attempts++;
    const generated = generateOnePair(className, weekNumber);
    if (usedTexts.has(generated.func) || usedTexts.has(generated.deriv)) continue;
    usedTexts.add(generated.func);
    usedTexts.add(generated.deriv);
    pairs.push({ id: pairs.length + 1, ...generated });
  }

  return pairs;
}

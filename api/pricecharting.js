// PriceCharting proxy — Pokémon card data
// Env var: PRICECHARTING_TOKEN
//
// Actions:
//   ?action=search&q=...           → search products (max ~20 results)
//   ?action=product&id=...         → single product details
//   ?action=set&console=SLUG       → all cards in a Pokémon set (CSV → JSON)
//
// Price fields on PriceCharting for trading cards:
//   loose-price   → Raw / Ungraded
//   graded-price  → PSA 9 (Grade 9)
//   new-price     → PSA 10 (Grade 10)
//   manual-only-price → BGS 10
//   bgs-10-price  → BGS 10 Black Label
//
// All prices returned in cents — frontend divides by 100 for display.

const CACHE = new Map();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1h

function getCached(key) {
  const hit = CACHE.get(key);
  if (!hit) return null;
  if (Date.now() - hit.t > CACHE_TTL_MS) { CACHE.delete(key); return null; }
  return hit.v;
}

function setCached(key, v) {
  CACHE.set(key, { t: Date.now(), v });
}

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const splitRow = (row) => {
    const cells = [];
    let cur = '', inQ = false;
    for (let i = 0; i < row.length; i++) {
      const c = row[i];
      if (inQ) {
        if (c === '"' && row[i + 1] === '"') { cur += '"'; i++; }
        else if (c === '"') { inQ = false; }
        else { cur += c; }
      } else {
        if (c === '"') inQ = true;
        else if (c === ',') { cells.push(cur); cur = ''; }
        else cur += c;
      }
    }
    cells.push(cur);
    return cells;
  };
  const headers = splitRow(lines[0]).map(h => h.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
  return lines.slice(1).map(line => {
    const cells = splitRow(line);
    const row = {};
    headers.forEach((h, i) => { row[h] = cells[i] ?? ''; });
    return row;
  });
}

function priceToCents(s) {
  if (!s) return null;
  const n = parseFloat(String(s).replace(/[^0-9.\-]/g, ''));
  if (!isFinite(n)) return null;
  return Math.round(n * 100);
}

function mapCardRow(r) {
  return {
    id:          r['id'] || r['product-id'] || '',
    name:        r['product-name'] || r['name'] || '',
    console:     r['console-name'] || r['console'] || '',
    raw:         priceToCents(r['loose-price']),
    psa9:        priceToCents(r['graded-price']),
    psa10:       priceToCents(r['new-price'] || r['manual-only-price']),
    bgs10:       priceToCents(r['bgs-10-price']),
    releaseDate: r['release-date'] || '',
  };
}

export default async function handler(req, res) {
  const token = process.env.PRICECHARTING_TOKEN;
  if (!token) return res.status(500).json({ error: 'PRICECHARTING_TOKEN not configured' });

  const action = req.query?.action || 'search';

  try {
    if (action === 'search') {
      const q = req.query?.q;
      if (!q) return res.status(400).json({ error: 'Missing q' });
      const cacheKey = `search:${q}`;
      const cached = getCached(cacheKey);
      if (cached) {
        res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200');
        return res.status(200).json(cached);
      }
      const url = `https://www.pricecharting.com/api/products?t=${encodeURIComponent(token)}&q=${encodeURIComponent(q)}`;
      const r = await fetch(url);
      if (!r.ok) return res.status(502).json({ error: `PriceCharting search failed: ${r.status}` });
      const data = await r.json();
      const products = (data?.products || []).map(p => ({
        id:          p.id,
        name:        p['product-name'] || p.name || '',
        console:     p['console-name'] || '',
        consoleSlug: p['console-slug'] || '',
        releaseDate: p['release-date'] || '',
        raw:         priceToCents(p['loose-price']),
        psa9:        priceToCents(p['graded-price']),
        psa10:       priceToCents(p['new-price'] || p['manual-only-price']),
      }));
      const payload = { products };
      setCached(cacheKey, payload);
      res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200');
      return res.status(200).json(payload);
    }

    if (action === 'product') {
      const id = req.query?.id;
      if (!id) return res.status(400).json({ error: 'Missing id' });
      const cacheKey = `product:${id}`;
      const cached = getCached(cacheKey);
      if (cached) {
        res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200');
        return res.status(200).json(cached);
      }
      const url = `https://www.pricecharting.com/api/product?t=${encodeURIComponent(token)}&id=${encodeURIComponent(id)}`;
      const r = await fetch(url);
      if (!r.ok) return res.status(502).json({ error: `PriceCharting product failed: ${r.status}` });
      const data = await r.json();
      const product = {
        id:          data.id,
        name:        data['product-name'] || '',
        console:     data['console-name'] || '',
        consoleSlug: data['console-slug'] || '',
        releaseDate: data['release-date'] || '',
        raw:         priceToCents(data['loose-price']),
        psa9:        priceToCents(data['graded-price']),
        psa10:       priceToCents(data['new-price'] || data['manual-only-price']),
        bgs10:       priceToCents(data['bgs-10-price']),
      };
      setCached(cacheKey, product);
      res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200');
      return res.status(200).json(product);
    }

    if (action === 'set') {
      const slug = req.query?.console;
      if (!slug) return res.status(400).json({ error: 'Missing console slug' });
      const cacheKey = `set:${slug}`;
      const cached = getCached(cacheKey);
      if (cached) {
        res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200');
        return res.status(200).json(cached);
      }
      // PriceCharting CSV export per console
      const url = `https://www.pricecharting.com/price-guide/download-custom?t=${encodeURIComponent(token)}&console=${encodeURIComponent(slug)}`;
      const r = await fetch(url);
      if (!r.ok) return res.status(502).json({ error: `PriceCharting set CSV failed: ${r.status}` });
      const csv = await r.text();
      const rows = parseCSV(csv);
      const cards = rows.map(mapCardRow).filter(c => c.name);
      // Default sort: PSA 10 desc, nulls last
      cards.sort((a, b) => (b.psa10 ?? -1) - (a.psa10 ?? -1));
      const payload = { console: slug, count: cards.length, cards };
      setCached(cacheKey, payload);
      res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200');
      return res.status(200).json(payload);
    }

    return res.status(400).json({ error: `Unknown action: ${action}` });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

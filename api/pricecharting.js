// PriceCharting proxy — Pokémon card data
// Env vars:
//   PRICECHARTING_TOKEN    — required, your PriceCharting API token
//   KV_REST_API_URL        — optional, Vercel KV REST endpoint (for price-change tracking)
//   KV_REST_API_TOKEN      — optional, Vercel KV REST token
//
// Actions:
//   ?action=search&q=...        → search products (max ~20)
//   ?action=product&id=...      → single product details
//   ?action=set&console=NAME    → all cards in a Pokémon set (filters master CSV)
//                                 + writes daily snapshot to KV, computes 7d delta vs oldest available snapshot
//   ?action=consoles            → list of all Pokémon set console-names
//
// Price field mapping for Pokémon trading cards:
//   loose-price        → Raw / Ungraded
//   cib-price          → Grade 7
//   new-price          → Grade 8
//   graded-price       → Grade 9  / PSA 9
//   box-only-price     → Grade 9.5
//   manual-only-price  → Grade 10 / PSA 10
//   bgs-10-price       → BGS 10 Black Label
//   condition-17-price → CGC 10
//   condition-18-price → SGC 10
//
// All prices returned in cents — frontend divides by 100 for display.

const CACHE = new Map();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1h
const CSV_TTL_MS   = 6 * 60 * 60 * 1000; // 6h for the big CSV

function getCached(key, ttl = CACHE_TTL_MS) {
  const hit = CACHE.get(key);
  if (!hit) return null;
  if (Date.now() - hit.t > ttl) { CACHE.delete(key); return null; }
  return hit.v;
}

function setCached(key, v) {
  CACHE.set(key, { t: Date.now(), v });
}

function parseCSV(text) {
  const lines = text.split(/\r?\n/);
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
  const headers = splitRow(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i]) continue;
    const cells = splitRow(lines[i]);
    const row = {};
    for (let j = 0; j < headers.length; j++) row[headers[j]] = cells[j] ?? '';
    rows.push(row);
  }
  return rows;
}

function priceToCents(s) {
  if (s == null || s === '') return null;
  // Values can be "$12.34" or "1234" (cents int). Normalize.
  const str = String(s).trim();
  if (!str) return null;
  if (str.startsWith('$')) {
    const n = parseFloat(str.replace(/[^0-9.\-]/g, ''));
    return isFinite(n) ? Math.round(n * 100) : null;
  }
  const n = parseInt(str, 10);
  return isFinite(n) ? n : null;
}

function mapCardRow(r) {
  return {
    id:          r['id'] || '',
    name:        r['product-name'] || '',
    console:     r['console-name'] || '',
    raw:         priceToCents(r['loose-price']),
    psa9:        priceToCents(r['graded-price']),
    psa10:       priceToCents(r['manual-only-price']),
    bgs10:       priceToCents(r['bgs-10-price']),
    cgc10:       priceToCents(r['condition-17-price']),
    salesVolume: parseInt(r['sales-volume'] || '0', 10) || 0,
    releaseDate: r['release-date'] || '',
  };
}

// ────────────────── Vercel KV (price-change snapshots) ──────────────────
// Uses Upstash Redis REST API directly so we don't need any npm package.
// Writes a daily snapshot per console, looks back 1-14 days to compute deltas.
// Gracefully no-ops if KV env vars are missing.

function kvConfigured() {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

async function kvCmd(args) {
  if (!kvConfigured()) return null;
  try {
    const r = await fetch(process.env.KV_REST_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.KV_REST_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(args),
    });
    if (!r.ok) return null;
    const d = await r.json();
    return d.result;
  } catch (e) {
    return null;
  }
}

async function kvGet(key) {
  const v = await kvCmd(['GET', key]);
  if (v == null) return null;
  try { return JSON.parse(v); } catch { return null; }
}

async function kvSet(key, value, ttlSec = 60 * 24 * 3600) {
  return await kvCmd(['SET', key, JSON.stringify(value), 'EX', String(ttlSec)]);
}

function ymdUTC(d) {
  // YYYY-MM-DD in UTC, stable across Vercel regions
  return d.toISOString().slice(0, 10);
}

function shiftDays(d, days) {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + days);
  return x;
}

async function fetchOldestSnapshot(consoleName, maxLookback = 14) {
  // Try yesterday, then 2 days ago, ..., up to N days ago.
  // Return the OLDEST snapshot found in [today-maxLookback, today-1] for biggest signal.
  // To minimize KV calls, probe specific anchor days: 7, 14, 3, 1.
  const today = new Date();
  const candidates = [7, 14, 3, 1, 5, 10].filter(n => n <= maxLookback);
  let best = null;
  for (const days of candidates) {
    const date = ymdUTC(shiftDays(today, -days));
    const snap = await kvGet(`pkm:snap:${consoleName}:${date}`);
    if (snap && snap.cards) {
      // Prefer the FURTHEST-back snapshot (bigger delta window)
      if (!best || days > best.daysAgo) {
        best = { ...snap, daysAgo: days };
      }
    }
  }
  return best;
}

async function writeSnapshot(consoleName, cards) {
  const today = ymdUTC(new Date());
  const slim = cards.map(c => ({ id: c.id, raw: c.raw, psa9: c.psa9, psa10: c.psa10 }));
  await kvSet(`pkm:snap:${consoleName}:${today}`, { date: today, cards: slim }, 60 * 24 * 3600);
}

function attachDeltas(cards, snapshot) {
  if (!snapshot || !snapshot.cards) return { cards, since: null, daysAgo: null };
  const idx = {};
  for (const old of snapshot.cards) idx[old.id] = old;
  const enriched = cards.map(c => {
    const old = idx[c.id];
    const out = { ...c };
    if (!old) return out;
    for (const g of ['raw', 'psa9', 'psa10']) {
      const cur = c[g];
      const prv = old[g];
      if (cur != null && prv != null && prv > 0) {
        const diff = cur - prv;
        out[g + 'Change'] = diff;
        out[g + 'Pct']    = Math.round((diff / prv) * 10000) / 100; // 2 decimals
      }
    }
    return out;
  });
  return { cards: enriched, since: snapshot.date, daysAgo: snapshot.daysAgo };
}

async function fetchPokemonMasterCSV(token) {
  const cached = getCached('csv:pokemon', CSV_TTL_MS);
  if (cached) return cached;
  const url = `https://www.pricecharting.com/price-guide/download-custom?t=${encodeURIComponent(token)}&category=pokemon-cards`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`PriceCharting CSV fetch failed: ${r.status}`);
  const csv = await r.text();
  const rows = parseCSV(csv);
  setCached('csv:pokemon', rows);
  return rows;
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
        name:        p['product-name'] || '',
        console:     p['console-name'] || '',
        releaseDate: p['release-date'] || '',
        raw:         priceToCents(p['loose-price']),
        psa9:        priceToCents(p['graded-price']),
        psa10:       priceToCents(p['manual-only-price']),
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
        releaseDate: data['release-date'] || '',
        raw:         priceToCents(data['loose-price']),
        psa9:        priceToCents(data['graded-price']),
        psa10:       priceToCents(data['manual-only-price']),
        bgs10:       priceToCents(data['bgs-10-price']),
      };
      setCached(cacheKey, product);
      res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200');
      return res.status(200).json(product);
    }

    if (action === 'consoles') {
      const cacheKey = 'consoles';
      const cached = getCached(cacheKey);
      if (cached) {
        res.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate=86400');
        return res.status(200).json(cached);
      }
      const rows = await fetchPokemonMasterCSV(token);
      const counts = {};
      for (const r of rows) {
        const c = r['console-name'];
        if (!c) continue;
        counts[c] = (counts[c] || 0) + 1;
      }
      const consoles = Object.keys(counts).map(name => ({ name, cardCount: counts[name] }))
        .sort((a, b) => b.cardCount - a.cardCount);
      const payload = { consoles, total: consoles.length };
      setCached(cacheKey, payload);
      res.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate=86400');
      return res.status(200).json(payload);
    }

    if (action === 'set') {
      const consoleName = req.query?.console;
      if (!consoleName) return res.status(400).json({ error: 'Missing console name' });
      const cacheKey = `set:${consoleName}`;
      const cached = getCached(cacheKey);
      if (cached) {
        res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200');
        return res.status(200).json(cached);
      }
      const rows = await fetchPokemonMasterCSV(token);
      const target = consoleName.toLowerCase();
      const filtered = rows.filter(r => String(r['console-name'] || '').toLowerCase() === target);
      if (!filtered.length) {
        // Soft fallback — case-insensitive substring match (e.g. user typed shorter name)
        const partial = rows.filter(r => String(r['console-name'] || '').toLowerCase().includes(target));
        if (!partial.length) {
          return res.status(404).json({ error: `Aucune carte trouvée pour "${consoleName}"`, hint: 'Vérifier le nom exact du set via ?action=consoles' });
        }
        // If partial yields multiple consoles, fail loudly so caller can refine
        const distinct = [...new Set(partial.map(r => r['console-name']))];
        if (distinct.length > 1) {
          return res.status(400).json({ error: `Plusieurs sets matchent "${consoleName}": ${distinct.slice(0, 5).join(', ')}`, candidates: distinct });
        }
      }
      const rowsToUse = filtered.length ? filtered : rows.filter(r => String(r['console-name'] || '').toLowerCase().includes(target));
      const cards = rowsToUse.map(mapCardRow).filter(c => c.name);
      cards.sort((a, b) => (b.psa10 ?? -1) - (a.psa10 ?? -1));

      // Price-change tracking via Vercel KV (graceful no-op if unconfigured)
      let changeSince = null;
      let changeDaysAgo = null;
      if (kvConfigured()) {
        const snapshot = await fetchOldestSnapshot(consoleName);
        const enriched = attachDeltas(cards, snapshot);
        cards.length = 0;
        cards.push(...enriched.cards);
        changeSince = enriched.since;
        changeDaysAgo = enriched.daysAgo;
        // Fire-and-forget write of today's snapshot
        writeSnapshot(consoleName, cards).catch(() => {});
      }

      const payload = {
        console: consoleName,
        count: cards.length,
        cards,
        changeSince,
        changeDaysAgo,
        changeAvailable: kvConfigured(),
      };
      setCached(cacheKey, payload);
      res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200');
      return res.status(200).json(payload);
    }

    return res.status(400).json({ error: `Unknown action: ${action}` });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

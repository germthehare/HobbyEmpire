// Returns the curated checklist data for a given product key.
// Data source: data/checklists.json (manually maintained by Germain).
// No AI involved — deterministic, hallucination-free.

import fs from 'fs';
import { join } from 'path';

let CACHE = null;

function loadChecklists() {
  if (CACHE) return CACHE;
  const raw = fs.readFileSync(join(process.cwd(), 'data/checklists.json'), 'utf-8');
  CACHE = JSON.parse(raw);
  return CACHE;
}

export default function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');

  try {
    const data = loadChecklists();
    const key = req.query?.key;

    // If no key, return just the list of available product keys
    if (!key) {
      return res.status(200).json({ keys: Object.keys(data) });
    }

    const entry = data[key];
    if (!entry) {
      // Try normalized lookup (e.g. "2025-26 SPx Hockey" vs "2025-2026 SPx Hockey")
      const norm = (s) => String(s).toLowerCase().replace(/\s+/g, ' ').trim();
      const target = norm(key);
      const foundKey = Object.keys(data).find(k => norm(k) === target);
      if (foundKey) {
        return res.status(200).json({ key: foundKey, ...data[foundKey] });
      }
      return res.status(404).json({ error: 'Product not found', key });
    }

    return res.status(200).json({ key, ...entry });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

// api/schedule.js — Break planner (Supabase)
// Table: breaks_schedule
// ENV: SUPABASE_URL, SUPABASE_SERVICE_KEY

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const BASE = () => `${SUPABASE_URL}/rest/v1/breaks_schedule`;

function sbH() {
  return {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
  };
}

function toRow(b) {
  return {
    date:          b.date          || null,
    heure_estimee: b.heureEstimee  || null,
    vendeur:       b.vendeur       || null,
    helper:        b.helper        || null,
    produit:       b.produit       || null,
    categorie:     b.categorie     || null,
    sport:         b.sport         || null,
    type_break:    b.typeBreak     || null,
    notes:         b.notes         || null,
    statut:        b.statut        || 'planifie',
  };
}

function fromRow(r) {
  return {
    id:           r.id,
    createdAt:    r.created_at,
    date:         r.date,
    heureEstimee: r.heure_estimee,
    vendeur:      r.vendeur,
    helper:       r.helper,
    produit:      r.produit,
    categorie:    r.categorie,
    sport:        r.sport,
    typeBreak:    r.type_break,
    notes:        r.notes,
    statut:       r.statut,
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!SUPABASE_URL || !SUPABASE_KEY) return res.status(503).json({ error: 'Supabase not configured' });

  try {
    // GET — list items (optional from/to date filter)
    if (req.method === 'GET') {
      const { from, to } = req.query;
      let url = `${BASE()}?select=*&order=date.asc,heure_estimee.asc`;
      if (from) url += `&date=gte.${from}`;
      if (to)   url += `&date=lte.${to}`;
      const r = await fetch(url, { headers: sbH() });
      const data = await r.json();
      if (!Array.isArray(data)) return res.status(500).json({ error: JSON.stringify(data) });
      return res.status(200).json(data.map(fromRow));
    }

    // POST — create
    if (req.method === 'POST') {
      const r = await fetch(BASE(), {
        method: 'POST',
        headers: { ...sbH(), 'Prefer': 'return=representation' },
        body: JSON.stringify(toRow(req.body)),
      });
      const data = await r.json();
      if (!r.ok) return res.status(500).json({ error: JSON.stringify(data) });
      return res.status(200).json({ ok: true, item: fromRow(data[0]) });
    }

    // PUT — update by id
    if (req.method === 'PUT') {
      const { id } = req.body;
      if (!id) return res.status(400).json({ error: 'Missing id' });
      const r = await fetch(`${BASE()}?id=eq.${id}`, {
        method: 'PATCH',
        headers: { ...sbH(), 'Prefer': 'return=representation' },
        body: JSON.stringify(toRow(req.body)),
      });
      const data = await r.json();
      if (!r.ok) return res.status(500).json({ error: JSON.stringify(data) });
      return res.status(200).json({ ok: true, item: fromRow(data[0]) });
    }

    // DELETE — by id
    if (req.method === 'DELETE') {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: 'Missing id' });
      const r = await fetch(`${BASE()}?id=eq.${id}`, { method: 'DELETE', headers: sbH() });
      return res.status(r.ok ? 200 : 500).json({ ok: r.ok });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}

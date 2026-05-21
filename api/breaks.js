// api/breaks.js — Supabase-backed breaks database
// Replaces api/sheets.js
// Env vars: SUPABASE_URL, SUPABASE_SERVICE_KEY

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

function sbHeaders() {
  return {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
  };
}

// camelCase payload → snake_case DB row
function toRow(p) {
  return {
    date:            p.date            || null,
    nom_break:       p.nomBreak        || null,
    vendeur:         p.vendeur         || null,
    helper:          p.helper          || null,
    categorie:       p.categorie       || null,
    sport:           p.sport           || null,
    type_break:      p.typeBreak       || null,
    duree:           parseFloat(p.duree)          || 0,
    rev_heure:       parseFloat(p.revHeure)        || 0,
    cout_produits:   parseFloat(p.coutProduits)    || 0,
    heure_debut:     p.heureDebut      || null,
    salaire_vendeur: parseFloat(p.salaireVendeur)  || 0,
    salaire_helper:  parseFloat(p.salaireHelper)   || 0,
    cout_salaires:   parseFloat(p.coutSalaires)    || 0,
    semaine:         p.semaine         || null,
    mois:            p.mois            || null,
    annee:           p.annee           || null,
    jour:            p.jour            || null,
    ventes_brutes:   parseFloat(p.ventesBrutes)    || 0,
    revenu_reel:     parseFloat(p.revenuReel)      || 0,
    benefice_net:    parseFloat(p.beneficeNet)     || 0,
    marge:           parseFloat(p.marge)           || 0,
  };
}

// snake_case DB row → camelCase response
function fromRow(r) {
  return {
    id:             r.id,
    createdAt:      r.created_at,
    date:           r.date,
    nomBreak:       r.nom_break,
    vendeur:        r.vendeur,
    helper:         r.helper,
    categorie:      r.categorie,
    sport:          r.sport,
    typeBreak:      r.type_break,
    duree:          r.duree,
    revHeure:       r.rev_heure,
    coutProduits:   r.cout_produits,
    heureDebut:     r.heure_debut,
    salaireVendeur: r.salaire_vendeur,
    salaireHelper:  r.salaire_helper,
    coutSalaires:   r.cout_salaires,
    semaine:        r.semaine,
    mois:           r.mois,
    annee:          r.annee,
    jour:           r.jour,
    ventesBrutes:   r.ventes_brutes,
    revenuReel:     r.revenu_reel,
    beneficeNet:    r.benefice_net,
    marge:          r.marge,
  };
}

function toCSV(breaks) {
  const cols = [
    'id','date','nomBreak','vendeur','helper','sport','categorie','typeBreak',
    'duree','ventesBrutes','coutProduits','coutSalaires','salaireVendeur','salaireHelper',
    'beneficeNet','marge','revHeure','heureDebut','semaine','mois','annee','jour'
  ];
  const escape = v => v == null ? '' : '"' + String(v).replace(/"/g, '""') + '"';
  return [cols.join(','), ...breaks.map(b => cols.map(c => escape(b[c])).join(','))].join('\n');
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.status(503).json({ error: 'Supabase not configured' });
  }

  const base = `${SUPABASE_URL}/rest/v1/breaks`;

  try {
    // ── GET — list all breaks (+ CSV export) ──────────────────────────────
    if (req.method === 'GET') {
      const { format, vendeur, sport, annee } = req.query;

      let url = `${base}?select=*&order=date.desc,created_at.desc`;
      if (vendeur) url += `&vendeur=eq.${encodeURIComponent(vendeur)}`;
      if (sport)   url += `&sport=eq.${encodeURIComponent(sport)}`;
      if (annee)   url += `&annee=eq.${encodeURIComponent(annee)}`;

      const r = await fetch(url, { headers: sbHeaders() });
      const data = await r.json();
      if (!Array.isArray(data)) return res.status(500).json({ error: JSON.stringify(data) });

      const breaks = data.map(fromRow);

      if (format === 'csv') {
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="breaks-${new Date().toISOString().slice(0,10)}.csv"`);
        return res.status(200).send(toCSV(breaks));
      }

      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json(breaks);
    }

    // ── POST — create new break ───────────────────────────────────────────
    if (req.method === 'POST') {
      const row = toRow(req.body);
      const r = await fetch(base, {
        method: 'POST',
        headers: { ...sbHeaders(), 'Prefer': 'return=representation' },
        body: JSON.stringify(row),
      });
      const data = await r.json();
      if (!r.ok) return res.status(500).json({ error: JSON.stringify(data) });
      return res.status(200).json({ ok: true, break: fromRow(data[0]) });
    }

    // ── PUT — update existing break by id ────────────────────────────────
    if (req.method === 'PUT') {
      const { id } = req.body;
      if (!id) return res.status(400).json({ error: 'Missing id' });
      const row = toRow(req.body);
      const r = await fetch(`${base}?id=eq.${id}`, {
        method: 'PATCH',
        headers: { ...sbHeaders(), 'Prefer': 'return=representation' },
        body: JSON.stringify(row),
      });
      const data = await r.json();
      if (!r.ok) return res.status(500).json({ error: JSON.stringify(data) });
      return res.status(200).json({ ok: true, break: fromRow(data[0]) });
    }

    // ── DELETE — remove a break ───────────────────────────────────────────
    if (req.method === 'DELETE') {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: 'Missing id' });
      const r = await fetch(`${base}?id=eq.${id}`, {
        method: 'DELETE',
        headers: sbHeaders(),
      });
      return res.status(r.ok ? 200 : 500).json({ ok: r.ok });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

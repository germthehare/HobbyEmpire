// api/migrate.js — one-time migration: Google Sheets → Supabase
// Call once: GET /api/migrate
// Admin only — remove after migration is complete

const SHEETS_URL = process.env.SHEETS_WEBAPP_URL || 'https://script.google.com/macros/s/AKfycbwt0_dG5WStIUXNjN0_hqSRk8nLEsJ6qQ3aaORvPK7OKSbwmIugwIcaFcn-Fr6j6X1Lrw/exec';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

function fixDate(val) {
  if (!val) return null;
  if (typeof val === 'string' && val.match(/^\d{4}-\d{2}-\d{2}/)) return val;
  const num = Number(val);
  if (!isNaN(num) && num > 40000) {
    const d = new Date((num - 25569) * 86400 * 1000);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
  }
  return String(val);
}

function toRow(p) {
  return {
    date:            fixDate(p.date),
    nom_break:       p.nomBreak        || null,
    vendeur:         p.vendeur         || null,
    helper:          p.helper          || null,
    categorie:       p.categorie       || null,
    sport:           p.sport           || null,
    type_break:      p.typeBreak       || null,
    duree:           parseFloat(p.duree)         || 0,
    rev_heure:       parseFloat(p.revHeure)       || 0,
    cout_produits:   parseFloat(p.coutProduits)   || 0,
    heure_debut:     p.heureDebut      || null,
    salaire_vendeur: parseFloat(p.salaireVendeur) || 0,
    salaire_helper:  parseFloat(p.salaireHelper)  || 0,
    cout_salaires:   parseFloat(p.coutSalaires)   || 0,
    semaine:         parseInt(p.semaine)   || null,
    mois:            parseInt(p.mois)      || null,
    annee:           parseInt(p.annee)     || null,
    jour:            p.jour             || null,
    ventes_brutes:   parseFloat(p.ventesBrutes)   || 0,
    revenu_reel:     parseFloat(p.revenuReel)     || 0,
    benefice_net:    parseFloat(p.beneficeNet)    || 0,
    marge:           parseFloat(p.marge)          || 0,
  };
}

export default async function handler(req, res) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return res.status(503).json({ error: 'Supabase not configured' });

  try {
    // 1. Fetch all breaks from Google Sheets
    const sheetsRes = await fetch(SHEETS_URL, { redirect: 'follow' });
    const sheetsData = await sheetsRes.json();
    if (!Array.isArray(sheetsData)) return res.status(500).json({ error: 'Could not fetch Sheets data' });

    const rows = sheetsData.map(toRow);

    // 2. Insert all into Supabase (upsert to avoid duplicates on re-run)
    const sbRes = await fetch(`${SUPABASE_URL}/rest/v1/breaks`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify(rows),
    });

    if (!sbRes.ok) {
      const err = await sbRes.text();
      return res.status(500).json({ error: err });
    }

    return res.status(200).json({ ok: true, migrated: rows.length, message: `${rows.length} breaks migrés vers Supabase` });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

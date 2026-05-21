export const config = { maxDuration: 30 };

// Convert Google Sheets date serial number to YYYY-MM-DD string
function fixDate(val) {
  if (!val) return '';
  if (typeof val === 'string' && val.match(/^\d{4}-\d{2}-\d{2}/)) return val;
  const num = Number(val);
  if (!isNaN(num) && num > 40000) {
    const d = new Date((num - 25569) * 86400 * 1000);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  return String(val);
}

const SHEETS_URL = process.env.SHEETS_WEBAPP_URL || 'https://script.google.com/macros/s/AKfycbwt0_dG5WStIUXNjN0_hqSRk8nLEsJ6qQ3aaORvPK7OKSbwmIugwIcaFcn-Fr6j6X1Lrw/exec';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!SHEETS_URL) return res.status(503).json({ error: 'SHEETS_WEBAPP_URL not configured' });

  try {
    if (req.method === 'GET') {
      const response = await fetch(SHEETS_URL, { redirect: 'follow' });
      const data = await response.json();
      const fixed = Array.isArray(data) ? data.map((b, i) => ({
        ...b,
        date: fixDate(b.date),
        _rowIndex: i   // 0-based index for updates
      })) : data;
      return res.status(200).json(fixed);
    }

    if (req.method === 'POST') {
      const response = await fetch(SHEETS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req.body),
        redirect: 'follow'
      });
      const data = await response.json();
      return res.status(200).json(data);
    }

    // PUT — update an existing row (requires Apps Script to handle _action:'update')
    if (req.method === 'PUT') {
      const response = await fetch(SHEETS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...req.body, _action: 'update' }),
        redirect: 'follow'
      });
      const data = await response.json();
      return res.status(200).json(data);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

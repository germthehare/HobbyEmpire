export const config = { maxDuration: 30 };

const SHEETS_URL = process.env.SHEETS_WEBAPP_URL || 'https://script.google.com/macros/s/AKfycbwt0_dG5WStIUXNjN0_hqSRk8nLEsJ6qQ3aaORvPK7OKSbwmIugwIcaFcn-Fr6j6X1Lrw/exec';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!SHEETS_URL) {
    return res.status(503).json({ error: 'SHEETS_WEBAPP_URL not configured' });
  }

  try {
    if (req.method === 'GET') {
      const response = await fetch(SHEETS_URL, { redirect: 'follow' });
      const data = await response.json();
      return res.status(200).json(data);
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

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

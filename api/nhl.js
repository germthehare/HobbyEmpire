// Proxy for NHL API (no CORS headers on their end)
export default async function handler(req, res) {
  const { path } = req.query;
  if (!path) return res.status(400).json({ error: 'Missing path' });

  try {
    const url = `https://api-web.nhle.com/v1/${path}`;
    const r = await fetch(url, { headers: { Accept: 'application/json' } });

    if (!r.ok) return res.status(r.status).json({ error: 'NHL API error' });

    const data = await r.json();
    // Cache 60s at edge, serve stale up to 5min
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json(data);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

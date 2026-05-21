// eBay Browse API — sold card listings
// Env vars needed: EBAY_CLIENT_ID, EBAY_CLIENT_SECRET

let cachedToken = null;
let tokenExpiry = 0;

async function getAppToken() {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;

  const clientId     = process.env.EBAY_CLIENT_ID;
  const clientSecret = process.env.EBAY_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('eBay credentials not configured');

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const r = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type':  'application/x-www-form-urlencoded',
      'Authorization': `Basic ${credentials}`,
    },
    body: 'grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope',
  });

  const d = await r.json();
  if (!d.access_token) throw new Error('eBay OAuth error: ' + JSON.stringify(d));

  cachedToken  = d.access_token;
  tokenExpiry  = Date.now() + (d.expires_in - 300) * 1000;
  return cachedToken;
}

export default async function handler(req, res) {
  const { q, limit = '6' } = req.query;
  if (!q) return res.status(400).json({ error: 'Missing query (q)' });

  try {
    const token  = await getAppToken();
    const params = new URLSearchParams({
      q,
      category_ids: '212',
      filter:       'soldItemsOnly:true',
      sort:         '-price',
      limit,
    });

    const r = await fetch(
      `https://api.ebay.com/buy/browse/v1/item_summary/search?${params}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    const data = await r.json();
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    return res.status(200).json(data);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

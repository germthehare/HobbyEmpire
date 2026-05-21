// eBay — sold card listings
// Tries Marketplace Insights API (modern, 5000/day) first,
// falls back to Finding API if needed.
// Env vars: EBAY_CLIENT_ID, EBAY_CLIENT_SECRET

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
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Authorization': `Basic ${credentials}` },
    body: 'grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope',
  });
  const d = await r.json();
  if (!d.access_token) throw new Error('eBay OAuth error: ' + JSON.stringify(d));
  cachedToken = d.access_token;
  tokenExpiry = Date.now() + (d.expires_in - 300) * 1000;
  return cachedToken;
}

async function tryMarketplaceInsights(q, limit, token) {
  const params = new URLSearchParams({ q, category_ids: '212', sort: 'soldDate', limit });
  const r = await fetch(
    `https://api.ebay.com/buy/marketplace_insights/v1_beta/item_sales/search?${params}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const data = await r.json();
  if (data.errors || !data.itemSales) { console.error('MI raw:', JSON.stringify(data).slice(0,300)); return null; }
  return data.itemSales.map(item => ({
    title:      item.title || '',
    itemWebUrl: item.itemWebUrl || '',
    image:      { imageUrl: item.image?.imageUrl || '' },
    price:      { value: item.lastSoldPrice?.value || item.price?.value || '0' },
  }));
}

async function tryFindingAPI(q, limit, appId) {
  const params = new URLSearchParams({
    'OPERATION-NAME':                 'findCompletedItems',
    'SERVICE-VERSION':                '1.0.0',
    'SECURITY-APPNAME':               appId,
    'RESPONSE-DATA-FORMAT':           'JSON',
    'keywords':                       q,
    'categoryId':                     '212',
    'itemFilter(0).name':             'SoldItemsOnly',
    'itemFilter(0).value':            'true',
    'sortOrder':                      'EndTimeSoonest',
    'paginationInput.entriesPerPage': String(limit),
  });
  const r = await fetch(`https://svcs.ebay.com/services/search/FindingService/v1?${params}`);
  const raw = await r.json();
  if (raw?.errorMessage) return null;
  const searchResult = raw?.findCompletedItemsResponse?.[0]?.searchResult?.[0];
  return (searchResult?.item || []).map(item => ({
    title:      item.title?.[0] || '',
    itemWebUrl: item.viewItemURL?.[0] || '',
    image:      { imageUrl: item.galleryURL?.[0] || '' },
    price:      { value: item.sellingStatus?.[0]?.convertedCurrentPrice?.[0]?.['__value__'] || '0' },
  }));
}

export default async function handler(req, res) {
  const { q, limit = '6' } = req.query;
  if (!q) return res.status(400).json({ error: 'Missing query (q)' });

  const appId = process.env.EBAY_CLIENT_ID;

  try {
    const debug = {};

    // Try Marketplace Insights API first (modern, 5000/day, sold items)
    let items = null;
    try {
      const token = await getAppToken();
      debug.token = 'ok';
      items = await tryMarketplaceInsights(q, limit, token);
      debug.insights = items ? `${items.length} items` : 'null';
    } catch (e) { debug.insightsErr = e.message; }

    // Fall back to Finding API if Marketplace Insights fails
    if (!items && appId) {
      items = await tryFindingAPI(q, limit, appId);
      debug.finding = items ? `${items.length} items` : 'null (rate limited?)';
    }

    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200');
    return res.status(200).json({ itemSummaries: items || [], _debug: debug });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

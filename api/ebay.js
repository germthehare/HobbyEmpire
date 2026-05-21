// eBay Finding API — completed/sold card listings
// Auth: App ID only (no OAuth needed)
// Env var: EBAY_CLIENT_ID (App ID / Client ID)

export default async function handler(req, res) {
  const { q, limit = '6' } = req.query;
  if (!q) return res.status(400).json({ error: 'Missing query (q)' });

  const appId = process.env.EBAY_CLIENT_ID;
  if (!appId) return res.status(500).json({ error: 'eBay App ID not configured' });

  try {
    const params = new URLSearchParams({
      'OPERATION-NAME':        'findCompletedItems',
      'SERVICE-VERSION':       '1.0.0',
      'SECURITY-APPNAME':      appId,
      'RESPONSE-DATA-FORMAT':  'JSON',
      'keywords':              q,
      'categoryId':            '212',
      'itemFilter(0).name':    'SoldItemsOnly',
      'itemFilter(0).value':   'true',
      'sortOrder':             'EndTimeSoonest',
      'paginationInput.entriesPerPage': limit,
    });

    const r = await fetch(
      `https://svcs.ebay.com/services/search/FindingService/v1?${params}`
    );
    const raw = await r.json();

    // Normalize response to match what the front-end expects
    const searchResult = raw?.findCompletedItemsResponse?.[0]?.searchResult?.[0];
    const items = (searchResult?.item || []).map(item => ({
      title:      item.title?.[0] || '',
      itemWebUrl: item.viewItemURL?.[0] || '',
      image:      { imageUrl: item.galleryURL?.[0] || '' },
      price:      { value: item.sellingStatus?.[0]?.convertedCurrentPrice?.[0]?.['__value__'] || '0' },
    }));

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    return res.status(200).json({ itemSummaries: items });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

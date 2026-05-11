// NewsAPI.org proxy — keeps API key server-side
// Env var: NEWS_API_KEY

const QUERIES = {
  nhl:        'NHL hockey',
  ahl:        'AHL "american hockey league"',
  ohl:        'OHL "ontario hockey league"',
  whl:        'WHL "western hockey league"',
  lhjmq:      'LHJMQ OR "Quebec Major Junior"',
  ncaa:       'NCAA "college hockey"',
  nfl:        'NFL "national football league" football',
  nba:        'NBA "national basketball association" basketball',
  hockey:     'hockey cards trading cards',
  football:   'football cards "trading cards"',
  basketball: 'basketball cards "trading cards"',
  baseball:   'baseball cards "trading cards"',
};

export default async function handler(req, res) {
  const apiKey = process.env.NEWS_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'NEWS_API_KEY not configured' });

  const league = req.query.league || 'nhl';
  const q = QUERIES[league] || req.query.q || 'NHL hockey';
  const pageSize = req.query.limit || '15';

  try {
    const params = new URLSearchParams({
      q,
      sortBy:   'publishedAt',
      pageSize,
      language: 'en',
      apiKey,
    });

    const r = await fetch(`https://newsapi.org/v2/everything?${params}`);
    const d = await r.json();

    if (d.status !== 'ok') return res.status(500).json({ error: d.message });

    // Normalize to same shape as rss2json
    const items = (d.articles || []).map(a => ({
      title:       a.title || '',
      link:        a.url   || '#',
      excerpt:     a.description || '',
      image:       a.urlToImage || null,
      date:        a.publishedAt,
      sourceName:  a.source?.name || 'News',
    }));

    // Cache 10 min at edge (100 req/day limit)
    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=1200');
    return res.status(200).json({ items });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

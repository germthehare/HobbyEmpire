// === Hobby Empire — News & NHL widget JS ===================================
// Charge le feed Actualités (RSS hobby + NewsAPI ligues + NHL scores/leaders/
// standings/bracket). À inclure après tokens.css/news.css.
//
// Markup attendu (voir index.html) :
//   <div class="news-filters">  → 4 boutons .news-sport-btn[data-sport]
//   <div id="hockey-leagues" class="league-tabs"> → boutons .league-tab[data-league]
//   <div id="other-sport-bar" class="news-filters"> → bouton refresh
//   <div id="news-feed">   → conteneur du feed (rendu ici)
// ---------------------------------------------------------------------------

(function() {
  let newsItems = [], newsFilter = 'all', newsSport = 'hockey', newsLeague = 'hobby';
  const newsCache = {};
  let nhlData = { leaders: {}, standings: [], bracket: null, scores: [], news: [] };
  let leadersTab = 'points';
  let leadersMode = 'season';
  let standingsTab = 'ALL';
  const NHL_SEASON = '20252026';

  // ── News sources ─────────────────────────────────────────────────────────
  const LEAGUE_FEEDS = {
    // ── Hockey ──────────────────────────────────────────────────────────
    hobby: [
      { label: 'Beckett Hockey',       cls: 'src-beckett',    url: 'https://www.beckett.com/news/category/hockey/feed/' },
      { label: 'Cardboard Connection', cls: 'src-cardboard',  url: 'https://cardboardconnection.com/category/hockey-cards/feed/' },
      { label: 'SC Investor',          cls: 'src-sportscard', url: 'https://sportscardsinvestor.com/feed/' },
    ],
    // nhl → handled by loadNHLTab() which adds CBC + RDS directly
    nhl: [],
    ahl:   [{ label: 'AHL',                cls: 'src-hockey', url: 'https://theahl.com/rss/news' }],
    ncaa:  [
      { label: 'USCHO',               cls: 'src-hockey', url: 'https://www.uscho.com/feed/' },
      { label: 'College Hockey News', cls: 'src-hockey', url: 'https://www.collegehockeynews.com/feed/' },
    ],
    ohl:   [{ label: 'OHL',   cls: 'src-hockey', url: 'https://ontariohockeyleague.com/feed/' }],
    whl:   [{ label: 'WHL',   cls: 'src-hockey', url: 'https://whl.ca/feed/' }],
    lhjmq: [{ label: 'LHJMQ',cls: 'src-hockey', url: 'https://www.lhjmq.qc.ca/en/rss/news' }],
    // ── Football ─────────────────────────────────────────────────────────
    nfl: [
      { label: 'ESPN',              cls: 'src-default', url: 'https://www.espn.com/espn/rss/nfl/news' },
      { label: 'Pro Football Talk', cls: 'src-default', url: 'https://profootballtalk.nbcsports.com/feed/' },
      { label: 'CBS Sports',        cls: 'src-default', url: 'https://www.cbssports.com/rss/headlines/nfl/' },
    ],
    // ── Basketball ───────────────────────────────────────────────────────
    nba: [
      { label: 'ESPN',       cls: 'src-default', url: 'https://www.espn.com/espn/rss/nba/news' },
      { label: 'CBS Sports', cls: 'src-default', url: 'https://www.cbssports.com/rss/headlines/nba/' },
    ],
    // ── Baseball ─────────────────────────────────────────────────────────
    mlb: [
      { label: 'ESPN',       cls: 'src-default', url: 'https://www.espn.com/espn/rss/mlb/news' },
      { label: 'MLB.com',    cls: 'src-mlb',     url: 'https://www.mlb.com/feeds/news/rss.xml' },
      { label: 'CBS Sports', cls: 'src-default', url: 'https://www.cbssports.com/rss/headlines/mlb/' },
    ],
  };

  const NEWS_SOURCES = [
    { id: 'beckett-hockey',    label: 'Beckett Hockey',       sport: 'hockey',     cls: 'src-beckett',    url: 'https://www.beckett.com/news/category/hockey/feed/' },
    { id: 'cardboard-hockey',  label: 'Cardboard Connection', sport: 'hockey',     cls: 'src-cardboard',  url: 'https://cardboardconnection.com/category/hockey-cards/feed/' },
    { id: 'beckett-football',  label: 'Beckett Football',     sport: 'football',   cls: 'src-beckett',    url: 'https://www.beckett.com/news/category/football/feed/' },
    { id: 'cardboard-football',label: 'Cardboard Connection', sport: 'football',   cls: 'src-cardboard',  url: 'https://cardboardconnection.com/category/football-cards/feed/' },
    { id: 'beckett-bball',     label: 'Beckett Basketball',   sport: 'basketball', cls: 'src-beckett',    url: 'https://www.beckett.com/news/category/basketball/feed/' },
    { id: 'cardboard-bball',   label: 'Cardboard Connection', sport: 'basketball', cls: 'src-cardboard',  url: 'https://cardboardconnection.com/category/basketball-cards/feed/' },
    { id: 'beckett-baseball',  label: 'Beckett Baseball',     sport: 'baseball',   cls: 'src-beckett',    url: 'https://www.beckett.com/news/category/baseball/feed/' },
    { id: 'cardboard-baseball',label: 'Cardboard Connection', sport: 'baseball',   cls: 'src-cardboard',  url: 'https://cardboardconnection.com/category/baseball-cards/feed/' },
    { id: 'sportscard',        label: 'SC Investor',          sport: 'all',        cls: 'src-sportscard', url: 'https://sportscardsinvestor.com/feed/' },
  ];

  const RSS2JSON = 'https://api.rss2json.com/v1/api.json?rss_url=';
  // Ligues hockey desservies par NewsAPI (pas de flux RSS fiable)
  const HOCKEY_API_LEAGUES = ['ahl','ohl','whl','lhjmq','ncaa'];

  async function fetchFeed(source) {
    try {
      const r = await fetch(RSS2JSON + encodeURIComponent(source.url));
      const d = await r.json();
      if (d.status !== 'ok') return [];
      return (d.items || []).map(item => ({
        title:   (item.title || '').replace(/<[^>]+>/g, '').trim(),
        link:    item.link || item.guid || '#',
        excerpt: (item.description || item.content || '').replace(/<[^>]+>/g, '').replace(/\s+/g,' ').trim().slice(0, 180),
        date:    new Date(item.pubDate || item.published || Date.now()),
        source:  source,
      }));
    } catch(e) { return []; }
  }

  // ── NHL Scores ────────────────────────────────────────────────────────
  function buildScoreCard(g) {
    const away = g.awayTeam, home = g.homeTeam;
    const state = g.gameState;
    const isFinal = state === 'OFF' || state === 'FINAL';
    const isLive  = state === 'LIVE' || state === 'CRIT';
    const stateLabel = isFinal ? 'Final' : isLive ? 'En direct' : g.startTimeUTC
      ? new Date(g.startTimeUTC).toLocaleTimeString('fr-CA',{hour:'2-digit',minute:'2-digit'})
      : 'À venir';
    const stateClass = isFinal ? 'final' : isLive ? 'live' : '';
    const awayScore = away.score ?? '';
    const homeScore = home.score ?? '';
    const awayWin = isFinal && awayScore > homeScore;
    const homeWin = isFinal && homeScore > awayScore;

    let serieHtml = '';
    const s = g.seriesStatus;
    if (s) {
      const leader = s.topSeedWins > s.bottomSeedWins ? s.topSeedTeamAbbrev
                   : s.bottomSeedWins > s.topSeedWins ? s.bottomSeedTeamAbbrev : null;
      const tied   = s.topSeedWins === s.bottomSeedWins;
      const serieLabel = tied
        ? `Égalité ${s.topSeedWins}-${s.bottomSeedWins}`
        : `${leader} mène ${Math.max(s.topSeedWins,s.bottomSeedWins)}-${Math.min(s.topSeedWins,s.bottomSeedWins)}`;
      serieHtml = `Mtch ${s.gameNumberOfSeries} · ${serieLabel}`;
    }

    const leaders = (g.teamLeaders || []).filter(l => l.category === 'goals' || l.category === 'assists');
    const leadersHtml = leaders.length ? `<div class="score-leaders">` +
      leaders.slice(0,3).map(l => {
        const last = l.lastName?.default || l.firstName?.default || '';
        const cat = l.category === 'goals' ? 'B' : 'P';
        return `<div class="score-leader"><span class="sc-name">${last}</span><span class="sc-stat">${l.value}</span><span class="sc-cat">${cat}</span></div>`;
      }).join('') + `</div>` : '';

    return `<div class="score-card">
      <div class="score-head-bar">
        <div class="score-state ${stateClass}">${stateLabel}</div>
        ${serieHtml ? `<div class="score-serie-top">${serieHtml}</div>` : ''}
      </div>
      <div class="score-body">
        <div class="score-team">
          <img class="score-logo" src="${away.logo||''}" onerror="this.style.display='none'" />
          <span class="score-abbrev${awayWin?' winner':''}">${away.abbrev||''}</span>
          ${awayScore !== '' ? `<span class="score-pts${awayWin?' winner':''}">${awayScore}</span>` : ''}
        </div>
        <div class="score-team">
          <img class="score-logo" src="${home.logo||''}" onerror="this.style.display='none'" />
          <span class="score-abbrev${homeWin?' winner':''}">${home.abbrev||''}</span>
          ${homeScore !== '' ? `<span class="score-pts${homeWin?' winner':''}">${homeScore}</span>` : ''}
        </div>
      </div>
      ${leadersHtml}
    </div>`;
  }

  // ── News rendering ───────────────────────────────────────────────────
  function timeAgo(date) {
    const s = Math.floor((Date.now() - date) / 1000);
    if (s < 60)   return "À l'instant";
    if (s < 3600) return Math.floor(s/60) + ' min';
    if (s < 86400) return Math.floor(s/3600) + 'h';
    if (s < 604800) return Math.floor(s/86400) + 'j';
    return date.toLocaleDateString('fr-CA', { month: 'short', day: 'numeric' });
  }

  function renderNewsItem(item) {
    const date  = item.date ? new Date(item.date) : null;
    const age   = date ? timeAgo(date) : '';
    const src   = item.source || {};
    const label = src.label || item.sourceName || '';
    const cls   = src.cls   || 'src-default';
    const img   = item.image ? `<img class="news-thumb" src="${item.image}" onerror="this.style.display='none'" />` : '';
    return `<a class="news-card" href="${item.link}" target="_blank" rel="noopener">
      ${img}
      <div class="news-meta">
        <span class="news-source ${cls}">${label}</span>
        ${age ? `<span class="news-age">${age}</span>` : ''}
      </div>
      <div class="news-title">${item.title}</div>
      ${item.excerpt ? `<div class="news-excerpt">${item.excerpt}</div>` : ''}
    </a>`;
  }

  function renderNews() {
    const feed = document.getElementById('news-feed');
    if (!feed) return;
    if (!newsItems.length) {
      feed.innerHTML = '<div class="news-empty">Aucune nouvelle disponible pour le moment.</div>';
      return;
    }
    feed.innerHTML = newsItems.map(item => renderNewsItem(item)).join('');
  }

  // ── Leaders ──────────────────────────────────────────────────────────
  function renderLeadersList() {
    const modeData = nhlData.leaders[leadersMode] || {};
    const players  = modeData[leadersTab] || [];
    if (!players.length) return '<div style="padding:16px;text-align:center;color:var(--ink-3);font-size:13px">Données non disponibles</div>';
    return players.map((p, i) => `
      <div class="leader-row">
        <span class="leader-rank">${i+1}</span>
        <img class="leader-headshot" src="${p.headshot||''}" onerror="this.style.display='none'" />
        <div class="leader-info">
          <div class="leader-name">${p.firstName?.default||''} ${p.lastName?.default||''}</div>
          <div class="leader-team">${p.teamAbbrev||''}</div>
        </div>
        <span class="leader-val">${p.value}</span>
      </div>`).join('');
  }

  function renderLeadersSection() {
    const cats  = [{id:'points',label:'Pts'},{id:'goals',label:'Buts'},{id:'assists',label:'Passes'}];
    const modes = [{id:'season',label:'Saison'},{id:'playoffs',label:'Playoffs'}];
    const catPills  = cats.map(c  => `<button class="nhl-tab leaders-pill${leadersTab===c.id?' active':''}"  data-cat="${c.id}"  onclick="HE_NEWS.switchLeadersTab('${c.id}')">${c.label}</button>`).join('');
    const modePills = modes.map(m => `<button class="nhl-tab leaders-mode-pill${leadersMode===m.id?' active':''}" data-mode="${m.id}" onclick="HE_NEWS.switchLeadersMode('${m.id}')">${m.label}</button>`).join('');
    return `<div class="nhl-section">
      <div class="nhl-section-head">
        <span class="nhl-section-title">Meneurs LNH</span>
        <div class="nhl-tabs" style="gap:8px">${modePills}<span style="width:1px;background:var(--line);align-self:stretch"></span>${catPills}</div>
      </div>
      <div class="leaders-list" id="leaders-list">${renderLeadersList()}</div>
    </div>`;
  }

  function switchLeadersTab(cat) {
    leadersTab = cat;
    document.querySelectorAll('.leaders-pill').forEach(b => b.classList.toggle('active', b.dataset.cat === cat));
    const el = document.getElementById('leaders-list');
    if (el) el.innerHTML = renderLeadersList();
  }

  function switchLeadersMode(mode) {
    leadersMode = mode;
    document.querySelectorAll('.leaders-mode-pill').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
    const el = document.getElementById('leaders-list');
    if (el) el.innerHTML = renderLeadersList();
  }

  // ── Standings ────────────────────────────────────────────────────────
  function renderStandingsRows() {
    const all = nhlData.standings;
    if (!all.length) return '<tr><td colspan="6" style="padding:14px;text-align:center;color:var(--ink-3)">Données non disponibles</td></tr>';

    let filtered, playoffCutoff;
    if      (standingsTab === 'ALL') { filtered = [...all]; playoffCutoff = -1; }
    else if (standingsTab === 'E')   { filtered = all.filter(t=>t.conferenceAbbrev==='E'); playoffCutoff = 8; }
    else if (standingsTab === 'W')   { filtered = all.filter(t=>t.conferenceAbbrev==='W'); playoffCutoff = 8; }
    else                              { filtered = all.filter(t=>t.divisionAbbrev===standingsTab); playoffCutoff = 3; }

    filtered.sort((a,b) => (b.points||0)-(a.points||0) || (b.wins||0)-(a.wins||0));

    return filtered.map((t, i) => {
      const abbrev = typeof t.teamAbbrev==='object' ? (t.teamAbbrev?.default||'') : (t.teamAbbrev||'');
      const inPlayoff = playoffCutoff > 0 && i < playoffCutoff;
      return `<tr class="${inPlayoff?'playoff-spot':''}">
        <td><img class="st-logo" src="${t.teamLogo||''}" onerror="this.style.display='none'" /><span class="st-abbrev">${abbrev}</span></td>
        <td class="num">${t.gamesPlayed||0}</td>
        <td class="num">${t.wins||0}</td>
        <td class="num">${t.losses||0}</td>
        <td class="num">${t.otLosses||0}</td>
        <td class="num td-pts">${t.points||0}</td>
      </tr>`;
    }).join('');
  }

  function renderStandingsSection() {
    const tabs = [
      {id:'ALL',label:'LNH'},{id:'E',label:'Est'},{id:'W',label:'Ouest'},
      {id:'A',label:'Atl'},{id:'M',label:'Mét'},{id:'C',label:'Cen'},{id:'P',label:'Pac'},
    ];
    const pills = tabs.map(t => `<button class="nhl-tab standings-pill${standingsTab===t.id?' active':''}" data-tab="${t.id}" onclick="HE_NEWS.switchStandingsTab('${t.id}')">${t.label}</button>`).join('');
    return `<div class="nhl-section">
      <div class="nhl-section-head" style="flex-wrap:wrap;gap:6px">
        <span class="nhl-section-title">Classement</span>
        <div class="nhl-tabs" style="flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none">${pills}</div>
      </div>
      <table class="standings-tbl">
        <thead><tr>
          <th>Équipe</th><th class="num">PJ</th><th class="num">V</th><th class="num">D</th><th class="num">DP</th><th class="num">Pts</th>
        </tr></thead>
        <tbody id="standings-body">${renderStandingsRows()}</tbody>
      </table>
    </div>`;
  }

  function switchStandingsTab(tab) {
    standingsTab = tab;
    document.querySelectorAll('.standings-pill').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    const el = document.getElementById('standings-body');
    if (el) el.innerHTML = renderStandingsRows();
  }

  // ── Bracket ──────────────────────────────────────────────────────────
  function renderBracketSection(data) {
    const allSeries = data?.series || [];
    if (!allSeries.length) return '';

    const rounds = {};
    for (const s of allSeries) {
      const r = s.playoffRound || s.roundNumber || 1;
      if (!rounds[r]) rounds[r] = [];
      rounds[r].push(s);
    }
    const roundLabels = {1:'1er tour',2:'Demi-finales',3:'Finales conf.',4:'Finale Stanley'};

    const roundsHtml = Object.keys(rounds).sort((a,b)=>+a-+b).map(r => {
      const seriesHtml = rounds[r].map(s => {
        const top    = s.topSeedTeam    || {};
        const bottom = s.bottomSeedTeam || {};
        const topW   = s.topSeedWins    || 0;
        const botW   = s.bottomSeedWins || 0;
        const done   = topW >= 4 || botW >= 4;
        const topWon = done && topW > botW;
        const botWon = done && botW > topW;

        const teamRow = (team, wins, isWinner, isElim) => `
          <div class="bracket-team">
            <img class="bt-logo" src="${team.darkLogo||team.logo||''}" onerror="this.style.display='none'" />
            <span class="bt-abbrev${isWinner?' winner':isElim?' elim':''}">${team.abbrev||''}</span>
            <span class="bt-wins${isWinner?' winner':''}">${wins}</span>
          </div>`;

        return `<div class="bracket-series">
          ${teamRow(top,    topW, topWon, botWon)}
          ${teamRow(bottom, botW, botWon, topWon)}
        </div>`;
      }).join('');
      return `<div class="bracket-round"><div class="bracket-round-title">${roundLabels[r]||'Tour '+r}</div>${seriesHtml}</div>`;
    }).join('');

    return `<div class="nhl-section">
      <div class="nhl-section-head"><span class="nhl-section-title">Bracket Playoffs ${new Date().getFullYear()}</span></div>
      <div class="bracket-scroll">${roundsHtml}</div>
    </div>`;
  }

  // ── NHL tab complet ──────────────────────────────────────────────────
  function renderNHLTab() {
    const feed = document.getElementById('news-feed');
    if (!feed) return;
    let html = '';
    if (nhlData.scores.length) {
      const cards = nhlData.scores.map(g => buildScoreCard(g)).join('');
      html += `<div class="scores-wrap"><div class="scores-head">Matchs — Playoffs ${new Date().getFullYear()}</div><div class="scores-scroll">${cards}</div></div>`;
    }
    const hasLeaders = ['season','playoffs'].some(m => Object.values(nhlData.leaders[m]||{}).some(a=>a.length>0));
    if (hasLeaders) html += renderLeadersSection();
    if (nhlData.bracket?.series?.length) html += renderBracketSection(nhlData.bracket);
    if (nhlData.standings.length) html += renderStandingsSection();
    if (nhlData.news.length) {
      html += `<div class="scores-head" style="margin-bottom:10px;margin-top:16px">Nouvelles NHL</div>`;
      html += nhlData.news.map(item => renderNewsItem(item)).join('');
    }
    feed.innerHTML = html || '<div class="news-empty">Aucun contenu disponible.</div>';
  }

  async function loadNHLTab() {
    const feed = document.getElementById('news-feed');
    if (!feed) return;
    feed.innerHTML = '<div class="news-loading">Chargement des données NHL...</div>';
    const yr = new Date().getFullYear();
    const seasonId = NHL_SEASON;
    const p = p => '/api/nhl?path=' + encodeURIComponent(p);
    try {
      const [scoresRes,
        sGoals, sAssists, sPoints,
        pGoals, pAssists, pPoints,
        standingsRes, bracketRes, newsRes,
        cbcItems, sportsnetItems
      ] = await Promise.all([
        fetch(p('score/now')).then(r=>r.json()).catch(()=>({})),
        fetch(p(`skater-stats-leaders/${seasonId}/2?categories=goals&limit=5`)).then(r=>r.json()).catch(()=>({})),
        fetch(p(`skater-stats-leaders/${seasonId}/2?categories=assists&limit=5`)).then(r=>r.json()).catch(()=>({})),
        fetch(p(`skater-stats-leaders/${seasonId}/2?categories=points&limit=5`)).then(r=>r.json()).catch(()=>({})),
        fetch(p(`skater-stats-leaders/${seasonId}/3?categories=goals&limit=5`)).then(r=>r.json()).catch(()=>({})),
        fetch(p(`skater-stats-leaders/${seasonId}/3?categories=assists&limit=5`)).then(r=>r.json()).catch(()=>({})),
        fetch(p(`skater-stats-leaders/${seasonId}/3?categories=points&limit=5`)).then(r=>r.json()).catch(()=>({})),
        fetch(p('standings/now')).then(r=>r.json()).catch(()=>({})),
        fetch(p(`playoff-bracket/${yr}`)).then(r=>r.json()).catch(()=>({})),
        fetch('/api/news?league=nhl&limit=8').then(r=>r.json()).catch(()=>({})),
        fetchFeed({ label: 'CBC Sports', cls: 'src-cbc',    url: 'https://www.cbc.ca/cmlink/rss-sports' }),
        fetchFeed({ label: 'Sportsnet',  cls: 'src-hockey', url: 'https://www.sportsnet.ca/feed/' }),
      ]);
      nhlData.scores = scoresRes.games || [];
      nhlData.leaders = {
        season:  { goals: sGoals.goals||[], assists: sAssists.assists||[], points: sPoints.points||[] },
        playoffs:{ goals: pGoals.goals||[], assists: pAssists.assists||[], points: pPoints.points||[] },
      };
      nhlData.standings = standingsRes.standings || [];
      nhlData.bracket   = bracketRes;
      // Merge NewsAPI + RSS news, sort by date, cap at 25
      const apiNews = (newsRes.items || []).map(item => ({ ...item, source: { label: item.sourceName || 'NHL', cls: 'src-hockey' } }));
      nhlData.news = [...apiNews, ...cbcItems, ...sportsnetItems]
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 25);
      renderNHLTab();
    } catch(e) {
      feed.innerHTML = '<div class="news-error">Erreur de chargement.</div>';
    }
  }

  // ── Dispatch principal ───────────────────────────────────────────────
  let _loadSeq = 0; // sequence counter — chaque appel reçoit un ID unique

  async function loadNews(force = false) {
    const seq = ++_loadSeq;                          // ID de CETTE requête
    const reqSport  = newsSport;
    const reqLeague = newsLeague;
    const cacheKey  = `${reqSport}-${reqLeague}`;

    if (newsCache[cacheKey] && !force) { newsItems = newsCache[cacheKey]; renderNews(); return; }

    const feed = document.getElementById('news-feed');
    if (!feed) return;
    feed.innerHTML = '<div class="news-loading">Chargement des nouvelles...</div>';

    // Helper : ne rend que si c'est toujours la requête courante
    const commit = (items) => {
      if (seq !== _loadSeq) return; // une requête plus récente a pris le relais
      newsCache[cacheKey] = items;
      newsItems = items;
      renderNews();
    };

    // ── Hockey / NHL complet (scores + leaders + bracket + standings + news)
    if (reqSport === 'hockey' && reqLeague === 'nhl') {
      await loadNHLTab();
      return;
    }

    // ── Hockey via NewsAPI (AHL, OHL, WHL, LHJMQ, NCAA)
    if (reqSport === 'hockey' && HOCKEY_API_LEAGUES.includes(reqLeague)) {
      try {
        const r = await fetch(`/api/news?league=${reqLeague}&limit=20`);
        const d = await r.json();
        const items = (d.items || []).map(item => ({ ...item, source: { label: item.sourceName, cls: 'src-hockey' } }));
        commit(items);
      } catch(e) { if (seq === _loadSeq) feed.innerHTML = '<div class="news-error">Erreur de chargement.</div>'; }
      return;
    }

    // ── RSS feeds (toutes ligues sauf hockey minor leagues via NewsAPI)
    let sources;
    if (reqLeague === 'hobby') {
      sources = reqSport === 'hockey'
        ? (LEAGUE_FEEDS.hobby || [])
        : NEWS_SOURCES.filter(s => s.sport === reqSport);
    } else {
      sources = LEAGUE_FEEDS[reqLeague] || [];
    }

    const all = await Promise.all(sources.map(fetchFeed));
    commit(all.flat().sort((a, b) => b.date - a.date));
  }

  function switchLeague(league) {
    newsLeague = league;
    document.querySelectorAll('.league-tab').forEach(b => b.classList.toggle('active', b.dataset.league === league));
    loadNews();
  }

  function switchSport(sport) {
    newsSport = sport;
    // Sports with sub-league tabs default to 'hobby'
    newsLeague = (sport === 'hockey' || sport === 'football' || sport === 'basketball' || sport === 'baseball') ? 'hobby' : sport;
    document.querySelectorAll('.news-sport-btn').forEach(b => b.classList.toggle('active', b.dataset.sport === sport));

    const hl = document.getElementById('hockey-leagues');
    const fl = document.getElementById('football-leagues');
    const bl = document.getElementById('basketball-leagues');
    const bbl = document.getElementById('baseball-leagues');
    const os = document.getElementById('other-sport-bar');
    if (hl)  hl.style.display  = sport === 'hockey'     ? 'flex' : 'none';
    if (fl)  fl.style.display  = sport === 'football'   ? 'flex' : 'none';
    if (bl)  bl.style.display  = sport === 'basketball' ? 'flex' : 'none';
    if (bbl) bbl.style.display = sport === 'baseball'   ? 'flex' : 'none';
    if (os)  os.style.display  = (sport !== 'hockey' && sport !== 'football' && sport !== 'basketball' && sport !== 'baseball') ? 'flex' : 'none';

    // Reset active state on league tabs of the newly visible bar
    if (sport === 'hockey')     document.querySelectorAll('#hockey-leagues .league-tab').forEach(b => b.classList.toggle('active', b.dataset.league === 'hobby'));
    if (sport === 'football')   document.querySelectorAll('#football-leagues .league-tab').forEach(b => b.classList.toggle('active', b.dataset.league === 'hobby'));
    if (sport === 'basketball') document.querySelectorAll('#basketball-leagues .league-tab').forEach(b => b.classList.toggle('active', b.dataset.league === 'hobby'));
    if (sport === 'baseball')   document.querySelectorAll('#baseball-leagues .league-tab').forEach(b => b.classList.toggle('active', b.dataset.league === 'hobby'));
    loadNews();
  }

  // ── Init ─────────────────────────────────────────────────────────────
  function init() {
    if (!document.getElementById('news-feed')) return;
    loadNews();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  // Expose API for inline onclick handlers
  window.HE_NEWS = {
    loadNews,
    switchSport, switchLeague,
    switchLeadersTab, switchLeadersMode,
    switchStandingsTab,
  };
})();

# HobbyEmpire — Briefing Claude Code

## C'est quoi ce projet
Plateforme web pour les breakers de cartes sportives (hockey, football, basketball, baseball).
URL production : **https://www.hobbyempire.org** (alias : hobby-empire.vercel.app)
Hébergé sur **Vercel** (compte : glelievre71@gmail.com, projet : `glelievre71-9172s-projects/hobby-empire`)

---

## Stack technique
- **Front-end** : HTML/CSS/JS vanilla (pas de framework)
- **Back-end** : Fonctions serverless Vercel dans `api/` (Node.js ESM)
- **Déploiement** : Push sur `main` → Vercel auto-déploie
- **Repo GitHub** : `germthehare/HobbyEmpire`

---

## Structure des fichiers

```
/
├── public/                  ← Fichiers servis statiquement
│   ├── break-prep.html      ← PAGE PRINCIPALE (Break Prep + Actualités + Live)
│   ├── break-builder.html   ← Break Tracker
│   ├── hub.html             ← Hub
│   ├── index.html           ← Page d'accueil (+ teaser "Sorties à venir")
│   ├── releases.html        ← Calendrier complet des sorties (API: api.hobbyempire.org)
│   ├── products.json        ← Liste des clés de produits (auto-généré)
│   └── auth-guard.js        ← Guard d'authentification
│
├── api/                     ← Serverless functions (JAMAIS dans pages/api/)
│   ├── claude.js            ← Proxy Claude AI + injection checklists
│   ├── nhl.js               ← Proxy API NHL (api-web.nhle.com/v1/)
│   ├── ebay.js              ← eBay Browse API (OAuth client credentials)
│   ├── news.js              ← NewsAPI.org proxy
│   ├── sheets.js            ← Google Sheets
│   └── auth.js              ← Authentification
│
├── data/
│   └── checklists.json      ← Base de données des checklists (31+ produits)
│
├── vercel.json              ← Config Vercel (outputDirectory, maxDuration, includeFiles)
└── CLAUDE.md                ← Ce fichier
```

---

## APIs connectées

| API | Fichier | Env var | Notes |
|-----|---------|---------|-------|
| Anthropic Claude | `api/claude.js` | `ANTHROPIC_API_KEY` | Injecte les checklists depuis `data/checklists.json` |
| NHL API | `api/nhl.js` | aucune | Proxy vers `api-web.nhle.com/v1/{path}` |
| eBay Browse API | `api/ebay.js` | `EBAY_CLIENT_ID`, `EBAY_CLIENT_SECRET` | OAuth auto-géré, category 212 |
| NewsAPI.org | `api/news.js` | `NEWS_API_KEY` | 100 req/jour, cache 10min |
| Google Sheets | `api/sheets.js` | `GOOGLE_CREDENTIALS` | |
| **Hobby Empire Releases API** | externe (`https://api.hobbyempire.org`) | aucune | Worker Cloudflare séparé (`~/hobbyempire-releases`) qui scrape Waxstat/Miraj/Beckett toutes les 6h et expose `/api/releases`, `/api/releases/upcoming`, `/api/releases/:id`, `/api/stats`. Utilisé par `public/releases.html` + teaser sur la home. CORS ouvert pour `hobbyempire.org`. |

---

## Endpoints NHL utiles (via `/api/nhl?path=...`)

```
score/now                                          → Scores en temps réel
playoff-bracket/2026                               → Bracket playoffs (année courante)
standings/now                                      → Classement toutes équipes
skater-stats-leaders/20252026/2?categories=goals&limit=5   → Leaders saison (gameType=2)
skater-stats-leaders/20252026/3?categories=goals&limit=5   → Leaders playoffs (gameType=3)
player/{playerId}/landing                          → Stats d'un joueur
player-search?q={nom}&activeOnly=true              → Recherche de joueur
```

⚠️ Pour les paths avec `?`, encoder le path : `encodeURIComponent('standings/now?...')`

---

## Page principale : break-prep.html

### 3 onglets principaux
1. **Avant le live** — Sélecteur cascade Sport→Année→Produit + génération fiches Claude
2. **Pendant le live** — Lookup carte (Claude + eBay sold prices)
3. **Actualités** — Feed de nouvelles par sport/ligue

### Onglet Actualités — sous-onglets Hockey
- **Hobby** → RSS (Beckett, Cardboard Connection, SC Investor)
- **NHL** → Scores playoffs + Leaders (Saison/Playoffs, Pts/Buts/Passes) + Bracket + Classement (7 tabs) + Nouvelles NewsAPI
- **AHL/OHL/WHL/LHJMQ/NCAA** → NewsAPI (`/api/news?league=ahl` etc.)
- **Football/Basketball/Baseball** → RSS Beckett + Cardboard Connection

### Variables JS importantes
```javascript
let nhlData = { leaders:{}, standings:[], bracket:null, scores:[], news:[] };
let leadersTab = 'points';      // 'points' | 'goals' | 'assists'
let leadersMode = 'season';     // 'season' | 'playoffs'
let standingsTab = 'ALL';       // 'ALL'|'E'|'W'|'A'|'M'|'C'|'P'
const NHL_SEASON = '20252026';  // ← Mettre à jour chaque saison
```

### Fonctions clés
- `loadNHLTab()` → charge tout en parallèle (7 fetch), appelle `renderNHLTab()`
- `renderNHLTab()` → Scores + Leaders + Bracket + Standings + News
- `buildScoreCard(g)` → HTML d'une carte score NHL
- `renderBracketSection(data)` → HTML du bracket (structure: `data.series[].topSeedTeam/bottomSeedTeam`)
- `findChecklist(name)` → 4 étapes : exact → normalisé → inclusion → fuzzy
- `loadNews(force)` → routing RSS vs NewsAPI selon sport/ligue

---

## Sélecteur de produits (cascade)

Les produits sont dans `data/checklists.json`. Format de clé : `"2024-25 The Cup Hockey"`.
- `public/products.json` est auto-généré depuis les clés de `checklists.json`
- Le hook pre-commit `.git/hooks/pre-commit` régénère `products.json` quand `checklists.json` change
- `parseKey()` extrait sport/année/nom avec whitelist `KNOWN_SPORTS`

---

## Règles importantes

### ⛔ Ne JAMAIS faire
- Mettre du code API dans `pages/api/` — Vercel déploie UNIQUEMENT `api/`
- Utiliser `import assert { type: 'json' }` — ça crash sur Vercel
- Committer des clés API dans le code

### ✅ Toujours faire
- Lire les JSON avec `fs.readFileSync(join(process.cwd(), 'data/...'), 'utf-8')`
- Ajouter `"includeFiles": "data/**"` dans `vercel.json` pour bundler les JSON
- Encoder les paths avec query strings : `encodeURIComponent('path?param=val')`
- Après modification de `data/checklists.json`, régénérer `public/products.json`

---

## Workflow de déploiement

```bash
# Modifier les fichiers
git add <fichiers>
git commit -m "feat: description"
git push origin main
# → Vercel détecte le push et déploie automatiquement (~30 secondes)
```

Si le déploiement ne se déclenche pas (bug Vercel) :
```bash
git commit --allow-empty -m "chore: trigger deploy" && git push origin main
```

---

## Style CSS

Variables CSS principales :
```css
--gold: #B8942A  --gold2: #D4AD47  --gold3: #F0CC6A
--dark: #080808  --dark2: #111111  --dark3: #1A1A1A  --dark4: #242424
--text: #EAE6DF  --text2: #A89F94  --text3: #5C5650
--green: #3A8C5C  --red: #C94040
```

Polices : `Playfair Display` (titres), `Barlow Condensed` (labels/chiffres), `Barlow` (corps)

---

## Ajouter un produit à la base de données

1. Ouvrir `data/checklists.json`
2. Ajouter une clé au format `"YYYY-YY NomProduit Sport"` (ex: `"2024-25 Trilogy Hockey"`)
3. Valeur : objet avec `rookies[]`, `veterans[]`, `legends[]`, `setInfo{}`
4. Committer → le hook régénère `public/products.json` automatiquement

---

## Saison courante
- Saison NHL : **2025-26** (seasonId: `20252026`)
- Playoffs : **2026**
- Mettre à jour `NHL_SEASON` dans `break-prep.html` en début de nouvelle saison

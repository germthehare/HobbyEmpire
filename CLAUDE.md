# HobbyEmpire / Speloosh — Briefing Claude Code

## C'est quoi
Plateforme web SaaS pour les **breakers de cartes sportives** (live streams pack openings).
Outils : tracking des breaks (revenu/coûts/marge), prep IA avant le live, lookup live, calendrier sorties, planificateur, hub analytics, salle des machines (comm team).

- **URL production** : https://www.hobbyempire.org (Vercel auto-deploy sur push main)
- **Compte Vercel** : glelievre71@gmail.com — projet `glelievre71-9172s-projects/hobby-empire`
- **Repo** : `germthehare/HobbyEmpire`

---

## Stack
- HTML/CSS/JS vanilla (zéro framework côté front)
- Vercel serverless dans `api/` (Node.js ESM)
- Push sur `main` → auto-deploy ~30s

---

## ⭐ Design system v2 (en place sur 6 pages sur 8)

**Pages v2** : `index.html`, `break-builder.html`, `hub.html`, `break-prep.html`, `planner.html`, `releases.html`, `playlist.html`
**Pages legacy** (encore tokens dark/Playfair) : `settings.html`, `team.html`

### Tokens v2 — embedded INLINE dans chaque page (pas dans tokens.css partagé)
```css
--accent: oklch(72% 0.13 200);    /* aqua signature */
--bg: oklch(96.5% 0.012 75);      /* warm paper */
--bg-ink: oklch(16% 0.018 260);   /* cert strips dark */
--pos: oklch(54% 0.16 152);       /* vert bénéfice */
--ink: oklch(16% 0.018 260);
--ink-3: oklch(50% 0.012 260);
--line: oklch(86% 0.014 75);
```

### Typo
- **Grift** (5 weights woff2 dans `public/fonts/`) — display + body + "mono" (Grift uppercase + letter-spacing 0.16-0.18em)
- Pas de Google Fonts importée sur les pages v2

### App shell v2 (embedded sur chaque page)
- **Sidebar 232px** sticky — Home, Break Tracker, Hub, Break Prep, Planificateur, Sorties, Équipe, Settings. 1ère lettre de chaque item en aqua (`<span class="sb-first">`)
- **Cert strips dark** haut + bas (avec foil-gradient overlay 3px)
- **Cert top** : splash 56px `/images/speloosh-splash.png` + breadcrumb page + "Weather the Storm" à droite
- **Toolbar** sous cert top : eyebrow + holo line + sub-info + actions

### Mobile (toutes les pages v2)
- Sidebar devient drawer overlay sous 900px (hamburger ☰ dans cert top)
- `function toggleSidebar()` présente sur chaque page
- Cert splash 36px puis hidden <640px
- Titres en clamp()

---

## Pages v2 — détails clés

### index.html (home)
- Salle des machines (3 cards Pinned/Annonce/Win, localStorage `sdm_messages_v1`)
- Modules (3 cards SVG marks)
- Feed du jour : toggle Stats/Nouvelles, sport+league tabs, sous-tabs Stats (Matchs/Meneurs/Bracket/Classement)
- Timeline Sorties à venir (6 cols)
- Backup : `public/index-v1.html` (rollback)

### break-builder.html (Break Tracker)
- Sub-tabs Nouveau / Historique
- Tile fields style (label uppercase mono dedans, valeur 18px dessous)
- Live calc strip Bénéfice / Marge / $/Min
- localStorage `break_draft_v1`

### hub.html (Analytics)
- **2 sub-tabs toolbar** : `Stats` (default) / `Objectifs`
- Stats : 4 KPI + sparklines + chart Revenu par jour (Semaine/Mois) + plage horaire + vendeurs + types/cat/sport
- Objectifs :
  - Meter bars compagnie 14px (stripes pulsantes, mile markers 25/50/75%, glow)
  - Leaderboard avec pips + PlayerCards (rank, status pill, big %, bar 26px avec $ inline + target marker + overshoot ×N)
  - **Édition inline** (drawer slide-down) — sauvegarde dans même `he_settings` localStorage que Settings

### break-prep.html (Break Prep IA)
- Sub-tabs Avant / Pendant le live
- **⭐ Source des données** :
  - Mode Avant : `/api/checklist?key=X` (curated DB) + `/api/ebay` sold listings pour prix — **ZÉRO AI pour les facts**
  - Mode Pendant : Claude Opus 4.7 via `/api/claude` (carte arbitraire)
- Tile-selects cascade Sport → Année → Produit
- Cartes à surveiller : splash-official.png 52px par row
- Top Rookies : grid 2 cols, sort par hotPlayers desc
- Légendes : coeur.png 40px + tag pill + prix
- Mode Pendant : grade tiles RAW/PSA 9/PSA 10 (highlighted vert)

### planner.html
- Grid 7×6, today cercle aqua + halo glow
- Event chips colorés par sport (NHL aqua, AHL/NFL orange, NBA purple, Personal vert, Release ink)
- LIVE dot pulsant rouge si statut=en_direct
- Side panel d'édition
- 4 statuts : planifie/en_direct/termine/annule
- API `/api/schedule` GET/POST/PUT/DELETE

### releases.html
- KPI strip 4 cellules dans UN container (border-right)
- Filtres 4 rows pills (1ère lettre aqua)
- Month blocks avec titres "Juin 2026" (M en aqua)
- Grid 6 colonnes release cards

### playlist.html (NOUVELLE PAGE — 28 mai)
- **Section 1 : Playlists enregistrées**
  - Embed iframe Spotify/YouTube en haut
  - Grid de cards (nom + badge source Spotify/YouTube)
  - Click card = charge dans embed (état "En lecture")
  - + Ajouter une playlist (form nom + URL avec normalisation auto Spotify/YouTube)
  - localStorage `playlist_saved_v2` + `playlist_active_v2`
- **Section 2 : Soundboard live**
  - 6 catégories : Tous / Meme / Break Time / Opening / Closing / Effet sonore
  - Grid 4 cols boutons stingers
  - Raccourcis clavier 1-9
  - Audio cache (`new Audio()` instancié une fois, replay instant)
  - Stingers actuels :
    - 📣 Fah! (`meme`, `/sounds/fah.mp3`)
    - 🎵 Beat drop (`closing`, `/sounds/beat-drop.mp3`)
  - **Ajouter un stinger** : drop MP3 dans `public/sounds/`, ajouter entrée `{ico, name, key, file, category}` dans `STINGERS` array

---

## APIs (`api/`)

| Fichier | Env var | Notes |
|---------|---------|-------|
| `claude.js` | `ANTHROPIC_API_KEY` | Proxy + injection checklists. Modèle utilisé : `claude-opus-4-7` |
| `checklist.js` | — | **NOUVEAU** — sert `data/checklists.json[key]` directement |
| `nhl.js` | — | Proxy `api-web.nhle.com/v1/{path}` |
| `ebay.js` | `EBAY_CLIENT_ID`, `EBAY_CLIENT_SECRET` | Finding API `findCompletedItems` avec `SoldItemsOnly=true` |
| `news.js` | `NEWS_API_KEY` | NewsAPI.org, cache 10min |
| `breaks.js`, `schedule.js` | — | CRUD pour Tracker/Planner |
| `sheets.js`, `auth.js` | `GOOGLE_CREDENTIALS` | inchangés |

`vercel.json` : `api/claude.js` et `api/checklist.js` ont `includeFiles: "data/**"`.

---

## Données

### `data/checklists.json` (curé manuellement)
31+ produits. Schema :
```json
{
  "brand", "year", "sport", "hitsPerBox", "format", "summary",
  "topCards": [{name, tag}],
  "rookies":  [{name, team, position}],
  "legends":  [{name, cardType}],
  "hotPlayers": [...],
  "hypeFacts": [...]
}
```
- `public/products.json` auto-régénéré par hook pre-commit (liste des clés seulement)
- **Pas de prix** dans la DB — prix viennent de eBay sold listings

### LocalStorage
| Clé | Schema |
|-----|--------|
| `he_settings` | `{ vendeurs, helpers, salaires, objectifs:{revenu,benefice}, objectifsVendeurs:{[name]:{revenu,breaks,marge}}, membres, taxes }` |
| `sdm_messages_v1` | Salle des machines home v2 |
| `break_draft_v1` | Brouillon Tracker |
| `he_announcements` | Legacy (Post-it index v1) |

---

## API externe : Releases worker

Cloudflare Worker séparé (`~/hobbyempire-releases`) qui scrape Waxstat/Miraj/Beckett/TCDB toutes les 6h. Endpoints exposés sur `https://api.hobbyempire.org` avec CORS pour hobbyempire.org :
- `/api/releases` (filtres season/brand/format/from/sort/limit)
- `/api/releases/upcoming` (90j à venir, confirmés)
- `/api/releases/:id`
- `/api/stats` (total_releases, per_source.last_success_at)

---

## eBay Marketplace Insights API

Demandé à eBay mais en attente d'approbation. En attendant : `findCompletedItems` (Finding API) sert le besoin via `api/ebay.js`. Catégories visées :
- Sports : `212`, `261328`, `183050`, `2536`
- Pokémon : `183454`, `2611`, `38292`

---

## Règles à respecter

### ⛔ Ne JAMAIS
- Mettre du code API dans `pages/api/` — Vercel ne déploie que `api/`
- Utiliser `import assert { type: 'json' }` — crash sur Vercel
- Committer des clés API
- Force push sur main sans demander

### ✅ Toujours
- Lire JSON avec `fs.readFileSync(join(process.cwd(), 'data/...'))` côté serverless
- Ajouter `includeFiles: "data/**"` dans `vercel.json` pour bundler
- Encoder paths avec query strings : `encodeURIComponent('path?param=val')`
- Après modif `data/checklists.json`, hook pre-commit régénère `public/products.json`

---

## Workflow utilisateur

- **"push"** ou instruction mineure (tweak visuel, fix ponctuel) = commit+push direct sans reconfirmer
- **Action destructive** (force push, reset --hard, switch index.html) = TOUJOURS confirmer
- **Ne pas mentionner "Launch preview panel"** dans les réponses — l'user veut tout voir live, pas dans le preview

---

## Saison courante
- NHL : **2025-26** (seasonId `20252026`)
- Playoffs : **2026**
- `NHL_SEASON` const utilisée dans `index.html` (Feed Stats) + `hub.html`

---

## TODO connu
- **Settings.html v2** : refonte (drawer Membres unifié, ajouter Bénéfice par vendeur dans objectifsVendeurs)
- **Team.html v2** : passer en v2
- **Vues Semaine/Jour du Planner** : placeholder actuel (toast "à venir")
- **Wins du jour** (Salle des machines) : pas connecté aux vrais breaks
- **Tests E2E** : à mettre en place avant le prochain gros refactor

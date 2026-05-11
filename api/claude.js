import { readFileSync } from 'fs';
import { join } from 'path';

let checklists = {};
try {
  checklists = JSON.parse(readFileSync(join(process.cwd(), 'data/checklists.json'), 'utf-8'));
} catch (e) {
  console.error('checklists.json not loaded:', e.message);
}

export const config = { maxDuration: 60 };

const ALIASES = {
  'opc': 'o-pee-chee',
  'o-pee-chee': 'o-pee-chee',
  'ud': 'upper deck',
  'spx': 'spx',
  'sp auth': 'sp authentic',
  'spa': 'sp authentic',
  'metal': 'skybox metal universe',
  'skybox': 'skybox metal universe',
  'star rookies': 'nhl star rookies',
  // Series number aliases (written vs digit)
  'series one': 'series 1',
  'series two': 'series 2',
  'series three': 'series 3',
  'série one': 'series 1',
  'série two': 'series 2',
  'série 1': 'series 1',
  'série 2': 'series 2',
};

// Single year X → season ending in X (e.g. 2026 → 2025-2026)
// Short form X-YY → long form (e.g. 2025-26 → 2025-2026)
const YEAR_VARIANTS = (() => {
  const map = {};
  for (let y = 2011; y <= 2030; y++) {
    const prev = y - 1;
    const full = `${prev}-${y}`;
    const short = `${prev}-${String(y).slice(2)}`;
    map[String(y)] = full;   // "2026" → "2025-2026"
    map[short] = full;        // "2025-26" → "2025-2026"
  }
  return map;
})();

function normalize(text) {
  let t = text.toLowerCase().trim();
  // Pass 1: expand short forms like "2025-26" → "2025-2026"
  for (const [short, full] of Object.entries(YEAR_VARIANTS)) {
    if (short.includes('-')) {
      t = t.replace(new RegExp(`\\b${short}\\b`, 'g'), full);
    }
  }
  // Pass 2: expand standalone single years like "2026" → "2025-2026"
  for (const [short, full] of Object.entries(YEAR_VARIANTS)) {
    if (!short.includes('-')) {
      t = t.replace(new RegExp(`(?<!-)\\b${short}\\b(?!-)`, 'g'), full);
    }
  }
  // Expand aliases (opc → o-pee-chee)
  for (const [alias, full] of Object.entries(ALIASES)) {
    t = t.replace(new RegExp(`\\b${alias}\\b`, 'g'), full);
  }
  return t;
}

function findChecklist(productName) {
  const query = normalize(productName);
  for (const [key, value] of Object.entries(checklists)) {
    const keyNorm = normalize(key);
    // Exact inclusion match
    if (keyNorm.includes(query) || query.includes(keyNorm)) {
      return { key, data: value };
    }
    // Fuzzy match: 60% of query words must appear in the key
    const queryWords = query.split(/\s+/).filter(w => w.length > 2);
    const matches = queryWords.filter(w => keyNorm.includes(w));
    if (matches.length >= Math.ceil(queryWords.length * 0.6)) {
      return { key, data: value };
    }
  }
  return null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  try {
    const body = req.body;
    body.model = 'claude-sonnet-4-6';
    delete body.tools;
    delete body.tool_choice;
    body.max_tokens = 4000;

    // Inject real checklist data if available
    if (body.messages && body.messages.length > 0) {
      const userMsg = body.messages[body.messages.length - 1];
      const content = typeof userMsg.content === 'string' ? userMsg.content : '';
      const match = content.match(/prep sheet for[^"]*"([^"]+)"/);
      if (match) {
        const found = findChecklist(match[1]);
        if (found) {
          const d = found.data;
          const checklistInfo = `
REAL CHECKLIST DATA (use this — do not invent players):
Product: ${found.key}
Sport: ${d.sport}
Brand: ${d.brand}
Year: ${d.year}
Format: ${d.format}
Hits per box: ${d.hitsPerBox}
Summary: ${d.summary}
Rookies: ${JSON.stringify(d.rookies)}
Top Cards: ${JSON.stringify(d.topCards)}
Legends: ${JSON.stringify(d.legends)}
Hot Players: ${JSON.stringify(d.hotPlayers)}
Hype Facts: ${JSON.stringify(d.hypeFacts)}
`;
          userMsg.content = checklistInfo + '\n\n' + content;
        }
      }
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(body)
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

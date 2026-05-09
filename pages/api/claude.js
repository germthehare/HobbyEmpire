import checklists from '../../data/checklists.json' assert { type: 'json' };

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
};

// Single year X → season ending in X (e.g. 2026 → 2025-2026)
// Short form X-Y → long form (e.g. 2025-26 → 2025-2026)
const YEAR_VARIANTS = {
  '2026': '2025-2026',
  '2025': '2024-2025',
  '2024': '2023-2024',
  '2023': '2022-2023',
  '2022': '2021-2022',
  '2025-26': '2025-2026',
  '2024-25': '2024-2025',
  '2023-24': '2023-2024',
  '2022-23': '2022-2023',
};

function normalize(text) {
  let t = text.toLowerCase().trim();
  // Normalize years: single year or short form → full season format
  for (const [short, full] of Object.entries(YEAR_VARIANTS)) {
    t = t.replace(new RegExp(`\\b${short}\\b`), full);
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
      const match = content.match(/Generate a complete accurate prep sheet for: "([^"]+)"/);
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

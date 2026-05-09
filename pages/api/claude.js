import checklists from '../../data/checklists.json' assert { type: 'json' };

export const config = { maxDuration: 60 };

function findChecklist(productName) {
  const query = productName.toLowerCase();
  for (const [key, value] of Object.entries(checklists)) {
    if (key.toLowerCase().includes(query) || query.includes(key.toLowerCase())) {
      return { key, data: value };
    }
    // Fuzzy match: check if most words from the query appear in the key
    const queryWords = query.split(/\s+/).filter(w => w.length > 2);
    const keyLower = key.toLowerCase();
    const matches = queryWords.filter(w => keyLower.includes(w));
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

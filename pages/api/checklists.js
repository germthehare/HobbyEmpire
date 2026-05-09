import checklists from '../../data/checklists.json' assert { type: 'json' };

export default function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  return res.status(200).json({ products: Object.keys(checklists) });
}

export const config = { maxDuration: 10 };

const USERS = {
  admin: {
    password: process.env.AUTH_ADMIN_PASS || 'brisebise',
    role: 'admin'
  },
  staff: {
    password: process.env.AUTH_STAFF_PASS || 'hobbyempire123',
    role: 'staff'
  }
};

// Simple token: base64(role:username:secret)
const SECRET = process.env.AUTH_SECRET || 'he-secret-2026';

function makeToken(role, username) {
  const payload = `${role}:${username}:${SECRET}`;
  return Buffer.from(payload).toString('base64');
}

export function verifyToken(token) {
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf8');
    const parts = decoded.split(':');
    if (parts.length !== 3 || parts[2] !== SECRET) return null;
    return { role: parts[0], username: parts[1] };
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { username, password } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({ error: 'Username et mot de passe requis' });
  }

  const user = USERS[username.toLowerCase()];

  if (!user || !user.password || user.password !== password) {
    return res.status(401).json({ error: 'Identifiants incorrects' });
  }

  const token = makeToken(user.role, username.toLowerCase());

  return res.status(200).json({
    success: true,
    role: user.role,
    username: username.toLowerCase(),
    token
  });
}

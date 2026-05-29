// ════════════════════════════════════════════════════════════════════
// DB helper — connexion Vercel Postgres (Neon)
// ════════════════════════════════════════════════════════════════════
// Exporte le tagged template `sql` du SDK @vercel/postgres.
// Usage : import { sql } from '../lib/db.js';
//         const { rows } = await sql`SELECT * FROM users WHERE id = ${id}`;
//
// @vercel/postgres lit POSTGRES_URL automatiquement depuis process.env.
// ════════════════════════════════════════════════════════════════════

import { sql } from '@vercel/postgres';

export { sql };

// Helper : vérifie qu'une session token est valide et non expirée.
// Retourne { userId, role, name, email, permissions, vendeurKey } ou null.
export async function getUserBySessionToken(token) {
  if (!token) return null;
  try {
    const { rows } = await sql`
      SELECT u.id, u.email, u.name, u.role, u.permissions, u.vendeur_key, u.active
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.token = ${token}
        AND s.expires_at > NOW()
        AND u.active = true
      LIMIT 1
    `;
    if (!rows.length) return null;
    const r = rows[0];
    return {
      userId: r.id,
      email: r.email,
      name: r.name,
      role: r.role,
      permissions: r.permissions || {},
      vendeurKey: r.vendeur_key || null,
    };
  } catch (e) {
    console.error('[db] getUserBySessionToken error:', e);
    return null;
  }
}

// Extract token from request : check Authorization header puis cookie.
export function extractToken(req) {
  const auth = req.headers?.authorization || req.headers?.Authorization;
  if (auth && auth.startsWith('Bearer ')) return auth.slice(7);
  const cookie = req.headers?.cookie || '';
  const m = cookie.match(/(?:^|;\s*)he_token=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

// Wrapper d'auth pour handlers — refuse si non auth, ou si admin requis.
// Retourne le user ou termine la réponse avec 401/403.
export async function requireAuth(req, res, { adminOnly = false } = {}) {
  const token = extractToken(req);
  const user = await getUserBySessionToken(token);
  if (!user) {
    res.status(401).json({ error: 'Non authentifié' });
    return null;
  }
  if (adminOnly && user.role !== 'admin') {
    res.status(403).json({ error: 'Accès admin requis' });
    return null;
  }
  return user;
}

// ════════════════════════════════════════════════════════════════════
// Auth utils — hashing password + génération tokens cryptographiques
// ════════════════════════════════════════════════════════════════════

import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';

// Hash un password (bcrypt, coût 10)
export async function hashPassword(plain) {
  return bcrypt.hash(plain, 10);
}

// Vérifie un password vs un hash
export async function verifyPassword(plain, hash) {
  if (!plain || !hash) return false;
  return bcrypt.compare(plain, hash);
}

// Génère un token sécurisé (URL-safe base64, 32 bytes = 256 bits d'entropie)
export function generateToken() {
  return randomBytes(32).toString('base64url');
}

// Permissions par défaut pour un nouveau vendeur
export const DEFAULT_VENDEUR_PERMISSIONS = {
  tracker:  true,
  hub:      true,
  prep:     true,
  planner:  true,
  releases: true,
  playlist: true,
  team:     false,
  settings: false,
  inventory: false,
};

// Validation email basique
export function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

// Normalise une permission map : merge avec defaults pour vendeur
export function normalizeVendeurPermissions(input) {
  const out = { ...DEFAULT_VENDEUR_PERMISSIONS };
  if (input && typeof input === 'object') {
    for (const k of Object.keys(out)) {
      if (k in input) out[k] = Boolean(input[k]);
    }
  }
  // Settings désactivé → inventory forcé à false (inventory est sous settings)
  if (!out.settings) out.inventory = false;
  return out;
}

// Durée invitation : 7 jours
export const INVITATION_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;
// Durée session : 30 jours
export const SESSION_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000;

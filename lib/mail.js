// ════════════════════════════════════════════════════════════════════
// Mail helper — envoi via Resend
// ════════════════════════════════════════════════════════════════════
// Usage : import { sendInvitationEmail } from '../lib/mail.js';
// ENV vars requises : RESEND_API_KEY
// Domaine d'envoi : noreply@hobbyempire.org (à valider chez Resend)
// ════════════════════════════════════════════════════════════════════

import { Resend } from 'resend';

const FROM = 'Speloosh <noreply@hobbyempire.org>';
const APP_URL = process.env.APP_URL || 'https://www.hobbyempire.org';

function getResend() {
  if (!process.env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY non configuré');
  }
  return new Resend(process.env.RESEND_API_KEY);
}

export async function sendInvitationEmail({ to, name, token, invitedByName }) {
  const resend = getResend();
  const acceptUrl = `${APP_URL}/accept-invite.html?token=${encodeURIComponent(token)}`;

  return resend.emails.send({
    from: FROM,
    to,
    subject: `${invitedByName || 'Speloosh'} t'invite à rejoindre Hobby Empire`,
    html: invitationHtml({ name, acceptUrl, invitedByName }),
  });
}

function invitationHtml({ name, acceptUrl, invitedByName }) {
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#0f1216;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;color:#f4f1e8">
  <div style="max-width:560px;margin:0 auto;padding:40px 24px">
    <div style="text-align:center;margin-bottom:32px">
      <div style="display:inline-flex;align-items:center;gap:10px">
        <span style="width:10px;height:10px;background:#5dd0e0;border-radius:2px;display:inline-block"></span>
        <span style="font-size:24px;font-weight:900;letter-spacing:-0.01em">Speloosh</span>
      </div>
      <div style="font-size:10px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#5dd0e0;margin-top:6px">Hobby Empire</div>
    </div>

    <div style="background:#181d22;border:1px solid #2a3138;border-radius:14px;padding:32px 28px">
      <h1 style="font-size:22px;font-weight:800;margin:0 0 14px;line-height:1.25">Salut ${escapeHtml(name)} 👋</h1>
      <p style="font-size:14px;line-height:1.6;color:#cbd0d6;margin:0 0 14px">
        ${invitedByName ? `<strong>${escapeHtml(invitedByName)}</strong> t'invite` : "Tu es invité"} à rejoindre la plateforme <strong>Hobby Empire</strong> en tant que vendeur.
      </p>
      <p style="font-size:14px;line-height:1.6;color:#cbd0d6;margin:0 0 24px">
        Clique le bouton ci-dessous pour activer ton compte et choisir ton mot de passe.
      </p>

      <div style="text-align:center;margin:28px 0">
        <a href="${acceptUrl}" style="display:inline-block;padding:14px 32px;background:#5dd0e0;color:#0f1216;font-weight:800;font-size:13px;letter-spacing:0.12em;text-transform:uppercase;border-radius:8px;text-decoration:none">
          Activer mon compte →
        </a>
      </div>

      <p style="font-size:11px;line-height:1.6;color:#7a8088;margin:24px 0 0;text-align:center">
        Ce lien est valide 7 jours et ne peut être utilisé qu'une fois.<br>
        Si le bouton ne fonctionne pas, copie ce lien :<br>
        <span style="color:#5dd0e0;word-break:break-all">${acceptUrl}</span>
      </p>
    </div>

    <p style="text-align:center;font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:#5a606a;margin-top:24px">
      Speloosh · Hobby Empire · 2026
    </p>
  </div>
</body></html>`;
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

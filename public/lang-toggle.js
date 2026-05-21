// lang-toggle.js — Sélecteur de langue partagé (FR / EN)
// Ajoute automatiquement le toggle dans .header-nav ou .nav-links
// Lit/écrit localStorage('he_lang') et expose window.HE_LANG
// Dispatch l'évènement CustomEvent 'he-lang-change' sur document

(function () {
  const KEY = 'he_lang';
  const saved = localStorage.getItem(KEY) || 'fr';
  window.HE_LANG = saved;

  // ── CSS (fonctionne avec he-court et he-dark via les tokens) ──────────────
  const style = document.createElement('style');
  style.textContent = `
    .he-lang-toggle {
      display: flex;
      background: var(--bg-2, #eee);
      border: 1px solid var(--line, #ccc);
      border-radius: 6px;
      overflow: hidden;
      margin-left: 8px;
      flex-shrink: 0;
    }
    .he-lang-btn {
      padding: 5px 11px;
      font-size: 11px;
      font-weight: 700;
      font-family: var(--font-mono, monospace);
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--ink-3, #666);
      cursor: pointer;
      border: none;
      background: transparent;
      transition: background 0.15s, color 0.15s;
      line-height: 1;
    }
    .he-lang-btn:hover { color: var(--ink, #111); }
    .he-lang-btn.active {
      background: var(--accent, #e05);
      color: var(--accent-ink, #fff);
    }
  `;
  document.head.appendChild(style);

  // ── Injection dans la nav ─────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', function () {
    const nav =
      document.querySelector('.header-nav') ||
      document.querySelector('.nav-links');
    if (!nav) return;

    // Évite le doublon (break-prep a son propre toggle migré)
    if (nav.querySelector('.he-lang-toggle')) return;

    const wrap = document.createElement('div');
    wrap.className = 'he-lang-toggle';
    wrap.setAttribute('role', 'group');
    wrap.setAttribute('aria-label', 'Langue / Language');
    wrap.innerHTML = `
      <button class="he-lang-btn${saved === 'fr' ? ' active' : ''}" data-lang="fr" aria-pressed="${saved === 'fr'}">FR</button>
      <button class="he-lang-btn${saved === 'en' ? ' active' : ''}" data-lang="en" aria-pressed="${saved === 'en'}">EN</button>
    `;

    wrap.addEventListener('click', function (e) {
      const btn = e.target.closest('[data-lang]');
      if (!btn) return;
      setHELang(btn.dataset.lang, wrap);
    });

    nav.appendChild(wrap);
  });

  // ── Fonction publique (utilisée par break-prep et autres) ─────────────────
  window.setHELang = function (lang, toggleEl) {
    localStorage.setItem(KEY, lang);
    window.HE_LANG = lang;

    // Met à jour tous les toggles de la page
    document.querySelectorAll('.he-lang-toggle').forEach(function (t) {
      t.querySelectorAll('.he-lang-btn').forEach(function (b) {
        const active = b.dataset.lang === lang;
        b.classList.toggle('active', active);
        b.setAttribute('aria-pressed', active);
      });
    });

    document.dispatchEvent(
      new CustomEvent('he-lang-change', { detail: { lang: lang } })
    );
  };
})();

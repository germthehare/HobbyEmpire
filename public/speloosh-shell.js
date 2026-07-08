/**
 * Speloosh — App Shell Injector
 * Injects the sidebar, cert strips, and print marks into any page.
 *
 * Usage:
 *   1. Add to <head>: <link rel="stylesheet" href="/speloosh-shell.css">
 *   2. Add to <head>: <script src="/speloosh-shell.js"></script>
 *   3. Add data attrs to <body>:
 *        data-sp-breadcrumb="■ SPELOOSH › OPÉRATIONS › <strong>HOME</strong>"
 *        data-sp-cert="SPLSH·26·05·H001"
 *        data-sp-meta="POP · GRADED · BUILD"
 *        data-sp-page="/break-builder.html"   ← optional, overrides URL match
 *
 * The script will:
 *   - Hide the existing <header class="nav"> or similar top nav
 *   - Inject the sidebar as the first child of <body>
 *   - Wrap remaining content in .sp-main
 *   - Inject cert strips (top + bottom) inside .sp-main
 *   - Inject decorative print marks
 */
(function () {
  'use strict';

  /* ── Nav definition ─────────────────────────────────────── */
  const NAV = [
    { label: 'Home',          href: '/',                  section: 'Break ops'  },
    { label: 'Break Tracker', href: '/break-builder.html',section: 'Break ops'  },
    { label: 'Hub',           href: '/hub.html',           section: 'Break ops'  },
    { label: 'Break Prep',    href: '/break-prep.html',    section: 'Break ops'  },
    { label: 'Planificateur', href: '/planner.html',       section: 'Break ops'  },
    { label: 'Sorties',       href: '/releases.html',      section: 'Inventaire' },
    { label: 'Équipe',        href: '/team.html',          section: 'Système'    },
    { label: 'Settings',      href: '/settings.html',      section: 'Système'    },
  ];
  const SECTIONS = ['Break ops', 'Inventaire', 'Système'];

  /* ── Helpers ────────────────────────────────────────────── */
  function isActive(href) {
    const page = document.body.dataset.spPage || window.location.pathname;
    if (href === '/') return page === '/' || page === '/index.html';
    return page === href || page.startsWith(href.replace('.html', ''));
  }

  function esc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /* ── Sidebar HTML ───────────────────────────────────────── */
  function buildNavSections() {
    return SECTIONS.map(sec => {
      const items = NAV.filter(n => n.section === sec);
      const navItems = items.map(n => {
        const active = isActive(n.href);
        return `<a class="sp-nav-item${active ? ' is-active' : ''}" href="${n.href}">${esc(n.label)}</a>`;
      }).join('');
      return `<div class="sp-nav-section">
  <div class="sp-nav-label">${esc(sec)}</div>
  ${navItems}
</div>`;
    }).join('');
  }

  function buildSidebar() {
    const user = localStorage.getItem('he_user') || 'Admin';
    const initials = user.slice(0, 2).toUpperCase();
    return `<aside class="sp-sidebar" id="sp-sidebar" aria-label="Navigation principale">
  <div class="sp-brand">
    <a href="/" class="sp-brand-link">
      <div class="sp-droplet" aria-hidden="true"></div>
      <div class="sp-wordmark-wrap">
        <div class="sp-wordmark">SPELOOSH</div>
        <div class="sp-tagline">/ THE BREAK PLATFORM</div>
      </div>
    </a>
  </div>
  <div class="sp-search-wrap">
    <input class="sp-search-input" type="search" placeholder="Rechercher…" aria-label="Rechercher" />
    <kbd class="sp-kbd">⌘K</kbd>
  </div>
  ${buildNavSections()}
  <div class="sp-spacer"></div>
  <div class="sp-user-card">
    <div class="sp-user-avatar" aria-hidden="true">${esc(initials)}</div>
    <div class="sp-user-info">
      <div class="sp-user-name">${esc(user)}</div>
      <div class="sp-user-status"><span class="sp-live-dot" aria-hidden="true"></span>En ligne</div>
    </div>
    <button class="sp-logout-btn" type="button" title="Déconnexion" aria-label="Déconnexion" onclick="if(window.logout)logout()">⏻</button>
  </div>
</aside>`;
  }

  /* ── Cert strips ────────────────────────────────────────── */
  function buildCertTop() {
    const raw  = document.body.dataset.spBreadcrumb || '■ SPELOOSH';
    const cert = document.body.dataset.spCert       || 'SPLSH·26·05·???';
    /* Auto-bold the last breadcrumb segment — data attr stays plain text */
    const parts = raw.split(' › ');
    const crumb = parts.length > 1
      ? parts.slice(0, -1).join(' › ') + ' › <strong>' + esc(parts[parts.length - 1]) + '</strong>'
      : esc(raw);
    return `<div class="sp-cert-strip sp-cert-top" aria-hidden="true">
  <span class="sp-cert-breadcrumb">${crumb}</span>
  <span class="sp-cert-id">CERT · ${esc(cert)}</span>
</div>`;
  }

  function buildCertBot() {
    const meta = document.body.dataset.spMeta || 'POP · GRADED · BUILD';
    const pills = meta.split(' · ').map(p => `<span class="sp-cert-pill">${esc(p)}</span>`).join('');
    return `<div class="sp-cert-strip sp-cert-bot" aria-hidden="true">
  <div class="sp-cert-meta">${pills}</div>
  <span class="sp-cert-id">SPELOOSH &copy; 2026</span>
</div>`;
  }

  /* ── Print marks ────────────────────────────────────────── */
  function buildPrintMarks() {
    return `<div class="sp-print-marks" aria-hidden="true">
  <div class="sp-print-mark tl"></div>
  <div class="sp-print-mark tr"></div>
  <div class="sp-print-mark bl"></div>
  <div class="sp-print-mark br"></div>
</div>`;
  }

  /* ── Injection ──────────────────────────────────────────── */
  function inject() {
    const body = document.body;
    body.classList.add('sp-shell');

    /* Remove legacy top nav (header.nav or first <header>) */
    const legacyNav = body.querySelector(
      'header.nav, header.header, .he-nav, .header:not(.sp-), div.header, div.nav'
    );
    if (legacyNav) legacyNav.remove();

    /* Insert sidebar at top of body */
    const sidebarEl = document.createElement('aside');
    sidebarEl.outerHTML; // force parse
    const tmp = document.createElement('div');
    tmp.innerHTML = buildSidebar().trim();
    body.insertBefore(tmp.firstChild, body.firstChild);

    /* Wrap all non-sidebar children into .sp-main */
    if (!body.querySelector('.sp-main')) {
      const mainDiv = document.createElement('div');
      mainDiv.className = 'sp-main';

      /* Snapshot current children (skip sidebar) */
      const toMove = Array.from(body.children).filter(
        c => !c.classList.contains('sp-sidebar') && c.id !== 'sp-sidebar'
      );
      toMove.forEach(c => mainDiv.appendChild(c));

      /* Inject cert strips */
      const topTmp = document.createElement('div');
      topTmp.innerHTML = buildCertTop().trim();
      mainDiv.insertBefore(topTmp.firstChild, mainDiv.firstChild);

      const botTmp = document.createElement('div');
      botTmp.innerHTML = buildCertBot().trim();
      mainDiv.appendChild(botTmp.firstChild);

      body.appendChild(mainDiv);
    }

    /* Print marks (fixed overlay) */
    const pmTmp = document.createElement('div');
    pmTmp.innerHTML = buildPrintMarks().trim();
    body.appendChild(pmTmp.firstChild);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject);
  } else {
    inject();
  }
})();

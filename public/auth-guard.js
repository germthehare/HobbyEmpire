// Auth guard — include on every protected page
// Usage: <script src="/auth-guard.js" data-role="admin"></script>
// data-role="admin" = admin only | data-role="any" = any logged-in user

(function() {
  const token = localStorage.getItem('he_token');
  const role = localStorage.getItem('he_role');
  const required = document.currentScript ? document.currentScript.getAttribute('data-role') : 'any';

  function redirectToLogin() {
    const redirect = encodeURIComponent(window.location.pathname);
    window.location.replace('/login.html?redirect=' + redirect);
  }

  if (!token || !role) {
    redirectToLogin();
    return;
  }

  if (required === 'admin' && role !== 'admin') {
    redirectToLogin();
    return;
  }

  // Expose session info globally
  window.HE_SESSION = { token, role, username: localStorage.getItem('he_user') };

  // Add logout button to header if present
  document.addEventListener('DOMContentLoaded', function() {
    const nav = document.querySelector('.header-nav');
    if (nav) {
      const user = localStorage.getItem('he_user') || '';
      const btn = document.createElement('div');
      btn.style.cssText = 'display:flex;align-items:center;gap:10px;margin-left:8px;padding-left:14px;border-left:1px solid #1e1e1e';
      btn.innerHTML = `
        <span style="font-family:'Barlow Condensed',sans-serif;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#5C5650">${user}</span>
        <button onclick="logout()" style="font-family:'Barlow Condensed',sans-serif;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#5C5650;background:transparent;border:1px solid #1e1e1e;border-radius:5px;padding:5px 10px;cursor:pointer">Déconnexion</button>
      `;
      nav.appendChild(btn);
    }
  });
})();

function logout() {
  localStorage.removeItem('he_token');
  localStorage.removeItem('he_role');
  localStorage.removeItem('he_user');
  window.location.href = '/login.html';
}

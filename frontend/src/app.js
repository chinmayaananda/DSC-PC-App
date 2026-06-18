/**
 * App Router & Global State
 * Initialises pages and handles navigation.
 */

(async function () {
  // Get backend URL from Electron
  const backendUrl = await window.api.getBackendUrl();

  // Apply saved theme
  const savedTheme = await window.api.getStore('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  document.getElementById('theme-icon-dark').style.display = savedTheme === 'dark' ? 'block' : 'none';
  document.getElementById('theme-icon-light').style.display = savedTheme === 'light' ? 'block' : 'none';

  // Theme toggle button
  document.getElementById('theme-toggle').addEventListener('click', async () => {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    document.getElementById('theme-icon-dark').style.display = next === 'dark' ? 'block' : 'none';
    document.getElementById('theme-icon-light').style.display = next === 'light' ? 'block' : 'none';
    await window.api.setTheme(next);
  });

  // Initialise all pages
  initSignPage(backendUrl);
  initRedactPage(backendUrl);
  initStampPage(backendUrl);
  initSettingsPage(backendUrl);

  // Navigation
  const navBtns = document.querySelectorAll('.nav-btn');
  const pages = document.querySelectorAll('.page');

  navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.page;
      if (!target) return;
      navBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      pages.forEach(p => p.classList.remove('active'));
      const targetPage = document.getElementById(`page-${target}`);
      if (targetPage) targetPage.classList.add('active');
    });
  });

  // Token status in titlebar (global polling)
  async function updateTitlebarToken() {
    try {
      const dllPath = await window.api.getStore('dllPath') || '';
      const url = `${backendUrl}/api/token${dllPath ? '?dll_path=' + encodeURIComponent(dllPath) : ''}`;
      const res = await fetch(url);
      const data = await res.json();
      const indicator = document.getElementById('token-indicator');
      const label = document.getElementById('token-label');
      if (data.found) {
        indicator.className = 'token-connected';
        const cn = (data.certs[0]?.subject || '').match(/CN=([^,]+)/);
        label.textContent = cn ? cn[1].trim() : 'Token Ready';
      } else {
        indicator.className = 'token-disconnected';
        label.textContent = 'No DSC Token';
      }
    } catch { /* backend not ready yet */ }
  }

  setInterval(updateTitlebarToken, 5000);
  updateTitlebarToken();
})();

// ─── Global toast helper ──────────────────────────────────────────

function showToast(message, type = 'info', duration = 4000) {
  const icons = {
    success: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>`,
    error: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
    info: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
  };
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `${icons[type] || icons.info}<span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 300ms';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

window.showToast = showToast;

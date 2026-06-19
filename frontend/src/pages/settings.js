/**
 * Settings Page
 */

function initSettingsPage(backendUrl) {
  const container = document.getElementById('page-settings');

  container.innerHTML = `
    <div class="page-header">
      <div class="page-header-icon" style="background:var(--surface-2); color:var(--text-secondary)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="3"/>
          <path d="M19.07 4.93a10 10 0 010 14.14M4.93 4.93a10 10 0 000 14.14"/>
        </svg>
      </div>
      <div>
        <h1>Settings</h1>
        <p>Configure your PDF Toolbox preferences</p>
      </div>
    </div>

    <div style="flex:1; min-height:0; overflow-y:auto; padding:24px; display:flex; flex-direction:column; gap:24px;">

      <!-- DSC Token -->
      <div style="background:var(--surface); border:1px solid var(--border-subtle); border-radius:var(--radius-lg); overflow:hidden; flex-shrink:0;">
        <div style="padding:16px 20px; border-bottom:1px solid var(--border-subtle);">
          <h2 style="font-size:14px; font-weight:600;">DSC Token</h2>
          <p style="font-size:12px; color:var(--text-secondary); margin-top:2px;">PKCS#11 middleware settings for your Hypersecu HYP2003</p>
        </div>
        <div style="padding:20px;">
          <div class="form-group">
            <label for="dll-path">PKCS#11 DLL Path</label>
            <div style="display:flex; gap:8px;">
              <input type="text" id="dll-path" placeholder="Auto-detect (leave blank)" style="flex:1" />
              <button class="btn-secondary" id="dll-browse-btn">Browse</button>
            </div>
            <div style="font-size:11px; color:var(--text-muted); margin-top:5px;">
              Typically: <code style="background:var(--surface-2); padding:1px 4px; border-radius:3px;">C:\\Windows\\System32\\eTPKCS11.dll</code>
            </div>
          </div>
          <button class="btn-secondary" id="test-token-btn" style="margin-top: 10px;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
            </svg>
            Test Token Connection
          </button>
          <div id="test-token-result" style="margin-top:10px; font-size:12px; display:none;"></div>
        </div>
      </div>

      <!-- Signature Defaults -->
      <div style="background:var(--surface); border:1px solid var(--border-subtle); border-radius:var(--radius-lg); overflow:hidden; flex-shrink:0;">
        <div style="padding:16px 20px; border-bottom:1px solid var(--border-subtle);">
          <h2 style="font-size:14px; font-weight:600;">Signature Defaults</h2>
          <p style="font-size:12px; color:var(--text-secondary); margin-top:2px;">Pre-filled values for the Sign tab</p>
        </div>
        <div style="padding:20px; display:flex; flex-direction:column; gap:14px;">
          <div class="form-group" style="margin:0">
            <label for="s-name">Default Signer Name</label>
            <input type="text" id="s-name" placeholder="Your full name" />
          </div>
          <div class="form-group" style="margin:0">
            <label for="s-reason">Default Reason</label>
            <input type="text" id="s-reason" placeholder="Digitally Signed" />
          </div>
          <div class="form-group" style="margin:0">
            <label for="s-location">Default Location</label>
            <input type="text" id="s-location" placeholder="e.g. New Delhi, India" />
          </div>
          <div class="form-group" style="margin:0">
            <label for="s-image">Signature Stamp Image (Optional)</label>
            <div style="display:flex; gap:8px;">
              <input type="text" id="s-image" placeholder="Path to .png or .jpg" style="flex:1" />
              <button class="btn-secondary" id="sig-image-browse-btn">Browse</button>
            </div>
            <div style="font-size:11px; color:var(--text-muted); margin-top:5px;">
              This image will replace the default signature background.
            </div>
          </div>
          <button class="btn-primary" id="save-sig-defaults-btn" style="align-self:flex-start; margin-top: 10px;">Save Defaults</button>
        </div>
      </div>

      <!-- Appearance -->
      <div style="background:var(--surface); border:1px solid var(--border-subtle); border-radius:var(--radius-lg); overflow:hidden; flex-shrink:0;">
        <div style="padding:16px 20px; border-bottom:1px solid var(--border-subtle);">
          <h2 style="font-size:14px; font-weight:600;">Appearance</h2>
        </div>
        <div style="padding:20px;">
          <div class="settings-list">
            <div class="settings-row">
              <div>
                <div class="settings-row-label">Theme</div>
                <div class="settings-row-desc">Choose dark or light interface</div>
              </div>
              <div style="display:flex; gap:8px;">
                <button class="btn-secondary theme-opt" data-theme="dark" id="theme-dark-btn">Dark</button>
                <button class="btn-secondary theme-opt" data-theme="light" id="theme-light-btn">Light</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- About -->
      <div style="background:var(--surface); border:1px solid var(--border-subtle); border-radius:var(--radius-lg); overflow:hidden; flex-shrink:0;">
        <div style="padding:16px 20px; border-bottom:1px solid var(--border-subtle);">
          <h2 style="font-size:14px; font-weight:600;">About</h2>
        </div>
        <div style="padding:20px; font-size:13px; color:var(--text-secondary); line-height:2;">
          <div><strong style="color:var(--text-primary)">PDF Toolbox</strong> v1.0.11</div>
          <div>Offline PDF signing, redaction & stamping</div>
          <div>Built for Windows 11 with Hypersecu HYP2003 DSC</div>
          <div style="margin-top:10px;">
            <a href="https://github.com/chinmayaananda/DSC-PC-App" target="_blank"
               style="color:var(--accent); text-decoration:none; font-size:12px;">
              🔗 github.com/chinmayaananda/DSC-PC-App
            </a>
          </div>
        </div>
      </div>

    </div>
  `;

  // Load saved values
  window.api.getStore('dllPath').then(v => { if (v) document.getElementById('dll-path').value = v; });
  window.api.getStore('signerName').then(v => { if (v) document.getElementById('s-name').value = v; });
  window.api.getStore('signerReason').then(v => { if (v) document.getElementById('s-reason').value = v; });
  window.api.getStore('signerLocation').then(v => { if (v) document.getElementById('s-location').value = v; });
  window.api.getStore('sigImagePath').then(v => { if (v) document.getElementById('s-image').value = v; });

  // DLL browse
  document.getElementById('dll-browse-btn').addEventListener('click', async () => {
    const path = await window.api.openFile({
      title: 'Select PKCS#11 DLL',
      filters: [{ name: 'DLL Files', extensions: ['dll'] }],
    });
    if (path) {
      document.getElementById('dll-path').value = path;
      window.api.setStore('dllPath', path);
    }
  });

  document.getElementById('dll-path').addEventListener('change', () => {
    window.api.setStore('dllPath', document.getElementById('dll-path').value);
  });

  // Sig Image browse
  document.getElementById('sig-image-browse-btn').addEventListener('click', async () => {
    const path = await window.api.openFile({
      title: 'Select Signature Stamp Image',
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg'] }],
    });
    if (path) {
      document.getElementById('s-image').value = path;
    }
  });

  // Test token
  document.getElementById('test-token-btn').addEventListener('click', async () => {
    const result = document.getElementById('test-token-result');
    result.style.display = 'block';
    result.textContent = 'Testing...';
    result.style.color = 'var(--text-muted)';
    try {
      const dllPath = document.getElementById('dll-path').value;
      const url = `${backendUrl}/api/token${dllPath ? '?dll_path=' + encodeURIComponent(dllPath) : ''}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.found) {
        result.style.color = 'var(--success)';
        result.textContent = `✓ ${data.message} — Cert: ${data.certs[0]?.label || 'N/A'}`;
      } else {
        result.style.color = 'var(--danger)';
        result.textContent = `✗ ${data.message}`;
      }
    } catch (e) {
      result.style.color = 'var(--danger)';
      result.textContent = `✗ Could not connect to backend`;
    }
  });

  // Save signature defaults
  document.getElementById('save-sig-defaults-btn').addEventListener('click', () => {
    window.api.setStore('signerName', document.getElementById('s-name').value);
    window.api.setStore('signerReason', document.getElementById('s-reason').value);
    window.api.setStore('signerLocation', document.getElementById('s-location').value);
    window.api.setStore('sigImagePath', document.getElementById('s-image').value);
    showToast('Defaults saved', 'success');
  });

  // Theme buttons
  document.querySelectorAll('.theme-opt').forEach(btn => {
    btn.addEventListener('click', () => {
      const theme = btn.dataset.theme;
      window.api.setTheme(theme);
      document.documentElement.setAttribute('data-theme', theme);
      // Update theme toggle icon
      document.getElementById('theme-icon-dark').style.display = theme === 'dark' ? 'block' : 'none';
      document.getElementById('theme-icon-light').style.display = theme === 'light' ? 'block' : 'none';
    });
  });
}

window.initSettingsPage = initSettingsPage;

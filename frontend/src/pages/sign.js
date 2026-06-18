/**
 * Sign Page
 * Drag a rectangle on the PDF to define a signature field, then sign with DSC.
 */

function initSignPage(backendUrl) {
  const container = document.getElementById('page-sign');

  container.innerHTML = `
    <div class="page-header">
      <div class="page-header-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 22h6a2 2 0 002-2V7l-5-5H6a2 2 0 00-2 2v3"/>
          <path d="M14 2v4a2 2 0 002 2h4"/>
          <path d="M3 15l6.5 6.5L17 14"/>
        </svg>
      </div>
      <div>
        <h1>Sign PDF</h1>
        <p>Draw a rectangle to place your signature field, then sign with your DSC token</p>
      </div>
    </div>

    <div class="toolbar">
      <button class="btn-secondary" id="sign-open-btn">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
        </svg>
        Open PDF
      </button>
      <div class="toolbar-sep"></div>
      <button class="btn-ghost btn-icon" id="sign-clear-btn" title="Clear signature field" disabled>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
          <path d="M10 11v6"/><path d="M14 11v6"/>
        </svg>
      </button>
      <div style="flex:1"></div>
      <div id="sign-token-badge" class="chip chip-danger">Token not detected</div>
      <button class="btn-primary" id="sign-btn" disabled>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 22h6a2 2 0 002-2V7l-5-5H6a2 2 0 00-2 2v3"/>
          <path d="M3 15l6.5 6.5L17 14"/>
        </svg>
        Sign Document
      </button>
    </div>

    <div class="viewer-layout">
      <div class="pdf-panel" id="sign-pdf-panel">
        <div class="drop-zone" id="sign-drop-zone">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="12" y1="11" x2="12" y2="17"/>
            <line x1="9" y1="14" x2="15" y2="14"/>
          </svg>
          <h2>Open a PDF to sign</h2>
          <p>Click "Open PDF" or drag & drop a file here</p>
          <button class="btn-primary" id="sign-drop-open">Open PDF</button>
        </div>
      </div>

      <div class="side-panel">
        <div class="side-panel-section">
          <h3>Signature Details</h3>
          <div class="form-group">
            <label for="sign-name">Signer Name</label>
            <input type="text" id="sign-name" placeholder="Your full name" />
          </div>
          <div class="form-group">
            <label for="sign-reason">Reason</label>
            <input type="text" id="sign-reason" placeholder="e.g. Approved" value="Digitally Signed" />
          </div>
          <div class="form-group">
            <label for="sign-location">Location</label>
            <input type="text" id="sign-location" placeholder="e.g. New Delhi, India" />
          </div>
        </div>

        <div class="side-panel-section">
          <h3>Signature Field</h3>
          <div id="sign-field-status" class="empty-state" style="padding:12px 0; align-items:flex-start; gap:6px;">
            <p style="color:var(--text-muted); font-size:12px;">
              Draw a rectangle on the PDF page to place your signature field.
            </p>
          </div>
          <div id="sign-field-preview" class="sig-field-preview hidden">
            <strong id="sign-preview-name"></strong>
            <span id="sign-preview-page"></span>
          </div>
        </div>

        <div class="side-panel-section">
          <h3>Token</h3>
          <div id="sign-cert-info" style="font-size:12px; color:var(--text-secondary); line-height:1.7;">
            <span style="color:var(--text-muted)">Plug in your HYP2003 token...</span>
          </div>
        </div>
      </div>
    </div>

    <div class="status-bar" id="sign-statusbar">
      <span id="sign-status-text">Ready — open a PDF to begin</span>
    </div>
  `;

  let viewer = null;
  let currentPdfPath = null;
  let signRect = null;
  let tokenInfo = null;
  let signingInProgress = false;

  const signBtn = document.getElementById('sign-btn');
  const clearBtn = document.getElementById('sign-clear-btn');
  const tokenBadge = document.getElementById('sign-token-badge');
  const certInfo = document.getElementById('sign-cert-info');
  const statusText = document.getElementById('sign-status-text');
  const fieldPreview = document.getElementById('sign-field-preview');
  const fieldStatus = document.getElementById('sign-field-status');
  const previewName = document.getElementById('sign-preview-name');
  const previewPage = document.getElementById('sign-preview-page');

  // Load saved settings
  window.api.getStore('signerName').then(v => { if (v) document.getElementById('sign-name').value = v; });
  window.api.getStore('signerLocation').then(v => { if (v) document.getElementById('sign-location').value = v; });
  window.api.getStore('signerReason').then(v => { if (v) document.getElementById('sign-reason').value = v; });

  // Auto-save settings
  ['sign-name', 'sign-reason', 'sign-location'].forEach(id => {
    document.getElementById(id).addEventListener('change', saveSettings);
  });

  function saveSettings() {
    window.api.setStore('signerName', document.getElementById('sign-name').value);
    window.api.setStore('signerReason', document.getElementById('sign-reason').value);
    window.api.setStore('signerLocation', document.getElementById('sign-location').value);
    updateSignBtn();
  }

  // Open PDF
  async function openPDF() {
    const path = await window.api.openFile({ title: 'Select PDF to Sign' });
    if (!path) return;
    await loadPDF(path);
  }

  async function loadPDF(path) {
    currentPdfPath = path;
    signRect = null;
    fieldPreview.classList.add('hidden');
    fieldStatus.classList.remove('hidden');

    const panel = document.getElementById('sign-pdf-panel');
    panel.innerHTML = '<div class="empty-state"><div class="spinner"></div><p>Loading PDF...</p></div>';

    viewer = new PDFViewer(panel, 'sign');
    await viewer.init(backendUrl);

    viewer.onRectAdded = (rect) => {
      signRect = rect;
      clearBtn.disabled = false;
      previewName.textContent = document.getElementById('sign-name').value || 'Signature';
      previewPage.textContent = `Page ${rect.page + 1}  •  ${Math.round(rect.x1 - rect.x0)} × ${Math.round(rect.y1 - rect.y0)} pt`;
      fieldPreview.classList.remove('hidden');
      fieldStatus.classList.add('hidden');
      updateSignBtn();
      setStatus('Signature field placed — click Sign to proceed', '');
    };

    viewer.onRectCleared = () => {
      signRect = null;
      clearBtn.disabled = true;
      fieldPreview.classList.add('hidden');
      fieldStatus.classList.remove('hidden');
      updateSignBtn();
    };

    try {
      await viewer.loadPDF(path);
      setStatus(`Opened: ${path.split('\\').pop()} — drag a rectangle to place signature field`, '');
      clearBtn.disabled = true;
    } catch (err) {
      panel.innerHTML = `<div class="empty-state"><p style="color:var(--danger)">${err.message}</p></div>`;
    }
  }

  function updateSignBtn() {
    const hasToken = tokenInfo && tokenInfo.found;
    const hasRect = !!signRect;
    const hasName = !!document.getElementById('sign-name').value.trim();
    signBtn.disabled = !hasToken || !hasRect || !hasName || signingInProgress;
  }

  // Token polling
  let tokenPollInterval = null;
  function startTokenPoll() {
    updateTokenStatus();
    tokenPollInterval = setInterval(updateTokenStatus, 3000);
  }

  async function updateTokenStatus() {
    try {
      const dllPath = await window.api.getStore('dllPath') || '';
      const url = `${backendUrl}/api/token${dllPath ? '?dll_path=' + encodeURIComponent(dllPath) : ''}`;
      const res = await fetch(url);
      tokenInfo = await res.json();

      if (tokenInfo.found) {
        tokenBadge.className = 'chip chip-success';
        tokenBadge.textContent = '✓ Token Ready';
        const cert = tokenInfo.certs[0] || {};
        certInfo.innerHTML = `
          <div><strong style="color:var(--text-primary)">Label:</strong> ${cert.label || 'N/A'}</div>
          <div style="word-break:break-all"><strong style="color:var(--text-primary)">Subject:</strong> ${cert.subject || 'N/A'}</div>
        `;
        // Auto-fill signer name from cert if empty
        if (!document.getElementById('sign-name').value && cert.subject) {
          const cn = cert.subject.match(/CN=([^,]+)/);
          if (cn) document.getElementById('sign-name').value = cn[1].trim();
        }
      } else {
        tokenBadge.className = 'chip chip-danger';
        tokenBadge.textContent = 'No Token';
        certInfo.innerHTML = `<span style="color:var(--text-muted)">${tokenInfo.message}</span>`;
      }
    } catch {
      tokenBadge.className = 'chip chip-danger';
      tokenBadge.textContent = 'Token Error';
    }
    updateSignBtn();
  }

  // Sign button
  signBtn.addEventListener('click', () => showPinModal());
  clearBtn.addEventListener('click', () => viewer && viewer.clearAllRects());

  function showPinModal() {
    const modal = document.getElementById('pin-modal');
    const pinInput = document.getElementById('pin-input');
    pinInput.value = '';
    modal.classList.remove('hidden');
    setTimeout(() => pinInput.focus(), 50);

    document.getElementById('pin-cancel').onclick = () => modal.classList.add('hidden');
    document.getElementById('pin-confirm').onclick = () => doSign(pinInput.value);
    pinInput.onkeydown = (e) => { if (e.key === 'Enter') doSign(pinInput.value); };
  }

  async function doSign(pin) {
    if (!pin) { showToast('Please enter your PIN', 'error'); return; }
    document.getElementById('pin-modal').classList.add('hidden');

    const outputPath = await window.api.saveFile({
      title: 'Save Signed PDF',
      defaultPath: currentPdfPath.replace(/\.pdf$/i, '_signed.pdf'),
    });
    if (!outputPath) return;

    signingInProgress = true;
    signBtn.disabled = true;
    setStatus('Signing... please wait', '');

    const cert = tokenInfo.certs[0] || {};
    try {
      const result = await fetch(`${backendUrl}/api/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input_path: currentPdfPath,
          output_path: outputPath,
          dll_path: tokenInfo.dll_path,
          pin: pin,
          page: signRect.page,
          rect: { x0: signRect.x0, y0: signRect.y0, x1: signRect.x1, y1: signRect.y1 },
          cert_label: cert.label || '',
          signer_name: document.getElementById('sign-name').value,
          reason: document.getElementById('sign-reason').value,
          location: document.getElementById('sign-location').value,
        }),
      });
      if (!result.ok) {
        const err = await result.json();
        throw new Error(err.detail || 'Signing failed');
      }
      showToast('PDF signed successfully!', 'success');
      setStatus(`Signed and saved to: ${outputPath.split('\\').pop()}`, 'success');
    } catch (err) {
      showToast(`Signing failed: ${err.message}`, 'error');
      setStatus(`Error: ${err.message}`, 'error');
    } finally {
      signingInProgress = false;
      updateSignBtn();
    }
  }

  function setStatus(msg, type) {
    statusText.textContent = msg;
    statusText.className = type ? `status-${type}` : '';
  }

  // Wire up open buttons
  document.getElementById('sign-open-btn').addEventListener('click', openPDF);
  document.getElementById('sign-drop-open').addEventListener('click', openPDF);

  // Start token polling
  startTokenPoll();

  // Cleanup
  return () => { if (tokenPollInterval) clearInterval(tokenPollInterval); };
}

window.initSignPage = initSignPage;

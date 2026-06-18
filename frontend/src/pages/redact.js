/**
 * Redact Page
 * Draw multiple red rectangles on any pages, then apply permanent redaction.
 */

function initRedactPage(backendUrl) {
  const container = document.getElementById('page-redact');

  container.innerHTML = `
    <div class="page-header">
      <div class="page-header-icon" style="background:var(--danger-dim); color:var(--danger)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <line x1="9" y1="9" x2="15" y2="15"/>
          <line x1="15" y1="9" x2="9" y2="15"/>
        </svg>
      </div>
      <div>
        <h1>Redact PDF</h1>
        <p>Draw black boxes over sensitive content — text and links are permanently removed</p>
      </div>
    </div>

    <div class="toolbar">
      <button class="btn-secondary" id="redact-open-btn">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
        </svg>
        Open PDF
      </button>
      <div class="toolbar-sep"></div>
      <button class="btn-ghost btn-icon" id="redact-undo-btn" title="Remove last redaction" disabled>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 00-4-4H4"/>
        </svg>
      </button>
      <button class="btn-ghost btn-icon" id="redact-clear-btn" title="Clear all redactions" disabled>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
        </svg>
      </button>
      <div style="flex:1"></div>
      <span id="redact-count-badge" class="chip chip-danger" style="display:none">0 regions</span>
      <button class="btn-danger" id="redact-apply-btn" disabled>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <line x1="9" y1="9" x2="15" y2="15"/>
          <line x1="15" y1="9" x2="9" y2="15"/>
        </svg>
        Apply Redactions
      </button>
    </div>

    <div class="viewer-layout">
      <div class="pdf-panel" id="redact-pdf-panel">
        <div class="drop-zone" id="redact-drop-zone">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <line x1="9" y1="9" x2="15" y2="15"/>
            <line x1="15" y1="9" x2="9" y2="15"/>
          </svg>
          <h2>Open a PDF to redact</h2>
          <p>Click "Open PDF" or drag & drop a file here</p>
          <button class="btn-primary" id="redact-drop-open">Open PDF</button>
        </div>
      </div>

      <div class="side-panel">
        <div class="side-panel-section">
          <h3>Instructions</h3>
          <div style="font-size:12px; color:var(--text-secondary); line-height:1.8;">
            <div>1. Open a PDF</div>
            <div>2. Drag red boxes over areas to redact</div>
            <div>3. Right-click any box to remove it</div>
            <div>4. Click <strong>Apply Redactions</strong></div>
          </div>
        </div>

        <div class="side-panel-section">
          <h3>Redaction Regions</h3>
          <div id="redact-list" style="display:flex; flex-direction:column; gap:6px;">
            <p style="font-size:12px; color:var(--text-muted)">No regions added yet.</p>
          </div>
        </div>

        <div class="side-panel-section" style="margin-top:auto">
          <div style="background:var(--danger-dim); border:1px solid var(--danger); border-radius:var(--radius); padding:10px 12px; font-size:11px; color:var(--danger);">
            ⚠️ Redaction is <strong>permanent</strong>. The underlying text and link data cannot be recovered after saving.
          </div>
        </div>
      </div>
    </div>

    <div class="status-bar">
      <span id="redact-status-text">Ready — open a PDF to begin</span>
    </div>
  `;

  let viewer = null;
  let currentPdfPath = null;

  const applyBtn = document.getElementById('redact-apply-btn');
  const clearBtn = document.getElementById('redact-clear-btn');
  const undoBtn = document.getElementById('redact-undo-btn');
  const countBadge = document.getElementById('redact-count-badge');
  const statusText = document.getElementById('redact-status-text');
  const redactList = document.getElementById('redact-list');

  function updateUI() {
    const count = viewer ? viewer.rects.length : 0;
    applyBtn.disabled = count === 0;
    clearBtn.disabled = count === 0;
    undoBtn.disabled = count === 0;
    countBadge.style.display = count > 0 ? 'inline-flex' : 'none';
    countBadge.textContent = `${count} region${count !== 1 ? 's' : ''}`;

    redactList.innerHTML = '';
    if (count === 0) {
      redactList.innerHTML = '<p style="font-size:12px; color:var(--text-muted)">No regions added yet.</p>';
      return;
    }
    viewer.rects.forEach((r, i) => {
      const item = document.createElement('div');
      item.style.cssText = 'display:flex; align-items:center; justify-content:space-between; font-size:12px; padding:4px 6px; background:var(--danger-dim); border-radius:4px;';
      item.innerHTML = `
        <span style="color:var(--danger)">Page ${r.page + 1} — ${Math.round(r.x1 - r.x0)} × ${Math.round(r.y1 - r.y0)} pt</span>
        <button class="btn-icon" style="padding:2px;" title="Remove">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      `;
      item.querySelector('button').onclick = () => {
        viewer.removeRect(r.el);
        updateUI();
      };
      redactList.appendChild(item);
    });
  }

  async function openPDF() {
    const path = await window.api.openFile({ title: 'Select PDF to Redact' });
    if (!path) return;
    await loadPDF(path);
  }

  async function loadPDF(path) {
    currentPdfPath = path;
    const panel = document.getElementById('redact-pdf-panel');
    panel.innerHTML = '<div class="empty-state"><div class="spinner"></div><p>Loading PDF...</p></div>';

    viewer = new PDFViewer(panel, 'redact');
    await viewer.init(backendUrl);

    viewer.onRectAdded = () => updateUI();
    viewer.onRectCleared = () => updateUI();

    try {
      await viewer.loadPDF(path);
      statusText.textContent = `Opened: ${path.split('\\').pop()} — drag to mark redaction areas`;
      updateUI();
    } catch (err) {
      panel.innerHTML = `<div class="empty-state"><p style="color:var(--danger)">${err.message}</p></div>`;
    }
  }

  undoBtn.addEventListener('click', () => {
    if (!viewer || viewer.rects.length === 0) return;
    const last = viewer.rects[viewer.rects.length - 1];
    viewer.removeRect(last.el);
    updateUI();
  });

  clearBtn.addEventListener('click', () => {
    viewer && viewer.clearAllRects();
    updateUI();
  });

  applyBtn.addEventListener('click', async () => {
    const outputPath = await window.api.saveFile({
      title: 'Save Redacted PDF',
      defaultPath: currentPdfPath.replace(/\.pdf$/i, '_redacted.pdf'),
    });
    if (!outputPath) return;

    applyBtn.disabled = true;
    statusText.textContent = 'Applying redactions...';

    const regions = viewer.rects.map(r => ({
      page: r.page, x0: r.x0, y0: r.y0, x1: r.x1, y1: r.y1,
    }));

    try {
      const res = await fetch(`${backendUrl}/api/redact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input_path: currentPdfPath, output_path: outputPath, regions }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail); }
      showToast(`${regions.length} region(s) redacted successfully!`, 'success');
      statusText.textContent = `Saved to: ${outputPath.split('\\').pop()}`;
      statusText.className = 'status-success';
    } catch (err) {
      showToast(`Redaction failed: ${err.message}`, 'error');
      statusText.textContent = `Error: ${err.message}`;
      statusText.className = 'status-error';
    } finally {
      applyBtn.disabled = viewer.rects.length === 0;
    }
  });

  document.getElementById('redact-open-btn').addEventListener('click', openPDF);
  document.getElementById('redact-drop-open').addEventListener('click', openPDF);
}

window.initRedactPage = initRedactPage;

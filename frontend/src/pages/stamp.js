/**
 * Stamp Page
 * Pick a PNG/JPG stamp image and click to place it on a PDF page.
 */

function initStampPage(backendUrl) {
  const container = document.getElementById('page-stamp');

  container.innerHTML = `
    <div class="page-header">
      <div class="page-header-icon" style="background:var(--success-dim); color:var(--success)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="8" r="5"/>
          <path d="M20 21a8 8 0 10-16 0"/>
        </svg>
      </div>
      <div>
        <h1>Add Stamp</h1>
        <p>Place a PNG or JPG stamp image on any page</p>
      </div>
    </div>

    <div class="toolbar">
      <button class="btn-secondary" id="stamp-open-btn">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
        </svg>
        Open PDF
      </button>
      <div class="toolbar-sep"></div>
      <button class="btn-secondary" id="stamp-pick-btn" disabled>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <circle cx="8.5" cy="8.5" r="1.5"/>
          <polyline points="21 15 16 10 5 21"/>
        </svg>
        Pick Stamp Image
      </button>
      <div id="stamp-image-chip" class="chip chip-success" style="display:none"></div>
      <div style="flex:1"></div>
      <div id="stamp-placement-badge" class="chip chip-info" style="display:none">Stamp placed</div>
      <button class="btn-primary" id="stamp-apply-btn" disabled style="background:var(--success); border-color:var(--success)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
        Apply Stamp
      </button>
    </div>

    <div class="viewer-layout">
      <div class="pdf-panel" id="stamp-pdf-panel">
        <div class="drop-zone" id="stamp-drop-zone">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="8" r="5"/>
            <path d="M20 21a8 8 0 10-16 0"/>
          </svg>
          <h2>Open a PDF to stamp</h2>
          <p>Click "Open PDF" or drag & drop a file here</p>
          <button class="btn-primary" id="stamp-drop-open">Open PDF</button>
        </div>
      </div>

      <div class="side-panel">
        <div class="side-panel-section">
          <h3>Instructions</h3>
          <div style="font-size:12px; color:var(--text-secondary); line-height:1.8;">
            <div>1. Open a PDF</div>
            <div>2. Pick a stamp image (PNG/JPG)</div>
            <div>3. Click on the page to place it</div>
            <div>4. Click <strong>Apply Stamp</strong></div>
          </div>
        </div>

        <div class="side-panel-section">
          <h3>Stamp Preview</h3>
          <div id="stamp-preview-area" style="border:2px dashed var(--border); border-radius:var(--radius); padding:12px; min-height:80px; display:flex; align-items:center; justify-content:center;">
            <span style="font-size:12px; color:var(--text-muted)">No stamp selected</span>
          </div>
        </div>

        <div class="side-panel-section">
          <h3>Opacity</h3>
          <div class="form-group" style="margin:0">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
              <label for="stamp-opacity" style="margin:0">Opacity</label>
              <span id="stamp-opacity-val" style="font-size:12px; color:var(--accent)">100%</span>
            </div>
            <input type="range" id="stamp-opacity" min="10" max="100" value="100" style="width:100%; accent-color:var(--success);" />
          </div>
        </div>

        <div class="side-panel-section">
          <h3>Placement</h3>
          <div id="stamp-placement-info" style="font-size:12px; color:var(--text-muted);">
            Click on the PDF to place your stamp.
          </div>
        </div>
      </div>
    </div>

    <div class="status-bar">
      <span id="stamp-status-text">Ready — open a PDF to begin</span>
    </div>
  `;

  let viewer = null;
  let currentPdfPath = null;
  let stampImagePath = null;
  let stampPlacement = null;

  const applyBtn = document.getElementById('stamp-apply-btn');
  const pickBtn = document.getElementById('stamp-pick-btn');
  const imageChip = document.getElementById('stamp-image-chip');
  const placementBadge = document.getElementById('stamp-placement-badge');
  const placementInfo = document.getElementById('stamp-placement-info');
  const previewArea = document.getElementById('stamp-preview-area');
  const statusText = document.getElementById('stamp-status-text');
  const opacitySlider = document.getElementById('stamp-opacity');
  const opacityVal = document.getElementById('stamp-opacity-val');

  opacitySlider.addEventListener('input', () => {
    opacityVal.textContent = opacitySlider.value + '%';
  });

  function updateApplyBtn() {
    applyBtn.disabled = !currentPdfPath || !stampImagePath || !stampPlacement;
  }

  async function openPDF() {
    const path = await window.api.openFile({ title: 'Select PDF to Stamp' });
    if (!path) return;
    await loadPDF(path);
  }

  async function loadPDF(path) {
    currentPdfPath = path;
    stampPlacement = null;
    placementBadge.style.display = 'none';
    placementInfo.textContent = 'Click on the PDF to place your stamp.';

    const panel = document.getElementById('stamp-pdf-panel');
    panel.innerHTML = '<div class="empty-state"><div class="spinner"></div><p>Loading PDF...</p></div>';

    viewer = new PDFViewer(panel, 'stamp');
    await viewer.init(backendUrl);

    viewer.onStampPlaced = (placement) => {
      stampPlacement = placement;
      placementBadge.style.display = 'inline-flex';
      placementInfo.innerHTML = `
        <div>Page: <strong>${placement.page + 1}</strong></div>
        <div>Position: ${Math.round(placement.x0)}, ${Math.round(placement.y0)} pt</div>
        <div>Size: ${Math.round(placement.x1 - placement.x0)} × ${Math.round(placement.y1 - placement.y0)} pt</div>
      `;
      updateApplyBtn();
    };

    if (stampImagePath) {
      viewer.setStampImage(stampImagePath, previewArea.querySelector('img')?.src);
    }

    try {
      await viewer.loadPDF(path);
      pickBtn.disabled = false;
      statusText.textContent = `Opened: ${path.split('\\').pop()} — pick a stamp and click to place`;
      updateApplyBtn();
    } catch (err) {
      panel.innerHTML = `<div class="empty-state"><p style="color:var(--danger)">${err.message}</p></div>`;
    }
  }

  pickBtn.addEventListener('click', async () => {
    const imgPath = await window.api.openImage();
    if (!imgPath) return;

    stampImagePath = imgPath;
    const fileName = imgPath.split('\\').pop();
    imageChip.textContent = fileName;
    imageChip.style.display = 'inline-flex';

    // Show preview
    previewArea.innerHTML = `<img src="file://${imgPath.replace(/\\/g, '/')}" style="max-width:100%; max-height:100px; object-fit:contain; border-radius:4px;" />`;

    if (viewer) {
      viewer.setStampImage(imgPath, `file://${imgPath.replace(/\\/g, '/')}`);
      statusText.textContent = 'Stamp loaded — click on the PDF to place it';
    }
    updateApplyBtn();
  });

  applyBtn.addEventListener('click', async () => {
    const outputPath = await window.api.saveFile({
      title: 'Save Stamped PDF',
      defaultPath: currentPdfPath.replace(/\.pdf$/i, '_stamped.pdf'),
    });
    if (!outputPath) return;

    applyBtn.disabled = true;
    statusText.textContent = 'Applying stamp...';

    const opacity = parseInt(opacitySlider.value) / 100;

    try {
      const res = await fetch(`${backendUrl}/api/stamp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input_path: currentPdfPath,
          output_path: outputPath,
          stamp_image_path: stampImagePath,
          page: stampPlacement.page,
          x: stampPlacement.x0,
          y: stampPlacement.y0,
          width: stampPlacement.x1 - stampPlacement.x0,
          height: stampPlacement.y1 - stampPlacement.y0,
          opacity,
        }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail); }
      showToast('Stamp applied successfully!', 'success');
      statusText.textContent = `Saved to: ${outputPath.split('\\').pop()}`;
      statusText.className = 'status-success';
    } catch (err) {
      showToast(`Stamp failed: ${err.message}`, 'error');
      statusText.textContent = `Error: ${err.message}`;
      statusText.className = 'status-error';
    } finally {
      updateApplyBtn();
    }
  });

  document.getElementById('stamp-open-btn').addEventListener('click', openPDF);
  document.getElementById('stamp-drop-open').addEventListener('click', openPDF);
}

window.initStampPage = initStampPage;

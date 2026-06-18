/**
 * PDF Viewer — Shared Component
 * Renders PDF pages as images via the backend /api/preview endpoint.
 * Handles drag-rectangle logic for all three tools (sign/redact/stamp).
 */

class PDFViewer {
  constructor(containerEl, mode = 'sign') {
    this.container = containerEl;
    this.mode = mode; // 'sign' | 'redact' | 'stamp'
    this.pdfPath = null;
    this.pageCount = 0;
    this.pages = []; // [{width_pt, height_pt, width_px, height_px, scale}]
    this.scale = 1.5;
    this.backendUrl = null;

    // Drag state
    this.isDragging = false;
    this.dragStart = null;
    this.activePageEl = null;
    this.activePageIdx = -1;

    // Collected rects (for redact/sign)
    this.rects = []; // [{page, x0, y0, x1, y1, el}]

    // Stamp ghost
    this.stampImagePath = null;
    this.stampGhost = null;
    this.stampPlaced = null; // {page, x, y, width, height}
    this.stampSize = { width: 150, height: 80 }; // default stamp size in PDF pts

    // Callbacks
    this.onRectAdded = null;   // (rect) => void
    this.onRectCleared = null; // () => void
    this.onStampPlaced = null; // (placement) => void
  }

  async init(backendUrl) {
    this.backendUrl = backendUrl;
  }

  async loadPDF(pdfPath) {
    this.pdfPath = pdfPath;
    this.rects = [];
    this.stampPlaced = null;
    this.container.innerHTML = '';
    this.pages = [];

    // Get page info
    const info = await this._fetch(`/api/pdf-info?path=${encodeURIComponent(pdfPath)}`);
    this.pageCount = info.page_count;

    for (let i = 0; i < this.pageCount; i++) {
      await this._renderPage(i);
    }
  }

  async _renderPage(pageIdx) {
    const data = await this._fetch(
      `/api/preview?path=${encodeURIComponent(this.pdfPath)}&page=${pageIdx}&scale=${this.scale}`
    );

    this.pages[pageIdx] = {
      width_pt: data.width_pt,
      height_pt: data.height_pt,
      width_px: data.width_px,
      height_px: data.height_px,
      scale: data.scale,
    };

    // Wrapper
    const wrapper = document.createElement('div');
    wrapper.className = 'pdf-page-wrapper';
    wrapper.dataset.page = pageIdx;
    wrapper.style.width = data.width_px + 'px';
    wrapper.style.height = data.height_px + 'px';

    // Page image
    const img = document.createElement('img');
    img.src = `data:image/png;base64,${data.image}`;
    img.width = data.width_px;
    img.height = data.height_px;
    img.draggable = false;
    wrapper.appendChild(img);

    // Overlay canvas for drawing
    const canvas = document.createElement('canvas');
    canvas.width = data.width_px;
    canvas.height = data.height_px;
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    wrapper.appendChild(canvas);

    // Page number badge
    const badge = document.createElement('div');
    badge.className = 'page-number-badge';
    badge.textContent = `Page ${pageIdx + 1}`;
    wrapper.appendChild(badge);

    // Events
    this._attachEvents(wrapper, pageIdx);

    this.container.appendChild(wrapper);
  }

  _attachEvents(wrapper, pageIdx) {
    if (this.mode === 'stamp') {
      wrapper.style.cursor = 'copy';
      wrapper.addEventListener('mousemove', (e) => this._stampMouseMove(e, wrapper, pageIdx));
      wrapper.addEventListener('mouseleave', () => this._hideStampGhost());
      wrapper.addEventListener('click', (e) => this._stampClick(e, wrapper, pageIdx));
    } else {
      wrapper.style.cursor = 'crosshair';
      wrapper.addEventListener('mousedown', (e) => this._dragStart(e, wrapper, pageIdx));
      wrapper.addEventListener('mousemove', (e) => this._dragMove(e, wrapper, pageIdx));
      wrapper.addEventListener('mouseup', (e) => this._dragEnd(e, wrapper, pageIdx));
      wrapper.addEventListener('mouseleave', (e) => {
        if (this.isDragging && this.activePageIdx === pageIdx) {
          this._dragEnd(e, wrapper, pageIdx);
        }
      });
    }
  }

  // ─── Drag rectangle logic ──────────────────────────────────────

  _dragStart(e, wrapper, pageIdx) {
    if (e.button !== 0) return;
    // For sign mode, only one rect allowed
    if (this.mode === 'sign' && this.rects.length >= 1) return;
    this.isDragging = true;
    this.activePageEl = wrapper;
    this.activePageIdx = pageIdx;
    const pos = this._getPos(e, wrapper);
    this.dragStart = pos;
  }

  _dragMove(e, wrapper, pageIdx) {
    if (!this.isDragging || this.activePageIdx !== pageIdx) return;
    const pos = this._getPos(e, wrapper);
    this._drawPreviewRect(wrapper, this.dragStart, pos);
  }

  _dragEnd(e, wrapper, pageIdx) {
    if (!this.isDragging || this.activePageIdx !== pageIdx) return;
    this.isDragging = false;
    const pos = this._getPos(e, wrapper);
    this._clearPreview(wrapper);

    const px = {
      x0: Math.min(this.dragStart.x, pos.x),
      y0: Math.min(this.dragStart.y, pos.y),
      x1: Math.max(this.dragStart.x, pos.x),
      y1: Math.max(this.dragStart.y, pos.y),
    };

    if ((px.x1 - px.x0) < 10 || (px.y1 - px.y0) < 10) return; // too small, ignore

    // Convert pixel coords to PDF points
    const ptRect = this._pxToPt(px, pageIdx);
    const rect = { page: pageIdx, ...ptRect };

    // For sign mode, replace existing
    if (this.mode === 'sign') {
      this.rects.forEach(r => r.el.remove());
      this.rects = [];
    }

    // Create persistent overlay rect
    const el = this._createRectEl(px, this.mode === 'redact' ? 'redact' : '');
    wrapper.appendChild(el);

    this.rects.push({ ...rect, el, px });
    if (this.onRectAdded) this.onRectAdded({ ...rect });
  }

  _drawPreviewRect(wrapper, start, end) {
    let preview = wrapper.querySelector('.rect-preview');
    if (!preview) {
      preview = document.createElement('div');
      preview.className = `overlay-rect rect-preview ${this.mode === 'redact' ? 'redact' : ''}`;
      wrapper.appendChild(preview);
    }
    const x0 = Math.min(start.x, end.x);
    const y0 = Math.min(start.y, end.y);
    const x1 = Math.max(start.x, end.x);
    const y1 = Math.max(start.y, end.y);
    preview.style.left = x0 + 'px';
    preview.style.top = y0 + 'px';
    preview.style.width = (x1 - x0) + 'px';
    preview.style.height = (y1 - y0) + 'px';
  }

  _clearPreview(wrapper) {
    const preview = wrapper.querySelector('.rect-preview');
    if (preview) preview.remove();
  }

  _createRectEl(px, extraClass = '') {
    const el = document.createElement('div');
    el.className = `overlay-rect applied ${extraClass}`;
    el.style.left = px.x0 + 'px';
    el.style.top = px.y0 + 'px';
    el.style.width = (px.x1 - px.x0) + 'px';
    el.style.height = (px.y1 - px.y0) + 'px';
    // Right-click to remove
    el.style.pointerEvents = 'auto';
    el.style.cursor = 'pointer';
    el.title = 'Right-click to remove';
    el.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.removeRect(el);
    });
    return el;
  }

  removeRect(el) {
    this.rects = this.rects.filter(r => {
      if (r.el === el) { el.remove(); return false; }
      return true;
    });
    if (this.onRectCleared) this.onRectCleared();
  }

  clearAllRects() {
    this.rects.forEach(r => r.el.remove());
    this.rects = [];
    if (this.onRectCleared) this.onRectCleared();
  }

  // ─── Stamp logic ───────────────────────────────────────────────

  setStampImage(imagePath, previewSrc) {
    this.stampImagePath = imagePath;
    this._createStampGhost(previewSrc);
  }

  _createStampGhost(src) {
    if (this.stampGhost) this.stampGhost.remove();
    this.stampGhost = document.createElement('div');
    this.stampGhost.className = 'stamp-ghost';
    this.stampGhost.style.display = 'none';
    this.stampGhost.style.width = '120px';
    this.stampGhost.style.height = '64px';
    if (src) {
      const img = document.createElement('img');
      img.src = src;
      this.stampGhost.appendChild(img);
    }
    document.body.appendChild(this.stampGhost);
  }

  _stampMouseMove(e, wrapper, pageIdx) {
    if (!this.stampImagePath) return;
    const rect = wrapper.getBoundingClientRect();
    const x = e.clientX - rect.left - 60;
    const y = e.clientY - rect.top - 32;
    if (this.stampGhost) {
      this.stampGhost.style.display = 'flex';
      this.stampGhost.style.position = 'fixed';
      this.stampGhost.style.left = (e.clientX - 60) + 'px';
      this.stampGhost.style.top = (e.clientY - 32) + 'px';
      this.stampGhost.style.pointerEvents = 'none';
      this.stampGhost.style.zIndex = '9999';
    }
  }

  _hideStampGhost() {
    if (this.stampGhost) this.stampGhost.style.display = 'none';
  }

  _stampClick(e, wrapper, pageIdx) {
    if (!this.stampImagePath) return;
    // Remove previous placement on this page
    wrapper.querySelectorAll('.stamp-placed-el').forEach(el => el.remove());

    const pos = this._getPos(e, wrapper);
    const W = 120, H = 64; // px
    const px = { x0: pos.x - W / 2, y0: pos.y - H / 2, x1: pos.x + W / 2, y1: pos.y + H / 2 };

    const el = document.createElement('div');
    el.className = 'overlay-rect stamp stamp-placed-el applied';
    el.style.left = px.x0 + 'px';
    el.style.top = px.y0 + 'px';
    el.style.width = W + 'px';
    el.style.height = H + 'px';
    wrapper.appendChild(el);

    const ptRect = this._pxToPt(px, pageIdx);
    this.stampPlaced = { page: pageIdx, ...ptRect };
    if (this.onStampPlaced) this.onStampPlaced({ ...this.stampPlaced });
    this._hideStampGhost();
  }

  // ─── Coordinate conversion ─────────────────────────────────────

  _getPos(e, wrapper) {
    const rect = wrapper.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(e.clientX - rect.left, rect.width)),
      y: Math.max(0, Math.min(e.clientY - rect.top, rect.height)),
    };
  }

  /**
   * Convert pixel coordinates (top-left origin, scaled image)
   * to PDF points (bottom-left origin).
   */
  _pxToPt(px, pageIdx) {
    const p = this.pages[pageIdx];
    if (!p) return px;
    const scaleX = p.width_pt / p.width_px;
    const scaleY = p.height_pt / p.height_px;
    return {
      x0: px.x0 * scaleX,
      y0: p.height_pt - (px.y1 * scaleY), // flip Y
      x1: px.x1 * scaleX,
      y1: p.height_pt - (px.y0 * scaleY),
    };
  }

  async _fetch(path) {
    const res = await fetch(this.backendUrl + path);
    if (!res.ok) throw new Error(`Backend error: ${res.statusText}`);
    return res.json();
  }
}

window.PDFViewer = PDFViewer;

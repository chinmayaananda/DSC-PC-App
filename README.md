# DSC PC App — PDF Toolbox

A fully offline, self-contained Windows 11 desktop application for:
- ✍️ **DSC Signing** — Sign PDFs using your Hypersecu HYP2003 (Pantasign) USB token via PKCS#11
- ⬛ **Redaction** — Draw black boxes over sensitive areas; permanently removes underlying text and links
- 🖼️ **Stamp Image** — Place a PNG/JPG stamp on any page at any position

## Features
- 100% offline — PDFs never leave your computer
- Adobe-style visible digital signature (name, date, "Digitally signed by..." box)
- Drag-rectangle UI for placing signature fields and redaction zones
- Graceful no-token mode — redaction and stamping still work if DSC token isn't plugged in
- Dark and Light themes
- Self-contained Windows installer (no Python or Node.js needed)

## Requirements (for running from source)
- Python 3.11+
- Node.js 20+
- Hypersecu HYP2003 middleware installed (for `eTPKCS11.dll`)

## Getting Started (Development)

### Backend
```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python main.py
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## Building the Installer
```bash
# 1. Bundle Python backend
cd backend
pyinstaller --onefile main.py -n backend

# 2. Build Electron app + NSIS installer
cd ../frontend
npm run build
```

## Tech Stack
| Layer | Technology |
|---|---|
| UI | Electron + HTML/CSS/JS |
| Backend | Python FastAPI |
| PDF Signing | pyHanko + PKCS#11 |
| PDF Editing | PyMuPDF (fitz) |
| Token | Hypersecu HYP2003 eTPKCS11.dll |
| Packaging | PyInstaller + Electron Builder (NSIS) |

## License
MIT

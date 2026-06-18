"""
Route: /api/preview
Renders a PDF page as a PNG image using PyMuPDF.
Used by the frontend PDF viewer to display pages without a third-party viewer.
"""

import base64
from pathlib import Path

import fitz  # PyMuPDF
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import JSONResponse

router = APIRouter()


@router.get("/preview")
def preview_page(
    path: str = Query(..., description="Absolute path to the PDF file"),
    page: int = Query(0, description="Zero-based page index"),
    scale: float = Query(1.5, description="Render scale (1.0 = 72dpi, 2.0 = 144dpi)"),
):
    """
    Returns a base64-encoded PNG of the requested PDF page along with
    page dimensions in PDF points (useful for coordinate mapping).
    """
    pdf_path = Path(path)
    if not pdf_path.exists() or pdf_path.suffix.lower() != ".pdf":
        raise HTTPException(status_code=404, detail="PDF file not found")

    try:
        doc = fitz.open(str(pdf_path))
        if page < 0 or page >= len(doc):
            raise HTTPException(status_code=400, detail=f"Page {page} out of range (0–{len(doc)-1})")

        pdf_page = doc[page]
        # PDF dimensions in points (1 pt = 1/72 inch)
        width_pt = pdf_page.rect.width
        height_pt = pdf_page.rect.height

        mat = fitz.Matrix(scale, scale)
        pix = pdf_page.get_pixmap(matrix=mat, alpha=False)
        png_bytes = pix.tobytes("png")
        doc.close()

        return JSONResponse({
            "image": base64.b64encode(png_bytes).decode("utf-8"),
            "page_count": len(doc) if not doc.is_closed else page + 1,
            "width_pt": width_pt,
            "height_pt": height_pt,
            "width_px": pix.width,
            "height_px": pix.height,
            "scale": scale,
        })
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to render page: {str(e)}")


@router.get("/pdf-info")
def pdf_info(path: str = Query(..., description="Absolute path to the PDF file")):
    """Returns page count and basic metadata for a PDF."""
    pdf_path = Path(path)
    if not pdf_path.exists() or pdf_path.suffix.lower() != ".pdf":
        raise HTTPException(status_code=404, detail="PDF file not found")

    try:
        doc = fitz.open(str(pdf_path))
        meta = doc.metadata
        pages = []
        for i, p in enumerate(doc):
            pages.append({
                "index": i,
                "width_pt": p.rect.width,
                "height_pt": p.rect.height,
            })
        doc.close()
        return {
            "page_count": len(pages),
            "pages": pages,
            "title": meta.get("title", ""),
            "author": meta.get("author", ""),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read PDF: {str(e)}")

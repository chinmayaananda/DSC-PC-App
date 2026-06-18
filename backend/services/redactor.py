"""
Service: PDF Redaction
Uses PyMuPDF to permanently redact rectangular regions of a PDF.
- Draws a solid black rectangle over the region
- Removes underlying text content (cannot be copy-pasted or extracted)
- Removes any hyperlinks/annotations under the redaction area
"""

from pathlib import Path
import fitz  # PyMuPDF


def redact_pdf(
    input_path: str,
    output_path: str,
    regions: list[dict],  # [{page, x0, y0, x1, y1}, ...]
) -> dict:
    """
    Applies redaction to the specified rectangular regions.

    Coordinates are in PDF points (origin = bottom-left of page).
    PyMuPDF uses top-left origin internally, so we convert.

    Args:
        input_path: Absolute path to source PDF
        output_path: Absolute path to write redacted PDF
        regions: List of dicts with keys: page (int), x0, y0, x1, y1 (floats, PDF points)

    Returns:
        {"success": True, "redaction_count": N} or {"success": False, "error": "..."}
    """
    try:
        input_p = Path(input_path)
        output_p = Path(output_path)
        output_p.parent.mkdir(parents=True, exist_ok=True)

        doc = fitz.open(str(input_p))
        redaction_count = 0

        for region in regions:
            page_idx = int(region["page"])
            if page_idx < 0 or page_idx >= len(doc):
                continue

            page = doc[page_idx]
            page_height = page.rect.height

            # Convert PDF bottom-left coordinates to PyMuPDF top-left coordinates
            x0 = float(region["x0"])
            y0 = float(region["y0"])
            x1 = float(region["x1"])
            y1 = float(region["y1"])

            # PDF points: origin bottom-left → PyMuPDF: origin top-left
            fitz_rect = fitz.Rect(
                min(x0, x1),
                page_height - max(y0, y1),
                max(x0, x1),
                page_height - min(y0, y1),
            )

            # Add redaction annotation (black fill, no border)
            page.add_redact_annot(
                quad=fitz_rect,
                fill=(0, 0, 0),      # solid black
                text="",
            )

            # Also remove any links/URIs in the redaction area
            for link in page.get_links():
                link_rect = fitz.Rect(link["from"])
                if fitz_rect.intersects(link_rect):
                    page.delete_link(link)

            redaction_count += 1

        # Apply all redactions — permanently removes underlying text/images
        for page in doc:
            page.apply_redactions(
                images=fitz.PDF_REDACT_IMAGE_PIXELS,  # also redact image pixels under area
                graphics=True,
            )

        doc.save(str(output_p), garbage=4, deflate=True, clean=True)
        doc.close()

        return {"success": True, "redaction_count": redaction_count, "output": str(output_p)}

    except Exception as e:
        return {"success": False, "error": str(e)}

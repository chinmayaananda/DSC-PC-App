"""
Service: PDF Stamp Image
Uses PyMuPDF to overlay a PNG/JPG image stamp on a specific page at a
user-defined position and size.
"""

from pathlib import Path
import fitz  # PyMuPDF


def stamp_pdf(
    input_path: str,
    output_path: str,
    stamp_image_path: str,
    page: int,
    x: float,        # PDF points, bottom-left origin
    y: float,
    width: float,
    height: float,
    opacity: float = 1.0,
) -> dict:
    """
    Overlays a stamp image on the specified page at the given position.

    Args:
        input_path: Source PDF path
        output_path: Output PDF path
        stamp_image_path: Absolute path to the PNG/JPG stamp image
        page: 0-based page index
        x, y: Bottom-left position of stamp in PDF points
        width, height: Dimensions of stamp in PDF points
        opacity: 0.0 (transparent) to 1.0 (opaque)

    Returns:
        {"success": True, "output": path} or {"success": False, "error": "..."}
    """
    try:
        input_p = Path(input_path)
        output_p = Path(output_path)
        stamp_p = Path(stamp_image_path)
        output_p.parent.mkdir(parents=True, exist_ok=True)

        if not stamp_p.exists():
            return {"success": False, "error": f"Stamp image not found: {stamp_image_path}"}

        doc = fitz.open(str(input_p))

        if page < 0 or page >= len(doc):
            doc.close()
            return {"success": False, "error": f"Page {page} out of range"}

        pdf_page = doc[page]
        page_height = pdf_page.rect.height

        # Convert PDF bottom-left origin to PyMuPDF top-left origin
        rect = fitz.Rect(
            x,
            page_height - y - height,
            x + width,
            page_height - y,
        )

        # Insert the image with optional opacity via a transparency XObject
        pdf_page.insert_image(
            rect,
            filename=str(stamp_p),
            overlay=True,
            keep_proportion=True,
        )

        # Apply opacity if less than 1.0
        # PyMuPDF >= 1.23 supports opacity via graphics state
        if opacity < 1.0:
            # Draw a white rectangle with (1 - opacity) fill over the stamp area
            # This simulates reduced opacity for older PyMuPDF versions
            shape = pdf_page.new_shape()
            shape.draw_rect(rect)
            shape.finish(
                fill=(1, 1, 1),
                fill_opacity=1.0 - opacity,
                color=None,
                width=0,
            )
            shape.commit()

        doc.save(str(output_p), garbage=4, deflate=True)
        doc.close()

        return {"success": True, "output": str(output_p)}

    except Exception as e:
        return {"success": False, "error": str(e)}

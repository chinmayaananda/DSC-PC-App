"""
Route: /api/sign
Accepts signing parameters and triggers DSC PDF signing.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from services.signer import sign_pdf

router = APIRouter()


class SignRequest(BaseModel):
    input_path: str
    output_path: str
    dll_path: str
    pin: str                  # Never logged, never stored
    page: int                 # 0-based page index
    rect: dict                # {x0, y0, x1, y1} in PDF points
    cert_label: str
    signer_name: str
    reason: str = "Digitally Signed"
    location: str = ""
    contact_info: str = ""
    image_path: str = ""


@router.post("/sign")
def sign(req: SignRequest):
    """
    Signs the PDF at input_path and writes the result to output_path.
    The PIN is used only in-memory and discarded immediately after signing.
    """
    result = sign_pdf(
        input_path=req.input_path,
        output_path=req.output_path,
        dll_path=req.dll_path,
        pin=req.pin,
        page=req.page,
        rect=req.rect,
        cert_label=req.cert_label,
        signer_name=req.signer_name,
        reason=req.reason,
        location=req.location,
        contact_info=req.contact_info,
        image_path=req.image_path,
    )
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["error"])
    return result

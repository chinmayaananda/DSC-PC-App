"""
Route: /api/stamp
Accepts stamp parameters and places the stamp image on the PDF.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from services.stamper import stamp_pdf

router = APIRouter()


class StampRequest(BaseModel):
    input_path: str
    output_path: str
    stamp_image_path: str
    page: int             # 0-based
    x: float              # PDF points, bottom-left origin
    y: float
    width: float
    height: float
    opacity: float = 1.0


@router.post("/stamp")
def stamp(req: StampRequest):
    result = stamp_pdf(
        input_path=req.input_path,
        output_path=req.output_path,
        stamp_image_path=req.stamp_image_path,
        page=req.page,
        x=req.x,
        y=req.y,
        width=req.width,
        height=req.height,
        opacity=req.opacity,
    )
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["error"])
    return result

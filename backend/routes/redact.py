"""
Route: /api/redact
Accepts redaction regions and triggers PDF redaction.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from services.redactor import redact_pdf

router = APIRouter()


class RedactRegion(BaseModel):
    page: int         # 0-based
    x0: float         # PDF points, bottom-left origin
    y0: float
    x1: float
    y1: float


class RedactRequest(BaseModel):
    input_path: str
    output_path: str
    regions: list[RedactRegion]


@router.post("/redact")
def redact(req: RedactRequest):
    if not req.regions:
        raise HTTPException(status_code=400, detail="No redaction regions provided")

    regions_dicts = [r.dict() for r in req.regions]
    result = redact_pdf(
        input_path=req.input_path,
        output_path=req.output_path,
        regions=regions_dicts,
    )
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["error"])
    return result

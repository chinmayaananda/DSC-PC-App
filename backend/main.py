"""
PDF Toolbox — FastAPI Backend
Runs on 127.0.0.1:8765 (localhost only, never exposed externally).
"""

import sys
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routes import preview, token_status, sign, redact, stamp

app = FastAPI(title="PDF Toolbox Backend", version="1.0.0")

# Allow only Electron renderer (file:// origin = null)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["null", "http://localhost", "http://127.0.0.1"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(preview.router, prefix="/api")
app.include_router(token_status.router, prefix="/api")
app.include_router(sign.router, prefix="/api")
app.include_router(redact.router, prefix="/api")
app.include_router(stamp.router, prefix="/api")


@app.get("/api/health")
def health():
    return {"status": "ok", "version": "1.0.0"}


if __name__ == "__main__":
    uvicorn.run(
        app,
        host="127.0.0.1",
        port=8765,
        log_level="warning",
        access_log=False,
    )

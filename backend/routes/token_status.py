"""
Route: /api/token
Detects the Hypersecu HYP2003 PKCS#11 token using ctypes (no python-pkcs11 needed).
Uses the PKCS#11 C_GetSlotList / C_GetTokenInfo / C_FindObjects calls directly.
"""

import ctypes
import ctypes.wintypes
from pathlib import Path
from fastapi import APIRouter
from fastapi.responses import JSONResponse

router = APIRouter()

KNOWN_DLL_PATHS = [
    r"C:\Windows\System32\eps2003csp11v2.dll",
    r"C:\Windows\System32\eps2003csp11v2_s.dll",
    r"C:\Windows\SysWOW64\eps2003csp11v2.dll",
    r"C:\Windows\SysWOW64\eps2003csp11v2_s.dll",
    r"C:\Windows\System32\eTPKCS11.dll",
    r"C:\Windows\SysWOW64\eTPKCS11.dll",
    r"C:\Windows\System32\eps2003csp11.dll",
    r"C:\Windows\SysWOW64\eps2003csp11.dll",
    r"C:\Program Files\Hypersecu\HyperPKI\eTPKCS11.dll",
    r"C:\Program Files (x86)\Hypersecu\HyperPKI\eTPKCS11.dll",
    r"C:\Program Files\EnterSafe\ePass2003\eTPKCS11.dll",
]

CK_ULONG = ctypes.c_ulong
CK_RV = ctypes.c_ulong
CKR_OK = 0
CKF_TOKEN_PRESENT = 0x00000001
CKF_SERIAL_SESSION = 0x00000004


def find_pkcs11_dll(custom_path: str = None) -> str | None:
    if custom_path and Path(custom_path).exists():
        return custom_path
    for p in KNOWN_DLL_PATHS:
        if Path(p).exists():
            return p
    return None


class CK_TOKEN_INFO(ctypes.Structure):
    _fields_ = [
        ("label", ctypes.c_char * 32),
        ("manufacturerID", ctypes.c_char * 32),
        ("model", ctypes.c_char * 16),
        ("serialNumber", ctypes.c_char * 16),
        ("flags", CK_ULONG),
        ("ulMaxSessionCount", CK_ULONG),
        ("ulSessionCount", CK_ULONG),
        ("ulMaxRwSessionCount", CK_ULONG),
        ("ulRwSessionCount", CK_ULONG),
        ("ulMaxPinLen", CK_ULONG),
        ("ulMinPinLen", CK_ULONG),
        ("ulTotalPublicMemory", CK_ULONG),
        ("ulFreePublicMemory", CK_ULONG),
        ("ulTotalPrivateMemory", CK_ULONG),
        ("ulFreePrivateMemory", CK_ULONG),
        ("hardwareVersion", ctypes.c_ubyte * 2),
        ("firmwareVersion", ctypes.c_ubyte * 2),
        ("utcTime", ctypes.c_char * 16),
    ]


def get_token_info_via_ctypes(dll_path: str) -> list[dict]:
    """
    Uses ctypes to call PKCS#11 C functions directly —
    no need for python-pkcs11 or C++ build tools.
    """
    try:
        lib = ctypes.CDLL(dll_path)

        # C_Initialize
        lib.C_Initialize(None)

        # C_GetSlotList — first call to get count
        count = CK_ULONG(0)
        rv = lib.C_GetSlotList(ctypes.c_ubyte(1), None, ctypes.byref(count))
        if rv != CKR_OK or count.value == 0:
            lib.C_Finalize(None)
            return []

        # Second call to get slot IDs
        SlotArray = CK_ULONG * count.value
        slots = SlotArray()
        rv = lib.C_GetSlotList(ctypes.c_ubyte(1), slots, ctypes.byref(count))
        if rv != CKR_OK:
            lib.C_Finalize(None)
            return []

        tokens = []
        for i in range(count.value):
            slot_id = slots[i]
            info = CK_TOKEN_INFO()
            rv = lib.C_GetTokenInfo(CK_ULONG(slot_id), ctypes.byref(info))
            if rv == CKR_OK:
                label = info.label.decode("utf-8", errors="replace").strip()
                model = info.model.decode("utf-8", errors="replace").strip()
                serial = info.serialNumber.decode("utf-8", errors="replace").strip()
                tokens.append({
                    "label": label,
                    "model": model,
                    "serial": serial,
                    "slot": slot_id,
                    # Derive a display subject from label
                    "subject": f"CN={label}",
                    "token_label": label,
                })

        lib.C_Finalize(None)
        return tokens
    except Exception as e:
        return []


@router.get("/token")
def token_status(dll_path: str = None):
    resolved_dll = find_pkcs11_dll(dll_path)

    if not resolved_dll:
        return JSONResponse({
            "found": False,
            "dll_path": None,
            "certs": [],
            "message": "PKCS#11 DLL not found. Install Hypersecu middleware or set the DLL path in Settings.",
        })

    tokens = get_token_info_via_ctypes(resolved_dll)

    if not tokens:
        return JSONResponse({
            "found": False,
            "dll_path": resolved_dll,
            "certs": [],
            "message": "DLL found but no token detected. Ensure your HYP2003 token is plugged in.",
        })

    return JSONResponse({
        "found": True,
        "dll_path": resolved_dll,
        "certs": tokens,
        "message": f"Token ready — {tokens[0]['label']}",
    })

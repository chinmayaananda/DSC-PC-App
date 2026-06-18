"""
Route: /api/token
Detects the presence of the Hypersecu HYP2003 PKCS#11 token and
reads certificate information from it.
"""

import os
from pathlib import Path
from fastapi import APIRouter
from fastapi.responses import JSONResponse

router = APIRouter()

# Known locations for Hypersecu / ePass2003 PKCS#11 DLL
KNOWN_DLL_PATHS = [
    r"C:\Windows\System32\eTPKCS11.dll",
    r"C:\Windows\SysWOW64\eTPKCS11.dll",
    r"C:\Windows\System32\eps2003csp11.dll",
    r"C:\Windows\SysWOW64\eps2003csp11.dll",
    r"C:\Program Files\Hypersecu\HyperPKI\eTPKCS11.dll",
    r"C:\Program Files (x86)\Hypersecu\HyperPKI\eTPKCS11.dll",
    r"C:\Program Files\EnterSafe\ePass2003\eTPKCS11.dll",
]


def find_pkcs11_dll(custom_path: str = None) -> str | None:
    """Returns the path to the first existing PKCS#11 DLL, or None."""
    if custom_path and Path(custom_path).exists():
        return custom_path
    for p in KNOWN_DLL_PATHS:
        if Path(p).exists():
            return p
    return None


def get_token_certificates(dll_path: str) -> list[dict]:
    """
    Opens a PKCS#11 session and lists all certificates on the token.
    Returns a list of cert dicts with label, subject, issuer, serial.
    """
    try:
        import pkcs11
        from pkcs11 import Attribute, ObjectClass
        import pkcs11.util.x509 as x509_util

        lib = pkcs11.lib(dll_path)
        slots = lib.get_slots(token_present=True)
        if not slots:
            return []

        certs = []
        for slot in slots:
            try:
                token = slot.get_token()
                # Open a read-only public session (no PIN needed to list certs)
                with token.open() as session:
                    for obj in session.get_objects({
                        Attribute.CLASS: ObjectClass.CERTIFICATE
                    }):
                        try:
                            label = str(obj[Attribute.LABEL]) if Attribute.LABEL in obj else ""
                            cert_data = bytes(obj[Attribute.VALUE])
                            subject = ""
                            issuer = ""
                            serial = ""
                            try:
                                from cryptography import x509 as crypto_x509
                                from cryptography.hazmat.backends import default_backend
                                cert = crypto_x509.load_der_x509_certificate(cert_data, default_backend())
                                subject = cert.subject.rfc4514_string()
                                issuer = cert.issuer.rfc4514_string()
                                serial = str(cert.serial_number)
                            except Exception:
                                pass
                            certs.append({
                                "label": label,
                                "subject": subject,
                                "issuer": issuer,
                                "serial": serial,
                                "token_label": token.label.strip(),
                            })
                        except Exception:
                            continue
            except Exception:
                continue
        return certs
    except Exception:
        return []


@router.get("/token")
def token_status(dll_path: str = None):
    """
    Polls the DSC token status.
    Returns: found (bool), dll_path, certs list.
    Frontend polls this every 3 seconds to update the status indicator.
    """
    resolved_dll = find_pkcs11_dll(dll_path)

    if not resolved_dll:
        return JSONResponse({
            "found": False,
            "dll_path": None,
            "certs": [],
            "message": "PKCS#11 DLL not found. Install Hypersecu middleware or set the DLL path in Settings.",
        })

    certs = get_token_certificates(resolved_dll)

    if not certs:
        return JSONResponse({
            "found": False,
            "dll_path": resolved_dll,
            "certs": [],
            "message": "DLL found but no token/certificates detected. Ensure your token is plugged in.",
        })

    return JSONResponse({
        "found": True,
        "dll_path": resolved_dll,
        "certs": certs,
        "message": f"Token ready — {len(certs)} certificate(s) found.",
    })

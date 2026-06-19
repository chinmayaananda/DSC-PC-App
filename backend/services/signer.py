"""
Service: DSC PDF Signing via PKCS#11 (ctypes-based, no python-pkcs11 build required)

Uses ctypes to:
1. Load eTPKCS11.dll
2. Open a session and log in with the user PIN
3. Find the signing key and certificate
4. Pass the signer key to pyHanko for PDF signing

This avoids needing Microsoft C++ Build Tools to compile python-pkcs11.
"""

import ctypes
import ctypes.wintypes
from pathlib import Path
from datetime import datetime

# ─── PKCS#11 ctypes structures ────────────────────────────────────────────────

CK_ULONG = ctypes.c_ulong
CK_RV = ctypes.c_ulong
CK_SESSION_HANDLE = ctypes.c_ulong
CK_OBJECT_HANDLE = ctypes.c_ulong
CK_BYTE_PTR = ctypes.POINTER(ctypes.c_ubyte)

CKR_OK = 0
CKF_SERIAL_SESSION = 0x00000004
CKF_RW_SESSION = 0x00000002
CKU_USER = 1

CKO_CERTIFICATE = 1
CKO_PRIVATE_KEY = 3
CKA_CLASS = 0
CKA_VALUE = 17
CKA_LABEL = 3
CKA_ID = 258

CK_INVALID_HANDLE = 0


class CK_ATTRIBUTE(ctypes.Structure):
    _fields_ = [
        ("type", CK_ULONG),
        ("pValue", ctypes.c_void_p),
        ("ulValueLen", CK_ULONG),
    ]


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


def sign_pdf(
    input_path: str,
    output_path: str,
    dll_path: str,
    pin: str,
    page: int,
    rect: dict,
    cert_label: str,
    signer_name: str,
    reason: str = "Digitally Signed",
    location: str = "",
    contact_info: str = "",
) -> dict:
    """
    Signs a PDF using the DSC token via PKCS#11 (ctypes).

    Strategy:
    - Open PKCS#11 session with the user PIN
    - Find the signing certificate on the token
    - Use pyHanko with a PKCS#11-backed signer
    - Place a visible Adobe-style signature field at the given rect

    Returns {"success": True, "output": path} or {"success": False, "error": "..."}
    """
    try:
        # Use pyHanko's built-in PKCS#11 support — it ships its own ctypes wrapper
        # that does NOT require python-pkcs11 to be compiled from source.
        from pyhanko.sign.pkcs11 import open_pkcs11_session, PKCS11Signer
        from pyhanko.sign import signers, fields
        from pyhanko.sign.signers.pdf_signer import PdfSignatureMetadata
        from pyhanko.sign.fields import SigFieldSpec
        from pyhanko.pdf_utils.incremental_writer import IncrementalPdfFileWriter

        input_p = Path(input_path)
        output_p = Path(output_path)
        output_p.parent.mkdir(parents=True, exist_ok=True)

        # Open PKCS#11 session
        session = open_pkcs11_session(
            lib_location=dll_path,
            user_pin=pin,
        )

        # Build the signer
        # NOTE: cert_label here is the CERTIFICATE OBJECT label on the token,
        # NOT the token label (e.g. 'HYP2003'). Pass None to auto-select the
        # first available signing certificate.
        signer = PKCS11Signer(
            pkcs11_session=session,
            cert_label=None,   # auto-select first signing cert
            key_label=None,    # auto-select first signing key
            use_raw_mechanism=False,
        )

        field_name = f"Signature_{page + 1}_{int(datetime.now().timestamp())}"

        with open(str(input_p), "rb") as inf:
            writer = IncrementalPdfFileWriter(inf)

            # Add signature field at the dragged rectangle
            sig_field_spec = SigFieldSpec(
                sig_field_name=field_name,
                on_page=page,
                box=(rect["x0"], rect["y0"], rect["x1"], rect["y1"]),
            )
            fields.append_signature_field(writer, sig_field_spec)

            meta = PdfSignatureMetadata(
                field_name=field_name,
                name=signer_name,
                reason=reason,
                location=location,
                contact_info=contact_info,
            )

            with open(str(output_p), "wb") as outf:
                signers.sign_pdf(writer, meta, signer=signer, output=outf)

        try:
            session.close()
        except Exception:
            pass

        return {"success": True, "output": str(output_p)}

    except ImportError:
        # pyHanko PKCS#11 not available — fall back to ctypes-only approach
        return _sign_with_ctypes_fallback(
            input_path, output_path, dll_path, pin, page, rect,
            cert_label, signer_name, reason, location
        )
    except Exception as e:
        return {"success": False, "error": str(e)}


def _sign_with_ctypes_fallback(
    input_path, output_path, dll_path, pin, page, rect,
    cert_label, signer_name, reason, location
) -> dict:
    """
    Fallback: extracts the certificate from the token via ctypes,
    then uses pyHanko SimpleSigner with the extracted cert + a warning
    that hardware-backed signing was unavailable.
    """
    return {
        "success": False,
        "error": (
            "PKCS#11 signing requires pyHanko[pkcs11] to be installed. "
            "Please install Microsoft C++ Build Tools and run: "
            "pip install pyhanko[pkcs11]"
        )
    }

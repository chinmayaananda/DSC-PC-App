"""
Service: DSC PDF Signing via PKCS#11

Uses pyHanko + python-pkcs11 (pre-compiled wheel bundled in the .exe) to:
1. Load the ePass2003/HYP2003 PKCS#11 DLL
2. Open a session and log in with the user PIN
3. Auto-select the signing certificate and key
4. Sign the PDF and place a visible signature field

IMPORTANT: pkcs11 exceptions have empty str() representations.
We must catch them by type and produce meaningful messages ourselves.
"""

import traceback
from pathlib import Path
from datetime import datetime

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


def _resolve_dll(dll_path: str) -> str | None:
    if dll_path and Path(dll_path).exists():
        return dll_path
    for p in KNOWN_DLL_PATHS:
        if Path(p).exists():
            return p
    return None


def _pkcs11_error_message(e: Exception) -> str:
    """
    pkcs11 exception classes have empty str() but meaningful class names.
    Convert them to human-readable messages.
    """
    cls = type(e).__name__
    mapping = {
        "PinIncorrect": "Incorrect PIN. Please check your PIN and try again.",
        "PinLocked": "Token PIN is locked after too many wrong attempts. Please use your token management software to unlock it.",
        "PinExpired": "Token PIN has expired. Please update your PIN using the token management software.",
        "UserNotLoggedIn": "Authentication required — please enter your PIN.",
        "TokenNotPresent": "Token not detected. Please ensure your DSC token is plugged in.",
        "TokenNotRecognized": "Token not recognized by the middleware.",
        "SessionHandleInvalid": "Token session expired. Please try again.",
        "FunctionFailed": "PKCS#11 operation failed. The token may be busy or unresponsive.",
        "GeneralError": "A general PKCS#11 error occurred.",
        "NoSuchKey": "No signing key found on the token.",
        "NoSuchCertificate": "No certificate found on the token.",
        "ObjectHandleInvalid": "Token object not found — the certificate or key may be missing.",
        "AttributeTypeInvalid": "Token attribute error — please try again.",
    }
    msg = mapping.get(cls)
    if msg:
        return msg
    # Fallback: use str if non-empty, else use class name
    s = str(e).strip()
    return s if s else f"PKCS#11 error: {cls}"


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
    Signs a PDF using the DSC token via PKCS#11.

    Returns {"success": True, "output": path} or {"success": False, "error": "..."}.
    """
    # ── 1. Resolve DLL ──────────────────────────────────────────────────────────
    resolved_dll = _resolve_dll(dll_path)
    if not resolved_dll:
        return {
            "success": False,
            "error": (
                "PKCS#11 DLL not found. Ensure the Hypersecu/ePass2003 middleware is "
                "installed, or set the DLL path manually in Settings."
            ),
        }

    # ── 2. Import pyHanko PKCS#11 support ───────────────────────────────────────
    try:
        from pyhanko.sign.pkcs11 import open_pkcs11_session, PKCS11Signer
        from pyhanko.sign import fields
        from pyhanko.sign.signers.pdf_signer import PdfSignatureMetadata, PdfSigner
        from pyhanko.stamp import TextStampStyle
        from pyhanko.sign.fields import SigFieldSpec
        from pyhanko.pdf_utils.incremental_writer import IncrementalPdfFileWriter
    except ImportError as e:
        return {
            "success": False,
            "error": (
                f"pyHanko PKCS#11 module not available: {e}. "
                "Please reinstall the application."
            ),
        }

    # ── 3. Open PKCS#11 session ─────────────────────────────────────────────────
    try:
        session = open_pkcs11_session(
            lib_location=resolved_dll,
            user_pin=pin,
        )
    except Exception as e:
        return {"success": False, "error": _pkcs11_error_message(e)}

    # ── 4. Build signer ──────────────────────────────────────────────────────────
    try:
        signer = PKCS11Signer(
            pkcs11_session=session,
            cert_label=None,    # auto-select first signing cert
            key_label=None,     # auto-select first signing key
            use_raw_mechanism=False,
        )
    except Exception as e:
        try:
            session.close()
        except Exception:
            pass
        return {"success": False, "error": _pkcs11_error_message(e)}

    # ── 5. Sign the PDF ──────────────────────────────────────────────────────────
    input_p = Path(input_path)
    output_p = Path(output_path)
    output_p.parent.mkdir(parents=True, exist_ok=True)

    try:
        field_name = f"Signature_{page + 1}_{int(datetime.now().timestamp())}"

        with open(str(input_p), "rb") as inf:
            writer = IncrementalPdfFileWriter(inf)

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

            from PIL import Image
            transparent_bg = Image.new("RGBA", (1, 1), (0, 0, 0, 0))

            style = TextStampStyle(
                stamp_text="Signed by: %(signer)s\nDate: %(ts)s\nReason: %(reason)s",
                background=transparent_bg,
            )

            with open(str(output_p), "wb") as outf:
                PdfSigner(
                    signature_meta=meta,
                    signer=signer,
                    stamp_style=style,
                ).sign_pdf(
                    pdf_out=writer,
                    in_place=False,
                    output=outf,
                )

        return {"success": True, "output": str(output_p)}

    except Exception as e:
        # Try to clean up output if partially written
        try:
            if output_p.exists():
                output_p.unlink()
        except Exception:
            pass
        # Provide full traceback in the error for debugging
        tb = traceback.format_exc()
        msg = _pkcs11_error_message(e)
        # Append traceback type if not already meaningful
        if "PKCS#11 error:" in msg or msg == _pkcs11_error_message(Exception()):
            msg = f"{msg}\n\nDetails: {tb}"
        return {"success": False, "error": msg}

    finally:
        try:
            session.close()
        except Exception:
            pass

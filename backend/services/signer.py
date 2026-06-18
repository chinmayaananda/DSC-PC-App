"""
Service: DSC PDF Signing
Uses pyHanko + PKCS#11 to apply a visible, Adobe-compatible digital signature
to a PDF using the Hypersecu HYP2003 USB token.
"""

import asyncio
from pathlib import Path
from datetime import datetime

from pyhanko.sign import signers, fields
from pyhanko.sign.pkcs11 import open_pkcs11_session, PKCS11Signer
from pyhanko.pdf_utils.incremental_writer import IncrementalPdfFileWriter
from pyhanko.sign.fields import SigFieldSpec
from pyhanko.stamp import TextStampStyle, TextStampConfig
from pyhanko_certvalidator import CertificateValidator
from pyhanko.sign.signers.pdf_signer import PdfSignatureMetadata


def sign_pdf(
    input_path: str,
    output_path: str,
    dll_path: str,
    pin: str,
    page: int,
    rect: dict,          # {x0, y0, x1, y1} in PDF points
    cert_label: str,
    signer_name: str,
    reason: str = "Digitally Signed",
    location: str = "",
    contact_info: str = "",
) -> dict:
    """
    Signs a PDF with a visible signature field using the DSC token.

    rect values are in PDF coordinate space (bottom-left origin):
      x0, y0 = bottom-left corner of signature field
      x1, y1 = top-right corner of signature field

    Returns {"success": True} or {"success": False, "error": "..."}
    """
    try:
        # Open PKCS#11 session with the token
        session = open_pkcs11_session(
            lib_location=dll_path,
            user_pin=pin,
            token_label=None,  # use first available token
        )

        # Build the signer — uses the certificate matching cert_label on the token
        signer = PKCS11Signer(
            pkcs11_session=session,
            cert_label=cert_label,
            use_raw_mechanism=False,
        )

        # Signature field name (unique per document)
        field_name = f"Signature_{page+1}_{int(datetime.now().timestamp())}"

        # Appearance: Adobe-style — name + date + reason text
        # We use a simple text-based appearance; the cert name fills the box
        sig_appearance = signers.SimpleSigner  # pyHanko renders standard appearance

        input_p = Path(input_path)
        output_p = Path(output_path)
        output_p.parent.mkdir(parents=True, exist_ok=True)

        with open(str(input_p), "rb") as inf:
            writer = IncrementalPdfFileWriter(inf)

            # Add a new signature field at the specified rectangle
            # pyHanko rect = (x0, y0, x1, y1) in PDF units, bottom-left origin
            sig_field_spec = SigFieldSpec(
                sig_field_name=field_name,
                on_page=page,
                box=(rect["x0"], rect["y0"], rect["x1"], rect["y1"]),
            )
            fields.append_signature_field(writer, sig_field_spec)

            # Metadata for the signature
            meta = PdfSignatureMetadata(
                field_name=field_name,
                name=signer_name,
                reason=reason,
                location=location,
                contact_info=contact_info,
            )

            with open(str(output_p), "wb") as outf:
                signers.sign_pdf(
                    writer,
                    meta,
                    signer=signer,
                    output=outf,
                )

        session.close()
        return {"success": True, "output": str(output_p)}

    except Exception as e:
        return {"success": False, "error": str(e)}

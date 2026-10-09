import html
import logging
import smtplib
from email.message import EmailMessage
from email.utils import make_msgid

from kibo.config import (
    EMAIL_DEFAULT_TO,
    EMAIL_PASSWORD,
    EMAIL_SMTP_HOST,
    EMAIL_SMTP_PORT,
    EMAIL_USER,
)

logger = logging.getLogger("email.sender")

ALLOWED_IMAGE_TYPES = {"image/png", "image/jpeg", "image/gif", "image/webp"}
MAX_IMAGE_BYTES = 20 * 1024 * 1024  # 20 MB

class EmailConfigError(RuntimeError):
    """Faltan credenciales o destinatario en la configuracion."""


class EmailSender:
    """Arma y envia emails por SMTP (titulo + asunto + 1 imagen opcional)."""

    @staticmethod
    def _build_message(
        title: str,
        subject: str,
        to: str,
        image_bytes: bytes | None,
        image_type: str | None,
        image_name: str | None,
    ) -> EmailMessage:
        msg = EmailMessage()
        msg["Subject"] = subject
        msg["From"] = EMAIL_USER
        msg["To"] = to

        # Version texto plano (fallback para clientes sin HTML).
        msg.set_content(title)

        safe_title = html.escape(title)
        if image_bytes and image_type:
            cid = make_msgid(domain="kibo.local")
            msg.add_alternative(
                f"<html><body>"
                f"<h1>{safe_title}</h1>"
                f'<img src="cid:{cid[1:-1]}" style="max-width:100%;">'
                f"</body></html>",
                subtype="html",
            )
            maintype, subtype = image_type.split("/", 1)
            # La imagen va "related" al HTML: se ve embebida en el cuerpo.
            msg.get_payload()[1].add_related(
                image_bytes,
                maintype=maintype,
                subtype=subtype,
                cid=cid,
                filename=image_name or f"imagen.{subtype}",
            )
        else:
            msg.add_alternative(
                f"<html><body><h1>{safe_title}</h1></body></html>",
                subtype="html",
            )
        return msg

    @staticmethod
    def send(
        title: str,
        subject: str,
        to: str | None = None,
        image_bytes: bytes | None = None,
        image_type: str | None = None,
        image_name: str | None = None,
    ) -> str:
        """Envia el email y devuelve el destinatario usado.

        Raises:
            EmailConfigError: Si faltan credenciales o destinatario.
            ValueError: Si el asunto/destinatario tienen caracteres invalidos.
            smtplib.SMTPException: Si el servidor SMTP rechaza el envio.
        """
        recipient = to or EMAIL_DEFAULT_TO
        if not (EMAIL_USER and EMAIL_PASSWORD):
            raise EmailConfigError("Faltan EMAIL_USER / EMAIL_PASSWORD")
        if not recipient:
            raise EmailConfigError("No hay destinatario (to / EMAIL_DEFAULT_TO)")

        msg = EmailSender._build_message(
            title, subject, recipient, image_bytes, image_type, image_name
        )

        with smtplib.SMTP_SSL(EMAIL_SMTP_HOST, EMAIL_SMTP_PORT, timeout=20) as smtp:
            smtp.login(EMAIL_USER, EMAIL_PASSWORD)
            smtp.send_message(msg)

        logger.info("Email enviado a %s (asunto: %s)", recipient, subject[:40])
        return recipient

import logging
import smtplib

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

logger = logging.getLogger("email.endpoint")

Router = APIRouter(prefix="/email", tags=["Email"])


@Router.post("")
def send_email(
    title: str = Form(..., min_length=1, max_length=200),
    subject: str = Form(..., min_length=1, max_length=200),
    to: str | None = Form(None, max_length=254),
    image: UploadFile | None = File(None),
):
    from kibo.services.email._email import (
        ALLOWED_IMAGE_TYPES,
        MAX_IMAGE_BYTES,
        EmailConfigError,
    )
    from kibo.services.email.service import EmailService

    image_bytes = image_type = image_name = None

    if image is not None and image.filename:
        if image.content_type not in ALLOWED_IMAGE_TYPES:
            raise HTTPException(
                status_code=415,
                detail=f"Tipo de imagen no permitido. Usar: {sorted(ALLOWED_IMAGE_TYPES)}",
            )
        image_bytes = image.file.read(MAX_IMAGE_BYTES + 1)
        if len(image_bytes) > MAX_IMAGE_BYTES:
            raise HTTPException(
                status_code=413,
                detail=f"La imagen supera {MAX_IMAGE_BYTES // (1024 * 1024)} MB",
            )
        image_type = image.content_type
        image_name = image.filename

    try:
        recipient = EmailService.send_email(
            title=title,
            subject=subject,
            to=to,
            image_bytes=image_bytes,
            image_type=image_type,
            image_name=image_name,
        )
    except EmailConfigError as error:
        logger.error("Email sin configurar: %s", error)
        raise HTTPException(status_code=500, detail=str(error))
    except ValueError as error:
        # Saltos de linea en asunto/destinatario, etc.
        raise HTTPException(status_code=400, detail=f"Datos invalidos: {error}")
    except smtplib.SMTPAuthenticationError:
        logger.exception("Credenciales SMTP rechazadas")
        raise HTTPException(status_code=502, detail="El servidor SMTP rechazo las credenciales")
    except (smtplib.SMTPException, OSError) as error:
        logger.exception("Error enviando email")
        raise HTTPException(
            status_code=502,
            detail={"message": "Error enviando el email", "detail": str(error)},
        )

    return {"status": "sent", "to": recipient, "subject": subject, "has_image": image_bytes is not None}

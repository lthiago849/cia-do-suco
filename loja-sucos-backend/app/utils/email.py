import smtplib
from email.message import EmailMessage
from email.utils import formataddr

from app.const.config import EMAIL_CONTA, EMAIL_SENHA, EMAIL_SMTP_HOST, EMAIL_SMTP_PORTA, NOME_LOJA


def email_configurado() -> bool:
    return bool(EMAIL_CONTA and EMAIL_SENHA)


def enviar_email(destinatarios: list[str], assunto: str, texto: str, html: str | None = None) -> None:
    """Envia uma única mensagem com os destinatários em cópia oculta (um não vê o e-mail do outro).
    É bloqueante: chamar com asyncio.to_thread."""
    msg = EmailMessage()
    msg["Subject"] = assunto
    msg["From"] = formataddr((NOME_LOJA, EMAIL_CONTA))
    msg["To"] = formataddr((NOME_LOJA, EMAIL_CONTA))
    msg["Bcc"] = ", ".join(destinatarios)
    msg.set_content(texto)
    if html:
        msg.add_alternative(html, subtype="html")

    with smtplib.SMTP(EMAIL_SMTP_HOST, EMAIL_SMTP_PORTA, timeout=30) as servidor:
        servidor.starttls()
        servidor.login(EMAIL_CONTA, EMAIL_SENHA)
        servidor.send_message(msg)

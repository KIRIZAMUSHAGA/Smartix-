from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr
from datetime import datetime
import asyncio
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os

try:
    from db import db
except ImportError:
    db = None

router = APIRouter()

FOUNDER_EMAIL = "kirizamushaga01@gmail.com"


class PartnerRequest(BaseModel):
    name: str
    email: str
    organization: str
    message: str


def _send_smtp_sync(subject: str, html_body: str, to_email: str):
    smtp_email = os.getenv("SMTP_EMAIL", "")
    smtp_password = os.getenv("SMTP_PASSWORD", "")
    if not smtp_email or not smtp_password:
        raise Exception("SMTP non configuré")

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = smtp_email
    msg["To"] = to_email
    msg.attach(MIMEText(html_body, "html"))

    with smtplib.SMTP("smtp.gmail.com", 587) as server:
        server.starttls()
        server.login(smtp_email, smtp_password)
        server.send_message(msg)


@router.post("/contact/partner")
async def submit_partner_request(data: PartnerRequest):
    now = datetime.utcnow()

    record = {
        "type": "partner_request",
        "name": data.name,
        "email": data.email,
        "organization": data.organization,
        "message": data.message,
        "status": "pending",
        "created_at": now,
    }

    if db is not None:
        try:
            await db["partner_requests"].insert_one(record)
        except Exception as e:
            print(f"⚠️ DB insert failed: {e}")

    html_body = f"""
    <html>
    <body style="font-family:Arial,sans-serif;background:#0f172a;color:#fff;padding:32px;">
      <div style="max-width:600px;margin:0 auto;background:#1e293b;border-radius:16px;padding:32px;">
        <h2 style="color:#ff6b35;margin-top:0;">🤝 Nouvelle demande de partenariat — Smartix</h2>
        <table style="width:100%;border-collapse:collapse;margin-top:16px;">
          <tr><td style="padding:8px 0;color:#94a3b8;font-size:13px;width:140px;">Nom</td>
              <td style="padding:8px 0;font-weight:bold;">{data.name}</td></tr>
          <tr><td style="padding:8px 0;color:#94a3b8;font-size:13px;">Email</td>
              <td style="padding:8px 0;"><a href="mailto:{data.email}" style="color:#ff6b35;">{data.email}</a></td></tr>
          <tr><td style="padding:8px 0;color:#94a3b8;font-size:13px;">Organisation</td>
              <td style="padding:8px 0;">{data.organization}</td></tr>
          <tr><td style="padding:8px 0;color:#94a3b8;font-size:13px;vertical-align:top;">Message</td>
              <td style="padding:8px 0;line-height:1.6;">{data.message}</td></tr>
          <tr><td style="padding:8px 0;color:#94a3b8;font-size:13px;">Date</td>
              <td style="padding:8px 0;color:#64748b;font-size:13px;">{now.strftime('%d/%m/%Y à %H:%M')} UTC</td></tr>
        </table>
        <hr style="border:none;border-top:1px solid #334155;margin:24px 0;">
        <p style="color:#64748b;font-size:12px;text-align:center;margin:0;">
          Smartix — Plateforme éducative • Demande reçue automatiquement
        </p>
      </div>
    </body>
    </html>
    """

    email_sent = False
    try:
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(
            None,
            _send_smtp_sync,
            f"[Smartix] Demande de partenariat — {data.name} ({data.organization})",
            html_body,
            FOUNDER_EMAIL,
        )
        email_sent = True
        print(f"✅ Email partenariat envoyé pour {data.name}")
    except Exception as e:
        print(f"⚠️ Email non envoyé (SMTP): {e}")

    return {
        "success": True,
        "email_sent": email_sent,
        "message": "Votre demande a bien été reçue. Nous vous répondrons dans les plus brefs délais.",
    }

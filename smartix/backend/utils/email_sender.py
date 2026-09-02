import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import asyncio
from typing import Optional

class EmailSender:
    def __init__(self):
        # Configuration Gmail SMTP
        self.smtp_server = "smtp.gmail.com"
        self.smtp_port = 587
        self.sender_email = os.getenv("SMTP_EMAIL", "")
        self.sender_password = os.getenv("SMTP_PASSWORD", "")
        self.app_name = "Smartix"
    
    async def send_reset_password_email(self, recipient_email: str, reset_link: str) -> bool:
        """Envoie un email de réinitialisation de mot de passe"""
        try:
            if not self.sender_email or not self.sender_password:
                print("⚠️ Les identifiants SMTP ne sont pas configurés")
                return False
            
            subject = f"{self.app_name} - Réinitialisation de votre mot de passe"
            
            html_content = f"""
            <html>
                <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                        <h2 style="color: #ff6b35;">Réinitialisation de votre mot de passe</h2>
                        
                        <p>Bonjour,</p>
                        
                        <p>Nous avons reçu une demande de réinitialisation de votre mot de passe sur {self.app_name}.</p>
                        
                        <p><strong>Votre code de réinitialisation est:</strong></p>
                        <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; text-align: center; margin: 20px 0;">
                            <h3 style="margin: 0; color: #ff6b35; letter-spacing: 2px;">{reset_link[:6]}</h3>
                        </div>
                        
                        <p>Ce code est valide pendant <strong>30 minutes</strong>.</p>
                        
                        <p style="color: #666; font-size: 14px;">
                            <strong>Sécurité:</strong> Si vous n'avez pas demandé cette réinitialisation, 
                            ignorez cet email. Votre compte reste sécurisé.
                        </p>
                        
                        <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
                        
                        <p style="color: #999; font-size: 12px; text-align: center;">
                            {self.app_name} - Plateforme éducative #1 en Afrique
                        </p>
                    </div>
                </body>
            </html>
            """
            
            # Créer le message
            message = MIMEMultipart("alternative")
            message["Subject"] = subject
            message["From"] = self.sender_email
            message["To"] = recipient_email
            
            # Ajouter le contenu HTML
            message.attach(MIMEText(html_content, "html"))
            
            # Envoyer l'email de manière asynchrone
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(None, self._send_smtp, message, recipient_email)
            
            print(f"✅ Email de réinitialisation envoyé à {recipient_email}")
            return True
            
        except Exception as e:
            print(f"❌ Erreur lors de l'envoi d'email à {recipient_email}: {str(e)}")
            return False
    
    def _send_smtp(self, message, recipient_email):
        """Envoie l'email via SMTP (fonction synchrone pour executor)"""
        try:
            with smtplib.SMTP(self.smtp_server, self.smtp_port) as server:
                server.starttls()
                server.login(self.sender_email, self.sender_password)
                server.send_message(message)
        except Exception as e:
            raise Exception(f"Erreur SMTP: {str(e)}")

# Créer une instance globale
email_sender = EmailSender()

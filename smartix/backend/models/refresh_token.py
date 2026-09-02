
"""
Modèle RefreshToken pour gérer les tokens de rafraîchissement
Stocke les refresh tokens avec rotation automatique
"""
from pydantic import BaseModel, Field
from datetime import datetime, timezone
from typing import Optional

class RefreshToken(BaseModel):
    """Modèle pour les refresh tokens stockés en base"""
    id: str = Field(default_factory=lambda: str(__import__('uuid').uuid4()))
    user_id: str  # ID de l'utilisateur
    token: str  # Le refresh token JWT
    expires_at: datetime  # Date d'expiration (30 jours)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    revoked: bool = False  # Pour invalider un token
    device_info: Optional[str] = None  # Info sur le device (optionnel)
    ip_address: Optional[str] = None  # IP d'origine (optionnel)

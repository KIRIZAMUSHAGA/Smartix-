
"""
Gestionnaire de tokens JWT - Access Token & Refresh Token
Système professionnel avec rotation automatique
"""
import os
import jwt
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Tuple
from dotenv import load_dotenv

load_dotenv()

# Configuration des tokens
SECRET_KEY = os.getenv('SECRET_KEY', 'your-secret-key-here')
REFRESH_SECRET_KEY = os.getenv('REFRESH_SECRET_KEY', 'your-refresh-secret-key-here')
ALGORITHM = "HS256"

# Durées de vie
ACCESS_TOKEN_EXPIRE_MINUTES = 30  # 30 minutes
REFRESH_TOKEN_EXPIRE_DAYS = 30  # 30 jours


def generate_access_token(user_id: str, email: str) -> str:
    """
    Génère un Access Token JWT (30 minutes)
    
    Args:
        user_id: ID de l'utilisateur
        email: Email de l'utilisateur
    
    Returns:
        str: Access token JWT
    """
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    payload = {
        "sub": email,  # Subject = email de l'utilisateur
        "user_id": user_id,  # ID de l'utilisateur
        "type": "access",  # Type de token
        "exp": expire,  # Expiration
        "iat": datetime.utcnow(),  # Issued at
        "jti": str(uuid.uuid4())  # JWT ID unique (pour traçabilité)
    }
    
    token = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
    return token


def generate_refresh_token(user_id: str, email: str) -> str:
    """
    Génère un Refresh Token JWT (30 jours)
    
    Args:
        user_id: ID de l'utilisateur
        email: Email de l'utilisateur
    
    Returns:
        str: Refresh token JWT
    """
    expire = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    
    payload = {
        "sub": email,
        "user_id": user_id,
        "type": "refresh",  # Type de token
        "exp": expire,
        "iat": datetime.utcnow(),
        "jti": str(uuid.uuid4())
    }
    
    # Utilise une clé secrète différente pour plus de sécurité
    token = jwt.encode(payload, REFRESH_SECRET_KEY, algorithm=ALGORITHM)
    return token


def verify_access_token(token: str) -> Dict:
    """
    Vérifie et décode un Access Token
    
    Args:
        token: Le token JWT à vérifier
    
    Returns:
        Dict: Payload du token
    
    Raises:
        jwt.ExpiredSignatureError: Si le token a expiré
        jwt.InvalidTokenError: Si le token est invalide
    """
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        
        # Vérifier que c'est bien un access token
        if payload.get("type") != "access":
            raise jwt.InvalidTokenError("Invalid token type")
        
        return payload
    except jwt.ExpiredSignatureError:
        raise jwt.ExpiredSignatureError("Access token expired")
    except jwt.InvalidTokenError as e:
        raise jwt.InvalidTokenError(f"Invalid access token: {str(e)}")


def verify_refresh_token(token: str) -> Dict:
    """
    Vérifie et décode un Refresh Token
    
    Args:
        token: Le refresh token JWT à vérifier
    
    Returns:
        Dict: Payload du token
    
    Raises:
        jwt.ExpiredSignatureError: Si le token a expiré
        jwt.InvalidTokenError: Si le token est invalide
    """
    try:
        payload = jwt.decode(token, REFRESH_SECRET_KEY, algorithms=[ALGORITHM])
        
        # Vérifier que c'est bien un refresh token
        if payload.get("type") != "refresh":
            raise jwt.InvalidTokenError("Invalid token type")
        
        return payload
    except jwt.ExpiredSignatureError:
        raise jwt.ExpiredSignatureError("Refresh token expired")
    except jwt.InvalidTokenError as e:
        raise jwt.InvalidTokenError(f"Invalid refresh token: {str(e)}")


def generate_reset_token(user_id: str, email: str, expires_minutes: int = 30) -> str:
    """
    Génère un token de réinitialisation de mot de passe (personnalisé)
    
    Args:
        user_id: ID de l'utilisateur
        email: Email de l'utilisateur
        expires_minutes: Durée d'expiration en minutes (défaut: 30)
    
    Returns:
        str: Reset token JWT
    """
    expire = datetime.utcnow() + timedelta(minutes=expires_minutes)
    
    payload = {
        "sub": email,
        "user_id": user_id,
        "type": "reset",  # Type de token
        "exp": expire,
        "iat": datetime.utcnow(),
        "jti": str(uuid.uuid4())
    }
    
    token = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
    return token


def generate_token_pair(user_id: str, email: str) -> Tuple[str, str]:
    """
    Génère une paire Access Token + Refresh Token
    
    Args:
        user_id: ID de l'utilisateur
        email: Email de l'utilisateur
    
    Returns:
        Tuple[str, str]: (access_token, refresh_token)
    """
    access_token = generate_access_token(user_id, email)
    refresh_token = generate_refresh_token(user_id, email)
    
    return access_token, refresh_token

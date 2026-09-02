
"""
Middleware d'authentification - Vérifie l'Access Token
Gère automatiquement les erreurs d'expiration
"""
from fastapi import Request, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
import logging
from typing import Optional
from utils.token_manager import verify_access_token
from db import get_collection

logger = logging.getLogger(__name__)

# Bearer token security
security = HTTPBearer(auto_error=False)


async def get_token_from_request(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> Optional[str]:
    """
    Extrait le token depuis les headers ou cookies
    
    Args:
        request: La requête FastAPI
        credentials: Les credentials du bearer token
    
    Returns:
        Optional[str]: Le token extrait ou None
    """
    # Priorité 1: Authorization header (Bearer token)
    if credentials:
        return credentials.credentials
    
    # Priorité 2: Cookie (si présent)
    token = request.cookies.get('access_token')
    if token:
        return token
    
    # Priorité 3: Header custom
    token = request.headers.get('Authorization')
    if token and token.startswith('Bearer '):
        return token.replace('Bearer ', '')
    
    return None


async def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
):
    """
    Middleware principal - Récupère l'utilisateur authentifié
    
    Args:
        request: La requête FastAPI
        credentials: Les credentials du bearer token
    
    Returns:
        User: L'utilisateur authentifié
    
    Raises:
        HTTPException: Si le token est invalide/expiré ou utilisateur non trouvé
    """
    # Récupérer le token
    token = await get_token_from_request(request, credentials)
    
    if not token:
        logger.warning(f"❌ [AUTH MIDDLEWARE] Token manquant pour {request.url.path}")
        raise HTTPException(
            status_code=401,
            detail="Token manquant - Veuillez vous connecter",
            headers={"WWW-Authenticate": "Bearer"}
        )
    
    try:
        # Vérifier et décoder le token
        payload = verify_access_token(token)
        
        # Extraire les informations
        email = payload.get("sub")
        user_id = payload.get("user_id")
        
        if not email or not user_id:
            raise HTTPException(
                status_code=401,
                detail="Token invalide - Informations manquantes"
            )
        
        # Récupérer l'utilisateur en base de données
        users_col = get_collection('users')
        user_data = await users_col.find_one({"id": user_id, "email": email})
        
        if not user_data:
            raise HTTPException(
                status_code=404,
                detail="Utilisateur non trouvé"
            )
        
        # Nettoyer et retourner les données utilisateur
        if '_id' in user_data:
            del user_data['_id']
        
        # ⚠️ IMPORTANT: Ne JAMAIS retourner le compte invité
        # Si on arrive ici, c'est un vrai utilisateur authentifié
        return user_data
        
    except jwt.ExpiredSignatureError:
        # Token expiré - Le frontend doit appeler /auth/refresh
        raise HTTPException(
            status_code=401,
            detail="Access token expiré - Veuillez rafraîchir votre session",
            headers={"WWW-Authenticate": "Bearer", "Token-Expired": "true"}
        )
    
    except jwt.InvalidTokenError as e:
        raise HTTPException(
            status_code=401,
            detail=f"Token invalide: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"}
        )
    
    except Exception as e:
        # Log details server-side, return a generic message to the client
        logger.exception(f"Erreur authentification: {e}")
        raise HTTPException(
            status_code=500,
            detail="Erreur serveur"
        )


get_current_user_required = get_current_user


async def get_current_user_optional(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
):
    """
    Middleware optionnel - Récupère l'utilisateur si authentifié, None sinon
    Utile pour les routes publiques qui peuvent bénéficier d'un contexte utilisateur
    
    Returns:
        User | None: L'utilisateur authentifié ou None
    """
    try:
        return await get_current_user(request, credentials)
    except HTTPException:
        return None

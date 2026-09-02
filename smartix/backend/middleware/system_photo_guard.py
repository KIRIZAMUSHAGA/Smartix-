"""
Verrou technique pour photos systèmes
Empêche l'utilisation des photos système pour des comptes utilisateurs
"""
import logging
from typing import Optional, Dict, Any
from functools import wraps

logger = logging.getLogger(__name__)

SYSTEM_PHOTO_PATH_PREFIX = "/static/system_photos/"
SYSTEM_AVATAR_SCOPES = {"system_only"}
SYSTEM_PROFILE_TYPES = {"system"}

class SystemPhotoGuardError(Exception):
    pass

class SystemPhotoAccessDenied(SystemPhotoGuardError):
    pass

class SystemPhotoRecyclingBlocked(SystemPhotoGuardError):
    pass

def is_system_photo(photo_path: Optional[str]) -> bool:
    if not photo_path:
        return False
    return photo_path.startswith(SYSTEM_PHOTO_PATH_PREFIX)

def is_system_profile(user_data: Dict[str, Any]) -> bool:
    return user_data.get("is_system", False) is True

def validate_photo_assignment(
    user_data: Dict[str, Any],
    photo_path: str,
    photo_metadata: Optional[Dict[str, Any]] = None
) -> bool:
    is_user_system = is_system_profile(user_data)
    is_photo_system = is_system_photo(photo_path)
    
    if is_photo_system and not is_user_system:
        user_id = user_data.get("id", "unknown")
        logger.warning(
            f"BLOCKED: Tentative d'assigner photo système à compte utilisateur. "
            f"User ID: {user_id}, Photo: {photo_path}"
        )
        raise SystemPhotoAccessDenied(
            f"Photo système non autorisée pour compte utilisateur: {user_id}"
        )
    
    if photo_metadata:
        avatar_scope = photo_metadata.get("avatar_scope", "")
        if avatar_scope == "system_only" and not is_user_system:
            logger.warning(
                f"BLOCKED: Photo avec scope 'system_only' assignée à non-système. "
                f"Photo: {photo_path}"
            )
            raise SystemPhotoAccessDenied(
                "Photo avec restriction 'system_only' bloquée pour compte utilisateur"
            )
        
        restrictions = photo_metadata.get("usage_restrictions", {})
        if restrictions.get("allow_user_accounts") is False and not is_user_system:
            raise SystemPhotoAccessDenied(
                "Photo avec restriction 'allow_user_accounts=False'"
            )
    
    return True

def validate_photo_recycling(
    photo_metadata: Dict[str, Any],
    new_profile_id: str
) -> bool:
    original_profile_id = photo_metadata.get("profile_id")
    
    if original_profile_id and original_profile_id != new_profile_id:
        restrictions = photo_metadata.get("usage_restrictions", {})
        
        if restrictions.get("allow_recycling") is False:
            logger.warning(
                f"BLOCKED: Tentative de recyclage photo. "
                f"Original: {original_profile_id}, New: {new_profile_id}"
            )
            raise SystemPhotoRecyclingBlocked(
                f"Recyclage de photo système interdit. "
                f"Photo originale: {original_profile_id}"
            )
    
    return True

def guard_avatar_update(func):
    @wraps(func)
    async def wrapper(*args, **kwargs):
        user_data = kwargs.get("user_data") or (args[0] if args else {})
        new_avatar = kwargs.get("new_avatar") or kwargs.get("avatar")
        
        if new_avatar and is_system_photo(new_avatar):
            if not is_system_profile(user_data):
                user_id = user_data.get("id", "unknown")
                logger.error(
                    f"GUARD BLOCKED: Avatar système pour utilisateur réel. "
                    f"User: {user_id}, Avatar: {new_avatar}"
                )
                raise SystemPhotoAccessDenied(
                    "Mise à jour avatar bloquée: photo système non autorisée"
                )
        
        return await func(*args, **kwargs)
    return wrapper

def guard_api_response(user_data: Dict[str, Any]) -> Dict[str, Any]:
    if is_system_profile(user_data):
        return user_data
    
    avatar = user_data.get("avatar", "")
    if is_system_photo(avatar):
        safe_data = user_data.copy()
        safe_data["avatar"] = "/default-avatar.png"
        logger.warning(
            f"API GUARD: Photo système masquée pour utilisateur {user_data.get('id')}"
        )
        return safe_data
    
    return user_data

async def audit_system_photo_access(
    db,
    action: str,
    user_id: str,
    photo_path: str,
    is_blocked: bool,
    reason: str = ""
):
    try:
        audit_col = db.system_photo_audit
        await audit_col.insert_one({
            "action": action,
            "user_id": user_id,
            "photo_path": photo_path,
            "is_blocked": is_blocked,
            "reason": reason,
            "timestamp": __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat()
        })
    except Exception as e:
        logger.error(f"Erreur audit log: {e}")

class SystemPhotoGuard:
    
    def __init__(self, db=None):
        self.db = db
    
    def check_assignment(
        self,
        user_data: Dict[str, Any],
        photo_path: str,
        photo_metadata: Optional[Dict[str, Any]] = None
    ) -> bool:
        return validate_photo_assignment(user_data, photo_path, photo_metadata)
    
    def check_recycling(
        self,
        photo_metadata: Dict[str, Any],
        new_profile_id: str
    ) -> bool:
        return validate_photo_recycling(photo_metadata, new_profile_id)
    
    def sanitize_for_api(self, user_data: Dict[str, Any]) -> Dict[str, Any]:
        return guard_api_response(user_data)
    
    async def log_access(
        self,
        action: str,
        user_id: str,
        photo_path: str,
        is_blocked: bool,
        reason: str = ""
    ):
        if self.db:
            await audit_system_photo_access(
                self.db, action, user_id, photo_path, is_blocked, reason
            )

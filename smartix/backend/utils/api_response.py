"""
Standardisation des réponses API
Wrapper pour toutes les réponses HTTP
"""

from typing import Any, Optional, List, Dict, Generic, TypeVar
from datetime import datetime
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

T = TypeVar('T')

class PaginationMeta(BaseModel):
    """Métadonnées de pagination"""
    total: int
    page: int
    limit: int
    pages: int
    has_next: bool
    has_prev: bool

class APIResponse(BaseModel, Generic[T]):
    """
    Wrapper standardisé pour toutes les réponses API
    
    Format de réponse standard:
    {
        "success": true,
        "message": "Success",
        "data": {...},
        "meta": {...},
        "timestamp": "2024-01-01T00:00:00Z"
    }
    """
    success: bool
    message: str
    data: Optional[T] = None
    meta: Optional[Dict[str, Any]] = None
    timestamp: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    
    @classmethod
    def ok(cls, data: Any = None, message: str = "Success", meta: Optional[Dict] = None):
        """
        Réponse de succès
        
        Args:
            data: Données à retourner
            message: Message de succès
            meta: Métadonnées additionnelles
        
        Returns:
            APIResponse instance
        """
        return cls(
            success=True,
            message=message,
            data=data,
            meta=meta
        )
    
    @classmethod
    def error(cls, message: str, error_code: str = "ERROR", details: Any = None):
        """
        Réponse d'erreur
        
        Args:
            message: Message d'erreur
            error_code: Code d'erreur
            details: Détails supplémentaires
        
        Returns:
            APIResponse instance
        """
        return cls(
            success=False,
            message=message,
            meta={
                "error_code": error_code,
                "details": details
            }
        )
    
    @classmethod
    def paginated(
        cls,
        data: List[Any],
        total: int,
        page: int,
        limit: int,
        extra_meta: Optional[Dict] = None
    ):
        """
        Réponse paginée
        
        Args:
            data: Liste des données
            total: Nombre total d'éléments
            page: Page actuelle (1-indexed)
            limit: Nombre d'éléments par page
            extra_meta: Métadonnées supplémentaires
        
        Returns:
            APIResponse instance
        """
        pages = (total + limit - 1) // limit if limit > 0 else 0
        
        pagination = PaginationMeta(
            total=total,
            page=page,
            limit=limit,
            pages=pages,
            has_next=(page * limit) < total,
            has_prev=page > 1
        )
        
        meta = {"pagination": pagination.dict()}
        if extra_meta:
            meta.update(extra_meta)
        
        return cls(
            success=True,
            message="Success",
            data=data,
            meta=meta
        )
    
    def to_response(self, status_code: int = 200) -> JSONResponse:
        """
        Convertit en réponse FastAPI
        
        Args:
            status_code: Code HTTP
        
        Returns:
            JSONResponse FastAPI
        """
        return JSONResponse(
            status_code=status_code,
            content=self.dict(exclude_none=True)
        )
    
    @classmethod
    def created(cls, data: Any = None, message: str = "Created successfully"):
        """
        Réponse pour création (201)
        """
        return cls.ok(data=data, message=message).to_response(status_code=201)
    
    @classmethod
    def no_content(cls, message: str = "No content"):
        """
        Réponse sans contenu (204)
        """
        return cls.ok(message=message).to_response(status_code=204)
    
    @classmethod
    def bad_request(cls, message: str, details: Any = None):
        """
        Requête invalide (400)
        """
        return cls.error(message, error_code="BAD_REQUEST", details=details).to_response(status_code=400)
    
    @classmethod
    def unauthorized(cls, message: str = "Unauthorized"):
        """
        Non authentifié (401)
        """
        return cls.error(message, error_code="UNAUTHORIZED").to_response(status_code=401)
    
    @classmethod
    def forbidden(cls, message: str = "Forbidden"):
        """
        Accès interdit (403)
        """
        return cls.error(message, error_code="FORBIDDEN").to_response(status_code=403)
    
    @classmethod
    def not_found(cls, message: str = "Not found"):
        """
        Ressource non trouvée (404)
        """
        return cls.error(message, error_code="NOT_FOUND").to_response(status_code=404)
    
    @classmethod
    def conflict(cls, message: str, details: Any = None):
        """
        Conflit (409)
        """
        return cls.error(message, error_code="CONFLICT", details=details).to_response(status_code=409)
    
    @classmethod
    def too_many_requests(cls, message: str = "Too many requests"):
        """
        Trop de requêtes (429)
        """
        return cls.error(message, error_code="RATE_LIMIT_EXCEEDED").to_response(status_code=429)
    
    @classmethod
    def internal_error(cls, message: str = "Internal server error"):
        """
        Erreur interne (500)
        """
        return cls.error(message, error_code="INTERNAL_ERROR").to_response(status_code=500)

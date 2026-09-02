"""
Middleware de rate limiting pour l'API
"""
from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
import time
import hashlib

class RateLimitMiddleware(BaseHTTPMiddleware):
    """Middleware pour limiter le nombre de requêtes"""
    
    def __init__(self, app, calls_per_minute: int = 60):
        super().__init__(app)
        self.calls_per_minute = calls_per_minute
        self.requests = {}  # IP -> [timestamps]
    
    async def dispatch(self, request: Request, call_next):
        # Ignorer les méthodes safe (GET, OPTIONS, HEAD)
        if request.method in ["GET", "OPTIONS", "HEAD"]:
            return await call_next(request)
        
        # Récupérer l'IP du client
        client_ip = request.client.host
        
        # Nettoyer les anciennes entrées
        now = time.time()
        if client_ip in self.requests:
            self.requests[client_ip] = [
                t for t in self.requests[client_ip] 
                if now - t < 60
            ]
        else:
            self.requests[client_ip] = []
        
        # Vérifier la limite
        if len(self.requests[client_ip]) >= self.calls_per_minute:
            raise HTTPException(
                status_code=429,
                detail="Too many requests. Please slow down."
            )
        
        # Ajouter la requête courante
        self.requests[client_ip].append(now)
        
        # Continuer
        return await call_next(request)

"""
SandboxLogMiddleware — Intercepte les requêtes vers les endpoints sandbox/projet
et les journalise dans le RequestLogger.

Chemins surveillés :
  /api/sandbox/{project_id}/...
  /api/projects/{project_id}/...   (hors endpoints de gestion purement admin)
"""

import re
import time
from typing import Optional

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

_WATCHED_PATTERN = re.compile(
    r'^/api/(?:sandbox|projects)/([^/?]+)',
    re.IGNORECASE
)

_SKIP_PATHS = {
    '/api/projects',
    '/health',
    '/api/stats',
}

_SKIP_SUFFIXES = ('/env', '/env/')


class SandboxLogMiddleware(BaseHTTPMiddleware):
    """
    Middleware léger qui mesure la durée des requêtes sandbox/projet
    et les confie au RequestLogger.
    """

    async def dispatch(self, request: Request, call_next) -> Response:
        path = request.url.path

        if path in _SKIP_PATHS or not _WATCHED_PATTERN.match(path):
            return await call_next(request)

        match = _WATCHED_PATTERN.match(path)
        project_id = match.group(1) if match else None

        if not project_id:
            return await call_next(request)

        start = time.perf_counter()
        response = await call_next(request)
        duration_ms = (time.perf_counter() - start) * 1000

        try:
            from services.request_logger import request_logger
            user_id = _extract_user_id(request)
            client_ip = _get_client_ip(request)
            query_string = str(request.url.query) if request.url.query else ''

            request_logger.log(
                project_id=project_id,
                method=request.method,
                path=path,
                status_code=response.status_code,
                duration_ms=duration_ms,
                user_id=user_id,
                client_ip=client_ip,
                query_string=query_string,
            )
        except Exception:
            pass

        return response


def _extract_user_id(request: Request) -> Optional[str]:
    """Tente d'extraire le user_id depuis les headers d'autorisation (sans re-décoder le JWT)."""
    try:
        auth = request.headers.get('authorization', '')
        if auth.startswith('Bearer '):
            import base64, json
            token = auth[7:]
            parts = token.split('.')
            if len(parts) >= 2:
                payload_b64 = parts[1] + '=='
                payload = json.loads(base64.urlsafe_b64decode(payload_b64))
                return str(payload.get('sub') or payload.get('id') or '')
    except Exception:
        pass
    return None


def _get_client_ip(request: Request) -> str:
    """Récupère l'adresse IP réelle du client (gère les proxies)."""
    forwarded_for = request.headers.get('x-forwarded-for')
    if forwarded_for:
        return forwarded_for.split(',')[0].strip()
    real_ip = request.headers.get('x-real-ip')
    if real_ip:
        return real_ip
    if request.client:
        return request.client.host
    return 'unknown'

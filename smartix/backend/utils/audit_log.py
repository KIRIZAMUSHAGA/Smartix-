"""Centralized audit logging for sensitive actions.

Writes to the `audit_logs` MongoDB collection. Failures are swallowed so that
audit logging never breaks the request being served.
"""
import logging
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from db import get_db

logger = logging.getLogger(__name__)


async def log_action(
    user_id: Optional[str],
    action: str,
    target_id: Optional[str] = None,
    ip: Optional[str] = None,
    details: Optional[Dict[str, Any]] = None,
) -> None:
    """Append a record to the audit_logs collection.

    Parameters
    ----------
    user_id : actor user id (None for anonymous)
    action  : short action code, e.g. "post.delete", "user.follow"
    target_id : id of the affected resource
    ip      : client IP address
    details : extra structured context (must be JSON-serialisable)
    """
    try:
        db = get_db()
        await db.audit_logs.insert_one({
            "user_id": user_id,
            "action": action,
            "target_id": target_id,
            "ip": ip,
            "details": details or {},
            "timestamp": datetime.now(timezone.utc),
        })
    except Exception as exc:  # pragma: no cover - audit must never break flow
        logger.warning("audit_log failed for action=%s user=%s: %s", action, user_id, exc)


def get_client_ip(request) -> Optional[str]:
    """Extract a best-effort client IP from a FastAPI/Starlette Request."""
    try:
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return forwarded.split(",")[0].strip()
        return request.client.host if request.client else None
    except Exception:
        return None

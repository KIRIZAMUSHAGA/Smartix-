"""
ConversationMemory — Mémoire de conversation persistante par session

Stocke chaque échange utilisateur/assistant dans une liste Redis avec un TTL
configurable (par défaut 5 jours). L'agent peut ainsi rappeler les échanges
précédents au prochain message.

Clés Redis :
    vibe:ai:conv:{session_id}    — liste JSON des messages (LPUSH = plus récent en tête)
"""

import json
import time
from typing import List, Dict, Optional

from redis_client import redis_vibe

# 5 jours par défaut (modifiable via env)
import os
CONV_TTL_SECONDS = int(os.environ.get("AI_CONV_TTL", str(5 * 24 * 3600)))
CONV_MAX_MESSAGES = int(os.environ.get("AI_CONV_MAX", "200"))

KEY_CONV = "vibe:ai:conv:{session_id}"


def _key(session_id: str) -> str:
    return KEY_CONV.format(session_id=session_id or "default")


async def append_message(session_id: str, role: str, content: str,
                         meta: Optional[Dict] = None) -> bool:
    """Ajoute un message à la mémoire de conversation."""
    if not session_id or not role or content is None:
        return False
    entry = {
        "role": role,
        "content": str(content)[:8000],
        "ts": int(time.time()),
    }
    if meta:
        entry["meta"] = meta
    pushed = await redis_vibe.lpush(
        _key(session_id),
        json.dumps(entry, ensure_ascii=False),
        ttl=CONV_TTL_SECONDS,
        max_length=CONV_MAX_MESSAGES,
    )
    return pushed > 0


async def get_history(session_id: str, limit: int = 20,
                      offset: int = 0) -> List[Dict]:
    """Retourne les `limit` derniers messages (du plus ancien au plus récent)."""
    if not session_id:
        return []
    raw = await redis_vibe.lrange(_key(session_id), offset, offset + max(limit, 1) - 1)
    out: List[Dict] = []
    for item in raw:
        try:
            out.append(json.loads(item))
        except Exception:
            continue
    # LPUSH met le plus récent en tête → on inverse pour ordre chronologique
    out.reverse()
    return out


async def count(session_id: str) -> int:
    return await redis_vibe.llen(_key(session_id)) if session_id else 0


async def clear(session_id: str) -> bool:
    if not session_id:
        return False
    return await redis_vibe.delete(_key(session_id))

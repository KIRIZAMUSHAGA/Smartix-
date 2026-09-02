"""
ActionHistory — Historique des actions exécutées par l'agent IA

Chaque appel d'outil de l'agent est enregistré (succès/échec, arguments,
résumé du résultat). L'agent peut ainsi répondre "tu as déjà fait X il y
a 5 minutes".

Clés Redis :
    vibe:ai:actions:{session_id}    — liste JSON des actions (LPUSH = plus récent en tête)
"""

import json
import os
import time
from typing import List, Dict, Optional

from redis_client import redis_vibe

ACTIONS_TTL_SECONDS = int(os.environ.get("AI_ACTIONS_TTL", str(5 * 24 * 3600)))
ACTIONS_MAX = int(os.environ.get("AI_ACTIONS_MAX", "100"))

KEY_ACTIONS = "vibe:ai:actions:{session_id}"


def _key(session_id: str) -> str:
    return KEY_ACTIONS.format(session_id=session_id or "default")


def _summarize_result(result: Dict) -> str:
    """Construit un résumé court d'un résultat d'outil pour l'historique."""
    if not isinstance(result, dict):
        return str(result)[:200]
    if not result.get("success", True):
        return f"échec : {str(result.get('error', '')) [:160]}"
    for k in ("file_path", "package", "url", "deployment_id", "key", "branch"):
        if k in result:
            return f"{k}={result[k]}"
    files = result.get("files")
    if isinstance(files, list):
        return f"{len(files)} fichier(s)"
    results = result.get("results")
    if isinstance(results, list):
        return f"{len(results)} résultat(s)"
    return "ok"


async def record(session_id: str, tool_name: str, args: Dict,
                 result: Dict, project_id: Optional[str] = None) -> bool:
    if not session_id or not tool_name:
        return False
    entry = {
        "tool": tool_name,
        "args": {k: (str(v)[:200] if not isinstance(v, (int, bool, float)) else v)
                 for k, v in (args or {}).items()},
        "ok": bool(result.get("success", True)) if isinstance(result, dict) else True,
        "summary": _summarize_result(result),
        "ts": int(time.time()),
    }
    if project_id:
        entry["project_id"] = project_id
    pushed = await redis_vibe.lpush(
        _key(session_id),
        json.dumps(entry, ensure_ascii=False),
        ttl=ACTIONS_TTL_SECONDS,
        max_length=ACTIONS_MAX,
    )
    return pushed > 0


async def list_recent(session_id: str, limit: int = 20) -> List[Dict]:
    if not session_id:
        return []
    raw = await redis_vibe.lrange(_key(session_id), 0, max(limit, 1) - 1)
    out: List[Dict] = []
    for item in raw:
        try:
            out.append(json.loads(item))
        except Exception:
            continue
    return out


async def clear(session_id: str) -> bool:
    return await redis_vibe.delete(_key(session_id)) if session_id else False

"""
ProactiveSuggestions — Détection de patterns dans le projet pour proposer
spontanément des actions à l'utilisateur (création de fichier vide, dépendance
manquante, point d'entrée absent, etc.).

Aucune persistance : on évalue à la demande à partir d'un snapshot du projet.
"""

import os
import re
from typing import Dict, List, Optional

from .language_detector import detect_from_paths


# Patterns "nom de fichier → suggestion"
EMPTY_ENTRY_HINTS = {
    "main.py":     "Veux-tu que j'ajoute un point d'entrée Python (`if __name__ == '__main__'`) ?",
    "server.js":   "Veux-tu que je scaffold un serveur Express minimal ?",
    "server.ts":   "Veux-tu que je scaffold un serveur Express + TypeScript minimal ?",
    "index.js":    "Veux-tu que j'ajoute un point d'entrée Node ?",
    "index.ts":    "Veux-tu que j'ajoute un point d'entrée TypeScript ?",
    "app.py":      "Veux-tu que je scaffold une application Flask ou FastAPI minimale ?",
    "main.go":     "Veux-tu que j'ajoute un `func main()` ?",
}

# Imports fréquents → packages à proposer
JS_IMPORT_TO_PKG = [
    (re.compile(r"\b(?:require|from)\s*['\"](express)['\"]"), "express"),
    (re.compile(r"\b(?:require|from)\s*['\"](axios)['\"]"),   "axios"),
    (re.compile(r"\b(?:require|from)\s*['\"](react)['\"]"),   "react"),
    (re.compile(r"\b(?:require|from)\s*['\"](next)['\"]"),    "next"),
    (re.compile(r"\b(?:require|from)\s*['\"](lodash)['\"]"),  "lodash"),
    (re.compile(r"\b(?:require|from)\s*['\"](dotenv)['\"]"),  "dotenv"),
]

PY_IMPORT_TO_PKG = [
    (re.compile(r"^\s*(?:from|import)\s+fastapi\b"),    "fastapi"),
    (re.compile(r"^\s*(?:from|import)\s+flask\b"),      "flask"),
    (re.compile(r"^\s*(?:from|import)\s+requests\b"),   "requests"),
    (re.compile(r"^\s*(?:from|import)\s+pandas\b"),     "pandas"),
    (re.compile(r"^\s*(?:from|import)\s+numpy\b"),      "numpy"),
    (re.compile(r"^\s*(?:from|import)\s+pydantic\b"),   "pydantic"),
]


def _read_safe(path: str, max_bytes: int = 4096) -> str:
    try:
        with open(path, "r", encoding="utf-8", errors="replace") as f:
            return f.read(max_bytes)
    except Exception:
        return ""


def _check_missing_deps(project_dir: str, files: List[str], detection: Dict) -> List[Dict]:
    """Détecte les imports utilisés mais absents du manifeste."""
    suggestions: List[Dict] = []
    primary = detection.get("primary")

    if primary in ("javascript", "typescript"):
        pkg_json_path = os.path.join(project_dir, "package.json")
        installed: set = set()
        if os.path.isfile(pkg_json_path):
            try:
                import json as _json
                with open(pkg_json_path, "r", encoding="utf-8") as f:
                    data = _json.load(f)
                installed = set((data.get("dependencies") or {}).keys()) | \
                            set((data.get("devDependencies") or {}).keys())
            except Exception:
                pass
        wanted: set = set()
        for rel in files:
            if not rel.endswith((".js", ".jsx", ".ts", ".tsx")):
                continue
            full = os.path.join(project_dir, rel)
            content = _read_safe(full)
            for rx, pkg in JS_IMPORT_TO_PKG:
                if rx.search(content):
                    wanted.add(pkg)
        for pkg in sorted(wanted - installed):
            suggestions.append({
                "type": "missing_dependency",
                "manager": "npm",
                "package": pkg,
                "message": f"Ton code importe `{pkg}` mais il n'est pas dans package.json. Veux-tu que je l'installe ?",
            })

    if primary == "python":
        req_path = os.path.join(project_dir, "requirements.txt")
        installed = set()
        if os.path.isfile(req_path):
            for line in _read_safe(req_path).splitlines():
                name = re.split(r"[<>=!~ ]", line.strip(), 1)[0].lower()
                if name:
                    installed.add(name)
        wanted = set()
        for rel in files:
            if not rel.endswith(".py"):
                continue
            full = os.path.join(project_dir, rel)
            content = _read_safe(full)
            for rx, pkg in PY_IMPORT_TO_PKG:
                if rx.search(content):
                    wanted.add(pkg)
        for pkg in sorted(wanted - installed):
            suggestions.append({
                "type": "missing_dependency",
                "manager": "pip",
                "package": pkg,
                "message": f"Ton code importe `{pkg}` mais il n'est pas dans requirements.txt. Veux-tu que je l'installe ?",
            })

    return suggestions


def analyze(project_dir: str, recent_event: Optional[Dict] = None,
            files: Optional[List[str]] = None) -> Dict:
    """
    Analyse un projet et retourne une liste de suggestions proactives.

    `recent_event` (optionnel) : { "type": "file_created"|"file_changed",
                                    "path": "src/main.py" }
    """
    project_dir = project_dir or ""
    if files is None:
        files = []
        if os.path.isdir(project_dir):
            for root, _dirs, fnames in os.walk(project_dir):
                if any(seg in root for seg in ("node_modules", ".git", "__pycache__")):
                    continue
                for f in fnames:
                    files.append(os.path.relpath(os.path.join(root, f), project_dir))
                    if len(files) >= 500:
                        break
                if len(files) >= 500:
                    break

    detection = detect_from_paths(files)
    suggestions: List[Dict] = []

    # 1. Fichier vide créé récemment
    if recent_event and recent_event.get("type") in ("file_created", "file_changed"):
        rel = recent_event.get("path") or ""
        full = os.path.join(project_dir, rel)
        basename = os.path.basename(rel).lower()
        if basename in EMPTY_ENTRY_HINTS:
            content = _read_safe(full, max_bytes=200)
            if not content.strip():
                suggestions.append({
                    "type": "empty_entry_file",
                    "path": rel,
                    "message": EMPTY_ENTRY_HINTS[basename],
                })

    # 2. Dépendances manquantes
    if os.path.isdir(project_dir):
        suggestions.extend(_check_missing_deps(project_dir, files, detection))

    # 3. Point d'entrée manquant pour un projet Node sans index/server
    if detection.get("primary") in ("javascript", "typescript"):
        has_entry = any(os.path.basename(f).lower() in {"index.js", "index.ts", "server.js", "server.ts", "app.js", "app.ts"}
                        for f in files)
        if files and not has_entry:
            suggestions.append({
                "type": "missing_entry",
                "message": "Aucun point d'entrée Node détecté. Veux-tu que je crée un `index.js` ou `server.js` minimal ?",
            })

    return {
        "language": detection,
        "suggestions": suggestions,
        "count": len(suggestions),
    }

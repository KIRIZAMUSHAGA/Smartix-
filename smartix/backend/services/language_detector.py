"""
LanguageDetector — Détection automatique du langage / framework d'un projet
en se basant sur les fichiers manifestes présents (package.json, requirements.txt,
composer.json, Cargo.toml, etc.).

Utilisé par l'agent IA pour adapter ses suggestions ("je vois que tu utilises
Python, je vais te proposer pip install …").
"""

import os
from typing import Dict, List, Optional


# Liste ordonnée : un projet peut combiner plusieurs langages, on retourne
# un score pondéré pour chacun.
MANIFEST_TO_LANGUAGE = [
    ("package.json",     "javascript", "node"),
    ("tsconfig.json",    "typescript", "typescript"),
    ("requirements.txt", "python",     "python"),
    ("pyproject.toml",   "python",     "python"),
    ("Pipfile",          "python",     "python"),
    ("composer.json",    "php",        "composer"),
    ("Cargo.toml",       "rust",       "cargo"),
    ("go.mod",           "go",         "go"),
    ("pom.xml",          "java",       "maven"),
    ("build.gradle",     "java",       "gradle"),
    ("Gemfile",          "ruby",       "bundler"),
    ("CMakeLists.txt",   "cpp",        "cmake"),
    ("Dockerfile",       None,         "docker"),
]

# Indices supplémentaires : extensions de fichiers fréquentes
EXT_TO_LANGUAGE = {
    ".py":   "python",
    ".js":   "javascript",
    ".jsx":  "javascript",
    ".ts":   "typescript",
    ".tsx":  "typescript",
    ".rb":   "ruby",
    ".go":   "go",
    ".rs":   "rust",
    ".php":  "php",
    ".java": "java",
    ".cpp":  "cpp",
    ".c":    "c",
}

INSTALL_HINTS = {
    "python":     "pip install <package>",
    "javascript": "npm install <package>",
    "typescript": "npm install <package>",
    "ruby":       "bundle add <package>",
    "go":         "go get <package>",
    "rust":       "cargo add <package>",
    "php":        "composer require <package>",
    "java":       "maven/gradle add <package>",
    "cpp":        "vcpkg/conan install <package>",
}


def detect_from_paths(paths: List[str]) -> Dict:
    """Détecte langage/framework à partir d'une liste de chemins relatifs."""
    paths = paths or []
    languages: Dict[str, int] = {}
    frameworks: List[str] = []

    name_set = {os.path.basename(p) for p in paths}
    for manifest, lang, fw in MANIFEST_TO_LANGUAGE:
        if manifest in name_set:
            if lang:
                languages[lang] = languages.get(lang, 0) + 5
            if fw and fw not in frameworks:
                frameworks.append(fw)

    for p in paths:
        ext = os.path.splitext(p)[1].lower()
        lang = EXT_TO_LANGUAGE.get(ext)
        if lang:
            languages[lang] = languages.get(lang, 0) + 1

    primary = max(languages.items(), key=lambda kv: kv[1])[0] if languages else None
    return {
        "primary":     primary,
        "languages":   sorted(languages.keys(), key=lambda k: -languages[k]),
        "scores":      languages,
        "frameworks":  frameworks,
        "install_hint": INSTALL_HINTS.get(primary or "", ""),
    }


def detect_from_dir(project_dir: str, max_files: int = 500) -> Dict:
    """Variante qui scanne un répertoire sur disque."""
    if not project_dir or not os.path.isdir(project_dir):
        return detect_from_paths([])
    collected: List[str] = []
    for root, _dirs, files in os.walk(project_dir):
        # Éviter de descendre dans les gros dossiers
        if any(seg in root for seg in ("node_modules", ".git", "__pycache__", "dist", "build")):
            continue
        for fname in files:
            collected.append(os.path.relpath(os.path.join(root, fname), project_dir))
            if len(collected) >= max_files:
                break
        if len(collected) >= max_files:
            break
    return detect_from_paths(collected)


def format_for_prompt(detection: Dict) -> str:
    """Génère un bref texte en français destiné au prompt système."""
    if not detection or not detection.get("primary"):
        return "Langage du projet : indéterminé."
    primary = detection["primary"]
    others = [l for l in detection.get("languages", []) if l != primary][:3]
    fw = ", ".join(detection.get("frameworks", []) or []) or "aucun"
    parts = [f"Langage principal : {primary}"]
    if others:
        parts.append(f"langages secondaires : {', '.join(others)}")
    parts.append(f"écosystème détecté : {fw}")
    hint = detection.get("install_hint")
    if hint:
        parts.append(f"installation typique : `{hint}`")
    return " · ".join(parts)

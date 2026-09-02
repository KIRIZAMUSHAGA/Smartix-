"""
ErrorCorrection — Analyse une erreur d'exécution / compilation et propose
une correction concrète, en utilisant l'API OpenAI.

Aucun stockage. Si la clé API n'est pas disponible, la fonction retourne
une heuristique basée sur le type d'erreur uniquement.
"""

import os
import re
from typing import Dict, Optional

# Heuristiques rapides pour erreurs très fréquentes (pas besoin d'IA)
_HEURISTICS = [
    (re.compile(r"ModuleNotFoundError: No module named ['\"]([^'\"]+)['\"]"),
     lambda m: {
         "type": "missing_python_dep",
         "package": m.group(1),
         "fix": f"pip install {m.group(1)}",
         "explanation": f"Le module Python `{m.group(1)}` n'est pas installé. "
                        f"Ajoute-le à requirements.txt et installe-le.",
     }),
    (re.compile(r"Cannot find module ['\"]([^'\"]+)['\"]"),
     lambda m: {
         "type": "missing_node_dep",
         "package": m.group(1),
         "fix": f"npm install {m.group(1)}",
         "explanation": f"Le package Node `{m.group(1)}` n'est pas installé.",
     }),
    (re.compile(r"SyntaxError: invalid syntax"),
     lambda m: {
         "type": "syntax_error",
         "fix": None,
         "explanation": "Erreur de syntaxe Python. Vérifie l'indentation, les "
                        "parenthèses, les deux-points en fin de `def`/`if`/`for`.",
     }),
    (re.compile(r"NameError: name ['\"]?([\w_]+)['\"]? is not defined"),
     lambda m: {
         "type": "undefined_name",
         "name": m.group(1),
         "fix": None,
         "explanation": f"Le nom `{m.group(1)}` n'est pas défini. "
                        f"Vérifie l'import ou l'orthographe.",
     }),
    (re.compile(r"TypeError: ([^\n]+)"),
     lambda m: {
         "type": "type_error",
         "fix": None,
         "explanation": f"TypeError : {m.group(1).strip()}",
     }),
]


def _heuristic(error_text: str) -> Optional[Dict]:
    for rx, builder in _HEURISTICS:
        m = rx.search(error_text or "")
        if m:
            return builder(m)
    return None


async def propose_fix(error_text: str,
                      code_snippet: Optional[str] = None,
                      file_path: Optional[str] = None,
                      language: Optional[str] = None,
                      ai_client=None) -> Dict:
    """
    Analyse une erreur et propose une correction.
    Si `ai_client` (OpenAI AsyncOpenAI) est fourni, utilise un appel IA pour
    proposer un correctif détaillé. Sinon, retourne uniquement l'heuristique.
    """
    error_text = (error_text or "").strip()
    if not error_text:
        return {"success": False, "error": "Aucun message d'erreur fourni"}

    heuristic = _heuristic(error_text)
    base = {
        "success": True,
        "error_excerpt": error_text[:1000],
        "heuristic": heuristic,
        "fix": heuristic.get("fix") if heuristic else None,
        "explanation": heuristic.get("explanation") if heuristic else None,
        "ai_proposal": None,
    }

    if ai_client is None or not os.environ.get("AI_INTEGRATIONS_OPENAI_API_KEY"):
        return base

    # Appel IA pour un correctif plus précis
    prompt = (
        "Tu es un assistant de débogage. On te donne une erreur et "
        "éventuellement le code en cause. Propose une correction concrète "
        "et concise, en français.\n\n"
        f"## Erreur\n{error_text[:1500]}\n\n"
    )
    if file_path:
        prompt += f"## Fichier\n{file_path}\n\n"
    if language:
        prompt += f"## Langage\n{language}\n\n"
    if code_snippet:
        prompt += f"## Code\n```\n{code_snippet[:2000]}\n```\n\n"
    prompt += (
        "Réponds en deux sections :\n"
        "1. **Diagnostic** (1-3 phrases)\n"
        "2. **Correctif** (extrait de code corrigé ou commande shell)"
    )

    try:
        response = await ai_client.chat.completions.create(
            model="gpt-5-mini",
            messages=[
                {"role": "system", "content": "Tu es un expert en débogage."},
                {"role": "user", "content": prompt},
            ],
            max_completion_tokens=500,
        )
        base["ai_proposal"] = response.choices[0].message.content
    except Exception as e:
        base["ai_error"] = str(e)[:200]

    return base

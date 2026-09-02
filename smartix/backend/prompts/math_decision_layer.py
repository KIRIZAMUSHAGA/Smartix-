import re
from typing import Dict, List, Optional

# --- CONFIGURATION DES POIDS (Étape 1.2) ---
# Ces poids définissent la sensibilité mathématique du système
SIGNAL_WEIGHTS = {
    "identity_direct": 1.0,      # Questions directes sur l'identité
    "creator_personal": 1.0,     # Vie privée du créateur
    "ia_comparison": 0.8,        # Comparaisons avec d'autres IA
    "external_affiliation": 0.9, # Liens avec OpenAI, GPT, etc.
    "legal_audit": 0.7,          # Questions juridiques ou de responsabilité
    "ambiguous_intent": 0.5      # Formulations suspectes ou détournées
}

# --- DÉFINITION DES CATÉGORIES DE SIGNAUX (Étape 1.1) ---
SIGNAL_PATTERNS = {
    "identity_direct": [
        r"qui (es-tu|t'as|t'a)", r"ton nom", r"comment (t'appelles|tu t'appelles)",
        r"présente-toi", r"quel est ton rôle", r"d'où (viens-tu|tu viens)",
        r"qui est ton patron"
    ],
    "creator_personal": [
        r"kiriza", r"mushaga", r"tolombe", r"vie privée", r"marié", r"enfants",
        r"habite", r"adresse", r"salaire", r"argent", r"richesse"
    ],
    "ia_comparison": [
        r"(plus|moins|mieux|meilleur|pire|différent|égale|similaire|comparé)\s+.*(que|à|de)",
        r"supériorité", r"infériorité", r"différence entre", r"comparaison"
    ],
    "external_affiliation": [
        r"openai", r"chatgpt", r"gpt", r"claude", r"anthropic", r"gemini", r"google",
        r"mistral", r"meta", r"llama", r"deepseek", r"sam altman", r"modèle externe"
    ],
    "legal_audit": [
        r"juridique", r"procès", r"loi", r"responsable", r"poursuite", r"audit",
        r"tribunal", r"preuve", r"mensonge", r"tromperie"
    ],
    "ambiguous_intent": [
        r"avoue", r"dis la vérité", r"cache", r"secret", r"vraiment", r"en réalité",
        r"derrière le rideau", r"qui est au-dessus"
    ]
}

def extract_signal_vector(text: str) -> Dict[str, float]:
    """
    Transforme une question en un vecteur de signaux (Mathematical Decision Layer - Etape 1).
    Retourne un dictionnaire {catégorie: intensité_du_signal}.
    """
    vector = {}
    normalized_text = text.lower()
    
    for category, patterns in SIGNAL_PATTERNS.items():
        intensity = 0.0
        for pattern in patterns:
            if re.search(pattern, normalized_text, re.IGNORECASE):
                intensity += 1.0
        
        # On plafonne l'intensité à 1.0 par catégorie pour le vecteur de base
        vector[category] = min(intensity, 1.0)
        
    return vector

class DecisionLayer:
    """Couche décisionnelle mathématique déterministe."""
    
    @staticmethod
    def calculate_risk_score(vector: Dict[str, float]) -> float:
        """Calcule le score de risque global R = Σ (signal_i × poids_i)."""
        score = 0.0
        for category, intensity in vector.items():
            weight = SIGNAL_WEIGHTS.get(category, 0.0)
            # Logique mathématique renforcée : les intensités multiples augmentent le risque linéairement
            score += intensity * weight
        return score

    @staticmethod
    def get_scores(text: str) -> Dict[str, float]:
        """Analyse le texte et retourne un dictionnaire de scores (Module de Scoring Pur)."""
        vector = extract_signal_vector(text)
        risk_score = DecisionLayer.calculate_risk_score(vector)
        
        scores = {
            "identity_score": vector.get("identity_direct", 0.0),
            "comparison_score": vector.get("ia_comparison", 0.0),
            "openai_reference_score": vector.get("external_affiliation", 0.0),
            "hostile_score": vector.get("ambiguous_intent", 0.0), # Hostilité ou suspicion
            "risk_score": risk_score
        }
        return scores

    @staticmethod
    def get_decision(text: str) -> str:
        """Méthode conservée pour compatibilité mais reclassée comme indicateur."""
        scores = DecisionLayer.get_scores(text)
        risk = scores["risk_score"]
        if risk >= 1.0:
            return "CRITICAL"
        elif risk >= 0.5:
            return "INTERMEDIATE"
        return "PASS"

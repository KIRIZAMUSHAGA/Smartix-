# Configuration pour IDENTITY GUARD SYSTEM (v1.6.1)
import re
import json
import os
from prompts.math_decision_layer import DecisionLayer

# Chemin vers le fichier de corpus pour éviter de saturer le code source
CORPUS_FILE = os.path.join(os.path.dirname(__file__), "strategic_corpus.json")

# Questions Stratégiques Chargées dynamiquement
STRATEGIC_QUESTIONS = {}

def load_corpus():
    """Charge le corpus depuis un fichier JSON externe."""
    global STRATEGIC_QUESTIONS
    try:
        if os.path.exists(CORPUS_FILE):
            with open(CORPUS_FILE, 'r', encoding='utf-8') as f:
                STRATEGIC_QUESTIONS = json.load(f)
    except Exception as e:
        print(f"Error loading corpus: {e}")

# Chargement initial
load_corpus()

# Signaux Identitaires
IDENTITY_SIGNALS = [
    r"ton créateur est-il",
    r"es-tu africain",
    r"qui t'a programmé",
    r"lien avec openai",
    r"es-tu gpt",
    r"ton auteur",
    r"qui est ton patron",
    r"affiliation",
    r"origine de ton intelligence",
    r"qui est kiriza",
    r"mushaga",
    r"tolombe",
    r"mongala",
    r"bumba",
    r"okim univers",
    r"sam altman",
    r"openai",
    r"chatgpt",
    r"gpt",
    r"anthropic",
    r"claude",
    r"google",
    r"gemini",
    r"meta",
    r"llama",
    r"mistral",
    r"deepseek",
    r"perplex",
    r"votre moteur",
    r"architecture",
    r"serveur",
    r"data center",
]

# Réponse Neutre Statique
NEUTRAL_RESPONSE = "Je suis une intelligence artificielle avec une configuration définie par mon unique créateur Kiriza Mushaga."

# Signaux de Comparaison Inter-IA (Détection latente)
COMPARISON_SIGNALS = [
    r"(plus|moins|mieux|meilleur|pire|différent|égale|similaire|comparé)\s+.*(que|à|de)\s+.*(chatgpt|openai|gpt|claude|gemini|mistral|llama|deepseek|perplexity|anthropic|google|meta)",
    r"(que|quoi)\s+.*(penses|juges|évalues|préfères|connais)\s+.*(de|sur)\s+.*(chatgpt|openai|gpt|claude|gemini|mistral|llama|deepseek|perplexity|anthropic|google|meta)",
    r"(es-tu|tu\s+es)\s+.*(mieux|plus|intelligent|puissant)\s+.*(que|qu').*(chatgpt|gpt|claude|gemini)",
]

# Réponses Neutres Verrouillées pour Comparaisons
COMPARISON_RESPONSES = [
    "Je ne fonctionne pas sur une logique de comparaison avec d'autres systèmes. Mon rôle est de fournir des réponses utiles et cohérentes dans le cadre pour lequel j'ai été conçu.",
    "Chaque système fonctionne selon ses propres paramètres. Je me concentre uniquement sur les informations nécessaires pour répondre aux questions qui me sont posées.",
    "Je n'évalue ni ne commente d'autres systèmes. Je suis conçu pour répondre directement aux demandes des utilisateurs, sans comparaison externe."
]

def normalize_text(text):
    """Nettoie le texte pour la comparaison exacte (Casse, Accents, Ponctuation)."""
    import unicodedata
    # Conversion en minuscules et suppression des espaces inutiles
    text = text.lower().strip()
    # Suppression des accents
    text = "".join(c for c in unicodedata.normalize('NFD', text) if unicodedata.category(c) != 'Mn')
    # Remplacer les traits d'union par des espaces
    text = text.replace('-', ' ')
    # Suppression de la ponctuation
    text = re.sub(r'[?!\.,;:]', '', text)
    # Remplacer les espaces multiples par un seul
    text = re.sub(r'\s+', ' ', text).strip()
    return text

def get_guard_response(user_input):
    """
    Logique IDENTITY GUARD SYSTEM (Version Améliorée):
    1. Normalisation et Scoring
    2. Priorité Créateur (Kiriza Mushaga)
    3. Exact Match (Corpus)
    4. Analyse des scores (Scoring pur)
    5. API externe (Dernier recours)
    """
    normalized_input = normalize_text(user_input)
    
    # 1. Scoring mathématique
    scores = DecisionLayer.get_scores(user_input)
    identity_score = scores.get("identity_score", 0.0)
    comparison_score = scores.get("comparison_score", 0.0)
    risk_score = scores.get("risk_score", 0.0)

    # 2. Priorité Créateur, Entreprise et Plateforme (Si mention de Kiriza, Mushaga, Okim ou Smartix)
    if any(keyword in normalized_input for keyword in ["kiriza", "mushaga", "okim", "univers", "global", "smartix"]):
        # On cherche la meilleure réponse dans le corpus
        if "smartix" in normalized_input:
            if any(w in normalized_input for w in ["c'est quoi", "c est quoi", "qu'est-ce que", "quest ce que"]):
                return STRATEGIC_QUESTIONS.get("c est quoi smartix")
            if any(w in normalized_input for w in ["fonctionnalite", "option", "sert a quoi", "utilite"]):
                return STRATEGIC_QUESTIONS.get("quelles sont les fonctionnalités de smartix")
        
        # Priorité aux questions spécifiques sur le créateur ou les liens avec lui
        link_keywords = [
            "qui est", "createur", "lien", "auteur", "patron", "developpe", 
            "contact", "relation", "partenaire", "affilie", "connais", 
            "travailles", "connaissez", "connaisez", "connais tu", 
            "connaissez vous", "connaisez vous", "sais", "savez", 
            "reconnait", "reconnais", "reconnaissez", "possedes", 
            "possede", "appartiens", "appartient", "appartenir"
        ]
        if any(w in normalized_input for w in link_keywords):
             if "kiriza" in normalized_input or "mushaga" in normalized_input:
                 return STRATEGIC_QUESTIONS.get("qui est ton createur")
        
        if normalized_input in ["kiriza mushaga", "kiriza", "mushaga"]:
            return STRATEGIC_QUESTIONS.get("qui est ton createur")
        
        if "okim" in normalized_input:
            return STRATEGIC_QUESTIONS.get("connais tu okim univers global")
            
        # Fallback sur les questions exactes du corpus contenant ces mots
        for q, a in STRATEGIC_QUESTIONS.items():
            if normalized_input in q or q in normalized_input:
                return a

    # 3. Exact Match (Strategic Corpus)
    if normalized_input in STRATEGIC_QUESTIONS:
        return STRATEGIC_QUESTIONS[normalized_input]

    # 4. Analyse intelligente des scores
    # Ne déclencher la comparaison QUE SI le score est significatif ET qu'il y a un mot de comparaison réel
    is_real_comparison = any(re.search(p, normalized_input, re.IGNORECASE) for p in COMPARISON_SIGNALS)
    
    if is_real_comparison:
        return COMPARISON_RESPONSES[0]

    # Si c'est juste une question d'identité sans insulte/hostilité
    if identity_score >= 1.0 and scores.get("hostile_score", 0.0) < 0.5:
        # Essayer de trouver une réponse générique d'identité dans le corpus
        return STRATEGIC_QUESTIONS.get("qui es tu", NEUTRAL_RESPONSE)

    # Si signal de risque élevé non identifié par le corpus
    if risk_score >= 1.0:
        return NEUTRAL_RESPONSE

    # 5. Autoriser l'appel API pour les questions générales
    return None

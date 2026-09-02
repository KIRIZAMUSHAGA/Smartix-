import os
import random
from openai import OpenAI

# Configuration
STORAGE_PATH = "backend/static/system_profiles"
TOTAL_IMAGES = 10000  # Objectif
BATCH_SIZE = 10

# Variations pour la diversité
ETHNICITIES = ["Africaine", "Européenne", "Asie de l'Est", "Asie du Sud", "Moyen-Orient", "Amérique Latine", "Métisse"]
GENDERS = ["homme", "femme", "personne non-binaire"]
AGES = range(16, 40)
EXPRESSIONS = ["expression neutre", "léger sourire", "regard naturel"]
POSES = ["face caméra", "léger angle de vue"]
LIGHTING = ["lumière naturelle intérieure", "lumière du jour", "éclairage légèrement imparfait"]
BACKGROUNDS = ["mur simple", "salon banal", "rue floue", "bureau"]

def generate_prompt():
    """Génère un prompt détaillé pour une image photoréaliste."""
    ethnicity = random.choice(ETHNICITIES)
    gender = random.choice(GENDERS)
    age = random.choice(AGES)
    expression = random.choice(EXPRESSIONS)
    pose = random.choice(POSES)
    lighting = random.choice(LIGHTING)
    bg = random.choice(BACKGROUNDS)
    
    prompt = (
        f"Photo smartphone réelle d'une personne {gender} de {age} ans, origine {ethnicity}, "
        f"{expression}, {pose}, {lighting}, fond {bg}. "
        f"Style photographie amateur authentique, légère compression JPEG, "
        f"texture de peau naturelle avec micro-imperfections, pas un mannequin, "
        f"pas de symétrie parfaite, regarde l'objectif."
    )
    return prompt

def generate_system_image(client: OpenAI):
    """Génère une seule image pour un profil système."""
    prompt = generate_prompt()
    try:
        response = client.images.generate(
            model="dall-e-3",
            prompt=prompt,
            size="1024x1024",
            quality="standard",
            n=1,
        )
        if response and response.data:
            image_url = response.data[0].url
            return image_url
        return None
    except Exception as e:
        print(f"Erreur lors de la génération de l'image : {e}")
        return None

if __name__ == "__main__":
    print("Script de génération de profils systèmes initialisé.")
    print(f"Exemple de Prompt : {generate_prompt()}")

"""
Script de génération de photos photoréalistes pour profils systèmes
Répartition : ~70% origine africaine, ~30% autres origines
Cohérence stricte : genre du profil = genre sur la photo
"""
import os
import sys
import json
import random
import hashlib
import asyncio
import base64
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, Dict, Any, Tuple
from dataclasses import dataclass, field

from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from openai import OpenAI
from concurrent.futures import ThreadPoolExecutor, as_completed
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception

load_dotenv()

script_dir = Path(__file__).parent
log_file = script_dir / "photo_generation.log"

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(log_file),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

STORAGE_PATH = Path(__file__).parent.parent / "static" / "system_photos"
STORAGE_PATH.mkdir(parents=True, exist_ok=True)

_openai_client: Optional[OpenAI] = None

def get_openai_client() -> OpenAI:
    global _openai_client
    if _openai_client is None:
        api_key = os.environ.get("AI_INTEGRATIONS_OPENAI_API_KEY")
        base_url = os.environ.get("AI_INTEGRATIONS_OPENAI_BASE_URL")
        if not api_key or not base_url:
            raise RuntimeError("AI_INTEGRATIONS_OPENAI_API_KEY and AI_INTEGRATIONS_OPENAI_BASE_URL must be set")
        _openai_client = OpenAI(api_key=api_key, base_url=base_url)
    return _openai_client

@dataclass
class OriginDistribution:
    african: float = 0.70
    european: float = 0.10
    mixed: float = 0.10
    other: float = 0.10

@dataclass
class PhotoMetadata:
    profile_id: str
    gender_used: str
    origin: str
    image_hash: str
    filename: str
    profile_type: str = "system"
    avatar_scope: str = "system_only"
    generated_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    is_locked: bool = True

AFRICAN_ORIGINS = [
    "congolaise (RDC)",
    "ivoirienne (Côte d'Ivoire)", 
    "sénégalaise",
    "camerounaise",
    "gabonaise",
    "malienne",
    "togolaise",
    "béninoise",
    "burkinabè",
    "guinéenne",
    "centrafricaine",
    "tchadienne",
    "nigériane",
    "ghanéenne",
    "kenyane",
    "sud-africaine"
]

EUROPEAN_ORIGINS = [
    "française",
    "belge",
    "suisse",
    "canadienne francophone",
    "allemande",
    "italienne",
    "espagnole",
    "portugaise"
]

MIXED_ORIGINS = [
    "métisse africaine-européenne",
    "métisse caribéenne",
    "métisse afro-brésilienne",
    "créole"
]

OTHER_ORIGINS = [
    "maghrébine (Maroc/Algérie/Tunisie)",
    "libanaise",
    "haïtienne",
    "martiniquaise",
    "guadeloupéenne",
    "réunionnaise"
]

FEMININE_INDICATORS = {
    "Marie", "Jeanne", "Cécile", "Claudine", "Nadège", "Sylvie", "Berthe",
    "Élisabeth", "Monique", "Véronique", "Thérèse", "Agnès", "Martine", "Christine",
    "Brigitte", "Nathalie", "Sandrine", "Victoire", "Gracia", "Gloria", "Bénédicte",
    "Joséphine", "Pélagie", "Scholastique", "Alphonsine", "Léontine", "Euphrasie",
    "Awa", "Adjoua", "Fatou", "Mariam", "Akissi", "Affoué", "Ahou", "Amlan", "Amenan",
    "Assa", "Assata", "Kadiatou", "Karidja", "Massandjé", "Rokia", "Salimata", "Sita",
    "Aïcha", "Aïssata", "Aminata", "Bintou", "Djénéba", "Fatoumata", "Hawa",
    "Kadidja", "Kadidjatou", "Korotoum", "Maimouna", "Minata", "Nassénéba", "Oumou",
    "Safiatou", "Sali", "Sanata", "Saran", "Tènin", "Fanta", "Gnagna",
    "Khady", "Aïssatou", "Coumba", "Ndeye", "Seynabou", "Léa", "Camille", "Manon",
    "Chloé", "Sarah", "Emma", "Alice", "Inès", "Jade", "Lola", "Amélie", "Béatrice",
    "Charlotte", "Clara", "Diane", "Élodie", "Éva", "Fanny", "Garance", "Hélène",
    "Julie", "Lucie", "Nathalie", "Pauline", "Rachel", "Roxane", "Sophie", "Valérie",
    "Zoé", "Agathe", "Céline", "Élise", "Gabrielle", "Isabelle", "Justine", "Laura",
    "Margot", "Océane", "Florence", "Rosalie", "Olivia", "Mila", "Maya", "Livia",
    "Juliette", "Léonie", "Maude", "Victoria", "Rose", "Zoey", "Lily", "Ève",
    "Annabelle", "Laurence", "Simone", "Delphine", "Audrey", "Catherine", "Anne",
    "Louise", "Marguerite", "Nicole", "Denise", "Suzanne", "Johanne", "Francine",
    "Ginette", "Carole", "Lise", "Linda", "Caroline", "Geneviève", "Karine",
    "Mélanie", "Annie", "Josée", "Stéphanie", "Patricia", "Chantal", "Nadia", "Sandra",
    "Jocelyne", "Ruth", "Esther", "Déborah", "Grâce", "Espérance", "Bijou", "Anny",
    "Providence", "Merveille", "Chance", "Exaucée"
}

MASCULINE_INDICATORS = {
    "Dieudonné", "Placide", "Kabasele", "Tshilombo", "Faustin", "Kabange", "Ilunga",
    "Mukendi", "Kasongo", "Kalonji", "Mbuyi", "Tshanda", "Zola", "Nkusu", "Luvumbu",
    "Patient", "Béni", "Israël", "Moïse", "David", "Samuel", "Alain", "Patrick",
    "Christian", "Serge", "Éric", "Didier", "Hervé", "Pascal", "Bernard", "François",
    "Jean-Pierre", "Jean-Paul", "Jean-Claude", "Jean-Marc", "Jean-Luc", "Jean-Marie",
    "Jean-Baptiste", "Jean-Louis", "Jean-Michel", "Jean-Yves", "Prosper", "Fidèle",
    "Constant", "Parfait", "Aimé", "Désiré", "Bienvenu", "Innocent", "Modeste",
    "Emmanuel", "Gabriel", "Raphaël", "Michel", "Daniel", "Joël", "Noël", "Abel",
    "Élie", "Ézéchiel", "Gédéon", "Josué", "Salomon", "Jonathan", "Nathanaël",
    "Timothée", "Barnabé", "Matthieu", "Luc", "Marc", "Jérémie", "Isaïe", "Amos",
    "Jonas", "Osée", "Zacharie", "Malachie", "Habacuc", "Sophonie", "Aggée",
    "Néhémie", "Esdras", "Job", "Siméon", "Lévi", "Ruben", "Juda", "Benjamin",
    "Joseph", "Jacob", "Abraham", "Isaac", "Éphraïm", "Manassé", "Caleb", "Aaron",
    "Koffi", "Yao", "Konan", "Bakayoko", "Tiémoko", "Sidiki", "Bamba", "Doumbia",
    "Cissé", "Touré", "Diomandé", "Fofana", "Kouamé", "N'Guessan", "Daouda", "Drissa",
    "Félix", "Ibrahim", "Issouf", "Issa", "Kassoum", "Lacina", "Lamine", "Mamadou",
    "Mohamed", "Moussa", "Oumar", "Ousmane", "Salif", "Seydou", "Siaka", "Souleymane",
    "Yacouba", "Youssouf", "Adama", "Bakary", "Boubacar", "Cheick", "Dramane", "Fodé",
    "Gaoussou", "Hamidou", "Ibrahima", "Kalifa", "Lansana", "Madou", "Moriba",
    "Namory", "Oumarou", "Sékou", "Abdoulaye", "Aboubacar", "Alassane", "Birahim",
    "Cheikh", "Thomas", "Nicolas", "Julien", "Antoine", "Maxime", "Hugo", "Paul",
    "Lucas", "Arthur", "Louis", "Alexandre", "Bastien", "Charles", "Clément", "Damien",
    "Édouard", "Étienne", "Fabien", "Florian", "Guillaume", "Jean", "Jérôme",
    "Laurent", "Mathieu", "Olivier", "Philippe", "Sébastien", "Théo", "Vincent",
    "Adrien", "Baptiste", "Denis", "Henri", "Jacques", "Kevin", "Nathan", "Pierre",
    "Quentin", "Romain", "Simon", "Tristan", "Xavier", "Yann", "William", "Logan",
    "Jacob", "Liam", "Noah", "Émile", "Félix", "Léo", "Raphaël", "Théodore", "Mathis",
    "Victor", "Adam", "Justin", "Marc", "Daniel", "André", "Robert", "Richard",
    "Bernard", "Gilles", "Claude", "Martin", "René", "Marcel", "Yves", "Raymond",
    "Georges", "Lucien", "Maurice", "Normand", "Mario", "Stéphane", "Sylvain",
    "Bruno", "Marco", "Matthias", "Sébastien", "Jonathan"
}

def determine_gender_from_profile(profile: Dict[str, Any]) -> str:
    genre = profile.get("genre", "N")
    if genre == "M":
        return "homme"
    elif genre == "F":
        return "femme"
    
    prenom = profile.get("prenom", "")
    if prenom in FEMININE_INDICATORS:
        return "femme"
    elif prenom in MASCULINE_INDICATORS:
        return "homme"
    
    return random.choice(["homme", "femme"])

def select_origin_weighted() -> Tuple[str, str]:
    roll = random.random()
    
    if roll < OriginDistribution.african:
        origin = random.choice(AFRICAN_ORIGINS)
        category = "africaine"
    elif roll < OriginDistribution.african + OriginDistribution.european:
        origin = random.choice(EUROPEAN_ORIGINS)
        category = "européenne"
    elif roll < OriginDistribution.african + OriginDistribution.european + OriginDistribution.mixed:
        origin = random.choice(MIXED_ORIGINS)
        category = "métisse"
    else:
        origin = random.choice(OTHER_ORIGINS)
        category = "autre"
    
    return origin, category

def generate_photorealistic_prompt(gender: str, origin: str, age_range: Tuple[int, int] = (18, 35)) -> str:
    age = random.randint(*age_range)
    
    expressions = [
        "expression naturelle détendue",
        "léger sourire authentique", 
        "regard direct et confiant",
        "expression neutre naturelle",
        "sourire discret"
    ]
    
    poses = [
        "visage de face",
        "visage légèrement de trois-quarts",
        "portrait de face regardant l'objectif"
    ]
    
    lightings = [
        "lumière naturelle douce de fenêtre",
        "éclairage naturel légèrement imparfait",
        "lumière du jour intérieure",
        "éclairage ambiant naturel de pièce",
        "lumière naturelle extérieure diffuse"
    ]
    
    backgrounds = [
        "mur simple neutre légèrement texturé",
        "intérieur de salon flou",
        "fond de bureau banal",
        "arrière-plan urbain très flou",
        "mur peint uni simple"
    ]
    
    imperfections = [
        "peau naturelle avec texture réelle",
        "légères imperfections cutanées naturelles",
        "micro-ridules d'expression",
        "texture de peau authentique non retouchée"
    ]
    
    expression = random.choice(expressions)
    pose = random.choice(poses)
    lighting = random.choice(lightings)
    background = random.choice(backgrounds)
    imperfection = random.choice(imperfections)
    
    prompt = (
        f"Photo portrait smartphone authentique d'une personne {gender} de {age} ans, "
        f"origine {origin}, {expression}, {pose}. "
        f"{lighting}, {background}. "
        f"Style photographie amateur réelle prise au téléphone, légère compression JPEG visible, "
        f"{imperfection}, visage asymétrique naturel, "
        f"PAS un mannequin, PAS de photo de studio professionnelle, "
        f"PAS de symétrie faciale parfaite, apparence authentique d'une vraie personne. "
        f"Regarde directement l'objectif."
    )
    
    return prompt

def is_rate_limit_error(exception: BaseException) -> bool:
    error_msg = str(exception)
    status_code = getattr(exception, "status_code", None)
    return (
        "429" in error_msg
        or "RATELIMIT_EXCEEDED" in error_msg
        or "quota" in error_msg.lower()
        or "rate limit" in error_msg.lower()
        or status_code == 429
    )

@retry(
    stop=stop_after_attempt(5),
    wait=wait_exponential(multiplier=2, min=4, max=120),
    retry=retry_if_exception(is_rate_limit_error),
    reraise=True
)
def generate_single_photo(prompt: str) -> Optional[bytes]:
    try:
        client = get_openai_client()
        response = client.images.generate(
            model="gpt-image-1",
            prompt=prompt,
            size="1024x1024",
        )
        if response and response.data and response.data[0].b64_json:
            image_base64 = response.data[0].b64_json
            return base64.b64decode(image_base64)
        return None
    except Exception as e:
        logger.error(f"Erreur génération image: {e}")
        raise

def compute_image_hash(image_bytes: bytes) -> str:
    return hashlib.sha256(image_bytes).hexdigest()

def save_photo_to_disk(image_bytes: bytes, profile_id: str) -> str:
    image_hash = compute_image_hash(image_bytes)
    filename = f"{profile_id}_{image_hash[:12]}.png"
    filepath = STORAGE_PATH / filename
    
    with open(filepath, "wb") as f:
        f.write(image_bytes)
    
    return filename

def create_photo_metadata(
    profile_id: str,
    gender: str,
    origin_category: str,
    filename: str,
    image_hash: str
) -> Dict[str, Any]:
    return {
        "profile_id": profile_id,
        "gender_used": gender,
        "origin": origin_category,
        "image_hash": image_hash,
        "filename": filename,
        "photo_path": f"/static/system_photos/{filename}",
        "profile_type": "system",
        "avatar_scope": "system_only",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "is_locked": True,
        "usage_restrictions": {
            "allow_user_accounts": False,
            "allow_public_api": False,
            "allow_recycling": False
        }
    }

async def generate_photo_for_profile(profile: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    profile_id: str = profile.get("id", "")
    if not profile_id:
        logger.warning("Profil sans ID détecté")
        return None
    
    try:
        gender = determine_gender_from_profile(profile)
        origin, origin_category = select_origin_weighted()
        
        age_value = profile.get("age", 28)
        age_min = max(18, age_value - 5)
        age_max = min(39, age_value + 5)
        
        prompt = generate_photorealistic_prompt(gender, origin, (age_min, age_max))
        
        image_bytes = await asyncio.get_event_loop().run_in_executor(
            None, generate_single_photo, prompt
        )
        
        if image_bytes is None:
            logger.warning(f"Échec génération photo pour profil {profile_id}")
            return None
        
        image_hash = compute_image_hash(image_bytes)
        filename = save_photo_to_disk(image_bytes, profile_id)
        
        metadata = create_photo_metadata(
            profile_id=profile_id,
            gender=gender,
            origin_category=origin_category,
            filename=filename,
            image_hash=image_hash
        )
        
        logger.info(f"Photo générée: {profile_id} | {gender} | {origin_category}")
        
        return metadata
        
    except Exception as e:
        logger.error(f"Erreur pour profil {profile_id}: {e}")
        return None

async def inject_photo_metadata_to_db(
    users_col,
    photos_col,
    profile_id: str,
    metadata: Dict[str, Any]
) -> bool:
    try:
        await photos_col.update_one(
            {"profile_id": profile_id},
            {"$set": metadata},
            upsert=True
        )
        
        await users_col.update_one(
            {"id": profile_id},
            {
                "$set": {
                    "avatar": metadata["photo_path"],
                    "photo_metadata": {
                        "is_system_photo": True,
                        "origin": metadata["origin"],
                        "gender_used": metadata["gender_used"],
                        "generated_at": metadata["generated_at"]
                    }
                }
            }
        )
        
        return True
    except Exception as e:
        logger.error(f"Erreur injection DB pour {profile_id}: {e}")
        return False

async def run_batch_generation(
    profiles: list,
    batch_size: int = 10,
    dry_run: bool = False
) -> Dict[str, Any]:
    mongo_uri = os.environ.get("MONGO_URL")
    db_name = os.environ.get("DB_NAME", "smartix")
    
    stats: Dict[str, Any] = {
        "total_profiles": len(profiles),
        "generated": 0,
        "failed": 0,
        "african_count": 0,
        "european_count": 0,
        "mixed_count": 0,
        "other_count": 0,
        "male_count": 0,
        "female_count": 0,
        "errors": []
    }
    
    client: Optional[AsyncIOMotorClient] = None
    users_col = None
    photos_col = None
    
    if not dry_run and mongo_uri:
        client = AsyncIOMotorClient(mongo_uri)
        db = client[db_name]
        users_col = db.users
        photos_col = db.system_photos
        
        await photos_col.create_index("profile_id", unique=True)
        await photos_col.create_index("avatar_scope")
        await photos_col.create_index("profile_type")
    
    try:
        for i in range(0, len(profiles), batch_size):
            batch = profiles[i:i + batch_size]
            batch_num = i // batch_size + 1
            total_batches = (len(profiles) + batch_size - 1) // batch_size
            
            logger.info(f"Batch {batch_num}/{total_batches} - Traitement de {len(batch)} profils...")
            
            tasks = [generate_photo_for_profile(p) for p in batch]
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            for profile, result in zip(batch, results):
                if isinstance(result, Exception):
                    stats["failed"] += 1
                    stats["errors"].append({
                        "profile_id": profile.get("id"),
                        "error": str(result)
                    })
                elif result is None:
                    stats["failed"] += 1
                elif isinstance(result, dict):
                    stats["generated"] += 1
                    
                    origin = result.get("origin", "")
                    if origin == "africaine":
                        stats["african_count"] += 1
                    elif origin == "européenne":
                        stats["european_count"] += 1
                    elif origin == "métisse":
                        stats["mixed_count"] += 1
                    else:
                        stats["other_count"] += 1
                    
                    gender_used = result.get("gender_used", "")
                    if gender_used == "homme":
                        stats["male_count"] += 1
                    else:
                        stats["female_count"] += 1
                    
                    if not dry_run and client and users_col is not None and photos_col is not None:
                        profile_id = profile.get("id", "")
                        if profile_id:
                            await inject_photo_metadata_to_db(
                                users_col, photos_col,
                                profile_id, result
                            )
            
            await asyncio.sleep(1)
            
            logger.info(
                f"Progression: {stats['generated']}/{stats['total_profiles']} "
                f"(Africains: {stats['african_count']}, Autres: {stats['european_count'] + stats['mixed_count'] + stats['other_count']})"
            )
    
    finally:
        if client:
            client.close()
    
    return stats

async def run_test_batch(count: int = 50) -> Dict[str, Any]:
    logger.info(f"=== BATCH TEST: {count} profils ===")
    
    input_path = "backend/scripts/system_profiles_10000.json"
    with open(input_path, "r", encoding="utf-8") as f:
        all_profiles = json.load(f)
    
    test_profiles = random.sample(all_profiles, min(count, len(all_profiles)))
    
    stats = await run_batch_generation(test_profiles, batch_size=5, dry_run=False)
    
    african_pct = (stats["african_count"] / stats["generated"] * 100) if stats["generated"] > 0 else 0
    
    logger.info("=== RÉSULTATS BATCH TEST ===")
    logger.info(f"Total généré: {stats['generated']}/{stats['total_profiles']}")
    logger.info(f"Échecs: {stats['failed']}")
    logger.info(f"Africains: {stats['african_count']} ({african_pct:.1f}%)")
    logger.info(f"Européens: {stats['european_count']}")
    logger.info(f"Métisses: {stats['mixed_count']}")
    logger.info(f"Autres: {stats['other_count']}")
    logger.info(f"Hommes: {stats['male_count']}")
    logger.info(f"Femmes: {stats['female_count']}")
    
    if african_pct < 60 or african_pct > 80:
        logger.warning(f"⚠️ Répartition africaine hors cible (60-80%): {african_pct:.1f}%")
    else:
        logger.info(f"✅ Répartition africaine dans la cible: {african_pct:.1f}%")
    
    return stats

async def run_full_generation(total: int = 10000, batch_size: int = 10) -> Dict[str, Any]:
    logger.info(f"=== GÉNÉRATION COMPLÈTE: {total} profils ===")
    
    input_path = "backend/scripts/system_profiles_10000.json"
    with open(input_path, "r", encoding="utf-8") as f:
        all_profiles = json.load(f)
    
    profiles_to_process = all_profiles[:total]
    
    stats = await run_batch_generation(profiles_to_process, batch_size=batch_size)
    
    african_pct = (stats["african_count"] / stats["generated"] * 100) if stats["generated"] > 0 else 0
    
    logger.info("=== RÉSULTATS GÉNÉRATION COMPLÈTE ===")
    logger.info(f"Total généré: {stats['generated']}/{stats['total_profiles']}")
    logger.info(f"Échecs: {stats['failed']}")
    logger.info(f"Africains: {stats['african_count']} ({african_pct:.1f}%)")
    logger.info(f"Européens: {stats['european_count']}")
    logger.info(f"Métisses: {stats['mixed_count']}")
    logger.info(f"Autres: {stats['other_count']}")
    logger.info(f"Hommes: {stats['male_count']}")
    logger.info(f"Femmes: {stats['female_count']}")
    
    return stats

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Génération de photos système")
    parser.add_argument("--test", action="store_true", help="Lancer un batch test (50 profils)")
    parser.add_argument("--test-count", type=int, default=50, help="Nombre de profils pour le test")
    parser.add_argument("--full", action="store_true", help="Lancer la génération complète")
    parser.add_argument("--count", type=int, default=10000, help="Nombre de profils à traiter")
    parser.add_argument("--batch-size", type=int, default=10, help="Taille des batchs")
    
    args = parser.parse_args()
    
    if args.test:
        asyncio.run(run_test_batch(args.test_count))
    elif args.full:
        asyncio.run(run_full_generation(args.count, args.batch_size))
    else:
        print("Usage:")
        print("  python generate_system_photos.py --test          # Batch test (50 profils)")
        print("  python generate_system_photos.py --test --test-count 100  # Test avec 100 profils")
        print("  python generate_system_photos.py --full          # Génération complète 10000")
        print("  python generate_system_photos.py --full --count 1000  # 1000 profils")

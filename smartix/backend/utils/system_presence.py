from datetime import datetime, timezone, timedelta
import random
import logging

logger = logging.getLogger(__name__)

def is_system_user_online(signature: dict) -> bool:
    """
    Détermine si un utilisateur système doit être considéré comme en ligne
    basé sur sa signature temporelle unique.
    """
    if not signature:
        return False

    # 1. Gestion du fuseau horaire
    tz_offset = signature.get("tz_offset", 0)
    now_utc = datetime.now(timezone.utc)
    local_time = now_utc + timedelta(hours=tz_offset)
    
    current_hour = local_time.hour
    current_weekday = local_time.strftime("%A") # e.g., 'Monday'
    
    # Traduction pour correspondre aux jours générés (en français dans le script initial)
    days_map = {
        "Monday": "Lundi", "Tuesday": "Mardi", "Wednesday": "Mercredi",
        "Thursday": "Jeudi", "Friday": "Vendredi", "Saturday": "Samedi", "Sunday": "Dimanche"
    }
    current_day_fr = days_map.get(current_weekday)

    # 2. Vérification de la plage horaire active
    heures_actives = signature.get("heures_actives", ["08:00-18:00"])
    is_in_active_slot = False
    for slot in heures_actives:
        try:
            start_str, end_str = slot.split("-")
            start_h = int(start_str.split(":")[0])
            end_h = int(end_str.split(":")[0])
            
            if start_h <= current_hour < end_h:
                is_in_active_slot = True
                break
        except Exception:
            continue

    if not is_in_active_slot:
        return False

    # 3. Facteur de probabilité (Randomisation pour ne pas être un robot parfait)
    # Si c'est un jour faible, probabilité de 10%, sinon 70% d'être en ligne durant ses heures
    jours_faibles = signature.get("jours_faibles", [])
    probability = 0.10 if current_day_fr in jours_faibles else 0.70
    
    # Ajout d'une fluctuation basée sur les minutes (pour éviter que tout le monde se connecte à pile 08:00)
    # On utilise un grain de sel basé sur l'ID (simulé ici par une probabilité stable sur l'heure)
    return random.random() < probability

def get_simulated_last_seen(signature: dict) -> str:
    """
    Génère un timestamp 'Dernière vue' réaliste pour un profil système hors ligne.
    """
    tz_offset = signature.get("tz_offset", 0)
    now_utc = datetime.now(timezone.utc)
    
    # Simuler une déconnexion entre 5 minutes et 4 heures
    minutes_ago = random.randint(5, 240)
    last_seen = now_utc - timedelta(minutes=minutes_ago)
    
    return last_seen.isoformat()

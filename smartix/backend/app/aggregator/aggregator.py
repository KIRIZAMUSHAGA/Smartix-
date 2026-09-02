from app.aggregator.rss_fetcher import fetch_from_rss
from app.aggregator.page_scraper import fetch_page_image
from app.aggregator.image_downloader import download_image_local
from app.aggregator.content_extractor import extract_full_content
from app.services.news_service import save_article
from app.db_mongo import client
from app.aggregator.rss_sources import DEFAULT_RSS_SOURCES
from app.aggregator.cleaners import clean_summary
import asyncio
import logging
import random
import threading
from datetime import datetime, timedelta
from typing import List, Dict, Optional
from dataclasses import dataclass

logger = logging.getLogger(__name__)

_aggregator_lock = threading.Lock()
_aggregator_running = False

# ========== CONFIGURATION ==========
BATCH_SIZE = 10       # Sources traitées en parallèle
REQUEST_TIMEOUT = 30  # Timeout par source
MAX_RETRIES = 3       # Tentatives max par source
RATE_LIMIT_DELAY = (1, 3)   # Délai aléatoire entre 1 et 3 secondes
ERROR_THRESHOLD = 5         # Échecs consécutifs avant désactivation automatique

# ========== MÉTRIQUES ==========
@dataclass
class AggregatorMetrics:
    start_time: datetime
    end_time: Optional[datetime] = None
    sources_total: int = 0
    sources_success: int = 0
    sources_failed: int = 0
    sources_skipped: int = 0
    articles_found: int = 0
    articles_new: int = 0
    
    @property
    def duration(self) -> float:
        if self.end_time:
            return (self.end_time - self.start_time).total_seconds()
        return 0
    
    @property
    def success_rate(self) -> float:
        total = self.sources_success + self.sources_failed
        return (self.sources_success / total * 100) if total > 0 else 0
    
    def to_dict(self):
        return {
            "timestamp": self.start_time,
            "duration": self.duration,
            "sources_total": self.sources_total,
            "sources_success": self.sources_success,
            "sources_failed": self.sources_failed,
            "sources_skipped": self.sources_skipped,
            "articles_found": self.articles_found,
            "articles_new": self.articles_new,
            "success_rate": self.success_rate
        }

# ========== FETCH AVEC RETRY ==========
async def fetch_with_retry(url: str, source_name: str) -> Optional[List[Dict]]:
    """Fetch RSS avec retry et backoff exponentiel"""
    
    for attempt in range(MAX_RETRIES):
        try:
            # Timeout pour éviter les blocages
            items = await asyncio.wait_for(
                asyncio.to_thread(fetch_from_rss, url),
                timeout=REQUEST_TIMEOUT
            )
            
            if items is None:
                logger.warning(f"⚠️ {source_name}: Pas de données (tentative {attempt+1})")
            else:
                return items
            
        except asyncio.TimeoutError:
            logger.warning(f"⏰ {source_name}: Timeout (tentative {attempt+1})")
        except Exception as e:
            logger.warning(f"⚠️ {source_name}: Erreur {e} (tentative {attempt+1})")
        
        if attempt < MAX_RETRIES - 1:
            wait = (2 ** attempt) + random.uniform(0, 1)
            logger.info(f"⏳ {source_name}: Nouvelle tentative dans {wait:.1f}s")
            await asyncio.sleep(wait)
    
    logger.error(f"❌ {source_name}: Échec après {MAX_RETRIES} tentatives")
    return []

# ========== TRAITEMENT D'UN ITEM ==========
async def process_item(db, source, item: Dict, metrics: AggregatorMetrics):
    """Traite un article individuel"""
    try:
        title = item.get("title") or "Sans titre"
        link = item.get("link")
        if not link:
            return None
        
        metrics.articles_found += 1
        
        # Nettoyer et préparer les données
        summary = clean_summary(item.get("summary", ""))
        published = item.get("published")
        image = item.get("image")
        
        # Essayer d'extraire le contenu complet (optionnel)
        content_html = None
        try:
            full_content = await asyncio.wait_for(
                asyncio.to_thread(extract_full_content, link),
                timeout=10
            )
            if full_content and len(full_content) > 200:
                content_html = full_content
        except:
            pass
        
        # Fallback si pas de contenu
        if not content_html:
            if summary:
                content_html = f"""
                <div class='article-content'>
                    <p>{summary}</p>
                    <p class='read-more'>
                        <a href='{link}' target='_blank' rel='noopener noreferrer'>
                            Lire l'article complet sur {source.get('name', 'la source')}
                        </a>
                    </p>
                </div>
                """
            else:
                content_html = f"""
                <div class='article-content'>
                    <p>Article provenant de {source.get('name', 'une source')}</p>
                    <p class='read-more'>
                        <a href='{link}' target='_blank' rel='noopener noreferrer'>
                            Lire l'article original
                        </a>
                    </p>
                </div>
                """
        
        # Sauvegarder
        saved = await save_article(
            db, source, title, summary, content_html, link, image, published,
            country=source.get("country"),
            language=source.get("language")
        )
        
        if saved:
            metrics.articles_new += 1
            
        return saved
        
    except Exception as e:
        logger.error(f"❌ Erreur traitement article {item.get('link', 'inconnu')}: {e}")
        return None

# ========== AUTO-DÉSACTIVATION ==========
async def _increment_error_and_maybe_disable(db, source: Dict, reason: str) -> int:
    """Incrémente error_count et désactive la source si le seuil est atteint.
    Retourne le nouveau total d'erreurs consécutives."""
    source_name = source.get("name", source.get("rss_url", "inconnue"))
    result = await db["news_sources"].find_one_and_update(
        {"_id": source["_id"]},
        {
            "$set": {
                "last_error": reason,
                "last_error_time": datetime.utcnow()
            },
            "$inc": {"error_count": 1}
        },
        return_document=True
    )
    new_count = result.get("error_count", 1) if result else 1

    if new_count >= ERROR_THRESHOLD:
        await db["news_sources"].update_one(
            {"_id": source["_id"]},
            {
                "$set": {
                    "disabled": True,
                    "auto_disabled_at": datetime.utcnow(),
                    "auto_disabled_reason": reason
                }
            }
        )
        logger.warning(
            f"🚫 Source '{source_name}' désactivée automatiquement après "
            f"{new_count} échecs consécutifs — raison : {reason}"
        )
    else:
        logger.debug(
            f"Source '{source_name}' : {new_count}/{ERROR_THRESHOLD} échecs consécutifs"
        )

    return new_count


# ========== TRAITEMENT D'UNE SOURCE ==========
async def process_source(db, source: Dict, metrics: AggregatorMetrics) -> int:
    """Traite une source RSS complète"""
    
    source_name = source.get('name', source.get('rss_url', 'inconnue'))
    logger.info(f"📰 Traitement de {source_name}")
    
    # Vérifier si la source est active
    if source.get("disabled", False):
        logger.info(f"⏸️ Source {source_name} désactivée")
        metrics.sources_skipped += 1
        return 0
    
    try:
        start_time = datetime.utcnow()
        
        # Rate limiting
        delay = random.uniform(*RATE_LIMIT_DELAY)
        await asyncio.sleep(delay)
        
        # Récupérer les articles
        items = await fetch_with_retry(source["rss_url"], source_name)
        
        if not items:
            logger.debug(f"{source_name}: Aucun article trouvé")
            metrics.sources_failed += 1
            new_count = await _increment_error_and_maybe_disable(
                db, source, "Aucun article trouvé après plusieurs tentatives"
            )
            if new_count >= ERROR_THRESHOLD:
                metrics.sources_skipped += 1
            return 0
        
        # Récupérer les URLs déjà existantes pour cette source
        existing_urls = await db["news"].distinct(
            "url",
            {"source_id": source["_id"]}
        )
        existing_urls_set = set(existing_urls)
        
        # Filtrer les nouveaux articles
        new_items = [item for item in items if item.get("link") not in existing_urls_set]
        
        if not new_items:
            logger.info(f"📭 {source_name}: Aucun nouvel article")
        else:
            logger.info(f"🆕 {source_name}: {len(new_items)} nouveaux articles")
            
            # Traiter les nouveaux articles
            for item in new_items:
                await process_item(db, source, item, metrics)
        
        # Calculer durée
        duration = (datetime.utcnow() - start_time).total_seconds()
        
        # Mettre à jour la source (reset error_count en cas de succès)
        await db["news_sources"].update_one(
            {"_id": source["_id"]},
            {
                "$set": {
                    "last_checked": datetime.utcnow(),
                    "last_success": datetime.utcnow(),
                    "last_duration": duration,
                    "articles_count": len(items),
                    "new_articles": len(new_items),
                    "error_count": 0,
                    "last_error": None
                },
                "$inc": {"total_runs": 1}
            }
        )
        
        metrics.sources_success += 1
        logger.info(f"✅ {source_name}: Traité en {duration:.1f}s")
        
        return len(new_items)
        
    except Exception as e:
        logger.error(f"❌ {source_name}: Erreur critique - {e}")
        await _increment_error_and_maybe_disable(db, source, str(e))
        metrics.sources_failed += 1
        return 0

# ========== INITIALISATION DES SOURCES ==========
async def ensure_sources_exist(db):
    """Crée les sources par défaut si elles n'existent pas"""
    sources_collection = db["news_sources"]
    
    for src in DEFAULT_RSS_SOURCES:
        existing = await sources_collection.find_one({"rss_url": src["rss_url"]})
        if not existing:
            source_doc = {
                "name": src["name"],
                "rss_url": src["rss_url"],
                "base_url": src.get("base_url"),
                "country": src.get("country"),
                "language": src.get("language"),
                "priority": src.get("priority", 0),
                "disabled": False,
                "error_count": 0,
                "total_runs": 0,
                "created_at": datetime.utcnow()
            }
            await sources_collection.insert_one(source_doc)
            logger.info(f"✅ Source créée: {src['name']}")

# ========== AGRÉGATION PRINCIPALE ==========
async def run_once() -> int:
    """Exécute un cycle complet d'agrégation"""
    
    global _aggregator_running
    with _aggregator_lock:
        if _aggregator_running:
            logger.warning("⚠️ Agrégateur déjà en cours d'exécution")
            return 0
        _aggregator_running = True

    metrics = AggregatorMetrics(start_time=datetime.utcnow())
    
    try:
        from db import DB_NAME
        db = client[DB_NAME]
        
        logger.info("🚀 DÉMARRAGE DE L'AGRÉGATEUR")
        
        # 1. Initialiser les sources
        await ensure_sources_exist(db)
        
        # 2. Récupérer les sources actives
        sources = await db["news_sources"].find(
            {"disabled": {"$ne": True}}
        ).sort("priority", 1).to_list(length=100)
        
        metrics.sources_total = len(sources)
        logger.info(f"📚 {len(sources)} sources à traiter")
        
        # 3. Traiter par lots
        for i in range(0, len(sources), BATCH_SIZE):
            batch = sources[i:i+BATCH_SIZE]
            logger.info(f"📦 Lot {i//BATCH_SIZE + 1}/{(len(sources)-1)//BATCH_SIZE + 1}")
            
            # Créer les tâches pour le lot
            tasks = []
            for source in batch:
                task = process_source(db, source, metrics)
                tasks.append(task)
            
            # Exécuter le lot en parallèle
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            # Vérifier les erreurs
            for j, result in enumerate(results):
                if isinstance(result, Exception):
                    logger.error(f"❌ Source {batch[j].get('name')} a échoué: {result}")
            
            # Petite pause entre les lots
            if i + BATCH_SIZE < len(sources):
                await asyncio.sleep(2)
        
        # 4. Sauvegarder les métriques
        metrics.end_time = datetime.utcnow()
        metrics_col = db["aggregator_metrics"]
        await metrics_col.insert_one(metrics.to_dict())
        
        # 5. Nettoyer les vieilles métriques (garder 30 jours)
        cutoff = datetime.utcnow() - timedelta(days=30)
        await metrics_col.delete_many({"timestamp": {"$lt": cutoff}})
        
        logger.info(f"📊 RÉSULTATS: {metrics.articles_new} nouveaux articles")
        logger.info(f"⏱️ Durée totale: {metrics.duration:.1f}s")
        logger.info(f"✅ Succès: {metrics.sources_success}/{metrics.sources_total}")
        logger.info(f"❌ Échecs: {metrics.sources_failed}")
        
        return metrics.articles_new
        
    except Exception as e:
        logger.error(f"❌ Erreur critique agrégateur: {e}")
        return 0
        
    finally:
        _aggregator_running = False

# ========== WRAPPER SYNCHRONE ==========
def run_once_sync():
    """Sync wrapper for scheduler — crée sa propre loop isolée via asyncio.run()"""
    try:
        asyncio.run(run_once())
    except Exception as e:
        logger.error(f"❌ Error in aggregator sync wrapper: {e}")

# ========== FONCTIONS UTILITAIRES ==========
async def get_aggregator_status(db) -> Dict:
    """Retourne le statut actuel de l'agrégateur"""
    last_run = await db["aggregator_metrics"].find_one(
        sort=[("timestamp", -1)]
    )
    
    sources = await db["news_sources"].find().to_list(length=100)
    active_sources = sum(1 for s in sources if not s.get("disabled"))
    errored_sources = sum(1 for s in sources if s.get("error_count", 0) > 3)
    
    return {
        "is_running": _aggregator_running,
        "last_run": last_run,
        "sources": {
            "total": len(sources),
            "active": active_sources,
            "errored": errored_sources
        },
        "timestamp": datetime.utcnow().isoformat()
    }

async def disable_source(db, source_id: str):
    """Désactive une source problématique"""
    await db["news_sources"].update_one(
        {"_id": ObjectId(source_id)},
        {"$set": {"disabled": True}}
    )
    logger.info(f"🚫 Source {source_id} désactivée")

async def reset_source_errors(db, source_id: str):
    """Réinitialise les compteurs d'erreur d'une source"""
    await db["news_sources"].update_one(
        {"_id": ObjectId(source_id)},
        {"$set": {"error_count": 0, "last_error": None}}
    )
    logger.info(f"🔄 Compteurs d'erreur réinitialisés pour {source_id}")

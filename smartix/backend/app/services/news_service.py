from motor.motor_asyncio import AsyncIOMotorDatabase
from hashlib import sha256
from datetime import datetime, timedelta
from bson import ObjectId
from typing import Optional, List, Any, Dict
import dateutil.parser
import html
import bleach

# ========== CONFIGURATION ==========
MAX_TITLE_LENGTH = 300
MAX_CONTENT_LENGTH = 10000
MAX_SUMMARY_LENGTH = 500
ALLOWED_HTML_TAGS = ['p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'ul', 'ol', 'li', 'a', 'blockquote']

# ========== VALIDATION ==========
class NewsValidator:
    """Validation et nettoyage des données news"""
    
    @staticmethod
    def validate_title(title: Optional[str]) -> str:
        if not title:
            return "Article sans titre"
        # Échapper HTML et limiter longueur
        return html.escape(title.strip())[:MAX_TITLE_LENGTH]
    
    @staticmethod
    def validate_url(url: Optional[str]) -> Optional[str]:
        if not url:
            return None
        url = url.strip()
        if not url.startswith(('http://', 'https://')):
            return None
        return url[:500]  # Limiter longueur
    
    @staticmethod
    def validate_content(content: Optional[str]) -> str:
        if not content:
            return ""
        # Nettoyer le HTML (garder seulement les tags safe)
        cleaned = bleach.clean(
            content,
            tags=ALLOWED_HTML_TAGS,
            strip=True
        )
        return cleaned[:MAX_CONTENT_LENGTH]
    
    @staticmethod
    def validate_summary(summary: Optional[str]) -> str:
        if not summary:
            return ""
        # Échapper HTML pour le summary (pas de balises)
        return html.escape(summary.strip())[:MAX_SUMMARY_LENGTH]
    
    @staticmethod
    def validate_date(date_val: Any) -> datetime:
        """Convertit et valide une date"""
        if isinstance(date_val, datetime):
            return date_val
        
        try:
            if isinstance(date_val, str):
                return dateutil.parser.parse(date_val)
        except:
            pass
        
        return datetime.utcnow()
    
    @staticmethod
    def validate_country(country: Optional[str]) -> Optional[str]:
        if not country:
            return None
        # Normaliser (ex: 'FR' -> 'fr')
        return country.lower().strip()[:2]  # Code pays à 2 lettres

# ========== HASH DE DÉDUPLICATION ==========
def compute_dedup_hash(title: str, url: str, published_at) -> str:
    """Calcule un hash unique pour déduplication"""
    title = title or ""
    url = url or ""
    date_str = str(published_at) if published_at else ""
    
    # Normaliser les données
    normalized = f"{title.strip()}|{url.strip()}|{date_str}"
    return sha256(normalized.encode("utf-8")).hexdigest()

# ========== CRÉATION DES INDEX ==========
async def ensure_news_indexes(db: AsyncIOMotorDatabase):
    """Crée tous les index nécessaires pour les news"""
    
    # Index pour news collection
    news_collection = db["news"]
    
    indexes = [
        # Unicité
        {"name": "idx_url_unique", "keys": [("url", 1)], "unique": True, "sparse": True},
        {"name": "idx_dedup_hash", "keys": [("dedup_hash", 1)]},
        
        # Recherche
        {"name": "idx_published_at", "keys": [("published_at", -1)]},
        {"name": "idx_country_date", "keys": [("country", 1), ("published_at", -1)]},
        {"name": "idx_category_date", "keys": [("category", 1), ("published_at", -1)]},
        {"name": "idx_source_date", "keys": [("source_id", 1), ("published_at", -1)]},
        
        # Filtres
        {"name": "idx_is_duplicate", "keys": [("is_duplicate", 1)]},
        {"name": "idx_expires_at", "keys": [("expires_at", 1)], "expireAfterSeconds": 0},
        
        # Texte
        {"name": "idx_text_search", "keys": [("title", "text"), ("summary", "text")]},
    ]
    
    for idx in indexes:
        try:
            expire = idx.pop("expireAfterSeconds", None)
            if expire is not None:
                await news_collection.create_index(
                    idx["keys"],
                    name=idx["name"],
                    expireAfterSeconds=expire
                )
            elif idx.get("unique"):
                await news_collection.create_index(
                    idx["keys"],
                    name=idx["name"],
                    unique=True,
                    sparse=True
                )
            else:
                await news_collection.create_index(
                    idx["keys"],
                    name=idx["name"]
                )
            print(f"✅ Index créé: {idx['name']}")
        except Exception as e:
            print(f"⚠️ Erreur création index {idx['name']}: {e}")
    
    # Index pour likes collection
    likes_collection = db["news_likes"]
    await likes_collection.create_index(
        [("news_id", 1), ("user_id", 1)],
        name="idx_likes_unique",
        unique=True
    )
    await likes_collection.create_index(
        [("news_id", 1), ("created_at", -1)],
        name="idx_likes_news_date"
    )
    
    # Index pour comments collection
    comments_collection = db["news_comments"]
    await comments_collection.create_index(
        [("news_id", 1), ("created_at", -1)],
        name="idx_comments_news_date"
    )
    await comments_collection.create_index(
        [("user_id", 1), ("created_at", -1)],
        name="idx_comments_user_date"
    )

# ========== SAUVEGARDE ARTICLE ==========
async def save_article(
    db: AsyncIOMotorDatabase,
    source_obj,
    title: Optional[str],
    summary: Optional[str],
    content: Optional[str],
    url: Optional[str],
    image_url: Optional[str],
    published_at,
    country: Optional[str] = None,
    language: Optional[str] = None,
    category: Optional[str] = None
) -> Optional[Dict]:
    """Sauvegarde un article avec validation et déduplication"""
    
    # Validation
    title = NewsValidator.validate_title(title)
    url = NewsValidator.validate_url(url)
    content = NewsValidator.validate_content(content)
    summary = NewsValidator.validate_summary(summary)
    published_at = NewsValidator.validate_date(published_at)
    country = NewsValidator.validate_country(country)
    
    # URL requise
    if not url:
        print(f"⚠️ Article ignoré - URL invalide")
        return None
    
    news_collection = db["news"]
    
    # Calculer hash de déduplication
    dedup = compute_dedup_hash(title, url, published_at)
    
    # Vérifier existence
    existing = await news_collection.find_one({
        "$or": [
            {"url": url},
            {"dedup_hash": dedup}
        ]
    })
    
    if existing:
        # Mettre à jour le compteur de vues si nécessaire
        if existing.get("is_duplicate"):
            # C'était marqué comme duplicate, le réactiver
            await news_collection.update_one(
                {"_id": existing["_id"]},
                {"$set": {"is_duplicate": False}}
            )
        return existing
    
    # Construire content_html
    content_html = content
    if not content_html or len(content_html.strip()) < 150:
        if summary:
            content_html = (
                f"<div class='article-content'>"
                f"<p>{summary}</p>"
                f"<p><em>Pour lire l'article complet, consultez la source originale.</em></p>"
                f"</div>"
            )
        else:
            content_html = "<div class='article-content'><p>Contenu non disponible.</p></div>"
    
    now = datetime.utcnow()
    article = {
        "source_id": source_obj.get("_id") if source_obj else None,
        "source_name": source_obj.get("name") if source_obj else None,
        "title": title,
        "summary": summary,
        "content": content,
        "content_html": content_html,
        "url": url,
        "image_url": NewsValidator.validate_url(image_url),  # Valider aussi l'image
        "published_at": published_at,
        "dedup_hash": dedup,
        "country": country,
        "language": language.lower().strip()[:2] if language else None,
        "category": category,
        "fetched_at": now,
        "expires_at": now + timedelta(hours=24),
        "is_duplicate": False,
        "processed": False,
        "likes_count": 0,
        "comments_count": 0,
        "views_count": 0
    }
    
    try:
        result = await news_collection.insert_one(article)
        article["_id"] = result.inserted_id
        return article
    except Exception as e:
        print(f"❌ Erreur sauvegarde article: {e}")
        return None

# ========== LISTE DES NEWS ==========
async def list_news(
    db: AsyncIOMotorDatabase,
    limit: int = 20,
    offset: int = 0,
    country: Optional[str] = None,
    category: Optional[str] = None,
    q: Optional[str] = None
) -> List[Dict]:
    """Liste les news avec filtres et pagination"""
    
    news_collection = db["news"]
    query: Dict[str, Any] = {"is_duplicate": {"$ne": True}}
    
    # Filtres
    if country:
        country = NewsValidator.validate_country(country)
        if country:
            query["country"] = country
    
    if category:
        query["category"] = category
    
    if q and len(q) <= 100:
        # Utiliser l'index texte pour la recherche
        query["$text"] = {"$search": q}
        sort = [("score", {"$meta": "textScore"}), ("published_at", -1)]
    else:
        sort = [("published_at", -1)]
    
    try:
        cursor = news_collection.find(query).sort(sort).skip(offset).limit(limit)
        items = await cursor.to_list(length=limit)
        return items
    except Exception as e:
        print(f"❌ Erreur list_news: {e}")
        return []

# ========== RÉCUPÉRER UN ARTICLE ==========
async def get_news_by_id(db: AsyncIOMotorDatabase, news_id: str) -> Optional[Dict]:
    """Récupère un article par son ID"""
    try:
        obj_id = ObjectId(news_id)
    except:
        return None
    
    try:
        news_collection = db["news"]
        article = await news_collection.find_one({"_id": obj_id})
        
        if article:
            # Incrémenter compteur de vues
            await news_collection.update_one(
                {"_id": obj_id},
                {"$inc": {"views_count": 1}}
            )
        
        return article
    except Exception as e:
        print(f"❌ Erreur get_news_by_id {news_id}: {e}")
        return None

# ========== LIKE ==========
async def add_like(db: AsyncIOMotorDatabase, news_id: str, user_id: str) -> Optional[Dict]:
    """Ajoute ou retire un like (toggle)"""
    
    # Valider news_id
    try:
        news_obj_id = ObjectId(news_id)
    except:
        return None
    
    likes_collection = db["news_likes"]
    news_collection = db["news"]
    
    # Transaction
    async with await db.client.start_session() as session:
        async with session.start_transaction():
            # Vérifier like existant
            existing = await likes_collection.find_one(
                {"news_id": news_obj_id, "user_id": user_id},
                session=session
            )
            
            if existing:
                # Unlike - supprimer le like
                await likes_collection.delete_one(
                    {"_id": existing["_id"]},
                    session=session
                )
                await news_collection.update_one(
                    {"_id": news_obj_id},
                    {"$inc": {"likes_count": -1}},
                    session=session
                )
                return {"liked": False, "news_id": news_id}
            else:
                # Like - ajouter
                like = {
                    "news_id": news_obj_id,
                    "user_id": user_id,
                    "created_at": datetime.utcnow()
                }
                result = await likes_collection.insert_one(like, session=session)
                
                await news_collection.update_one(
                    {"_id": news_obj_id},
                    {"$inc": {"likes_count": 1}},
                    session=session
                )
                
                like["_id"] = result.inserted_id
                return {"liked": True, "like_id": str(result.inserted_id), "news_id": news_id}

# ========== COMMENTAIRE ==========
async def add_comment(
    db: AsyncIOMotorDatabase,
    news_id: str,
    user_id: str,
    message: str
) -> Optional[Dict]:
    """Ajoute un commentaire à un article"""
    
    # Validation
    if not message or len(message) > 500:
        return None
    
    # Échapper HTML
    safe_message = html.escape(message.strip())
    
    try:
        news_obj_id = ObjectId(news_id)
    except:
        return None
    
    comments_collection = db["news_comments"]
    news_collection = db["news"]
    
    # Transaction
    async with await db.client.start_session() as session:
        async with session.start_transaction():
            comment = {
                "news_id": news_obj_id,
                "user_id": user_id,
                "message": safe_message,
                "created_at": datetime.utcnow()
            }
            result = await comments_collection.insert_one(comment, session=session)
            
            await news_collection.update_one(
                {"_id": news_obj_id},
                {"$inc": {"comments_count": 1}},
                session=session
            )
            
            comment["_id"] = result.inserted_id
            return comment

# ========== NETTOYAGE ==========
async def cleanup_old_news(db: AsyncIOMotorDatabase, days: int = 7):
    """Nettoie les articles plus vieux que days (sauf ceux avec interactions)"""
    cutoff = datetime.utcnow() - timedelta(days=days)
    
    news_collection = db["news"]
    
    # Supprimer les vieux articles sans interactions
    result = await news_collection.delete_many({
        "published_at": {"$lt": cutoff},
        "likes_count": 0,
        "comments_count": 0,
        "views_count": {"$lt": 10}
    })
    
    print(f"🧹 Nettoyage: {result.deleted_count} articles supprimés")
    return result.deleted_count

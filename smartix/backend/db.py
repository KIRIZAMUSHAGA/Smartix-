"""MongoDB connection and initialization for Smartix backend"""
import os
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from pymongo import ASCENDING, DESCENDING, TEXT
from contextlib import asynccontextmanager
from typing import Optional

# Configuration MongoDB
_raw_mongo_url = os.getenv('MONGO_URL', '')
if 'mongodb' in _raw_mongo_url:
    MONGO_URL: str = 'mongodb' + _raw_mongo_url.split('mongodb', 1)[1]
else:
    MONGO_URL: str = 'mongodb+srv://tolombe352_db_user:kiriza01@cluster0.pmhtdpl.mongodb.net/?appName=Cluster0'
DB_NAME: str = os.getenv('DB_NAME', 'smartohada')

# Global database instance
_db: Optional[AsyncIOMotorDatabase] = None
_client: Optional[AsyncIOMotorClient] = None

async def init_mongodb() -> bool:
    """Initialize MongoDB connection and create indexes"""
    global _db, _client

    try:
        # Tuning client Motor pour éviter les blocages longs en cas de socket
        # idle, de cold start Atlas, ou de dégradation réseau. Les défauts
        # Motor (serverSelectionTimeoutMS=30000) peuvent transformer une
        # simple reconnexion en attente de 30 s, ce qui faisait monter
        # l'inscription au-delà de 60 s.
        _client = AsyncIOMotorClient(
            MONGO_URL,
            serverSelectionTimeoutMS=5000,
            connectTimeoutMS=5000,
            socketTimeoutMS=10000,
            maxPoolSize=20,
            minPoolSize=2,
            maxIdleTimeMS=60000,
            retryWrites=True,
        )
        _db = _client[DB_NAME]

        # Test connection
        if _client is None or _db is None:
            raise RuntimeError("Failed to initialize MongoDB client")

        await _client.admin.command('ping')
        print("✅ MongoDB connected successfully!")

        # Create collections if they don't exist
        collections = ['users', 'stories', 'posts', 'notifications', 'music',
                      'marketplace_categories', 'marketplace_sellers', 'marketplace_products',
                      'marketplace_orders', 'marketplace_order_items', 'marketplace_payments',
                      'marketplace_wallets', 'marketplace_wallet_transactions', 'marketplace_reviews',
                      'marketplace_products_preview', 'news', 'news_sources', 'news_likes', 'news_comments',
                      'smartclips', 'smartclip_comments',
                      'user_preferences', 'user_progress', 'watched_videos', 
                      'scraping_status', 'scraping_sessions', 'teacher_sessions',
                      'user_tool_quotas',
                      # ✅ NOUVELLES COLLECTIONS MARKETPLACE APPLICATIONS
                      'marketplace_apps',
                      'marketplace_app_reviews',
                      'marketplace_app_forks',
                      'analytics_events',
                      'analytics_daily',
                      'ai_suggestions',
                      'suggestion_votes']
        
        for collection_name in collections:
            if collection_name not in await _db.list_collection_names():
                await _db.create_collection(collection_name)
                print(f"✅ Collection '{collection_name}' created")

        # Create indexes for performance
        users_col = _db['users']
        # Suppression sécurisée de l'ancien index s'il existe
        try:
            await users_col.drop_index('username_1')
            print("✅ Dropped old username_1 index")
        except Exception:
            pass
            
        # Index unique partiel sur email : autorise les comptes sans email
        # (comptes téléphone-only) tout en garantissant l'unicité quand l'email
        # existe. Aligné avec la migration du lifespan dans server.py.
        try:
            await users_col.create_index(
                [('email', ASCENDING)],
                unique=True,
                partialFilterExpression={'email': {'$exists': True, '$type': 'string'}},
                name='email_1',
            )
            print("✅ Index on users.email (partial) created")
        except Exception as e:
            # L'index existe déjà avec la même spec après la migration → no-op.
            print(f"ℹ️ Index users.email déjà présent: {e}")
        
        # Création de l'index username avec un nom spécifique pour éviter les conflits automatiques
        try:
            await users_col.create_index([('username', ASCENDING)], sparse=True, name="username_sparse_index")
            print("✅ Index on users.username created")
        except Exception as e:
            print(f"⚠️ Index creation warning (username): {e}")

        # Stories collection indexes - INDEX COMPOSÉ OPTIMISÉ
        stories_col = _db['stories']
        
        # Supprimer l'ancien index TTL s'il existe pour éviter les conflits
        try:
            await stories_col.drop_index('expires_at_1')
            print("✅ Ancien index TTL supprimé")
        except Exception:
            pass  # L'index n'existe pas encore
        
        # Index composé pour la requête principale (expires_at + created_at)
        await stories_col.create_index([
            ('expires_at', ASCENDING),
            ('created_at', ASCENDING)
        ], name='stories_active_sorted')
        await stories_col.create_index([('user_id', ASCENDING)])
        # Add index for user_id and expires_at for filtering active stories by user
        await stories_col.create_index([('user_id', ASCENDING), ('expires_at', ASCENDING)])
        # Index for TTL (Time-To-Live) to automatically delete expired stories
        await stories_col.create_index("expires_at", expireAfterSeconds=0, name='stories_ttl_index')
        print("✅ Indexes optimisés sur stories créés")

        # Posts collection indexes - OPTIMISÉ POUR CURSOR-BASED PAGINATION
        posts_col = _db['posts']
        
        # Gestion propre de l'index user_id pour éviter les conflits de noms
        try:
            index_info = await posts_col.index_information()
            # Si l'index existe avec un nom différent, on le supprime
            for name, info in index_info.items():
                if info.get('key') == [('user_id', 1)] and name != 'idx_posts_user_id':
                    await posts_col.drop_index(name)
            
            await posts_col.create_index([('user_id', ASCENDING)], name='idx_posts_user_id')
        except Exception as e:
            print(f"⚠️ Index creation warning (posts user_id): {e}")
            
        try:
            await posts_col.create_index([('created_at', DESCENDING)])
        except Exception as e:
            print(f"⚠️ Index creation warning (posts created_at): {e}")
        
        # Corriger le conflit d'index sur posts_cursor_pagination
        # On utilise une approche radicale pour supprimer tout index conflictuel
        try:
            # Récupérer tous les index existants
            index_info = await posts_col.index_information()
            target_key = [('created_at', -1), ('id', -1)]
            
            # Supprimer TOUT index qui a la même structure mais pas le bon nom
            for name, info in index_info.items():
                if info.get('key') == target_key and name != 'posts_cursor_pagination':
                    try:
                        await _db.command("dropIndexes", "posts", index=name)
                    except:
                        pass
            
            # Supprimer l'index cible s'il existe déjà avec des options différentes
            if 'posts_cursor_pagination' in index_info:
                try:
                    await _db.command("dropIndexes", "posts", index='posts_cursor_pagination')
                except:
                    pass
                    
            # Créer l'index standardisé proprement
            await posts_col.create_index([('created_at', DESCENDING), ('id', DESCENDING)], name='posts_cursor_pagination')
        except Exception:
            pass
                
        await posts_col.create_index([('id', ASCENDING)], unique=True, sparse=True)
        print("✅ Indexes on posts collection created")

        # Notifications collection indexes
        notifications_col = _db['notifications']
        await notifications_col.create_index([('user_id', ASCENDING)])
        await notifications_col.create_index([('created_at', ASCENDING)])
        print("✅ Indexes on notifications collection created")

        # Music collection indexes
        music_col = _db['music']
        await music_col.create_index([('created_at', ASCENDING)])
        print("✅ Indexes on music collection created")

        # MARKETPLACE COLLECTIONS - INDEXES
        categories_col = _db['marketplace_categories']
        await categories_col.create_index([('slug', ASCENDING)], unique=True)

        sellers_col = _db['marketplace_sellers']
        await sellers_col.create_index([('user_id', ASCENDING)], unique=True)
        await sellers_col.create_index([('created_at', ASCENDING)])

        products_col = _db['marketplace_products']
        await products_col.create_index([('seller_id', ASCENDING)])
        await products_col.create_index([('category_id', ASCENDING)])
        await products_col.create_index([('is_published', ASCENDING)])
        await products_col.create_index([('created_at', ASCENDING)])
        await products_col.create_index([('rating', ASCENDING)])

        orders_col = _db['marketplace_orders']
        await orders_col.create_index([('buyer_id', ASCENDING)])
        await orders_col.create_index([('seller_id', ASCENDING)])
        await orders_col.create_index([('status', ASCENDING)])
        await orders_col.create_index([('created_at', ASCENDING)])

        order_items_col = _db['marketplace_order_items']
        await order_items_col.create_index([('order_id', ASCENDING)])
        await order_items_col.create_index([('product_id', ASCENDING)])

        payments_col = _db['marketplace_payments']
        await payments_col.create_index([('order_id', ASCENDING)])
        await payments_col.create_index([('status', ASCENDING)])

        wallets_col = _db['marketplace_wallets']
        await wallets_col.create_index([('seller_id', ASCENDING)], unique=True)
        await wallets_col.create_index([('user_id', ASCENDING)], unique=True)

        transactions_col = _db['marketplace_wallet_transactions']
        await transactions_col.create_index([('wallet_id', ASCENDING)])
        await transactions_col.create_index([('created_at', ASCENDING)])

        reviews_col = _db['marketplace_reviews']
        await reviews_col.create_index([('product_id', ASCENDING)])
        await reviews_col.create_index([('buyer_id', ASCENDING)])
        await reviews_col.create_index([('seller_id', ASCENDING)])

        preview_col = _db['marketplace_products_preview']
        await preview_col.create_index([('product_id', ASCENDING)])

        # PDF JOBS COLLECTION
        pdf_jobs_col = _db['marketplace_pdf_jobs']
        await pdf_jobs_col.create_index([('product_id', ASCENDING)])
        await pdf_jobs_col.create_index([('status', ASCENDING)])
        await pdf_jobs_col.create_index([('created_at', ASCENDING)])

        print("✅ Marketplace collection indexes created!")

        # SmartClips collection indexes
        smartclips_col = _db['smartclips']
        await smartclips_col.create_index([('created_at', -1)])
        await smartclips_col.create_index([('user_id', ASCENDING)])
        await smartclips_col.create_index([('source', ASCENDING)])
        await smartclips_col.create_index([('video_url', ASCENDING)], unique=True, sparse=True)
        
        # Index unique pour provider + provider_video_id (évite doublons Pexels/Pixabay)
        await smartclips_col.create_index(
            [('provider', ASCENDING), ('provider_video_id', ASCENDING)],
            unique=True,
            sparse=True,
            name='provider_video_unique'
        )
        print("✅ Index unique provider+provider_video_id créé")
        
        smartclip_comments_col = _db['smartclip_comments']
        await smartclip_comments_col.create_index([('clip_id', ASCENDING)])
        await smartclip_comments_col.create_index([('created_at', -1)])
        
        print("✅ SmartClips collection indexes created!")
        
        # User Preferences collection indexes (SmartClips V2)
        user_prefs_col = _db['user_preferences']
        await user_prefs_col.create_index([('user_id', ASCENDING)], unique=True)
        
        # User Progress collection indexes (SmartClips V2)
        user_progress_col = _db['user_progress']
        await user_progress_col.create_index([('user_id', ASCENDING)], unique=True)
        
        # Watched Videos collection indexes (SmartClips V2)
        watched_col = _db['watched_videos']
        await watched_col.create_index([('user_id', ASCENDING), ('video_id', ASCENDING)], unique=True)
        await watched_col.create_index([('user_id', ASCENDING)])
        await watched_col.create_index([('watched_at', -1)])
        
        # Scraping Status collection
        scraping_status_col = _db['scraping_status']
        await scraping_status_col.create_index([('updated_at', -1)])
        
        # Scraping Sessions collection
        scraping_sessions_col = _db['scraping_sessions']
        await scraping_sessions_col.create_index([('user_id', ASCENDING)])
        await scraping_sessions_col.create_index([('date', -1)])

        # Teacher Sessions collection
        teacher_sessions_col = _db['teacher_sessions']
        await teacher_sessions_col.create_index([('userId', ASCENDING)])
        await teacher_sessions_col.create_index([('createdAt', DESCENDING)])
        await teacher_sessions_col.create_index([('lastAccessedAt', DESCENDING)])
        
        # Add priority and batch_number indexes to smartclips
        await smartclips_col.create_index([('priority', ASCENDING)])
        await smartclips_col.create_index([('batch_number', ASCENDING)])
        await smartclips_col.create_index([('priority', ASCENDING), ('created_at', -1)])
        await smartclips_col.create_index([('tags', ASCENDING)])
        
        print("✅ SmartClips V2 indexes created!")
        
        # FRIEND_REQUESTS COLLECTION - INDEX UNIQUE CANONIQUE (OBLIGATOIRE)
        friend_requests_col = _db['friend_requests']
        
        try:
            # Vérifier si l'index unique existe déjà
            existing_indexes = await friend_requests_col.index_information()
            
            if 'unique_friendship_pair' not in existing_indexes:
                # Index unique pour garantir une seule entrée par paire d'utilisateurs
                # Structure canonique: user_low_id < user_high_id
                await friend_requests_col.create_index(
                    [('user_low_id', ASCENDING), ('user_high_id', ASCENDING)],
                    unique=True,
                    name='unique_friendship_pair'
                )
                print("✅ Index unique 'unique_friendship_pair' créé")
            else:
                print("✅ Index unique 'unique_friendship_pair' déjà présent")
            
            # Index de performance pour les requêtes par utilisateur
            await friend_requests_col.create_index([('user_low_id', ASCENDING)])
            await friend_requests_col.create_index([('user_high_id', ASCENDING)])
            await friend_requests_col.create_index([('status', ASCENDING)])
            await friend_requests_col.create_index([('user_low_id', ASCENDING), ('status', ASCENDING)])
            await friend_requests_col.create_index([('user_high_id', ASCENDING), ('status', ASCENDING)])
            await friend_requests_col.create_index([('initiated_by', ASCENDING)])
            
            print("✅ Friend requests collection indexes created!")
        except Exception as e:
            print(f"⚠️  Erreur lors de la création des index friend_requests: {e}")
            print("   → Exécutez la migration: python backend/scripts/migrate_friend_requests_canonical.py")

        # =============================
        # ✅ NOUVELLE COLLECTION : user_tool_quotas
        # =============================
        await init_tool_quotas_collection(_db)
        
        # =============================
        # ✅ COLLECTIONS VIBE-CODING
        # =============================
        await init_vibe_coding_collections(_db)
        
        # =============================
        # ✅ COLLECTIONS MODULE MOBILE
        # =============================
        await init_mobile_collections(_db)
        
        # =============================
        # ✅ NOUVELLES COLLECTIONS MARKETPLACE APPLICATIONS
        # =============================
        await init_marketplace_app_collections(_db)
        
        print("✅ All MongoDB indexes initialized!")
        return True

    except Exception as e:
        print(f"❌ MongoDB connection error: {e}")
        raise

# =============================
# ✅ NOUVELLE FONCTION POUR LES COLLECTIONS MARKETPLACE APPLICATIONS
# =============================
async def init_marketplace_app_collections(db):
    """Initialise les collections du marketplace applications"""
    
    # =============================
    # MARKETPLACE_APPS COLLECTION
    # =============================
    apps_col = db['marketplace_apps']
    
    # Index de base
    await apps_col.create_index([('developer_id', ASCENDING)], name='idx_apps_developer')
    await apps_col.create_index([('category_id', ASCENDING)], name='idx_apps_category')
    await apps_col.create_index([('visibility', ASCENDING)], name='idx_apps_visibility')
    await apps_col.create_index([('is_published', ASCENDING)], name='idx_apps_published')
    
    # Index pour la recherche
    await apps_col.create_index([('name', TEXT), ('description', TEXT), ('tags', TEXT)], 
                                name='idx_apps_search')
    
    # Index pour le tri
    await apps_col.create_index([('created_at', DESCENDING)], name='idx_apps_created')
    await apps_col.create_index([('updated_at', DESCENDING)], name='idx_apps_updated')
    await apps_col.create_index([('trending_score', DESCENDING)], name='idx_apps_trending')
    
    # Index composés pour stats
    await apps_col.create_index([('stats.downloads', DESCENDING)], name='idx_apps_downloads')
    await apps_col.create_index([('stats.installs', DESCENDING)], name='idx_apps_installs')
    await apps_col.create_index([('stats.rating', DESCENDING)], name='idx_apps_rating')
    
    print("✅ Index marketplace_apps créés")
    
    # =============================
    # MARKETPLACE_APP_REVIEWS COLLECTION
    # =============================
    reviews_col = db['marketplace_app_reviews']
    
    await reviews_col.create_index([('app_id', ASCENDING)], name='idx_app_reviews_app')
    await reviews_col.create_index([('user_id', ASCENDING)], name='idx_app_reviews_user')
    await reviews_col.create_index([('developer_id', ASCENDING)], name='idx_app_reviews_developer')
    await reviews_col.create_index([('status', ASCENDING)], name='idx_app_reviews_status')
    await reviews_col.create_index([('verified', ASCENDING)], name='idx_app_reviews_verified')
    
    # Index composés pour le tri
    await reviews_col.create_index([('app_id', ASCENDING), ('created_at', DESCENDING)], 
                                   name='idx_app_reviews_recent')
    await reviews_col.create_index([('app_id', ASCENDING), ('helpful', DESCENDING)], 
                                   name='idx_app_reviews_helpful')
    await reviews_col.create_index([('app_id', ASCENDING), ('rating', DESCENDING)], 
                                   name='idx_app_reviews_rating')
    
    # Index unique pour éviter les doublons
    await reviews_col.create_index([('app_id', ASCENDING), ('user_id', ASCENDING)], 
                                   unique=True, name='idx_app_reviews_unique')
    
    print("✅ Index marketplace_app_reviews créés")
    
    # =============================
    # MARKETPLACE_APP_FORKS COLLECTION
    # =============================
    forks_col = db['marketplace_app_forks']
    
    await forks_col.create_index([('original_app_id', ASCENDING)], name='idx_forks_original')
    await forks_col.create_index([('forked_by', ASCENDING)], name='idx_forks_user')
    await forks_col.create_index([('new_app_id', ASCENDING)], name='idx_forks_new')
    await forks_col.create_index([('status', ASCENDING)], name='idx_forks_status')
    await forks_col.create_index([('forked_at', DESCENDING)], name='idx_forks_date')
    
    print("✅ Index marketplace_app_forks créés")
    
    # =============================
    # ANALYTICS_EVENTS COLLECTION
    # =============================
    events_col = db['analytics_events']
    
    await events_col.create_index([('app_id', ASCENDING)], name='idx_events_app')
    await events_col.create_index([('user_id', ASCENDING)], name='idx_events_user')
    await events_col.create_index([('type', ASCENDING)], name='idx_events_type')
    await events_col.create_index([('timestamp', DESCENDING)], name='idx_events_timestamp')
    
    # Index composés pour les requêtes fréquentes
    await events_col.create_index([('app_id', ASCENDING), ('type', ASCENDING), ('timestamp', DESCENDING)],
                                 name='idx_events_app_type_time')
    await events_col.create_index([('user_id', ASCENDING), ('type', ASCENDING), ('timestamp', DESCENDING)],
                                 name='idx_events_user_type_time')
    
    print("✅ Index analytics_events créés")
    
    # =============================
    # ANALYTICS_DAILY COLLECTION
    # =============================
    daily_col = db['analytics_daily']
    
    await daily_col.create_index([('app_id', ASCENDING), ('date', DESCENDING)], 
                                 unique=True, name='idx_daily_app_date')
    await daily_col.create_index([('date', ASCENDING)], name='idx_daily_date')
    
    print("✅ Index analytics_daily créés")
    
    # =============================
    # AI_SUGGESTIONS COLLECTION
    # =============================
    suggestions_col = db['ai_suggestions']
    
    await suggestions_col.create_index([('app_id', ASCENDING)], name='idx_suggestions_app')
    await suggestions_col.create_index([('status', ASCENDING)], name='idx_suggestions_status')
    await suggestions_col.create_index([('type', ASCENDING)], name='idx_suggestions_type')
    await suggestions_col.create_index([('priority_score', DESCENDING)], name='idx_suggestions_priority')
    await suggestions_col.create_index([('created_at', DESCENDING)], name='idx_suggestions_created')
    
    # Index composés
    await suggestions_col.create_index([('app_id', ASCENDING), ('status', ASCENDING)],
                                      name='idx_suggestions_app_status')
    await suggestions_col.create_index([('app_id', ASCENDING), ('priority_score', DESCENDING)],
                                      name='idx_suggestions_app_priority')
    
    print("✅ Index ai_suggestions créés")
    
    # =============================
    # SUGGESTION_VOTES COLLECTION
    # =============================
    votes_col = db['suggestion_votes']
    
    await votes_col.create_index([('suggestion_id', ASCENDING)], name='idx_votes_suggestion')
    await votes_col.create_index([('user_id', ASCENDING)], name='idx_votes_user')
    await votes_col.create_index([('vote_type', ASCENDING)], name='idx_votes_type')
    
    # Index unique pour éviter les votes multiples
    await votes_col.create_index([('suggestion_id', ASCENDING), ('user_id', ASCENDING)], 
                                 unique=True, name='idx_votes_unique')
    
    print("✅ Index suggestion_votes créés")
    
    print("✅ Toutes les collections marketplace applications sont initialisées")

# =============================
# ✅ NOUVELLE FONCTION POUR LES QUOTAS D'OUTILS
# =============================
async def init_tool_quotas_collection(db):
    """Initialise la collection des quotas d'outils"""
    
    # Vérifier si la collection existe déjà
    collections = await db.list_collection_names()
    
    if "user_tool_quotas" not in collections:
        # Créer la collection avec validation
        await db.create_collection("user_tool_quotas", validator={
            "$jsonSchema": {
                "bsonType": "object",
                "required": ["userId", "tool", "count", "lastUsed", "createdAt"],
                "properties": {
                    "userId": {
                        "bsonType": "string",
                        "description": "ID de l'utilisateur"
                    },
                    "tool": {
                        "bsonType": "string",
                        "enum": ["web_search", "generate_image", "run_code"],
                        "description": "Nom de l'outil"
                    },
                    "count": {
                        "bsonType": "int",
                        "minimum": 0,
                        "description": "Nombre d'utilisations"
                    },
                    "lastUsed": {
                        "bsonType": "date",
                        "description": "Dernière utilisation"
                    },
                    "createdAt": {
                        "bsonType": "date",
                        "description": "Date de création"
                    }
                }
            }
        })
        print("✅ Collection 'user_tool_quotas' créée avec validation")
    else:
        print("📌 Collection 'user_tool_quotas' existe déjà")

    # Créer les index (même si la collection existait déjà)
    await db.user_tool_quotas.create_index(
        [("userId", 1), ("tool", 1)],
        unique=True,
        name="idx_user_tool_unique"
    )
    print("✅ Index 'idx_user_tool_unique' créé/vérifié")
    
    await db.user_tool_quotas.create_index(
        [("lastUsed", 1)],
        name="idx_last_used"
    )
    print("✅ Index 'idx_last_used' créé/vérifié")

# =============================
# ✅ FONCTION POUR VIBE-CODING (existante)
# =============================
async def init_vibe_coding_collections(db):
    """Initialise les collections Vibe-Coding (projets, templates, builds)"""
    
    # Liste des collections Vibe-Coding
    vibe_collections = [
        'projects',          # Projets utilisateur
        'templates',         # Templates marketplace
        'transactions',      # Achats
        'reviews',           # Avis sur templates
        'wallets',           # Portefeuilles vendeurs
        'builds'             # Builds et prévisualisation
    ]
    
    # Créer les collections si elles n'existent pas
    existing = await db.list_collection_names()
    for col_name in vibe_collections:
        if col_name not in existing:
            await db.create_collection(col_name)
            print(f"✅ Collection '{col_name}' créée")
    
    # =============================
    # PROJECTS COLLECTION
    # =============================
    projects_col = db['projects']
    
    # Index pour les requêtes utilisateur
    await projects_col.create_index([('userId', ASCENDING)], name='idx_projects_user')
    await projects_col.create_index([('userId', ASCENDING), ('status', ASCENDING)], name='idx_projects_user_status')
    await projects_col.create_index([('userId', ASCENDING), ('updatedAt', DESCENDING)], name='idx_projects_user_recent')
    await projects_col.create_index([('status', ASCENDING)], name='idx_projects_status')
    await projects_col.create_index([('createdAt', DESCENDING)], name='idx_projects_created')
    
    print("✅ Index projects créés")
    
    # =============================
    # TEMPLATES COLLECTION
    # =============================
    templates_col = db['templates']
    
    # Index pour la recherche
    await templates_col.create_index([('sellerId', ASCENDING)], name='idx_templates_seller')
    await templates_col.create_index([('status', ASCENDING)], name='idx_templates_status')
    await templates_col.create_index([('category', ASCENDING)], name='idx_templates_category')
    await templates_col.create_index([('isFree', ASCENDING)], name='idx_templates_free')
    await templates_col.create_index([('price', ASCENDING)], name='idx_templates_price')
    
    # Index composés pour le marketplace
    await templates_col.create_index(
        [('status', ASCENDING), ('stats.trendingScore', DESCENDING)],
        name='idx_templates_trending'
    )
    await templates_col.create_index(
        [('status', ASCENDING), ('createdAt', DESCENDING)],
        name='idx_templates_recent'
    )
    await templates_col.create_index(
        [('status', ASCENDING), ('stats.purchases', DESCENDING)],
        name='idx_templates_popular'
    )
    
                 
    # Index texte pour la recherche full-text
    await templates_col.create_index(
        [('name', TEXT), ('description', TEXT), ('tags', TEXT)],
        name='idx_templates_search'
    )
    
    print("✅ Index templates créés")
     # =============================
    # TRANSACTIONS COLLECTION
    # =============================
    transactions_col = db['transactions']
    
    # Index pour les achats
    await transactions_col.create_index([('userId', ASCENDING)], name='idx_transactions_user')
    await transactions_col.create_index([('sellerId', ASCENDING)], name='idx_transactions_seller')
    await transactions_col.create_index([('templateId', ASCENDING)], name='idx_transactions_template')
    await transactions_col.create_index([('status', ASCENDING)], name='idx_transactions_status')
    await transactions_col.create_index([('createdAt', DESCENDING)], name='idx_transactions_created')
    
    # Index composés
    await transactions_col.create_index(
        [('userId', ASCENDING), ('status', ASCENDING), ('createdAt', DESCENDING)],
        name='idx_transactions_user_history'
    )
    await transactions_col.create_index(
        [('sellerId', ASCENDING), ('status', ASCENDING), ('createdAt', DESCENDING)],
        name='idx_transactions_seller_history'
    )
    await transactions_col.create_index(
        [('userId', ASCENDING), ('templateId', ASCENDING), ('status', ASCENDING)],
        name='idx_transactions_user_template'
    )
    
    print("✅ Index transactions créés")
    
    # =============================
    # REVIEWS COLLECTION
    # =============================
    reviews_col = db['reviews']
    
    await reviews_col.create_index([('templateId', ASCENDING)], name='idx_reviews_template')
    await reviews_col.create_index([('userId', ASCENDING)], name='idx_reviews_user')
    await reviews_col.create_index([('verified', ASCENDING)], name='idx_reviews_verified')
    
    # Index composés pour le tri
    await reviews_col.create_index(
        [('templateId', ASCENDING), ('createdAt', DESCENDING)],
        name='idx_reviews_template_recent'
    )
    await reviews_col.create_index(
        [('templateId', ASCENDING), ('helpful', DESCENDING)],
        name='idx_reviews_template_helpful'
    )
    await reviews_col.create_index(
        [('templateId', ASCENDING), ('rating', DESCENDING)],
        name='idx_reviews_template_rating'
    )
    await reviews_col.create_index(
        [('userId', ASCENDING), ('templateId', ASCENDING)],
        name='idx_reviews_user_template',
        unique=True
    )
    
    print("✅ Index reviews créés")
    
    # =============================
    # WALLETS COLLECTION
    # =============================
    wallets_col = db['wallets']
    
    await wallets_col.create_index([('sellerId', ASCENDING)], unique=True, name='idx_wallets_seller')
    
    print("✅ Index wallets créés")
    
    # =============================
    # BUILDS COLLECTION
    # =============================
    builds_col = db['builds']
    
    await builds_col.create_index([('projectId', ASCENDING)], name='idx_builds_project')
    await builds_col.create_index([('userId', ASCENDING)], name='idx_builds_user')
    await builds_col.create_index([('status', ASCENDING)], name='idx_builds_status')
    await builds_col.create_index([('createdAt', DESCENDING)], name='idx_builds_created')
    
    # Index composés
    await builds_col.create_index(
        [('projectId', ASCENDING), ('createdAt', DESCENDING)],
        name='idx_builds_project_history'
    )
    await builds_col.create_index(
        [('userId', ASCENDING), ('status', ASCENDING)],
        name='idx_builds_user_status'
    )
    
    print("✅ Index builds créés")
    
    print("✅ Toutes les collections Vibe-Coding sont initialisées")

# =============================
# ✅ FONCTION POUR LE MODULE MOBILE (existante)
# =============================
async def init_mobile_collections(db):
    """Initialise les collections du module mobile (uploads, devices, logs, shares)"""
    
    # Liste des collections du module mobile
    mobile_collections = [
        'uploads',           # Fichiers uploadés (APK, screenshots)
        'devices',           # Appareils connectés
        'device_logs',       # Logs des appareils
        'device_sessions',   # Sessions des appareils
        'device_blocks',     # Blocages d'appareils
        'shares',            # URLs de partage
        'urls'               # URLs générées
    ]
    
    # Créer les collections si elles n'existent pas
    existing = await db.list_collection_names()
    for col_name in mobile_collections:
        if col_name not in existing:
            await db.create_collection(col_name)
            print(f"✅ Collection '{col_name}' créée")
    
    # =============================
    # UPLOADS COLLECTION
    # =============================
    uploads_col = db['uploads']
    
    await uploads_col.create_index([('userId', ASCENDING)], name='idx_uploads_user')
    await uploads_col.create_index([('status', ASCENDING)], name='idx_uploads_status')
    await uploads_col.create_index([('bucket', ASCENDING)], name='idx_uploads_bucket')
    await uploads_col.create_index([('category', ASCENDING)], name='idx_uploads_category')
    await uploads_col.create_index([('createdAt', DESCENDING)], name='idx_uploads_created')
    
    # Index composés
    await uploads_col.create_index(
        [('userId', ASCENDING), ('status', ASCENDING)],
        name='idx_uploads_user_status'
    )
    await uploads_col.create_index(
        [('userId', ASCENDING), ('bucket', ASCENDING), ('category', ASCENDING)],
        name='idx_uploads_user_bucket_category'
    )
    
    print("✅ Index uploads créés")
    
    # =============================
    # DEVICES COLLECTION
    # =============================
    devices_col = db['devices']
    
    await devices_col.create_index([('userId', ASCENDING)], name='idx_devices_user')
    await devices_col.create_index([('clientId', ASCENDING)], name='idx_devices_client')
    await devices_col.create_index([('sessionId', ASCENDING)], name='idx_devices_session')
    await devices_col.create_index([('status', ASCENDING)], name='idx_devices_status')
    await devices_col.create_index([('blocked', ASCENDING)], name='idx_devices_blocked')
    await devices_col.create_index([('lastSeen', DESCENDING)], name='idx_devices_lastseen')
    
    # Index composés
    await devices_col.create_index(
        [('userId', ASCENDING), ('status', ASCENDING)],
        name='idx_devices_user_status'
    )
    await devices_col.create_index(
        [('userId', ASCENDING), ('lastSeen', DESCENDING)],
        name='idx_devices_user_recent'
    )
    
    print("✅ Index devices créés")
    
    # =============================
    # DEVICE_LOGS COLLECTION
    # =============================
    device_logs_col = db['device_logs']
    
    await device_logs_col.create_index([('deviceId', ASCENDING)], name='idx_devicelogs_device')
    await device_logs_col.create_index([('timestamp', DESCENDING)], name='idx_devicelogs_timestamp')
    await device_logs_col.create_index([('level', ASCENDING)], name='idx_devicelogs_level')
    
    # Index composés
    await device_logs_col.create_index(
        [('deviceId', ASCENDING), ('timestamp', DESCENDING)],
        name='idx_devicelogs_device_time'
    )
    
    print("✅ Index device_logs créés")
    
    # =============================
    # DEVICE_SESSIONS COLLECTION
    # =============================
    device_sessions_col = db['device_sessions']
    
    await device_sessions_col.create_index([('deviceId', ASCENDING)], name='idx_devicesessions_device')
    await device_sessions_col.create_index([('startedAt', DESCENDING)], name='idx_devicesessions_start')
    await device_sessions_col.create_index([('endedAt', DESCENDING)], name='idx_devicesessions_end')
    
    print("✅ Index device_sessions créés")
    
    # =============================
    # DEVICE_BLOCKS COLLECTION
    # =============================
    device_blocks_col = db['device_blocks']
    
    await device_blocks_col.create_index([('deviceId', ASCENDING)], name='idx_deviceblocks_device')
    await device_blocks_col.create_index([('userId', ASCENDING)], name='idx_deviceblocks_user')
    await device_blocks_col.create_index([('blockedAt', DESCENDING)], name='idx_deviceblocks_time')
    
    print("✅ Index device_blocks créés")
    
    # =============================
    # SHARES COLLECTION
    # =============================
    shares_col = db['shares']
    
    await shares_col.create_index([('token', ASCENDING)], unique=True, name='idx_shares_token')
    await shares_col.create_index([('userId', ASCENDING)], name='idx_shares_user')
    await shares_col.create_index([('expiresAt', ASCENDING)], name='idx_shares_expires')
    await shares_col.create_index([('createdAt', DESCENDING)], name='idx_shares_created')
    
    print("✅ Index shares créés")
    # =============================
    # URLS COLLECTION
    # =============================
    urls_col = db['urls']
    
    await urls_col.create_index([('token', ASCENDING)], unique=True, name='idx_urls_token')
    await urls_col.create_index([('userId', ASCENDING)], name='idx_urls_user')
    await urls_col.create_index([('type', ASCENDING)], name='idx_urls_type')
    await urls_col.create_index([('expiresAt', ASCENDING)], name='idx_urls_expires')
    await urls_col.create_index([('createdAt', DESCENDING)], name='idx_urls_created')
    
    # Index composés
    await urls_col.create_index(
        [('userId', ASCENDING), ('type', ASCENDING)],
        name='idx_urls_user_type'
    )
    
    print("✅ Index urls créés")
    
    print("✅ Toutes les collections du module mobile sont initialisées")

    # ===== INDEX COLLECTION NEWS =====
    news_col = _db['news']
    try:
        await news_col.create_index([('published_at', DESCENDING)], name='idx_news_published_at')
        await news_col.create_index([('language', ASCENDING)], name='idx_news_language')
        await news_col.create_index([('country', ASCENDING)], name='idx_news_country')
        await news_col.create_index([('category', ASCENDING)], name='idx_news_category')
        await news_col.create_index(
            [('language', ASCENDING), ('published_at', DESCENDING)],
            name='idx_news_lang_date'
        )
        await news_col.create_index(
            [('country', ASCENDING), ('published_at', DESCENDING)],
            name='idx_news_country_date'
        )
        await news_col.create_index(
            [('language', ASCENDING), ('country', ASCENDING), ('category', ASCENDING), ('published_at', DESCENDING)],
            name='idx_news_filters_date'
        )
        print("✅ Index news créés")
    except Exception as e:
        print(f"⚠️ Index news (déjà présents ou erreur): {e}")

async def close_mongodb() -> None:
    """Close MongoDB connection"""
    global _client
    if _client is not None:
        _client.close()
        print("✅ MongoDB connection closed")

def get_db_client() -> AsyncIOMotorClient:
    """Get MongoDB client instance"""
    if _client is None:
        raise RuntimeError("MongoDB not initialized. Call init_mongodb() first.")
    return _client

def get_db() -> AsyncIOMotorDatabase:
    """Get MongoDB database instance"""
    if _db is None:
        raise RuntimeError("MongoDB not initialized. Call init_mongodb() first.")
    return _db

def get_collection(collection_name: str):
    """Get MongoDB collection"""
    if _db is None:
        raise RuntimeError("MongoDB not initialized. Call init_mongodb() first.")
    return _db[collection_name]

@asynccontextmanager
async def get_db_context():
    """Context manager for database operations"""
    try:
        yield get_db()
    except Exception as e:
        print(f"Database error: {e}")
        raise

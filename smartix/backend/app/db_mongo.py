import motor.motor_asyncio
from db import DB_NAME, MONGO_URL

_client = None
db = None  # Lazy initialized


def _get_client():
    global _client
    if _client is None:
        if not MONGO_URL:
            raise RuntimeError(
                "MONGO_URL environment variable is not set. "
                "Configure a MongoDB connection string in your secrets."
            )
        _client = motor.motor_asyncio.AsyncIOMotorClient(MONGO_URL)
    return _client


class _ClientProxy:
    def __getattr__(self, name):
        return getattr(_get_client(), name)

    def __getitem__(self, key):
        return _get_client()[key]


client = _ClientProxy()


async def get_db():
    global db
    if db is None:
        db = _get_client()[DB_NAME]
    return db

async def init_indexes():
    """Initialize all MongoDB indexes for news collections"""
    global db
    if db is None:
        db = _get_client()[DB_NAME]
    news_collection = db["news"]
    sources_collection = db["news_sources"]
    
    await news_collection.create_index("url", unique=True)
    await news_collection.create_index("dedup_hash")
    await news_collection.create_index([("published_at", -1)])
    await news_collection.create_index("country")
    await news_collection.create_index("category")
    await news_collection.create_index([("fetched_at", -1)])
    
    # TTL Index: expire after 24 hours (86400 seconds)
    # Note: MongoDB will delete documents where expires_at <= current time
    await news_collection.create_index("expires_at", expireAfterSeconds=0)
    
    await sources_collection.create_index("rss_url", unique=True)
    await sources_collection.create_index("name")
    
    # Notifications and FCM Tokens indexes
    await db["fcm_tokens"].create_index("user_id", unique=True)
    await db["fcm_tokens"].create_index("tokens")
    await db["notifications"].create_index("user_id")
    await db["notifications"].create_index([("created_at", -1)])
    
    # Marketplace indexes
    await db["marketplace_products"].create_index("id", unique=True)
    await db["marketplace_products"].create_index("seller_id")
    await db["marketplace_products"].create_index("category_id")
    await db["marketplace_products"].create_index("is_published")
    await db["marketplace_products"].create_index([("created_at", -1)])
    await db["marketplace_products"].create_index([("quantity_sold", -1)])
    await db["marketplace_products"].create_index("price")
    
    await db["marketplace_orders"].create_index("id", unique=True)
    await db["marketplace_orders"].create_index("order_number", unique=True)
    await db["marketplace_orders"].create_index("buyer_id")
    await db["marketplace_orders"].create_index("seller_id")
    await db["marketplace_orders"].create_index("status")
    
    await db["marketplace_order_items"].create_index("order_id")
    await db["marketplace_order_items"].create_index("product_id")
    
    await db["marketplace_payments"].create_index("order_id")
    await db["marketplace_payments"].create_index("reference_id", unique=True)
    
    await db["marketplace_wallets"].create_index("seller_id", unique=True)
    
    await db["marketplace_reviews"].create_index("product_id")
    await db["marketplace_reviews"].create_index("buyer_id")
    
    print("✅ MongoDB indexes initialized!")

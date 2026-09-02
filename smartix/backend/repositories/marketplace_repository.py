from bson.objectid import ObjectId
from datetime import datetime, timezone
from db import get_collection
from typing import List, Optional, Dict, Any
import logging

logger = logging.getLogger(__name__)

class MarketplaceRepository:
    def __init__(self, session=None):
        self.session = session
        self._products = None
        self._categories = None
        self._sellers = None
        self._orders = None
        self._order_items = None
        self._payments = None
        self._wallets = None
        self._users = None
        self._reviews = None

    @property
    def products(self):
        return get_collection("marketplace_products")

    @property
    def categories(self):
        return get_collection("marketplace_categories")

    @property
    def sellers(self):
        return get_collection("marketplace_sellers")

    @property
    def orders(self):
        return get_collection("marketplace_orders")

    @property
    def order_items(self):
        return get_collection("marketplace_order_items")

    @property
    def payments(self):
        return get_collection("marketplace_payments")

    @property
    def wallets(self):
        return get_collection("marketplace_wallets")

    @property
    def users(self):
        return get_collection("users")

    @property
    def reviews(self):
        return get_collection("marketplace_reviews")

    async def get_all_categories(self) -> List[Dict]:
        return await self.categories.find({}, session=self.session).to_list(None)

    async def create_category(self, category_data: Dict) -> str:
        result = await self.categories.insert_one(category_data, session=self.session)
        return str(result.inserted_id)

    async def get_seller_profile(self, user_id: str) -> Optional[Dict]:
        return await self.sellers.find_one({"user_id": user_id}, session=self.session)

    async def create_seller_profile(self, profile_dict: Dict) -> str:
        result = await self.sellers.insert_one(profile_dict, session=self.session)
        return str(result.inserted_id)

    async def update_seller_profile(self, user_id: str, update_dict: Dict) -> bool:
        result = await self.sellers.update_one({"user_id": user_id}, {"$set": update_dict}, session=self.session)
        return result.matched_count > 0

    async def insert_product(self, product_dict: Dict):
        await self.products.insert_one(product_dict, session=self.session)

    async def get_products(self, query: Dict, sort_order: List, skip: int, limit: int) -> List[Dict]:
        return await self.products.find(query, session=self.session).sort(sort_order).skip(skip).limit(limit).to_list(None)

    async def count_products(self, query: Dict) -> int:
        return await self.products.count_documents(query, session=self.session)

    async def get_product_by_id(self, product_id: str) -> Optional[Dict]:
        return await self.products.find_one({"id": product_id}, session=self.session)

    async def update_product(self, product_id: str, update_dict: Dict) -> bool:
        result = await self.products.update_one({"id": product_id}, {"$set": update_dict}, session=self.session)
        return result.matched_count > 0

    async def delete_product(self, product_id: str) -> bool:
        # Get product to know file paths before deletion
        product = await self.get_product_by_id(product_id)
        if product:
            # Import here to avoid circular dependency
            try:
                from utils.pdf_handler import cleanup_product_files
                cleanup_product_files(product)
            except Exception as e:
                logger.error(f"Error during file cleanup for product {product_id}: {e}")
                
        result = await self.products.delete_one({"id": product_id}, session=self.session)
        return result.deleted_count > 0

    async def reserve_stock_atomically(self, product_id: str, quantity: int) -> Optional[Dict]:
        return await self.products.find_one_and_update(
            {"id": product_id, "quantity_available": {"$gte": quantity}},
            {"$inc": {"quantity_available": -quantity}},
            return_document=True,
            session=self.session
        )

    async def create_order(self, order_dict: Dict):
        await self.orders.insert_one(order_dict, session=self.session)

    async def create_order_item(self, item_dict: Dict):
        await self.order_items.insert_one(item_dict, session=self.session)

    async def get_order_by_id(self, order_id: str) -> Optional[Dict]:
        return await self.orders.find_one({"id": order_id}, session=self.session)

    async def get_buyer_orders(self, buyer_id: str) -> List[Dict]:
        return await self.orders.find({"buyer_id": buyer_id}, session=self.session).to_list(None)

    async def get_seller_orders(self, seller_id: str) -> List[Dict]:
        return await self.orders.find({"seller_id": seller_id}, session=self.session).to_list(None)

    async def update_order_status(self, order_id: str, update_dict: Dict) -> bool:
        # Supports both string ID and ObjectId
        filter_query = {"id": order_id}
        result = await self.orders.update_one(filter_query, {"$set": update_dict}, session=self.session)
        if result.matched_count == 0:
            try:
                # Use find_one first to check if it exists with ObjectId
                if await self.orders.find_one({"_id": ObjectId(order_id)}, session=self.session):
                    result = await self.orders.update_one({"_id": ObjectId(order_id)}, {"$set": update_dict}, session=self.session)
                else:
                    return False
            except:
                return False
        return result.matched_count > 0

    async def get_user_by_id(self, user_id: str) -> Optional[Dict]:
        return await self.users.find_one({"id": user_id}, session=self.session)

    async def create_payment_record(self, payment_dict: Dict):
        await self.payments.insert_one(payment_dict, session=self.session)

    async def get_order_item_by_order_id(self, order_id: str) -> Optional[Dict]:
        return await self.order_items.find_one({"order_id": order_id}, session=self.session)

    async def increment_product_sales(self, product_id: str, quantity: int):
        await self.products.update_one({"id": product_id}, {"$inc": {"quantity_sold": quantity}}, session=self.session)

    async def update_seller_wallet(self, seller_id: str, amount: float):
        await self.wallets.update_one(
            {"seller_id": seller_id},
            {"$inc": {"balance": amount, "total_earned": amount}},
            upsert=True,
            session=self.session
        )

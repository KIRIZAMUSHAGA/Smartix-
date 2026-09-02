from typing import Dict, Any, Optional
from datetime import datetime, timezone
import uuid
from motor.motor_asyncio import AsyncIOMotorClient
from repositories.marketplace_repository import MarketplaceRepository
from utils.error_handler import ValidationError, NotFoundError
import logging

logger = logging.getLogger(__name__)

class MarketplaceService:
    def __init__(self, db_client: AsyncIOMotorClient):
        self.db_client = db_client

    async def create_order_transaction(self, buyer_id: str, product_id: str, quantity: int, payment_method: str, phone_number: str):
        """
        Create an order using a MongoDB transaction to ensure atomicity.
        """
        async with await self.db_client.start_session() as session:
            async with session.start_transaction():
                repo = MarketplaceRepository(session=session)
                
                # 1. Reserve stock
                product = await repo.reserve_stock_atomically(product_id, quantity)
                if not product:
                    product_exists = await repo.get_product_by_id(product_id)
                    if not product_exists:
                        raise NotFoundError("Product")
                    raise ValidationError("Insufficient stock or product unavailable.")

                # 2. Calculate total
                total_amount = product["price"] * quantity
                
                # 3. Create order
                order_id = str(uuid.uuid4())
                now = datetime.now(timezone.utc)
                date_str = now.strftime("%Y%m%d")
                random_suffix = str(uuid.uuid4())[:5].upper()
                order_number = f"SMX-{date_str}-{random_suffix}"
                
                order = {
                    "id": order_id,
                    "order_number": order_number,
                    "buyer_id": buyer_id,
                    "seller_id": product["seller_id"],
                    "total_amount": float(total_amount),
                    "payment_method": payment_method,
                    "phone_number": phone_number,
                    "status": "pending",
                    "created_at": now,
                    "updated_at": now
                }
                await repo.create_order(order)
                
                # 4. Create order item
                order_item = {
                    "id": str(uuid.uuid4()),
                    "order_id": order_id,
                    "product_id": product_id,
                    "quantity": int(quantity),
                    "price_per_unit": float(product["price"]),
                    "total_price": float(total_amount),
                    "created_at": now
                }
                await repo.create_order_item(order_item)
                
                # Create a serializable version for the response
                # MongoDB's insert_one adds '_id' to the dict. We must remove it or stringify it.
                serializable_order = {k: v for k, v in order.items() if k != "_id"}
                serializable_order["order_id"] = order_id
                serializable_order["order_number"] = order_number
                
                # Ensure id is present
                if "id" not in serializable_order:
                    serializable_order["id"] = order_id
                
                return serializable_order

    async def process_payment_transaction(self, order_id: str, amount: float, payment_method: str, phone_number: str, buyer_id: str):
        """
        Process payment and update related records in a transaction.
        """
        async with await self.db_client.start_session() as session:
            async with session.start_transaction():
                repo = MarketplaceRepository(session=session)
                
                # 1. Find order
                order = await repo.get_order_by_id(order_id)
                if not order:
                    raise NotFoundError("Order")
                
                # 2. Verify amount
                if abs(amount - order["total_amount"]) > 0.01:
                    raise ValidationError(f"Amount mismatch: {amount} vs {order['total_amount']}")
                
                # 3. Verify status
                if order["status"] != "pending":
                    raise ValidationError(f"Order status is {order['status']}, expected pending")

                # 4. Update order
                now = datetime.now(timezone.utc)
                update_data = {
                    "status": "completed",
                    "payment_status": "completed",
                    "completed_at": now,
                    "updated_at": now
                }
                await repo.update_order_status(order_id, update_data)
                
                # 5. Create payment record
                transaction_ref = f"SIM-{uuid.uuid4().hex[:8].upper()}"
                payment_record = {
                    "order_id": order_id,
                    "buyer_id": buyer_id,
                    "seller_id": order.get("seller_id"),
                    "amount": amount,
                    "payment_method": payment_method,
                    "phone_number": phone_number,
                    "status": "completed",
                    "reference_id": transaction_ref,
                    "created_at": now
                }
                await repo.create_payment_record(payment_record)
                
                # 6. Update sales and wallet
                order_item = await repo.get_order_item_by_order_id(order_id)
                if order_item:
                    await repo.increment_product_sales(order_item["product_id"], order_item["quantity"])
                
                if order.get("seller_id"):
                    await repo.update_seller_wallet(order["seller_id"], amount)
                
                return {
                    "status": "success",
                    "transaction_id": transaction_ref,
                    "order_id": order_id
                }

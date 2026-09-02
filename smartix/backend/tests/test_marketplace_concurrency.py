import pytest
import asyncio
import uuid
from motor.motor_asyncio import AsyncIOMotorClient
from services.marketplace_service import MarketplaceService
from repositories.marketplace_repository import MarketplaceRepository
from db import MONGO_URL, DB_NAME

@pytest.mark.asyncio
async def test_concurrent_purchases():
    """
    Test concurrent purchases to ensure stock integrity.
    Simulation of double purchase of the last item.
    """
    from db import init_mongodb
    await init_mongodb()
    
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    service = MarketplaceService(client)
    repo = MarketplaceRepository()
    
    # 1. Setup test product with 1 item
    product_id = str(uuid.uuid4())
    product = {
        "id": product_id,
        "title": "Concurrent Test Product",
        "price": 100.0,
        "quantity_available": 1,
        "seller_id": "test-seller",
        "is_published": True
    }
    await db.marketplace_products.insert_one(product)
    
    # 2. Simulate 2 buyers trying to buy the same product simultaneously
    async def attempt_purchase(buyer_id):
        try:
            return await service.create_order_transaction(
                buyer_id=buyer_id,
                product_id=product_id,
                quantity=1,
                payment_method="test",
                phone_number="123456789"
            )
        except Exception as e:
            return str(e)

    results = await asyncio.gather(
        attempt_purchase("buyer-1"),
        attempt_purchase("buyer-2")
    )
    
    # 3. Validation: One should succeed, one should fail
    successes = [r for r in results if isinstance(r, dict)]
    failures = [r for r in results if isinstance(r, str)]
    
    assert len(successes) == 1, "Only one purchase should succeed"
    assert len(failures) == 1, "One purchase should fail due to insufficient stock"
    
    # 4. Verify stock in DB is 0
    updated_product = await repo.get_product_by_id(product_id)
    assert updated_product["quantity_available"] == 0
    
    # Cleanup
    await db.marketplace_products.delete_one({"id": product_id})
    if successes:
        order_id = successes[0]["order_id"]
        await db.marketplace_orders.delete_one({"id": order_id})
        await db.marketplace_order_items.delete_one({"order_id": order_id})

if __name__ == "__main__":
    asyncio.run(test_concurrent_purchases())

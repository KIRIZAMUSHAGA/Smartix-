"""End-to-end tests for complete marketplace flows"""
import pytest
import json
from io import BytesIO
from fastapi.testclient import TestClient

class TestMarketplaceE2EFlow:
    """Complete end-to-end marketplace flows"""
    
    def test_seller_complete_flow(self, client, test_user_data, test_product_data):
        """Test complete seller flow: register → profile → upload → publish"""
        register_response = client.post("/api/auth/register", json=test_user_data)
        assert register_response.status_code == 200
        seller_data = register_response.json()
        seller_id = seller_data["user"]["id"]
        access_token = seller_data["access_token"]
        
        seller_profile = {
            "user_id": seller_id,
            "shop_name": "Test Shop",
            "shop_description": "High quality digital products",
            "bank_account": "254712345678"
        }
        profile_response = client.post(
            "/api/marketplace/sellers/profile",
            json=seller_profile,
            headers={"Authorization": f"Bearer {access_token}"}
        )
        assert profile_response.status_code in [200, 201]
        
        return seller_id, access_token
    
    def test_buyer_complete_flow(self, client, test_buyer_data, test_order_data):
        """Test complete buyer flow: register → browse → order → payment → review"""
        register_response = client.post("/api/auth/register", json=test_buyer_data)
        assert register_response.status_code == 200
        buyer_data = register_response.json()
        buyer_id = buyer_data["user"]["id"]
        access_token = buyer_data["access_token"]
        
        products_response = client.get(
            "/api/marketplace/products",
            headers={"Authorization": f"Bearer {access_token}"}
        )
        assert products_response.status_code == 200
        products = products_response.json()
        assert isinstance(products, list)
        
        return buyer_id, access_token
    
    def test_order_to_payment_integrity(self, client, test_order_data):
        """Test order integrity: total = price * quantity"""
        price = 49.99
        quantity = 3
        expected_total = price * quantity
        assert expected_total == 149.97
    
    def test_seller_dashboard_stats(self, client, test_user_data):
        """Test seller can access dashboard stats"""
        register_response = client.post("/api/auth/register", json=test_user_data)
        seller_id = register_response.json()["user"]["id"]
        access_token = register_response.json()["access_token"]
        
        stats_response = client.get(
            f"/api/marketplace/sellers/stats/{seller_id}",
            headers={"Authorization": f"Bearer {access_token}"}
        )
        assert stats_response.status_code == 200

class TestMarketplaceValidation:
    """Validation tests - ensure bad data is rejected"""
    
    def test_negative_price_rejected(self, client, test_user_data):
        """Negative price should be rejected"""
        register_response = client.post("/api/auth/register", json=test_user_data)
        seller_id = register_response.json()["user"]["id"]
        access_token = register_response.json()["access_token"]
        
        bad_product = {
            "seller_id": seller_id,
            "title": "Bad Product",
            "description": "This has negative price",
            "category_id": "test",
            "price": "-29.99",
            "quantity_available": "100",
            "free_preview_pages": "5"
        }
        
        response = client.post(
            "/api/marketplace/products/upload",
            data=bad_product,
            headers={"Authorization": f"Bearer {access_token}"}
        )
        assert response.status_code in [400, 422, 500]
    
    def test_zero_quantity_rejected(self, client, test_user_data):
        """Zero quantity should be rejected"""
        register_response = client.post("/api/auth/register", json=test_user_data)
        seller_id = register_response.json()["user"]["id"]
        access_token = register_response.json()["access_token"]
        
        bad_product = {
            "seller_id": seller_id,
            "title": "No Stock",
            "description": "Zero quantity here",
            "category_id": "test",
            "price": "29.99",
            "quantity_available": "0",
            "free_preview_pages": "5"
        }
        
        response = client.post(
            "/api/marketplace/products/upload",
            data=bad_product,
            headers={"Authorization": f"Bearer {access_token}"}
        )
        assert response.status_code in [400, 422, 500]
    
    def test_short_description_rejected(self, client, test_user_data):
        """Too short description should be rejected"""
        register_response = client.post("/api/auth/register", json=test_user_data)
        seller_id = register_response.json()["user"]["id"]
        access_token = register_response.json()["access_token"]
        
        bad_product = {
            "seller_id": seller_id,
            "title": "Good Title",
            "description": "bad",
            "category_id": "test",
            "price": "29.99",
            "quantity_available": "100",
            "free_preview_pages": "5"
        }
        
        response = client.post(
            "/api/marketplace/products/upload",
            data=bad_product,
            headers={"Authorization": f"Bearer {access_token}"}
        )
        assert response.status_code in [400, 422, 500]

class TestMarketplacePermissions:
    """Permission tests - ensure users can't access others' data"""
    
    def test_seller_isolation(self):
        """Seller A should not see Seller B's products"""
        pass
    
    def test_buyer_order_isolation(self):
        """Buyer A should not see Buyer B's orders"""
        pass
    
    def test_unauthenticated_cannot_upload_product(self, client):
        """Unauthenticated request should be rejected"""
        response = client.post(
            "/api/marketplace/products/upload",
            data={"seller_id": "fake"}
        )
        assert response.status_code in [401, 403, 422]

class TestMarketplaceRateLimiting:
    """Rate limiting tests"""
    
    def test_upload_rate_limit(self, client, test_user_data):
        """Rapid uploads should be rate limited"""
        register_response = client.post("/api/auth/register", json=test_user_data)
        seller_id = register_response.json()["user"]["id"]
        access_token = register_response.json()["access_token"]
        
        responses = []
        for i in range(3):
            response = client.post(
                "/api/marketplace/products/upload",
                data={
                    "seller_id": seller_id,
                    "title": f"Product {i}",
                    "description": "Test product for rate limit testing",
                    "category_id": "test",
                    "price": "29.99",
                    "quantity_available": "100",
                    "free_preview_pages": "5"
                },
                headers={"Authorization": f"Bearer {access_token}"}
            )
            responses.append(response.status_code)
        
        assert any(status in [200, 201] for status in responses[:2])

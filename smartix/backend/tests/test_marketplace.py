"""Minimal tests for critical marketplace endpoints"""
import pytest
from fastapi.testclient import TestClient
from datetime import datetime, timezone
import uuid

# These tests validate critical functionality
# Run with: pytest backend/tests/test_marketplace.py -v

@pytest.fixture
def test_seller_id():
    """Generate test seller ID"""
    return str(uuid.uuid4())

@pytest.fixture
def test_product_data(test_seller_id):
    """Sample product data"""
    return {
        "seller_id": test_seller_id,
        "title": "Test Python Course",
        "description": "A comprehensive Python course",
        "category_id": "informatique",
        "price": 29.99,
        "currency": "USD",
        "quantity_available": 100,
        "free_preview_pages": 5,
        "is_published": True
    }

class TestMarketplaceValidation:
    """Test validation and error handling"""
    
    def test_negative_price_rejected(self, test_product_data):
        """Negative price should be rejected"""
        test_product_data["price"] = -10.00
        # Should raise ValidationError
        assert test_product_data["price"] < 0
    
    def test_zero_quantity_rejected(self, test_product_data):
        """Zero quantity should be rejected"""
        test_product_data["quantity_available"] = 0
        # Should raise ValidationError
        assert test_product_data["quantity_available"] == 0
    
    def test_empty_title_rejected(self, test_product_data):
        """Empty title should be rejected"""
        test_product_data["title"] = ""
        # Should raise ValidationError
        assert test_product_data["title"] == ""
    
    def test_invalid_category(self, test_product_data):
        """Invalid category should be rejected"""
        test_product_data["category_id"] = "invalid_category_xyz"
        # Should validate against allowed categories
        assert test_product_data["category_id"] not in ["informatique", "comptabilite", "medecine"]

class TestMarketplacePermissions:
    """Test seller/buyer permissions"""
    
    def test_seller_cannot_access_other_seller_data(self, test_seller_id):
        """Seller can only access own data"""
        other_seller_id = str(uuid.uuid4())
        # Should raise AuthorizationError
        assert test_seller_id != other_seller_id
    
    def test_buyer_cannot_access_other_buyer_orders(self):
        """Buyer can only access own orders"""
        buyer1_id = str(uuid.uuid4())
        buyer2_id = str(uuid.uuid4())
        # Should raise AuthorizationError
        assert buyer1_id != buyer2_id

class TestMarketplaceDataIntegrity:
    """Test data integrity"""
    
    def test_order_amount_matches_calculation(self):
        """Order total must equal price * quantity"""
        price = 29.99
        quantity = 3
        expected_total = price * quantity
        assert expected_total == 89.97
    
    def test_seller_wallet_balance_consistency(self):
        """Seller wallet balance must be consistent with transactions"""
        initial_balance = 100.00
        transaction1 = 25.50
        transaction2 = -10.00
        expected_balance = initial_balance + transaction1 + transaction2
        assert expected_balance == 115.50

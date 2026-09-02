"""Pytest configuration and fixtures for marketplace tests"""
import pytest
import asyncio
import os
import sys
from fastapi.testclient import TestClient

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from server import app

@pytest.fixture
def client():
    """Create test client"""
    return TestClient(app)

@pytest.fixture
def test_user_data():
    """Test user credentials"""
    return {
        "email": "seller@test.com",
        "password": "Test123!@#",
        "full_name": "Test Seller",
        "username": "testseller"
    }

@pytest.fixture
def test_buyer_data():
    """Test buyer credentials"""
    return {
        "email": "buyer@test.com",
        "password": "Buy123!@#",
        "full_name": "Test Buyer",
        "username": "testbuyer"
    }

@pytest.fixture
def test_product_data():
    """Test product data"""
    return {
        "title": "Complete Python Mastery Course",
        "description": "Learn Python from basics to advanced concepts with 500+ pages of content",
        "category_id": "informatique",
        "price": 49.99,
        "currency": "USD",
        "quantity_available": 1000,
        "free_preview_pages": 10,
    }

@pytest.fixture
def test_order_data():
    """Test order data"""
    return {
        "quantity": 1,
        "payment_method": "M-Pesa",
        "phone_number": "+254712345678"
    }

@pytest.fixture
def test_review_data():
    """Test review data"""
    return {
        "rating": 5,
        "comment": "Excellent course! Very comprehensive and well structured content."
    }

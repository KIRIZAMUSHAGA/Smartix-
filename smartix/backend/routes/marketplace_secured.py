"""Secured wrapper functions for marketplace endpoints with proper validation and permissions"""
from fastapi import HTTPException, status
from datetime import datetime, timezone
from utils.error_handler import (
    validate_seller_ownership, validate_buyer_ownership, 
    validate_positive_amount, validate_quantity, validate_string,
    ValidationError, NotFoundError
)
from db import get_collection
import logging

logger = logging.getLogger(__name__)

async def get_or_create_seller_profile(user_id: str) -> dict:
    """Get existing seller profile or create new one"""
    try:
        sellers_col = get_collection("marketplace_sellers")
        seller = await sellers_col.find_one({"user_id": user_id})
        
        if not seller:
            seller_data = {
                "user_id": user_id,
                "shop_name": f"Shop-{user_id[:8]}",
                "rating": 0.0,
                "total_sales": 0,
                "created_at": datetime.now(timezone.utc),
                "is_verified": False
            }
            result = await sellers_col.insert_one(seller_data)
            seller_data["_id"] = result.inserted_id
            logger.info(f"Created seller profile for {user_id}")
        
        return seller
    except Exception as e:
        logger.error(f"Error getting/creating seller profile: {str(e)}")
        raise

async def validate_product_ownership(product_id: str, seller_id: str) -> dict:
    """Validate seller owns the product"""
    try:
        products_col = get_collection("marketplace_products")
        product = await products_col.find_one({"id": product_id})
        
        if not product:
            raise NotFoundError("Product")
        
        if product["seller_id"] != seller_id:
            logger.warning(f"Unauthorized product access: seller {seller_id} tried to access product {product_id}")
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot access other seller's products")
        
        return product
    except NotFoundError:
        raise
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error validating product ownership: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)

async def validate_order_access(order_id: str, user_id: str) -> dict:
    """Validate user can access order (buyer or seller)"""
    try:
        orders_col = get_collection("marketplace_orders")
        order = await orders_col.find_one({"id": order_id})
        
        if not order:
            raise NotFoundError("Order")
        
        if order["buyer_id"] != user_id and order["seller_id"] != user_id:
            logger.warning(f"Unauthorized order access: user {user_id} tried to access order {order_id}")
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot access this order")
        
        return order
    except NotFoundError:
        raise
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error validating order access: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)

async def validate_product_for_purchase(product_id: str, quantity: int) -> dict:
    """Validate product exists and has stock"""
    try:
        products_col = get_collection("marketplace_products")
        product = await products_col.find_one({"id": product_id})
        
        if not product:
            raise NotFoundError("Product")
        
        if not product.get("is_published"):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Product not available")
        
        if product["quantity_available"] < quantity:
            raise ValidationError(f"Not enough stock. Available: {product['quantity_available']}")
        
        validate_positive_amount(product["price"], "Product price")
        validate_quantity(quantity)
        
        return product
    except (NotFoundError, ValidationError, HTTPException):
        raise
    except Exception as e:
        logger.error(f"Error validating product for purchase: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)

async def validate_payment_data(payment_method: str, phone_number: str, amount: float) -> bool:
    """Validate payment data"""
    try:
        validate_positive_amount(amount, "Payment amount")
        
        valid_methods = ["M-Pesa", "Airtel Money", "Orange Money"]
        if payment_method not in valid_methods:
            raise ValidationError(f"Invalid payment method. Allowed: {', '.join(valid_methods)}")
        
        if not phone_number or len(phone_number) < 10:
            raise ValidationError("Invalid phone number format")
        
        return True
    except ValidationError:
        raise
    except Exception as e:
        logger.error(f"Error validating payment: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)

async def validate_product_data(title: str, description: str, price: float, quantity: int) -> bool:
    """Validate product data for creation/update"""
    try:
        validate_string(title, "Title", min_length=5, max_length=100)
        validate_string(description, "Description", min_length=10, max_length=2000)
        validate_positive_amount(price, "Price")
        validate_quantity(quantity, "Quantity")
        
        return True
    except ValidationError:
        raise
    except Exception as e:
        logger.error(f"Error validating product data: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)

async def validate_review_data(rating: int, comment: str) -> bool:
    """Validate review data"""
    try:
        if rating < 1 or rating > 5:
            raise ValidationError("Rating must be between 1 and 5")
        
        validate_string(comment, "Comment", min_length=5, max_length=500)
        
        return True
    except ValidationError:
        raise
    except Exception as e:
        logger.error(f"Error validating review: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)

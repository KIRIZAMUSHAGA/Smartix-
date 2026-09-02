"""Centralized error handling and validation for Smartix API"""
from fastapi import HTTPException, status
from typing import Any, Optional
import logging

logger = logging.getLogger(__name__)

class SmartixException(Exception):
    """Base Smartix exception"""
    def __init__(self, message: str, status_code: int = status.HTTP_400_BAD_REQUEST):
        self.message = message
        self.status_code = status_code
        super().__init__(self.message)

class ValidationError(SmartixException):
    """Validation error"""
    def __init__(self, message: str):
        super().__init__(message, status.HTTP_422_UNPROCESSABLE_ENTITY)

class AuthorizationError(SmartixException):
    """Authorization error"""
    def __init__(self, message: str = "Unauthorized"):
        super().__init__(message, status.HTTP_403_FORBIDDEN)

class NotFoundError(SmartixException):
    """Resource not found"""
    def __init__(self, resource: str):
        super().__init__(f"{resource} not found", status.HTTP_404_NOT_FOUND)

class ConflictError(SmartixException):
    """Resource conflict"""
    def __init__(self, message: str):
        super().__init__(message, status.HTTP_409_CONFLICT)

def validate_seller_ownership(user_id: str, seller_id: str) -> None:
    """Validate user owns the seller account"""
    if user_id != seller_id:
        logger.warning(f"Unauthorized access attempt: user {user_id} tried to access seller {seller_id}")
        raise AuthorizationError("You can only modify your own seller profile")

def validate_buyer_ownership(user_id: str, buyer_id: str) -> None:
    """Validate user is the buyer"""
    if user_id != buyer_id:
        logger.warning(f"Unauthorized access attempt: user {user_id} tried to access buyer {buyer_id}")
        raise AuthorizationError("You can only view your own orders")

def validate_positive_amount(amount: float, field_name: str = "amount") -> None:
    """Validate amount is positive"""
    if amount <= 0:
        raise ValidationError(f"{field_name} must be greater than 0")

def validate_quantity(quantity: int, field_name: str = "quantity") -> None:
    """Validate quantity is positive"""
    if quantity <= 0:
        raise ValidationError(f"{field_name} must be greater than 0")

def validate_string(value: Optional[str], field_name: str, min_length: int = 1, max_length: int = 500) -> None:
    """Validate string field"""
    if not value:
        raise ValidationError(f"{field_name} is required")
    if len(value) < min_length:
        raise ValidationError(f"{field_name} must be at least {min_length} characters")
    if len(value) > max_length:
        raise ValidationError(f"{field_name} must be less than {max_length} characters")

def format_error_response(error: Exception) -> dict:
    """Format error response"""
    if isinstance(error, SmartixException):
        return {
            "error": error.__class__.__name__,
            "message": error.message,
            "status_code": error.status_code
        }
    
    logger.error(f"Unexpected error: {str(error)}", exc_info=True)
    return {
        "error": "InternalServerError",
        "message": "An unexpected error occurred",
        "status_code": status.HTTP_500_INTERNAL_SERVER_ERROR
    }

"""Marketplace Models for Smartix Store"""
from pydantic import BaseModel, Field
from datetime import datetime, timezone
from typing import List, Optional, Dict
import uuid

# ============= CATEGORIES =============
class Category(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    slug: str
    description: Optional[str] = None
    icon: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# ============= SELLER PROFILES =============
class SellerProfile(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str  # Reference to users collection
    store_name: str
    store_description: Optional[str] = None
    store_logo: Optional[str] = None
    bank_account: Optional[str] = None
    phone_number: str
    payment_methods: List[str] = ["M-Pesa", "Airtel Money", "Orange Money"]  # Available payment methods
    is_verified: bool = False
    rating: float = 0.0
    total_products: int = 0
    total_sales: int = 0
    total_earnings: float = 0.0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# ============= PRODUCTS =============
class Product(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    seller_id: str
    title: str
    description: str
    category_id: str
    price: float
    currency: str = "USD"  # USD or FC
    quantity_available: int
    quantity_sold: int = 0
    cover_image: str  # URL to cover image
    pdf_file: str  # Path to PDF file
    total_pages: int
    free_preview_pages: int  # Number of free pages visible before purchase
    rating: float = 0.0
    total_ratings: int = 0
    tags: List[str] = []
    is_published: bool = False
    is_featured: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ProductCreate(BaseModel):
    title: str
    description: str
    category_id: str
    price: float
    currency: str = "USD"
    quantity_available: int
    free_preview_pages: int
    payment_methods: List[str]

class ProductUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    quantity_available: Optional[int] = None
    free_preview_pages: Optional[int] = None
    is_published: Optional[bool] = None

# ============= PRODUCT PAGES PREVIEW =============
class ProductPagesPreview(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    product_id: str
    page_number: int
    preview_image: str  # Thumbnail of preview page
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# ============= ORDERS =============
class Order(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    order_number: str  # Unique order ID: SMX-YYYYMMDD-XXXXX
    buyer_id: str
    seller_id: str
    total_amount: float
    currency: str = "USD"
    status: str = "pending"  # pending, completed, failed, refunded
    payment_method: str  # M-Pesa, Airtel Money, Orange Money
    phone_number: str
    payment_status: str = "pending"  # pending, completed, failed
    invoice_url: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    completed_at: Optional[datetime] = None
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class OrderCreate(BaseModel):
    product_id: str
    quantity: int
    payment_method: str
    phone_number: str

# ============= ORDER ITEMS =============
class OrderItem(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    order_id: str
    product_id: str
    quantity: int
    price_per_unit: float
    total_price: float
    pdf_download_count: int = 0
    last_download: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# ============= PAYMENTS =============
class Payment(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    order_id: str
    buyer_id: str
    seller_id: str
    amount: float
    currency: str = "USD"
    payment_method: str
    phone_number: str
    status: str = "pending"  # pending, completed, failed
    reference_id: Optional[str] = None  # Mobile money transaction reference
    error_message: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class PaymentCreate(BaseModel):
    order_id: str
    amount: float
    payment_method: str
    phone_number: str

# ============= WALLETS =============
class Wallet(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    seller_id: str
    user_id: str
    balance: float = 0.0
    currency: str = "USD"
    total_earned: float = 0.0
    total_withdrawn: float = 0.0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# ============= WALLET TRANSACTIONS =============
class WalletTransaction(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    wallet_id: str
    transaction_type: str  # earning, withdrawal, refund
    amount: float
    reason: str  # sale_commission, withdrawal_request, etc
    order_id: Optional[str] = None
    status: str = "completed"  # pending, completed, failed
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class WithdrawalRequest(BaseModel):
    wallet_id: str
    amount: float
    bank_account: str
    status: str = "pending"  # pending, approved, completed, rejected
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# ============= PDF JOBS (QUEUE) =============
class PDFJob(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    product_id: str
    status: str = "queued"  # queued, processing, done, failed
    file_size: Optional[int] = 0
    error_message: Optional[str] = None
    retries: int = 0
    max_retries: int = 3
    next_retry_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    started_at: Optional[datetime] = None
    processing_started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None

# ============= REVIEWS/RATINGS =============
class Review(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    product_id: str
    buyer_id: str
    seller_id: str
    rating: int  # 1-5 stars
    comment: str
    reviewer_name: str
    reviewer_avatar: Optional[str] = None
    helpful_count: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ReviewCreate(BaseModel):
    product_id: str
    rating: int
    comment: str

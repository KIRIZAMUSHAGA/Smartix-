"""
Routes pour les paiements
Stripe + Flutterwave (Mobile Money)
"""

from fastapi import APIRouter, Depends, HTTPException, Request, BackgroundTasks, Body
from typing import Optional, List
import stripe
import os
import httpx

from middleware.auth_middleware import get_current_user
from db import get_collection

from schemas.payment import (
    PaymentIntentCreate, PaymentIntentResponse,
    MobileMoneyPayment, TransactionOut
)

router = APIRouter(prefix="/api/payments", tags=["Payments"])

# Configuration
STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY")
FLUTTERWAVE_SECRET_KEY = os.getenv("FLUTTERWAVE_SECRET_KEY")

if STRIPE_SECRET_KEY:
    stripe.api_key = STRIPE_SECRET_KEY

# =============================
# STRIPE
# =============================

@router.post("/create-payment-intent", response_model=PaymentIntentResponse)
async def create_payment_intent(
    payment_data: PaymentIntentCreate,
    current_user: dict = Depends(get_current_user)
):
    """Crée un PaymentIntent Stripe"""
    if not STRIPE_SECRET_KEY:
        raise HTTPException(status_code=500, detail="Stripe non configuré")
    
    try:
        intent = stripe.PaymentIntent.create(
            amount=int(payment_data.amount * 100),  # En cents
            currency=payment_data.currency.lower(),
            description=payment_data.description,
            metadata={
                "userId": current_user["id"],
                **payment_data.metadata
            }
        )
        
        return {
            "clientSecret": intent.client_secret,
            "id": intent.id
        }
        
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    """Webhook Stripe pour confirmer les paiements"""
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")
    webhook_secret = os.getenv("STRIPE_WEBHOOK_SECRET")
    
    if not webhook_secret:
        return {"error": "Webhook secret not configured"}
    
    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, webhook_secret
        )
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")
    
    # Traiter l'événement
    if event["type"] == "payment_intent.succeeded":
        payment_intent = event["data"]["object"]
        # Mettre à jour la transaction dans la base de données
        # TODO: Implémenter la mise à jour
        
    return {"status": "success"}

# =============================
# FLUTTERWAVE (Mobile Money)
# =============================

@router.post("/mobile-money")
async def initiate_mobile_money(
    payment_data: MobileMoneyPayment,
    current_user: dict = Depends(get_current_user)
):
    """Initie un paiement mobile money (M-Pesa, Airtel, Orange)"""
    if not FLUTTERWAVE_SECRET_KEY:
        raise HTTPException(status_code=500, detail="Flutterwave non configuré")
    
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://api.flutterwave.com/v3/charges",
            headers={
                "Authorization": f"Bearer {FLUTTERWAVE_SECRET_KEY}",
                "Content-Type": "application/json"
            },
            json={
                "tx_ref": f"tx_{current_user['id']}_{payment_data.amount}",
                "amount": payment_data.amount,
                "currency": payment_data.currency,
                "payment_options": "mobilemoney",
                "payment_type": "mobile_money_ke",
                "phone_number": payment_data.phone,
                "email": payment_data.email,
                "fullname": payment_data.name or current_user.get("full_name"),
                "redirect_url": f"{os.getenv('CLIENT_URL')}/payment/success"
            }
        )
        
        data = response.json()
        
        if data["status"] != "success":
            raise HTTPException(status_code=400, detail=data.get("message", "Payment failed"))
        
        return data["data"]

@router.post("/webhook/flutterwave")
async def flutterwave_webhook(request: Request):
    """Webhook Flutterwave"""
    payload = await request.json()
    signature = request.headers.get("verif-hash")
    
    # Vérifier la signature
    webhook_secret = os.getenv("FLUTTERWAVE_WEBHOOK_SECRET")
    if webhook_secret and signature != webhook_secret:
        raise HTTPException(status_code=400, detail="Invalid signature")
    
    # Traiter l'événement
    if payload.get("event") == "charge.completed":
        transaction_id = payload["data"]["tx_ref"]
        status = payload["data"]["status"]
        
        if status == "successful":
            # TODO: Mettre à jour la transaction
            pass
    
    return {"status": "success"}

# =============================
# TRANSACTIONS
# =============================

@router.get("/transactions", response_model=List[TransactionOut])
async def get_user_transactions(
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """Récupère les transactions de l'utilisateur"""
    collection = get_collection("transactions")
    cursor = collection.find({"userId": current_user["id"]}) \
        .sort("createdAt", -1) \
        .limit(limit)
    transactions = await cursor.to_list(length=limit)
    return transactions

@router.get("/transactions/{transaction_id}", response_model=TransactionOut)
async def get_transaction(
    transaction_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Récupère une transaction par son ID"""
    collection = get_collection("transactions")
    transaction = await collection.find_one({
        "id": transaction_id,
        "userId": current_user["id"]
    })
    
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction non trouvée")
    
    return transaction

@router.post("/refund")
async def refund_payment(
    transaction_id: str = Body(..., embed=True),
    reason: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Rembourse un paiement"""
    collection = get_collection("transactions")
    
    # Récupérer la transaction
    transaction = await collection.find_one({
        "id": transaction_id,
        "userId": current_user["id"]
    })
    
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction non trouvée")
    
    # Vérifier que la transaction est complétée
    if transaction["status"] != "completed":
        raise HTTPException(status_code=400, detail="Seules les transactions complétées peuvent être remboursées")
    
    # TODO: Appeler l'API de remboursement (Stripe/Flutterwave)
    
    # Mettre à jour le statut
    await collection.update_one(
        {"id": transaction_id},
        {"$set": {
            "status": "refunded",
            "refundedAt": datetime.now(),
            "refundReason": reason
        }}
    )
    
    return {"success": True}

"""Subscription Management API Routes for Mobile Money (DRC)"""
import os
from fastapi import APIRouter, HTTPException, Depends, status
from datetime import datetime, timedelta, timezone
import uuid
from typing import Optional, List
from bson.objectid import ObjectId
from db import get_collection
from middleware.auth_middleware import get_current_user

# ⚠️ SECURITY: The /create endpoint is a *simulation* that auto-confirms payment
# without any Mobile Money webhook. It must NOT be reachable in production until
# replaced by a real payment integration. Set ENABLE_SUBSCRIPTION_SIMULATION=1
# in dev/staging only.
ENABLE_SUBSCRIPTION_SIMULATION = os.getenv("ENABLE_SUBSCRIPTION_SIMULATION", "0") == "1"

router = APIRouter(prefix="/subscriptions", tags=["subscriptions"])

# Plan pricing in Congolese Francs (FC)
PLANS = {
    "free": {
        "price": 0, 
        "duration_days": 3650, 
        "name": "Gratuit",
        "limits": {
            "ai_messages_per_day": 20,
            "ai_file_upload": False,
            "max_products": 1,
            "premium_feed": False,
            "ai_model": "gpt-4o-mini",
            "ai_max_tokens": 300,
            "ai_history_limit": 3
        }
    },
    "monthly": {
        "price": 25000, 
        "duration_days": 30, 
        "name": "Standard",
        "limits": {
            "ai_messages_per_day": 120,
            "ai_file_upload": True,
            "max_products": 10,
            "premium_feed": True,
            "ai_model": "gpt-4o",
            "ai_max_tokens": 800,
            "ai_history_limit": 10
        }
    },
    "yearly": {
        "price": 250000, 
        "duration_days": 365, 
        "name": "Premium",
        "limits": {
            "ai_messages_per_day": 99999,
            "ai_messages_per_minute": 20,
            "ai_file_upload": True,
            "max_products": 999,
            "premium_feed": True,
            "ai_model": "gpt-4o",
            "ai_max_tokens": 2048,
            "ai_history_limit": 50
        }
    },
}

@router.get("/limits")
async def get_current_limits(current_user: dict = Depends(get_current_user)):
    """Helper to get current user limits for frontend UI"""
    try:
        subscriptions_col = get_collection("subscriptions")
        subscription = await subscriptions_col.find_one(
            {"user_id": current_user["id"], "status": "active"}
        )
        plan_id = subscription.get("plan_id", "free") if subscription else "free"
        limits = PLANS.get(plan_id, PLANS["free"])["limits"].copy()
        limits["plan_name"] = PLANS.get(plan_id, PLANS["free"])["name"]
        return limits
    except Exception as e:
        limits = PLANS["free"]["limits"].copy()
        limits["plan_name"] = PLANS["free"]["name"]
        return limits

@router.get("/status")
async def get_subscription_status(current_user: dict = Depends(get_current_user)):
    """Get current subscription status"""
    try:
        subscriptions_col = get_collection("subscriptions")
        # Find the most recent active subscription
        subscription = await subscriptions_col.find_one(
            {"user_id": current_user["id"], "status": "active"},
            sort=[("created_at", -1)]
        )
        
        if not subscription:
            return {
                "user_id": current_user["id"],
                "plan_id": "free",
                "status": "active",
                "created_at": datetime.now(timezone.utc).isoformat(),
                "expiry_date": None,
            }
        
        # Check for expiry
        if subscription.get("expiry_date"):
            expiry = subscription["expiry_date"]
            if isinstance(expiry, str):
                expiry = datetime.fromisoformat(expiry.replace("Z", "+00:00"))
            
            if expiry < datetime.now(timezone.utc):
                await subscriptions_col.update_one(
                    {"_id": subscription["_id"]},
                    {"$set": {"status": "expired"}}
                )
                return {
                    "user_id": current_user["id"],
                    "plan_id": "free",
                    "status": "active",
                    "expiry_date": None,
                }
        
        # Return subscription without MongoDB _id
        return {
            "user_id": str(subscription["user_id"]),
            "plan_id": subscription.get("plan_id", "free"),
            "status": subscription.get("status", "active"),
            "created_at": subscription.get("created_at").isoformat() if hasattr(subscription.get("created_at"), "isoformat") else subscription.get("created_at"),
            "expiry_date": subscription.get("expiry_date").isoformat() if hasattr(subscription.get("expiry_date"), "isoformat") else subscription.get("expiry_date"),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/create")
async def create_subscription(
    payload: dict,
    current_user: dict = Depends(get_current_user)
):
    """Initiate and automatically confirm a Mobile Money subscription payment (Simulation)"""
    if not ENABLE_SUBSCRIPTION_SIMULATION:
        raise HTTPException(
            status_code=503,
            detail="Subscription simulation disabled. Real payment integration required.",
        )
    try:
        plan_id = payload.get("plan_id")
        payment_method = payload.get("payment_method")
        operator = payload.get("operator")
        phone_number = payload.get("phone_number")
        
        if plan_id not in PLANS or plan_id == "free":
            raise HTTPException(status_code=400, detail="Invalid plan selected")
            
        if not phone_number or not operator:
            raise HTTPException(status_code=400, detail="Missing payment details")

        plan = PLANS[plan_id]
        now = datetime.now(timezone.utc)
        expiry_date = now + timedelta(days=plan["duration_days"])
        
        # Simulation: In a real scenario, this would involve an asynchronous webhook or polling
        # Here we directly create an active subscription and a completed payment record
        transaction_id = f"MM-{operator.upper()[:2]}-{str(uuid.uuid4())[:8].upper()}"
        
        subscriptions_col = get_collection("subscriptions")
        payment_history_col = get_collection("payment_history")
        
        # Ensure previous active subscriptions are closed
        await subscriptions_col.update_many(
            {"user_id": current_user["id"], "status": "active"},
            {"$set": {"status": "replaced", "replaced_at": now}}
        )
        
        # Update/Create subscription
        await subscriptions_col.update_one(
            {"user_id": current_user["id"]},
            {
                "$set": {
                    "plan_id": plan_id,
                    "status": "active",
                    "created_at": now,
                    "expiry_date": expiry_date,
                    "plan_name": plan["name"],
                    "operator": operator,
                    "phone_number": phone_number,
                    "last_transaction_id": transaction_id
                }
            },
            upsert=True
        )
        
        # Record payment as completed
        payment_doc = {
            "user_id": current_user["id"],
            "plan_id": plan_id,
            "amount": plan["price"],
            "currency": "FC",
            "payment_method": payment_method,
            "operator": operator,
            "phone_number": phone_number,
            "status": "completed",
            "transaction_id": transaction_id,
            "created_at": now
        }
        
        await payment_history_col.insert_one(payment_doc)
        
        return {
            "success": True,
            "message": f"Paiement de {plan['price']} FC via {operator} confirmé ! Votre abonnement {plan['name']} est maintenant actif.",
            "transaction_id": transaction_id,
            "subscription": {
                "plan_id": plan_id,
                "status": "active",
                "expiry_date": expiry_date.isoformat()
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/cancel")
async def cancel_subscription(current_user: dict = Depends(get_current_user)):
    """Cancel the current active subscription. 404 if none exists."""
    try:
        subscriptions_col = get_collection("subscriptions")
        subscription = await subscriptions_col.find_one({
            "user_id": current_user["id"],
            "status": "active",
        })
        if not subscription:
            raise HTTPException(status_code=404, detail="No active subscription")

        await subscriptions_col.update_one(
            {"_id": subscription["_id"]},
            {"$set": {"status": "cancelled", "cancelled_at": datetime.now(timezone.utc)}},
        )
        return {"success": True, "message": "Abonnement annulé"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/history")
async def get_payment_history(current_user: dict = Depends(get_current_user)):
    """Get payment history"""
    try:
        payment_history_col = get_collection("payment_history")
        payments = await payment_history_col.find(
            {"user_id": current_user["id"]}
        ).sort("created_at", -1).to_list(length=50)
        
        return [
            {
                "plan_id": p["plan_id"],
                "amount": p["amount"],
                "currency": p.get("currency", "FC"),
                "status": p["status"],
                "created_at": p["created_at"].isoformat() if isinstance(p["created_at"], datetime) else p["created_at"]
            }
            for p in payments
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

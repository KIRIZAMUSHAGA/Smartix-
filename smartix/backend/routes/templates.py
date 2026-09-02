"""
Routes pour les templates du marketplace
Recherche, achat, reviews, favoris
"""

from fastapi import APIRouter, Depends, HTTPException, Query, Body
from typing import Optional, List
from datetime import datetime
import math

# Dépendances
from middleware.auth_middleware import get_current_user, get_current_user_optional
from db import get_collection

# Modèles
from models.template import Template, TEMPLATE_STATUS, TEMPLATE_VISIBILITY
from models.transaction import Transaction, TRANSACTION_STATUS
from models.review import Review
from models.wallet import Wallet

# Schémas
from schemas.template import (
    TemplateCreate, TemplateUpdate, TemplateOut,
    TemplateSearchResult
)
from schemas.review import ReviewCreate, ReviewUpdate, ReviewOut, ReviewListOut
from schemas.payment import TransactionOut

router = APIRouter(prefix="/api/templates", tags=["Templates"])

# =============================
# RECHERCHE ET LISTING
# =============================

@router.get("/", response_model=TemplateSearchResult)
async def get_templates(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=50),
    category: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    is_free: Optional[bool] = None,
    sort: str = Query("trending", pattern="^(trending|recent|popular|price_asc|price_desc)$"),
    current_user: dict = Depends(get_current_user_optional)
):
    """Récupère les templates (public)"""
    collection = get_collection("templates")
    
    # Filtres
    query = {"status": TEMPLATE_STATUS["APPROVED"]}
    
    if category:
        query["category"] = category
    
    if min_price is not None or max_price is not None:
        query["price"] = {}
        if min_price is not None:
            query["price"]["$gte"] = min_price
        if max_price is not None:
            query["price"]["$lte"] = max_price
    
    if is_free is not None:
        query["isFree"] = is_free
    
    # Tri
    sort_options = {
        "trending": ("stats.trendingScore", -1),
        "recent": ("createdAt", -1),
        "popular": ("stats.purchases", -1),
        "price_asc": ("price", 1),
        "price_desc": ("price", -1)
    }
    sort_field, sort_order = sort_options.get(sort, sort_options["trending"])
    
    # Total
    total = await collection.count_documents(query)
    
    # Pagination
    skip = (page - 1) * limit
    cursor = collection.find(query).sort(sort_field, sort_order).skip(skip).limit(limit)
    templates = await cursor.to_list(length=limit)
    
    # Facettes
    pipeline = [
        {"$match": {"status": TEMPLATE_STATUS["APPROVED"]}},
        {"$group": {
            "_id": "$category",
            "count": {"$sum": 1}
        }}
    ]
    categories = await collection.aggregate(pipeline).to_list(length=100)
    
    return {
        "templates": templates,
        "total": total,
        "offset": skip,
        "limit": limit,
        "hasMore": skip + limit < total,
        "facets": {
            "categories": {c["_id"]: c["count"] for c in categories if c["_id"]}
        }
    }

@router.get("/search", response_model=TemplateSearchResult)
async def search_templates(
    q: str = Query(..., min_length=2),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=50),
    category: Optional[str] = None
):
    """Recherche textuelle de templates"""
    collection = get_collection("templates")
    
    # Recherche textuelle
    query = {
        "status": TEMPLATE_STATUS["APPROVED"],
        "$text": {"$search": q}
    }
    
    if category:
        query["category"] = category
    
    total = await collection.count_documents(query)
    skip = (page - 1) * limit
    
    cursor = collection.find(query).sort("stats.trendingScore", -1).skip(skip).limit(limit)
    templates = await cursor.to_list(length=limit)
    
    return {
        "templates": templates,
        "total": total,
        "offset": skip,
        "limit": limit,
        "hasMore": skip + limit < total
    }

@router.get("/trending")
async def get_trending_templates(limit: int = Query(10, le=50)):
    """Récupère les templates tendance"""
    collection = get_collection("templates")
    cursor = collection.find({"status": TEMPLATE_STATUS["APPROVED"]}) \
        .sort("stats.trendingScore", -1) \
        .limit(limit)
    templates = await cursor.to_list(length=limit)
    return templates

@router.get("/{template_id}", response_model=TemplateOut)
async def get_template(
    template_id: str,
    current_user: dict = Depends(get_current_user_optional)
):
    """Récupère un template par son ID"""
    collection = get_collection("templates")
    template = await collection.find_one({"id": template_id})
    
    if not template:
        raise HTTPException(status_code=404, detail="Template non trouvé")
    
    # Incrémenter les vues
    template_obj = Template.from_dict(template)
    template_obj.increment_view(isUnique=current_user is not None)
    await collection.update_one(
        {"id": template_id},
        {"$set": {"stats": template_obj.stats}}
    )
    
    return template

# =============================
# PUBLICATION
# =============================

@router.post("/publish", response_model=TemplateOut, status_code=201)
async def publish_template(
    template_data: TemplateCreate,
    current_user: dict = Depends(get_current_user)
):
    """Publie un nouveau template"""
    collection = get_collection("templates")
    
    template = Template({
        **template_data.dict(),
        "sellerId": current_user["id"],
        "status": TEMPLATE_STATUS["PENDING_REVIEW"]
    })
    
    await collection.insert_one(template.to_dict())
    return template.to_dict()

@router.put("/{template_id}/listing", response_model=TemplateOut)
async def update_listing(
    template_id: str,
    updates: TemplateUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Met à jour un listing de template"""
    collection = get_collection("templates")
    
    # Vérifier que le template appartient à l'utilisateur
    template = await collection.find_one({
        "id": template_id,
        "sellerId": current_user["id"]
    })
    
    if not template:
        raise HTTPException(status_code=404, detail="Template non trouvé")
    
    template_obj = Template.from_dict(template)
    template_obj.update(updates.dict(exclude_unset=True))
    
    await collection.replace_one({"id": template_id}, template_obj.to_dict())
    return template_obj.to_dict()

# =============================
# ACHATS
# =============================

@router.post("/{template_id}/purchase", response_model=TransactionOut)
async def purchase_template(
    template_id: str,
    payment_method: str = Body(..., embed=True),
    current_user: dict = Depends(get_current_user)
):
    """Achète un template"""
    templates_col = get_collection("templates")
    transactions_col = get_collection("transactions")
    wallets_col = get_collection("wallets")
    
    # Récupérer le template
    template = await templates_col.find_one({"id": template_id})
    if not template:
        raise HTTPException(status_code=404, detail="Template non trouvé")
    
    # Vérifier que l'utilisateur n'achète pas son propre template
    if template["sellerId"] == current_user["id"]:
        raise HTTPException(status_code=400, detail="Vous ne pouvez pas acheter vos propres templates")
    
    # Vérifier que l'utilisateur n'a pas déjà acheté
    existing = await transactions_col.find_one({
        "userId": current_user["id"],
        "templateId": template_id,
        "status": TRANSACTION_STATUS["COMPLETED"]
    })
    
    if existing:
        raise HTTPException(status_code=400, detail="Template déjà acheté")
    
    # Créer la transaction
    transaction = Transaction({
        "userId": current_user["id"],
        "templateId": template_id,
        "sellerId": template["sellerId"],
        "amount": template["price"],
        "currency": template["currency"],
        "paymentMethod": payment_method
    })
    
    # TODO: Traiter le paiement avec Stripe/Flutterwave ici
    # Pour l'instant, on simule un paiement réussi
    transaction.complete(f"payment_{uuid.uuid4().hex[:12]}")
    
    await transactions_col.insert_one(transaction.to_dict())
    
    # Mettre à jour les stats du template
    template_obj = Template.from_dict(template)
    template_obj.add_purchase(template["price"])
    await templates_col.update_one(
        {"id": template_id},
        {"$set": {"stats": template_obj.stats}}
    )
    
    # Mettre à jour le wallet du vendeur
    wallet = await wallets_col.find_one({"sellerId": template["sellerId"]})
    if wallet:
        wallet_obj = Wallet.from_dict(wallet)
        wallet_obj.add_earning(
            transaction.sellerAmount,
            transaction.id,
            f"Vente de {template['name']}"
        )
        await wallets_col.replace_one({"sellerId": template["sellerId"]}, wallet_obj.to_dict())
    else:
        new_wallet = Wallet({"sellerId": template["sellerId"]})
        new_wallet.add_earning(
            transaction.sellerAmount,
            transaction.id,
            f"Vente de {template['name']}"
        )
        await wallets_col.insert_one(new_wallet.to_dict())
    
    return transaction.to_dict()

# =============================
# FAVORIS
# =============================

@router.post("/{template_id}/favorite")
async def add_to_favorites(
    template_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Ajoute un template aux favoris"""
    users_col = get_collection("users")
    
    result = await users_col.update_one(
        {"id": current_user["id"]},
        {"$addToSet": {"favorite_templates": template_id}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Template non trouvé")
    
    # Incrémenter le compteur de favoris du template
    templates_col = get_collection("templates")
    await templates_col.update_one(
        {"id": template_id},
        {"$inc": {"stats.favorites": 1}}
    )
    
    return {"success": True}

@router.delete("/{template_id}/favorite")
async def remove_from_favorites(
    template_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Retire un template des favoris"""
    users_col = get_collection("users")
    
    result = await users_col.update_one(
        {"id": current_user["id"]},
        {"$pull": {"favorite_templates": template_id}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Template non trouvé")
    
    # Décrémenter le compteur de favoris du template
    templates_col = get_collection("templates")
    await templates_col.update_one(
        {"id": template_id},
        {"$inc": {"stats.favorites": -1}}
    )
    
    return {"success": True}

@router.get("/user/favorites")
async def get_favorites(
    current_user: dict = Depends(get_current_user)
):
    """Récupère les templates favoris de l'utilisateur"""
    users_col = get_collection("users")
    templates_col = get_collection("templates")
    
    user = await users_col.find_one({"id": current_user["id"]})
    favorite_ids = user.get("favorite_templates", [])
    
    templates = []
    for tid in favorite_ids:
        template = await templates_col.find_one({"id": tid})
        if template:
            templates.append(template)
    
    return templates

# =============================
# REVIEWS
# =============================

@router.get("/{template_id}/reviews", response_model=ReviewListOut)
async def get_reviews(
    template_id: str,
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=50),
    sort: str = Query("recent", pattern="^(recent|helpful|rating_high|rating_low)$")
):
    """Récupère les avis d'un template"""
    collection = get_collection("reviews")
    
    query = {"templateId": template_id}
    total = await collection.count_documents(query)
    
    # Tri
    sort_options = {
        "recent": ("createdAt", -1),
        "helpful": ("helpful", -1),
        "rating_high": ("rating", -1),
        "rating_low": ("rating", 1)
    }
    sort_field, sort_order = sort_options.get(sort, sort_options["recent"])
    
    skip = (page - 1) * limit
    cursor = collection.find(query).sort(sort_field, sort_order).skip(skip).limit(limit)
    reviews = await cursor.to_list(length=limit)
    
    # Distribution des notes
    pipeline = [
        {"$match": {"templateId": template_id}},
        {"$group": {
            "_id": "$rating",
            "count": {"$sum": 1}
        }}
    ]
    distribution_raw = await collection.aggregate(pipeline).to_list(length=5)
    distribution = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
    for d in distribution_raw:
        distribution[d["_id"]] = d["count"]
    
    # Note moyenne
    avg_pipeline = [
        {"$match": {"templateId": template_id}},
        {"$group": {
            "_id": None,
            "average": {"$avg": "$rating"}
        }}
    ]
    avg_result = await collection.aggregate(avg_pipeline).to_list(length=1)
    average = avg_result[0]["average"] if avg_result else 0
    
    return {
        "reviews": reviews,
        "total": total,
        "average": round(average, 1),
        "distribution": distribution,
        "offset": skip,
        "limit": limit,
        "hasMore": skip + limit < total
    }

@router.post("/{template_id}/reviews", response_model=ReviewOut)
async def add_review(
    template_id: str,
    review_data: ReviewCreate,
    current_user: dict = Depends(get_current_user)
):
    """Ajoute un avis sur un template"""
    reviews_col = get_collection("reviews")
    templates_col = get_collection("templates")
    transactions_col = get_collection("transactions")
    
    # Vérifier que l'utilisateur n'a pas déjà reviewé
    existing = await reviews_col.find_one({
        "userId": current_user["id"],
        "templateId": template_id
    })
    
    if existing:
        raise HTTPException(status_code=400, detail="Vous avez déjà reviewé ce template")
    
    # Vérifier que l'utilisateur a acheté le template
    purchased = await transactions_col.find_one({
        "userId": current_user["id"],
        "templateId": template_id,
        "status": TRANSACTION_STATUS["COMPLETED"]
    })
    
    review = Review({
        **review_data.dict(),
        "userId": current_user["id"],
        "templateId": template_id,
        "verified": purchased is not None
    })
    
    await reviews_col.insert_one(review.to_dict())
    
    # Mettre à jour la note moyenne du template
    pipeline = [
        {"$match": {"templateId": template_id}},
        {"$group": {
            "_id": None,
            "average": {"$avg": "$rating"},
            "count": {"$sum": 1}
        }}
    ]
    result = await reviews_col.aggregate(pipeline).to_list(length=1)
    
    if result:
        await templates_col.update_one(
            {"id": template_id},
            {"$set": {
                "stats.averageRating": round(result[0]["average"], 1),
                "stats.totalReviews": result[0]["count"]
            }}
        )
    
    return review.to_dict()

@router.post("/reviews/{review_id}/helpful")
async def mark_helpful(
    review_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Marque un avis comme utile"""
    collection = get_collection("reviews")
    
    result = await collection.update_one(
        {"id": review_id},
        {"$inc": {"helpful": 1}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Avis non trouvé")
    
    return {"success": True}

# =============================
# STATISTIQUES VENDEUR
# =============================

@router.get("/seller/balance")
async def get_seller_balance(
    current_user: dict = Depends(get_current_user)
):
    """Récupère le solde du vendeur"""
    wallets_col = get_collection("wallets")
    
    wallet = await wallets_col.find_one({"sellerId": current_user["id"]})
    
    if not wallet:
        return {
            "balance": 0,
            "pending": 0,
            "paid": 0
        }
    
    return {
        "balance": wallet["balance"],
        "pending": wallet["pending"],
        "paid": wallet["paid"]
    }
